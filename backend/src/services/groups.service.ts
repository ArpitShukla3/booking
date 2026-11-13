import groupsHelper = require('../helpers/postgres/groups.helper');
import joinRequestsHelper = require('../helpers/postgres/joinRequests.helper');
import lookupsHelper = require('../helpers/postgres/lookups.helper');
import groupHotelsHelper = require('../helpers/postgres/groupHotels.helper');
import travellersHelper = require('../helpers/postgres/travellers.helper');
import transactionHelper = require('../helpers/postgres/transaction.helper');
import HttpError = require('../utils/HttpError');
import { parseInput } from '../validation/travellers.validation.ts';
import { createGroupSchema } from '../validation/groups.validation.ts';
import type { Knex } from 'knex';
import type { BookingSummary, Group, GroupDetails, GroupRow, GroupStage, HotelStatus, MyGroup } from '../types/group.ts';
import type { Traveller } from '../types/traveller.ts';

/* ---------- pure rules (no I/O) ---------- */

/** Nights between two YYYY-MM-DD strings. */
function nightsBetween(checkIn: string, checkOut: string): number {
  const toDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };
  return toDay(checkOut) - toDay(checkIn);
}

const NO_HOTEL: HotelStatus = { shortlisted: 0, booked: false };

/** Trip progress, most advanced first: booked > hotel shortlisted > lobby full > lobby open (TASK-X2). */
function stageOf(group: Pick<GroupRow, 'member_ids' | 'max_size'>, hotel: HotelStatus = NO_HOTEL): GroupStage {
  if (hotel.booked) return 'BOOKED';
  if (hotel.shortlisted > 0) return 'HOTEL_SHORTLISTED';
  return group.member_ids.length >= group.max_size ? 'LOBBY_FULL' : 'LOBBY_OPEN';
}

type HotelActivity = { shortlisted: number; booking: BookingSummary | null };
const toHotelStatus = (a: HotelActivity | undefined): HotelStatus =>
  ({ shortlisted: a?.shortlisted ?? 0, booked: Boolean(a?.booking) });

function toGroupDto(row: GroupRow, hotel: HotelStatus = NO_HOTEL): Group {
  return {
    group_id: row.group_id,
    name: row.name,
    city: row.city,
    country_name: row.country_name,
    check_in: row.check_in,
    check_out: row.check_out,
    nights: nightsBetween(row.check_in, row.check_out),
    max_size: row.max_size,
    members_count: row.member_ids.length,
    spots_left: Math.max(0, row.max_size - row.member_ids.length),
    budget_inr: row.budget_inr,
    itinerary: row.itinerary ?? null,
    owner: { traveller_id: row.owner_id, name: row.owner_name, gender: row.owner_gender },
    member_ids: row.member_ids,
    stage: stageOf(row, hotel),
    hotel_status: { ...hotel },
  };
}

/* ---------- use cases ---------- */

async function createGroup(ownerId: string, body: unknown): Promise<Group> {
  const input = parseInput(createGroupSchema, body);
  const destination = await lookupsHelper.findDestination(input.city);
  if (!destination) {
    throw HttpError.badRequest('Please check the highlighted fields', {
      city: `We don't have trips to "${input.city}". Choose one of the destinations in the list.`,
    });
  }
  const groupId: string = await groupsHelper.insert({
    ...input,
    city: destination.city,
    owner_id: ownerId,
    member_ids: [ownerId],
  });
  return getGroupDto(groupId);
}

async function getGroupDto(groupId: string): Promise<Group> {
  const row: GroupRow | undefined = await groupsHelper.findById(groupId);
  if (!row) throw HttpError.notFound('Group not found');
  return toGroupDto(row);
}

async function getGroup(groupId: string): Promise<GroupDetails> {
  const row: GroupRow | undefined = await groupsHelper.findById(String(groupId).trim().toUpperCase());
  if (!row) throw HttpError.notFound('Group not found');
  const profiles: Traveller[] = await travellersHelper.findByIds(row.member_ids);
  const byId = new Map(profiles.map((p) => [p.traveller_id, p]));
  // Keep the order of member_ids (owner first), skip ids without a profile.
  const members = row.member_ids.map((id) => byId.get(id)).filter((p): p is Traveller => Boolean(p));
  // Public page: status only, never the booking ID or prices.
  const activity: Record<string, HotelActivity> = await groupHotelsHelper.hotelStatusByGroups([row.group_id]);
  return { ...toGroupDto(row, toHotelStatus(activity[row.group_id])), members };
}

async function listMyGroups(travellerId: string): Promise<MyGroup[]> {
  const rows: GroupRow[] = await groupsHelper.listForTraveller(travellerId);
  const owned = rows.filter((row) => row.owner_id === travellerId).map((row) => row.group_id);
  const [pending, activity]: [Record<string, number>, Record<string, HotelActivity>] = await Promise.all([
    joinRequestsHelper.countPendingByGroups(owned),
    groupHotelsHelper.hotelStatusByGroups(rows.map((row) => row.group_id)),
  ]);
  return rows.map((row) => ({
    ...toGroupDto(row, toHotelStatus(activity[row.group_id])),
    booking: activity[row.group_id]?.booking ?? null,
    my_role: row.owner_id === travellerId ? 'OWNER' : 'MEMBER',
    pending_requests: row.owner_id === travellerId ? pending[row.group_id] ?? 0 : 0,
  }));
}

/**
 * Owner removes a member (never themselves). In one transaction: take them out of member_ids
 * and mark their join request REMOVED, so they can't ask to join again.
 */
async function removeMember(ownerId: string, groupId: string, memberId: string): Promise<Group> {
  const group = await getGroupRowOr404(groupId);
  const travellerId = String(memberId).trim().toUpperCase();
  if (group.owner_id !== ownerId) throw HttpError.forbidden('Only the group organiser can remove members');
  if (travellerId === group.owner_id) throw HttpError.badRequest('The organiser can’t be removed from their own group');
  return transactionHelper.withTransaction(async (trx: Knex.Transaction) => {
    const memberIds: string[] | undefined = await groupsHelper.removeMember(group.group_id, travellerId, trx);
    if (!memberIds) throw HttpError.notFound('This traveller is not a member of the group');
    await joinRequestsHelper.markRemoved(group.group_id, travellerId, trx);
    return toGroupDto({ ...group, member_ids: memberIds });
  }) as unknown as Promise<Group>;
}

async function getGroupRowOr404(groupId: string): Promise<GroupRow> {
  const row: GroupRow | undefined = await groupsHelper.findById(String(groupId).trim().toUpperCase());
  if (!row) throw HttpError.notFound('Group not found');
  return row;
}

// Exported as one object (not ES named exports) so unit tests can mock.method() it.
const groupsService = { nightsBetween, stageOf, toGroupDto, createGroup, getGroup, listMyGroups, removeMember };
export = groupsService;
