import { useEffect } from 'react';
import { selectMyGroups, selectMyGroupsStatus, useMyGroupsStore } from '@/store/useMyGroupsStore';
import { GROUP_HOTELS_KEY } from '@/store/useGroupHotelStore';

export const LIVE_INTERVAL_MS = 20_000;

/**
 * TASK-X2: keeps My groups live. Revalidates on open, when the tab becomes visible or focused,
 * every 20 s while visible, and when another tab of this browser saves/books a hotel.
 */
export function useLiveMyGroups(travellerId: string) {
  const entry = useMyGroupsStore(selectMyGroups(travellerId));
  const status = useMyGroupsStore(selectMyGroupsStatus(travellerId));
  const load = useMyGroupsStore((s) => s.load);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void load(travellerId); };
    void load(travellerId);
    const timer = window.setInterval(refresh, LIVE_INTERVAL_MS);
    const onStorage = (e: StorageEvent) => { if (e.key === GROUP_HOTELS_KEY) refresh(); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [travellerId, load]);

  return { groups: entry.groups, fetchedAt: entry.fetchedAt, status, reload: () => void load(travellerId) };
}
