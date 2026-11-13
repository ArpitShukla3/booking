import { z } from 'zod';

// Data window of the hackathon pack. Dates stay YYYY-MM-DD strings everywhere.
export const WINDOW_START = '2027-04-01';
export const WINDOW_END = '2027-04-20';
export const WINDOW_MESSAGE = 'Only 1–20 April 2027 is available';

export function isRealDate(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
}

export const isoDate = (label: string) => z.string({ error: `Choose a ${label} date` })
  .regex(/^\d{4}-\d{2}-\d{2}$/, `Use the YYYY-MM-DD format for the ${label} date`)
  .refine(isRealDate, `The ${label} date is not a real calendar date`);
