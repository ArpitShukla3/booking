import { describe, expect, it } from 'vitest';
import { liveSearchSchema, nights } from './searchSchema';

const priya = { home_city: 'Mumbai', city: 'Kyoto', check_in: '2027-04-09', check_out: '2027-04-16', budget_inr: 62000, interests: ['TEMPLES', 'STREET_FOOD', 'ADVENTURE'], gender_preference: 'SAME_GENDER' as const };
const errorsFor = (input: unknown) => {
  const r = liveSearchSchema.safeParse(input);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
};

describe('live search schema', () => {
  it('accepts Priya\'s search and the window edges', () => {
    expect(errorsFor(priya)).toEqual({});
    expect(errorsFor({ ...priya, check_in: '2027-04-01', check_out: '2027-04-20', gender_preference: 'ANY' })).toEqual({});
  });
  it.each([
    [{ check_in: '2027-03-31' }, 'check_in', /1–20 April 2027/],
    [{ check_out: '2027-04-21' }, 'check_out', /1–20 April 2027/],
    [{ check_in: '2027-04-12', check_out: '2027-04-12' }, 'check_out', /after check-in/],
    [{ budget_inr: 0 }, 'budget_inr', /more than/],
    [{ interests: ['TEMPLES'] }, 'interests', /at least two/],
    [{ city: '' }, 'city', /destination/],
    [{ home_city: '' }, 'home_city', /home city/],
  ])('rejects %o', (patch, field, message) => {
    expect(errorsFor({ ...priya, ...patch })[field]).toMatch(message);
  });
  it('counts nights without the check-out day', () => {
    expect(nights('2027-04-09', '2027-04-16')).toBe(7);
    expect(nights('2027-04-09', '')).toBe(0);
  });
});
