import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Crown, Luggage, MapPin, UserCheck } from 'lucide-react';
import { Photo } from '@/components/shared/common';
import { tripDates } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { groupService } from '@/services/groupService';
import type { TravellerGroup } from '@/types/group';
import { cityPhoto, stagger } from '@/features/groups/media';
import { SeatBar, StagePill } from '@/features/groups/parts';

function TripRow({ group, index }: { group: TravellerGroup; index: number }) {
  const photo = cityPhoto(group.city, 300);
  return (
    <li className="pf-trip gp-rise" style={stagger(index)}>
      <Link to={`/groups/${group.group_id}`} className="pf-trip-link" aria-label={`${group.name}, ${group.city}, ${tripDates(group.check_in, group.check_out)}`}>
        <Photo src={photo.src} fallback={photo.fallback} alt="" />
        <div className="pf-trip-body">
          <strong>{group.name}</strong>
          <span><MapPin size={13} aria-hidden="true" />{group.city}, {group.country_name}</span>
          <span><CalendarDays size={13} aria-hidden="true" />{tripDates(group.check_in, group.check_out)}</span>
          <span className="pf-trip-meta"><SeatBar members={group.members_count} max={group.max_size} />{group.members_count}/{group.max_size} · <StagePill stage={group.stage} /></span>
        </div>
        <ChevronRight size={18} className="pf-trip-arrow" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** G2: the groups this traveller organises and has joined (public, like the group pages themselves). */
export function TravellerTrips({ travellerId, firstName, isMe }: { travellerId: string; firstName: string; isMe: boolean }) {
  const query = useAsync(() => groupService.listTravellerGroups(travellerId), `traveller-groups:${travellerId}`);
  const groups = query.data ?? [];
  const organising = groups.filter((g) => g.role === 'OWNER');
  const joined = groups.filter((g) => g.role === 'MEMBER');
  const who = isMe ? 'You' : firstName;

  return (
    <section className="card pf-trips gp-rise" style={stagger(1)} aria-labelledby="trips-h">
      <h2 id="trips-h"><Luggage size={18} aria-hidden="true" />Group trips</h2>
      {query.loading ? <div className="gp-skel" style={{ height: 120 }} role="status" aria-label="Loading group trips" />
        : query.error ? <p role="alert" className="field-error">{query.error.message} <button type="button" className="text-link" onClick={query.retry}>Retry</button></p>
        : !groups.length ? <p className="text-muted-foreground">{who} {isMe ? 'aren’t' : 'isn’t'} in any group trips yet.</p>
        : (
          <div className="pf-trip-cols">
            <div>
              <h3><Crown size={14} aria-hidden="true" />Organising ({organising.length})</h3>
              {organising.length ? <ul className="pf-trip-list">{organising.map((g, i) => <TripRow key={g.group_id} group={g} index={i} />)}</ul>
                : <p className="text-muted-foreground text-sm">Not organising any trips.</p>}
            </div>
            <div>
              <h3><UserCheck size={14} aria-hidden="true" />Joined ({joined.length})</h3>
              {joined.length ? <ul className="pf-trip-list">{joined.map((g, i) => <TripRow key={g.group_id} group={g} index={i} />)}</ul>
                : <p className="text-muted-foreground text-sm">Hasn’t joined other trips.</p>}
            </div>
          </div>
        )}
    </section>
  );
}
