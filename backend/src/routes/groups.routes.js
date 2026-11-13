const { Router } = require('express');
const controller = require('../controllers/groups.controller.ts');
const joinRequests = require('../controllers/joinRequests.controller.ts');
const { requireTraveller } = require('../middleware/currentTraveller');

const router = Router();
router.post('/', requireTraveller, controller.createGroup);
router.get('/mine', requireTraveller, controller.listMyGroups); // before /:groupId
router.get('/:groupId', controller.getGroup);
router.post('/:groupId/join-requests', requireTraveller, joinRequests.createRequest);
router.get('/:groupId/join-requests', requireTraveller, joinRequests.listForGroup);
module.exports = router;
