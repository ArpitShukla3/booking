import { apiClient } from '@/lib/api';
import type { CreateGroupInput, Destination, Group, GroupDetails, MyGroup } from '@/types/group';

/** Real backend API for M2. The traveller ID header is added by lib/api.ts. */
export interface GroupApi {
  listDestinations(): Promise<Destination[]>;
  createGroup(input: CreateGroupInput): Promise<Group>;
  listMyGroups(): Promise<MyGroup[]>;
  getGroup(groupId: string): Promise<GroupDetails>;
  removeMember(groupId: string, travellerId: string): Promise<Group>;
}

let destinationsCache: Promise<Destination[]> | null = null;

export const groupService: GroupApi = {
  listDestinations() {
    destinationsCache ??= apiClient.get<Destination[]>('/api/destinations').then((r) => r.data)
      .catch((error) => { destinationsCache = null; throw error; });
    return destinationsCache;
  },
  async createGroup(input) {
    const body = { ...input, itinerary: input.itinerary.trim() || null };
    return (await apiClient.post<Group>('/api/groups', body)).data;
  },
  async listMyGroups() { return (await apiClient.get<MyGroup[]>('/api/groups/mine')).data; },
  async getGroup(groupId) { return (await apiClient.get<GroupDetails>(`/api/groups/${encodeURIComponent(groupId)}`)).data; },
  async removeMember(groupId, travellerId) {
    return (await apiClient.delete<Group>(`/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(travellerId)}`)).data;
  },
};
