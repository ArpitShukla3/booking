export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Row returned by groupPhotos.helper (joined with the uploader's name). */
export interface PhotoRow {
  photo_id: string; group_id: string; uploader_id: string; uploader_name: string; object_key: string;
  mime_type: PhotoMime; size_bytes: number; width: number | null; height: number | null;
  caption: string | null; created_at: string | Date;
}

/** One uploaded file as multer hands it over (memory storage). */
export interface UploadFile { originalname: string; mimetype: string; size: number; buffer: Buffer }

export interface Photo {
  photo_id: string; group_id: string; caption: string | null; created_at: string | Date;
  mime_type: PhotoMime; size_bytes: number; width: number | null; height: number | null;
  uploader: { traveller_id: string; name: string; is_owner: boolean };
  /** Presigned link to the image, valid until `url_expires_at`. */
  url: string; url_expires_at: string;
  can_delete: boolean;
}

export interface Gallery {
  group: { group_id: string; name: string; city: string; country_name: string; check_in: string; check_out: string; trip_finished: boolean };
  photos: Photo[];
  limits: { max_file_bytes: number; max_files_per_upload: number; max_photos_per_group: number; remaining: number };
}

export interface PhotoDetails extends Photo {
  group: Gallery['group'];
  position: number; total: number;
  prev_photo_id: string | null; next_photo_id: string | null;
}
