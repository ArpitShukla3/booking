import { apiClient } from '@/lib/api';
import type { Interest, SignupInput, Traveller } from '@/types/traveller';
export interface TravellerApi {
  signup(input: SignupInput): Promise<Traveller>;
  signInWithId(travellerId: string): Promise<Traveller>;
  getTraveller(travellerId: string): Promise<Traveller>;
  getInterests(): Promise<Interest[]>;
}
export const travellerService: TravellerApi = {
  async signup(input) { return (await apiClient.post<Traveller>('/api/travellers', input)).data; },
  async signInWithId(traveller_id) { return (await apiClient.post<Traveller>('/api/travellers/sign-in', { traveller_id })).data; },
  async getTraveller(id) { return (await apiClient.get<Traveller>(`/api/travellers/${encodeURIComponent(id)}`)).data; },
  async getInterests() { return (await apiClient.get<Interest[]>('/api/interests')).data; },
};
