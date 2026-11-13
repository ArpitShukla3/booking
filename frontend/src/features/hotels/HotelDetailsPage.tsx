import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, BedDouble, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, Heart, Images, Lock, MapPin, Moon, ShieldCheck, UsersRound, Baby,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, PageContainer, Photo } from '@/components/shared/common';
import { money, tripDates } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { groupService } from '@/services/groupService';
import { hotelImageUrl } from '@/services/groupHotelService';
import { useHotelReviewStore } from '@/store/useHotelReviewStore';
import type { HotelOption, HotelResult, HotelSearch, SavedOption } from '@/types/hotel';
import { cityPhoto } from '@/features/groups/media';
import { BookingLocked, FinaliseDialog, RatingBadge, Stars } from './parts';
import { ReviewsSection } from './ReviewsSection';
import { mockReviews } from './mockReviews';
import { roomTypeLabel } from './hotelFilters';
import { useBusy, useGroupHotels, useHotelActions } from './useGroupHotels';
import '@/features/groups/groups.css';
import './hotels.css';

interface GalleryImage { src: string; fallback: string; alt: string; caption: string }

function galleryFor(hotel: HotelResult): GalleryImage[] {
  const city = cityPhoto(hotel.city, 1400);
  return [
    { src: hotelImageUrl(hotel), fallback: city.fallback, alt: `A room at ${hotel.name}`, caption: `Room at ${hotel.name}` },
    { src: city.src, fallback: city.fallback, alt: `${hotel.city}, near ${hotel.area}`, caption: `${hotel.city} · ${city.caption}` },
  ];
}

function Gallery({ hotel }: { hotel: HotelResult }) {
  const images = useMemo(() => galleryFor(hotel), [hotel]);
  const [open, setOpen] = useState<number | null>(null);
  const show = (i: number) => setOpen((i + images.length) % images.length);
  return (
    <>
      <div className="hd-gallery">
        {images.map((img, i) => (
          <button key={img.caption} type="button" className={`hd-tile hd-tile-${i}`} onClick={() => setOpen(i)} aria-label={`Open photo: ${img.alt}`}>
            <Photo src={img.src} fallback={img.fallback} alt={img.alt} loading={i === 0 ? 'eager' : 'lazy'} />
            {i === images.length - 1 ? <span className="hd-more"><Images size={16} aria-hidden="true" />See all {images.length} photos</span> : null}
          </button>
        ))}
        <a className="hd-tile hd-tile-map" href="#location">
          <MapPin size={26} aria-hidden="true" />
          <strong>{hotel.area}, {hotel.city}</strong>
          <span>Show on map</span>
        </a>
      </div>
      {open !== null ? (
        <Dialog open onOpenChange={(o) => { if (!o) setOpen(null); }} title={images[open].caption} description={`Photo ${open + 1} of ${images.length}`}>
          <div
            className="hd-lightbox" tabIndex={0} aria-label="Photo viewer. Use the left and right arrow keys to browse."
            onKeyDown={(e) => { if (e.key === 'ArrowRight') show(open + 1); if (e.key === 'ArrowLeft') show(open - 1); }}
          >
            <Photo src={images[open].src} fallback={images[open].fallback} alt={images[open].alt} loading="eager" />
            <Button variant="outline" size="icon" className="hd-nav is-prev" onClick={() => show(open - 1)} aria-label="Previous photo"><ChevronLeft /></Button>
            <Button variant="outline" size="icon" className="hd-nav is-next" onClick={() => show(open + 1)} aria-label="Next photo"><ChevronRight /></Button>
          </div>
          <div className="hd-thumbs">
            {images.map((img, i) => (
              <button key={img.caption} type="button" aria-label={`Show photo ${i + 1}`} aria-current={i === open} onClick={() => setOpen(i)}>
                <Photo src={img.src} fallback={img.fallback} alt="" />
              </button>
            ))}
          </div>
          <p className="field-hint mt-2">Room photos are generic examples from the data pack. <Link className="text-link" to="/credits">Photo credits</Link></p>
        </Dialog>
      ) : null}
    </>
  );
}

