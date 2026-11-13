/**
 * Populates the database from the hackathon data pack (read-only JSON files).
 * The source folder is DATA_DIR (default: ../hackathon-problem-3-group-travel-matcher).
 */
const fs = require('fs');
const path = require('path');
const { dataDir } = require('../src/config');

function load(relPath) {
  const file = path.join(dataDir, 'data', relPath);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const SEEDED_TABLES = [
  'availability',
  'rooms',
  'hotels',
  'groups',
  'travellers',
  'destination_rules',
  'destination_links',
  'departure_cities',
  'destinations',
  'interests',
];

exports.up = async function up(knex) {
  const interests = load('problem-3/interests.json');
  const travellers = load('problem-3/travellers.json');
  const groups = load('problem-3/groups.json');
  const destinations = load('catalog/destinations.json');
  const hotels = load('catalog/hotels.json');
  const rooms = load('catalog/rooms.json');
  const availability = load('catalog/availability.json');

  await knex('interests').insert(interests);

  await knex('destinations').insert(
    destinations.countries.flatMap((country) =>
      country.cities.map((city) => ({
        city: city.name,
        country_code: country.code,
        country_name: country.name,
        timezone: country.timezone,
        airports: city.airports,
      })),
    ),
  );

  await knex('departure_cities').insert(destinations.departure_cities);

  const links = destinations.countries.flatMap((c) => c.links || []);
  if (links.length) await knex('destination_links').insert(links);

  const { rules } = destinations;
  await knex('destination_rules').insert({
    id: 1,
    min_nights: rules.min_nights,
    max_nights: rules.max_nights,
    min_nights_per_city: rules.min_nights_per_city,
    first_night: rules.data_window.first_night,
    last_departure: rules.data_window.last_departure,
  });

  await knex('travellers').insert(travellers);
  await knex('groups').insert(groups);
  await knex('hotels').insert(hotels);

  await knex('rooms').insert(
    rooms.map(({ price_per_night, ...room }) => ({
      ...room,
      price_per_night_amount: price_per_night.amount,
      price_per_night_currency: price_per_night.currency,
    })),
  );

  await knex.batchInsert('availability', availability, 500);
};

exports.down = async function down(knex) {
  await knex.raw(`TRUNCATE ${SEEDED_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
};
