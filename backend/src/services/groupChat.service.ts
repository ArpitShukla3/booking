import groupsHelper = require('../helpers/postgres/groups.helper');
import groupChatHelper = require('../helpers/postgres/groupChat.helper');
import groupHotelsHelper = require('../helpers/postgres/groupHotels.helper');
import travellersHelper = require('../helpers/postgres/travellers.helper');
import transactionHelper = require('../helpers/postgres/transaction.helper');
import HttpError = require('../utils/HttpError');
import { parseInput } from '../validation/travellers.validation.ts';
import { messageSchema, pollSchema, settingsSchema, voteSchema } from '../validation/groupChat.validation.ts';
import type { Knex } from 'knex';
import type { GroupRow } from '../types/group.ts';
import type { Chat, ChatMessage, ChatPermissions, ChatRow, MessageRow, PollOptionRow } from '../types/groupChat.ts';
import type { Traveller } from '../types/traveller.ts';

/* ---------- pure rules (no I/O) ---------- */

/** Simple access: the owner can do everything; members follow the chat settings. Announcements are owner-only. */
function permissionsFor(ownerId: string, chat: Pick<ChatRow, 'messaging' | 'polls'>, travellerId: string): ChatPermissions {
  const isOwner = ownerId === travellerId;
  return {
    can_message: isOwner || chat.messaging === 'ALL_MEMBERS',
    can_poll: isOwner || chat.polls === 'ALL_MEMBERS',
    can_announce: isOwner,
    can_manage: isOwner,
  };
}

/** "M-1042" → 1042; anything else → 0 (from the start). */
function seqOf(messageId: unknown): number {
  const match = /^M-(\d+)$/i.exec(String(messageId ?? '').trim());
  return match ? Number(match[1]) : 0;
}

function toMessageDto(row: MessageRow, ownerId: string, options: PollOptionRow[], myOptionId: number | undefined): ChatMessage {
  const pollOptions = options.map((o) => ({ option_id: o.option_id, label: o.label, votes: Number(o.votes) }));
  return {
    message_id: row.message_id, chat_id: row.chat_id, type: row.type, content: row.content, created_at: row.created_at,
    sender: { traveller_id: row.sender_id, name: row.sender_name, is_owner: row.sender_id === ownerId },
    poll: row.type === 'POLL'
      ? { options: pollOptions, total_votes: pollOptions.reduce((sum, o) => sum + o.votes, 0), my_option_id: myOptionId ?? null }
      : null,
  };
}

const inTransaction = <T>(work: (trx: Knex.Transaction) => Promise<T>): Promise<T> =>
  transactionHelper.withTransaction(work) as unknown as Promise<T>;

/* ---------- access ---------- */

/** Group must exist, caller must be a member, and the group must have booked its hotel. */
async function openChat(travellerId: string, groupId: string): Promise<{ group: GroupRow; chat: ChatRow }> {
  const group: GroupRow | undefined = await groupsHelper.findById(String(groupId).trim().toUpperCase());
  if (!group) throw HttpError.notFound('Group not found');
  if (!group.member_ids.includes(travellerId)) throw HttpError.forbidden('Only members of this group can open the team chat');
  const booking = await groupHotelsHelper.findBooking(group.group_id);
  if (!booking) throw HttpError.conflict('The team chat opens once the group has booked its hotel');
  const chat: ChatRow = await groupChatHelper.ensureChat(group.group_id);
  return { group, chat };
}

async function withPolls(rows: MessageRow[], ownerId: string, travellerId: string): Promise<ChatMessage[]> {
  const pollIds = rows.filter((r) => r.type === 'POLL').map((r) => r.message_id);
  const options = (await groupChatHelper.listPollOptions(pollIds)) as unknown as PollOptionRow[];
  const mine: Record<string, number> = await groupChatHelper.listVotesBy(pollIds, travellerId);
  return rows.map((row) => toMessageDto(row, ownerId, options.filter((o) => o.message_id === row.message_id), mine[row.message_id]));
}

/* ---------- use cases ---------- */

async function getChat(travellerId: string, groupId: string): Promise<Chat> {
  const { group, chat } = await openChat(travellerId, groupId);
  const profiles: Traveller[] = await travellersHelper.findByIds(group.member_ids);
  const byId = new Map(profiles.map((p) => [p.traveller_id, p.name]));
  return {
    chat_id: chat.chat_id, group_id: group.group_id, group_name: group.name,
    settings: { messaging: chat.messaging, polls: chat.polls },
    my_permissions: permissionsFor(group.owner_id, chat, travellerId),
    members: group.member_ids.map((id) => ({ traveller_id: id, name: byId.get(id) ?? id, is_owner: id === group.owner_id })),
  };
}

