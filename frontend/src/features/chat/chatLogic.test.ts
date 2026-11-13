import { describe, expect, it } from 'vitest';
import { applyPollVote, composerModes, dayLabel, mergeMessages, messageNumber, messageTime, pollPercent, validatePoll } from './chatLogic';
import type { ChatMessage } from '@/types/chat';

const owner = { can_message: true, can_poll: true, can_announce: true, can_manage: true };
const member = { can_message: true, can_poll: true, can_announce: false, can_manage: false };
const locked = { can_message: false, can_poll: false, can_announce: false, can_manage: false };
const msg = (id: string, content = id) => ({ message_id: id, content }) as ChatMessage;

describe('composerModes', () => {
  it('owner can use every tab', () => {
    expect(composerModes(owner).every((m) => m.allowed)).toBe(true);
  });
  it('members cannot announce, with a reason', () => {
    const announce = composerModes(member).find((m) => m.mode === 'ANNOUNCEMENT')!;
    expect(announce.allowed).toBe(false);
    expect(announce.reason).toMatch(/organiser/);
  });
  it('OWNER_ONLY settings lock messages and polls for members', () => {
    expect(composerModes(locked).filter((m) => m.allowed)).toEqual([]);
  });
});

describe('mergeMessages / messageNumber', () => {
  it('dedupes by id, replaces updated copies and sorts numerically', () => {
    const merged = mergeMessages([msg('M-1002'), msg('M-1001')], [msg('M-1010'), msg('M-1002', 'edited')]);
    expect(merged.map((m) => m.message_id)).toEqual(['M-1001', 'M-1002', 'M-1010']);
    expect(merged[1].content).toBe('edited');
  });
  it('compares M-999 < M-1000 numerically, not as text', () => {
    expect(mergeMessages([msg('M-1000')], [msg('M-999')]).map((m) => m.message_id)).toEqual(['M-999', 'M-1000']);
    expect(messageNumber('M-1042')).toBe(1042);
    expect(messageNumber('oops')).toBe(0);
  });
});

describe('polls', () => {
  const poll = { options: [{ option_id: 1, label: 'Nara', votes: 2 }, { option_id: 2, label: 'Osaka', votes: 1 }], total_votes: 3, my_option_id: null };
  it('pollPercent rounds and handles zero votes', () => {
    expect(pollPercent(poll, 2)).toBe(67);
    expect(pollPercent({ total_votes: 0 }, 0)).toBe(0);
  });
  it('first vote adds one; changing moves it; same option is a no-op', () => {
    const voted = applyPollVote(poll, 2);
    expect(voted.options.map((o) => o.votes)).toEqual([2, 2]);
    expect(voted.total_votes).toBe(4);
    const moved = applyPollVote(voted, 1);
    expect(moved.options.map((o) => o.votes)).toEqual([3, 1]);
    expect(moved.total_votes).toBe(4);
    expect(applyPollVote(moved, 1)).toBe(moved);
  });
  it('validatePoll', () => {
    expect(validatePoll('Day trip?', ['Nara', 'Osaka', ''])).toBeNull();
    expect(validatePoll('  ', ['A', 'B'])).toBe('Ask a question');
    expect(validatePoll('Q', ['A', ' '])).toBe('Add at least 2 options');
    expect(validatePoll('Q', ['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toBe('Use at most 6 options');
    expect(validatePoll('Q', ['Nara', 'nara '])).toBe('Each option must be different');
  });
});

describe('time labels', () => {
  const now = new Date(2026, 10, 13, 18, 0);
  it('messageTime: today, yesterday, older', () => {
    expect(messageTime(new Date(2026, 10, 13, 9, 5).toISOString(), now)).toBe('09:05');
    expect(messageTime(new Date(2026, 10, 12, 21, 30).toISOString(), now)).toBe('Yesterday 21:30');
    expect(messageTime(new Date(2026, 10, 2, 8, 0).toISOString(), now)).toBe('2 Nov, 08:00');
  });
  it('dayLabel', () => {
    expect(dayLabel(new Date(2026, 10, 13, 1).toISOString(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 12, 23).toISOString(), now)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 10, 10, 12).toISOString(), now)).toMatch(/10 Nov/);
  });
});
