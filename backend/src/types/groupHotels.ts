/** Row from groupHotels.helper stays(): one room of one hotel + availability summary. */
export interface RoomStayRow {
  hotel_id: string; hotel_name: string; area: string; city: string; stars: number; rating: number;
  lat: number; lng: number; image: string; check_in_from: string; check_out_until: string; family_friendly: boolean;
  room_id: string; room_type: string; room_name: string; max_adults: number; max_children: number;
  price_per_night_amount: number; refundable: boolean;
  nights_with_data: number; min_rooms_left: number | null;
}

export interface HotelSummary {
  hotel_id: string; name: string; area: string; city: string; stars: number; rating: number;
  lat: number; lng: number; image: string; check_in_from: string; check_out_until: string; family_friendly: boolean;
}

export interface RoomSummary {
  room_id: string; room_type: string; name: string; max_adults: number; max_children: number;
  price_per_night_inr: number; refundable: boolean;
}

/** One priced room option for the group. */
export interface HotelOption extends RoomSummary {
  rooms_needed: number; nights: number; total_inr: number; per_member_inr: number;
  available: boolean; min_rooms_left: number | null;
}

export interface HotelResult extends HotelSummary {
  options: HotelOption[];
  /** Cheapest available per-member price, or null when nothing is available. */
  from_per_member_inr: number | null;
}

export interface HotelSearch {
  group_id: string; city: string; check_in: string; check_out: string;
  nights: number; members_count: number; budget_inr: number;
  hotels: HotelResult[];
}

export interface SavedRow { room_id: string; saved_by: string; saver_name: string; created_at: string }

export interface SavedOption {
  room_id: string; hotel: HotelSummary; room: RoomSummary;
  rooms_needed: number; nights: number; total_inr: number; per_member_inr: number; available: boolean;
  budget_inr: number; within_budget: boolean;
  saved_by: { traveller_id: string; name: string; saved_at: string }[];
  saved_by_me: boolean;
  /** How many members saved this option. */
  alignment: number;
}

export interface BookingRow {
  booking_id: string; group_id: string; room_id: string; rooms_count: number; nights: number;
  total_inr: number; per_member_inr: number; members_count: number; booked_by: string; created_at: string;
  booker_name?: string;
}

export interface Booking {
  booking_id: string; group_id: string; check_in: string; check_out: string;
  rooms_count: number; nights: number; total_inr: number; per_member_inr: number; members_count: number;
  booked_by: { traveller_id: string; name: string };
  created_at: string;
  hotel: HotelSummary; room: RoomSummary;
}
