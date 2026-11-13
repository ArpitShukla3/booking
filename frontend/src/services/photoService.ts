import { apiClient } from '@/lib/api';
import type { Gallery, Photo, PhotoDetails } from '@/types/photo';

/** Real backend API for the X4 photo gallery. The traveller ID header is added by lib/api.ts. */
export interface PhotoApi {
  listPhotos(groupId: string): Promise<Gallery>;
  getPhoto(groupId: string, photoId: string): Promise<PhotoDetails>;
  uploadPhotos(groupId: string, files: File[], captions: string[], onProgress?: (percent: number) => void): Promise<Photo[]>;
  deletePhoto(groupId: string, photoId: string): Promise<{ deleted: string }>;
}

const base = (groupId: string) => `/api/groups/${encodeURIComponent(groupId)}/photos`;

export const photoService: PhotoApi = {
  async listPhotos(groupId) { return (await apiClient.get<Gallery>(base(groupId))).data; },
  async getPhoto(groupId, photoId) { return (await apiClient.get<PhotoDetails>(`${base(groupId)}/${encodeURIComponent(photoId)}`)).data; },
  async uploadPhotos(groupId, files, captions, onProgress) {
    const form = new FormData();
    files.forEach((file) => form.append('photos', file));
    form.append('captions', JSON.stringify(captions.map((c) => c.trim())));
    const res = await apiClient.post<Photo[]>(base(groupId), form, {
      // Override the client's JSON default; the browser adds the multipart boundary.
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    });
    return res.data;
  },
  async deletePhoto(groupId, photoId) { return (await apiClient.delete<{ deleted: string }>(`${base(groupId)}/${encodeURIComponent(photoId)}`)).data; },
};
