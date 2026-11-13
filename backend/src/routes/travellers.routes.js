const { Router } = require('express');
const controller = require('../controllers/travellers.controller.ts');
const router = Router();
router.post('/', controller.createTraveller);
router.post('/sign-in', controller.signIn);
router.get('/:traveller_id', controller.getTraveller);
// G2: groups on a traveller's public profile (served by the groups feature).
router.get('/:traveller_id/groups', require('../controllers/groups.controller.ts').listTravellerGroups);
module.exports = router;
