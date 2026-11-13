import type { Group } from '@/types/group';

export type StepState = 'done' | 'current' | 'upcoming';
export interface TripStep { key: string; title: string; detail: string; state: StepState }

/**
 * The trip's journey, derived from the backend `stage`.
 * Posted → Lobby filling → Lobby complete → Hotel fixed → Booked.
 * Hotel/booking steps become real in M6; until then they are always upcoming.
 */
export interface HotelProgress { shortlisted: number; bookedHotel: string | null }

export function tripSteps(
  group: Pick<Group, 'stage' | 'members_count' | 'max_size' | 'spots_left'>,
  hotel: HotelProgress = { shortlisted: 0, bookedHotel: null },
): TripStep[] {
  const full = group.stage === 'LOBBY_FULL';
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

export function stageLabel(stage: Group['stage']): string {
  return stage === 'LOBBY_FULL' ? 'Lobby complete' : 'Lobby open';
}
