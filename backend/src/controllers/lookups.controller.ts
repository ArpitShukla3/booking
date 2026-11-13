import type { Request, Response } from 'express';
import lookupsService = require('../services/lookups.service.ts');

export async function listDestinations(_req: Request, res: Response) {
  res.json(await lookupsService.listDestinations());
}
