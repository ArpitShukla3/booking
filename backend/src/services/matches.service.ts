// M4: run the matching engine for a saved search. Reads groups via groups.helper (Track B's
// read function) and owner profiles from the same query; all rules live in matching.service.
import groupsHelper = require('../helpers/postgres/groups.helper');
import travellersHelper = require('../helpers/postgres/travellers.helper');
import searchesService = require('./searches.service.ts');
import matchingService = require('./matching.service.ts');
import groupsService = require('./groups.service.ts');
import { matchSortSchema } from '../validation/searches.validation.ts';
import type { CandidateRow, Match, MatchesResponse, MatchReasons } from '../types/search.ts';

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

async function getMatches(travellerId: string, searchId: unknown, sortParam?: unknown): Promise<MatchesResponse> {
  const search = await searchesService.getSearch(travellerId, searchId);
  const sort = matchSortSchema.parse(sortParam);
  const [candidates, interests] = await Promise.all([
    groupsHelper.listCandidatesByCity(search.city) as Promise<CandidateRow[]>,
    travellersHelper.listInterests() as Promise<{ interest: string; label: string }[]>,
  ]);
  const labels = new Map(interests.map((i) => [i.interest, i.label]));

  const matches: Match[] = [];
  for (const candidate of candidates) {
    const result = matchingService.evaluate(search, candidate);
    if (!result) continue;
    matches.push({
      group: groupsService.toGroupDto(candidate),
      score: result.score,
      reasons: result.reasons,
      explanations: explain(result.reasons, labels),
    });
  }
  const ranked = matchingService.rank(matches, sort);
  return { search, total: ranked.length, matches: ranked.slice(0, MAX_RESULTS) };
}

const matchesService = { getMatches, MAX_RESULTS };
export = matchesService;
