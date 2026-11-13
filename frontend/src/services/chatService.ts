import { apiClient } from '@/lib/api';
import type { Chat, ChatAccess, ChatMessage, PollInput } from '@/types/chat';

/** Real backend API for the S1 team chat. The traveller ID header is added by lib/api.ts. */
export interface ChatApi {
  getChat(groupId: string): Promise<Chat>;
  listMessages(groupId: string, after?: string): Promise<ChatMessage[]>;
  sendMessage(groupId: string, content: string, type?: 'TEXT' | 'ANNOUNCEMENT'): Promise<ChatMessage>;
  createPoll(groupId: string, poll: PollInput): Promise<ChatMessage>;
  vote(groupId: string, messageId: string, optionId: number): Promise<ChatMessage>;
  updateSettings(groupId: string, settings: Partial<Record<'messaging' | 'polls', ChatAccess>>): Promise<Chat>;
}

const base = (groupId: string) => `/api/groups/${encodeURIComponent(groupId)}/chat`;

export const chatService: ChatApi = {
  async getChat(groupId) { return (await apiClient.get<Chat>(base(groupId))).data; },
  async listMessages(groupId, after) {
    return (await apiClient.get<ChatMessage[]>(`${base(groupId)}/messages`, { params: after ? { after } : undefined })).data;
  },
  async sendMessage(groupId, content, type = 'TEXT') { return (await apiClient.post<ChatMessage>(`${base(groupId)}/messages`, { type, content })).data; },
  async createPoll(groupId, poll) { return (await apiClient.post<ChatMessage>(`${base(groupId)}/polls`, poll)).data; },
  async vote(groupId, messageId, optionId) {
    return (await apiClient.post<ChatMessage>(`${base(groupId)}/polls/${encodeURIComponent(messageId)}/vote`, { option_id: optionId })).data;
  },
  async updateSettings(groupId, settings) { return (await apiClient.patch<Chat>(`${base(groupId)}/settings`, settings)).data; },
};
