// M5: a seeker's "Interested" request for a group, decided by the group owner.
// IDs look like R-1001, R-1002, … One request per (group, seeker): a repeated click or a
// re-request after REJECTED can never create a second row.
exports.up = async function up(knex) {
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS join_request_id_seq START WITH 1001');
  await knex.schema.createTable('join_requests', (t) => {
    t.text('request_id').primary().defaultTo(knex.raw("'R-' || nextval('join_request_id_seq')::text"));
    t.text('group_id').notNullable().references('group_id').inTable('groups').onDelete('CASCADE');
    t.text('seeker_id').notNullable().references('traveller_id').inTable('travellers').onDelete('CASCADE');
    t.text('status').notNullable().defaultTo('PENDING');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('decided_at', { useTz: true });
    t.unique(['group_id', 'seeker_id']);
    t.index(['group_id', 'status']);
    t.index(['seeker_id', 'created_at']);
  });
  await knex.raw(`ALTER TABLE join_requests
    ADD CONSTRAINT join_requests_status_chk CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    ADD CONSTRAINT join_requests_decided_chk CHECK ((status = 'PENDING') = (decided_at IS NULL))`);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('join_requests');
  await knex.raw('DROP SEQUENCE IF EXISTS join_request_id_seq');
};
