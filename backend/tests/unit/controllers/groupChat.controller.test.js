const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../../../src/services/groupChat.service.ts');
const controller = require('../../../src/controllers/groupChat.controller.ts');
const { mockRes } = require('../../helpers/mockRes');

const req = (extra = {}) => ({ traveller: { traveller_id: 'T-002' }, params: { groupId: 'G-01' }, query: {}, body: {}, ...extra });

describe('groupChat.controller', () => {
  afterEach(() => mock.restoreAll());

  it('postMessage / createPoll → 201 with the traveller, group and body', async () => {
    const post = mock.method(service, 'postMessage', async () => ({ message_id: 'M-1001' }));
    const poll = mock.method(service, 'createPoll', async () => ({ message_id: 'M-1002' }));
    const a = mockRes();
    await controller.postMessage(req({ body: { content: 'Hi' } }), a);
    assert.equal(a.statusCode, 201);
    assert.deepEqual(post.mock.calls[0].arguments, ['T-002', 'G-01', { content: 'Hi' }]);
    const b = mockRes();
    await controller.createPoll(req({ body: { question: 'Q' } }), b);
    assert.equal(b.statusCode, 201);
    assert.equal(poll.mock.callCount(), 1);
  });

  it('listMessages passes ?after; vote passes the message id; settings → 200', async () => {
    const list = mock.method(service, 'listMessages', async () => []);
    const vote = mock.method(service, 'vote', async () => ({}));
    mock.method(service, 'updateSettings', async () => ({ chat_id: 'C-1001' }));
    await controller.listMessages(req({ query: { after: 'M-1005' } }), mockRes());
    assert.deepEqual(list.mock.calls[0].arguments, ['T-002', 'G-01', 'M-1005']);
    await controller.vote(req({ params: { groupId: 'G-01', messageId: 'M-1006' }, body: { option_id: 3 } }), mockRes());
    assert.deepEqual(vote.mock.calls[0].arguments, ['T-002', 'G-01', 'M-1006', { option_id: 3 }]);
    const res = mockRes();
    await controller.updateSettings(req({ body: { polls: 'OWNER_ONLY' } }), res);
    assert.equal(res.statusCode, 200);
  });
});
