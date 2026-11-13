import groupsHelper = require('../helpers/postgres/groups.helper');
import groupHotelsHelper = require('../helpers/postgres/groupHotels.helper');
import groupPhotosHelper = require('../helpers/postgres/groupPhotos.helper');
import photoStorage = require('../helpers/storage/photos.helper');
import transactionHelper = require('../helpers/postgres/transaction.helper');
import HttpError = require('../utils/HttpError');
import type { Knex } from 'knex';
import type { GroupRow } from '../types/group.ts';
import type { Gallery, Photo, PhotoDetails, PhotoMime, PhotoRow, UploadFile } from '../types/groupPhotos.ts';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 10;
const MAX_PHOTOS_PER_GROUP = 200;
const MAX_CAPTION = 300;

/* ---------- pure rules (no I/O) ---------- */

/** Real file type from the first bytes (never trust the name or the browser's mimetype). */
function detectImageType(buf: Buffer): PhotoMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Width/height from the image header, or null when it can't be read (the photo is still accepted). */
function imageSize(buf: Buffer, mime: PhotoMime): { width: number; height: number } | null {
  try {
    if (mime === 'image/png') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (mime === 'image/webp') {
      const chunk = buf.toString('ascii', 12, 16);
      if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      if (chunk === 'VP8L') {
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      return null;
    }
    // JPEG: walk the segments to the first start-of-frame marker.
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) return null;
      const marker = buf[offset + 1];
      const length = buf.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
    return null;
  } catch {
    return null;
  }
}

const EXTENSION: Record<PhotoMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const objectKey = (groupId: string, photoId: string, mime: PhotoMime) => `groups/${groupId}/${photoId}.${EXTENSION[mime]}`;

/** The uploader can delete their own photo; the organiser can delete any photo in the group. */
function canDelete(ownerId: string, photo: Pick<PhotoRow, 'uploader_id'>, travellerId: string): boolean {
  return photo.uploader_id === travellerId || ownerId === travellerId;
}

/** Captions: one per file (same order). Accepts a JSON array string, an array, or a single string. */
function parseCaptions(raw: unknown, count: number): (string | null)[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try { list = raw.trim().startsWith('[') ? JSON.parse(raw) : [raw]; } catch { list = [raw]; }
  }
  const values = Array.isArray(list) ? list : [];
  return Array.from({ length: count }, (_, i) => {
    const value = typeof values[i] === 'string' ? (values[i] as string).trim() : '';
    if (value.length > MAX_CAPTION) {
      throw HttpError.badRequest('Please check the highlighted fields', { captions: `Keep captions under ${MAX_CAPTION} characters` });
    }
    return value || null;
  });
}

/** Validates every file before anything is stored. Returns type + size per file. */
function checkFiles(files: UploadFile[], alreadyInGroup: number) {
  const fail = (message: string) => HttpError.badRequest('Please check the highlighted fields', { photos: message });
  if (!files.length) throw fail('Choose at least one photo');
  if (files.length > MAX_FILES_PER_UPLOAD) throw fail(`Upload at most ${MAX_FILES_PER_UPLOAD} photos at a time`);
  if (alreadyInGroup + files.length > MAX_PHOTOS_PER_GROUP) {
    throw fail(`This group can keep ${MAX_PHOTOS_PER_GROUP} photos; ${Math.max(0, MAX_PHOTOS_PER_GROUP - alreadyInGroup)} more can be added`);
  }
  return files.map((file) => {
    if (file.size > MAX_FILE_BYTES) throw fail(`"${file.originalname}" is larger than 5 MB`);
    const mime = detectImageType(file.buffer);
    if (!mime) throw fail(`"${file.originalname}" is not a JPEG, PNG or WebP image`);
    return { file, mime, size: imageSize(file.buffer, mime) };
  });
}

/* ---------- access ---------- */

const today = () => new Date().toISOString().slice(0, 10);

/** Group exists (404) → caller is a member (403) → the group has booked its hotel (409). */
async function openGallery(travellerId: string, groupId: string): Promise<GroupRow> {
  const group: GroupRow | undefined = await groupsHelper.findById(String(groupId).trim().toUpperCase());
  if (!group) throw HttpError.notFound('Group not found');
  if (!group.member_ids.includes(travellerId)) throw HttpError.forbidden('Only members of this group can see its photos');
  if (!(await groupHotelsHelper.findBooking(group.group_id))) throw HttpError.conflict('The photo gallery opens once the group has booked its hotel');
  return group;
}

function groupSummary(group: GroupRow): Gallery['group'] {
  return {
    group_id: group.group_id, name: group.name, city: group.city, country_name: group.country_name ?? '',
    check_in: group.check_in, check_out: group.check_out, trip_finished: today() >= group.check_out,
  };
}

