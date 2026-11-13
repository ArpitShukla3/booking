const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const groupsHelper = require('../../../src/helpers/postgres/groups.helper');
const groupHotelsHelper = require('../../../src/helpers/postgres/groupHotels.helper');
const groupPhotosHelper = require('../../../src/helpers/postgres/groupPhotos.helper');
const photoStorage = require('../../../src/helpers/storage/photos.helper');
const transactionHelper = require('../../../src/helpers/postgres/transaction.helper');
const HttpError = require('../../../src/utils/HttpError');
const service = require('../../../src/services/groupPhotos.service.ts');

// 1×1 PNG and a minimal JPEG header (SOF0 says 640×480).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8X'), Buffer.alloc(8), Buffer.from([0x7f, 0x02, 0x00, 0xdf, 0x01, 0x00])]);
const file = (buffer, over = {}) => ({ originalname: 'photo.png', mimetype: 'image/png', size: buffer.length, buffer, ...over });
const group = (over = {}) => ({ group_id: 'G-01', name: 'Kyoto', owner_id: 'T-001', member_ids: ['T-001', 'T-002'], city: 'Kyoto', country_name: 'Japan', check_in: '2027-04-10', check_out: '2027-04-15', ...over });
const row = (over = {}) => ({ photo_id: 'P-1001', group_id: 'G-01', uploader_id: 'T-002', uploader_name: 'Priya Shah', object_key: 'groups/G-01/P-1001.png', mime_type: 'image/png', size_bytes: 70, width: 1, height: 1, caption: null, created_at: 'now', ...over });
const is = (status) => (err) => err instanceof HttpError && err.status === status;

function openGallery({ g = group(), booked = true } = {}) {
  mock.method(groupsHelper, 'findById', async () => g);
  mock.method(groupHotelsHelper, 'findBooking', async () => (booked ? { booking_id: 'BK-1' } : undefined));
  mock.method(photoStorage, 'signedUrl', async (key) => `http://minio/${key}?sig`);
}

