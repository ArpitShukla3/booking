/** Pure helpers for the X4 photo gallery (the backend re-checks every rule). */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(',');
export const MAX_CAPTION = 300;

export interface Limits { max_file_bytes: number; max_files_per_upload: number; remaining: number }

/** Splits picked files into accepted ones and readable reasons for the rejected ones. */
export function checkPicked(files: Pick<File, 'name' | 'type' | 'size'>[], alreadySelected: number, limits: Limits) {
  const accepted: number[] = [];
  const problems: string[] = [];
  const room = Math.min(limits.max_files_per_upload - alreadySelected, limits.remaining - alreadySelected);
  files.forEach((file, i) => {
    if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) problems.push(`"${file.name}" is not a JPEG, PNG or WebP image.`);
    else if (file.size > limits.max_file_bytes) problems.push(`"${file.name}" is larger than ${formatBytes(limits.max_file_bytes)}.`);
    else if (accepted.length >= room) problems.push(`"${file.name}" was skipped: ${limits.remaining <= alreadySelected ? 'the group’s photo limit is reached' : `upload at most ${limits.max_files_per_upload} at a time`}.`);
    else accepted.push(i);
  });
  return { accepted, problems };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

/** Milliseconds until links should be refreshed (1 minute before they expire), never negative. */
export function refreshDelay(expiresAtIso: string | undefined, now = Date.now()): number | null {
  if (!expiresAtIso) return null;
  return Math.max(0, new Date(expiresAtIso).getTime() - now - 60_000);
}

/** CSS aspect ratio for a photo tile (falls back to 4/3 when the size is unknown). */
export const aspectRatio = (w: number | null, h: number | null) => (w && h ? `${w} / ${h}` : '4 / 3');
