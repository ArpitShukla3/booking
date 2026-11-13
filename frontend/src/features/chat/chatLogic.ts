import type { ChatMessage, ChatPermissions, ChatPoll } from '@/types/chat';

export type ComposerMode = 'TEXT' | 'ANNOUNCEMENT' | 'POLL';

export interface ModeAccess { mode: ComposerMode; label: string; allowed: boolean; reason: string }

/** Which composer tabs the traveller can use, with a reason when they can't. Mirrors the backend rules. */
export function composerModes(can: ChatPermissions): ModeAccess[] {
  return [
    { mode: 'TEXT', label: 'Message', allowed: can.can_message, reason: can.can_message ? '' : 'The organiser has limited messages to themselves. You can still vote in polls.' },
    { mode: 'ANNOUNCEMENT', label: 'Announcement', allowed: can.can_announce, reason: can.can_announce ? '' : 'Only the organiser can post announcements.' },
    { mode: 'POLL', label: 'Poll', allowed: can.can_poll, reason: can.can_poll ? '' : 'The organiser has limited polls to themselves.' },
  ];
}

/** Adds new messages to the list without duplicates, ordered by message number. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.message_id, m]));
  for (const m of incoming) byId.set(m.message_id, m);
  return [...byId.values()].sort((a, b) => messageNumber(a.message_id) - messageNumber(b.message_id));
}

export const messageNumber = (id: string) => Number(/^M-(\d+)$/.exec(id)?.[1] ?? 0);

/** Percent of votes for one option, rounded; 0 when nobody voted. */
export const pollPercent = (poll: Pick<ChatPoll, 'total_votes'>, votes: number) =>
  poll.total_votes ? Math.round((votes / poll.total_votes) * 100) : 0;

/** Optimistic vote: move my vote to `optionId` and adjust the counts. */
export function applyPollVote(poll: ChatPoll, optionId: number): ChatPoll {
  if (poll.my_option_id === optionId) return poll;
  const options = poll.options.map((o) => ({
    ...o,
    votes: o.votes + (o.option_id === optionId ? 1 : 0) - (o.option_id === poll.my_option_id ? 1 : 0),
  }));
  return { options, total_votes: poll.my_option_id === null ? poll.total_votes + 1 : poll.total_votes, my_option_id: optionId };
}

/** Cleans poll form input: trims, drops empty rows. Returns an error message or null. */
export function validatePoll(question: string, options: string[]): string | null {
  const filled = options.map((o) => o.trim()).filter(Boolean);
  if (!question.trim()) return 'Ask a question';
  if (filled.length < 2) return 'Add at least 2 options';
  if (filled.length > 6) return 'Use at most 6 options';
  if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) return 'Each option must be different';
  return null;
}

/** "14:05" today, "Yesterday 14:05", or "12 Nov, 14:05". */
export function messageTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return time;
  if (diff === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}

/** Day separator label for a message ("Today", "Yesterday", "Fri 13 Nov"). */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
