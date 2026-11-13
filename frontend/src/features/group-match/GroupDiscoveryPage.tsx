import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { UsersRound, SlidersHorizontal, ShieldCheck, ArrowRight, History, CalendarRange, Sparkles, Wallet, MapPinned, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorState, PageContainer } from "@/components/shared/common";
import { ApiError } from "@/lib/api";
import { dateLabel, money } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { groupService } from "@/services/groupService";
import { searchService } from "@/services/searchService";
import { travellerService } from "@/services/travellerService";
import { useTravellerStore } from "@/store/useTravellerStore";
import { stagger } from "@/features/groups/media";
import type { MatchSort, SavedSearch } from "@/types/search";
import type { Traveller } from "@/types/traveller";
import { GroupSearchForm } from "./forms";
import type { SearchCatalogs } from "./forms";
import { GroupCard } from "./GroupCard";
import type { LiveSearchForm } from "./searchSchema";
import { MatchFiltersPanel } from "./MatchFiltersPanel";
import { filtersFromParams, filtersKey, NO_FILTERS, withFilters } from "./matchFilters";
import "./group-match.css";

const RULES = [
  "Same destination",
  "At least 2 shared nights",
  "Budgets within 40% of the lower one",
  "At least 2 interests shared with the owner",
  "Gender preferences work both ways",
  "A free place in the group",
];

const toSort = (value: string | null): MatchSort => (value === "overlap" || value === "budget" ? value : "score");

