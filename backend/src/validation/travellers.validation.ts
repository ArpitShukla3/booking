import { z } from 'zod';
import HttpError = require('../utils/HttpError');
export const travellerIdSchema = z.string().trim().toUpperCase().regex(/^T-\d{3,}$/, 'Enter a Traveller ID such as T-025').max(40);
export const signInSchema = z.object({ traveller_id: travellerIdSchema }).strict();
export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your full name').max(100),
  age: z.number().int('Age must be a whole number').min(1, 'Enter an age between 1 and 120').max(120),
  gender: z.enum(['MALE', 'FEMALE']),
  home_city: z.string().trim().min(1, 'Enter your home city').max(100),
  home_airport: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Enter a three-letter airport code'),
  interests: z.array(z.string().min(1).max(60)).max(16).refine(values => new Set(values).size === values.length, 'Choose each interest only once'),
  gender_preference: z.enum(['ANY', 'SAME_GENDER']),
}).strict();
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) fields[String(issue.path[0] || '_form')] ??= issue.message;
    throw HttpError.badRequest('Please check the highlighted fields', fields);
  }
  return result.data;
}
