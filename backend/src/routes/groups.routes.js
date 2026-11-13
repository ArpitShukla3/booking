const { Router } = require('express');
const controller = require('../controllers/groups.controller.ts');
const { requireTraveller } = require('../middleware/currentTraveller');

const router = Router();
router.post('/', requireTraveller, controller.createGroup);
router.get('/mine', requireTraveller, controller.listMyGroups); // before /:groupId
router.get('/:groupId', controller.getGroup);
module.exports = router;
