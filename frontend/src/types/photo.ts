/** X4 group photo gallery DTOs as returned by the backend. */
export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface Photo {
  photo_id: string;
  group_id: string;
  caption: string | null;
  created_at: string;
  mime_type: PhotoMime;
  size_bytes: number;
  width: number | null;
  height: number | null;
  uploader: { traveller_id: string; name: string; is_owner: boolean };
  /** Presigned link (private bucket); valid until url_expires_at. */
  url: string;
  url_expires_at: string;
  can_delete: boolean;
}

export interface GallerySummary {
  group_id: string;
  name: string;
  city: string;
  country_name: string;
  check_in: string;
  check_out: string;
  trip_finished: boolean;
}

export interface Gallery {
  group: GallerySummary;
  photos: Photo[];
  limits: { max_file_bytes: number; max_files_per_upload: number; max_photos_per_group: number; remaining: number };
}

export interface PhotoDetails extends Photo {
  group: GallerySummary;
  position: number;
  total: number;
  prev_photo_id: string | null;
  next_photo_id: string | null;
}
