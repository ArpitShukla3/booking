const { describe, it, after, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { api, asTraveller } = require('../helpers/http');
const { db, truncate, closeDb } = require('../helpers/db');

// G-01 (Sarah T-001 owns it) with Priya T-002 as a member and a booking, so the chat is open.
let originalG01;
const setMembers = (ids) => db('groups').where({ group_id: 'G-01' }).update({ member_ids: ids });
async function book() {
  const room = await db({ r: 'rooms' }).join({ h: 'hotels' }, 'h.hotel_id', 'r.hotel_id').where('h.city', 'Kyoto').select('r.room_id').first();
  await db('group_bookings').insert({ group_id: 'G-01', room_id: room.room_id, rooms_count: 1, nights: 5, total_inr: 10000, per_member_inr: 5000, members_count: 2, booked_by: 'T-001' });
}
const reset = async () => {
  await truncate('group_chats', 'saved_hotel_options', 'group_bookings'); // chat messages/polls cascade
  await setMembers(['T-001', 'T-002']);
};
const chat = (id = 'T-001') => asTraveller(id);
const URL = '/api/groups/G-01/chat';

describe('Team chat API (S1)', () => {
  before(async () => { originalG01 = (await db('groups').where({ group_id: 'G-01' }).first()).member_ids; });
  beforeEach(reset);
  after(async () => { await truncate('group_chats', 'saved_hotel_options', 'group_bookings'); await setMembers(originalG01); await closeDb(); });

  it('409 before the hotel is booked; opens with one chat_id per group after booking', async () => {
    const closed = await chat().get(URL);
    assert.equal(closed.status, 409);
    assert.match(closed.body.error.message, /booked its hotel/);

    await book();
    const a = await chat('T-001').get(URL);
    const b = await chat('T-002').get(URL);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.match(a.body.chat_id, /^C-\d{4,}$/);
    assert.equal(b.body.chat_id, a.body.chat_id, 'same chat for every member');
    assert.deepEqual(a.body.settings, { messaging: 'ALL_MEMBERS', polls: 'ALL_MEMBERS' });
    assert.deepEqual(a.body.my_permissions, { can_message: true, can_poll: true, can_announce: true, can_manage: true });
    assert.deepEqual(b.body.my_permissions, { can_message: true, can_poll: true, can_announce: false, can_manage: false });
    assert.equal(a.body.members.length, 2);
    assert.equal(Number((await db('group_chats').where({ group_id: 'G-01' }).count('* as n').first()).n), 1);
  });

  it('members exchange messages with id, content and timestamp; "after" returns only newer ones', async () => {
    await book();
    const first = await chat('T-001').post(`${URL}/messages`).send({ content: '  Welcome everyone!  ' });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.match(first.body.message_id, /^M-\d{4,}$/);
    assert.equal(first.body.content, 'Welcome everyone!');
    assert.equal(first.body.type, 'TEXT');
    assert.ok(!Number.isNaN(Date.parse(first.body.created_at)));
    assert.deepEqual(first.body.sender, { traveller_id: 'T-001', name: 'Sarah Thomas', is_owner: true });

    const second = await chat('T-002').post(`${URL}/messages`).send({ content: 'Hi Sarah' });
    const all = await chat('T-002').get(`${URL}/messages`);
    assert.deepEqual(all.body.map((m) => m.message_id), [first.body.message_id, second.body.message_id]);
    const newer = await chat('T-001').get(`${URL}/messages`).query({ after: first.body.message_id });
    assert.deepEqual(newer.body.map((m) => m.content), ['Hi Sarah']);
  });

  it('announcements are organiser-only', async () => {
    await book();
    const ok = await chat('T-001').post(`${URL}/messages`).send({ type: 'ANNOUNCEMENT', content: 'Meet at Kyoto station 9am' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.type, 'ANNOUNCEMENT');
    assert.equal((await chat('T-002').post(`${URL}/messages`).send({ type: 'ANNOUNCEMENT', content: 'x' })).status, 403);
  });

  it('polls: create, vote, change vote, counts and my_option_id persist', async () => {
    await book();
    const poll = await chat('T-002').post(`${URL}/polls`).send({ question: 'Day trip?', options: ['Nara', 'Osaka', 'Uji'] });
    assert.equal(poll.status, 201, JSON.stringify(poll.body));
    assert.equal(poll.body.type, 'POLL');
    assert.equal(poll.body.content, 'Day trip?');
    const [nara, osaka] = poll.body.poll.options;
    assert.equal(poll.body.poll.total_votes, 0);

    await chat('T-001').post(`${URL}/polls/${poll.body.message_id}/vote`).send({ option_id: nara.option_id });
    const v = await chat('T-002').post(`${URL}/polls/${poll.body.message_id}/vote`).send({ option_id: nara.option_id });
    assert.equal(v.status, 200);
    assert.equal(v.body.poll.total_votes, 2);
    const moved = await chat('T-002').post(`${URL}/polls/${poll.body.message_id}/vote`).send({ option_id: osaka.option_id });
    assert.equal(moved.body.poll.total_votes, 2, 'changing a vote does not add one');
    assert.equal(moved.body.poll.my_option_id, osaka.option_id);

    const sarahView = (await chat('T-001').get(`${URL}/messages`)).body[0].poll;
    assert.equal(sarahView.my_option_id, nara.option_id);
    assert.deepEqual(sarahView.options.map((o) => o.votes), [1, 1, 0]);
  });

  it('poll and vote validation', async () => {
    await book();
    const bad = await chat('T-001').post(`${URL}/polls`).send({ question: 'Q', options: ['Only one'] });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.error.fields.options);
    assert.equal((await chat('T-001').post(`${URL}/polls`).send({ question: 'Q', options: ['A', 'a'] })).status, 400);
    assert.equal((await chat('T-001').post(`${URL}/messages`).send({ content: '   ' })).status, 400);
    const text = await chat('T-001').post(`${URL}/messages`).send({ content: 'not a poll' });
    assert.equal((await chat('T-001').post(`${URL}/polls/${text.body.message_id}/vote`).send({ option_id: 1 })).status, 400);
    const poll = await chat('T-001').post(`${URL}/polls`).send({ question: 'Q', options: ['A', 'B'] });
    assert.equal((await chat('T-001').post(`${URL}/polls/${poll.body.message_id}/vote`).send({ option_id: 999999 })).status, 400);
    assert.equal((await chat('T-001').post(`${URL}/polls/M-999999/vote`).send({ option_id: 1 })).status, 404);
  });

  it('group settings: owner limits messaging/polls; members are blocked but can still vote', async () => {
    await book();
    const poll = await chat('T-001').post(`${URL}/polls`).send({ question: 'Dinner?', options: ['Ramen', 'Sushi'] });
    assert.equal((await chat('T-002').patch(`${URL}/settings`).send({ messaging: 'OWNER_ONLY' })).status, 403);
    const saved = await chat('T-001').patch(`${URL}/settings`).send({ messaging: 'OWNER_ONLY', polls: 'OWNER_ONLY' });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.settings, { messaging: 'OWNER_ONLY', polls: 'OWNER_ONLY' });

    assert.equal((await chat('T-002').post(`${URL}/messages`).send({ content: 'hello?' })).status, 403);
    assert.equal((await chat('T-002').post(`${URL}/polls`).send({ question: 'Q', options: ['A', 'B'] })).status, 403);
    assert.equal((await chat('T-001').post(`${URL}/messages`).send({ content: 'Only me for now' })).status, 201);
    const vote = await chat('T-002').post(`${URL}/polls/${poll.body.message_id}/vote`).send({ option_id: poll.body.poll.options[0].option_id });
    assert.equal(vote.status, 200);
    assert.deepEqual((await chat('T-002').get(URL)).body.my_permissions, { can_message: false, can_poll: false, can_announce: false, can_manage: false });
    assert.equal((await chat('T-001').patch(`${URL}/settings`).send({})).status, 400);
    assert.equal((await chat('T-001').patch(`${URL}/settings`).send({ messaging: 'EVERYONE' })).status, 400);
  });

  it('non-members 403 (including a removed member), unknown group 404, 401 without id', async () => {
    await book();
    assert.equal((await chat('T-003').get(URL)).status, 403);
    await setMembers(['T-001']); // Priya removed
    assert.equal((await chat('T-002').get(`${URL}/messages`)).status, 403);
    assert.equal((await chat('T-001').get('/api/groups/G-424242/chat')).status, 404);
    assert.equal((await api().get(URL)).status, 401);
  });
});
