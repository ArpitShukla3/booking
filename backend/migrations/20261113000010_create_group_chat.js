// S1: one team chat per group (chat_id C-1001…), messages (M-1001…), polls and votes.
// Access is a simple per-chat setting the owner changes in Group settings.
exports.up = async function up(knex) {
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS group_chat_id_seq START WITH 1001');
  await knex.schema.createTable('group_chats', (t) => {
    t.text('chat_id').primary().defaultTo(knex.raw("'C-' || nextval('group_chat_id_seq')::text"));
    t.text('group_id').notNullable().unique().references('group_id').inTable('groups').onDelete('CASCADE');
    t.text('messaging').notNullable().defaultTo('ALL_MEMBERS'); // who can send text messages
    t.text('polls').notNullable().defaultTo('ALL_MEMBERS'); // who can create polls
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(`ALTER TABLE group_chats
    ADD CONSTRAINT group_chats_messaging_chk CHECK (messaging IN ('ALL_MEMBERS', 'OWNER_ONLY')),
    ADD CONSTRAINT group_chats_polls_chk CHECK (polls IN ('ALL_MEMBERS', 'OWNER_ONLY'))`);

  await knex.schema.createTable('chat_messages', (t) => {
    t.bigIncrements('seq').primary(); // ordering + "after" cursor
    t.text('chat_id').notNullable().references('chat_id').inTable('group_chats').onDelete('CASCADE');
    t.text('sender_id').notNullable().references('traveller_id').inTable('travellers');
    t.text('type').notNullable(); // TEXT | ANNOUNCEMENT | POLL (content = poll question)
    t.text('content').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['chat_id', 'seq']);
  });
  // START (not only RESTART) so TRUNCATE … RESTART IDENTITY also goes back to 1001, never M-1.
  await knex.raw("ALTER SEQUENCE chat_messages_seq_seq START WITH 1001 RESTART WITH 1001");
  await knex.raw(`ALTER TABLE chat_messages
    ADD COLUMN message_id text GENERATED ALWAYS AS ('M-' || seq::text) STORED UNIQUE,
    ADD CONSTRAINT chat_messages_type_chk CHECK (type IN ('TEXT', 'ANNOUNCEMENT', 'POLL')),
    ADD CONSTRAINT chat_messages_content_chk CHECK (length(content) BETWEEN 1 AND 2000)`);

  await knex.schema.createTable('chat_poll_options', (t) => {
    t.increments('option_id').primary();
    t.text('message_id').notNullable().references('message_id').inTable('chat_messages').onDelete('CASCADE');
    t.text('label').notNullable();
    t.integer('position').notNullable();
    t.unique(['message_id', 'position']);
  });

  await knex.schema.createTable('chat_poll_votes', (t) => {
    t.text('message_id').notNullable().references('message_id').inTable('chat_messages').onDelete('CASCADE');
    t.integer('option_id').notNullable().references('option_id').inTable('chat_poll_options').onDelete('CASCADE');
    t.text('voter_id').notNullable().references('traveller_id').inTable('travellers').onDelete('CASCADE');
    t.timestamp('voted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.primary(['message_id', 'voter_id']); // one vote per person per poll (can be changed)
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('chat_poll_votes');
  await knex.schema.dropTableIfExists('chat_poll_options');
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('group_chats');
  await knex.raw('DROP SEQUENCE IF EXISTS group_chat_id_seq');
};
