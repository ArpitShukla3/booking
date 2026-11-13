import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, Lock, MapPin, RefreshCw, Search, SlidersHorizontal, UsersRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money, tripDates } from '@/lib/format';
import { useGroupHotelStore } from '@/store/useGroupHotelStore';
import { useHotelReviewStore } from '@/store/useHotelReviewStore';
import type { GroupDetails } from '@/types/group';
import type { Booking, HotelOption, HotelResult, HotelSearch, SavedOption } from '@/types/hotel';
import { activeFilterCount, applyFilters, DEFAULT_FILTERS } from './hotelFilters';
import type { HotelFilters, HotelMatch, HotelSort } from './hotelFilters';
import { mockReviews } from './mockReviews';
import { BookingLocked, BudgetMeter, FinaliseDialog, HotelPhoto, PriceFilter, RatingBadge, Stars } from './parts';
import { useBusy, useGroupHotels, useHotelActions } from './useGroupHotels';
import { stagger } from '@/features/groups/media';
import './hotels.css';

const SORT_LABELS: Record<HotelSort, string> = {
  recommended: 'Our top picks',
  price_asc: 'Price per member (lowest first)',
  price_desc: 'Price per member (highest first)',
  rating: 'Guest rating (highest first)',
  stars: 'Stars (5 to 1)',
};

type Finalise = { hotel: HotelResult | SavedOption['hotel']; option: HotelOption | (SavedOption['room'] & Pick<SavedOption, 'rooms_needed' | 'nights' | 'total_inr' | 'per_member_inr'>) };

