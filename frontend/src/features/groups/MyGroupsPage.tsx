import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, CalendarDays, ChevronRight, Crown, MapPin, Moon, Plus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { EmptyState, ErrorState, PageContainer, Photo } from '@/components/shared/common';
import { money, tripDates } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { groupService } from '@/services/groupService';
import { useTravellerStore } from '@/store/useTravellerStore';
import type { MyGroup } from '@/types/group';
import { SeatBar, StagePill, TripProgress } from './parts';
import { cityPhoto, stagger } from './media';
import { sizeLabel } from './schema';
import './groups.css';

type Tab = 'ALL' | 'OWNER' | 'MEMBER';
type StageFilter = 'ALL' | MyGroup['stage'];
const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OWNER', label: 'Created by me' },
  { key: 'MEMBER', label: 'Joined' },
];

/** Warm the details route so opening a group feels instant. */
const prefetchDetails = () => { void import('./GroupPage'); };

function GroupCard({ group, index }: { group: MyGroup; index: number }) {
  const photo = cityPhoto(group.city, 600);
  const owner = group.my_role === 'OWNER';
  return (
    <article className="card gp-card gp-rise" style={stagger(index)} onMouseEnter={prefetchDetails} onFocus={prefetchDetails}>
      <div className="gp-card-photo">
        <Photo src={photo.src} fallback={photo.fallback} alt={`${group.city}, ${group.country_name}`} />
        <span className={`gp-role ${owner ? '' : 'is-member'}`}>
          {owner ? <Crown size={13} aria-hidden="true" /> : <UserCheck size={13} aria-hidden="true" />}
          {owner ? 'Owner' : 'Member'}
        </span>
      </div>
      <div className="gp-card-body">
        <div className="flex items-center gap-2 flex-wrap">
          <h3><Link to={`/groups/${group.group_id}`} className="hover:underline">{group.name}</Link></h3>
          <StagePill stage={group.stage} />
        </div>
        <div className="gp-card-meta">
          <span><MapPin size={14} aria-hidden="true" />{group.city}, {group.country_name}</span>
          <span><CalendarDays size={14} aria-hidden="true" />{tripDates(group.check_in, group.check_out)}</span>
          <span><Moon size={14} aria-hidden="true" />{group.nights} nights</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <SeatBar members={group.members_count} max={group.max_size} />
          <span className="text-sm"><b>{group.members_count}/{group.max_size}</b> members · {sizeLabel(group.max_size)}</span>
        </div>
        <TripProgress group={group} compact />
      </div>
      <div className="gp-card-side">
        {owner ? (
          <span className={`gp-badge ${group.pending_requests ? 'has-pending' : ''}`} aria-label={`${group.pending_requests} pending join requests`}>
            <BellRing size={14} aria-hidden="true" />Requests <b>{group.pending_requests}</b>
          </span>
        ) : <span className="gp-badge">Hosted by {group.owner.name}</span>}
        <div className="gp-price">
          <small>Budget per person</small>
          <strong>{money(group.budget_inr)}</strong>
          <small>{group.spots_left ? `${group.spots_left} spot${group.spots_left === 1 ? '' : 's'} left` : 'Group is full'}</small>
        </div>
        <Button asChild><Link to={`/groups/${group.group_id}`}>View group <ChevronRight size={16} aria-hidden="true" /></Link></Button>
      </div>
    </article>
  );
}

function Tabs({ value, onChange, counts }: { value: Tab; onChange: (t: Tab) => void; counts: Record<Tab, number> }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 3, width: 0 });
  useLayoutEffect(() => {
    const el = refs.current[TABS.findIndex((t) => t.key === value)];
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, counts]);
  return (
    <div className="gp-tabs" role="tablist" aria-label="Filter groups by role">
      <span className="gp-tab-indicator" style={indicator} aria-hidden="true" />
      {TABS.map((t, i) => (
        <button key={t.key} ref={(el) => { refs.current[i] = el; }} role="tab" type="button" className="gp-tab"
          aria-selected={value === t.key} onClick={() => onChange(t.key)}>
          {t.label} ({counts[t.key]})
        </button>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="gp-list" role="status" aria-label="Loading your groups">
      {[0, 1, 2].map((i) => <div key={i} className="card gp-skel" style={{ height: 180 }} />)}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default function MyGroupsPage() {
  const traveller = useTravellerStore((s) => s.traveller)!;
  const query = useAsync(() => groupService.listMyGroups(), `my-groups:${traveller.traveller_id}`);
  const [tab, setTab] = useState<Tab>('ALL');
  const [stage, setStage] = useState<StageFilter>('ALL');
  const groups = useMemo(() => query.data ?? [], [query.data]);
  const counts = useMemo(() => ({
    ALL: groups.length,
    OWNER: groups.filter((g) => g.my_role === 'OWNER').length,
    MEMBER: groups.filter((g) => g.my_role === 'MEMBER').length,
  }), [groups]);
  const visible = groups.filter((g) => (tab === 'ALL' || g.my_role === tab) && (stage === 'ALL' || g.stage === stage));

  return (
    <PageContainer className="gp-page">
      <nav className="gp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/dashboard">Home</Link><ChevronRight size={12} aria-hidden="true" /><span>My groups</span>
      </nav>
      <div className="section-heading gp-rise">
        <div>
          <h1>My groups</h1>
          <p>Trips you’ve created and groups you’ve joined, {traveller.name.split(' ')[0]}.</p>
        </div>
        <Button asChild size="lg"><Link to="/groups/new"><Plus size={16} aria-hidden="true" />Create a group</Link></Button>
      </div>

      {query.loading ? <ListSkeleton />
        : query.error ? <ErrorState error={query.error} retry={query.retry} />
        : !groups.length ? (
          <EmptyState title="No group trips yet" action={<Button asChild size="lg"><Link to="/groups/new"><Plus size={16} aria-hidden="true" />Create your first group</Link></Button>}>
            <p>Post a trip to Tokyo, Kyoto, Osaka, Dubai or Abu Dhabi and let travellers like you join in.</p>
          </EmptyState>
        ) : (
          <>
            <div className="gp-toolbar">
              <Tabs value={tab} onChange={setTab} counts={counts} />
              <label className="gp-filter" htmlFor="stage-filter">
                <span className="text-sm text-muted-foreground">Trip status</span>
                <Select id="stage-filter" value={stage} onChange={(e) => setStage(e.target.value as StageFilter)}>
                  <option value="ALL">All stages</option>
                  <option value="LOBBY_OPEN">Lobby open</option>
                  <option value="LOBBY_FULL">Lobby complete</option>
                </Select>
              </label>
            </div>
            <p className="text-sm text-muted-foreground mb-3" aria-live="polite">{visible.length} of {groups.length} groups</p>
            {visible.length ? (
              <div className="gp-list" key={`${tab}:${stage}`}>
                {visible.map((g, i) => <GroupCard key={g.group_id} group={g} index={i} />)}
              </div>
            ) : (
              <EmptyState title="Nothing here with these filters">
                <p><button type="button" className="text-link" onClick={() => { setTab('ALL'); setStage('ALL'); }}>Show all groups</button></p>
              </EmptyState>
            )}
          </>
        )}
    </PageContainer>
  );
}
