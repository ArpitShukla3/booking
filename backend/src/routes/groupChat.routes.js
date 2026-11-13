// S1 team chat, mounted at /api/groups/:groupId/chat (members only, after the hotel is booked).
const { Router } = require('express');
const controller = require('../controllers/groupChat.controller.ts');
const { requireTraveller } = require('../middleware/currentTraveller');

const router = Router({ mergeParams: true });
router.use(requireTraveller);
router.get('/', controller.getChat);
router.patch('/settings', controller.updateSettings);
router.get('/messages', controller.listMessages);
router.post('/messages', controller.postMessage);
router.post('/polls', controller.createPoll);
router.post('/polls/:messageId/vote', controller.vote);
module.exports = router;
