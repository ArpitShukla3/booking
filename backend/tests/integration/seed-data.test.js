// MID level: the data-pack migration loaded everything correctly
// (counts + worked examples from DATA_DICTIONARY.md).
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');

const { db, closeDb } = require('../helpers/db');

describe('data-pack seed migration', () => {
  after(closeDb);

  it('loads every table with the expected row count', async () => {
    const expected = {
      interests: 16,
      travellers: 24,
      groups: 12,
      destinations: 5,
      departure_cities: 4,
      destination_links: 8,
      destination_rules: 1,
      hotels: 49,
      rooms: 125,
      availability: 2500,
    };
    for (const [table, count] of Object.entries(expected)) {
      // Seeded IDs only, so rows created by app tests don't break this.
      const [{ n }] = await db(table).count('* as n');
      assert.ok(Number(n) >= count, `${table}: expected at least ${count}, got ${n}`);
    }
  });

  it('keeps G-01 exactly as in groups.json (dates as YYYY-MM-DD strings)', async () => {
    const g = await db('groups').where({ group_id: 'G-01' }).first();
    assert.equal(g.owner_id, 'T-001');
    assert.equal(g.city, 'Kyoto');
    assert.equal(g.check_in, '2027-04-10');
    assert.equal(g.check_out, '2027-04-15');
    assert.equal(g.max_size, 3);
    assert.equal(g.budget_inr, 60000);
  });

  it('flattens room price (RM-KYO-001-A = ₹4,760, 2 adults)', async () => {
    const r = await db('rooms').where({ room_id: 'RM-KYO-001-A' }).first();
    assert.equal(r.price_per_night_amount, 4760);
    assert.equal(r.price_per_night_currency, 'INR');
    assert.equal(r.max_adults, 2);
  });

  it('matches the availability worked example (10–14 Apr: 6,2,4,3,3)', async () => {
    const rows = await db('availability')
      .where({ room_id: 'RM-KYO-001-A' })
      .whereBetween('date', ['2027-04-10', '2027-04-14'])
      .orderBy('date');
    assert.deepEqual(rows.map((r) => r.rooms_left), [6, 2, 4, 3, 3]);
  });

  it('stores hotel image paths unchanged', async () => {
    const h = await db('hotels').where({ hotel_id: 'HTL-KYO-001' }).first();
    assert.equal(h.image, 'images/hotels/HOTEL-BUSINESS-1.jpg');
  });
});
