/**
 * Schema for the hackathon data pack. Table names match the JSON file names
 * (travellers, groups, interests, destinations, hotels, rooms, availability).
 *
 * destinations.json is a single nested object, so it is split into:
 *   destinations      -> one row per destination city (countries[].cities[])
 *   departure_cities  -> departure_cities[]
 *   destination_links -> countries[].links[]
 *   destination_rules -> rules (single row)
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('interests', (t) => {
    t.text('interest').primary();
    t.text('label').notNullable();
    t.text('category').notNullable();
  });

  await knex.schema.createTable('destinations', (t) => {
    t.text('city').primary();
    t.text('country_code').notNullable();
    t.text('country_name').notNullable();
    t.text('timezone').notNullable();
    t.specificType('airports', 'text[]').notNullable().defaultTo('{}');
  });

  await knex.schema.createTable('departure_cities', (t) => {
    t.text('airport').primary();
    t.text('city').notNullable();
  });

  await knex.schema.createTable('destination_links', (t) => {
    t.increments('id').primary();
    t.text('from_city').notNullable().references('city').inTable('destinations');
    t.text('to_city').notNullable().references('city').inTable('destinations');
    t.specificType('transfer_ids', 'text[]').notNullable().defaultTo('{}');
    t.unique(['from_city', 'to_city']);
  });

  await knex.schema.createTable('destination_rules', (t) => {
    t.integer('id').primary().defaultTo(1);
    t.integer('min_nights').notNullable();
    t.integer('max_nights').notNullable();
    t.integer('min_nights_per_city').notNullable();
    t.date('first_night').notNullable();
    t.date('last_departure').notNullable();
  });

  await knex.schema.createTable('travellers', (t) => {
    t.text('traveller_id').primary();
    t.text('name').notNullable();
    t.integer('age');
    t.text('gender').notNullable();
    t.text('home_city');
    t.text('home_airport');
    t.specificType('interests', 'text[]').notNullable().defaultTo('{}');
    t.text('gender_preference').notNullable().defaultTo('ANY');
    t.timestamps(true, true);
  });
  await knex.raw(`
    ALTER TABLE travellers
      ADD CONSTRAINT travellers_gender_check CHECK (gender IN ('FEMALE', 'MALE')),
      ADD CONSTRAINT travellers_gender_preference_check CHECK (gender_preference IN ('ANY', 'SAME_GENDER'))
  `);

  await knex.schema.createTable('groups', (t) => {
    t.text('group_id').primary();
    t.text('name').notNullable();
    t.text('owner_id').notNullable().references('traveller_id').inTable('travellers');
    t.specificType('member_ids', 'text[]').notNullable().defaultTo('{}');
    t.text('city').notNullable().references('city').inTable('destinations');
    t.date('check_in').notNullable();
    t.date('check_out').notNullable();
    t.integer('max_size').notNullable();
    t.integer('budget_inr').notNullable();
    t.text('itinerary');
    t.timestamps(true, true);
    t.index(['city']);
  });
  await knex.raw(`
    ALTER TABLE groups
      ADD CONSTRAINT groups_dates_check CHECK (check_out > check_in),
      ADD CONSTRAINT groups_max_size_check CHECK (max_size > 0)
  `);

  await knex.schema.createTable('hotels', (t) => {
    t.text('hotel_id').primary();
    t.text('name').notNullable();
    t.specificType('aliases', 'text[]').notNullable().defaultTo('{}');
    t.text('city').notNullable().references('city').inTable('destinations');
    t.text('area');
    t.double('lat');
    t.double('lng');
    t.double('rating');
    t.integer('stars');
    t.text('check_in_from');
    t.text('check_out_until');
    t.boolean('family_friendly').notNullable().defaultTo(false);
    // Stored exactly as in the data pack, e.g. "images/hotels/HOTEL-TWIN-1.jpg".
    t.text('image');
    t.index(['city']);
  });

  await knex.schema.createTable('rooms', (t) => {
    t.text('room_id').primary();
    t.text('hotel_id').notNullable().references('hotel_id').inTable('hotels').onDelete('CASCADE');
    t.text('room_type').notNullable();
    t.text('name').notNullable();
    t.integer('max_adults').notNullable();
    t.integer('max_children').notNullable().defaultTo(0);
    t.integer('price_per_night_amount').notNullable();
    t.text('price_per_night_currency').notNullable().defaultTo('INR');
    t.boolean('refundable').notNullable().defaultTo(false);
    t.index(['hotel_id']);
  });

  await knex.schema.createTable('availability', (t) => {
    t.text('room_id').notNullable().references('room_id').inTable('rooms').onDelete('CASCADE');
    t.date('date').notNullable();
    t.integer('rooms_left').notNullable();
    t.primary(['room_id', 'date']);
  });
};

exports.down = async function down(knex) {
  for (const table of [
    'availability',
    'rooms',
    'hotels',
    'groups',
    'travellers',
    'destination_rules',
    'destination_links',
    'departure_cities',
    'destinations',
    'interests',
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
};
