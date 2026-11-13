import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BellRing, Check, CheckCircle2, Clock3, Heart, Loader2, MapPin, LogOut, MessageSquareQuote, ShieldCheck, Sparkles, Undo2, UserMinus, UserRound, UsersRound, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { Dialog } from '@/components/ui/dialog';
import { InterestTags } from '@/components/shared/common';
import { useAsync } from '@/lib/useAsync';
import { joinRequestService } from '@/services/joinRequestService';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { GroupDetails } from '@/types/group';
import type { IncomingJoinRequest, JoinRequestStatus, OwnerJoinRequest } from '@/types/joinRequest';
import type { Traveller } from '@/types/traveller';
import type { ProfileLinkState } from '@/features/profile/TravellerProfilePage';
import { MAX_REQUEST_MESSAGE, requestStatusLabel, seekerAction, timeAgo } from './joinRequests';
import { stagger } from './media';

const STATUS_ICON = { PENDING: Clock3, APPROVED: CheckCircle2, REJECTED: XCircle, REMOVED: UserMinus, CANCELLED: Undo2, LEFT: LogOut, CLOSED: UsersRound } as const;

export function RequestStatusPill({ status }: { status: JoinRequestStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`gp-status gp-status--${status.toLowerCase()}`}>
      <Icon size={13} aria-hidden="true" />{requestStatusLabel(status)}
    </span>
  );
}

const genderLabel = (t: Pick<Traveller, 'gender'>) => (t.gender === 'FEMALE' ? 'Female' : 'Male');
const prefLabel = (t: Pick<Traveller, 'gender_preference'>) => (t.gender_preference === 'SAME_GENDER' ? 'Prefers same-gender groups' : 'Happy with any group');

/* ---------- seeker: "Interested" in the details sidebar ---------- */

/** The seeker's optional note, shown quoted to the organiser. */
export function RequestNote({ message, compact = false }: { message: string | null; compact?: boolean }) {
  if (!message) return null;
  return (
    <blockquote className={`gp-note ${compact ? 'is-compact' : ''}`}>
      <MessageSquareQuote size={14} aria-hidden="true" />
      <span><span className="sr-only">Note: </span>{message}</span>
    </blockquote>
  );
}

