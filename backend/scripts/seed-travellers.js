const helper = require('../src/helpers/postgres/travellers.helper');
const healthHelper = require('../src/helpers/postgres/health.helper');
helper.seedMissingTravellers().then(() => console.log('Missing traveller/catalog seeds inserted; existing profiles preserved.')).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => healthHelper.close());
