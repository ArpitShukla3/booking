import { create } from 'zustand';
import { travellerService } from '@/services/travellerService';
import type { TravellerApi } from '@/services/travellerService';
import type { SignupInput, Traveller } from '@/types/traveller';
import { browserIdentityStorage, clearIdentity, readIdentity, SESSION_KEY, SEVEN_DAYS } from '@/lib/identityStorage';
import type { IdentityStorage } from '@/lib/identityStorage';
export { SESSION_KEY, SEVEN_DAYS } from '@/lib/identityStorage';

interface TravellerState {
  traveller: Traveller | null;
  travellerId: string | null;
  expiresAt: number | null;
  isLoading: boolean;
  isInitialized: boolean;
  restoreError: string | null;
  storageWarning: string | null;
  notice: string | null;
  signup(input: SignupInput): Promise<Traveller>;
  signInWithId(id: string): Promise<Traveller>;
  restoreSession(force?: boolean): Promise<void>;
  logout(notice?: string): void;
  ensureValidSession(): boolean;
}

/** Single owner of deadlines, persistence, restoration and request-race protection. */
export function createTravellerStore(api: TravellerApi, storage: IdentityStorage, now = Date.now) {
  let operation = 0;
  let restoring: Promise<void> | null = null;
  return create<TravellerState>((set, get) => {
    function logout(notice: string | null = null) {
      operation += 1;
      const cleared = clearIdentity(storage);
      const storageWarning = cleared ? null : 'You are signed out in this tab, but the browser could not clear the saved identity. Clear site storage before leaving a shared device.';
      set({ traveller: null, travellerId: null, expiresAt: null, isLoading: false, isInitialized: true, restoreError: null, storageWarning, notice: storageWarning || notice });
    }
    async function establish(request: () => Promise<Traveller>): Promise<Traveller> {
      const current = ++operation;
      set({ isLoading: true, restoreError: null, notice: null });
      try {
        const profile = await request();
        if (current !== operation) throw new Error('Sign-in was cancelled. Please try again.');
        const expiresAt = now() + SEVEN_DAYS;
        let storageWarning: string | null = null;
        try { storage.setItem(SESSION_KEY, JSON.stringify({ traveller_id: profile.traveller_id, expires_at: expiresAt })); }
        catch { const cleared = clearIdentity(storage); storageWarning = 'Your profile is saved, but this browser could not remember your sign-in. Save your Traveller ID before leaving.' + (cleared ? '' : ' A previous saved identity may remain; clear site storage before sharing this device.'); }
        set({ traveller: profile, travellerId: profile.traveller_id, expiresAt, isLoading: false, isInitialized: true, restoreError: null, storageWarning, notice: null });
        return profile;
      } catch (error) { if (current === operation) set({ isLoading: false, isInitialized: true }); throw error; }
    }
    return {
      traveller: null, travellerId: null, expiresAt: null, isLoading: false, isInitialized: false, restoreError: null, storageWarning: null, notice: null,
      signup: input => establish(() => api.signup(input)),
      signInWithId: id => establish(() => api.signInWithId(id)),
      logout,
      ensureValidSession() {
        const state = get();
        if (!state.traveller || !state.expiresAt) return false;
        if (now() >= state.expiresAt) { logout('Your remembered sign-in expired. Enter your Traveller ID to continue.'); return false; }
        return true;
      },
      async restoreSession(force = false) {
        if (restoring && !force) return restoring;
        if (get().isInitialized && !force) return;
        const current = ++operation;
        let saved;
        try { saved = readIdentity(storage, now()); }
        catch (error) { set({ traveller: null, travellerId: null, expiresAt: null, isLoading: false, isInitialized: true, restoreError: error instanceof Error ? error.message : 'Browser storage could not be read.' }); return; }
        if (!saved) { set({ traveller: null, travellerId: null, expiresAt: null, isLoading: false, isInitialized: true, restoreError: null }); return; }
        set({ isLoading: true, restoreError: null, traveller: null, travellerId: null, expiresAt: saved.expires_at });
        const task = (async () => {
          try {
            const profile = await api.getTraveller(saved.traveller_id);
            if (current !== operation) return;
            if (now() >= saved.expires_at) { logout('Your remembered sign-in expired. Enter your Traveller ID to continue.'); return; }
            set({ traveller: profile, travellerId: profile.traveller_id, expiresAt: saved.expires_at, isLoading: false, isInitialized: true, restoreError: null });
          } catch (error) {
            if (current !== operation) return;
            if ((error as { status?: number }).status === 404) { logout('Traveller ID not found. Sign in with another ID or create a profile.'); return; }
            set({ traveller: null, travellerId: null, isLoading: false, isInitialized: true, restoreError: error instanceof Error ? error.message : 'Could not restore your profile. Try again.' });
          }
        })();
        restoring = task;
        try { await task; } finally { if (restoring === task) restoring = null; }
      },
    };
  });
}
export const useTravellerStore = createTravellerStore(travellerService, browserIdentityStorage);
