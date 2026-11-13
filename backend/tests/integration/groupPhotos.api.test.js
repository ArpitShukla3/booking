const { describe, it, after, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, asTraveller } = require('../helpers/http');
const { db, truncate, closeDb } = require('../helpers/db');
const photoStorage = require('../../src/helpers/storage/photos.helper');

// Needs MinIO running (npm run db:up); uses the separate test bucket (S3_BUCKET_TEST).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const URL = '/api/groups/G-01/photos';
let originalG01;
const setMembers = (ids) => db('groups').where({ group_id: 'G-01' }).update({ member_ids: ids });
async function book() {
  const room = await db({ r: 'rooms' }).join({ h: 'hotels' }, 'h.hotel_id', 'r.hotel_id').where('h.city', 'Kyoto').select('r.room_id').first();
  await db('group_bookings').insert({ group_id: 'G-01', room_id: room.room_id, rooms_count: 1, nights: 5, total_inr: 10000, per_member_inr: 5000, members_count: 2, booked_by: 'T-001' });
}
async function removeStoredObjects() {
  const keys = await db('group_photos').pluck('object_key');
  await Promise.allSettled(keys.map((key) => photoStorage.remove(key)));
}
const upload = (id, files = [['photos', PNG, 'sunrise.png']], captions) => {
  let req = asTraveller(id).post(URL);
  for (const [field, buf, name] of files) req = req.attach(field, buf, name);
  return captions ? req.field('captions', JSON.stringify(captions)) : req;
};

describe('Group photo gallery API (X4)', () => {
  before(async () => { originalG01 = (await db('groups').where({ group_id: 'G-01' }).first()).member_ids; });
  beforeEach(async () => { await removeStoredObjects(); await truncate('group_photos', 'group_bookings'); await setMembers(['T-001', 'T-002']); });
  after(async () => { await removeStoredObjects(); await truncate('group_photos', 'group_bookings'); await setMembers(originalG01); await closeDb(); });

  it('409 before booking; after booking a member uploads, the file is in storage and the link works', async () => {
    assert.equal((await asTraveller('T-001').get(URL)).status, 409);
    await book();
    const res = await upload('T-002', [['photos', PNG, 'sunrise.png']], ['  Sunrise at Fushimi Inari  ']);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const [photo] = res.body;
    assert.match(photo.photo_id, /^P-\d{4,}$/);
    assert.equal(photo.caption, 'Sunrise at Fushimi Inari');
    assert.equal(photo.mime_type, 'image/png');
    assert.deepEqual([photo.width, photo.height], [1, 1]);
    assert.equal(photo.can_delete, true);

    const rowInDb = await db('group_photos').where({ photo_id: photo.photo_id }).first();
    assert.equal(rowInDb.object_key, `groups/G-01/${photo.photo_id}.png`);
    assert.equal(await photoStorage.exists(rowInDb.object_key), true);
    const image = await fetch(photo.url);
    assert.equal(image.status, 200);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG);
    const tampered = await fetch(photo.url.replace(/X-Amz-Signature=[^&]+/, 'X-Amz-Signature=00'));
    assert.equal(tampered.status, 403);
  });

  it('list (newest first) and details with prev/next; other members see the photos', async () => {
    await book();
    const first = (await upload('T-002')).body[0];
    const second = (await upload('T-001')).body[0];
    const list = await asTraveller('T-002').get(URL);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.photos.map((p) => p.photo_id), [second.photo_id, first.photo_id]);
    assert.deepEqual(list.body.photos.map((p) => p.can_delete), [false, true]);
    assert.equal(list.body.limits.remaining, 198);
    const detail = await asTraveller('T-001').get(`${URL}/${first.photo_id}`);
    assert.deepEqual([detail.body.position, detail.body.total, detail.body.prev_photo_id, detail.body.next_photo_id], [2, 2, second.photo_id, null]);
    assert.equal((await asTraveller('T-001').get(`${URL}/P-999999`)).status, 404);
  });

  it('rejects non-images, empty uploads, too many files and too-large files; nothing is stored', async () => {
    await book();
    const bad = await upload('T-002', [['photos', Buffer.from('%PDF-1.7 not an image'), 'doc.png']]);
    assert.equal(bad.status, 400);
    assert.match(bad.body.error.fields.photos, /not a JPEG, PNG or WebP/);
    assert.equal((await asTraveller('T-002').post(URL)).status, 400);
    const eleven = await upload('T-002', Array.from({ length: 11 }, (_, i) => ['photos', PNG, `p${i}.png`]));
    assert.equal(eleven.status, 400);
    const big = await upload('T-002', [['photos', Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), 'big.png']]);
    assert.equal(big.status, 400);
    assert.match(big.body.error.fields.photos, /5 MB/);
    assert.equal(Number((await db('group_photos').count('* as n').first()).n), 0);
  });

  it('delete: uploader or organiser only; removes the row and the stored file', async () => {
    await book();
    const photo = (await upload('T-002')).body[0];
    const key = `groups/G-01/${photo.photo_id}.png`;
    await setMembers(['T-001', 'T-002', 'T-003']);
    assert.equal((await asTraveller('T-003').delete(`${URL}/${photo.photo_id}`)).status, 403);
    const res = await asTraveller('T-001').delete(`${URL}/${photo.photo_id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { deleted: photo.photo_id });
    assert.equal(await db('group_photos').where({ photo_id: photo.photo_id }).first(), undefined);
    assert.equal(await photoStorage.exists(key), false);
  });

  it('non-members (incl. a member who left) 403, unknown group 404, 401 without id', async () => {
    await book();
    assert.equal((await asTraveller('T-003').get(URL)).status, 403);
    assert.equal((await upload('T-003')).status, 403);
    await setMembers(['T-001']);
    assert.equal((await asTraveller('T-002').get(URL)).status, 403);
    assert.equal((await asTraveller('T-001').get('/api/groups/G-424242/photos')).status, 404);
    assert.equal((await api().get(URL)).status, 401);
    assert.equal((await api().post(URL).attach('photos', PNG, 'x.png')).status, 401);
  });
});
