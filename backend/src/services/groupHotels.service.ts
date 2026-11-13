// M6 Common Group Page: hotel search for the group's city/dates, shortlist, one booking.
import groupsHelper = require('../helpers/postgres/groups.helper');
import groupHotelsHelper = require('../helpers/postgres/groupHotels.helper');
import transactionHelper = require('../helpers/postgres/transaction.helper');
import HttpError = require('../utils/HttpError');
import groupsService = require('./groups.service.ts');
import hotelPricing = require('./hotelPricing.service.ts');
import type { Knex } from 'knex';
import type { GroupRow } from '../types/group.ts';
import type {
  Booking, BookingRow, HotelOption, HotelResult, HotelSearch, HotelSummary, RoomStayRow, RoomSummary, SavedOption, SavedRow,
} from '../types/groupHotels.ts';

const inTransaction = <T>(work: (trx: Knex.Transaction) => Promise<T>): Promise<T> =>
  transactionHelper.withTransaction(work) as unknown as Promise<T>;

const normalizeId = (id: unknown) => String(id ?? '').trim().toUpperCase();

/* ---------- mapping (pure) ---------- */

function toHotel(row: RoomStayRow): HotelSummary {
  return {
    hotel_id: row.hotel_id, name: row.hotel_name, area: row.area, city: row.city, stars: row.stars, rating: row.rating,
    lat: row.lat, lng: row.lng, image: row.image, check_in_from: row.check_in_from,
    check_out_until: row.check_out_until, family_friendly: row.family_friendly,
  };
}

function toRoom(row: RoomStayRow): RoomSummary {
  return {
    room_id: row.room_id, room_type: row.room_type, name: row.room_name, max_adults: row.max_adults,
    max_children: row.max_children, price_per_night_inr: row.price_per_night_amount, refundable: row.refundable,
  };
}

/** Prices one room for the group and checks every night of the stay. */
function toOption(row: RoomStayRow, members: number, nights: number): HotelOption {
  const price = hotelPricing.priceStay(row, members, nights);
  return {
    ...toRoom(row), ...price, nights,
    available: hotelPricing.isAvailable(row, nights, price.rooms_needed),
    min_rooms_left: row.min_rooms_left,
  };
}

function groupByHotel(rows: RoomStayRow[], members: number, nights: number): HotelResult[] {
  const hotels = new Map<string, HotelResult>();
  for (const row of rows) {
    const hotel = hotels.get(row.hotel_id) ?? { ...toHotel(row), options: [], from_per_member_inr: null };
    const option = toOption(row, members, nights);
    hotel.options.push(option);
    if (option.available && (hotel.from_per_member_inr === null || option.per_member_inr < hotel.from_per_member_inr)) {
      hotel.from_per_member_inr = option.per_member_inr;
    }
    hotels.set(row.hotel_id, hotel);
  }
  for (const hotel of hotels.values()) hotel.options.sort((a, b) => a.per_member_inr - b.per_member_inr);
  return [...hotels.values()];
}

function toBooking(row: BookingRow, stay: RoomStayRow, group: GroupRow): Booking {
  return {
    booking_id: row.booking_id, group_id: row.group_id, check_in: group.check_in, check_out: group.check_out,
    rooms_count: row.rooms_count, nights: row.nights, total_inr: row.total_inr, per_member_inr: row.per_member_inr,
    members_count: row.members_count, booked_by: { traveller_id: row.booked_by, name: row.booker_name ?? '' },
    created_at: row.created_at, hotel: toHotel(stay), room: toRoom(stay),
  };
}

/* ---------- access ---------- */

/** 404 unknown group, 403 unless the caller is a member (the owner is a member). */
async function memberGroup(travellerId: string, groupId: string): Promise<GroupRow> {
  const group: GroupRow | undefined = await groupsHelper.findById(normalizeId(groupId));
  if (!group) throw HttpError.notFound('Group not found');
  if (!group.member_ids.includes(travellerId)) {
    throw HttpError.forbidden('Only members of this group can see the Common Group Page');
  }
  return group;
}

const nightsOf = (group: GroupRow) => groupsService.nightsBetween(group.check_in, group.check_out);

function readRoomId(body: unknown): string {
  const roomId = normalizeId((body as { room_id?: unknown } | null)?.room_id);
  if (!roomId) throw HttpError.badRequest('Choose a room', { room_id: 'Choose a room option' });
  return roomId;
}

/** The room in the group's city, priced and re-checked for availability right now. */
async function availableOption(group: GroupRow, roomId: string, trx?: Knex.Transaction) {
  const stay: RoomStayRow | undefined = await groupHotelsHelper.findRoomStay(roomId, group.city, group.check_in, group.check_out, ...(trx ? [trx] : []));
  if (!stay) throw HttpError.notFound(`This room is not offered in ${group.city}`);
  const option = toOption(stay, group.member_ids.length, nightsOf(group));
  if (!option.available) {
    throw HttpError.conflict(`${stay.hotel_name} no longer has ${option.rooms_needed} × ${stay.room_name} free on every night of your stay.`);
  }
  return { stay, option };
}

const LOCKED = 'This group has already booked its hotel. The booking is locked.';

async function assertNotBooked(groupId: string) {
  if (await groupHotelsHelper.findBooking(groupId)) throw HttpError.conflict(LOCKED);
}

/* ---------- use cases ---------- */