/** The Common Group Page hotel area: shown to members under "Who's going". */
export function GroupHotelsSection({ group }: { group: GroupDetails }) {
  const { key, entry, status, filters, reload } = useGroupHotels(group.group_id);
  const setFilters = useGroupHotelStore((s) => s.setFilters);
  const resetFilters = useGroupHotelStore((s) => s.resetFilters);
  const actions = useHotelActions(group.group_id);
  const [finalise, setFinalise] = useState<Finalise | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const change = useCallback((patch: Partial<HotelFilters>) => setFilters(group.group_id, patch), [setFilters, group.group_id]);

  const search = entry.search;
  const booking = entry.booking;
  // Typing stays instant; the list re-filters on the deferred value.
  const deferred = useDeferredValue(filters);
  const results = useMemo(() => (search ? applyFilters(search.hotels, deferred) : []), [search, deferred]);
  const savedRooms = useMemo(() => new Map(entry.shortlist.map((s) => [s.room_id, s])), [entry.shortlist]);
  const active = activeFilterCount(filters);

  return (
    <section id="hotels" className="card hs-section gp-rise" style={stagger(4)} aria-labelledby="hotels-h">
      <header className="hs-head">
        <div>
          <h2 id="hotels-h">Stays in {group.city} for your group</h2>
          <p className="text-muted-foreground">
            {tripDates(group.check_in, group.check_out)} · {group.nights} nights · {group.members_count} member{group.members_count === 1 ? '' : 's'} · prices are split per member
          </p>
        </div>
        {status.refreshing ? <span className="hs-sync" role="status"><RefreshCw size={13} aria-hidden="true" />Updating prices…</span> : null}
      </header>

      <div className="hs-searchbar" role="search">
        <label className="hs-search-input">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search hotels by name or area</span>
          <input
            type="search" value={filters.query} placeholder={`Search hotels or areas in ${group.city}`}
            onChange={(e) => change({ query: e.target.value })}
          />
          {filters.query ? <button type="button" aria-label="Clear search" onClick={() => change({ query: '' })}><X size={16} /></button> : null}
        </label>
        <label className="hs-sort">
          <span className="sr-only">Sort by</span>
          <select className="control" value={filters.sort} onChange={(e) => change({ sort: e.target.value as HotelSort })}>
            {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>Sort: {label}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" className="hs-filter-toggle" aria-expanded={filtersOpen} aria-controls="hotel-filters" onClick={() => setFiltersOpen((o) => !o)}>
          <SlidersHorizontal size={16} aria-hidden="true" />Filters{active ? ` (${active})` : ''}
        </Button>
      </div>

      <div aria-live="polite" className="hs-toast-slot">
        {actions.message ? <p className={`hs-toast is-${actions.message.tone}`}>{actions.message.text}</p> : null}
      </div>

      {booking ? <BookingLocked booking={booking} groupId={group.group_id} /> : null}

      <Shortlist
        groupId={group.group_id} entryKey={key} shortlist={entry.shortlist} booking={booking} membersCount={group.members_count}
        onFinalise={(s) => setFinalise({ hotel: s.hotel, option: { ...s.room, rooms_needed: s.rooms_needed, nights: s.nights, total_inr: s.total_inr, per_member_inr: s.per_member_inr } })}
        onUnsave={(s) => void actions.unsave(s.room_id, s.hotel.name)}
      />

      <div className="hs-layout">
        <aside id="hotel-filters" className={`hs-filters ${filtersOpen ? 'is-open' : ''}`} aria-label="Filter hotels">
          <div className="hs-filters-head">
            <h3>Filter by</h3>
            {active ? <button type="button" className="hs-clear-link" onClick={() => resetFilters(group.group_id)}>Clear all</button> : null}
          </div>
          {search ? <PriceFilter hotels={search.hotels} filters={filters} onChange={change} /> : <div className="gp-skel" style={{ height: 160 }} />}
          <fieldset className="hs-filter-group">
            <legend>Property rating</legend>
            {[5, 4, 3, 2].map((n) => (
              <label key={n} className="hs-check">
                <input type="checkbox" checked={filters.stars.includes(n)}
                  onChange={(e) => change({ stars: e.target.checked ? [...filters.stars, n] : filters.stars.filter((s) => s !== n) })} />
                <span>{n} stars</span>
                <small>{search?.hotels.filter((h) => h.stars === n).length ?? 0}</small>
              </label>
            ))}
          </fieldset>
          <fieldset className="hs-filter-group">
            <legend>Your stay</legend>
            <label className="hs-check">
              <input type="checkbox" checked={filters.refundableOnly} onChange={(e) => change({ refundableOnly: e.target.checked })} />
              <span>Free cancellation</span>
            </label>
            <label className="hs-check">
              <input type="checkbox" checked={!filters.availableOnly} onChange={(e) => change({ availableOnly: !e.target.checked })} />
              <span>Show sold-out options</span>
            </label>
          </fieldset>
        </aside>

        <div className="hs-results">
          <ResultsBody
            status={status} search={search} results={results} filters={filters} onReset={() => resetFilters(group.group_id)} onRetry={reload}
            render={(match, i) => (
              <HotelCard
                key={match.hotel.hotel_id} match={match} index={i} groupId={group.group_id} entryKey={key}
                search={search!} saved={savedRooms.get(match.best.room_id)} locked={Boolean(booking)}
                onSave={() => void actions.save(match.best.room_id, match.hotel.name)}
                onUnsave={() => void actions.unsave(match.best.room_id, match.hotel.name)}
              />
            )}
          />
        </div>
      </div>

      {finalise && search ? (
        <FinaliseDialog
          open onOpenChange={(o) => { if (!o) setFinalise(null); }} groupId={group.group_id}
          hotel={finalise.hotel} option={finalise.option} checkIn={search.check_in} checkOut={search.check_out}
          membersCount={search.members_count}
        />
      ) : null}
    </section>
  );
}

function ResultsBody({ status, search, results, filters, onReset, onRetry, render }: {
  status: { loading: boolean; error: string | null; forbidden: boolean };
  search: HotelSearch | null;
  results: HotelMatch[];
  filters: HotelFilters;
  onReset: () => void;
  onRetry: () => void;
  render: (m: HotelMatch, i: number) => React.ReactNode;
}) {
  if (status.loading && !search) {
    return (
      <div role="status" aria-label="Loading hotels" className="hs-list">
        {[0, 1, 2].map((i) => <div key={i} className="gp-skel" style={{ height: 196 }} />)}
        <span className="sr-only">Loading hotels…</span>
      </div>
    );
  }
  if (status.error && !search) {
    return (
      <div className="error-state" role="alert">
        <h3>Couldn’t load hotels</h3>
        <p>{status.error}</p>
        <Button variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  if (!search) return null;
  const changed = JSON.stringify({ ...filters, sort: 'recommended' }) !== JSON.stringify({ ...DEFAULT_FILTERS });
  return (
    <>
      <p className="hs-count" aria-live="polite"><strong>{search.city}: {results.length} propert{results.length === 1 ? 'y' : 'ies'} found</strong></p>
      {results.length ? (
        <ol className="hs-list">{results.map((m, i) => <li key={m.hotel.hotel_id}>{render(m, i)}</li>)}</ol>
      ) : (
        <div className="hs-empty">
          <h3>No stays match these filters</h3>
          <p className="text-muted-foreground">Try a wider price range, fewer star ratings or include sold-out options.</p>
          {changed ? <Button variant="outline" onClick={onReset}>Clear all filters</Button> : null}
        </div>
      )}
    </>
  );
}

const HotelCard = memo(function HotelCard({ match, index, groupId, entryKey, search, saved, locked, onSave, onUnsave }: {
  match: HotelMatch; index: number; groupId: string; entryKey: string; search: HotelSearch;
  saved?: SavedOption; locked: boolean; onSave: () => void; onUnsave: () => void;
}) {
  const { hotel, best, matching } = match;
  const busy = useBusy(entryKey, best.room_id);
  const added = useHotelReviewStore((s) => s.added[hotel.hotel_id]?.length ?? 0);
  const reviewCount = useMemo(() => mockReviews(hotel).length, [hotel]) + added;
  const href = `/groups/${groupId}/hotels/${hotel.hotel_id}`;
  const mine = Boolean(saved?.saved_by_me);
  return (
    <article className={`hs-card gp-rise ${best.available ? '' : 'is-soldout'}`} style={stagger(index)} aria-labelledby={`h-${hotel.hotel_id}`}>
      <div className="hs-card-photo">
        <HotelPhoto hotel={hotel} />
        <button
          type="button" className={`hs-heart ${mine ? 'is-on' : ''}`} aria-pressed={mine}
          aria-label={mine ? `Remove ${hotel.name} from your saves` : `Save ${hotel.name} to the group shortlist`}
          disabled={locked || Boolean(busy) || (!best.available && !mine)}
          onClick={mine ? onUnsave : onSave}
        >
          <Heart size={18} aria-hidden="true" fill={mine ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="hs-card-body">
        <div className="hs-card-title">
          <h3 id={`h-${hotel.hotel_id}`}><Link to={href}>{hotel.name}</Link></h3>
          <Stars count={hotel.stars} />
        </div>
        <p className="hs-card-loc">
          <Link to={`${href}#location`}><MapPin size={13} aria-hidden="true" />{hotel.area}, {hotel.city}</Link>
          <span aria-hidden="true">·</span><Link to={`${href}#location`}>Show on map</Link>
        </p>
        {saved ? <p className="hs-aligned"><UsersRound size={13} aria-hidden="true" />{saved.alignment} of {search.members_count} member{search.members_count > 1 ? 's' : ''} saved this</p> : null}
        <div className="hs-card-room">
          <strong>{best.name}</strong>
          <span>{best.rooms_needed} room{best.rooms_needed > 1 ? 's' : ''} for {search.members_count} member{search.members_count > 1 ? 's' : ''} · sleeps {best.max_adults} per room</span>
          {best.refundable ? <span className="hs-good">Free cancellation</span> : <span className="text-muted-foreground">Non-refundable</span>}
          {!best.available ? <span className="hs-bad">Not available on every night of your stay</span>
            : best.min_rooms_left !== null && best.min_rooms_left - best.rooms_needed <= 2
              ? <span className="hs-bad">Only {best.min_rooms_left} left at this price on the busiest night</span> : null}
          {matching > 1 ? <span className="text-muted-foreground">+{matching - 1} more room type{matching > 2 ? 's' : ''}</span> : null}
        </div>
      </div>
      <div className="hs-card-side">
        <RatingBadge rating={hotel.rating} reviews={reviewCount} />
        <div className="hs-card-price">
          <small>{best.nights} nights, {search.members_count} member{search.members_count > 1 ? 's' : ''}</small>
          <strong>{money(best.total_inr)}</strong>
          <span className="hs-each">{money(best.per_member_inr)} per member</span>
          <small>{money(best.price_per_night_inr)} per room / night</small>
        </div>
        <Button asChild className="hs-cta">
          <Link to={href} aria-label={`See inside ${hotel.name}`}>See inside<ArrowRight size={15} aria-hidden="true" /></Link>
        </Button>
      </div>
    </article>
  );
});

function Shortlist({ groupId, entryKey, shortlist, booking, membersCount, onFinalise, onUnsave }: {
  groupId: string; entryKey: string; shortlist: SavedOption[]; booking: Booking | null; membersCount: number;
  onFinalise: (s: SavedOption) => void; onUnsave: (s: SavedOption) => void;
}) {
  if (!shortlist.length) {
    return booking ? null : (
      <p className="hs-shortlist-empty"><Heart size={15} aria-hidden="true" />Tap the heart on a stay to add it to the group shortlist. Everyone sees who saved what.</p>
    );
  }
  return (
    <section className="hs-shortlist" aria-labelledby="shortlist-h">
      <h3 id="shortlist-h">Group shortlist · {shortlist.length}</h3>
      <ul>
        {shortlist.map((s, i) => (
          <ShortlistItem key={s.room_id} item={s} index={i} groupId={groupId} entryKey={entryKey} membersCount={membersCount}
            locked={Boolean(booking)} isBooked={booking?.room.room_id === s.room_id}
            onFinalise={() => onFinalise(s)} onUnsave={() => onUnsave(s)} />
        ))}
      </ul>
    </section>
  );
}

function ShortlistItem({ item, index, groupId, entryKey, membersCount, locked, isBooked, onFinalise, onUnsave }: {
  item: SavedOption; index: number; groupId: string; entryKey: string; membersCount: number;
  locked: boolean; isBooked: boolean; onFinalise: () => void; onUnsave: () => void;
}) {
  const busy = useBusy(entryKey, item.room_id);
  return (
    <li className={`hs-saved gp-rise ${isBooked ? 'is-booked' : ''}`} style={stagger(index)}>
      <HotelPhoto hotel={item.hotel} />
      <div className="hs-saved-body">
        <Link to={`/groups/${groupId}/hotels/${item.hotel.hotel_id}`} className="hs-saved-name">{item.hotel.name}</Link>
        <span className="text-muted-foreground">{item.room.name} · {item.rooms_needed} room{item.rooms_needed > 1 ? 's' : ''}</span>
        <div className="hs-savers" aria-label={`Saved by ${item.saved_by.map((s) => s.name).join(', ')}`}>
          {item.saved_by.map((s) => <span key={s.traveller_id} className="avatar" title={s.name}>{s.name.charAt(0)}</span>)}
          <small>{item.alignment}/{membersCount} prefer this</small>
        </div>
      </div>
      <div className="hs-saved-price">
        <strong>{money(item.per_member_inr)}</strong><small>per member · {money(item.total_inr)} total</small>
        <BudgetMeter perMember={item.per_member_inr} budget={item.budget_inr} />
      </div>
      <div className="hs-saved-actions">
        {isBooked ? <span className="gp-status gp-status--approved"><Lock size={12} aria-hidden="true" />Booked</span>
          : !locked ? (
            <>
              <Button size="sm" onClick={onFinalise} disabled={!item.available || Boolean(busy)} title={item.available ? undefined : 'No longer available for every night'}>
                Finalise
              </Button>
              {item.saved_by_me ? <Button size="sm" variant="outline" onClick={onUnsave} disabled={Boolean(busy)} aria-label={`Remove my save for ${item.hotel.name}`}>Remove</Button> : null}
            </>
          ) : null}
      </div>
    </li>
  );
}
