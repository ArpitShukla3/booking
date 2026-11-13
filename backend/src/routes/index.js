// Mounts every feature router under /api.
// Add ONE line per feature. Don't put handlers here.
const { Router } = require('express');

const router = Router();

router.use('/health', require('./health.routes'));

module.exports = router;
