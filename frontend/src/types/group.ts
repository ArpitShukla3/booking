import type { Traveller } from './traveller';

/** Derived by the backend, most advanced first: BOOKED > HOTEL_SHORTLISTED > LOBBY_FULL > LOBBY_OPEN (TASK-X2). */
export type GroupStage = 'LOBBY_OPEN' | 'LOBBY_FULL' | 'HOTEL_SHORTLISTED' | 'BOOKED';
export interface HotelStatus { shortlisted: number; booked: boolean }
export interface BookingSummary {
  booking_id: string; hotel_id: string; hotel_name: string; room_name: string;
  rooms_count: number; nights: number; total_inr: number; per_member_inr: number; booked_at: string;
}

/** Shared Group shape (tasks/PLAN.md §2.2) as returned by the backend. */
export interface Group {
  group_id: string;
  name: string;
  city: string;
  country_name: string;
  check_in: string;
  check_out: string;
  nights: number;
  max_size: number;
  members_count: number;
  spots_left: number;
  budget_inr: number;
  itinerary: string | null;
  owner: { traveller_id: string; name: string; gender: 'FEMALE' | 'MALE' };
  member_ids: string[];
  stage: GroupStage;
  hotel_status: HotelStatus;
}
export interface MyGroup extends Group { my_role: 'OWNER' | 'MEMBER'; pending_requests: number; booking: BookingSummary | null }
export interface GroupDetails extends Group { members: Traveller[] }
export interface Destination { city: string; country_code: string; country_name: string; timezone: string }
export interface CreateGroupInput {
  name: string;
  city: string;
  check_in: string;
  check_out: string;
  max_size: number;
  budget_inr: number;
  itinerary: string;
}
