import type { Group } from '@/types/group';
import type { JoinRequest, JoinRequestStatus } from '@/types/joinRequest';

export type SeekerActionKind = 'SIGN_IN' | 'CAN_REQUEST' | 'OWNER' | 'MEMBER' | 'FULL' | 'PENDING' | 'REJECTED' | 'REMOVED';

/** Ended requests that can be sent again (mirrors the backend's isReopenable). */
export const REOPENABLE: JoinRequestStatus[] = ['CANCELLED', 'LEFT', 'CLOSED'];
export interface SeekerAction { kind: SeekerActionKind; label: string; reason: string; disabled: boolean }

/**
 * What the "Interested" button shows for the current traveller. Mirrors the backend's
 * requestBlocker (the backend re-checks every rule; this only explains it up front).
 */
export function seekerAction(
  group: Pick<Group, 'member_ids' | 'spots_left'> & { owner: Pick<Group['owner'], 'traveller_id'> },
  me: string | null,
  existing: Pick<JoinRequest, 'status'> | undefined,
): SeekerAction {
  if (!me) return { kind: 'SIGN_IN', label: 'Sign in to join', reason: 'Sign in with your Traveller ID to send a request.', disabled: false };
  if (group.owner.traveller_id === me) return { kind: 'OWNER', label: 'You organise this trip', reason: 'Review join requests from travellers below.', disabled: true };
  if (group.member_ids.includes(me) || existing?.status === 'APPROVED') return { kind: 'MEMBER', label: 'You’re in this group', reason: 'Your request was approved. You’re a member of this trip.', disabled: true };
  if (existing?.status === 'PENDING') return { kind: 'PENDING', label: 'Request pending', reason: 'The organiser will review your request. We’ll show the decision here.', disabled: true };
  if (existing?.status === 'REMOVED') return { kind: 'REMOVED', label: 'Removed from group', reason: 'The organiser removed you from this group, so you can’t ask to join it again.', disabled: true };
  if (existing?.status === 'REJECTED') return { kind: 'REJECTED', label: 'Request declined', reason: 'The organiser declined your request, so you can’t ask to join this group again.', disabled: true };
  if (group.spots_left <= 0) {
    const reason = existing?.status === 'CLOSED' ? 'The group filled up before your request was reviewed. You can ask again if a spot opens.' : 'Every spot is taken, so this group can’t take new requests.';
    return { kind: 'FULL', label: 'Group is full', reason, disabled: true };
  }
  const again = existing?.status === 'CANCELLED' ? 'You cancelled your earlier request. ' : existing?.status === 'LEFT' ? 'You left this group earlier. ' : existing?.status === 'CLOSED' ? 'A spot opened up again. ' : '';
  return { kind: 'CAN_REQUEST', label: again ? 'Ask to join again' : 'Interested', reason: `${again}The organiser will see your profile and can approve or decline.`, disabled: false };
}

const STATUS_LABELS: Record<JoinRequestStatus, string> = {
  PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Declined', REMOVED: 'Removed', CANCELLED: 'Cancelled', LEFT: 'Left', CLOSED: 'Group filled',
};
export const requestStatusLabel = (status: JoinRequestStatus) => STATUS_LABELS[status];

/** "2 hours ago"-style label for request timestamps. */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export const MAX_REQUEST_MESSAGE = 500;

/** Per-person share if the booking's total is split over `membersAfter` (same rounding as the backend). */
export const perMemberShare = (totalInr: number, membersAfter: number) => Math.round(totalInr / Math.max(1, membersAfter));

/** What a removal / leave would do to a booked hotel's cost split, or null when nothing is booked. */
export function splitPreview(booking: { total_inr: number; per_member_inr: number; members_count: number } | null | undefined, membersAfter: number) {
  if (!booking) return null;
  return { total: booking.total_inr, before: booking.per_member_inr, after: perMemberShare(booking.total_inr, membersAfter), membersAfter };
}
