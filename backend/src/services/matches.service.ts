// M4: run the matching engine for a saved search. Reads groups via groups.helper (Track B's
// read function) and owner profiles from the same query; all rules live in matching.service.
import groupsHelper = require('../helpers/postgres/groups.helper');
import travellersHelper = require('../helpers/postgres/travellers.helper');
import searchesService = require('./searches.service.ts');
import matchingService = require('./matching.service.ts');
import groupsService = require('./groups.service.ts');
import matchFiltersService = require('./matchFilters.service.ts');
import { parseInput } from '../validation/travellers.validation.ts';
import { matchFiltersSchema, matchSortSchema } from '../validation/searches.validation.ts';
import type { CandidateRow, Match, MatchesResponse, MatchReasons } from '../types/search.ts';
import type { Traveller } from '../types/traveller.ts';

const MAX_RESULTS = 50;

function explain(r: MatchReasons, labels: Map<string, string>): string[] {
  const names = r.shared_interests.map((i) => labels.get(i) ?? i);
  return [
    `Same destination: ${r.city}`,
    `${r.shared_nights} shared nights`,
    r.budget_diff_inr === 0 ? 'Same budget' : `Budgets ${r.budget_diff_pct}% apart (₹${r.budget_diff_inr.toLocaleString('en-IN')})`,
    `${names.length} shared interests: ${names.join(', ')}`,
    r.gender,
    `${r.spots_left} ${r.spots_left === 1 ? 'spot' : 'spots'} left`,
  ];
}

async function getMatches(travellerId: string, searchId: unknown, sortParam?: unknown, filterQuery: unknown = {}): Promise<MatchesResponse> {
  const filters = parseInput(matchFiltersSchema, filterQuery ?? {});
  const search = await searchesService.getSearch(travellerId, searchId);
  const sort = matchSortSchema.parse(sortParam);
  const [candidates, interests] = await Promise.all([
    groupsHelper.listCandidatesByCity(search.city) as Promise<CandidateRow[]>,
    travellersHelper.listInterests() as Promise<{ interest: string; label: string }[]>,
  ]);
  const labels = new Map(interests.map((i) => [i.interest, i.label]));

  const eligible = candidates
    .map((candidate) => ({ candidate, result: matchingService.evaluate(search, candidate) }))
    .filter((e) => e.result !== null);
  // G1: member genders for the gender-mix filter (one query for every eligible group).
  const memberIds = [...new Set(eligible.flatMap((e) => e.candidate.member_ids))];
  const profiles: Traveller[] = await travellersHelper.findByIds(memberIds);
  const genderOf = new Map(profiles.map((p) => [p.traveller_id, p.gender]));

  const matches: Match[] = eligible.map(({ candidate, result }) => ({
    group: groupsService.toGroupDto(candidate),
    score: result!.score,
    reasons: result!.reasons,
    explanations: explain(result!.reasons, labels),
    composition: matchFiltersService.compositionOf(
      candidate.member_ids.map((id) => genderOf.get(id)).filter((g): g is 'FEMALE' | 'MALE' => Boolean(g)),
    ),
  }));
  const ranked = matchingService.rank(matches, sort);
  const filtered = matchFiltersService.applyFilters(ranked, filters);
  return {
    search, total: filtered.length, total_unfiltered: ranked.length, filters,
    facets: matchFiltersService.buildFacets(ranked, labels),
    matches: filtered.slice(0, MAX_RESULTS),
  };
}

const matchesService = { getMatches, MAX_RESULTS };
export = matchesService;
