// M6 Common Group Page, mounted at /api/groups/:groupId (members only).
const { Router } = require('express');
const controller = require('../controllers/groupHotels.controller.ts');
const { requireTraveller } = require('../middleware/currentTraveller');

const router = Router({ mergeParams: true });
router.get('/hotels', requireTraveller, controller.searchHotels);
router.get('/saved-options', requireTraveller, controller.listSaved);
router.post('/saved-options', requireTraveller, controller.saveOption);
router.delete('/saved-options/:roomId', requireTraveller, controller.removeOption);
router.get('/booking', requireTraveller, controller.getBooking);
router.post('/booking', requireTraveller, controller.book);
module.exports = router;