/** `after` = the last message_id the client has; omit it for the latest page. */
async function listMessages(travellerId: string, groupId: string, after?: unknown): Promise<ChatMessage[]> {
  const { group, chat } = await openChat(travellerId, groupId);
  const afterSeq = seqOf(after);
  const rows: MessageRow[] = afterSeq
    ? await groupChatHelper.listMessages(chat.chat_id, afterSeq)
    : await groupChatHelper.listLatestMessages(chat.chat_id);
  return withPolls(rows, group.owner_id, travellerId);
}

async function getMessageDto(group: GroupRow, chat: ChatRow, messageId: string, travellerId: string): Promise<ChatMessage> {
  const row: MessageRow | undefined = await groupChatHelper.findMessage(chat.chat_id, messageId);
  if (!row) throw HttpError.notFound('Message not found');
  return (await withPolls([row], group.owner_id, travellerId))[0];
}

async function postMessage(travellerId: string, groupId: string, body: unknown): Promise<ChatMessage> {
  const input = parseInput(messageSchema, body);
  const { group, chat } = await openChat(travellerId, groupId);
  const can = permissionsFor(group.owner_id, chat, travellerId);
  if (input.type === 'ANNOUNCEMENT' && !can.can_announce) throw HttpError.forbidden('Only the organiser can post announcements');
  if (input.type === 'TEXT' && !can.can_message) throw HttpError.forbidden('Only the organiser can send messages in this chat right now');
  const messageId: string = await groupChatHelper.insertMessage({ chat_id: chat.chat_id, sender_id: travellerId, type: input.type, content: input.content });
  return getMessageDto(group, chat, messageId, travellerId);
}

async function createPoll(travellerId: string, groupId: string, body: unknown): Promise<ChatMessage> {
  const input = parseInput(pollSchema, body);
  const { group, chat } = await openChat(travellerId, groupId);
  if (!permissionsFor(group.owner_id, chat, travellerId).can_poll) throw HttpError.forbidden('Only the organiser can create polls in this chat right now');
  const messageId = await inTransaction(async (trx) => {
    const id: string = await groupChatHelper.insertMessage({ chat_id: chat.chat_id, sender_id: travellerId, type: 'POLL', content: input.question }, trx);
    await groupChatHelper.insertPollOptions(id, input.options, trx);
    return id;
  });
  return getMessageDto(group, chat, messageId, travellerId);
}

async function vote(travellerId: string, groupId: string, messageId: string, body: unknown): Promise<ChatMessage> {
  const input = parseInput(voteSchema, body);
  const { group, chat } = await openChat(travellerId, groupId);
  const id = String(messageId).trim().toUpperCase();
  const message: MessageRow | undefined = await groupChatHelper.findMessage(chat.chat_id, id);
  if (!message) throw HttpError.notFound('Message not found');
  if (message.type !== 'POLL') throw HttpError.badRequest('This message is not a poll');
  if (!(await groupChatHelper.findPollOption(id, input.option_id))) {
    throw HttpError.badRequest('Please check the highlighted fields', { option_id: 'That option is not part of this poll' });
  }
  await groupChatHelper.upsertVote(id, input.option_id, travellerId);
  return getMessageDto(group, chat, id, travellerId);
}

async function updateSettings(travellerId: string, groupId: string, body: unknown): Promise<Chat> {
  const input = parseInput(settingsSchema, body);
  const { group, chat } = await openChat(travellerId, groupId);
  if (group.owner_id !== travellerId) throw HttpError.forbidden('Only the organiser can change group settings');
  const patch: Partial<Pick<ChatRow, 'messaging' | 'polls'>> = {};
  if (input.messaging) patch.messaging = input.messaging;
  if (input.polls) patch.polls = input.polls;
  await groupChatHelper.updateSettings(chat.chat_id, patch);
  return getChat(travellerId, group.group_id);
}

// Exported as one object (not ES named exports) so unit tests can mock.method() it.
const groupChatService = { permissionsFor, seqOf, toMessageDto, getChat, listMessages, postMessage, createPoll, vote, updateSettings };
export = groupChatService;
