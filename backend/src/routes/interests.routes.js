const { Router } = require('express');
const controller = require('../controllers/travellers.controller.ts');
const router = Router();
router.get('/', controller.getInterests);
module.exports = router;
