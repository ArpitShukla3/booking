import lookupsHelper = require('../helpers/postgres/lookups.helper');

async function listDestinations() {
  return lookupsHelper.listDestinations();
}

const lookupsService = { listDestinations };
export = lookupsService;
