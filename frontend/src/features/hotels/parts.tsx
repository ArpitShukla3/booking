import { useEffect, useId, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, CalendarDays, CheckCircle2, Lock, Moon, Star, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Photo } from '@/components/shared/common';
import { dateLabel, money, tripDates } from '@/lib/format';
import { hotelImageUrl } from '@/services/groupHotelService';
import { useGroupHotelStore } from '@/store/useGroupHotelStore';
import { useTravellerStore } from '@/store/useTravellerStore';
import { ApiError } from '@/lib/api';
import type { Booking, HotelOption, HotelResult, HotelSummary } from '@/types/hotel';
import { priceBounds, priceBrackets, priceHistogram, ratingWord } from './hotelFilters';
import type { HotelFilters } from './hotelFilters';
import { cityPhoto } from '@/features/groups/media';

export function Stars({ count }: { count: number }) {
  return (
    <span className="hs-stars" role="img" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }, (_, i) => <Star key={i} size={13} aria-hidden="true" fill="currentColor" />)}
    </span>
  );
}

export function RatingBadge({ rating, reviews }: { rating: number; reviews?: number }) {
  return (
    <div className="hs-rating">
      <div className="hs-rating-text">
        <strong>{ratingWord(rating)}</strong>
        {reviews !== undefined ? <small>{reviews} reviews</small> : null}
      </div>
      <span className="hs-score" aria-label={`Scored ${rating.toFixed(1)} out of 10`}>{rating.toFixed(1)}</span>
    </div>
  );
}

export function HotelPhoto({ hotel, className = '', eager = false }: { hotel: HotelSummary; className?: string; eager?: boolean }) {
  return (
    <Photo
      src={hotelImageUrl(hotel)}
      fallback={cityPhoto(hotel.city).fallback}
      alt={`A room at ${hotel.name}, ${hotel.area}`}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
    />
  );
}

