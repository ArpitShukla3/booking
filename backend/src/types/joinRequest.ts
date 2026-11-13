import type { Group } from './group.ts';
import type { Traveller } from './traveller.ts';

export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVED';

/** Why a seeker cannot send a request right now (null = they can). */
export type RequestBlocker = 'OWNER' | 'MEMBER' | 'FULL' | 'PENDING' | 'REJECTED' | 'APPROVED' | 'REMOVED';

/** Row returned by joinRequests.helper (plain columns). */
export interface JoinRequestRow {
  request_id: string; group_id: string; seeker_id: string; status: JoinRequestStatus;
  created_at: string | Date; decided_at: string | Date | null;
}
export type SeekerColumns = Omit<Traveller, 'traveller_id'>;
export interface GroupColumns {
  group_name: string; group_city: string; group_country_name: string;
  group_check_in: string; group_check_out: string; group_max_size: number;
  group_member_ids: string[]; group_owner_id: string; group_owner_name: string;
}

export type JoinRequest = JoinRequestRow;

/** Short group summary shown next to a request. */
export interface RequestGroup {
  group_id: string; name: string; city: string; country_name: string;
  check_in: string; check_out: string; max_size: number; members_count: number; spots_left: number;
  owner: { traveller_id: string; name: string };
}

/** What the owner sees: who wants in, and what they share with the group. */
export interface OwnerJoinRequest extends JoinRequest { seeker: Traveller; shared_interests: string[] }
/** Owner notifications across all their groups. */
export interface IncomingJoinRequest extends OwnerJoinRequest { group: RequestGroup }
/** What the seeker sees in My Requests. */
export interface MyJoinRequest extends JoinRequest { group: RequestGroup }
/** Approve result: the request plus the group's new size. */
export interface DecidedJoinRequest extends JoinRequest { group?: Group }
