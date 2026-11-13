import type { Request, Response } from 'express';
import joinRequestsService = require('../services/joinRequests.service.ts');

type WithTraveller = Request & { traveller: { traveller_id: string } };
const me = (req: Request) => (req as WithTraveller).traveller.traveller_id;

export async function createRequest(req: Request, res: Response) {
  res.status(201).json(await joinRequestsService.createRequest(me(req), String(req.params.groupId), req.body));
}
export async function listForGroup(req: Request, res: Response) {
  res.status(200).json(await joinRequestsService.listForGroup(me(req), String(req.params.groupId)));
}
export async function listIncoming(req: Request, res: Response) {
  res.status(200).json(await joinRequestsService.listIncoming(me(req)));
}
export async function listMine(req: Request, res: Response) {
  res.status(200).json(await joinRequestsService.listMine(me(req)));
}
export async function approve(req: Request, res: Response) {
  res.status(200).json(await joinRequestsService.approve(me(req), String(req.params.requestId)));
}
export async function reject(req: Request, res: Response) {
  res.status(200).json(await joinRequestsService.reject(me(req), String(req.params.requestId)));
}
export async function cancel(req: Request, res: Response) {
  res.status(200).json(await joinRequestsService.cancel(me(req), String(req.params.requestId)));
}
