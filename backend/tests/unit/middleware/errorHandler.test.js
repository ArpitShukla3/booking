// LOW level: the error shape every endpoint returns.
const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');

const HttpError = require('../../../src/utils/HttpError');
const { errorHandler, notFound } = require('../../../src/middleware/errorHandler');
const { mockRes } = require('../../helpers/mockRes');

describe('errorHandler', () => {
  it('uses the HttpError status and message', () => {
    const res = mockRes();
    errorHandler(HttpError.notFound('Group not found'), {}, res, () => {});
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: { message: 'Group not found' } });
  });

  it('includes field errors when given', () => {
    const res = mockRes();
    errorHandler(HttpError.badRequest('Invalid input', { city: 'Unknown city' }), {}, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body.error.fields, { city: 'Unknown city' });
  });

  it('turns malformed JSON into 400', () => {
    const res = mockRes();
    const err = Object.assign(new Error('bad json'), { type: 'entity.parse.failed' });
    errorHandler(err, {}, res, () => {});
    assert.equal(res.statusCode, 400);
  });

  it('hides unknown errors behind a 500', () => {
    const res = mockRes();
    const log = mock.method(console, 'error', () => {});
    errorHandler(new Error('secret db detail'), {}, res, () => {});
    log.mock.restore();
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error.message, 'Internal server error');
  });
});

describe('notFound', () => {
  it('returns 404 with the route', () => {
    const res = mockRes();
    notFound({ method: 'GET', path: '/api/nope' }, res);
    assert.equal(res.statusCode, 404);
    assert.match(res.body.error.message, /GET \/api\/nope/);
  });
});

describe('HttpError', () => {
  it('helpers set the right status codes', () => {
    assert.equal(HttpError.badRequest('x').status, 400);
    assert.equal(HttpError.unauthorized().status, 401);
    assert.equal(HttpError.forbidden().status, 403);
    assert.equal(HttpError.notFound().status, 404);
    assert.equal(HttpError.conflict('x').status, 409);
  });
});
