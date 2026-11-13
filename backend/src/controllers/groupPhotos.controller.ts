import type { Request, Response } from 'express';
import groupPhotosService = require('../services/groupPhotos.service.ts');
import type { UploadFile } from '../types/groupPhotos.ts';

type WithTraveller = Request & { traveller: { traveller_id: string } };
const me = (req: Request) => (req as WithTraveller).traveller.traveller_id;
const group = (req: Request) => String(req.params.groupId);

export async function listPhotos(req: Request, res: Response) {
  res.status(200).json(await groupPhotosService.listPhotos(me(req), group(req)));
}
export async function getPhoto(req: Request, res: Response) {
  res.status(200).json(await groupPhotosService.getPhoto(me(req), group(req), String(req.params.photoId)));
}
export async function uploadPhotos(req: Request, res: Response) {
  const files = ((req as Request & { files?: UploadFile[] }).files ?? []) as UploadFile[];
  res.status(201).json(await groupPhotosService.uploadPhotos(me(req), group(req), files, req.body));
}
export async function deletePhoto(req: Request, res: Response) {
  res.status(200).json(await groupPhotosService.deletePhoto(me(req), group(req), String(req.params.photoId)));
}
