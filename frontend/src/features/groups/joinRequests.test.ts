import { describe, expect, it } from 'vitest';
import { perMemberShare, REOPENABLE, requestStatusLabel, seekerAction, splitPreview } from './joinRequests';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REMOVED' | 'CANCELLED' | 'LEFT' | 'CLOSED';
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
    ['removed', 'T-002', g01, req('REMOVED'), 'REMOVED'],
  ] as [string, string, typeof g01, { status: Status } | undefined, Kind][])('%s → disabled with a reason', (_label, me, group, existing, kind) => {
    const action = seekerAction(group, me, existing);
    expect(action.kind).toBe(kind);
    expect(action.disabled).toBe(true);
    expect(action.reason.length).toBeGreaterThan(10);
  });
  it('pending wins over full so the seeker still sees their request', () => {
    expect(seekerAction({ ...g01, spots_left: 0 }, 'T-002', req('PENDING')).label).toBe('Request pending');
  });
  it('removed shows "Removed from group" even when the group has space', () => {
    expect(seekerAction(g01, 'T-002', req('REMOVED')).label).toBe('Removed from group');
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
    expect(requestStatusLabel('REMOVED')).toBe('Removed');
  });
});

describe('re-opening ended requests', () => {
  it.each(['CANCELLED', 'LEFT', 'CLOSED'] as const)('%s → "Ask to join again" when there is a spot', (status) => {
    const action = seekerAction(g01, 'T-002', { status });
    expect(action).toMatchObject({ kind: 'CAN_REQUEST', label: 'Ask to join again', disabled: false });
  });
  it('closed request on a still-full group explains why', () => {
    const action = seekerAction({ ...g01, spots_left: 0 }, 'T-002', { status: 'CLOSED' });
    expect(action.kind).toBe('FULL');
    expect(action.reason).toMatch(/filled up/);
  });
  it('REOPENABLE matches the backend list and labels are readable', () => {
    expect(REOPENABLE).toEqual(['CANCELLED', 'LEFT', 'CLOSED']);
    expect(requestStatusLabel('CANCELLED')).toBe('Cancelled');
    expect(requestStatusLabel('LEFT')).toBe('Left');
    expect(requestStatusLabel('CLOSED')).toBe('Group filled');
  });
});

describe('booking cost split after removal / leaving', () => {
  it('keeps the total and re-splits with nearest-rupee rounding', () => {
    expect(perMemberShare(23800, 1)).toBe(23800);
    expect(perMemberShare(10000, 3)).toBe(3333);
    expect(perMemberShare(5000, 0)).toBe(5000);
    expect(splitPreview({ total_inr: 30000, per_member_inr: 10000, members_count: 3 }, 2)).toEqual({ total: 30000, before: 10000, after: 15000, membersAfter: 2 });
  });
  it('no booking → no preview', () => {
    expect(splitPreview(null, 2)).toBeNull();
    expect(splitPreview(undefined, 2)).toBeNull();
  });
});
