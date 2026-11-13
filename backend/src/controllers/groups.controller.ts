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
export async function removeMember(req: Request, res: Response) {
  res.status(200).json(await groupsService.removeMember((req as WithTraveller).traveller.traveller_id, String(req.params.groupId), String(req.params.travellerId)));
}
export async function leaveGroup(req: Request, res: Response) {
  res.status(200).json(await groupsService.leaveGroup((req as WithTraveller).traveller.traveller_id, String(req.params.groupId)));
}
export async function listTravellerGroups(req: Request, res: Response) {
  res.status(200).json(await groupsService.listTravellerGroups(String(req.params.traveller_id)));
}
