import { z } from 'zod';

// Instant client feedback. The backend re-validates everything and its messages win.
export const WINDOW_START = '2027-04-01';
export const WINDOW_END = '2027-04-20';
const windowMsg = 'Only 1–20 April 2027 is available';

export const liveSearchSchema = z.object({
  home_city: z.string().min(1, 'Choose your home city'),
  city: z.string().min(1, 'Choose a destination'),
  check_in: z.string().min(1, 'Choose a check-in date').refine((v) => v >= WINDOW_START && v < WINDOW_END, windowMsg),
  check_out: z.string().min(1, 'Choose a check-out date').refine((v) => v > WINDOW_START && v <= WINDOW_END, windowMsg),
  budget_inr: z.number({ error: 'Enter your budget per person' }).int('Use whole rupees').positive('Budget must be more than ₹0').max(10_000_000, 'Enter the budget per person'),
  interests: z.array(z.string()).min(2, 'Choose at least two interests'),
  gender_preference: z.enum(['ANY', 'SAME_GENDER']),
}).refine((v) => !v.check_in || !v.check_out || v.check_out > v.check_in, { path: ['check_out'], message: 'Check-out must be after check-in' });

export type LiveSearchForm = z.infer<typeof liveSearchSchema>;

export function nights(checkIn: string, checkOut: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) return 0;
  const day = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };
  return Math.max(0, day(checkOut) - day(checkIn));
}
