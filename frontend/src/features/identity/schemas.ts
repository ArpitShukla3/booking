import { z } from 'zod';
export const loginSchema = z.object({ traveller_id: z.string().trim().toUpperCase().regex(/^T-\d{3,}$/, 'Enter a Traveller ID such as T-025').max(40, 'Traveller ID is too long') });
export const createSignupSchema = (interestIds: string[]) => z.object({
  name: z.string().trim().min(1, 'Enter your full name').max(100),
  age: z.number({ error: 'Enter your age' }).int('Age must be a whole number').min(1, 'Enter an age between 1 and 120').max(120, 'Enter an age between 1 and 120'),
  gender: z.enum(['MALE', 'FEMALE'], { error: 'Choose your gender' }),
  home_city: z.string().trim().min(1, 'Enter your home city').max(100),
  home_airport: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Enter a three-letter airport code'),
  interests: z.array(z.string()).max(16).refine(values => values.every(id => interestIds.includes(id)), 'Choose interests from the catalog').refine(values => new Set(values).size === values.length, 'Choose each interest once'),
  gender_preference: z.enum(['ANY', 'SAME_GENDER'], { error: 'Choose your travel preference' }),
});
