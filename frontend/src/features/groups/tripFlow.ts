import type { Group, GroupStage, HotelStatus } from '@/types/group';

export type StepState = 'done' | 'current' | 'upcoming';
export interface TripStep { key: string; title: string; detail: string; state: StepState }

/**
 * The trip's journey, derived from the backend `stage`.
 * Posted → Lobby filling → Lobby complete → Hotel fixed → Booked.
 * Hotel/booking steps become real in M6; until then they are always upcoming.
 */
export interface HotelProgress { shortlisted: number; bookedHotel: string | null }

type StepGroup = Pick<Group, 'stage' | 'members_count' | 'max_size' | 'spots_left'> & { hotel_status?: HotelStatus };

/** Hotel progress from the backend's `hotel_status` (or none). */
export function hotelProgressOf(group: StepGroup, bookedHotel?: string | null): HotelProgress {
  const status = group.hotel_status;
  return { shortlisted: status?.shortlisted ?? 0, bookedHotel: status?.booked ? bookedHotel || 'Hotel booked' : null };
}

export function tripSteps(group: StepGroup, hotel: HotelProgress = hotelProgressOf(group)): TripStep[] {
  const full = group.members_count >= group.max_size;
  const booked = Boolean(hotel.bookedHotel);
  return [
    { key: 'posted', title: 'Group posted', detail: 'Visible to matching travellers', state: 'done' },
    {
      key: 'lobby', title: 'Lobby filling',
      detail: `${group.members_count} of ${group.max_size} joined`,
      state: full || booked ? 'done' : 'current',
    },
    {
      key: 'complete', title: 'Lobby complete',
      detail: full ? 'Everyone is in. Time to pick a stay' : `${group.spots_left} ${group.spots_left === 1 ? 'spot' : 'spots'} left`,
      state: booked || (full && hotel.shortlisted) ? 'done' : full ? 'current' : 'upcoming',
    },
    {
      key: 'hotel', title: 'Hotel fixed',
      detail: booked ? hotel.bookedHotel! : hotel.shortlisted ? `${hotel.shortlisted} on the shortlist` : 'Compare stays together',
      state: booked ? 'done' : hotel.shortlisted ? 'current' : 'upcoming',
    },
    { key: 'booked', title: 'Booked', detail: booked ? 'Locked. Cost split per member' : 'Split the cost and confirm', state: booked ? 'done' : 'upcoming' },
  ];
}

const STAGE_LABELS: Record<GroupStage, string> = {
  LOBBY_OPEN: 'Lobby open',
  LOBBY_FULL: 'Lobby complete',
  HOTEL_SHORTLISTED: 'Hotel shortlisted',
  BOOKED: 'Booked',
};
export const STAGES = Object.keys(STAGE_LABELS) as GroupStage[];

export function stageLabel(stage: GroupStage): string {
  return STAGE_LABELS[stage] ?? 'Lobby open';
}

/**
 * The page's own fresher hotel state (after a save/book in this tab) can only move the
 * backend stage forward, never back, so a still-loading store can't downgrade it.
 */
export function liveStage(group: Pick<Group, 'stage'>, hotel?: HotelProgress): GroupStage {
  if (group.stage === 'BOOKED' || hotel?.bookedHotel) return 'BOOKED';
  if (hotel?.shortlisted) return 'HOTEL_SHORTLISTED';
  return group.stage;
}