/** Form values: the open search, else the latest saved one, else the traveller's profile. */
function initialValues(profile: Traveller, catalogs: SearchCatalogs, search?: SavedSearch): LiveSearchForm {
  if (search) {
    const { home_city, city, check_in, check_out, budget_inr, interests, gender_preference } = search;
    return { home_city, city, check_in, check_out, budget_inr, interests, gender_preference };
  }
  const known = new Set(catalogs.interests.map((i) => i.interest));
  const home = catalogs.departureCities.find((c) => c.city.toLowerCase() === profile.home_city.toLowerCase());
  return {
    home_city: home?.city ?? "",
    city: "",
    check_in: "",
    check_out: "",
    budget_inr: undefined as unknown as number,
    interests: profile.interests.filter((i) => known.has(i)),
    gender_preference: profile.gender_preference,
  };
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Finding matching groups">
      {[0, 1, 2].map((i) => <div key={i} className="gm-skel" style={{ height: 230, ...stagger(i) }} />)}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function RecentSearches({ searches, activeId, onOpen }: { searches: SavedSearch[]; activeId: string | null; onOpen: (id: string) => void }) {
  if (!searches.length) return null;
  return (
    <section className="gm-recent" aria-label="Recent searches">
      <h3><History size={15} aria-hidden="true" />Recent searches</h3>
      <ul>
        {searches.slice(0, 5).map((s, i) => (
          <li key={s.search_id} style={stagger(i)}>
            <button type="button" className={s.search_id === activeId ? "is-active" : ""} onClick={() => onOpen(s.search_id)} aria-current={s.search_id === activeId ? "true" : undefined}>
              <strong>{s.city}</strong>
              <span>{dateLabel(s.check_in)} – {dateLabel(s.check_out)} · {money(s.budget_inr)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoMatches({ city }: { city: string }) {
  const tips = [
    { icon: CalendarRange, text: "Widen your dates. Groups need at least 2 nights in common." },
    { icon: Sparkles, text: "Add more interests. You need 2 in common with the organiser." },
    { icon: Wallet, text: "Adjust your budget. Budgets can be up to 40% apart." },
    { icon: MapPinned, text: "Try another city. Tokyo, Kyoto, Osaka, Dubai and Abu Dhabi all have groups." },
  ];
  return (
    <EmptyState
      title={`No groups in ${city} match all six conditions yet`}
      action={<Button asChild variant="outline"><Link to="/groups/new"><Plus size={15} aria-hidden="true" />Start your own group</Link></Button>}
    >
      <ul className="gm-tips">
        {tips.map(({ icon: Icon, text }, i) => (
          <li key={text} style={stagger(i)}><Icon size={16} aria-hidden="true" />{text}</li>
        ))}
      </ul>
      <p className="mt-3">Change the search on the left and press <strong>Search Groups</strong>.</p>
    </EmptyState>
  );
}

export default function GroupDiscoveryPage() {
  const traveller = useTravellerStore((s) => s.traveller)!;
  const [params, setParams] = useSearchParams();
  const searchId = params.get("search");
  const sort = toSort(params.get("sort"));
  const filters = filtersFromParams(params);
  const fKey = filtersKey(filters);
  const [recentTick, setRecentTick] = useState(0);

  const catalogs = useAsync<SearchCatalogs>(
    () => Promise.all([groupService.listDestinations(), travellerService.getInterests(), searchService.listDepartureCities()])
      .then(([destinations, interests, departureCities]) => ({ destinations, interests, departureCities })),
    "group-match-catalogs",
  );
  const recent = useAsync(() => searchService.listMySearches(), `recent:${traveller.traveller_id}:${recentTick}`);
  const results = useAsync(
    () => (searchId ? searchService.getMatches(searchId, sort, filters) : Promise.resolve(null)),
    `matches:${traveller.traveller_id}:${searchId}:${sort}:${fKey}`,
  );
  const labels = useMemo(() => new Map((catalogs.data?.interests ?? []).map((i) => [i.interest, i.label])), [catalogs.data]);

  const openSearch = (id: string) => {
    const next = withFilters(params, NO_FILTERS); // filters belong to one result list
    next.set("search", id);
    setParams(next);
  };
  const onSearch = async (values: LiveSearchForm) => {
    const saved = await searchService.createSearch(values);
    setRecentTick((t) => t + 1);
    openSearch(saved.search_id);
  };

  // Form values follow the open search (or the latest saved one / the profile). While results
  // reload we keep the last values, so the form stays mounted and searching feels instant.
  const catalogData = catalogs.data;
  const derivedSeed: LiveSearchForm | null = !catalogData ? null
    : results.data ? initialValues(traveller, catalogData, results.data.search)
    : results.error ? initialValues(traveller, catalogData)
    : !searchId && !recent.loading ? initialValues(traveller, catalogData, recent.data?.[0])
    : null;
  const [lastSeed, setLastSeed] = useState<LiveSearchForm | null>(null);
  if (derivedSeed && JSON.stringify(derivedSeed) !== JSON.stringify(lastSeed)) setLastSeed(derivedSeed);
  const seed = derivedSeed ?? lastSeed;
  const notFound = results.error instanceof ApiError && results.error.status === 404;

  return (
    <>
      <section className="discovery-hero">
        <PageContainer>
          <div>
            <span className="feature-label"><UsersRound size={19} aria-hidden="true" />Group Match</span>
            <h1>Find your perfect travel companions</h1>
            <p>Discover groups travelling to the same destination, sharing your interests and budget.</p>
          </div>
          <div className="discovery-hero-note">
            <ShieldCheck size={27} aria-hidden="true" />
            <span>Same plans.<br /><strong>A better match.</strong></span>
          </div>
        </PageContainer>
      </section>
      <PageContainer className="page-content discovery-content">
        <div className="results-layout">
          <aside className="filters-column">
            <details className="mobile-filter-shell" open>
              <summary><SlidersHorizontal size={18} aria-hidden="true" />Search filters</summary>
              {catalogs.error
                ? <ErrorState error={catalogs.error} retry={catalogs.retry} />
                : !catalogs.data || !seed
                  ? <div className="gm-skel" style={{ height: 520 }} role="status" aria-label="Loading search form" />
                  : <GroupSearchForm
                      initial={seed}
                      catalogs={catalogs.data}
                      gender={traveller.gender}
                      onSearch={onSearch}
                    />}
            </details>
            <RecentSearches searches={recent.data ?? []} activeId={searchId} onOpen={openSearch} />
            <div className="match-checks">
              <h3>What makes a match?</h3>
              <p>All six conditions must hold.</p>
              <ul>{RULES.map((rule) => <li key={rule}><ShieldCheck size={15} aria-hidden="true" />{rule}</li>)}</ul>
            </div>
          </aside>
          <section className="results-column" aria-label="Matching groups">
            <div className="results-heading">
              <div>
                <p className="results-eyebrow">Your next adventure, together</p>
                <h2>
                  {!searchId ? "Tell us about your trip"
                    : results.data ? `${results.data.search.city}: ${results.data.total_unfiltered} matching ${results.data.total_unfiltered === 1 ? "group" : "groups"}`
                    : "Finding your people…"}
                </h2>
                <p>{results.data ? `${dateLabel(results.data.search.check_in)} – ${dateLabel(results.data.search.check_out)} · ${money(results.data.search.budget_inr)} per person` : "April 2027 · Small groups, shared experiences"}</p>
              </div>
              {searchId ? (
                <div className="sort-control">
                  <label htmlFor="match-sort">Sort by</label>
                  <Select id="match-sort" name="sort" value={sort} onChange={(e) => { const next = new URLSearchParams(params); next.set("sort", e.target.value); setParams(next); }}>
                    <option value="score">Best match</option>
                    <option value="overlap">Most shared nights</option>
                    <option value="budget">Lowest trip budget</option>
                  </Select>
                </div>
              ) : null}
            </div>
            <div className="matching-summary">
              <UsersRound size={19} aria-hidden="true" />
              <p>More than the same destination. <strong>The same kind of trip.</strong></p>
              <a href="#ranking-note" className="text-link">How we match</a>
            </div>
            {!searchId ? (
              <div className="gm-intro">
                <Sparkles size={28} aria-hidden="true" />
                <h3>Search to see groups that fit you</h3>
                <p>Pick a city, your dates and budget. We only show groups that meet all six conditions, and explain why each one fits.</p>
              </div>
            ) : results.loading ? <ResultsSkeleton />
              : notFound ? <EmptyState title="We couldn’t find that search"><p>It may belong to another traveller. Run a new search on the left.</p></EmptyState>
              : results.error || !results.data ? <ErrorState error={results.error} retry={results.retry} />
              : !results.data.total_unfiltered ? <NoMatches city={results.data.search.city} />
              : (
              <>
              <MatchFiltersPanel filters={results.data.filters} facets={results.data.facets} total={results.data.total}
                totalUnfiltered={results.data.total_unfiltered} onChange={(next) => setParams(withFilters(params, next))} />
              {results.data.matches.length ? (
                <div className="space-y-4" aria-live="polite" key={`${searchId}:${sort}:${fKey}`}>
                  {results.data.matches.map((match, i) => (
                    <GroupCard key={match.group.group_id} match={match} labels={labels} style={stagger(i)} />
                  ))}
                  {results.data.total > results.data.matches.length
                    ? <p className="field-hint">Showing the top {results.data.matches.length} of {results.data.total} groups.</p> : null}
                </div>
              ) : (
                <EmptyState title="No groups match these filters"
                  action={<Button variant="outline" onClick={() => setParams(withFilters(params, NO_FILTERS))}>Clear filters</Button>}>
                  <p>All {results.data.total_unfiltered} groups still match your trip. Loosen a filter to see them.</p>
                </EmptyState>
              )}
              </>
              )}
            <div className="ranking-note" id="ranking-note">
              <h3>Compatible first. Then a little closer.</h3>
              <p>
                Every group shown meets all six rules, checked on our servers. Matches are ranked by a score out of 100:
                shared interests with the organiser (up to 50, full marks at 4), budget closeness (up to 30) and how much of
                your trip overlaps theirs (up to 20). Ties go to more shared interests, a closer budget, the earlier check-in,
                then the group ID.
              </p>
              <Link to="/" className="text-link">Back to travel inspiration <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          </section>
        </div>
      </PageContainer>
    </>
  );
}
