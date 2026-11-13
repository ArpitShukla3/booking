import type { Request, Response } from 'express';
import groupHotelsService = require('../services/groupHotels.service.ts');

type WithTraveller = Request & { traveller: { traveller_id: string } };
const me = (req: Request) => (req as WithTraveller).traveller.traveller_id;
const group = (req: Request) => String(req.params.groupId);

export async function searchHotels(req: Request, res: Response) {
  res.status(200).json(await groupHotelsService.searchHotels(me(req), group(req)));
}
export async function listSaved(req: Request, res: Response) {
  res.status(200).json(await groupHotelsService.listSaved(me(req), group(req)));
}
export async function saveOption(req: Request, res: Response) {
  res.status(201).json(await groupHotelsService.saveOption(me(req), group(req), req.body));
}
export async function removeOption(req: Request, res: Response) {
  res.status(200).json(await groupHotelsService.removeOption(me(req), group(req), String(req.params.roomId)));
}
export async function getBooking(req: Request, res: Response) {
  res.status(200).json(await groupHotelsService.getBooking(me(req), group(req)));
}
export async function book(req: Request, res: Response) {
  res.status(201).json(await groupHotelsService.book(me(req), group(req), req.body));
}
