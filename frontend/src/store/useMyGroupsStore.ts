import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { groupService } from '@/services/groupService';
import type { MyGroup } from '@/types/group';

/**
 * TASK-X2: My groups with a live trip status. The backend derives each group's stage
 * (lobby → hotel shortlisted → booked); this store keeps the last list per traveller so the
 * page paints instantly, then revalidates silently (never flashing a skeleton).
 */
export const MY_GROUPS_KEY = 'my_groups_v1';

interface Entry { groups: MyGroup[]; fetchedAt: number }
export interface MyGroupsStatus { loading: boolean; refreshing: boolean; error: string | null }

interface MyGroupsState {
  byTraveller: Record<string, Entry>;
  status: Record<string, MyGroupsStatus>;
  load(travellerId: string): Promise<void>;
}

const IDLE: MyGroupsStatus = { loading: false, refreshing: false, error: null };
const NONE: Entry = { groups: [], fetchedAt: 0 };

const safeStorage: StateStorage = {
  getItem: (n) => { try { return localStorage.getItem(n); } catch { return null; } },
  setItem: (n, v) => { try { localStorage.setItem(n, v); } catch { /* demo cache only */ } },
  removeItem: (n) => { try { localStorage.removeItem(n); } catch { /* ignore */ } },
};

export function createMyGroupsStore(api: { listMyGroups(): Promise<MyGroup[]> }, storage: StateStorage = safeStorage) {
  const inFlight = new Map<string, Promise<void>>();
  return create<MyGroupsState>()(persist((set, get) => ({
    byTraveller: {},
    status: {},
    load(travellerId) {
      const running = inFlight.get(travellerId);
      if (running) return running;
      const cached = Boolean(get().byTraveller[travellerId]?.fetchedAt);
      const setStatus = (s: MyGroupsStatus) => set((st) => ({ status: { ...st.status, [travellerId]: s } }));
      setStatus({ loading: !cached, refreshing: cached, error: null });
      const work = api.listMyGroups().then((groups) => {
        set((st) => ({ byTraveller: { ...st.byTraveller, [travellerId]: { groups, fetchedAt: Date.now() } } }));
        setStatus(IDLE);
      }, (error: unknown) => {
        // A failed background refresh keeps showing the last good list.
        setStatus({ loading: false, refreshing: false, error: error instanceof Error ? error.message : 'Could not load your groups.' });
      }).finally(() => inFlight.delete(travellerId));
      inFlight.set(travellerId, work);
      return work;
    },
  }), {
    name: MY_GROUPS_KEY,
    version: 1,
    storage: createJSONStorage(() => storage),
    partialize: (s) => ({ byTraveller: s.byTraveller }),
  }));
}

export const useMyGroupsStore = createMyGroupsStore(groupService);

export const selectMyGroups = (travellerId: string) => (s: MyGroupsState) => s.byTraveller[travellerId] ?? NONE;
export const selectMyGroupsStatus = (travellerId: string) => (s: MyGroupsState) => s.status[travellerId] ?? IDLE;
