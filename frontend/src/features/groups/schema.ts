import { z } from 'zod';

// Mirrors backend/src/validation/groups.validation.ts for instant feedback.
// The backend stays the source of truth; its field errors are shown too.
export const WINDOW_START = '2027-04-01';
export const WINDOW_END = '2027-04-20';

const date = (label: string) => z.string().min(1, `Choose a ${label} date`).regex(/^\d{4}-\d{2}-\d{2}$/, `Choose a ${label} date`);

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Give your group a name').max(100, 'Keep the group name under 100 characters'),
  city: z.string().min(1, 'Choose a destination'),
  check_in: date('check-in')
    .refine((v) => v >= WINDOW_START, 'Check-in must be on or after 1 Apr 2027')
    .refine((v) => v < WINDOW_END, 'Check-in must be before 20 Apr 2027'),
  check_out: date('check-out').refine((v) => v <= WINDOW_END, 'Check-out must be on or before 20 Apr 2027'),
  max_size: z.number().int().min(1, 'Choose 1 to 4 people').max(4, 'Choose 1 to 4 people'),
  budget_inr: z.number({ error: 'Enter a budget per person' }).int('Use whole rupees').positive('Budget must be more than ₹0').max(10_000_000, 'Enter the budget per person'),
  itinerary: z.string().max(4000, 'Keep the itinerary under 4,000 characters'),
}).refine((v) => !v.check_in || !v.check_out || v.check_out > v.check_in, { path: ['check_out'], message: 'Check-out must be after check-in' });

export type CreateGroupForm = z.infer<typeof createGroupSchema>;

/** Nights between two YYYY-MM-DD strings, or 0 if incomplete/invalid. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) return 0;
  const day = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };
  return Math.max(0, day(checkOut) - day(checkIn));
}

/** "Just you" / "you + 2 more" */
export function sizeLabel(maxSize: number): string {
  return maxSize <= 1 ? 'Just you' : `You + ${maxSize - 1} more`;
}
