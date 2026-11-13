import { Link, useSearchParams } from "react-router-dom";
import {
  UsersRound,
  SlidersHorizontal,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import {
  DemoNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
} from "@/components/shared/common";
import { useAsync } from "@/lib/useAsync";
import { groupMatchService as service } from "@/services/groupMatchService";
import { useDemoTravellerStore } from "@/store/useDemoTravellerStore";
import { GroupSearchForm } from "./forms";
import {
  defaultSearch,
  searchFromParams,
  searchToParams,
} from "@/lib/searchParams";
import { GroupCard } from "./GroupCard";
import type { MatchSort } from "@/types/groupMatch";

export default function GroupDiscoveryPage() {
  const [params, setParams] = useSearchParams();
  const actor = useDemoTravellerStore((s) => s.traveller_id) || "T-002";
  const input = searchFromParams(params);
  const sort: MatchSort =
    params.get("sort") === "budget"
      ? "budget"
      : params.get("sort") === "overlap"
        ? "overlap"
        : "score";
  const query = useAsync(
    () => service.searchGroups(input, actor, sort),
    `${actor}:${params.toString()}`,
  );
  return (
    <>
      <section className="discovery-hero">
        <PageContainer>
          <div>
            <span className="feature-label">
              <UsersRound size={19} aria-hidden="true" />
              Group Match
            </span>
            <h1>Find your perfect travel companions</h1>
            <p>
              Discover groups travelling to the same destination, sharing your
              interests and budget.
            </p>
          </div>
          <div className="discovery-hero-note">
            <ShieldCheck size={27} aria-hidden="true" />
            <span>
              Same plans.
              <br />
              <strong>A better match.</strong>
            </span>
          </div>
        </PageContainer>
      </section>
      <PageContainer className="page-content discovery-content">
        <DemoNotice />
        <div className="results-layout">
          <aside className="filters-column">
            <details className="mobile-filter-shell" open>
              <summary>
                <SlidersHorizontal size={18} aria-hidden="true" />
                Search filters
              </summary>
              <GroupSearchForm
                input={input}
                loading={query.loading}
                onSearch={(values) => {
                  const next = searchToParams(values);
                  next.set("sort", sort);
                  setParams(next);
                }}
              />
            </details>
            <div className="match-checks">
              <h3>What makes a match?</h3>
              <p>All six conditions must hold.</p>
              <ul>
                {[
                  "Same destination",
                  "At least 2 shared nights",
                  "Compatible budgets",
                  "At least 2 shared interests",
                  "Mutual gender preferences",
                  "A place in the group",
                ].map((rule) => (
                  <li key={rule}>
                    <ShieldCheck size={15} aria-hidden="true" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
          <section className="results-column" aria-label="Matching groups">
            <div className="results-heading">
              <div>
                <p className="results-eyebrow">Your next adventure, together</p>
                <h2>
                  {input.city}:{" "}
                  {query.data
                    ? `${query.data.length} matching ${query.data.length === 1 ? "group" : "groups"}`
                    : "finding your people"}
                </h2>
                <p>April 2027 · Small groups, shared experiences</p>
              </div>
              <div className="sort-control">
                <label htmlFor="match-sort">Sort by</label>
                <Select
                  id="match-sort"
                  name="sort"
                  value={sort}
                  onChange={(event) => {
                    const next = new URLSearchParams(params);
                    next.set("sort", event.target.value);
                    setParams(next);
                  }}
                >
                  <option value="score">Demo match score</option>
                  <option value="overlap">Shared nights</option>
                  <option value="budget">Lowest trip budget</option>
                </Select>
              </div>
            </div>
            <div className="matching-summary">
              <UsersRound size={19} aria-hidden="true" />
              <p>
                More than the same destination.{" "}
                <strong>The same kind of trip.</strong>
              </p>
              <a href="#ranking-note" className="text-link">
                How we match
              </a>
            </div>
            {query.loading ? (
              <LoadingState />
            ) : query.error ? (
              <ErrorState error={query.error} retry={query.retry} />
            ) : query.data?.length ? (
              <div className="space-y-4" aria-live="polite">
                {query.data.map((match) => (
                  <GroupCard
                    key={match.group.group_id}
                    group={match.group}
                    ownerName={match.owner.name}
                    match={match}
                    searchParams={searchToParams(input).toString()}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Your people may be on a different plan"
                action={
                  <Button
                    variant="outline"
                    onClick={() => setParams(searchToParams(defaultSearch))}
                  >
                    Try the Kyoto sample search
                  </Button>
                }
              >
                <p>
                  No groups meet all six conditions. Try different dates,
                  interests or a nearby budget. Use Priya Shah in the traveller
                  menu for the Kyoto sample.
                </p>
              </EmptyState>
            )}
            <div className="ranking-note" id="ranking-note">
              <h3>Compatible first. Then a little closer.</h3>
              <p>
                Every group shown meets all six rules. Demo scores rank eligible
                groups: 10 points per shared night, 5 per shared interest, plus
                up to 20 for budget closeness. Scores are points, not a
                probability. These temporary calculations will move to the
                backend.
              </p>
              <Link to="/" className="text-link">
                Back to travel inspiration{" "}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      </PageContainer>
    </>
  );
}