function LocationMap({ hotel }: { hotel: HotelResult }) {
  const d = 0.006;
  const bbox = [hotel.lng - d * 1.6, hotel.lat - d, hotel.lng + d * 1.6, hotel.lat + d].map((n) => n.toFixed(5)).join(',');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${hotel.lat},${hotel.lng}`;
  const big = `https://www.openstreetmap.org/?mlat=${hotel.lat}&mlon=${hotel.lng}#map=16/${hotel.lat}/${hotel.lng}`;
  return (
    <section id="location" className="card hd-section" aria-labelledby="location-h">
      <div className="hd-section-head">
        <h2 id="location-h">Location</h2>
        <a className="text-link" href={big} target="_blank" rel="noreferrer">Open larger map<ExternalLink size={13} aria-hidden="true" /></a>
      </div>
      <p className="icon-line"><MapPin size={15} aria-hidden="true" />{hotel.area}, {hotel.city} · {hotel.lat.toFixed(4)}, {hotel.lng.toFixed(4)}</p>
      <div className="hd-map">
        <iframe title={`Map showing ${hotel.name} in ${hotel.area}, ${hotel.city}`} src={src} loading="lazy" referrerPolicy="no-referrer" />
      </div>
      <p className="field-hint">Map data © OpenStreetMap contributors.</p>
    </section>
  );
}

function RoomRow({ option, hotel, search, saved, locked, entryKey, onSave, onUnsave, onFinalise }: {
  option: HotelOption; hotel: HotelResult; search: HotelSearch; saved?: SavedOption; locked: boolean; entryKey: string;
  onSave: () => void; onUnsave: () => void; onFinalise: () => void;
}) {
  const busy = useBusy(entryKey, option.room_id);
  const mine = Boolean(saved?.saved_by_me);
  return (
    <tr className={option.available ? '' : 'is-soldout'}>
      <th scope="row">
        <strong className="hd-room-name">{option.name}</strong>
        <span className="text-muted-foreground">{roomTypeLabel(option.room_type)} · {option.room_id}</span>
        {saved ? <span className="hs-aligned"><UsersRound size={13} aria-hidden="true" />{saved.alignment}/{search.members_count} saved</span> : null}
      </th>
      <td>
        <span className="hd-sleeps" aria-label={`Sleeps ${option.max_adults} adults${option.max_children ? ` and ${option.max_children} children` : ''}`}>
          {Array.from({ length: option.max_adults }, (_, i) => <UsersRound key={i} size={14} aria-hidden="true" />)}
          {option.max_children ? <Baby size={14} aria-hidden="true" /> : null}
        </span>
        <small>{option.rooms_needed} room{option.rooms_needed > 1 ? 's' : ''} needed</small>
      </td>
      <td>
        <strong>{money(option.total_inr)}</strong>
        <small>{money(option.price_per_night_inr)} × {option.rooms_needed} × {option.nights} nights</small>
      </td>
      <td><strong className="hd-each">{money(option.per_member_inr)}</strong><small>per member</small></td>
      <td>
        {option.refundable ? <span className="hs-good"><Check size={13} aria-hidden="true" />Free cancellation</span> : <span>Non-refundable</span>}
        {!option.available ? <span className="hs-bad">Sold out on at least one night</span>
          : option.min_rooms_left !== null ? <small>{option.min_rooms_left} left on the busiest night</small> : null}
      </td>
      <td className="hd-room-actions">
        {locked ? <span className="text-muted-foreground"><Lock size={13} aria-hidden="true" /> Locked</span> : (
          <>
            <Button size="sm" onClick={onFinalise} disabled={!option.available || Boolean(busy)} aria-label={`Finalise ${option.name} at ${hotel.name}`}>Finalise</Button>
            <Button size="sm" variant="outline" aria-pressed={mine} disabled={Boolean(busy) || (!option.available && !mine)} onClick={mine ? onUnsave : onSave}
              aria-label={mine ? `Remove my save for ${option.name}` : `Save ${option.name} to the shortlist`}>
              <Heart size={14} aria-hidden="true" fill={mine ? 'currentColor' : 'none'} />{mine ? 'Saved' : 'Save'}
            </Button>
          </>
        )}
      </td>
    </tr>
  );
}

