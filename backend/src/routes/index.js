// Mounts every feature router under /api.
// Add ONE line per feature. Don't put handlers here.
const { Router } = require('express');

const router = Router();

router.use('/health', require('./health.routes'));
router.use('/travellers', require('./travellers.routes'));
router.use('/interests', require('./interests.routes'));
router.use('/destinations', require('./destinations.routes'));
router.use('/groups', require('./groups.routes'));
router.use('/departure-cities', require('./departureCities.routes'));
router.use('/searches', require('./searches.routes'));
router.use('/join-requests', require('./joinRequests.routes'));

module.exports = router;
