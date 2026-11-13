import { describe, expect, it, vi } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import { createMyGroupsStore } from '@/store/useMyGroupsStore';
import type { MyGroup } from '@/types/group';
import { hotelProgressOf, liveStage, STAGES, stageLabel, tripSteps } from './tripFlow';

// TASK-X2: live trip status.
const base = { members_count: 2, max_size: 3, spots_left: 1 };

describe('trip status labels and steps', () => {
  it('has a label for every backend stage', () => {
    expect(STAGES.map(stageLabel)).toEqual(['Lobby open', 'Lobby complete', 'Hotel shortlisted', 'Booked']);
  });
  it('hotelProgressOf reads the backend hotel_status', () => {
    expect(hotelProgressOf({ ...base, stage: 'LOBBY_OPEN' })).toEqual({ shortlisted: 0, bookedHotel: null });
    expect(hotelProgressOf({ ...base, stage: 'BOOKED', hotel_status: { shortlisted: 1, booked: true } }, 'Gion Corner Hotel'))
      .toEqual({ shortlisted: 1, bookedHotel: 'Gion Corner Hotel' });
    expect(hotelProgressOf({ ...base, stage: 'BOOKED', hotel_status: { shortlisted: 0, booked: true } }).bookedHotel).toBe('Hotel booked');
  });
  it('a BOOKED group completes every step, even with an open seat', () => {
    const steps = tripSteps({ ...base, stage: 'BOOKED', hotel_status: { shortlisted: 1, booked: true } });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done']);
  });
  it('a full lobby with a shortlist makes "Hotel fixed" current', () => {
    const steps = tripSteps({ members_count: 3, max_size: 3, spots_left: 0, stage: 'HOTEL_SHORTLISTED', hotel_status: { shortlisted: 2, booked: false } });
    expect(steps.find((s) => s.key === 'complete')?.state).toBe('done');
    expect(steps.find((s) => s.key === 'hotel')?.state).toBe('current');
  });
  it('liveStage only moves forward from the backend stage', () => {
    expect(liveStage({ stage: 'LOBBY_OPEN' }, { shortlisted: 1, bookedHotel: null })).toBe('HOTEL_SHORTLISTED');
    expect(liveStage({ stage: 'HOTEL_SHORTLISTED' }, { shortlisted: 1, bookedHotel: 'Gion' })).toBe('BOOKED');
    expect(liveStage({ stage: 'BOOKED' }, { shortlisted: 0, bookedHotel: null })).toBe('BOOKED');
    expect(liveStage({ stage: 'LOBBY_FULL' })).toBe('LOBBY_FULL');
  });
});

describe('useMyGroupsStore', () => {
  const memory = (): StateStorage & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
  };
  const group = (stage: MyGroup['stage']) => ({ group_id: 'G-1', stage } as MyGroup);

  it('first load shows loading; later loads refresh silently and replace the stage', async () => {
    const listMyGroups = vi.fn().mockResolvedValueOnce([group('LOBBY_OPEN')]).mockResolvedValueOnce([group('BOOKED')]);
    const store = createMyGroupsStore({ listMyGroups }, memory());
    const first = store.getState().load('T-001');
    expect(store.getState().status['T-001']).toMatchObject({ loading: true, refreshing: false });
    await first;
    const second = store.getState().load('T-001');
    expect(store.getState().status['T-001']).toMatchObject({ loading: false, refreshing: true });
    await second;
    expect(store.getState().byTraveller['T-001'].groups[0].stage).toBe('BOOKED');
  });

  it('a failed refresh keeps the last good list; concurrent loads share one request', async () => {
    const listMyGroups = vi.fn().mockResolvedValueOnce([group('HOTEL_SHORTLISTED')]).mockRejectedValueOnce(new Error('offline'));
    const store = createMyGroupsStore({ listMyGroups }, memory());
    await Promise.all([store.getState().load('T-001'), store.getState().load('T-001')]);
    expect(listMyGroups).toHaveBeenCalledTimes(1);
    await store.getState().load('T-001');
    expect(store.getState().status['T-001'].error).toBe('offline');
    expect(store.getState().byTraveller['T-001'].groups[0].stage).toBe('HOTEL_SHORTLISTED');
  });

  it('persists per traveller so the page paints instantly next time', async () => {
    const storage = memory();
    await createMyGroupsStore({ listMyGroups: vi.fn(async () => [group('BOOKED')]) }, storage).getState().load('T-002');
    expect(Object.values(storage.data)[0]).toContain('"T-002"');
    expect(Object.values(storage.data)[0]).toContain('BOOKED');
  });
});
