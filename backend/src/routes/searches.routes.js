const { Router } = require('express');
const controller = require('../controllers/searches.controller.ts');
const { requireTraveller } = require('../middleware/currentTraveller');

const router = Router();
router.use(requireTraveller); // every search belongs to the signed-in traveller
router.post('/', controller.createSearch);
router.get('/', controller.listMySearches);
router.get('/:searchId', controller.getSearch);
router.get('/:searchId/matches', controller.getMatches);
module.exports = router;
