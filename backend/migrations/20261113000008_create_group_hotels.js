// M6: the Common Group Page shortlist and the group's single booking.
// Booking IDs look like BK-1001, BK-1002, … Booking does NOT change `availability`
// (the catalog stays read-only; see README known limitations).
exports.up = async function up(knex) {
  await knex.schema.createTable('saved_hotel_options', (t) => {
    t.increments('id').primary();
    t.text('group_id').notNullable().references('group_id').inTable('groups').onDelete('CASCADE');
    t.text('room_id').notNullable().references('room_id').inTable('rooms').onDelete('CASCADE');
    t.text('saved_by').notNullable().references('traveller_id').inTable('travellers').onDelete('CASCADE');
    t.integer('rooms_count').notNullable();
    t.integer('nights').notNullable();
    t.integer('total_inr').notNullable();
    t.integer('per_member_inr').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['group_id', 'room_id', 'saved_by']);
    t.index(['group_id', 'created_at']);
  });

  await knex.raw('CREATE SEQUENCE IF NOT EXISTS group_booking_id_seq START WITH 1001');
  await knex.schema.createTable('group_bookings', (t) => {
    t.text('booking_id').primary().defaultTo(knex.raw("'BK-' || nextval('group_booking_id_seq')::text"));
    t.text('group_id').notNullable().unique().references('group_id').inTable('groups').onDelete('CASCADE');
    t.text('room_id').notNullable().references('room_id').inTable('rooms');
    t.integer('rooms_count').notNullable();
    t.integer('nights').notNullable();
    t.integer('total_inr').notNullable();
    t.integer('per_member_inr').notNullable();
    t.integer('members_count').notNullable();
    t.text('booked_by').notNullable().references('traveller_id').inTable('travellers');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(`ALTER TABLE saved_hotel_options
    ADD CONSTRAINT saved_hotel_options_positive_chk CHECK (rooms_count > 0 AND nights > 0 AND total_inr >= 0 AND per_member_inr >= 0)`);
  await knex.raw(`ALTER TABLE group_bookings
    ADD CONSTRAINT group_bookings_positive_chk CHECK (rooms_count > 0 AND nights > 0 AND members_count > 0 AND total_inr >= 0 AND per_member_inr >= 0)`);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('group_bookings');
  await knex.raw('DROP SEQUENCE IF EXISTS group_booking_id_seq');
  await knex.schema.dropTableIfExists('saved_hotel_options');
};
