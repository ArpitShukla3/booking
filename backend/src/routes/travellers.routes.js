const { Router } = require('express');
const controller = require('../controllers/travellers.controller.ts');
const router = Router();
router.post('/', controller.createTraveller);
router.post('/sign-in', controller.signIn);
router.get('/:traveller_id', controller.getTraveller);
module.exports = router;
