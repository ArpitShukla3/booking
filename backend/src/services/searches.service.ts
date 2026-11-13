// M3: validate and save a seeker's search; list and read saved searches.
import searchesHelper = require('../helpers/postgres/searches.helper');
import lookupsHelper = require('../helpers/postgres/lookups.helper');
import travellersHelper = require('../helpers/postgres/travellers.helper');
import HttpError = require('../utils/HttpError');
import { parseInput } from '../validation/travellers.validation.ts';
import { createSearchSchema, searchIdSchema } from '../validation/searches.validation.ts';
import type { Search } from '../types/search.ts';
import type { Traveller } from '../types/traveller.ts';

const FIELDS_MESSAGE = 'Please check the highlighted fields';

async function createSearch(seeker: Traveller, body: unknown): Promise<Search> {
  const input = parseInput(createSearchSchema, body);
  const fields: Record<string, string> = {};

  const [destination, home, knownInterests] = await Promise.all([
    lookupsHelper.findDestination(input.city),
    lookupsHelper.findDepartureCity(input.home_city),
    travellersHelper.findInterestIds(input.interests),
  ]);
  if (!destination) fields.city = `City not available: "${input.city}". Choose Tokyo, Kyoto, Osaka, Dubai or Abu Dhabi.`;
  if (!home) fields.home_city = `We don't fly from "${input.home_city}" yet. Choose one of the listed home cities.`;
  const unknown = input.interests.filter((i) => !knownInterests.includes(i));
  if (unknown.length) fields.interests = `Unknown interest: ${unknown.join(', ')}. Choose from the list.`;
  if (Object.keys(fields).length) throw HttpError.badRequest(FIELDS_MESSAGE, fields);

  const searchId: string = await searchesHelper.insert({
    traveller_id: seeker.traveller_id,
    home_city: home.city,
    city: destination.city,
    check_in: input.check_in,
    check_out: input.check_out,
    budget_inr: input.budget_inr,
    interests: input.interests,
    gender: seeker.gender, // from the profile, never from the request
    gender_preference: input.gender_preference,
  });
  return searchesHelper.findById(searchId);
}

/** A saved search that belongs to this traveller (404 otherwise; we don't reveal others' searches). */
async function getSearch(travellerId: string, rawId: unknown): Promise<Search> {
  const parsed = searchIdSchema.safeParse(rawId);
  if (!parsed.success) throw HttpError.notFound('Search not found');
  const search: Search | undefined = await searchesHelper.findById(parsed.data);
  if (!search || search.traveller_id !== travellerId) throw HttpError.notFound('Search not found');
  return search;
}

async function listMySearches(travellerId: string): Promise<Search[]> {
  return searchesHelper.listByTraveller(travellerId, 10);
}

async function listDepartureCities() {
  return lookupsHelper.listDepartureCities();
}

const searchesService = { createSearch, getSearch, listMySearches, listDepartureCities };
export = searchesService;
