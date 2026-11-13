// M3: every submitted traveller search is saved so its matches (M4) can be shown again
// after a refresh or a backend restart. IDs look like S-1001, S-1002, …
exports.up = async function up(knex) {
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS search_id_seq START WITH 1001');
  await knex.schema.createTable('searches', (t) => {
    t.text('search_id').primary().defaultTo(knex.raw("'S-' || nextval('search_id_seq')::text"));
    t.text('traveller_id').notNullable().references('traveller_id').inTable('travellers').onDelete('CASCADE');
    t.text('home_city').notNullable();
    t.text('city').notNullable().references('city').inTable('destinations');
    t.date('check_in').notNullable();
    t.date('check_out').notNullable();
    t.integer('budget_inr').notNullable();
    t.specificType('interests', 'text[]').notNullable().defaultTo('{}');
    t.text('gender').notNullable();
    t.text('gender_preference').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['traveller_id', 'created_at']);
  });
  await knex.raw(`ALTER TABLE searches
    ADD CONSTRAINT searches_dates_chk CHECK (check_out > check_in),
    ADD CONSTRAINT searches_budget_chk CHECK (budget_inr > 0),
    ADD CONSTRAINT searches_gender_chk CHECK (gender IN ('FEMALE', 'MALE')),
    ADD CONSTRAINT searches_pref_chk CHECK (gender_preference IN ('ANY', 'SAME_GENDER'))`);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('searches');
  await knex.raw('DROP SEQUENCE IF EXISTS search_id_seq');
};