async function toPhotoDto(row: PhotoRow, group: GroupRow, travellerId: string): Promise<Photo> {
  const url: string = await photoStorage.signedUrl(row.object_key);
  return {
    photo_id: row.photo_id, group_id: row.group_id, caption: row.caption, created_at: row.created_at,
    mime_type: row.mime_type, size_bytes: row.size_bytes, width: row.width, height: row.height,
    uploader: { traveller_id: row.uploader_id, name: row.uploader_name, is_owner: row.uploader_id === group.owner_id },
    url, url_expires_at: new Date(Date.now() + photoStorage.linkTtlSeconds * 1000).toISOString(),
    can_delete: canDelete(group.owner_id, row, travellerId),
  };
}

const inTransaction = <T>(work: (trx: Knex.Transaction) => Promise<T>): Promise<T> =>
  transactionHelper.withTransaction(work) as unknown as Promise<T>;

/* ---------- use cases ---------- */

async function listPhotos(travellerId: string, groupId: string): Promise<Gallery> {
  const group = await openGallery(travellerId, groupId);
  const rows: PhotoRow[] = await groupPhotosHelper.listByGroup(group.group_id);
  return {
    group: groupSummary(group),
    photos: await Promise.all(rows.map((row) => toPhotoDto(row, group, travellerId))),
    limits: {
      max_file_bytes: MAX_FILE_BYTES, max_files_per_upload: MAX_FILES_PER_UPLOAD,
      max_photos_per_group: MAX_PHOTOS_PER_GROUP, remaining: Math.max(0, MAX_PHOTOS_PER_GROUP - rows.length),
    },
  };
}

async function getPhoto(travellerId: string, groupId: string, photoId: string): Promise<PhotoDetails> {
  const group = await openGallery(travellerId, groupId);
  const rows: PhotoRow[] = await groupPhotosHelper.listByGroup(group.group_id);
  const index = rows.findIndex((r) => r.photo_id === String(photoId).trim().toUpperCase());
  if (index < 0) throw HttpError.notFound('Photo not found');
  return {
    ...(await toPhotoDto(rows[index], group, travellerId)),
    group: groupSummary(group), position: index + 1, total: rows.length,
    prev_photo_id: rows[index - 1]?.photo_id ?? null, next_photo_id: rows[index + 1]?.photo_id ?? null,
  };
}

/**
 * Validate every file first, store all of them in object storage, then insert all rows in one
 * transaction. If anything fails after storing, the stored objects are deleted again.
 */
async function uploadPhotos(travellerId: string, groupId: string, files: UploadFile[], body: unknown): Promise<Photo[]> {
  const group = await openGallery(travellerId, groupId);
  const checked = checkFiles(files ?? [], await groupPhotosHelper.countByGroup(group.group_id));
  const captions = parseCaptions((body as { captions?: unknown } | null)?.captions, checked.length);

  const stored: string[] = [];
  try {
    const rows: Omit<PhotoRow, 'uploader_name' | 'created_at'>[] = [];
    for (const [i, { file, mime, size }] of checked.entries()) {
      const photoId: string = await groupPhotosHelper.nextPhotoId();
      const key = objectKey(group.group_id, photoId, mime);
      await photoStorage.put(key, file.buffer, mime);
      stored.push(key);
      rows.push({
        photo_id: photoId, group_id: group.group_id, uploader_id: travellerId, object_key: key, mime_type: mime,
        size_bytes: file.size, width: size?.width ?? null, height: size?.height ?? null, caption: captions[i],
      });
    }
    await inTransaction(async (trx) => { await groupPhotosHelper.insertMany(rows, trx); });
  } catch (error) {
    await Promise.allSettled(stored.map((key) => photoStorage.remove(key)));
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'Photo storage is unavailable right now. Please try again.', undefined);
  }
  const saved: PhotoRow[] = await groupPhotosHelper.listByGroup(group.group_id);
  const ids = new Set(stored.map((key) => key.split('/').pop()!.split('.')[0]));
  return Promise.all(saved.filter((r) => ids.has(r.photo_id)).map((row) => toPhotoDto(row, group, travellerId)));
}

/** Uploader or organiser. The row goes first (so the photo disappears at once), then the file. */
async function deletePhoto(travellerId: string, groupId: string, photoId: string): Promise<{ deleted: string }> {
  const group = await openGallery(travellerId, groupId);
  const row: PhotoRow | undefined = await groupPhotosHelper.findInGroup(group.group_id, String(photoId).trim().toUpperCase());
  if (!row) throw HttpError.notFound('Photo not found');
  if (!canDelete(group.owner_id, row, travellerId)) throw HttpError.forbidden('Only the person who uploaded this photo or the organiser can delete it');
  await groupPhotosHelper.remove(row.photo_id);
  try { await photoStorage.remove(row.object_key); } catch (error) { console.error('Photo file left in storage:', row.object_key, error); }
  return { deleted: row.photo_id };
}

// Exported as one object (not ES named exports) so unit tests can mock.method() it.
const groupPhotosService = {
  MAX_FILE_BYTES, MAX_FILES_PER_UPLOAD, MAX_PHOTOS_PER_GROUP, MAX_CAPTION,
  detectImageType, imageSize, objectKey, canDelete, parseCaptions, checkFiles,
  listPhotos, getPhoto, uploadPhotos, deletePhoto,
};
export = groupPhotosService;
