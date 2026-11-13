// M4 matching rules + every boundary from tasks/TASK-M4-see-matches.md (pure, no DB).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const m = require('../../../src/services/matching.service.ts');

// Priya (T-002) searching Kyoto 9–16 Apr, ₹62,000 — the problem statement example.
const priya = { traveller_id: 'T-002', city: 'Kyoto', check_in: '2027-04-09', check_out: '2027-04-16', budget_inr: 62000, interests: ['TEMPLES', 'STREET_FOOD', 'ADVENTURE'], gender: 'FEMALE', gender_preference: 'SAME_GENDER' };
// G-01 owned by Sarah (T-001).
const g01 = { group_id: 'G-01', name: 'Kyoto Spring Temples', owner_id: 'T-001', member_ids: ['T-001'], city: 'Kyoto', country_name: 'Japan', check_in: '2027-04-10', check_out: '2027-04-15', max_size: 3, budget_inr: 60000, itinerary: '', owner_name: 'Sarah Thomas', owner_gender: 'FEMALE', owner_interests: ['TEMPLES', 'STREET_FOOD', 'PHOTOGRAPHY', 'BUDGET_STAYS'], owner_gender_preference: 'SAME_GENDER' };

describe('worked example: Priya × G-01', () => {
  it('matches with 5 shared nights, ₹2,000 difference, 2 shared interests, 2 spots', () => {
    const r = m.evaluate(priya, g01);
    assert.ok(r);
    assert.equal(r.reasons.shared_nights, 5);
    assert.equal(r.reasons.shared_from, '2027-04-10');
    assert.equal(r.reasons.shared_to, '2027-04-15');
    assert.equal(r.reasons.budget_diff_inr, 2000);
    assert.equal(r.reasons.budget_diff_pct, 3.3);
    assert.deepEqual(r.reasons.shared_interests, ['TEMPLES', 'STREET_FOOD']);
    assert.equal(r.reasons.spots_left, 2);
    assert.match(r.reasons.gender, /Same-gender/);
    assert.ok(r.score > 0 && r.score <= 100);
  });
});

describe('rule 1: same destination', () => {
  it('Kyoto vs Osaka → no match', () => assert.equal(m.evaluate({ ...priya, city: 'Osaka' }, g01), null));
});

describe('rule 2: at least 2 shared nights (check-out day is not a night)', () => {
  it('counts nights', () => {
    assert.equal(m.sharedNights({ check_in: '2027-04-09', check_out: '2027-04-16' }, { check_in: '2027-04-10', check_out: '2027-04-15' }), 5);
    assert.equal(m.sharedNights({ check_in: '2027-04-01', check_out: '2027-04-05' }, { check_in: '2027-04-05', check_out: '2027-04-08' }), 0);
  });
  it('1 shared night → no match', () => assert.equal(m.evaluate({ ...priya, check_in: '2027-04-14', check_out: '2027-04-18' }, g01), null));
  it('2 shared nights → match', () => assert.ok(m.evaluate({ ...priya, check_in: '2027-04-13', check_out: '2027-04-18' }, g01)));
  it('back-to-back trips (no overlap) → no match', () => assert.equal(m.evaluate({ ...priya, check_in: '2027-04-15', check_out: '2027-04-18' }, g01), null));
});

describe('rule 3: budget within 40% of the lower budget', () => {
  it('₹60,000 vs ₹62,000 → match', () => assert.equal(m.budgetCompatible(60000, 62000), true));
  it('₹60,000 vs ₹84,000 (exactly 40%) → match', () => {
    assert.equal(m.budgetCompatible(60000, 84000), true);
    assert.ok(m.evaluate({ ...priya, budget_inr: 84000 }, g01));
  });
  it('₹60,000 vs ₹85,000 → no match', () => {
    assert.equal(m.budgetCompatible(60000, 85000), false);
    assert.equal(m.evaluate({ ...priya, budget_inr: 85000 }, g01), null);
  });
  it('is symmetric (seeker lower than group)', () => {
    assert.equal(m.budgetCompatible(84000, 60000), true);
    assert.ok(m.evaluate({ ...priya, budget_inr: 42858 }, g01)); // 60000-42858=17142 ≤ 0.4×42858=17143.2
    assert.equal(m.evaluate({ ...priya, budget_inr: 42857 }, g01), null); // 17143 > 17142.8
  });
});

