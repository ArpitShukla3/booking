import { z } from 'zod';

export const MAX_MESSAGE = 2000;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

const access = z.enum(['ALL_MEMBERS', 'OWNER_ONLY'], { error: 'Choose "All members" or "Only the organiser"' });

export const messageSchema = z.object({
  type: z.enum(['TEXT', 'ANNOUNCEMENT'], { error: 'Message type must be TEXT or ANNOUNCEMENT' }).default('TEXT'),
  content: z.string({ error: 'Write a message' }).trim().min(1, 'Write a message').max(MAX_MESSAGE, `Keep messages under ${MAX_MESSAGE} characters`),
}).strict();

export const pollSchema = z.object({
  question: z.string({ error: 'Ask a question' }).trim().min(1, 'Ask a question').max(300, 'Keep the question under 300 characters'),
  options: z.array(z.string().trim().min(1, 'Options can’t be empty').max(100, 'Keep each option under 100 characters'), { error: 'Add the poll options' })
    .min(MIN_OPTIONS, `Add at least ${MIN_OPTIONS} options`).max(MAX_OPTIONS, `Use at most ${MAX_OPTIONS} options`)
    .refine((opts) => new Set(opts.map((o) => o.toLowerCase())).size === opts.length, 'Each option must be different'),
}).strict();

export const settingsSchema = z.object({
  messaging: access.optional(),
  polls: access.optional(),
}).strict().refine((v) => v.messaging !== undefined || v.polls !== undefined, { message: 'Change at least one setting', path: ['messaging'] });

export const voteSchema = z.object({
  option_id: z.number({ error: 'Choose an option' }).int('Choose an option').positive('Choose an option'),
}).strict();

export type MessageInput = z.output<typeof messageSchema>;
export type PollInput = z.output<typeof pollSchema>;
export type SettingsInput = z.output<typeof settingsSchema>;
