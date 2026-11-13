// X4: group trip photo gallery. The image files live in S3-compatible storage (MinIO locally);
// this table only holds their metadata. IDs look like P-1001, P-1002, …
exports.up = async function up(knex) {
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS group_photo_id_seq START WITH 1001');
  await knex.schema.createTable('group_photos', (t) => {
    t.text('photo_id').primary().defaultTo(knex.raw("'P-' || nextval('group_photo_id_seq')::text"));
    t.text('group_id').notNullable().references('group_id').inTable('groups').onDelete('CASCADE');
    t.text('uploader_id').notNullable().references('traveller_id').inTable('travellers');
    t.text('object_key').notNullable().unique(); // groups/<group_id>/<photo_id>.<ext> in the bucket
    t.text('mime_type').notNullable();
    t.integer('size_bytes').notNullable();
    t.integer('width');
    t.integer('height');
    t.text('caption');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['group_id', 'created_at']);
  });
  await knex.raw(`ALTER TABLE group_photos
    ADD CONSTRAINT group_photos_mime_chk CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    ADD CONSTRAINT group_photos_size_chk CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    ADD CONSTRAINT group_photos_caption_chk CHECK (caption IS NULL OR length(caption) BETWEEN 1 AND 300)`);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('group_photos');
  await knex.raw('DROP SEQUENCE IF EXISTS group_photo_id_seq');
};
