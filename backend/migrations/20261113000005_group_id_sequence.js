// M2: IDs for app-created groups. Seeded groups are G-01 … G-12; new ones start at G-1001,
// so they can never collide (tasks/PLAN.md §1). The DB fills group_id by default.
exports.up = async function up(knex) {
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS group_id_seq START WITH 1001');
  await knex.raw(`CREATE OR REPLACE FUNCTION next_group_id() RETURNS text
    LANGUAGE sql VOLATILE AS $$ SELECT 'G-' || nextval('group_id_seq')::text $$`);
  await knex.raw('ALTER TABLE groups ALTER COLUMN group_id SET DEFAULT next_group_id()');
  await knex.raw('CREATE INDEX IF NOT EXISTS groups_member_ids_gin ON groups USING gin (member_ids)');
  await knex.raw('CREATE INDEX IF NOT EXISTS groups_owner_id_idx ON groups (owner_id)');
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS groups_owner_id_idx');
  await knex.raw('DROP INDEX IF EXISTS groups_member_ids_gin');
  await knex.raw('ALTER TABLE groups ALTER COLUMN group_id DROP DEFAULT');
  await knex.raw('DROP FUNCTION IF EXISTS next_group_id()');
  await knex.raw('DROP SEQUENCE IF EXISTS group_id_seq');
};
