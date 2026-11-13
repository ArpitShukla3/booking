const { Router } = require('express');
const controller = require('../controllers/searches.controller.ts');

const router = Router();
router.get('/', controller.listDepartureCities);
module.exports = router;
