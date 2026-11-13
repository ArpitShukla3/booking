import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronRight, Copy, Crown, Hotel, Loader2, Lock, LogOut, MapPin, MessageCircle, Moon, UserMinus, UserPlus, UsersRound, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, InterestTags, PageContainer, Photo } from '@/components/shared/common';
import { ApiError } from '@/lib/api';
import { dateLabel, money, tripDates } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { groupService } from '@/services/groupService';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { GroupDetails } from '@/types/group';
import type { Traveller } from '@/types/traveller';
import { SeatBar, StagePill, TripProgress } from './parts';
import { hotelProgressOf, liveStage } from './tripFlow';
import { InterestPanel, OwnerRequestsSection } from './requestParts';
import { splitPreview } from './joinRequests';
import type { MembershipChange } from '@/types/group';
import { cityPhoto, stagger } from './media';
import { sizeLabel } from './schema';
import { GroupHotelsSection } from '@/features/hotels/GroupHotelsSection';
import { entryKey, selectEntry, useGroupHotelStore } from '@/store/useGroupHotelStore';
import './groups.css';

function MemberCard({ member, isOwner, isYou, index, onRemove }: { member: Traveller; isOwner: boolean; isYou: boolean; index: number; onRemove?: () => void }) {
  return (
    <article className="gp-member gp-rise" style={stagger(index)}>
      <div className="gp-member-head">
        <span className="avatar">{member.name.charAt(0)}</span>
        <div>
          <h3>{member.name}{isYou ? ' (you)' : ''}</h3>
          <p>{member.age ?? '–'} years · {member.gender === 'FEMALE' ? 'Female' : 'Male'}{isOwner ? ' · Organiser' : ''}</p>
        </div>
        {isOwner ? <Crown size={16} className="ml-auto text-[var(--search-yellow)]" aria-label="Group owner" /> : null}
      </div>
      <p className="icon-line" style={{ margin: 0 }}><MapPin size={14} aria-hidden="true" />{member.home_city}</p>
      {member.interests.length ? <InterestTags values={member.interests} /> : <p className="text-muted-foreground text-sm">No interests listed</p>}
      {onRemove ? (
        <Button size="sm" variant="outline" className="gp-member-remove" onClick={onRemove} aria-label={`Remove ${member.name} from the group`}>
          <UserMinus size={14} aria-hidden="true" />Remove
        </Button>
      ) : null}
    </article>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="outline" size="sm" onClick={() => {
      void navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }, () => undefined);
    }}>
      {copied ? <CheckCircle2 size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? 'Link copied' : 'Copy link'}
    </Button>
  );
}

