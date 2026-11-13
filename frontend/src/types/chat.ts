/** S1 team chat DTOs as returned by the backend. */
export type ChatAccess = 'ALL_MEMBERS' | 'OWNER_ONLY';
export type ChatMessageType = 'TEXT' | 'ANNOUNCEMENT' | 'POLL';

export interface ChatPermissions { can_message: boolean; can_poll: boolean; can_announce: boolean; can_manage: boolean }

export interface Chat {
  chat_id: string;
  group_id: string;
  group_name: string;
  settings: { messaging: ChatAccess; polls: ChatAccess };
  my_permissions: ChatPermissions;
  members: { traveller_id: string; name: string; is_owner: boolean }[];
}

export interface ChatPoll {
  options: { option_id: number; label: string; votes: number }[];
  total_votes: number;
  my_option_id: number | null;
}

export interface ChatMessage {
  message_id: string;
  chat_id: string;
  type: ChatMessageType;
  content: string;
  created_at: string;
  sender: { traveller_id: string; name: string; is_owner: boolean };
  poll: ChatPoll | null;
}

export interface PollInput { question: string; options: string[] }
