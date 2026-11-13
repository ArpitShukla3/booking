import groupsHelper = require('../helpers/postgres/groups.helper');
import joinRequestsHelper = require('../helpers/postgres/joinRequests.helper');
import travellersHelper = require('../helpers/postgres/travellers.helper');
import transactionHelper = require('../helpers/postgres/transaction.helper');
import HttpError = require('../utils/HttpError');
import groupsService = require('./groups.service.ts');
import type { Knex } from 'knex';
import type { GroupRow } from '../types/group.ts';
import type {
  DecidedJoinRequest, GroupColumns, IncomingJoinRequest, JoinRequest, JoinRequestRow, MyJoinRequest,
  OwnerJoinRequest, RequestBlocker, RequestGroup, SeekerColumns,
} from '../types/joinRequest.ts';
import type { Traveller } from '../types/traveller.ts';

/* ---------- pure rules (no I/O) ---------- */

/** Why `seekerId` cannot send a request to this group, or null if they can. */
function requestBlocker(
  group: Pick<GroupRow, 'owner_id' | 'member_ids' | 'max_size'>,
  seekerId: string,
  existing: Pick<JoinRequestRow, 'status'> | undefined,
): RequestBlocker | null {
  if (group.owner_id === seekerId) return 'OWNER';
  if (group.member_ids.includes(seekerId)) return 'MEMBER';
  if (existing) return existing.status;
  if (group.member_ids.length >= group.max_size) return 'FULL';
  return null;
}

const BLOCKER_MESSAGES: Record<RequestBlocker, string> = {
  OWNER: 'You organise this group, so you are already in it.',
  MEMBER: 'You are already a member of this group.',
  FULL: 'This group is full and cannot take new requests.',
  PENDING: 'You have already sent a request. The organiser will review it soon.',
  REJECTED: 'The organiser declined your request for this group.',
  APPROVED: 'Your request was approved. You are already in this group.',
};

/** Seeker interests that also appear in `others`, in the seeker's order. */
function sharedInterests(seeker: string[], others: string[]): string[] {
  const set = new Set(others);
  return seeker.filter((i) => set.has(i));
}

/** Typed wrapper: the JS helper's return type is not inferred through Knex. */
const inTransaction = <T>(work: (trx: Knex.Transaction) => Promise<T>): Promise<T> =>
  transactionHelper.withTransaction(work) as unknown as Promise<T>;

const normalizeId = (id: string) => String(id).trim().toUpperCase();

function toRequestDto(row: JoinRequestRow): JoinRequest {
  const { request_id, group_id, seeker_id, status, created_at, decided_at } = row;
  return { request_id, group_id, seeker_id, status, created_at, decided_at };
}

function toSeeker(row: JoinRequestRow & SeekerColumns): Traveller {
  const { seeker_id, name, age, gender, home_city, home_airport, interests, gender_preference } = row;
  return { traveller_id: seeker_id, name, age, gender, home_city, home_airport, interests, gender_preference };
}

function toRequestGroup(row: JoinRequestRow & GroupColumns): RequestGroup {
  return {
    group_id: row.group_id, name: row.group_name, city: row.group_city, country_name: row.group_country_name,
    check_in: row.group_check_in, check_out: row.group_check_out, max_size: row.group_max_size,
    members_count: row.group_member_ids.length,
    spots_left: Math.max(0, row.group_max_size - row.group_member_ids.length),
    owner: { traveller_id: row.group_owner_id, name: row.group_owner_name },
  };
}

/* ---------- use cases ---------- */

async function findGroupOr404(groupId: string): Promise<GroupRow> {
  const group: GroupRow | undefined = await groupsHelper.findById(normalizeId(groupId));
  if (!group) throw HttpError.notFound('Group not found');
  return group;
}

/** Seeker clicks "Interested". */
async function createRequest(seekerId: string, groupId: string): Promise<JoinRequest> {
  const group = await findGroupOr404(groupId);
  const existing: JoinRequestRow | undefined = await joinRequestsHelper.findByGroupAndSeeker(group.group_id, seekerId);
  const blocker = requestBlocker(group, seekerId, existing);
  if (blocker) throw HttpError.conflict(BLOCKER_MESSAGES[blocker]);
  const created: JoinRequestRow | undefined = await joinRequestsHelper.insert({ group_id: group.group_id, seeker_id: seekerId });
  if (!created) throw HttpError.conflict(BLOCKER_MESSAGES.PENDING); // a parallel click got there first
  return toRequestDto(created);
}

