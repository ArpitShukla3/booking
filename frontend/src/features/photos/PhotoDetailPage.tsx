import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Crown, Download, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { PageContainer } from '@/components/shared/common';
import { useAsync } from '@/lib/useAsync';
import { photoService } from '@/services/photoService';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { PhotoDetails } from '@/types/photo';
import { GalleryStates } from './GroupPhotosPage';
import { formatBytes } from './photoLogic';
import '@/features/groups/groups.css';
import './photos.css';

function DetailView({ photo }: { photo: PhotoDetails }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const groupId = photo.group_id;
  const photoPath = (id: string) => `/groups/${groupId}/photos/${id}`;

  // ← / → move between photos (ignored while typing or when the dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirming || (e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === 'ArrowLeft' && photo.prev_photo_id) navigate(photoPath(photo.prev_photo_id));
      if (e.key === 'ArrowRight' && photo.next_photo_id) navigate(photoPath(photo.next_photo_id));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function remove() {
    if (!useTravellerStore.getState().ensureValidSession()) return;
    setDeleting(true);
    setError('');
    try {
      await photoService.deletePhoto(groupId, photo.photo_id);
      navigate(`/groups/${groupId}/photos`, { replace: true });
    } catch (err) {
      setConfirming(false);
      setError(err instanceof Error ? err.message : 'Could not delete the photo.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="ph-detail gp-rise">
      <figure className="ph-stage">
        <img src={photo.url} alt={photo.caption ?? `Trip photo by ${photo.uploader.name}`} />
        {photo.prev_photo_id ? (
          <Link className="ph-nav ph-nav--prev" to={photoPath(photo.prev_photo_id)} aria-label="Previous photo"><ChevronLeft size={28} aria-hidden="true" /></Link>
        ) : null}
        {photo.next_photo_id ? (
          <Link className="ph-nav ph-nav--next" to={photoPath(photo.next_photo_id)} aria-label="Next photo"><ChevronRight size={28} aria-hidden="true" /></Link>
        ) : null}
      </figure>

      <aside className="card ph-info">
        <p className="ph-count">Photo {photo.position} of {photo.total} · <span className="ph-id" title="Photo ID">{photo.photo_id}</span></p>
        {photo.caption ? <h1 className="ph-caption">{photo.caption}</h1> : <h1 className="ph-caption is-empty">No caption</h1>}
        <dl className="ph-facts">
          <div><dt>Shared by</dt><dd>{photo.uploader.name}{photo.uploader.is_owner ? <span className="ph-owner"><Crown size={11} aria-hidden="true" />Organiser</span> : null}</dd></div>
          <div><dt>Added</dt><dd><time dateTime={photo.created_at}>{new Date(photo.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</time></dd></div>
          <div><dt>Size</dt><dd>{photo.width && photo.height ? `${photo.width} × ${photo.height} · ` : ''}{formatBytes(photo.size_bytes)}</dd></div>
          <div><dt>Trip</dt><dd>{photo.group.name} · {photo.group.city}</dd></div>
        </dl>
        <div className="grid gap-2">
          <Button asChild variant="outline"><a href={photo.url} target="_blank" rel="noreferrer"><Download size={15} aria-hidden="true" />Open full size</a></Button>
          {photo.can_delete ? (
            <Button variant="outline" className="ph-delete" onClick={() => setConfirming(true)}><Trash2 size={15} aria-hidden="true" />Delete photo</Button>
          ) : null}
        </div>
        {error ? <p role="alert" className="field-error mt-2">{error}</p> : null}
        <p className="field-hint mt-3">Tip: use ← and → to move between photos.</p>
      </aside>

      <Dialog open={confirming} onOpenChange={(open) => { if (!open && !deleting) setConfirming(false); }}
        title="Delete this photo?" description="It will be removed for everyone in the group. This can’t be undone.">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={deleting} onClick={() => setConfirming(false)}>Keep photo</Button>
          <Button variant="destructive" disabled={deleting} onClick={() => { void remove(); }}>
            {deleting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}Delete photo
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export default function PhotoDetailPage() {
  const { groupId = '', photoId = '' } = useParams();
  const me = useTravellerStore((s) => s.travellerId);
  const query = useAsync(() => photoService.getPhoto(groupId, photoId), `photo:${groupId}:${photoId}:${me ?? '-'}`);
  return (
    <PageContainer className="gp-page ph-page">
      <nav className="gp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/my-groups">My groups</Link><ChevronRight size={12} aria-hidden="true" />
        <Link to={`/groups/${groupId}`}>{query.data?.group.name ?? groupId}</Link><ChevronRight size={12} aria-hidden="true" />
        <Link to={`/groups/${groupId}/photos`}>Photos</Link><ChevronRight size={12} aria-hidden="true" />
        <span>{photoId}</span>
      </nav>
      <Link to={`/groups/${groupId}/photos`} className="text-link ph-back"><ArrowLeft size={14} aria-hidden="true" />All photos</Link>
      {query.loading ? <div className="gp-skel" style={{ height: 480 }} role="status" aria-label="Loading photo" />
        : query.error || !query.data ? <GalleryStates error={query.error} retry={query.retry} groupId={groupId} />
        : <DetailView key={query.data.photo_id} photo={query.data} />}
    </PageContainer>
  );
}
