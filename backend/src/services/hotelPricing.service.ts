// M6 pricing rules (pure, no I/O). Agent.md §8 "Hotel cost".

/** Rooms needed = ceil(members / max_adults). */
function roomsNeeded(members: number, maxAdults: number): number {
  return Math.ceil(members / maxAdults);
}

/** Total = price per night × rooms × nights; per member = total ÷ members (nearest rupee). */
function priceStay(room: { price_per_night_amount: number; max_adults: number }, members: number, nights: number) {
  const rooms_needed = roomsNeeded(members, room.max_adults);
  const total_inr = room.price_per_night_amount * rooms_needed * nights;
  return { rooms_needed, total_inr, per_member_inr: Math.round(total_inr / members) };
}

/**
 * Bookable only if rooms_left ≥ rooms needed on EVERY night. A night without an
 * availability row counts as sold out.
 */
function isAvailable(stay: { nights_with_data: number; min_rooms_left: number | null }, nights: number, rooms: number): boolean {
  return stay.nights_with_data === nights && stay.min_rooms_left !== null && stay.min_rooms_left >= rooms;
}

const hotelPricing = { roomsNeeded, priceStay, isAvailable };
export = hotelPricing;