/** Per-member cost against the group budget. */
export function BudgetMeter({ perMember, budget }: { perMember: number; budget: number }) {
  const pct = budget > 0 ? Math.min(100, Math.round((perMember / budget) * 100)) : 100;
  const over = perMember > budget;
  return (
    <div className={`hs-budget ${over ? 'is-over' : ''}`}>
      <div className="hs-budget-bar" role="img" aria-label={`${pct}% of the ${money(budget)} budget per person`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <small>{over ? `${money(perMember - budget)} over` : `${pct}% of`} budget ({money(budget)})</small>
    </div>
  );
}

/* ---------- price per night filter: histogram + dual slider + min/max + quick ranges ---------- */

export function PriceFilter({ hotels, filters, onChange }: {
  hotels: HotelResult[];
  filters: HotelFilters;
  onChange: (patch: Partial<HotelFilters>) => void;
}) {
  const id = useId();
  const bounds = priceBounds(hotels);
  const bars = priceHistogram(hotels);
  const peak = Math.max(1, ...bars);
  const brackets = priceBrackets(hotels);
  const lo = filters.priceMin ?? bounds.min;
  const hi = filters.priceMax ?? bounds.max;
  // Slider drags stay local and commit shortly after, so typing/dragging never janks.
  const [draft, setDraft] = useState({ lo, hi });
  const [typed, setTyped] = useState({ lo: '', hi: '' });
  // Filters changed from outside (quick range, Clear all): adopt them during render, no effect.
  const [synced, setSynced] = useState({ lo, hi });
  if (synced.lo !== lo || synced.hi !== hi) { setSynced({ lo, hi }); setDraft({ lo, hi }); }
  useEffect(() => {
    if (draft.lo === lo && draft.hi === hi) return;
    const t = window.setTimeout(() => onChange({
      priceMin: draft.lo <= bounds.min ? null : draft.lo,
      priceMax: draft.hi >= bounds.max ? null : draft.hi,
    }), 120);
    return () => window.clearTimeout(t);
  }, [draft, lo, hi, bounds.min, bounds.max, onChange]);

  if (bounds.max <= bounds.min) return null;
  const span = bounds.max - bounds.min;
  const pos = (v: number) => ((v - bounds.min) / span) * 100;
  const step = 100;
  const applyTyped = () => {
    const min = typed.lo ? Math.max(0, Number(typed.lo)) : null;
    const max = typed.hi ? Math.max(0, Number(typed.hi)) : null;
    if (min !== null && max !== null && min > max) onChange({ priceMin: max, priceMax: min });
    else onChange({ priceMin: min, priceMax: max });
    setTyped({ lo: '', hi: '' });
  };
  const active = filters.priceMin !== null || filters.priceMax !== null;

  return (
    <fieldset className="hs-filter-group">
      <legend>Your budget (per night)</legend>
      <p className="hs-price-now" aria-live="polite">{money(draft.lo)} – {money(draft.hi)}{draft.hi >= bounds.max ? '+' : ''}</p>
      <div className="hs-histo" aria-hidden="true">
        {bars.map((n, i) => {
          const from = bounds.min + (span * i) / bars.length;
          const inRange = from + span / bars.length >= draft.lo && from <= draft.hi;
          return <span key={i} className={inRange ? 'is-in' : ''} style={{ height: `${Math.max(6, (n / peak) * 100)}%` }} />;
        })}
      </div>
      <div className="hs-range" style={{ '--lo': pos(draft.lo) / 100, '--hi': pos(draft.hi) / 100 } as CSSProperties}>
        <input
          type="range" min={bounds.min} max={bounds.max} step={step} value={draft.lo}
          aria-label="Minimum price per night" aria-valuetext={money(draft.lo)}
          onChange={(e) => setDraft((d) => ({ ...d, lo: Math.min(Number(e.target.value), d.hi - step) }))}
        />
        <input
          type="range" min={bounds.min} max={bounds.max} step={step} value={draft.hi}
          aria-label="Maximum price per night" aria-valuetext={money(draft.hi)}
          onChange={(e) => setDraft((d) => ({ ...d, hi: Math.max(Number(e.target.value), d.lo + step) }))}
        />
      </div>
      <ul className="hs-brackets">
        {brackets.map((b) => {
          const on = filters.priceMin === b.min && filters.priceMax === b.max && active;
          return (
            <li key={b.label}>
              <button type="button" aria-pressed={on} onClick={() => onChange(on ? { priceMin: null, priceMax: null } : { priceMin: b.min, priceMax: b.max })}>
                {b.label}
              </button>
            </li>
          );
        })}
      </ul>
      <form className="hs-minmax" onSubmit={(e) => { e.preventDefault(); applyTyped(); }}>
        <label className="sr-only" htmlFor={`${id}-min`}>Minimum ₹ per night</label>
        <input id={`${id}-min`} className="control" inputMode="numeric" placeholder="₹ Min" value={typed.lo}
          onChange={(e) => setTyped((t) => ({ ...t, lo: e.target.value.replace(/\D/g, '') }))} />
        <label className="sr-only" htmlFor={`${id}-max`}>Maximum ₹ per night</label>
        <input id={`${id}-max`} className="control" inputMode="numeric" placeholder="₹ Max" value={typed.hi}
          onChange={(e) => setTyped((t) => ({ ...t, hi: e.target.value.replace(/\D/g, '') }))} />
        <Button type="submit" variant="outline" size="sm" disabled={!typed.lo && !typed.hi}>Go</Button>
      </form>
      {active ? <button type="button" className="hs-clear-link" onClick={() => onChange({ priceMin: null, priceMax: null })}>Clear price</button> : null}
    </fieldset>
  );
}

/* ---------- finalise (confirmation popup) ---------- */

export function FinaliseDialog({ open, onOpenChange, groupId, hotel, option, checkIn, checkOut, membersCount, onBooked }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  hotel: HotelSummary;
  option: Pick<HotelOption, 'room_id' | 'name' | 'rooms_needed' | 'nights' | 'total_inr' | 'per_member_inr' | 'price_per_night_inr' | 'refundable'>;
  checkIn: string;
  checkOut: string;
  membersCount: number;
  onBooked?: (booking: Booking) => void;
}) {
  const me = useTravellerStore((s) => s.travellerId);
  // Callers mount this dialog only while it is open, so state starts fresh each time.
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const confirm = async () => {
    if (!me) return;
    setState({ busy: true, error: null });
    try {
      const booking = await useGroupHotelStore.getState().book(me, groupId, option.room_id);
      onOpenChange(false);
      onBooked?.(booking);
    } catch (error) {
      setState({ busy: false, error: error instanceof ApiError || error instanceof Error ? error.message : 'Could not finalise. Please try again.' });
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!state.busy) onOpenChange(o); }} title="Finalise this hotel for the group?"
      description="This books one stay for everyone. After confirming, the booking is locked and can't be changed.">
      <div className="hs-confirm">
        <div className="hs-confirm-hotel">
          <HotelPhoto hotel={hotel} />
          <div>
            <Stars count={hotel.stars} />
            <h3>{hotel.name}</h3>
            <p className="text-muted-foreground">{hotel.area}, {hotel.city}</p>
          </div>
        </div>
        <dl className="hs-confirm-grid">
          <div><dt><BedDouble size={14} aria-hidden="true" />Room</dt><dd>{option.name}</dd></div>
          <div><dt><BedDouble size={14} aria-hidden="true" />Rooms</dt><dd>{option.rooms_needed}</dd></div>
          <div><dt><Moon size={14} aria-hidden="true" />Nights</dt><dd>{option.nights}</dd></div>
          <div><dt><CalendarDays size={14} aria-hidden="true" />Dates</dt><dd>{tripDates(checkIn, checkOut)}</dd></div>
          <div><dt><UsersRound size={14} aria-hidden="true" />Members</dt><dd>{membersCount}</dd></div>
          <div><dt>Policy</dt><dd>{option.refundable ? 'Free cancellation' : 'Non-refundable'}</dd></div>
        </dl>
        <div className="hs-confirm-total">
          <div><small>{money(option.price_per_night_inr)} × {option.rooms_needed} room{option.rooms_needed > 1 ? 's' : ''} × {option.nights} nights</small><strong>Total {money(option.total_inr)}</strong></div>
          <div className="hs-confirm-each"><small>Each member pays</small><strong>{money(option.per_member_inr)}</strong></div>
        </div>
        {state.error ? <p className="gp-form-error" role="alert">{state.error}</p> : null}
        <div className="hs-confirm-actions">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={state.busy}>Keep comparing</Button>
          <Button onClick={() => void confirm()} disabled={state.busy}>
            <Lock size={15} aria-hidden="true" />{state.busy ? 'Finalising…' : 'Confirm booking'}
          </Button>
        </div>
        <p className="field-hint">Demo only: no payment is taken and hotel availability is not reduced.</p>
      </div>
    </Dialog>
  );
}

