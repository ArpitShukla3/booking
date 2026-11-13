import type { Request, Response } from 'express';
import groupChatService = require('../services/groupChat.service.ts');

type WithTraveller = Request & { traveller: { traveller_id: string } };
const me = (req: Request) => (req as WithTraveller).traveller.traveller_id;
const group = (req: Request) => String(req.params.groupId);

export async function getChat(req: Request, res: Response) {
  res.status(200).json(await groupChatService.getChat(me(req), group(req)));
}
export async function listMessages(req: Request, res: Response) {
  res.status(200).json(await groupChatService.listMessages(me(req), group(req), req.query.after));
}
export async function postMessage(req: Request, res: Response) {
  res.status(201).json(await groupChatService.postMessage(me(req), group(req), req.body));
}
export async function createPoll(req: Request, res: Response) {
  res.status(201).json(await groupChatService.createPoll(me(req), group(req), req.body));
}
export async function vote(req: Request, res: Response) {
  res.status(200).json(await groupChatService.vote(me(req), group(req), String(req.params.messageId), req.body));
}
export async function updateSettings(req: Request, res: Response) {
  res.status(200).json(await groupChatService.updateSettings(me(req), group(req), req.body));
}
