const { Router } = require('express');
const controller = require('../controllers/joinRequests.controller.ts');
const { requireTraveller } = require('../middleware/currentTraveller');

// /api/join-requests (M5). Per-group endpoints live in groups.routes.js.
const router = Router();
router.use(requireTraveller);
router.get('/mine', controller.listMine);
router.get('/incoming', controller.listIncoming);
router.post('/:requestId/approve', controller.approve);
router.post('/:requestId/reject', controller.reject);
router.post('/:requestId/cancel', controller.cancel);
module.exports = router;
