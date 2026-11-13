import type { Request, Response } from 'express';
import groupsService = require('../services/groups.service.ts');

type WithTraveller = Request & { traveller: { traveller_id: string } };

export async function createGroup(req: Request, res: Response) {
  res.status(201).json(await groupsService.createGroup((req as WithTraveller).traveller.traveller_id, req.body));
}
export async function listMyGroups(req: Request, res: Response) {
  res.status(200).json(await groupsService.listMyGroups((req as WithTraveller).traveller.traveller_id));
}
export async function getGroup(req: Request, res: Response) {
  res.status(200).json(await groupsService.getGroup(String(req.params.groupId)));
}
