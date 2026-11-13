const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const groupsHelper = require('../../../src/helpers/postgres/groups.helper');
const groupChatHelper = require('../../../src/helpers/postgres/groupChat.helper');
const groupHotelsHelper = require('../../../src/helpers/postgres/groupHotels.helper');
const transactionHelper = require('../../../src/helpers/postgres/transaction.helper');
const HttpError = require('../../../src/utils/HttpError');
const service = require('../../../src/services/groupChat.service.ts');

const group = (over = {}) => ({ group_id: 'G-01', name: 'Kyoto', owner_id: 'T-001', member_ids: ['T-001', 'T-002'], max_size: 3, ...over });
const chatRow = (over = {}) => ({ chat_id: 'C-1001', group_id: 'G-01', messaging: 'ALL_MEMBERS', polls: 'ALL_MEMBERS', ...over });
const msg = (over = {}) => ({ seq: 1001, message_id: 'M-1001', chat_id: 'C-1001', sender_id: 'T-002', sender_name: 'Priya Shah', type: 'TEXT', content: 'Hi', created_at: 'now', ...over });
const is = (status) => (err) => err instanceof HttpError && err.status === status;

/** Group G-01 exists, is booked, and has chat C-1001 with the given settings. */
function openChat({ g = group(), chat = chatRow(), booked = true } = {}) {
  mock.method(groupsHelper, 'findById', async () => g);
  mock.method(groupHotelsHelper, 'findBooking', async () => (booked ? { booking_id: 'BK-1001' } : undefined));
  mock.method(groupChatHelper, 'ensureChat', async () => chat);
  mock.method(groupChatHelper, 'listPollOptions', async () => []);
  mock.method(groupChatHelper, 'listVotesBy', async () => ({}));
}

describe('groupChat.service pure rules', () => {
  it('owner can do everything', () => {
    assert.deepEqual(service.permissionsFor('T-001', chatRow({ messaging: 'OWNER_ONLY', polls: 'OWNER_ONLY' }), 'T-001'),
      { can_message: true, can_poll: true, can_announce: true, can_manage: true });
  });
  it('members follow the settings and never announce or manage', () => {
    assert.deepEqual(service.permissionsFor('T-001', chatRow(), 'T-002'), { can_message: true, can_poll: true, can_announce: false, can_manage: false });
    assert.deepEqual(service.permissionsFor('T-001', chatRow({ messaging: 'OWNER_ONLY' }), 'T-002'), { can_message: false, can_poll: true, can_announce: false, can_manage: false });
    assert.deepEqual(service.permissionsFor('T-001', chatRow({ polls: 'OWNER_ONLY' }), 'T-002'), { can_message: true, can_poll: false, can_announce: false, can_manage: false });
  });
  it('seqOf parses message ids and treats anything else as "from the start"', () => {
    assert.equal(service.seqOf('M-1042'), 1042);
    assert.equal(service.seqOf('m-7'), 7);
    assert.equal(service.seqOf(undefined), 0);
    assert.equal(service.seqOf('1042'), 0);
    assert.equal(service.seqOf("M-1; drop table"), 0);
  });
  it('toMessageDto adds poll totals and my vote; non-polls have poll null', () => {
    const options = [{ option_id: 1, message_id: 'M-1', label: 'A', position: 0, votes: '2' }, { option_id: 2, message_id: 'M-1', label: 'B', position: 1, votes: '1' }];
    const dto = service.toMessageDto(msg({ message_id: 'M-1', type: 'POLL' }), 'T-001', options, 2);
    assert.deepEqual(dto.poll, { options: [{ option_id: 1, label: 'A', votes: 2 }, { option_id: 2, label: 'B', votes: 1 }], total_votes: 3, my_option_id: 2 });
    assert.equal(dto.sender.is_owner, false);
    assert.equal(service.toMessageDto(msg(), 'T-001', [], undefined).poll, null);
  });
});

describe('groupChat.service access', () => {
  afterEach(() => mock.restoreAll());

  it('404 unknown group, 403 non-member, 409 before booking (no chat created)', async () => {
    mock.method(groupsHelper, 'findById', async () => undefined);
    await assert.rejects(service.getChat('T-001', 'G-404'), is(404));
    mock.restoreAll();
    openChat();
    await assert.rejects(service.getChat('T-009', 'G-01'), is(403));
    mock.restoreAll();
    openChat({ booked: false });
    await assert.rejects(service.getChat('T-001', 'G-01'), is(409));
    assert.equal(groupChatHelper.ensureChat.mock.callCount(), 0);
  });
});

