export type ChatAccess = 'ALL_MEMBERS' | 'OWNER_ONLY';
export type ChatMessageType = 'TEXT' | 'ANNOUNCEMENT' | 'POLL';

/** Row returned by groupChat.helper for group_chats. */
export interface ChatRow {
  chat_id: string; group_id: string; messaging: ChatAccess; polls: ChatAccess;
  created_at: string | Date; updated_at: string | Date;
}
export interface MessageRow {
  seq: string | number; message_id: string; chat_id: string; sender_id: string; sender_name: string;
  type: ChatMessageType; content: string; created_at: string | Date;
}
export interface PollOptionRow { option_id: number; message_id: string; label: string; position: number; votes: string | number }

/** What the current traveller may do in this chat. */
export interface ChatPermissions { can_message: boolean; can_poll: boolean; can_announce: boolean; can_manage: boolean }

export interface Chat {
  chat_id: string; group_id: string; group_name: string;
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
  message_id: string; chat_id: string; type: ChatMessageType; content: string; created_at: string | Date;
  sender: { traveller_id: string; name: string; is_owner: boolean };
  poll: ChatPoll | null;
}
