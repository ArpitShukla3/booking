import type { Traveller } from './traveller';

export type GroupStage = 'LOBBY_OPEN' | 'LOBBY_FULL';

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
}
export interface MyGroup extends Group { my_role: 'OWNER' | 'MEMBER'; pending_requests: number }
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