/** Owner's view of one group's requests, with interests shared with the current members. */
async function listForGroup(ownerId: string, groupId: string): Promise<OwnerJoinRequest[]> {
  const group = await findGroupOr404(groupId);
  if (group.owner_id !== ownerId) throw HttpError.forbidden('Only the group organiser can see join requests');
  const rows: (JoinRequestRow & SeekerColumns)[] = await joinRequestsHelper.listByGroup(group.group_id);
  const members: Traveller[] = await travellersHelper.findByIds(group.member_ids);
  const groupInterests = members.flatMap((m) => m.interests);
  return rows.map((row) => ({ ...toRequestDto(row), seeker: toSeeker(row), shared_interests: sharedInterests(row.interests, groupInterests) }));
}

/** Owner notifications: pending requests on every group they organise. */
async function listIncoming(ownerId: string): Promise<IncomingJoinRequest[]> {
  const rows: (JoinRequestRow & SeekerColumns & GroupColumns)[] = await joinRequestsHelper.listPendingForOwner(ownerId);
  const owner: Traveller | undefined = rows.length ? await travellersHelper.findById(ownerId) : undefined;
  return rows.map((row) => ({
    ...toRequestDto(row), seeker: toSeeker(row), group: toRequestGroup(row),
    shared_interests: sharedInterests(row.interests, owner?.interests ?? []),
  }));
}

/** Seeker's "My Requests". */
async function listMine(seekerId: string): Promise<MyJoinRequest[]> {
  const rows: (JoinRequestRow & GroupColumns)[] = await joinRequestsHelper.listBySeeker(seekerId);
  return rows.map((row) => ({ ...toRequestDto(row), group: toRequestGroup(row) }));
}

/** Loads a request and checks the caller owns its group (404 / 403). */
async function findOwnedRequest(ownerId: string, requestId: string): Promise<JoinRequestRow> {
  const request: JoinRequestRow | undefined = await joinRequestsHelper.findById(normalizeId(requestId));
  if (!request) throw HttpError.notFound('Join request not found');
  const group: GroupRow | undefined = await groupsHelper.findById(request.group_id);
  if (!group || group.owner_id !== ownerId) throw HttpError.forbidden('Only the group organiser can decide on this request');
  return request;
}

function assertPending(request: JoinRequestRow | undefined): asserts request is JoinRequestRow {
  if (!request) throw HttpError.notFound('Join request not found');
  if (request.status !== 'PENDING') throw HttpError.conflict(`This request was already ${request.status.toLowerCase()}.`);
}

const FULL_MESSAGE = 'The group is already full, so this request cannot be approved.';

/** Approve: re-check the size and add the member in the same transaction. */
async function approve(ownerId: string, requestId: string): Promise<DecidedJoinRequest> {
  const request = await findOwnedRequest(ownerId, requestId);
  return inTransaction(async (trx) => {
    // Lock the group first: concurrent approvals for the same group queue up here.
    const group: GroupRow = await groupsHelper.lockById(request.group_id, trx);
    const locked: JoinRequestRow | undefined = await joinRequestsHelper.findByIdForUpdate(request.request_id, trx);
    assertPending(locked);
    if (group.member_ids.length >= group.max_size) throw HttpError.conflict(FULL_MESSAGE);
    const memberIds: string[] | undefined = await groupsHelper.addMember(group.group_id, locked.seeker_id, trx);
    if (!memberIds) throw HttpError.conflict(FULL_MESSAGE);
    const updated: JoinRequestRow = await joinRequestsHelper.updateStatus(locked.request_id, 'APPROVED', trx);
    return { ...toRequestDto(updated), group: groupsService.toGroupDto({ ...group, member_ids: memberIds }) };
  });
}

async function reject(ownerId: string, requestId: string): Promise<DecidedJoinRequest> {
  const request = await findOwnedRequest(ownerId, requestId);
  return inTransaction(async (trx) => {
    const locked: JoinRequestRow | undefined = await joinRequestsHelper.findByIdForUpdate(request.request_id, trx);
    assertPending(locked);
    return toRequestDto(await joinRequestsHelper.updateStatus(locked.request_id, 'REJECTED', trx));
  });
}

// Exported as one object (not ES named exports) so unit tests can mock.method() it.
const joinRequestsService = { requestBlocker, sharedInterests, createRequest, listForGroup, listIncoming, listMine, approve, reject };
export = joinRequestsService;
