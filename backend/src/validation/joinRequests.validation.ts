import { z } from 'zod';

export const MAX_REQUEST_MESSAGE = 500;

/** Optional note from the seeker to the organiser; blank becomes null. */
export const createRequestSchema = z.object({
  message: z.string({ error: 'The note must be text' }).trim()
    .max(MAX_REQUEST_MESSAGE, `Keep the note under ${MAX_REQUEST_MESSAGE} characters`)
    .nullish()
    .transform((v) => (v ? v : null)),
}).strict();
