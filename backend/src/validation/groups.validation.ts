import { z } from 'zod';
import { isoDate, WINDOW_END, WINDOW_START } from './dates.ts';

export { WINDOW_END, WINDOW_START };

export const MIN_SIZE = 1;
export const MAX_SIZE = 4;

export const createGroupSchema = z.object({
  name: z.string({ error: 'Give your group a name' }).trim().min(1, 'Give your group a name').max(100, 'Keep the group name under 100 characters'),
  city: z.string({ error: 'Choose a destination' }).trim().min(1, 'Choose a destination'),
  check_in: isoDate('check-in').refine((v) => v >= WINDOW_START, `Check-in must be on or after 1 Apr 2027 (${WINDOW_START})`)
    .refine((v) => v < WINDOW_END, `Check-in must be before 20 Apr 2027 (${WINDOW_END})`),
  check_out: isoDate('check-out').refine((v) => v <= WINDOW_END, `Check-out must be on or before 20 Apr 2027 (${WINDOW_END})`),
  max_size: z.number({ error: 'Choose how many people in total' }).int('Group size must be a whole number')
    .min(MIN_SIZE, `Group size must be between ${MIN_SIZE} and ${MAX_SIZE} people, including you`)
    .max(MAX_SIZE, `Group size must be between ${MIN_SIZE} and ${MAX_SIZE} people, including you`),
  budget_inr: z.number({ error: 'Enter an approximate budget per person' }).int('Budget must be a whole number of rupees')
    .positive('Budget must be more than ₹0 per person').max(10_000_000, 'Budget looks too large; enter it per person in INR'),
  itinerary: z.string().trim().max(4000, 'Keep the itinerary under 4,000 characters').nullish()
    .transform((v) => (v ? v : null)),
}).strict().superRefine((value, ctx) => {
  if (value.check_out <= value.check_in) {
    ctx.addIssue({ code: 'custom', path: ['check_out'], message: 'Check-out must be after check-in' });
  }
});

export type CreateGroupInput = z.output<typeof createGroupSchema>;