export function InterestPanel({ group }: { group: GroupDetails }) {
  const me = useTravellerStore((s) => s.travellerId);
  const inGroup = !!me && group.member_ids.includes(me);
  const mine = useAsync(() => (me && !inGroup ? joinRequestService.listMine() : Promise.resolve([])), `my-requests:${me ?? '-'}:${group.group_id}:${inGroup}`);
  const [local, setLocal] = useState<{ request_id: string; status: JoinRequestStatus } | null>(null);
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sentNow, setSentNow] = useState(false);
  const fromServer = mine.data?.find((r) => r.group_id === group.group_id);
  const existing = local ?? fromServer;
  const action = seekerAction(group, me, existing);

  async function send() {
    if (!useTravellerStore.getState().ensureValidSession()) return;
    setPending(true);
    setError('');
    try {
      const created = await joinRequestService.sendInterest(group.group_id, note);
      setLocal({ request_id: created.request_id, status: 'PENDING' });
      setComposing(false);
      setNote('');
      setSentNow(true);
    } catch (err) {
      setError(err instanceof ApiError && err.fields.message ? err.fields.message : err instanceof Error ? err.message : 'Could not send your request. Please try again.');
      mine.retry(); // the server state may have changed (e.g. the group filled up)
    } finally {
      setPending(false);
    }
  }

  async function cancelRequest() {
    if (!existing || !('request_id' in existing) || !useTravellerStore.getState().ensureValidSession()) return;
    setPending(true);
    setError('');
    try {
      await joinRequestService.cancel(existing.request_id);
      setLocal({ request_id: existing.request_id, status: 'CANCELLED' });
      setSentNow(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel your request. Please try again.');
      mine.retry();
    } finally {
      setPending(false);
    }
  }

  if (action.kind === 'OWNER') return null;
  return (
    <div className={`gp-interest is-${action.kind.toLowerCase()}`}>
      {action.kind === 'SIGN_IN' ? (
        <Button asChild size="lg"><Link to="/login"><Heart size={16} aria-hidden="true" />{action.label}</Link></Button>
      ) : (
        <Button size="lg" onClick={() => { setError(''); setComposing(true); }} disabled={action.disabled || pending || (mine.loading && !local)} aria-describedby="interest-reason">
          {action.kind === 'PENDING' ? <Clock3 size={16} aria-hidden="true" />
            : action.kind === 'MEMBER' ? <CheckCircle2 size={16} aria-hidden="true" />
            : action.kind === 'REJECTED' ? <XCircle size={16} aria-hidden="true" />
            : action.kind === 'REMOVED' ? <UserMinus size={16} aria-hidden="true" />
            : <Heart size={16} aria-hidden="true" />}
          {action.label}
        </Button>
      )}
      <p id="interest-reason" className="field-hint" role={sentNow ? 'status' : undefined}>
        {sentNow && action.kind === 'PENDING' ? <><b>Request sent!</b> {action.reason}</> : action.reason}
      </p>
      {action.kind === 'PENDING' ? (
        <>
          <RequestNote message={fromServer?.status === 'PENDING' ? fromServer.message : null} compact />
          <Button variant="outline" size="sm" disabled={pending} onClick={cancelRequest}>
            {pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Undo2 size={14} aria-hidden="true" />}Cancel request
          </Button>
        </>
      ) : null}
      {error ? <p role="alert" className="field-error">{error}</p> : null}
      {mine.error ? <p role="alert" className="field-error">Couldn’t check your request status. <button type="button" className="text-link" onClick={mine.retry}>Retry</button></p> : null}

      <Dialog open={composing} onOpenChange={(open) => { if (!open && !pending) setComposing(false); }}
        title={`Ask to join ${group.name}`}
        description={`${group.owner.name} will see your profile and can approve or decline. A short note helps them decide.`}>
        <label className="gp-note-label" htmlFor="request-note">Note to the organiser <span className="text-muted-foreground">(optional)</span></label>
        <textarea id="request-note" className="gp-note-input" rows={3} maxLength={MAX_REQUEST_MESSAGE} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Hi! I love temples and street food too, and I’m flexible on dates." />
        <small className="text-muted-foreground">{note.length}/{MAX_REQUEST_MESSAGE}</small>
        {error ? <p role="alert" className="field-error mt-2">{error}</p> : null}
        <div className="flex flex-wrap gap-3 mt-4">
          <Button variant="outline" disabled={pending} onClick={() => setComposing(false)}>Cancel</Button>
          <Button disabled={pending} onClick={send}>
            {pending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Heart size={14} aria-hidden="true" />}Send request
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/* ---------- owner: join requests on their group page ---------- */

function SeekerCard({ request, index, spotsLeft, busy, groupName, onApprove, onReject }: {
  request: OwnerJoinRequest; index: number; spotsLeft: number; busy: boolean; groupName: string;
  onApprove: () => void; onReject: () => void;
}) {
  const { seeker } = request;
  const isPending = request.status === 'PENDING';
  return (
    <article className={`gp-request gp-rise ${isPending ? 'is-pending' : ''}`} style={stagger(index)} aria-label={`Join request from ${seeker.name}`}>
      <div className="gp-member-head">
        <span className="avatar">{seeker.name.charAt(0)}</span>
        <div>
          <h3>{seeker.name}</h3>
          <p>{seeker.age ?? '–'} years · {genderLabel(seeker)} · {timeAgo(request.created_at)}</p>
        </div>
        <span className="ml-auto"><RequestStatusPill status={request.status} /></span>
      </div>
      <Link className="text-link gp-view-profile" to={`/travellers/${seeker.traveller_id}`}
        state={{ from: `/groups/${request.group_id}#join-requests`, fromLabel: groupName } satisfies ProfileLinkState}
        aria-label={`View ${seeker.name}’s profile, reviews and rating`}>
        <UserRound size={14} aria-hidden="true" />View profile
      </Link>
      <div className="gp-request-meta">
        <span><MapPin size={14} aria-hidden="true" />{seeker.home_city}</span>
        <span><ShieldCheck size={14} aria-hidden="true" />{prefLabel(seeker)}</span>
        {request.shared_interests.length ? (
          <span className="gp-shared"><Sparkles size={14} aria-hidden="true" />{request.shared_interests.length} shared interest{request.shared_interests.length === 1 ? '' : 's'}</span>
        ) : null}
      </div>
      <RequestNote message={request.message} />
      {seeker.interests.length ? <InterestTags values={seeker.interests} highlight={request.shared_interests} /> : <p className="text-muted-foreground text-sm">No interests listed</p>}
      {isPending ? (
        <div className="gp-request-actions">
          <Button size="sm" onClick={onApprove} disabled={busy || spotsLeft <= 0} title={spotsLeft <= 0 ? 'The group is full' : undefined}>
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}Approve
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} disabled={busy}><X size={14} aria-hidden="true" />Decline</Button>
          {spotsLeft <= 0 ? <span className="field-hint">Group is full: no spot left to approve.</span> : null}
        </div>
      ) : null}
    </article>
  );
}

