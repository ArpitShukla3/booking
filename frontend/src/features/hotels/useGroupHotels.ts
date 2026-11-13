import { useCallback, useEffect, useState } from 'react';
import { entryKey, selectEntry, selectFilters, selectStatus, useGroupHotelStore } from '@/store/useGroupHotelStore';
import { useTravellerStore } from '@/store/useTravellerStore';
import { ApiError } from '@/lib/api';

/** Loads (and revalidates) the group's hotels, shortlist and booking for the signed-in member. */
export function useGroupHotels(groupId: string, enabled = true) {
  const me = useTravellerStore((s) => s.travellerId);
  const key = me ? entryKey(me, groupId) : '';
  const entry = useGroupHotelStore(selectEntry(key));
  const status = useGroupHotelStore(selectStatus(key));
  const filters = useGroupHotelStore(selectFilters(groupId));
  const load = useGroupHotelStore((s) => s.load);
  useEffect(() => { if (me && enabled) void load(me, groupId); }, [me, groupId, enabled, load]);
  const reload = useCallback(() => { if (me) void load(me, groupId); }, [me, groupId, load]);
  return { me, key, entry, status, filters, reload };
}

/** Shortlist/booking actions with a short-lived message for a live region. */
export function useHotelActions(groupId: string) {
  const me = useTravellerStore((s) => s.travellerId);
  const store = useGroupHotelStore.getState;
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [message]);
  const run = useCallback(async (work: () => Promise<unknown>, ok: string) => {
    try { await work(); setMessage({ tone: 'ok', text: ok }); return true; } catch (error) {
      setMessage({ tone: 'error', text: error instanceof ApiError || error instanceof Error ? error.message : 'Please try again.' });
      return false;
    }
  }, []);
  return {
    message,
    save: (roomId: string, label: string) => run(() => store().save(me ?? '', groupId, roomId), `${label} saved to the group shortlist`),
    unsave: (roomId: string, label: string) => run(() => store().unsave(me ?? '', groupId, roomId), `${label} removed from your saves`),
  };
}

export function useBusy(key: string, roomId: string) {
  return useGroupHotelStore((s) => s.busy[`${key}|${roomId}`]);
}
