import { apiClient } from '@/lib/api';
import type { DecidedJoinRequest, IncomingJoinRequest, JoinRequest, MyJoinRequest, OwnerJoinRequest } from '@/types/joinRequest';

/** Real backend API for M5. The traveller ID header is added by lib/api.ts. */
export interface JoinRequestApi {
  sendInterest(groupId: string, message?: string): Promise<JoinRequest>;
  cancel(requestId: string): Promise<JoinRequest>;
  listForGroup(groupId: string): Promise<OwnerJoinRequest[]>;
  listIncoming(): Promise<IncomingJoinRequest[]>;
  listMine(): Promise<MyJoinRequest[]>;
  approve(requestId: string): Promise<DecidedJoinRequest>;
  reject(requestId: string): Promise<DecidedJoinRequest>;
}

const group = (groupId: string) => `/api/groups/${encodeURIComponent(groupId)}/join-requests`;
const request = (requestId: string, action: 'approve' | 'reject' | 'cancel') => `/api/join-requests/${encodeURIComponent(requestId)}/${action}`;

export const joinRequestService: JoinRequestApi = {
  async sendInterest(groupId, message) {
    return (await apiClient.post<JoinRequest>(group(groupId), { message: message?.trim() || null })).data;
  },
  async cancel(requestId) { return (await apiClient.post<JoinRequest>(request(requestId, 'cancel'))).data; },
  async listForGroup(groupId) { return (await apiClient.get<OwnerJoinRequest[]>(group(groupId))).data; },
  async listIncoming() { return (await apiClient.get<IncomingJoinRequest[]>('/api/join-requests/incoming')).data; },
  async listMine() { return (await apiClient.get<MyJoinRequest[]>('/api/join-requests/mine')).data; },
  async approve(requestId) { return (await apiClient.post<DecidedJoinRequest>(request(requestId, 'approve'))).data; },
  async reject(requestId) { return (await apiClient.post<DecidedJoinRequest>(request(requestId, 'reject'))).data; },
};