function HotelView({ groupId, groupName, hotel, search, shortlist, booking, entryKey }: {
  groupId: string; groupName: string; hotel: HotelResult; search: HotelSearch; shortlist: SavedOption[];
  booking: import('@/types/hotel').Booking | null; entryKey: string;
}) {
  const actions = useHotelActions(groupId);
  const [finalise, setFinalise] = useState<HotelOption | null>(null);
  const added = useHotelReviewStore((s) => s.added[hotel.hotel_id]?.length ?? 0);
  const reviewCount = useMemo(() => mockReviews(hotel).length, [hotel]) + added;
  const saved = useMemo(() => new Map(shortlist.map((s) => [s.room_id, s])), [shortlist]);
  const cheapest = hotel.options.find((o) => o.available) ?? hotel.options[0];
  const bookedHere = booking?.hotel.hotel_id === hotel.hotel_id;

  return (
    <>
      <nav className="hd-tabs" aria-label="Hotel sections">
        <a href="#overview">Overview</a><a href="#rooms">Rooms &amp; prices</a><a href="#location">Location</a><a href="#reviews">Guest reviews ({reviewCount})</a>
      </nav>

      <header id="overview" className="hd-header gp-rise">
        <div>
          <div className="flex items-center gap-2 flex-wrap"><Stars count={hotel.stars} />{hotel.family_friendly ? <span className="tag">Family friendly</span> : null}</div>
          <h1>{hotel.name}</h1>
          <p className="icon-line"><MapPin size={15} aria-hidden="true" />{hotel.area}, {hotel.city} · <a className="text-link" href="#location">Show on map</a></p>
        </div>
        <div className="hd-header-side">
          <RatingBadge rating={hotel.rating} reviews={reviewCount} />
          {!booking && cheapest?.available ? <Button onClick={() => setFinalise(cheapest)}>Finalise for the group</Button> : null}
        </div>
      </header>

      <div aria-live="polite" className="hs-toast-slot">{actions.message ? <p className={`hs-toast is-${actions.message.tone}`}>{actions.message.text}</p> : null}</div>
      {booking ? <BookingLocked booking={booking} groupId={groupId} compact={!bookedHere} /> : null}

      <Gallery hotel={hotel} />

      <div className="hd-overview">
        <section className="card hd-section" aria-labelledby="about-h">
          <h2 id="about-h">About this stay</h2>
          <p>
            {hotel.name} is a {hotel.stars}-star property in {hotel.area}, {hotel.city}, rated {hotel.rating.toFixed(1)} by guests.
            {hotel.family_friendly ? ' It welcomes families.' : ''} Prices below are for <strong>{groupName}</strong>: {search.members_count} member{search.members_count > 1 ? 's' : ''}, {search.nights} nights.
          </p>
          <ul className="hd-facts">
            <li><Clock size={16} aria-hidden="true" />Check-in from {hotel.check_in_from}</li>
            <li><Clock size={16} aria-hidden="true" />Check-out until {hotel.check_out_until}</li>
            <li><Moon size={16} aria-hidden="true" />{tripDates(search.check_in, search.check_out)}</li>
            <li><BedDouble size={16} aria-hidden="true" />{hotel.options.length} room type{hotel.options.length > 1 ? 's' : ''}</li>
            <li><ShieldCheck size={16} aria-hidden="true" />{hotel.options.some((o) => o.refundable) ? 'Free cancellation on some rooms' : 'Non-refundable rates'}</li>
          </ul>
        </section>
        <aside className="card hd-section hd-price-card">
          <small>From, per member</small>
          <strong>{hotel.from_per_member_inr !== null ? money(hotel.from_per_member_inr) : 'Sold out'}</strong>
          <span className="text-muted-foreground">Budget {money(search.budget_inr)} per person</span>
          <a className="text-link" href="#rooms">See room options</a>
        </aside>
      </div>

      <section id="rooms" className="card hd-section" aria-labelledby="rooms-h">
        <h2 id="rooms-h">Rooms &amp; prices for your group</h2>
        <div className="hd-table-wrap">
          <table className="hd-rooms">
            <thead>
              <tr><th scope="col">Room type</th><th scope="col">Sleeps</th><th scope="col">Price for {search.nights} nights</th><th scope="col">Per member</th><th scope="col">Your choices</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {hotel.options.map((o) => (
                <RoomRow key={o.room_id} option={o} hotel={hotel} search={search} saved={saved.get(o.room_id)} locked={Boolean(booking)} entryKey={entryKey}
                  onSave={() => void actions.save(o.room_id, o.name)} onUnsave={() => void actions.unsave(o.room_id, o.name)} onFinalise={() => setFinalise(o)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <LocationMap hotel={hotel} />
      <ReviewsSection hotel={hotel} />

      {finalise ? (
        <FinaliseDialog open onOpenChange={(o) => { if (!o) setFinalise(null); }} groupId={groupId} hotel={hotel} option={finalise}
          checkIn={search.check_in} checkOut={search.check_out} membersCount={search.members_count} />
      ) : null}
    </>
  );
}

export default function HotelDetailsPage() {
  const { groupId = '', hotelId = '' } = useParams();
  const { hash } = useLocation();
  const { key, entry, status, reload } = useGroupHotels(groupId);
  const group = useAsync(() => groupService.getGroup(groupId), `group:${groupId}`);
  const hotel = entry.search?.hotels.find((h) => h.hotel_id === hotelId.toUpperCase());

  // Jump to #location / #reviews once the content exists.
  useEffect(() => {
    if (hash && hotel) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash, hotel]);
  useEffect(() => { if (hotel) document.title = `${hotel.name} | Group Travel Matcher`; }, [hotel]);

  const back = <Link className="text-link" to={`/groups/${groupId}#hotels`}><ArrowLeft size={14} aria-hidden="true" />Back to the group’s hotels</Link>;
  return (
    <PageContainer className="gp-page hd-page">
      <nav className="gp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/my-groups">My groups</Link><ChevronRight size={12} aria-hidden="true" />
        <Link to={`/groups/${groupId}`}>{group.data?.name ?? groupId}</Link><ChevronRight size={12} aria-hidden="true" />
        <Link to={`/groups/${groupId}#hotels`}>Hotels</Link><ChevronRight size={12} aria-hidden="true" />
        <span>{hotel?.name ?? hotelId}</span>
      </nav>
      {status.forbidden ? (
        <EmptyState title="Members only" action={<Link className="text-link" to={`/groups/${groupId}`}>View the group</Link>}>
          <p>Only members of this group can see its hotels. Send an Interested request to join.</p>
        </EmptyState>
      ) : status.loading && !entry.search ? (
        <div role="status" aria-label="Loading hotel" style={{ display: 'grid', gap: 16 }}>
          <div className="gp-skel" style={{ height: 70 }} /><div className="gp-skel" style={{ height: 340 }} /><div className="gp-skel" style={{ height: 220 }} />
          <span className="sr-only">Loading…</span>
        </div>
      ) : status.error && !entry.search ? (
        <div className="error-state" role="alert"><h2>Couldn’t load this hotel</h2><p>{status.error}</p><Button variant="outline" onClick={reload}>Try again</Button>{back}</div>
      ) : !hotel || !entry.search ? (
        <EmptyState title="Hotel not found" action={back}><p>This hotel isn’t offered in this group’s city.</p></EmptyState>
      ) : (
        <HotelView groupId={groupId} groupName={group.data?.name ?? 'your group'} hotel={hotel} search={entry.search}
          shortlist={entry.shortlist} booking={entry.booking} entryKey={key} />
      )}
    </PageContainer>
  );
}
