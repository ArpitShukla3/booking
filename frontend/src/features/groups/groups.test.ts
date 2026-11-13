import { describe, expect, it } from 'vitest';
import { createGroupSchema, nightsBetween, sizeLabel } from './schema';
import { tripSteps } from './tripFlow';

const sarah = { name: 'Kyoto temples & street food', city: 'Kyoto', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000, itinerary: '' };
const fieldsOf = (input: unknown) => {
  const r = createGroupSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
};

describe('create group schema', () => {
  it('accepts Sarah\'s post and the window edges', () => {
    expect(fieldsOf(sarah)).toEqual([]);
    expect(fieldsOf({ ...sarah, check_in: '2027-04-01', check_out: '2027-04-20', max_size: 1 })).toEqual([]);
  });
  it.each([
    [{ max_size: 0 }, 'max_size'], [{ max_size: 5 }, 'max_size'],
    [{ check_in: '2027-03-31' }, 'check_in'], [{ check_out: '2027-04-21' }, 'check_out'],
    [{ check_in: '2027-04-15', check_out: '2027-04-12' }, 'check_out'],
    [{ budget_inr: 0 }, 'budget_inr'], [{ name: '  ' }, 'name'], [{ city: '' }, 'city'],
  ])('rejects %o on %s', (patch, field) => {
    expect(fieldsOf({ ...sarah, ...patch })).toContain(field);
  });
});

describe('helpers', () => {
  it('counts nights and labels size', () => {
    expect(nightsBetween('2027-04-10', '2027-04-15')).toBe(5);
    expect(nightsBetween('', '2027-04-15')).toBe(0);
    expect(sizeLabel(1)).toBe('Just you');
    expect(sizeLabel(3)).toBe('You + 2 more');
  });
});

describe('trip flow', () => {
  it('open lobby: lobby step is current, hotel upcoming', () => {
    const steps = tripSteps({ stage: 'LOBBY_OPEN', members_count: 1, max_size: 3, spots_left: 2 });
    expect(steps.map((s) => s.state)).toEqual(['done', 'current', 'upcoming', 'upcoming', 'upcoming']);
    expect(steps[1].detail).toBe('1 of 3 joined');
  });
  it('full lobby: lobby complete is current', () => {
    const steps = tripSteps({ stage: 'LOBBY_FULL', members_count: 3, max_size: 3, spots_left: 0 });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming']);
  });
});
