# TASK-X4: Group trip photo gallery (S3 / MinIO storage)

| Field | Value |
|---|---|
| Deliverable | Extra, user-requested ("Group photo gallery after the trip, shared with members only") |
| Track | **B: Group / Owner** |
| Priority | P2 |
| Depends on | M5 (members), M6 (booking: the gallery opens once the group has booked its hotel) |
| Status | **Implemented 2026-11-13.** Backend verified (244 unit + 88 integration incl. real MinIO uploads). Tick the criteria after Playwright `photos.spec.ts` passes. |

## Goal
Members of a booked group share trip photos in a private gallery with two new pages: the gallery grid with
uploads, and a page per photo. Image files are stored in **S3-compatible object storage (MinIO locally)**; PostgreSQL
keeps only their metadata.

## Why MinIO / S3
- MinIO is an object-storage server that speaks the Amazon S3 API. It is **not** related to PostgreSQL; the two work side
  by side (Postgres = metadata, MinIO = files).
- The backend uses the official AWS SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`), so moving to real AWS
  S3 (or another S3-compatible service) only changes environment variables.
- Image: `bitnamilegacy/minio:2025.4.22` (MinIO RELEASE.2025-04-22). The official `minio/minio` and `quay.io/minio/minio`
  images can no longer be pulled. This legacy build gets no further updates: fine for local development, not production.

## Pages (new routes, members only, `RequireTraveller`)
| Route | Page | What it shows |
|---|---|---|
| `/groups/:groupId/photos` | `GroupPhotosPage.tsx` | Header ("Trip photos", or "Trip memories" after check-out), uploader (button or drag and drop, previews, a caption per photo, progress bar, readable errors), photo grid (newest first), empty state |
| `/groups/:groupId/photos/:photoId` | `PhotoDetailPage.tsx` | Large photo, caption, uploader (+ Organiser tag), date, size and dimensions, "Photo N of M", previous/next (buttons and ← →), open full size, delete with confirmation |

Entry point: **Trip photos** button on the group page (disabled with a reason until the hotel is booked).
Not open yet → "The photo gallery isn’t open yet"; non-member → "Members only"; unknown → "Not found".

## Rules
- Access: group exists (404) → caller is a member (403; removed/left members lose access) → group has a booking (409).
- Upload: up to 10 files per upload, 5 MB each, 200 photos per group. Type is checked from the **file's bytes**
  (JPEG / PNG / WebP), never the name or browser type. Width/height read from the header when possible.
  Captions optional, ≤ 300 chars, one per file.
- All files are validated first, then stored in the bucket, then all rows are inserted in **one transaction**. If the insert
  fails, the stored objects are deleted again (503).
- Object keys: `groups/<group_id>/<photo_id>.<ext>`; photo IDs `P-1001…` (reserved from the sequence before storing).
- Viewing: the bucket is private. The API returns **presigned GET links** (default 1 hour, `S3_LINK_TTL_SECONDS`) so
  `<img src>` works without the `X-Traveller-Id` header. The gallery page fetches fresh links a minute before they expire.
- Delete: the uploader or the organiser (403 otherwise). The row is removed first, then the object (a failed object
  delete is logged; the photo is already gone for users).

## API (mounted at `/api/groups/:groupId/photos`, all 🔒)
| Method | Path | Result |
|---|---|---|
| GET | `/` | `{ group, photos[], limits }`; each photo has `url`, `url_expires_at`, `can_delete` |
| POST | `/` | multipart: `photos` (files), `captions` (JSON array) → 201 created photos |
| GET | `/:photoId` | photo + `group`, `position`, `total`, `prev_photo_id`, `next_photo_id` |
| DELETE | `/:photoId` | `{ deleted }` |

Errors: 400 with `fields.photos` / `fields.captions` (multer limits are turned into the same shape), 401, 403, 404,
409 (no booking), 503 (storage unavailable).

## Data
- Migration `20261113000014_create_group_photos.js`: `group_photos` (`photo_id` PK `P-…` from `group_photo_id_seq`,
  `group_id` FK cascade, `uploader_id` FK, `object_key` unique, `mime_type` CHECK, `size_bytes` ≤ 5 MB CHECK, `width`,
  `height`, `caption` ≤ 300 CHECK, `created_at`), index (`group_id`, `created_at`).
- Bucket `group-photos` (tests: `group-photos-test`), created by docker-compose (`MINIO_DEFAULT_BUCKETS`) or on first use.

## Setup
```
cd backend && npm install && npm run db:up      # starts Postgres + MinIO
npm run migrate
```
MinIO console: http://localhost:9001 (user `booking`, password `booking-secret` by default). Settings in
`backend/.env.example` (`S3_*`). `S3_PUBLIC_ENDPOINT` is the address browsers use for photo links.

## Files
| Layer | File |
|---|---|
| Docker | `backend/docker-compose.yml` (`minio` service, `miniodata` volume) |
| Config | `backend/src/config.js` (`s3`), `backend/.env.example` |
| Migration | `backend/migrations/20261113000014_create_group_photos.js` |
| Storage helper (only S3 code) | `backend/src/helpers/storage/photos.helper.js` |
| SQL helper | `backend/src/helpers/postgres/groupPhotos.helper.js` |
| Service / controller / route | `backend/src/services/groupPhotos.service.ts`, `controllers/groupPhotos.controller.ts`, `routes/groupPhotos.routes.js` (multer, memory storage) |
| Types | `backend/src/types/groupPhotos.ts`, `frontend/src/types/photo.ts` |
| Frontend | `src/services/photoService.ts`, `src/features/photos/{GroupPhotosPage,PhotoDetailPage}.tsx`, `photoLogic.ts`, `photos.css`; `GroupPage.tsx` (button), `App.tsx` (routes) |
| Dependencies | backend: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer`, dev `@types/multer` |

## Acceptance criteria
- [ ] Before booking the button is disabled and the API answers 409; after booking members open the gallery.
- [ ] A member uploads photos with captions; files land in the bucket under `groups/<group>/…`, rows in `group_photos`.
- [ ] Other members see the photos via presigned links; a tampered link is refused.
- [ ] Photo page shows details and previous/next; delete works for the uploader and the organiser only and removes the file.
- [ ] Non-images, oversized files and too many files are rejected with readable messages; nothing is stored.
- [ ] Non-members (including removed/left members) get 403 / "Members only".

## Tests
- Backend unit: `tests/unit/services/groupPhotos.service.test.js` (type sniffing, image size, keys, captions, limits,
  access gate, upload transaction + cleanup on failure, delete rules), `tests/unit/controllers/groupPhotos.controller.test.js`.
- Backend integration (needs MinIO): `tests/integration/groupPhotos.api.test.js`.
- Frontend: `src/features/photos/photoLogic.test.ts`, Playwright `tests/photos.spec.ts`.

## Out of scope / next steps
- Thumbnails and stripping EXIF/GPS data (add `sharp`), albums, likes/comments, editing captions, bulk download.
- Direct browser-to-MinIO uploads with presigned PUT (needs bucket CORS); a cleanup job for orphaned objects.
- Backups now include the MinIO volume (`booking_miniodata`) as well as Postgres.
