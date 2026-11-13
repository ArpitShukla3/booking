import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTravellerStore, SESSION_KEY, SEVEN_DAYS } from './useTravellerStore'
import type { TravellerApi } from '@/services/travellerService'
const profile = { traveller_id: 'T-025', name: 'Rahul Kumar', age: 24, gender: 'MALE' as const, home_city: 'Delhi', home_airport: 'DEL', interests: ['ADVENTURE'], gender_preference: 'ANY' as const }
const memory = () => { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value) }, removeItem: (key: string) => { map.delete(key) } } }
let now: number
let storage: ReturnType<typeof memory>
let api: TravellerApi
beforeEach(() => { now = 1800000000000; storage = memory(); api = { signup: vi.fn(async () => profile), signInWithId: vi.fn(async () => profile), getTraveller: vi.fn(async () => profile), getInterests: vi.fn(async () => []) } })
describe('real-profile seven-day identity store', () => {
  it('remembers signup and explicit sign-in for exactly seven days', async () => {
    const store = createTravellerStore(api, storage, () => now)
    await store.getState().signup({ ...profile })
    expect(JSON.parse(storage.getItem(SESSION_KEY)!)).toEqual({ traveller_id: 'T-025', expires_at: now + SEVEN_DAYS })
    now += 1000; await store.getState().signInWithId('T-025')
    expect(store.getState().expiresAt).toBe(now + SEVEN_DAYS)
  })
  it('restores through the backend without extending expiry and deduplicates restores', async () => {
    storage.setItem(SESSION_KEY, JSON.stringify({ traveller_id: 'T-025', expires_at: now + 5000 }))
    const store = createTravellerStore(api, storage, () => now)
    await Promise.all([store.getState().restoreSession(), store.getState().restoreSession()])
    expect(store.getState().traveller?.name).toBe('Rahul Kumar'); expect(store.getState().expiresAt).toBe(now + 5000)
    expect(api.getTraveller).toHaveBeenCalledTimes(1); expect(JSON.parse(storage.getItem(SESSION_KEY)!).expires_at).toBe(now + 5000)
  })
  it.each(['bad json', '{}', '{"traveller_id":"T-025","expires_at":"tomorrow"}', '{"traveller_id":"bad","expires_at":1900000000000}'])('clears malformed identity: %s', async raw => {
    storage.setItem(SESSION_KEY, raw); const store = createTravellerStore(api, storage, () => now); await store.getState().restoreSession()
    expect(store.getState().traveller).toBeNull(); expect(storage.getItem(SESSION_KEY)).toBeNull(); expect(api.getTraveller).not.toHaveBeenCalled()
  })
  it('clears expired identity, including exactly at the deadline, and permits later login', async () => {
    storage.setItem(SESSION_KEY, JSON.stringify({ traveller_id: 'T-025', expires_at: now }))
    const store = createTravellerStore(api, storage, () => now); await store.getState().restoreSession()
    expect(storage.getItem(SESSION_KEY)).toBeNull(); expect(api.getTraveller).not.toHaveBeenCalled()
    await store.getState().signInWithId('T-025'); expect(store.getState().traveller?.traveller_id).toBe('T-025')
  })
  it('clears a deleted profile on 404 but preserves identity on a temporary backend outage for retry', async () => {
    storage.setItem(SESSION_KEY, JSON.stringify({ traveller_id: 'T-025', expires_at: now + 5000 }))
    api.getTraveller = vi.fn(async () => { throw Object.assign(new Error('Unavailable'), { status: 503 }) })
    const store = createTravellerStore(api, storage, () => now); await store.getState().restoreSession()
    expect(storage.getItem(SESSION_KEY)).not.toBeNull(); expect(store.getState().restoreError).toContain('Unavailable')
    api.getTraveller = vi.fn(async () => { throw Object.assign(new Error('Not found'), { status: 404 }) })
    await store.getState().restoreSession(true); expect(storage.getItem(SESSION_KEY)).toBeNull(); expect(store.getState().traveller).toBeNull()
  })
  it('expires identity-dependent actions while the page stays open', async () => {
    const store = createTravellerStore(api, storage, () => now); await store.getState().signInWithId('T-025')
    now += SEVEN_DAYS; expect(store.getState().ensureValidSession()).toBe(false); expect(store.getState().traveller).toBeNull(); expect(storage.getItem(SESSION_KEY)).toBeNull()
  })
  it('logout does not call a delete endpoint and a late restore cannot sign the user in again', async () => {
    storage.setItem(SESSION_KEY, JSON.stringify({ traveller_id: 'T-025', expires_at: now + 5000 }))
    let resolve!: (value: typeof profile) => void
    api.getTraveller = () => new Promise(r => { resolve = r })
    const store = createTravellerStore(api, storage, () => now); const restore = store.getState().restoreSession(); store.getState().logout(); resolve(profile); await restore
    expect(store.getState().traveller).toBeNull(); expect(storage.getItem(SESSION_KEY)).toBeNull()
  })
  it('still reveals a successfully created profile when browser persistence fails', async () => {
    storage.setItem = () => { throw new Error('blocked') }
    const store = createTravellerStore(api, storage, () => now)
    const created = await store.getState().signup({ ...profile })
    expect(created.traveller_id).toBe('T-025'); expect(store.getState().storageWarning).toContain('remember')
  })
  it('does not restore a previous traveller when saving a new identity fails', async () => {
    storage.setItem(SESSION_KEY, JSON.stringify({ traveller_id: 'T-001', expires_at: now + 5000 }));
    storage.setItem = () => { throw new Error('quota') };
    const store = createTravellerStore(api, storage, () => now);
    await store.getState().signInWithId('T-025');
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  })
  it('does not erase saved identity on a transient storage read failure', async () => {
    storage.setItem(SESSION_KEY, JSON.stringify({ traveller_id: 'T-025', expires_at: now + 5000 }));
    const remove = vi.spyOn(storage, 'removeItem'); storage.getItem = () => { throw new Error('blocked read') };
    const store = createTravellerStore(api, storage, () => now); await store.getState().restoreSession();
    expect(remove).not.toHaveBeenCalled(); expect(store.getState().restoreError).toMatch(/storage/i);
  })
  it('reports when the browser cannot persist logout instead of silently claiming it cleared storage', async () => {
    const store = createTravellerStore(api, storage, () => now); await store.getState().signInWithId('T-025');
    storage.removeItem = () => { throw new Error('blocked') }; storage.setItem = () => { throw new Error('blocked') };
    store.getState().logout(); expect(store.getState().traveller).toBeNull(); expect(store.getState().storageWarning).toMatch(/clear/i);
  })
  it('clears impossible timestamps and oversized stored IDs before fetching a profile', async () => {
    for (const value of [{ traveller_id: 'T-025', expires_at: Number.MAX_SAFE_INTEGER }, { traveller_id: `T-${'1'.repeat(50)}`, expires_at: now + 1000 }]) {
      storage.setItem(SESSION_KEY, JSON.stringify(value)); const store = createTravellerStore(api, storage, () => now); await store.getState().restoreSession();
      expect(store.getState().traveller).toBeNull(); expect(storage.getItem(SESSION_KEY)).toBeNull();
    }
    expect(api.getTraveller).not.toHaveBeenCalled();
  })
})
