exports.up = async function up(knex) {
  await knex.raw('LOCK TABLE travellers IN SHARE ROW EXCLUSIVE MODE');
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS traveller_id_seq START WITH 25');
  await knex.raw(`SELECT setval('traveller_id_seq', GREATEST(
    (SELECT last_value - CASE WHEN is_called THEN 0 ELSE 1 END FROM traveller_id_seq),
    COALESCE((SELECT MAX(substring(traveller_id FROM '^T-([0-9]+)$')::bigint) FROM travellers), 24)
  ), true)`);
  // No truncation after 999: lpad's width grows with the number of digits.
  await knex.raw(`CREATE OR REPLACE FUNCTION next_traveller_id() RETURNS text
    LANGUAGE sql VOLATILE AS $$
      SELECT 'T-' || lpad(value::text, GREATEST(3, length(value::text)), '0')
      FROM nextval('traveller_id_seq') AS ids(value)
    $$`);
  await knex.raw('ALTER TABLE travellers ALTER COLUMN traveller_id SET DEFAULT next_traveller_id()');
};

exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE travellers ALTER COLUMN traveller_id DROP DEFAULT');
  await knex.raw('DROP FUNCTION IF EXISTS next_traveller_id()');
  await knex.raw('DROP SEQUENCE IF EXISTS traveller_id_seq');
};
