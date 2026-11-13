// Mounts every feature router under /api.
// Add ONE line per feature. Don't put handlers here.
const { Router } = require('express');

const router = Router();

router.use('/health', require('./health.routes'));
router.use('/travellers', require('./travellers.routes'));
router.use('/interests', require('./interests.routes'));

module.exports = router;
