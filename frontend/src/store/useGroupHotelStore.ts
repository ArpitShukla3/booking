import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { ApiError } from '@/lib/api';
import { groupHotelService } from '@/services/groupHotelService';
import type { GroupHotelApi } from '@/services/groupHotelService';
import { DEFAULT_FILTERS } from '@/features/hotels/hotelFilters';
import type { HotelFilters } from '@/features/hotels/hotelFilters';
import type { Booking, HotelSearch, SavedOption } from '@/types/hotel';

/**
 * Common Group Page state (M6). The backend is the source of truth; this store keeps the
 * last response per (traveller, group) so the page paints instantly on return or refresh,
 * then revalidates in the background. Filters persist per group.
 */
export const GROUP_HOTELS_KEY = 'group_hotels_v1';

export interface GroupHotelEntry { search: HotelSearch | null; shortlist: SavedOption[]; booking: Booking | null; fetchedAt: number }
export interface GroupHotelStatus { loading: boolean; refreshing: boolean; error: string | null; forbidden: boolean }

interface GroupHotelState {
  entries: Record<string, GroupHotelEntry>;
  filters: Record<string, HotelFilters>;
  status: Record<string, GroupHotelStatus>;
  /** `${key}|${roomId}` → the action in flight, so buttons can show progress. */
  busy: Record<string, 'save' | 'unsave' | 'book'>;
  load(travellerId: string, groupId: string): Promise<void>;
  setFilters(groupId: string, patch: Partial<HotelFilters>): void;
  resetFilters(groupId: string): void;
  save(travellerId: string, groupId: string, roomId: string): Promise<void>;
  unsave(travellerId: string, groupId: string, roomId: string): Promise<void>;
  book(travellerId: string, groupId: string, roomId: string): Promise<Booking>;
}

export const entryKey = (travellerId: string, groupId: string) => `${travellerId}:${groupId.toUpperCase()}`;
const IDLE: GroupHotelStatus = { loading: false, refreshing: false, error: null, forbidden: false };
const EMPTY: GroupHotelEntry = { search: null, shortlist: [], booking: null, fetchedAt: 0 };
const MAX_ENTRIES = 12;

/** localStorage that never throws (private mode, blocked storage). */
const safeStorage: StateStorage = {
  getItem: (name) => { try { return localStorage.getItem(name); } catch { return null; } },
  setItem: (name, value) => { try { localStorage.setItem(name, value); } catch { /* demo state only */ } },
  removeItem: (name) => { try { localStorage.removeItem(name); } catch { /* ignore */ } },
};

export function createGroupHotelStore(api: GroupHotelApi, storage: StateStorage = safeStorage) {
  return create<GroupHotelState>()(persist((set, get) => {
    const patchEntry = (key: string, patch: Partial<GroupHotelEntry>) => set((s) => ({
      entries: { ...s.entries, [key]: { ...(s.entries[key] ?? EMPTY), ...patch, fetchedAt: Date.now() } },
    }));
    const setStatus = (key: string, patch: Partial<GroupHotelStatus>) => set((s) => ({
      status: { ...s.status, [key]: { ...(s.status[key] ?? IDLE), ...patch } },
    }));
    const setBusy = (id: string, action: GroupHotelState['busy'][string] | null) => set((s) => {
      const busy = { ...s.busy };
      if (action) busy[id] = action; else delete busy[id];
      return { busy };
    });
    const inFlight = new Map<string, Promise<void>>();

    /** Runs a shortlist/booking mutation; a 409 means someone else changed the group, so revalidate. */
    async function mutate<T>(travellerId: string, groupId: string, roomId: string, action: 'save' | 'unsave' | 'book', run: () => Promise<T>) {
      const key = entryKey(travellerId, groupId);
      setBusy(`${key}|${roomId}`, action);
      try {
        return await run();
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) void get().load(travellerId, groupId);
        throw error;
      } finally {
        setBusy(`${key}|${roomId}`, null);
      }
    }

    return {
      entries: {},
      filters: {},
      status: {},
      busy: {},

      load(travellerId, groupId) {
        const key = entryKey(travellerId, groupId);
        const running = inFlight.get(key);
        if (running) return running;
        const cached = Boolean(get().entries[key]?.search);
        setStatus(key, { loading: !cached, refreshing: cached, error: null });
        const work = Promise.all([api.searchHotels(groupId), api.listSaved(groupId), api.getBooking(groupId)])
          .then(([search, shortlist, booking]) => {
            patchEntry(key, { search, shortlist, booking });
            setStatus(key, { ...IDLE });
          }, (error: unknown) => {
            const forbidden = error instanceof ApiError && error.status === 403;
            if (forbidden) set((s) => { const entries = { ...s.entries }; delete entries[key]; return { entries }; });
            setStatus(key, {
              loading: false, refreshing: false, forbidden,
              error: error instanceof Error ? error.message : 'Could not load hotels. Please try again.',
            });
          })
          .finally(() => inFlight.delete(key));
        inFlight.set(key, work);
        return work;
      },

      setFilters(groupId, patch) {
        const id = groupId.toUpperCase();
        set((s) => ({ filters: { ...s.filters, [id]: { ...DEFAULT_FILTERS, ...s.filters[id], ...patch } } }));
      },
      resetFilters(groupId) {
        set((s) => ({ filters: { ...s.filters, [groupId.toUpperCase()]: { ...DEFAULT_FILTERS } } }));
      },

      async save(travellerId, groupId, roomId) {
        const shortlist = await mutate(travellerId, groupId, roomId, 'save', () => api.save(groupId, roomId));
        patchEntry(entryKey(travellerId, groupId), { shortlist });
      },
      async unsave(travellerId, groupId, roomId) {
        const shortlist = await mutate(travellerId, groupId, roomId, 'unsave', () => api.unsave(groupId, roomId));
        patchEntry(entryKey(travellerId, groupId), { shortlist });
      },
      async book(travellerId, groupId, roomId) {
        const booking = await mutate(travellerId, groupId, roomId, 'book', () => api.book(groupId, roomId));
        patchEntry(entryKey(travellerId, groupId), { booking });
        return booking;
      },
    };
  }, {
    name: GROUP_HOTELS_KEY,
    version: 1,
    storage: createJSONStorage(() => storage),
    // Cache the newest few groups only; status/busy are per page view.
    partialize: (s) => ({
      filters: s.filters,
      entries: Object.fromEntries(Object.entries(s.entries).sort(([, a], [, b]) => b.fetchedAt - a.fetchedAt).slice(0, MAX_ENTRIES)),
    }),
  }));
}

export const useGroupHotelStore = createGroupHotelStore(groupHotelService);

/** Convenience selectors. */
export const selectEntry = (key: string) => (s: GroupHotelState) => s.entries[key] ?? EMPTY;
export const selectStatus = (key: string) => (s: GroupHotelState) => s.status[key] ?? IDLE;
export const selectFilters = (groupId: string) => (s: GroupHotelState) => s.filters[groupId.toUpperCase()] ?? DEFAULT_FILTERS;
