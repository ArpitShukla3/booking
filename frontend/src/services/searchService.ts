import { apiClient } from '@/lib/api';
import type { DepartureCity, MatchesResponse, MatchSort, SavedSearch, SearchInput } from '@/types/search';

/** Live Group Match API (M3 search + M4 matches). The traveller header comes from lib/api.ts. */
export interface SearchApi {
  listDepartureCities(): Promise<DepartureCity[]>;
  createSearch(input: SearchInput): Promise<SavedSearch>;
  listMySearches(): Promise<SavedSearch[]>;
  getMatches(searchId: string, sort: MatchSort): Promise<MatchesResponse>;
}

let departureCache: Promise<DepartureCity[]> | null = null;

export const searchService: SearchApi = {
  listDepartureCities() {
    departureCache ??= apiClient.get<DepartureCity[]>('/api/departure-cities').then((r) => r.data)
      .catch((error) => { departureCache = null; throw error; });
    return departureCache;
  },
  async createSearch(input) { return (await apiClient.post<SavedSearch>('/api/searches', input)).data; },
  async listMySearches() { return (await apiClient.get<SavedSearch[]>('/api/searches')).data; },
  async getMatches(searchId, sort) {
    return (await apiClient.get<MatchesResponse>(`/api/searches/${encodeURIComponent(searchId)}/matches`, { params: { sort } })).data;
  },
};
