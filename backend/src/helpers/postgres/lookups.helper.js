// Read-only lookups (destinations, departure cities). Owned by Track A.
const db = require('./client');

const COLUMNS = ['city', 'country_code', 'country_name', 'timezone'];

function listDestinations(trx = db) {
  return trx('destinations').select(COLUMNS).orderBy([{ column: 'country_name' }, { column: 'city' }]);
}

function findDestination(city, trx = db) {
  return trx('destinations').select(COLUMNS).where({ city }).first();
}

function listDepartureCities(trx = db) {
  return trx('departure_cities').select('airport', 'city').orderBy('city');
}

function findDepartureCity(city, trx = db) {
  return trx('departure_cities').select('airport', 'city').whereRaw('lower(city) = lower(?)', [city]).first();
}

module.exports = { listDestinations, findDestination, listDepartureCities, findDepartureCity };
