export const SESSION_KEY = 'group_match_active_traveller';
export const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
export interface SavedIdentity { traveller_id: string; expires_at: number }
export interface IdentityStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export function clearIdentity(storage: IdentityStorage): boolean {
  try { storage.removeItem(SESSION_KEY); return true; }
  catch { try { storage.setItem(SESSION_KEY, ''); return true; } catch { return false; } }
}
export function readIdentity(storage: IdentityStorage, now: number): SavedIdentity | null {
  let raw: string | null;
  try { raw = storage.getItem(SESSION_KEY); }
  catch { throw new Error('Browser storage could not be read. Check your browser settings and retry.'); }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) throw new Error();
    const value = parsed as SavedIdentity;
    if (typeof value.traveller_id !== 'string' || value.traveller_id.length > 40 || !/^T-\d{3,}$/.test(value.traveller_id) || !Number.isSafeInteger(value.expires_at) || !Number.isFinite(new Date(value.expires_at).getTime()) || value.expires_at <= now) throw new Error();
    return { traveller_id: value.traveller_id, expires_at: value.expires_at };
  } catch { clearIdentity(storage); return null; }
}
export const browserIdentityStorage: IdentityStorage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: key => localStorage.removeItem(key) };
