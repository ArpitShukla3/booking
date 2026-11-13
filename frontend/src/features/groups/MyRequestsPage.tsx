import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Crown, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageContainer, Photo } from '@/components/shared/common';
import { tripDates } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { joinRequestService } from '@/services/joinRequestService';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { JoinRequestStatus, MyJoinRequest } from '@/types/joinRequest';
import { SeatBar } from './parts';
import { RequestStatusPill } from './requestParts';
import { requestStatusLabel, timeAgo } from './joinRequests';
import { cityPhoto, stagger } from './media';
import './groups.css';

type Filter = 'ALL' | JoinRequestStatus;
const FILTERS: Filter[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'REMOVED'];

const STATUS_NOTE: Record<JoinRequestStatus, string> = {
  PENDING: 'Waiting for the organiser to review your request.',
  APPROVED: 'You’re in! Open the group to meet your travel buddies.',
  REJECTED: 'The organiser declined this request.',
  REMOVED: 'The organiser removed you from this group.',
};

function RequestCard({ request, index }: { request: MyJoinRequest; index: number }) {
  const { group } = request;
  const photo = cityPhoto(group.city, 600);
  return (
    <article className="card gp-card gp-rise" style={stagger(index)}>
      <div className="gp-card-photo">
        <Photo src={photo.src} fallback={photo.fallback} alt={`${group.city}, ${group.country_name}`} />
      </div>
      <div className="gp-card-body">
        <div className="flex items-center gap-2 flex-wrap">
          <h3><Link to={`/groups/${group.group_id}`} className="hover:underline">{group.name}</Link></h3>
          <RequestStatusPill status={request.status} />
        </div>
        <div className="gp-card-meta">
          <span><MapPin size={14} aria-hidden="true" />{group.city}, {group.country_name}</span>
          <span><CalendarDays size={14} aria-hidden="true" />{tripDates(group.check_in, group.check_out)}</span>
          <span><Crown size={14} aria-hidden="true" />Organised by {group.owner.name}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <SeatBar members={group.members_count} max={group.max_size} />
          <span className="text-sm"><b>{group.members_count}/{group.max_size}</b> members</span>
        </div>
        <p className="text-sm text-muted-foreground">{STATUS_NOTE[request.status]}</p>
      </div>
      <div className="gp-card-side">
        <small className="text-muted-foreground">
          Sent {timeAgo(request.created_at)}
          {request.decided_at ? <><br />{requestStatusLabel(request.status)} {timeAgo(request.decided_at)}</> : null}
        </small>
        <Button asChild variant={request.status === 'APPROVED' ? 'default' : 'outline'}>
          <Link to={`/groups/${group.group_id}`}>View group <ChevronRight size={16} aria-hidden="true" /></Link>
        </Button>
      </div>
    </article>
  );
}

export default function MyRequestsPage() {
  const traveller = useTravellerStore((s) => s.traveller)!;
  const query = useAsync(() => joinRequestService.listMine(), `my-requests:${traveller.traveller_id}`);
  const [filter, setFilter] = useState<Filter>('ALL');
  const requests = useMemo(() => query.data ?? [], [query.data]);
  const count = (f: Filter) => (f === 'ALL' ? requests.length : requests.filter((r) => r.status === f).length);
  const visible = requests.filter((r) => filter === 'ALL' || r.status === filter);

  return (
    <PageContainer className="gp-page">
      <nav className="gp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Home</Link><ChevronRight size={12} aria-hidden="true" /><span>My requests</span>
      </nav>
      <div className="section-heading gp-rise">
        <div>
          <h1>My requests</h1>
          <p>Groups you’ve asked to join and what the organisers decided.</p>
        </div>
        <Button asChild size="lg" variant="outline"><Link to="/group-match"><Search size={16} aria-hidden="true" />Find more groups</Link></Button>
      </div>

      {query.loading ? (
        <div className="gp-list" role="status" aria-label="Loading your requests">
          {[0, 1].map((i) => <div key={i} className="card gp-skel" style={{ height: 160 }} />)}
        </div>
      ) : query.error ? <ErrorState error={query.error} retry={query.retry} />
        : !requests.length ? (
          <EmptyState title="No requests yet" action={<Button asChild size="lg"><Link to="/group-match">Find a group</Link></Button>}>
            <p>Open a group that fits your trip and tap “Interested”. Your requests will show up here.</p>
          </EmptyState>
        ) : (
          <>
            <div className="gp-toolbar">
              <div className="gp-chips" role="group" aria-label="Filter requests by status">
                {FILTERS.map((f) => (
                  <button key={f} type="button" className="gp-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {f === 'ALL' ? 'All' : requestStatusLabel(f)} ({count(f)})
                  </button>
                ))}
              </div>
            </div>
            {visible.length ? (
              <div className="gp-list" key={filter}>
                {visible.map((r, i) => <RequestCard key={r.request_id} request={r} index={i} />)}
              </div>
            ) : (
              <EmptyState title="Nothing with this status">
                <p><button type="button" className="text-link" onClick={() => setFilter('ALL')}>Show all requests</button></p>
              </EmptyState>
            )}
          </>
        )}
    </PageContainer>
  );
}
