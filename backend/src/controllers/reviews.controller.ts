import type { Request, Response } from 'express';
import reviewsService = require('../services/reviews.service.ts');

// TASK-X3: public review reads + "Ask the reviews" search.
const params = (req: Request) => [req.params.subjectType, String(req.params.subjectId)] as const;

export async function listReviews(req: Request, res: Response) {
  res.status(200).json(await reviewsService.listReviews(...params(req)));
}
export async function listQuestions(req: Request, res: Response) {
  res.status(200).json(await reviewsService.listQuestions(...params(req)));
}
export async function search(req: Request, res: Response) {
  res.status(200).json(await reviewsService.search(...params(req), { q: req.query.q, limit: req.query.limit }));
}