export function OwnerRequestsSection({ group, onMembersChanged }: { group: GroupDetails; onMembersChanged: () => Promise<void> }) {
  const { hash } = useLocation();
  const query = useAsync(() => joinRequestService.listForGroup(group.group_id), `group-requests:${group.group_id}`);
  const [decided, setDecided] = useState<Record<string, JoinRequestStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmReject, setConfirmReject] = useState<OwnerJoinRequest | null>(null);
  const requests = (query.data ?? []).map((r) => (decided[r.request_id] ? { ...r, status: decided[r.request_id] } : r));
  const pending = requests.filter((r) => r.status === 'PENDING');
  const past = requests.filter((r) => r.status !== 'PENDING');

  useEffect(() => {
    if (hash === '#join-requests' && !query.loading) document.getElementById('join-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, query.loading]);

  async function decide(request: OwnerJoinRequest, action: 'approve' | 'reject') {
    if (!useTravellerStore.getState().ensureValidSession()) return;
    setBusy(request.request_id);
    setMessage(null);
    try {
      const result = await joinRequestService[action](request.request_id);
      const closed = result.closed_request_ids ?? [];
      setDecided((d) => ({ ...d, [request.request_id]: result.status, ...Object.fromEntries(closed.map((id) => [id, 'CLOSED' as const])) }));
      setMessage({
        kind: 'ok',
        text: action === 'reject' ? `You declined ${request.seeker.name}’s request.`
          : closed.length ? `${request.seeker.name} joined your group. The group is now full, so ${closed.length} other pending request${closed.length === 1 ? ' was' : 's were'} closed.`
          : `${request.seeker.name} joined your group.`,
      });
      if (action === 'approve') await onMembersChanged();
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save your decision. Please try again.' });
      query.retry();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="join-requests" className="card gp-section gp-rise" style={stagger(3)} aria-labelledby="requests-h">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 id="requests-h" style={{ margin: 0 }} className="flex items-center gap-2">
          <BellRing size={18} aria-hidden="true" />Join requests
        </h2>
        <span className={`gp-badge ${pending.length ? 'has-pending' : ''}`} aria-label={`${pending.length} pending join requests`}>
          Pending <b>{pending.length}</b>
        </span>
      </div>
      {message ? <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'field-error mb-3' : 'gp-created mb-3'}>{message.kind === 'ok' ? <CheckCircle2 size={18} aria-hidden="true" /> : null}{message.text}</p> : null}
      {query.loading ? <div className="gp-skel" style={{ height: 140 }} role="status" aria-label="Loading join requests" />
        : query.error ? <p role="alert" className="field-error">{query.error.message} <button type="button" className="text-link" onClick={query.retry}>Retry</button></p>
        : !requests.length ? (
          <div className="gp-open-seat" style={{ minHeight: 100 }}>
            <UsersRound size={22} aria-hidden="true" />
            <strong>No requests yet</strong>
            <span className="text-sm">Travellers who tap “Interested” on this trip will appear here.</span>
          </div>
        ) : (
          <>
            {pending.length ? (
              <div className="gp-requests">
                {pending.map((r, i) => (
                  <SeekerCard key={r.request_id} request={r} index={i} spotsLeft={group.spots_left} busy={busy === r.request_id} groupName={group.name}
                    onApprove={() => decide(r, 'approve')} onReject={() => setConfirmReject(r)} />
                ))}
              </div>
            ) : <p className="text-muted-foreground">No pending requests. You’re all caught up.</p>}
            {past.length ? (
              <details className="gp-past mt-4">
                <summary>Past decisions ({past.length})</summary>
                <div className="gp-requests mt-3">
                  {past.map((r, i) => <SeekerCard key={r.request_id} request={r} index={i} spotsLeft={group.spots_left} busy={false} groupName={group.name} onApprove={() => undefined} onReject={() => undefined} />)}
                </div>
              </details>
            ) : null}
          </>
        )}
      <Dialog open={!!confirmReject} onOpenChange={(open) => { if (!open) setConfirmReject(null); }}
        title={`Decline ${confirmReject?.seeker.name ?? 'this traveller'}?`}
        description="They will see that their request was declined and won’t be able to ask to join this group again.">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setConfirmReject(null)}>Keep pending</Button>
          <Button variant="destructive" onClick={() => { const r = confirmReject!; setConfirmReject(null); void decide(r, 'reject'); }}>Decline request</Button>
        </div>
      </Dialog>
    </section>
  );
}

/* ---------- owner: notifications on My groups ---------- */

export function IncomingRequestsPanel({ requests }: { requests: IncomingJoinRequest[] }) {
  if (!requests.length) return null;
  return (
    <section className="card gp-notify gp-rise" aria-labelledby="notify-h">
      <h2 id="notify-h"><BellRing size={18} aria-hidden="true" />{requests.length} traveller{requests.length === 1 ? ' wants' : 's want'} to join your trips</h2>
      <ul>
        {requests.map((r, i) => (
          <li key={r.request_id} className="gp-notify-item gp-rise" style={stagger(i)}>
            <span className="avatar">{r.seeker.name.charAt(0)}</span>
            <div className="min-w-0">
              <p><Link className="text-link" to={`/travellers/${r.seeker.traveller_id}`} state={{ from: '/my-groups', fromLabel: 'My groups' } satisfies ProfileLinkState}><b>{r.seeker.name}</b></Link> is interested in <Link className="text-link" to={`/groups/${r.group.group_id}#join-requests`}>{r.group.name}</Link></p>
              <small>
                {r.seeker.age ?? '–'} · {genderLabel(r.seeker)} · {r.seeker.home_city}
                {r.shared_interests.length ? ` · ${r.shared_interests.length} shared interest${r.shared_interests.length === 1 ? '' : 's'}` : ''} · {timeAgo(r.created_at)}
              </small>
              <RequestNote message={r.message} compact />
            </div>
            <Button asChild size="sm" variant="outline"><Link to={`/groups/${r.group.group_id}#join-requests`} aria-label={`Review ${r.seeker.name}’s request for ${r.group.name}`}>Review</Link></Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
