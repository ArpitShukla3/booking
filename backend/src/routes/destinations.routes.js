const { Router } = require('express');
const controller = require('../controllers/lookups.controller.ts');

const router = Router();
router.get('/', controller.listDestinations);
module.exports = router;
