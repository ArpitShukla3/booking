import type { Group } from './group';
import type { Traveller } from './traveller';

export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVED';

/** A seeker's "Interested" request (M5) as returned by the backend. */
export interface JoinRequest {
  request_id: string;
  group_id: string;
  seeker_id: string;
  status: JoinRequestStatus;
  created_at: string;
  decided_at: string | null;
}
export interface RequestGroup {
  group_id: string;
  name: string;
  city: string;
  country_name: string;
  check_in: string;
  check_out: string;
  max_size: number;
  members_count: number;
  spots_left: number;
  owner: { traveller_id: string; name: string };
}
/** Owner view: seeker profile + interests shared with the group. */
export interface OwnerJoinRequest extends JoinRequest { seeker: Traveller; shared_interests: string[] }
/** Owner notification across all owned groups. */
export interface IncomingJoinRequest extends OwnerJoinRequest { group: RequestGroup }
/** Seeker view in My requests. */
export interface MyJoinRequest extends JoinRequest { group: RequestGroup }
export interface DecidedJoinRequest extends JoinRequest { group?: Group }
