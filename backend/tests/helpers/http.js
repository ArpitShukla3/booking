// HTTP utilities for INTEGRATION tests: calls the real Express app in memory (no port).
const request = require('supertest');
const app = require('../../src/app');

/** api().get('/api/health') — plain request. */
const api = () => request(app);

/**
 * asTraveller('T-001').post('/api/groups').send({...})
 * Sends the X-Traveller-Id header used for identity (see tasks/PLAN.md §2.1).
 */
function asTraveller(travellerId) {
  const agent = request(app);
  const withHeader = (method) => (url) => agent[method](url).set('X-Traveller-Id', travellerId);
  return { get: withHeader('get'), post: withHeader('post'), put: withHeader('put'), patch: withHeader('patch'), delete: withHeader('delete') };
}

module.exports = { api, asTraveller };