describe('groupPhotos.service pure rules', () => {
  it('detects JPEG, PNG and WebP from bytes, nothing else', () => {
    assert.equal(service.detectImageType(PNG), 'image/png');
    assert.equal(service.detectImageType(JPEG), 'image/jpeg');
    assert.equal(service.detectImageType(WEBP), 'image/webp');
    assert.equal(service.detectImageType(Buffer.from('GIF89a...')), null);
    assert.equal(service.detectImageType(Buffer.from('<svg></svg>')), null);
    assert.equal(service.detectImageType(Buffer.alloc(0)), null);
  });
  it('reads image size from headers (null when unreadable)', () => {
    assert.deepEqual(service.imageSize(PNG, 'image/png'), { width: 1, height: 1 });
    assert.deepEqual(service.imageSize(JPEG, 'image/jpeg'), { width: 640, height: 480 });
    assert.deepEqual(service.imageSize(WEBP, 'image/webp'), { width: 640, height: 480 });
    assert.equal(service.imageSize(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'), null);
  });
  it('object keys live under the group with the right extension', () => {
    assert.equal(service.objectKey('G-01', 'P-1001', 'image/jpeg'), 'groups/G-01/P-1001.jpg');
    assert.equal(service.objectKey('G-01', 'P-1002', 'image/webp'), 'groups/G-01/P-1002.webp');
  });
  it('canDelete: uploader or organiser only', () => {
    assert.equal(service.canDelete('T-001', { uploader_id: 'T-002' }, 'T-002'), true);
    assert.equal(service.canDelete('T-001', { uploader_id: 'T-002' }, 'T-001'), true);
    assert.equal(service.canDelete('T-001', { uploader_id: 'T-002' }, 'T-003'), false);
  });
  it('parseCaptions: JSON array, plain string, trimming, blanks → null, max 300', () => {
    assert.deepEqual(service.parseCaptions('["  Sunrise ", ""]', 2), ['Sunrise', null]);
    assert.deepEqual(service.parseCaptions('Only one', 2), ['Only one', null]);
    assert.deepEqual(service.parseCaptions(undefined, 1), [null]);
    assert.throws(() => service.parseCaptions(JSON.stringify(['x'.repeat(301)]), 1), is(400));
  });
  it('checkFiles: count, per-group limit, size and real type', () => {
    assert.throws(() => service.checkFiles([], 0), is(400));
    assert.throws(() => service.checkFiles(Array(11).fill(file(PNG)), 0), is(400));
    assert.throws(() => service.checkFiles([file(PNG), file(PNG)], 199), (e) => is(400)(e) && /1 more/.test(e.fields.photos));
    assert.throws(() => service.checkFiles([file(PNG, { size: 5 * 1024 * 1024 + 1 })], 0), is(400));
    assert.throws(() => service.checkFiles([file(Buffer.from('not an image'), { mimetype: 'image/png' })], 0), (e) => /not a JPEG, PNG or WebP/.test(e.fields.photos));
    assert.equal(service.checkFiles([file(PNG), file(JPEG)], 0).map((c) => c.mime).join(), 'image/png,image/jpeg');
  });
});

describe('groupPhotos.service access and use cases', () => {
  afterEach(() => mock.restoreAll());

  it('404 unknown group, 403 non-member, 409 before booking', async () => {
    mock.method(groupsHelper, 'findById', async () => undefined);
    await assert.rejects(service.listPhotos('T-001', 'G-404'), is(404));
    mock.restoreAll();
    openGallery();
    await assert.rejects(service.listPhotos('T-009', 'G-01'), is(403));
    mock.restoreAll();
    openGallery({ booked: false });
    await assert.rejects(service.listPhotos('T-001', 'G-01'), is(409));
  });

  it('list returns signed links, can_delete per photo and remaining room', async () => {
    openGallery();
    mock.method(groupPhotosHelper, 'listByGroup', async () => [row(), row({ photo_id: 'P-1002', uploader_id: 'T-001', uploader_name: 'Sarah' })]);
    const gallery = await service.listPhotos('T-002', 'g-01');
    assert.equal(gallery.photos[0].url, 'http://minio/groups/G-01/P-1001.png?sig');
    assert.deepEqual(gallery.photos.map((p) => p.can_delete), [true, false]);
    assert.equal(gallery.photos[1].uploader.is_owner, true);
    assert.equal(gallery.limits.remaining, 198);
    assert.equal(gallery.group.trip_finished, false);
  });

  it('getPhoto returns position and prev/next ids (newest first)', async () => {
    openGallery();
    mock.method(groupPhotosHelper, 'listByGroup', async () => [row({ photo_id: 'P-1003' }), row({ photo_id: 'P-1002' }), row({ photo_id: 'P-1001' })]);
    const middle = await service.getPhoto('T-001', 'G-01', 'p-1002');
    assert.deepEqual([middle.position, middle.total, middle.prev_photo_id, middle.next_photo_id], [2, 3, 'P-1003', 'P-1001']);
    await assert.rejects(service.getPhoto('T-001', 'G-01', 'P-9999'), is(404));
  });

  it('upload: stores every file, then inserts all rows in one transaction', async () => {
    openGallery();
    let n = 1000;
    mock.method(groupPhotosHelper, 'countByGroup', async () => 0);
    mock.method(groupPhotosHelper, 'nextPhotoId', async () => `P-${++n}`);
    const put = mock.method(photoStorage, 'put', async () => {});
    mock.method(transactionHelper, 'withTransaction', async (work) => work('TRX'));
    const insert = mock.method(groupPhotosHelper, 'insertMany', async () => {});
    mock.method(groupPhotosHelper, 'listByGroup', async () => [row({ photo_id: 'P-1002', object_key: 'groups/G-01/P-1002.jpg' }), row()]);
    const created = await service.uploadPhotos('T-002', 'G-01', [file(PNG), file(JPEG)], { captions: '["Sunrise", ""]' });
    assert.deepEqual(put.mock.calls.map((c) => c.arguments[0]), ['groups/G-01/P-1001.png', 'groups/G-01/P-1002.jpg']);
    const rows = insert.mock.calls[0].arguments[0];
    assert.equal(insert.mock.calls[0].arguments[1], 'TRX');
    assert.deepEqual(rows.map((r) => [r.photo_id, r.mime_type, r.caption, r.uploader_id]), [['P-1001', 'image/png', 'Sunrise', 'T-002'], ['P-1002', 'image/jpeg', null, 'T-002']]);
    assert.deepEqual([rows[1].width, rows[1].height], [640, 480]);
    assert.equal(created.length, 2);
  });

  it('upload: if the database insert fails, the stored objects are deleted again (503)', async () => {
    openGallery();
    mock.method(groupPhotosHelper, 'countByGroup', async () => 0);
    mock.method(groupPhotosHelper, 'nextPhotoId', async () => 'P-1001');
    mock.method(photoStorage, 'put', async () => {});
    const removed = mock.method(photoStorage, 'remove', async () => {});
    mock.method(transactionHelper, 'withTransaction', async () => { throw new Error('db down'); });
    await assert.rejects(service.uploadPhotos('T-002', 'G-01', [file(PNG)], {}), is(503));
    assert.deepEqual(removed.mock.calls.map((c) => c.arguments[0]), ['groups/G-01/P-1001.png']);
  });

  it('upload: invalid files are rejected before anything is stored', async () => {
    openGallery();
    mock.method(groupPhotosHelper, 'countByGroup', async () => 0);
    const put = mock.method(photoStorage, 'put', async () => {});
    await assert.rejects(service.uploadPhotos('T-002', 'G-01', [file(PNG), file(Buffer.from('%PDF-1.7'))], {}), is(400));
    assert.equal(put.mock.callCount(), 0);
  });

  it('delete: uploader or organiser; row first, then the object', async () => {
    openGallery();
    mock.method(groupPhotosHelper, 'findInGroup', async () => row());
    const removeRow = mock.method(groupPhotosHelper, 'remove', async () => 1);
    const removeObject = mock.method(photoStorage, 'remove', async () => {});
    await assert.rejects(service.deletePhoto('T-003', 'G-01', 'P-1001'), is(403)); // T-003 not a member → 403 first
    mock.method(groupsHelper, 'findById', async () => group({ member_ids: ['T-001', 'T-002', 'T-003'] }));
    await assert.rejects(service.deletePhoto('T-003', 'G-01', 'P-1001'), is(403)); // member, not uploader/owner
    assert.equal(removeRow.mock.callCount(), 0);
    assert.deepEqual(await service.deletePhoto('T-001', 'G-01', 'p-1001'), { deleted: 'P-1001' });
    assert.deepEqual(removeObject.mock.calls[0].arguments, ['groups/G-01/P-1001.png']);
  });
});