describe('rule 4: ≥ 2 interests shared with the OWNER', () => {
  it('1 shared interest → no match', () => assert.equal(m.evaluate({ ...priya, interests: ['TEMPLES', 'ADVENTURE'] }, g01), null));
  it('duplicates are counted once', () => assert.deepEqual(m.sharedInterests(['TEMPLES', 'TEMPLES', 'ADVENTURE'], g01.owner_interests), ['TEMPLES']));
  it('uses the owner\'s interests, not other members\'', () => {
    assert.equal(m.evaluate({ ...priya, interests: ['ADVENTURE', 'NIGHTLIFE'] }, { ...g01, member_ids: ['T-001', 'T-009'] }), null);
  });
});

describe('rule 5: gender preference, both ways', () => {
  it('male seeker vs SAME_GENDER female owner → no match', () => {
    assert.equal(m.evaluate({ ...priya, traveller_id: 'T-005', gender: 'MALE', gender_preference: 'ANY' }, g01), null);
  });
  it('female SAME_GENDER seeker vs male ANY owner → no match', () => {
    assert.equal(m.evaluate(priya, { ...g01, owner_gender: 'MALE', owner_gender_preference: 'ANY' }), null);
  });
  it('both ANY, different genders → match', () => {
    const r = m.evaluate({ ...priya, gender: 'MALE', gender_preference: 'ANY' }, { ...g01, owner_gender_preference: 'ANY' });
    assert.ok(r);
    assert.equal(r.reasons.gender, 'Both open to any gender');
  });
  it('genderCompatible truth table', () => {
    assert.equal(m.genderCompatible('FEMALE', 'SAME_GENDER', 'FEMALE', 'SAME_GENDER'), true);
    assert.equal(m.genderCompatible('MALE', 'ANY', 'FEMALE', 'ANY'), true);
    assert.equal(m.genderCompatible('MALE', 'SAME_GENDER', 'FEMALE', 'ANY'), false);
    assert.equal(m.genderCompatible('MALE', 'ANY', 'FEMALE', 'SAME_GENDER'), false);
  });
});

describe('rule 6: group size', () => {
  it('2 of 3 → match', () => assert.ok(m.evaluate(priya, { ...g01, member_ids: ['T-001', 'T-009'] })));
  it('full group (3 of 3) → no match', () => assert.equal(m.evaluate(priya, { ...g01, member_ids: ['T-001', 'T-009', 'T-010'] }), null));
  it('solo group (max_size 1) → no match', () => assert.equal(m.evaluate(priya, { ...g01, max_size: 1 }), null));
});

describe('own groups are excluded', () => {
  it('the owner never matches their own group', () => assert.equal(m.evaluate({ ...priya, traveller_id: 'T-001' }, g01), null));
  it('an existing member never matches', () => assert.equal(m.evaluate(priya, { ...g01, member_ids: ['T-001', 'T-002'] }), null));
});

describe('score and ranking', () => {
  it('score is 0–100 and rewards shared interests first', () => {
    const two = m.score({ shared_interests: 2, budget_a: 60000, budget_b: 60000, shared_nights: 5, seeker_nights: 5 });
    const four = m.score({ shared_interests: 4, budget_a: 60000, budget_b: 60000, shared_nights: 5, seeker_nights: 5 });
    assert.equal(four, 100);
    assert.equal(two, 75);
    assert.ok(m.score({ shared_interests: 2, budget_a: 60000, budget_b: 84000, shared_nights: 2, seeker_nights: 7 }) >= 0);
  });
  it('ranks by score, then a fixed tie-break (check-in, then group_id)', () => {
    const mk = (id, score, check_in) => ({ score, group: { group_id: id, check_in, budget_inr: 1 }, reasons: { shared_nights: 3, shared_interests: ['A', 'B'], budget_diff_inr: 0 } });
    const ranked = m.rank([mk('G-03', 80, '2027-04-05'), mk('G-02', 80, '2027-04-03'), mk('G-01', 90, '2027-04-09'), mk('G-1001', 80, '2027-04-03')]);
    assert.deepEqual(ranked.map((x) => x.group.group_id), ['G-01', 'G-02', 'G-1001', 'G-03']);
  });
  it('overlap sort puts more shared nights first', () => {
    const mk = (id, score, nights) => ({ score, group: { group_id: id, check_in: '2027-04-01', budget_inr: 1 }, reasons: { shared_nights: nights, shared_interests: [], budget_diff_inr: 0 } });
    assert.deepEqual(m.rank([mk('A', 99, 2), mk('B', 10, 6)], 'overlap').map((x) => x.group.group_id), ['B', 'A']);
  });
});
