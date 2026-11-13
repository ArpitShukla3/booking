// TASK-X3: /api/reviews/:subjectType/:subjectId (subjectType = hotels | travellers). Public, like hotel and profile pages.
const { Router } = require('express');
const controller = require('../controllers/reviews.controller.ts');

const router = Router();
router.get('/:subjectType/:subjectId', controller.listReviews);
router.get('/:subjectType/:subjectId/questions', controller.listQuestions);
router.get('/:subjectType/:subjectId/search', controller.search);
module.exports = router;
