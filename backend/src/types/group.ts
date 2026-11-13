import type { Traveller } from './traveller.ts';

/** Most advanced first: BOOKED > HOTEL_SHORTLISTED > LOBBY_FULL > LOBBY_OPEN (TASK-X2). */
export type GroupStage = 'LOBBY_OPEN' | 'LOBBY_FULL' | 'HOTEL_SHORTLISTED' | 'BOOKED';

/** Public-safe hotel progress on every Group DTO (no prices, no booking ID). */
export interface HotelStatus { shortlisted: number; booked: boolean }

/** Booking summary for members on My groups. */
export interface BookingSummary {
  booking_id: string; hotel_id: string; hotel_name: string; room_name: string;
  rooms_count: number; nights: number; total_inr: number; per_member_inr: number; booked_at: string;
}

/** Row returned by groups.helper (joined with destinations + owner). */
export interface GroupRow {
  group_id: string; name: string; owner_id: string; member_ids: string[];
  city: string; country_name: string; check_in: string; check_out: string;
  max_size: number; budget_inr: number; itinerary: string | null;
  owner_name: string; owner_gender: 'FEMALE' | 'MALE';
}

/** The shared Group shape (tasks/PLAN.md §2.2) plus `stage`. */
export interface Group {
  group_id: string; name: string; city: string; country_name: string;
  check_in: string; check_out: string; nights: number;
  max_size: number; members_count: number; spots_left: number;
  budget_inr: number; itinerary: string | null;
  owner: { traveller_id: string; name: string; gender: 'FEMALE' | 'MALE' };
  member_ids: string[];
  stage: GroupStage;
  hotel_status: HotelStatus;
}
export interface MyGroup extends Group { my_role: 'OWNER' | 'MEMBER'; pending_requests: number; booking: BookingSummary | null }
export interface GroupDetails extends Group { members: Traveller[] }

/** Booking cost after a member leaves or is removed: same total, new per-member share. */
export interface BookingSplitChange {
  booking_id: string; total_inr: number; members_count: number;
  per_member_before: number; per_member_after: number;
}
/** Result of removing a member or leaving: the updated group, plus the booking change if any. */
export interface MembershipChange extends Group { booking_update: BookingSplitChange | null }
