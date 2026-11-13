import { API_BASE_URL, apiClient } from '@/lib/api';
import type { Booking, HotelSearch, HotelSummary, SavedOption } from '@/types/hotel';

/** Real backend API for M6 (members only). The traveller ID header is added by lib/api.ts. */
export interface GroupHotelApi {
  searchHotels(groupId: string): Promise<HotelSearch>;
  listSaved(groupId: string): Promise<SavedOption[]>;
  save(groupId: string, roomId: string): Promise<SavedOption[]>;
  unsave(groupId: string, roomId: string): Promise<SavedOption[]>;
  getBooking(groupId: string): Promise<Booking | null>;
  book(groupId: string, roomId: string): Promise<Booking>;
}

const base = (groupId: string) => `/api/groups/${encodeURIComponent(groupId)}`;

export const groupHotelService: GroupHotelApi = {
  async searchHotels(groupId) { return (await apiClient.get<HotelSearch>(`${base(groupId)}/hotels`)).data; },
  async listSaved(groupId) { return (await apiClient.get<SavedOption[]>(`${base(groupId)}/saved-options`)).data; },
  async save(groupId, roomId) { return (await apiClient.post<SavedOption[]>(`${base(groupId)}/saved-options`, { room_id: roomId })).data; },
  async unsave(groupId, roomId) {
    return (await apiClient.delete<SavedOption[]>(`${base(groupId)}/saved-options/${encodeURIComponent(roomId)}`)).data;
  },
  async getBooking(groupId) { return (await apiClient.get<{ booking: Booking | null }>(`${base(groupId)}/booking`)).data.booking; },
  async book(groupId, roomId) { return (await apiClient.post<Booking>(`${base(groupId)}/booking`, { room_id: roomId })).data; },
};

/** Hotel photos are served by the backend from the data pack's images folder. */
export const hotelImageUrl = (hotel: Pick<HotelSummary, 'image'>) => `${API_BASE_URL}/${hotel.image}`;
export const hotelCreditsUrl = () => `${API_BASE_URL}/images/ATTRIBUTIONS.md`;
