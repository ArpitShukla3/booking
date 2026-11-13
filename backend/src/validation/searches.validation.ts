import { z } from 'zod';
import { isoDate, WINDOW_END, WINDOW_MESSAGE, WINDOW_START } from './dates.ts';

/** Seeker search (M3). Gender is NOT accepted here: it is taken from the profile. */
export const createSearchSchema = z.object({
  home_city: z.string({ error: 'Choose your home city' }).trim().min(1, 'Choose your home city').max(100),
  city: z.string({ error: 'Choose a destination' }).trim().min(1, 'Choose a destination'),
  check_in: isoDate('check-in')
    .refine((v) => v >= WINDOW_START && v < WINDOW_END, `${WINDOW_MESSAGE}. Check-in must be between 1 and 19 April 2027`),
  check_out: isoDate('check-out')
    .refine((v) => v > WINDOW_START && v <= WINDOW_END, `${WINDOW_MESSAGE}. Check-out must be between 2 and 20 April 2027`),
  budget_inr: z.number({ error: 'Enter your budget per person' }).int('Budget must be a whole number of rupees')
    .positive('Budget must be more than ₹0 per person').max(10_000_000, 'Enter the budget per person in INR'),
  interests: z.array(z.string().trim().min(1).max(60), { error: 'Choose your interests' })
    .min(2, 'Choose at least 2 interests. Groups match on 2 or more shared interests')
    .max(16, 'Choose at most 16 interests')
    .refine((v) => new Set(v).size === v.length, 'Choose each interest only once'),
  gender_preference: z.enum(['ANY', 'SAME_GENDER'], { error: 'Choose “Any gender” or “Same gender”' }),
}).strict().superRefine((value, ctx) => {
  if (value.check_out <= value.check_in) {
    ctx.addIssue({ code: 'custom', path: ['check_out'], message: 'Check-out must be after check-in' });
  }
});

export const searchIdSchema = z.string().trim().toUpperCase().regex(/^S-\d+$/, 'Search not found');
export const matchSortSchema = z.enum(['score', 'overlap', 'budget']).catch('score');

/** G1 query filters: ?shared=3&must=TEMPLES,STREET_FOOD&mix=WOMEN_ONLY (all optional). */
export const matchFiltersSchema = z.object({
  shared: z.coerce.number({ error: 'Shared interests must be a number' }).int('Shared interests must be a whole number')
    .min(2, 'Every match already shares at least 2 interests').max(16, 'There are only 16 interests').optional(),
  must: z.string().max(400).optional()
    .transform((v) => [...new Set((v ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))])
    .refine((list) => list.length <= 16 && list.every((i) => /^[A-Z_]{2,40}$/.test(i)), 'Use interest IDs such as TEMPLES,STREET_FOOD'),
  mix: z.enum(['WOMEN_ONLY', 'MEN_ONLY', 'MIXED'], { error: 'Group mix must be WOMEN_ONLY, MEN_ONLY or MIXED' }).optional(),
}).transform((q) => ({ min_shared: q.shared ?? null, must: q.must, composition: q.mix ?? null }));

export type CreateSearchInput = z.output<typeof createSearchSchema>;
