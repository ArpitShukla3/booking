import type { Request, Response } from 'express';
import * as travellersService from '../services/travellers.service.ts';
export async function createTraveller(req: Request, res: Response) { res.status(201).json(await travellersService.createTraveller(req.body)); }
export async function signIn(req: Request, res: Response) { res.json(await travellersService.signIn(req.body)); }
export async function getTraveller(req: Request, res: Response) { res.json(await travellersService.getTraveller(req.params.traveller_id)); }
export async function getInterests(_req: Request, res: Response) { res.json(await travellersService.getInterests()); }
