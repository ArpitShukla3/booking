// TASK-X3: hotel + traveller reviews and their retrieval index (contextual chunks, pgvector embeddings).
// Needs the pgvector extension (docker image pgvector/pgvector:pg16).
exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS vector');

  await knex.schema.createTable('reviews', (t) => {
    t.text('review_id').primary();
    t.text('subject_type').notNullable(); // HOTEL | TRAVELLER
    t.text('subject_id').notNullable(); // hotel_id or traveller_id
    t.text('author').notNullable();
    t.text('author_from').notNullable();
    t.decimal('rating', 3, 1).notNullable();
    t.integer('rating_scale').notNullable(); // 10 for hotels, 5 for travellers
    t.text('title');
    t.text('body').notNullable();
    t.integer('base_score').notNullable().defaultTo(0);
    t.text('created_at').notNullable(); // ISO timestamp (hotels) or YYYY-MM-DD (travellers), as written
    t.jsonb('meta').notNullable().defaultTo('{}'); // HOTEL: travel_type, comments; TRAVELLER: trip, votes
    t.index(['subject_type', 'subject_id']);
  });
  await knex.raw(`ALTER TABLE reviews
    ADD CONSTRAINT reviews_subject_type_chk CHECK (subject_type IN ('HOTEL', 'TRAVELLER')),
    ADD CONSTRAINT reviews_rating_chk CHECK (rating >= 0 AND rating <= rating_scale)`);

  await knex.schema.createTable('review_chunks', (t) => {
    t.text('chunk_id').primary();
    t.text('review_id').notNullable().references('review_id').inTable('reviews').onDelete('CASCADE');
    t.text('subject_type').notNullable();
    t.text('subject_id').notNullable();
    t.integer('position').notNullable();
    t.text('content').notNullable(); // the passage as written
    t.text('context').notNullable(); // situating context (Ollama, offline) prepended for retrieval
    t.text('context_model'); // null = template context (not contextualized by a model yet)
    t.text('embed_model');
    t.text('indexed_at');
    t.unique(['review_id', 'position']);
    t.index(['subject_type', 'subject_id']);
  });
  await knex.raw('ALTER TABLE review_chunks ADD COLUMN embedding vector(768)');
  await knex.raw('CREATE INDEX review_chunks_embedding_hnsw ON review_chunks USING hnsw (embedding vector_cosine_ops)');

  await knex.schema.createTable('review_questions', (t) => {
    t.text('question_id').primary();
    t.text('subject_type').notNullable();
    t.text('text').notNullable();
    t.integer('position').notNullable();
    t.unique(['subject_type', 'text']);
  });
  await knex.raw('ALTER TABLE review_questions ADD COLUMN embedding vector(768)');
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('review_questions');
  await knex.schema.dropTableIfExists('review_chunks');
  await knex.schema.dropTableIfExists('reviews');
  await knex.raw('DROP EXTENSION IF EXISTS vector');
};