describe('groupChat.service.postMessage', () => {
  afterEach(() => mock.restoreAll());

  it('member sends a trimmed TEXT message', async () => {
    openChat();
    const insert = mock.method(groupChatHelper, 'insertMessage', async () => 'M-1001');
    mock.method(groupChatHelper, 'findMessage', async () => msg());
    const sent = await service.postMessage('T-002', 'G-01', { content: '  Hi  ' });
    assert.deepEqual(insert.mock.calls[0].arguments[0], { chat_id: 'C-1001', sender_id: 'T-002', type: 'TEXT', content: 'Hi' });
    assert.equal(sent.message_id, 'M-1001');
  });

  it('403 for a member when messaging is OWNER_ONLY, and for member announcements', async () => {
    openChat({ chat: chatRow({ messaging: 'OWNER_ONLY' }) });
    const insert = mock.method(groupChatHelper, 'insertMessage', async () => 'M-1');
    await assert.rejects(service.postMessage('T-002', 'G-01', { content: 'x' }), is(403));
    await assert.rejects(service.postMessage('T-002', 'G-01', { type: 'ANNOUNCEMENT', content: 'x' }), is(403));
    assert.equal(insert.mock.callCount(), 0);
  });

  it('400 for empty, too long or unknown fields', async () => {
    openChat();
    await assert.rejects(service.postMessage('T-001', 'G-01', { content: '   ' }), is(400));
    await assert.rejects(service.postMessage('T-001', 'G-01', { content: 'x'.repeat(2001) }), is(400));
    await assert.rejects(service.postMessage('T-001', 'G-01', { content: 'x', sender_id: 'T-002' }), is(400));
  });
});

describe('groupChat.service.createPoll / vote / settings', () => {
  afterEach(() => mock.restoreAll());

  it('creates the poll message and options in one transaction', async () => {
    openChat();
    mock.method(transactionHelper, 'withTransaction', async (work) => work('TRX'));
    const insert = mock.method(groupChatHelper, 'insertMessage', async () => 'M-1002');
    const options = mock.method(groupChatHelper, 'insertPollOptions', async () => {});
    mock.method(groupChatHelper, 'findMessage', async () => msg({ message_id: 'M-1002', type: 'POLL', content: 'Day trip?' }));
    await service.createPoll('T-002', 'G-01', { question: 'Day trip?', options: [' Nara ', 'Osaka'] });
    assert.equal(insert.mock.calls[0].arguments[1], 'TRX');
    assert.deepEqual(options.mock.calls[0].arguments, ['M-1002', ['Nara', 'Osaka'], 'TRX']);
  });

  it('poll validation: 2–6 distinct options', async () => {
    openChat();
    await assert.rejects(service.createPoll('T-001', 'G-01', { question: 'Q', options: ['A'] }), is(400));
    await assert.rejects(service.createPoll('T-001', 'G-01', { question: 'Q', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }), is(400));
    await assert.rejects(service.createPoll('T-001', 'G-01', { question: 'Q', options: ['Nara', 'nara'] }), is(400));
  });

  it('403 poll for a member when polls are OWNER_ONLY', async () => {
    openChat({ chat: chatRow({ polls: 'OWNER_ONLY' }) });
    await assert.rejects(service.createPoll('T-002', 'G-01', { question: 'Q', options: ['A', 'B'] }), is(403));
  });

  it('vote: upserts; 400 for a non-poll or a foreign option, 404 unknown message', async () => {
    openChat();
    const upsert = mock.method(groupChatHelper, 'upsertVote', async () => {});
    mock.method(groupChatHelper, 'findMessage', async (_c, id) => (id === 'M-1' ? msg({ message_id: 'M-1', type: 'POLL' }) : id === 'M-2' ? msg({ message_id: 'M-2' }) : undefined));
    mock.method(groupChatHelper, 'findPollOption', async (_m, optionId) => (optionId === 5 ? { option_id: 5 } : undefined));
    await service.vote('T-002', 'G-01', 'm-1', { option_id: 5 });
    assert.deepEqual(upsert.mock.calls[0].arguments, ['M-1', 5, 'T-002']);
    await assert.rejects(service.vote('T-002', 'G-01', 'M-1', { option_id: 6 }), is(400));
    await assert.rejects(service.vote('T-002', 'G-01', 'M-2', { option_id: 5 }), is(400));
    await assert.rejects(service.vote('T-002', 'G-01', 'M-9', { option_id: 5 }), is(404));
  });

  it('settings: owner only, at least one valid field', async () => {
    openChat();
    const update = mock.method(groupChatHelper, 'updateSettings', async () => chatRow({ messaging: 'OWNER_ONLY' }));
    await assert.rejects(service.updateSettings('T-002', 'G-01', { messaging: 'OWNER_ONLY' }), is(403));
    await assert.rejects(service.updateSettings('T-001', 'G-01', {}), is(400));
    await assert.rejects(service.updateSettings('T-001', 'G-01', { messaging: 'EVERYONE' }), is(400));
    assert.equal(update.mock.callCount(), 0);
  });
});
