const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../../../src/services/groupPhotos.service.ts');
const controller = require('../../../src/controllers/groupPhotos.controller.ts');
const { mockRes } = require('../../helpers/mockRes');

const req = (extra = {}) => ({ traveller: { traveller_id: 'T-002' }, params: { groupId: 'G-01' }, body: {}, ...extra });

describe('groupPhotos.controller', () => {
  afterEach(() => mock.restoreAll());

  it('uploadPhotos → 201 with multer files and body', async () => {
    const upload = mock.method(service, 'uploadPhotos', async () => [{ photo_id: 'P-1001' }]);
    const res = mockRes();
    const files = [{ originalname: 'a.png' }];
    await controller.uploadPhotos(req({ files, body: { captions: '[]' } }), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(upload.mock.calls[0].arguments, ['T-002', 'G-01', files, { captions: '[]' }]);
  });

  it('list / get / delete → 200 with the ids from params', async () => {
    mock.method(service, 'listPhotos', async () => ({ photos: [] }));
    const get = mock.method(service, 'getPhoto', async () => ({}));
    const del = mock.method(service, 'deletePhoto', async () => ({ deleted: 'P-1001' }));
    const res = mockRes();
    await controller.listPhotos(req(), res);
    assert.equal(res.statusCode, 200);
    await controller.getPhoto(req({ params: { groupId: 'G-01', photoId: 'P-1001' } }), mockRes());
    assert.deepEqual(get.mock.calls[0].arguments, ['T-002', 'G-01', 'P-1001']);
    await controller.deletePhoto(req({ params: { groupId: 'G-01', photoId: 'P-1001' } }), mockRes());
    assert.deepEqual(del.mock.calls[0].arguments, ['T-002', 'G-01', 'P-1001']);
  });
});