function DetailsSkeleton() {
  return (
    <div role="status" aria-label="Loading group" style={{ display: 'grid', gap: 16 }}>
      <div className="gp-skel" style={{ height: 260 }} />
      <div className="gp-details" style={{ marginTop: 0 }}>
        <div className="gp-skel" style={{ height: 300 }} />
        <div className="gp-skel" style={{ height: 300 }} />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function GroupView({ group, created, reload }: { group: GroupDetails; created: boolean; reload: () => Promise<void> }) {
  const me = useTravellerStore((s) => s.travellerId);
  const photo = cityPhoto(group.city, 1600);
  const isOwner = me === group.owner.traveller_id;
  const isMember = !!me && group.member_ids.includes(me);
  // Shortlist/booking come from the hotel store (loaded by GroupHotelsSection for members).
  const hotels = useGroupHotelStore(selectEntry(me && isMember ? entryKey(me, group.group_id) : ''));
  // Before the hotel store has loaded, fall back to the backend's hotel_status (TASK-X2).
  const hotelProgress = hotels.fetchedAt
    ? { shortlisted: hotels.shortlist.length, bookedHotel: hotels.booking?.hotel.name ?? null }
    : hotelProgressOf(group);
  const stage = liveStage(group, hotelProgress);
  // Arriving with #hotels (e.g. "Back to the group's hotels") scrolls once the section exists.
  useEffect(() => {
    if (isMember && window.location.hash === '#hotels') document.getElementById('hotels')?.scrollIntoView({ block: 'start' });
  }, [isMember]);
  const [removing, setRemoving] = useState<Traveller | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [removeMessage, setRemoveMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // Bumped after a removal so the owner's request list reloads (the removed request shows as "Removed").
  const [removals, setRemovals] = useState(0);

  const [leaving, setLeaving] = useState(false);
  const [leavePending, setLeavePending] = useState(false);
  const removePreview = removing ? splitPreview(hotels.booking, group.members_count - 1) : null;

  /** " Hotel cost is now ₹X per person (was ₹Y)." when the booking was re-split. */
  const splitText = (change: MembershipChange) => (change.booking_update
    ? ` The hotel total stays ${money(change.booking_update.total_inr)}; it is now ${money(change.booking_update.per_member_after)} per person (was ${money(change.booking_update.per_member_before)}).`
    : '');

  async function leaveGroup() {
    if (!useTravellerStore.getState().ensureValidSession()) return;
    setLeavePending(true);
    setRemoveMessage(null);
    try {
      const change = await groupService.leaveGroup(group.group_id);
      setLeaving(false);
      setRemoveMessage({ kind: 'ok', text: `You left ${group.name}.${splitText(change)} You can ask to join again if there is a spot.` });
      await reload();
    } catch (err) {
      setLeaving(false);
      setRemoveMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not leave the group. Please try again.' });
    } finally {
      setLeavePending(false);
    }
  }

  async function removeMember(member: Traveller) {
    if (!useTravellerStore.getState().ensureValidSession()) return;
    setRemovePending(true);
    setRemoveMessage(null);
    try {
      const change = await groupService.removeMember(group.group_id, member.traveller_id);
      setRemoving(null);
      setRemoveMessage({ kind: 'ok', text: `${member.name} was removed from the group.${splitText(change)}` });
      if (change.booking_update && me) void useGroupHotelStore.getState().load(me, group.group_id);
      setRemovals((n) => n + 1);
      await reload();
    } catch (err) {
      setRemoving(null);
      setRemoveMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not remove this member. Please try again.' });
    } finally {
      setRemovePending(false);
    }
  }
  return (
    <>
      {created ? (
        <div className="gp-created" role="status">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div><strong>Your group is live!</strong> Travellers searching {group.city} for these dates can now find it.</div>
        </div>
      ) : null}

      <div className="gp-hero gp-rise" style={{ minHeight: 280 }}>
        <Photo src={photo.src} fallback={photo.fallback} alt={`${group.city}, ${group.country_name}`} loading="eager" />
        <div className="gp-hero-body">
          <div className="flex gap-2 flex-wrap mb-2"><StagePill stage={stage} />{isOwner ? <span className="gp-role"><Crown size={13} aria-hidden="true" />You organise this trip</span> : isMember ? <span className="gp-role is-member">You’re a member</span> : null}</div>
          <h1>{group.name}</h1>
          <p className="flex items-center gap-1"><MapPin size={15} aria-hidden="true" />{group.city}, {group.country_name} · {photo.caption}</p>
        </div>
      </div>

      <div className="gp-details">
        <div>
          <dl className="card gp-facts gp-rise" style={stagger(1)}>
            <div className="gp-fact"><dt><CalendarDays size={13} aria-hidden="true" />Check-in</dt><dd>{dateLabel(group.check_in)}</dd></div>
            <div className="gp-fact"><dt><CalendarDays size={13} aria-hidden="true" />Check-out</dt><dd>{dateLabel(group.check_out)}</dd></div>
            <div className="gp-fact"><dt><Moon size={13} aria-hidden="true" />Nights</dt><dd>{group.nights}</dd></div>
            <div className="gp-fact"><dt><Wallet size={13} aria-hidden="true" />Budget / person</dt><dd>{money(group.budget_inr)}</dd></div>
          </dl>

          <section className="card gp-section gp-rise" style={stagger(2)} aria-labelledby="itinerary-h">
            <h2 id="itinerary-h">Proposed itinerary</h2>
            {group.itinerary ? <p className="gp-itinerary">{group.itinerary}</p> : <p className="text-muted-foreground">The organiser hasn’t added an itinerary yet.</p>}
          </section>

          {isOwner ? <OwnerRequestsSection key={`requests-${removals}`} group={group} onMembersChanged={reload} /> : null}

          <section className="card gp-section gp-rise" style={stagger(3)} aria-labelledby="members-h">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h2 id="members-h" style={{ margin: 0 }}>Who’s going · {group.members_count}/{group.max_size}</h2>
              <SeatBar members={group.members_count} max={group.max_size} />
            </div>
            {removeMessage ? (
              <p role={removeMessage.kind === 'error' ? 'alert' : 'status'} className={removeMessage.kind === 'error' ? 'field-error mb-3' : 'gp-created mb-3'}>
                {removeMessage.kind === 'ok' ? <CheckCircle2 size={18} aria-hidden="true" /> : null}{removeMessage.text}
              </p>
            ) : null}
            <div className="gp-members">
              {group.members.map((m, i) => (
                <MemberCard key={m.traveller_id} member={m} index={i} isOwner={m.traveller_id === group.owner.traveller_id} isYou={m.traveller_id === me}
                  onRemove={isOwner && m.traveller_id !== group.owner.traveller_id ? () => setRemoving(m) : undefined} />
              ))}
              {Array.from({ length: group.spots_left }, (_, i) => (
                <div key={`open-${i}`} className="gp-open-seat gp-rise" style={stagger(group.members.length + i)}>
                  <UserPlus size={22} aria-hidden="true" />
                  <strong>Open spot</strong>
                  <span className="text-sm">Waiting for a travel buddy</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="gp-side">
          <div className="card gp-rise" style={stagger(2)}>
            <h2 style={{ fontSize: 18, marginBottom: 14 }}>Trip progress</h2>
            <TripProgress group={group} hotel={hotelProgress} />
          </div>
          <div className="card gp-rise" style={stagger(3)}>
            <div className="gp-price"><small>Approx budget per person</small><strong>{money(group.budget_inr)}</strong></div>
            <p className="icon-line"><UsersRound size={15} aria-hidden="true" />{sizeLabel(group.max_size)} · {group.spots_left ? `${group.spots_left} spot${group.spots_left === 1 ? '' : 's'} left` : 'Group is full'}</p>
            <p className="icon-line"><CalendarDays size={15} aria-hidden="true" />{tripDates(group.check_in, group.check_out)}</p>
            <p className="icon-line"><Crown size={15} aria-hidden="true" />Organised by {group.owner.name}</p>
            <InterestPanel group={group} />
            <div className="grid gap-2 mt-4">
              {isMember ? (
                <Button asChild>
                  <a href="#hotels" onClick={(e) => { e.preventDefault(); document.getElementById('hotels')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', '#hotels'); }}>
                    {hotels.booking ? <Lock size={16} aria-hidden="true" /> : <Hotel size={16} aria-hidden="true" />}
                    {hotels.booking ? 'View the booked hotel' : 'Search hotels together'}
                  </a>
                </Button>
              ) : (
                <Button disabled title="Only group members can search hotels"><Hotel size={16} aria-hidden="true" />Search hotels together</Button>
              )}
              {isMember ? (
                hotels.booking ? (
                  <Button asChild variant="outline" className="gp-chat-btn">
                    <Link to={`/groups/${group.group_id}/chat`}><MessageCircle size={16} aria-hidden="true" />Chat with team<span className="gp-chat-dot" aria-hidden="true" /></Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled title="The team chat opens once the group books its hotel">
                    <MessageCircle size={16} aria-hidden="true" />Chat with team<Lock size={13} aria-hidden="true" />
                  </Button>
                )
              ) : null}
              {isMember && !isOwner ? (
                <Button variant="ghost" className="gp-leave-btn" onClick={() => setLeaving(true)}><LogOut size={16} aria-hidden="true" />Leave group</Button>
              ) : null}
              <CopyLink />
            </div>
            <p className="field-hint mt-3">{isMember ? (hotels.booking ? 'Your hotel is booked. Plan the rest of the trip in the team chat.' : 'Members search, shortlist and finalise one hotel for the whole group. The team chat opens after booking.') : 'Hotel search and booking are for group members only.'}</p>
          </div>
        </aside>
      </div>

      {isMember ? <GroupHotelsSection group={group} /> : (
        <section className="card gp-section" aria-labelledby="hotels-locked-h">
          <h2 id="hotels-locked-h" className="flex items-center gap-2"><Lock size={18} aria-hidden="true" />Hotels are for members only</h2>
          <p className="text-muted-foreground">Once the organiser approves your request, you can search, compare and finalise a stay with the group here.</p>
        </section>
      )}

      <Dialog open={!!removing} onOpenChange={(open) => { if (!open && !removePending) setRemoving(null); }}
        title={`Remove ${removing?.name ?? 'this member'} from the group?`}
        description="Their spot opens up again. They will see that they were removed and won’t be able to ask to join this group again.">
        {removePreview ? (
          <p className="gp-split-warning" role="note">
            <Hotel size={16} aria-hidden="true" />
            <span>This group has already booked <b>{hotels.booking?.hotel.name}</b>. The total stays <b>{money(removePreview.total)}</b>, so each of the {removePreview.membersAfter} remaining members will pay <b>{money(removePreview.after)}</b> instead of {money(removePreview.before)}.</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={removePending} onClick={() => setRemoving(null)}>Keep member</Button>
          <Button variant="destructive" disabled={removePending} onClick={() => { if (removing) void removeMember(removing); }}>
            {removePending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <UserMinus size={14} aria-hidden="true" />}Remove member
          </Button>
        </div>
      </Dialog>

      <Dialog open={leaving} onOpenChange={(open) => { if (!open && !leavePending) setLeaving(false); }}
        title={`Leave ${group.name}?`}
        description="Your spot opens up for someone else and you lose access to the group’s hotels and team chat. You can ask to join again later if there is a spot.">
        {hotels.booking ? (
          <p className="gp-split-warning" role="note">
            <Hotel size={16} aria-hidden="true" />
            <span>The group has booked <b>{hotels.booking.hotel.name}</b>. The total stays <b>{money(hotels.booking.total_inr)}</b>, so the other {group.members_count - 1} member{group.members_count - 1 === 1 ? '' : 's'} will each pay <b>{money(splitPreview(hotels.booking, group.members_count - 1)!.after)}</b> instead of {money(hotels.booking.per_member_inr)}.</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={leavePending} onClick={() => setLeaving(false)}>Stay in the group</Button>
          <Button variant="destructive" disabled={leavePending} onClick={() => { void leaveGroup(); }}>
            {leavePending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <LogOut size={14} aria-hidden="true" />}Leave group
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export default function GroupPage() {
  const { groupId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [created] = useState(() => Boolean((location.state as { created?: boolean } | null)?.created));
  // Drop the one-time "created" flag so a refresh doesn't show the banner again.
  useEffect(() => { if (created) navigate(location.pathname, { replace: true, state: null }); }, [created, navigate, location.pathname]);
  const query = useAsync(() => groupService.getGroup(groupId), `group:${groupId}`);
  // Refetched after an approval without the skeleton flash of query.retry().
  const [fresh, setFresh] = useState<GroupDetails | null>(null);
  const group = fresh?.group_id === query.data?.group_id ? fresh : query.data;
  const reload = async () => { try { setFresh(await groupService.getGroup(groupId)); } catch { query.retry(); } };
  const notFound = query.error instanceof ApiError && query.error.status === 404;

  return (
    <PageContainer className="gp-page">
      <nav className="gp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Home</Link><ChevronRight size={12} aria-hidden="true" />
        <Link to="/my-groups">My groups</Link><ChevronRight size={12} aria-hidden="true" />
        <span>{query.data?.name ?? groupId}</span>
      </nav>
      {query.loading ? <DetailsSkeleton />
        : notFound ? <EmptyState title="Group not found" action={<Link className="text-link" to="/my-groups">Back to my groups</Link>}><p>There is no group with ID {groupId}.</p></EmptyState>
        : query.error || !group ? <ErrorState error={query.error} retry={query.retry} />
        : <GroupView group={group} created={created} reload={reload} />}
    </PageContainer>
  );
}
