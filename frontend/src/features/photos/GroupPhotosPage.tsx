import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronRight, ImagePlus, Images, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageContainer } from '@/components/shared/common';
import { ApiError } from '@/lib/api';
import { dateLabel, tripDates } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { photoService } from '@/services/photoService';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { Gallery, Photo } from '@/types/photo';
import { stagger } from '@/features/groups/media';
import { ACCEPT_ATTR, aspectRatio, checkPicked, formatBytes, MAX_CAPTION, refreshDelay } from './photoLogic';
import '@/features/groups/groups.css';
import './photos.css';

interface Picked { id: string; file: File; preview: string; caption: string }

/** Pick files (button or drag and drop), add captions, upload with progress. */
function Uploader({ gallery, onUploaded }: { gallery: Gallery; onUploaded: (photos: Photo[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const limits = gallery.limits;

  // Release preview URLs when they are no longer shown.
  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.preview)), [picked]);

  function add(files: File[]) {
    const { accepted, problems: issues } = checkPicked(files, picked.length, limits);
    setProblems(issues);
    setError('');
    setPicked((all) => [...all, ...accepted.map((i) => ({ id: `${Date.now()}-${i}-${files[i].name}`, file: files[i], preview: URL.createObjectURL(files[i]), caption: '' }))]);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    add(Array.from(e.dataTransfer.files));
  }

  async function upload() {
    if (!picked.length || progress !== null || !useTravellerStore.getState().ensureValidSession()) return;
    setError('');
    setProgress(0);
    try {
      const created = await photoService.uploadPhotos(gallery.group.group_id, picked.map((p) => p.file), picked.map((p) => p.caption), setProgress);
      onUploaded(created);
      setPicked([]);
      setProblems([]);
    } catch (err) {
      setError(err instanceof ApiError && err.fields.photos ? err.fields.photos : err instanceof ApiError && err.fields.captions ? err.fields.captions : err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setProgress(null);
    }
  }

  if (limits.remaining <= 0) {
    return <p className="ph-full" role="note">This group has reached its limit of {limits.max_photos_per_group} photos. Delete some to add more.</p>;
  }

  return (
    <section className="card ph-uploader gp-rise" aria-labelledby="upload-h">
      <h2 id="upload-h"><ImagePlus size={18} aria-hidden="true" />Add photos</h2>
      <div className={`ph-drop ${dragging ? 'is-dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <Camera size={26} aria-hidden="true" />
        <p><b>Drag photos here</b> or</p>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={progress !== null}>Choose photos</Button>
        <small>JPEG, PNG or WebP · up to {formatBytes(limits.max_file_bytes)} each · {limits.max_files_per_upload} at a time · {limits.remaining} more allowed in this group</small>
        <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple hidden aria-label="Choose photos to upload"
          onChange={(e) => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </div>

      {problems.length ? <ul className="ph-problems" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul> : null}

      {picked.length ? (
        <>
          <ul className="ph-picked" aria-label="Photos ready to upload">
            {picked.map((p, i) => (
              <li key={p.id}>
                <img src={p.preview} alt={`Preview of ${p.file.name}`} />
                <div className="ph-picked-body">
                  <span className="ph-picked-name" title={p.file.name}>{p.file.name} · {formatBytes(p.file.size)}</span>
                  <label className="sr-only" htmlFor={`caption-${p.id}`}>Caption for {p.file.name}</label>
                  <input id={`caption-${p.id}`} className="ph-caption-input" placeholder="Add a caption (optional)" maxLength={MAX_CAPTION} value={p.caption} disabled={progress !== null}
                    onChange={(e) => setPicked((all) => all.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
                </div>
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${p.file.name}`} disabled={progress !== null}
                  onClick={() => setPicked((all) => all.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></Button>
              </li>
            ))}
          </ul>
          {progress !== null ? (
            <div className="ph-progress" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <span style={{ width: `${progress}%` }} />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={upload} disabled={progress !== null}>
              {progress !== null ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
              {progress !== null ? `Uploading… ${progress}%` : `Upload ${picked.length} photo${picked.length === 1 ? '' : 's'}`}
            </Button>
            <Button variant="ghost" disabled={progress !== null} onClick={() => { setPicked([]); setProblems([]); }}>Clear</Button>
          </div>
        </>
      ) : null}
      {error ? <p role="alert" className="field-error mt-2">{error}</p> : null}
    </section>
  );
}

function PhotoTile({ photo, index }: { photo: Photo; index: number }) {
  return (
    <li className="ph-tile gp-rise" style={stagger(index)}>
      <Link to={`/groups/${photo.group_id}/photos/${photo.photo_id}`} aria-label={`Open photo ${photo.photo_id}${photo.caption ? `: ${photo.caption}` : ''} by ${photo.uploader.name}`}>
        <img src={photo.url} alt={photo.caption ?? `Trip photo by ${photo.uploader.name}`} loading="lazy" style={{ aspectRatio: aspectRatio(photo.width, photo.height) }} />
        <span className="ph-tile-meta">
          <b>{photo.uploader.name.split(' ')[0]}</b> · {dateLabel(photo.created_at.slice(0, 10))}
          {photo.caption ? <span className="ph-tile-caption">{photo.caption}</span> : null}
        </span>
      </Link>
    </li>
  );
}

function GalleryView({ initial }: { initial: Gallery }) {
  const [gallery, setGallery] = useState(initial);
  const [notice, setNotice] = useState('');
  const groupId = gallery.group.group_id;

  // Signed links expire: quietly fetch fresh ones a minute before.
  useEffect(() => {
    const delay = refreshDelay(gallery.photos[0]?.url_expires_at);
    if (delay === null) return;
    const timer = window.setTimeout(() => { void photoService.listPhotos(groupId).then(setGallery, () => undefined); }, delay);
    return () => window.clearTimeout(timer);
  }, [gallery, groupId]);

  const { group, photos } = gallery;
  return (
    <>
      <header className="card ph-header gp-rise">
        <span className="ph-header-icon" aria-hidden="true"><Images size={22} /></span>
        <div className="min-w-0">
          <h1>{group.trip_finished ? 'Trip memories' : 'Trip photos'} · {group.name}</h1>
          <p>{group.city}, {group.country_name} · {tripDates(group.check_in, group.check_out)} · {photos.length} photo{photos.length === 1 ? '' : 's'}</p>
          <p className="ph-private">Only members of this group can see these photos.</p>
        </div>
      </header>

      <Uploader gallery={gallery} onUploaded={(created) => {
        setGallery((g) => ({ ...g, photos: [...created, ...g.photos], limits: { ...g.limits, remaining: Math.max(0, g.limits.remaining - created.length) } }));
        setNotice(`${created.length} photo${created.length === 1 ? '' : 's'} added.`);
      }} />
      {notice ? <p className="gp-created mt-3" role="status">{notice}</p> : null}

      <section className="ph-grid-wrap" aria-labelledby="photos-h">
        <h2 id="photos-h" className="sr-only">Photos</h2>
        {photos.length ? (
          <ul className="ph-grid">{photos.map((p, i) => <PhotoTile key={p.photo_id} photo={p} index={i} />)}</ul>
        ) : (
          <div className="gp-open-seat ph-empty">
            <Camera size={26} aria-hidden="true" />
            <strong>No photos yet</strong>
            <span className="text-sm">Be the first to share a moment from {group.city}.</span>
          </div>
        )}
      </section>
    </>
  );
}

/** Shared states for both gallery pages (not open yet, members only, not found). */
export function GalleryStates({ error, retry, groupId }: { error: unknown; retry: () => void; groupId: string }) {
  const status = error instanceof ApiError ? error.status : 0;
  const back = <Link className="text-link" to={`/groups/${groupId}`}>Back to the group</Link>;
  if (status === 409) return <EmptyState title="The photo gallery isn’t open yet" action={back}><p>{(error as Error).message}. Finalise a hotel together on the group page first.</p></EmptyState>;
  if (status === 403) return <EmptyState title="Members only" action={back}><p>{(error as Error).message}.</p></EmptyState>;
  if (status === 404) return <EmptyState title="Not found" action={<Link className="text-link" to="/my-groups">Back to my groups</Link>}><p>{(error as Error).message}.</p></EmptyState>;
  return <ErrorState error={error} retry={retry} />;
}

export default function GroupPhotosPage() {
  const { groupId = '' } = useParams();
  const me = useTravellerStore((s) => s.travellerId);
  const query = useAsync(() => photoService.listPhotos(groupId), `photos:${groupId}:${me ?? '-'}`);
  return (
    <PageContainer className="gp-page ph-page">
      <nav className="gp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/my-groups">My groups</Link><ChevronRight size={12} aria-hidden="true" />
        <Link to={`/groups/${groupId}`}>{query.data?.group.name ?? groupId}</Link><ChevronRight size={12} aria-hidden="true" />
        <span>Photos</span>
      </nav>
      <Link to={`/groups/${groupId}`} className="text-link ph-back"><ArrowLeft size={14} aria-hidden="true" />Back to the group</Link>
      {query.loading ? <div className="ph-grid" role="status" aria-label="Loading photos">{[0, 1, 2, 3].map((i) => <div key={i} className="gp-skel" style={{ height: 180 }} />)}</div>
        : query.error || !query.data ? <GalleryStates error={query.error} retry={query.retry} groupId={groupId} />
        : <GalleryView key={query.data.group.group_id} initial={query.data} />}
    </PageContainer>
  );
}
