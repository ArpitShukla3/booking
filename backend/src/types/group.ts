import type { Traveller } from './traveller.ts';

export type GroupStage = 'LOBBY_OPEN' | 'LOBBY_FULL';

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
}
export interface MyGroup extends Group { my_role: 'OWNER' | 'MEMBER'; pending_requests: number }
export interface GroupDetails extends Group { members: Traveller[] }
