import type { Request, Response } from 'express';
import searchesService = require('../services/searches.service.ts');
import matchesService = require('../services/matches.service.ts');
import type { Traveller } from '../types/traveller.ts';

const me = (req: Request) => (req as Request & { traveller: Traveller }).traveller;

export async function createSearch(req: Request, res: Response) {
  res.status(201).json(await searchesService.createSearch(me(req), req.body));
}
export async function listMySearches(req: Request, res: Response) {
  res.status(200).json(await searchesService.listMySearches(me(req).traveller_id));
}
export async function getSearch(req: Request, res: Response) {
  res.status(200).json(await searchesService.getSearch(me(req).traveller_id, req.params.searchId));
}
export async function getMatches(req: Request, res: Response) {
  res.status(200).json(await matchesService.getMatches(me(req).traveller_id, req.params.searchId, req.query.sort));
}
export async function listDepartureCities(_req: Request, res: Response) {
  res.status(200).json(await searchesService.listDepartureCities());
}