async function searchHotels(travellerId: string, groupId: string): Promise<HotelSearch> {
  const group = await memberGroup(travellerId, groupId);
  const nights = nightsOf(group);
  const members = group.member_ids.length;
  const rows: RoomStayRow[] = await groupHotelsHelper.listRoomStays(group.city, group.check_in, group.check_out);
  return {
    group_id: group.group_id, city: group.city, check_in: group.check_in, check_out: group.check_out,
    nights, members_count: members, budget_inr: group.budget_inr,
    hotels: groupByHotel(rows, members, nights),
  };
}

/** Shortlist, one entry per room, with who saved it. Prices use the CURRENT member count. */
async function shortlist(travellerId: string, group: GroupRow): Promise<SavedOption[]> {
  const saved: SavedRow[] = await groupHotelsHelper.listSaved(group.group_id);
  if (!saved.length) return [];
  const rows: RoomStayRow[] = await groupHotelsHelper.listRoomStays(group.city, group.check_in, group.check_out);
  const byRoom = new Map(rows.map((r) => [r.room_id, r]));
  const members = group.member_ids.length;
  const nights = nightsOf(group);
  const out = new Map<string, SavedOption>();
  for (const s of saved) {
    const stay = byRoom.get(s.room_id);
    if (!stay) continue;
    let entry = out.get(s.room_id);
    if (!entry) {
      const option = toOption(stay, members, nights);
      entry = {
        room_id: s.room_id, hotel: toHotel(stay), room: toRoom(stay),
        rooms_needed: option.rooms_needed, nights, total_inr: option.total_inr, per_member_inr: option.per_member_inr,
        available: option.available, budget_inr: group.budget_inr, within_budget: option.per_member_inr <= group.budget_inr,
        saved_by: [], saved_by_me: false, alignment: 0,
      };
      out.set(s.room_id, entry);
    }
    entry.saved_by.push({ traveller_id: s.saved_by, name: s.saver_name, saved_at: s.created_at });
    entry.saved_by_me ||= s.saved_by === travellerId;
    entry.alignment = entry.saved_by.length;
  }
  // Most aligned first, then cheapest.
  return [...out.values()].sort((a, b) => b.alignment - a.alignment || a.per_member_inr - b.per_member_inr);
}

async function listSaved(travellerId: string, groupId: string): Promise<SavedOption[]> {
  return shortlist(travellerId, await memberGroup(travellerId, groupId));
}

async function saveOption(travellerId: string, groupId: string, body: unknown): Promise<SavedOption[]> {
  const roomId = readRoomId(body);
  const group = await memberGroup(travellerId, groupId);
  await assertNotBooked(group.group_id);
  const { option } = await availableOption(group, roomId);
  const created = await groupHotelsHelper.insertSaved({
    group_id: group.group_id, room_id: option.room_id, saved_by: travellerId,
    rooms_count: option.rooms_needed, nights: option.nights, total_inr: option.total_inr, per_member_inr: option.per_member_inr,
  });
  if (!created) throw HttpError.conflict('You have already saved this option.');
  return shortlist(travellerId, group);
}

async function removeOption(travellerId: string, groupId: string, roomId: string): Promise<SavedOption[]> {
  const group = await memberGroup(travellerId, groupId);
  await assertNotBooked(group.group_id);
  const removed: number = await groupHotelsHelper.deleteSaved(group.group_id, normalizeId(roomId), travellerId);
  if (!removed) throw HttpError.notFound('You have not saved this option.');
  return shortlist(travellerId, group);
}

async function getBooking(travellerId: string, groupId: string): Promise<{ booking: Booking | null }> {
  const group = await memberGroup(travellerId, groupId);
  const row: BookingRow | undefined = await groupHotelsHelper.findBooking(group.group_id);
  if (!row) return { booking: null };
  const stay: RoomStayRow | undefined = await groupHotelsHelper.findRoomStay(row.room_id, group.city, group.check_in, group.check_out);
  if (!stay) return { booking: null };
  return { booking: toBooking(row, stay, group) };
}

/** Finalise: one booking per group. Lock the group, re-check availability, insert. */
async function book(travellerId: string, groupId: string, body: unknown): Promise<Booking> {
  const roomId = readRoomId(body);
  const group = await memberGroup(travellerId, groupId);
  return inTransaction(async (trx) => {
    const locked: GroupRow = await groupsHelper.lockById(group.group_id, trx);
    if (await groupHotelsHelper.findBooking(locked.group_id, trx)) throw HttpError.conflict(LOCKED);
    const { stay, option } = await availableOption(locked, roomId, trx);
    const inserted: BookingRow | undefined = await groupHotelsHelper.insertBooking({
      group_id: locked.group_id, room_id: option.room_id, rooms_count: option.rooms_needed, nights: option.nights,
      total_inr: option.total_inr, per_member_inr: option.per_member_inr,
      members_count: locked.member_ids.length, booked_by: travellerId,
    }, trx);
    if (!inserted) throw HttpError.conflict(LOCKED);
    const saved: BookingRow = (await groupHotelsHelper.findBooking(locked.group_id, trx)) ?? inserted;
    return toBooking(saved, stay, locked);
  });
}

// Exported as one object so unit tests can mock.method() it.
const groupHotelsService = { searchHotels, listSaved, saveOption, removeOption, getBooking, book };
export = groupHotelsService;
