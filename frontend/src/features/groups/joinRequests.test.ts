import { describe, expect, it } from 'vitest';
import { requestStatusLabel, seekerAction } from './joinRequests';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
type Kind = ReturnType<typeof seekerAction>['kind'];
const g01 = { owner: { traveller_id: 'T-001' }, member_ids: ['T-001'], spots_left: 2 };
const req = (status: Status) => ({ status });

describe('seekerAction (Interested button state)', () => {
  it('signed-out visitors are asked to sign in', () => {
    expect(seekerAction(g01, null, undefined)).toMatchObject({ kind: 'SIGN_IN', disabled: false });
  });
  it('open group, no request → Interested is enabled', () => {
    expect(seekerAction(g01, 'T-002', undefined)).toMatchObject({ kind: 'CAN_REQUEST', disabled: false, label: 'Interested' });
  });
  it.each([
    ['owner', 'T-001', g01, undefined, 'OWNER'],
    ['member', 'T-002', { ...g01, member_ids: ['T-001', 'T-002'] }, undefined, 'MEMBER'],
    ['full group', 'T-002', { ...g01, spots_left: 0 }, undefined, 'FULL'],
    ['pending', 'T-002', g01, req('PENDING'), 'PENDING'],
    ['rejected', 'T-002', g01, req('REJECTED'), 'REJECTED'],
  ] as [string, string, typeof g01, { status: Status } | undefined, Kind][])('%s → disabled with a reason', (_label, me, group, existing, kind) => {
    const action = seekerAction(group, me, existing);
    expect(action.kind).toBe(kind);
    expect(action.disabled).toBe(true);
    expect(action.reason.length).toBeGreaterThan(10);
  });
  it('pending wins over full so the seeker still sees their request', () => {
    expect(seekerAction({ ...g01, spots_left: 0 }, 'T-002', req('PENDING')).label).toBe('Request pending');
  });
  it('rejected shows "Request declined"', () => {
    expect(seekerAction(g01, 'T-002', req('REJECTED')).label).toBe('Request declined');
  });
});

describe('requestStatusLabel', () => {
  it('maps statuses to readable labels', () => {
    expect(requestStatusLabel('PENDING')).toBe('Pending');
    expect(requestStatusLabel('APPROVED')).toBe('Approved');
    expect(requestStatusLabel('REJECTED')).toBe('Declined');
  });
});
