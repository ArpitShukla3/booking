// SQL for the team chat (S1): group_chats, chat_messages, chat_poll_options, chat_poll_votes.
const db = require('./client');

const CHAT_COLUMNS = ['chat_id', 'group_id', 'messaging', 'polls', 'created_at', 'updated_at'];

function findChatByGroup(groupId, trx = db) {
  return trx('group_chats').select(CHAT_COLUMNS).where({ group_id: groupId }).first();
}

/** Creates the group's chat if it doesn't exist yet (safe under concurrent first opens). Returns the chat. */
async function ensureChat(groupId, trx = db) {
  await trx('group_chats').insert({ group_id: groupId }).onConflict('group_id').ignore();
  return findChatByGroup(groupId, trx);
}

async function updateSettings(chatId, patch, trx = db) {
  const [row] = await trx('group_chats').where({ chat_id: chatId })
    .update({ ...patch, updated_at: trx.fn.now() }).returning(CHAT_COLUMNS);
  return row;
}

const MESSAGE_COLUMNS = ['m.seq', 'm.message_id', 'm.chat_id', 'm.sender_id', 'm.type', 'm.content', 'm.created_at', 't.name as sender_name'];

/** Messages after `afterSeq` (0 = from the start), oldest first, at most `limit`. */
function listMessages(chatId, afterSeq = 0, limit = 200, trx = db) {
  return trx({ m: 'chat_messages' })
    .join({ t: 'travellers' }, 't.traveller_id', 'm.sender_id')
    .select(MESSAGE_COLUMNS)
    .where('m.chat_id', chatId)
    .andWhere('m.seq', '>', afterSeq)
    .orderBy('m.seq')
    .limit(limit);
}

/** The newest `limit` messages, returned oldest first (first page of a chat). */
async function listLatestMessages(chatId, limit = 200, trx = db) {
  const rows = await trx({ m: 'chat_messages' })
    .join({ t: 'travellers' }, 't.traveller_id', 'm.sender_id')
    .select(MESSAGE_COLUMNS)
    .where('m.chat_id', chatId)
    .orderBy('m.seq', 'desc')
    .limit(limit);
  return rows.reverse();
}

function findMessage(chatId, messageId, trx = db) {
  return trx({ m: 'chat_messages' })
    .join({ t: 'travellers' }, 't.traveller_id', 'm.sender_id')
    .select(MESSAGE_COLUMNS)
    .where({ 'm.chat_id': chatId, 'm.message_id': messageId })
    .first();
}

/** Inserts a message and returns its message_id. */
async function insertMessage(row, trx = db) {
  const [created] = await trx('chat_messages').insert(row).returning('message_id');
  return created.message_id;
}

async function insertPollOptions(messageId, labels, trx = db) {
  await trx('chat_poll_options').insert(labels.map((label, position) => ({ message_id: messageId, label, position })));
}

/** Options (with vote counts) for the given poll messages, in display order. */
function listPollOptions(messageIds, trx = db) {
  if (!messageIds.length) return Promise.resolve([]);
  return trx({ o: 'chat_poll_options' })
    .leftJoin({ v: 'chat_poll_votes' }, 'v.option_id', 'o.option_id')
    .select('o.option_id', 'o.message_id', 'o.label', 'o.position')
    .count('v.voter_id as votes')
    .whereIn('o.message_id', messageIds)
    .groupBy('o.option_id')
    .orderBy([{ column: 'o.message_id' }, { column: 'o.position' }]);
}

/** { message_id: option_id } for the voter's own votes. */
async function listVotesBy(messageIds, voterId, trx = db) {
  if (!messageIds.length) return {};
  const rows = await trx('chat_poll_votes').select('message_id', 'option_id').whereIn('message_id', messageIds).andWhere({ voter_id: voterId });
  return Object.fromEntries(rows.map((r) => [r.message_id, r.option_id]));
}

function findPollOption(messageId, optionId, trx = db) {
  return trx('chat_poll_options').select('option_id').where({ message_id: messageId, option_id: optionId }).first();
}

/** One vote per person per poll; voting again moves it. */
async function upsertVote(messageId, optionId, voterId, trx = db) {
  await trx('chat_poll_votes')
    .insert({ message_id: messageId, option_id: optionId, voter_id: voterId })
    .onConflict(['message_id', 'voter_id'])
    .merge({ option_id: optionId, voted_at: trx.fn.now() });
}

module.exports = {
  findChatByGroup, ensureChat, updateSettings, listMessages, listLatestMessages, findMessage,
  insertMessage, insertPollOptions, listPollOptions, listVotesBy, findPollOption, upsertVote,
};
