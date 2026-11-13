import helper = require('../helpers/postgres/travellers.helper');
import HttpError = require('../utils/HttpError');
import { parseInput, signupSchema, signInSchema, travellerIdSchema } from '../validation/travellers.validation.ts';
import type { Interest, Traveller } from '../types/traveller.ts';

async function databaseCall<T>(call: () => Promise<T>): Promise<T> {
  try { return await call(); }
  catch (error) {
    if ((error as { code?: string }).code === '23505') throw HttpError.conflict('Traveller ID conflict. Please try signing up again.');
    throw new HttpError(503, 'The database is temporarily unavailable. Please try again.', undefined);
  }
}
export async function createTraveller(input: unknown): Promise<Traveller> {
  const profile = parseInput(signupSchema, input);
  const known = await databaseCall(() => helper.findInterestIds(profile.interests));
  if (profile.interests.some(interest => !known.includes(interest))) throw HttpError.badRequest('Please check your interests', { interests: 'Choose interests from the current catalog' });
  return databaseCall(() => helper.insert(profile));
}
export async function getTraveller(input: unknown): Promise<Traveller> {
  const id = parseInput(travellerIdSchema, input);
  const traveller = await databaseCall(() => helper.findById(id));
  if (!traveller) throw HttpError.notFound('Traveller ID not found');
  return traveller;
}
export async function signIn(input: unknown): Promise<Traveller> { return getTraveller(parseInput(signInSchema, input).traveller_id); }
export async function getInterests(): Promise<Interest[]> { return databaseCall(() => helper.listInterests()); }