/* ---------- locked booking ---------- */

export function BookingLocked({ booking, groupId, compact = false }: { booking: Booking; groupId: string; compact?: boolean }) {
  return (
    <section className="hs-locked gp-rise" aria-labelledby={`booked-${booking.booking_id}`}>
      <div className="hs-locked-icon" aria-hidden="true"><Lock size={20} /></div>
      <div className="hs-locked-body">
        <p className="hs-locked-kicker"><CheckCircle2 size={14} aria-hidden="true" />Hotel finalised · Booking {booking.booking_id}</p>
        <h3 id={`booked-${booking.booking_id}`}>
          <Link to={`/groups/${groupId}/hotels/${booking.hotel.hotel_id}`}>{booking.hotel.name}</Link> · {booking.room.name}
        </h3>
        <p className="text-muted-foreground">
          {booking.rooms_count} room{booking.rooms_count > 1 ? 's' : ''} · {booking.nights} nights · {dateLabel(booking.check_in)} – {dateLabel(booking.check_out)} · booked by {booking.booked_by.name}
        </p>
      </div>
      {!compact ? (
        <div className="hs-locked-split">
          <div><small>Group total</small><strong>{money(booking.total_inr)}</strong></div>
          <div><small>Per person ({booking.members_count})</small><strong>{money(booking.per_member_inr)}</strong></div>
        </div>
      ) : null}
    </section>
  );
}
