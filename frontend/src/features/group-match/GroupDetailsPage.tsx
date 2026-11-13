import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  MapPin,
  UsersRound,
  Clock3,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DemoNotice,
  ErrorState,
  InterestTags,
  LoadingState,
  MatchExplanation,
  PageContainer,
  Photo,
} from "@/components/shared/common";
import { useAsync } from "@/lib/useAsync";
import { tripDates, money } from "@/lib/format";
import { destinationImage } from "@/data/destinations";
import { groupMatchService as service } from "@/services/groupMatchService";
import { useDemoTravellerStore } from "@/store/useDemoTravellerStore";
import { searchFromParams } from "@/lib/searchParams";
import type { Traveller } from "@/types/groupMatch";

export function GroupMemberCard({
  traveller,
  owner = false,
}: {
  traveller: Traveller;
  owner?: boolean;
}) {
  return (
    <article className="member-card">
      <div className="flex items-center gap-3">
        <span className="avatar">{traveller.name.charAt(0)}</span>
        <div>
          <h3>{traveller.name}</h3>
          <p>
            {traveller.age} years · {traveller.gender.toLowerCase()}
            {owner ? " · Group owner" : ""}
          </p>
        </div>
      </div>
      <p className="icon-line">
        <MapPin size={14} aria-hidden="true" />
        {traveller.home_city} · {traveller.home_airport}
      </p>
      <InterestTags values={traveller.interests} />
    </article>
  );
}
export default function GroupDetailsPage() {
  const { group_id = "" } = useParams();
  const [params] = useSearchParams();
  const search = searchFromParams(params);
  const actor = useDemoTravellerStore((s) => s.traveller_id) || "T-002";
  const query = useAsync(
    () => service.getGroupDetails(group_id, search, actor),
    `${group_id}:${actor}:${params.toString()}`,
  );
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  if (query.loading)
    return (
      <PageContainer className="page-content">
        <LoadingState />
      </PageContainer>
    );
  if (query.error || !query.data)
    return (
      <PageContainer className="page-content">
        <ErrorState error={query.error} retry={query.retry} />
      </PageContainer>
    );
  const { group, owner, members, match, request } = query.data;
  const isMember = group.member_ids.includes(actor);
  async function expressInterest() {
    setSaving(true);
    setActionError("");
    try {
      await service.expressInterest(group_id, search, actor);
      query.retry();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <PageContainer className="page-content">
      <DemoNotice />
      <Link className="back-link" to={`/group-match?${params}`}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to matching groups
      </Link>
      <div className="details-title">
        <div>
          <span className="feature-label">
            <UsersRound size={17} aria-hidden="true" />
            Your next shared adventure
          </span>
          <h1>{group.name}</h1>
          <p className="icon-line">
            <MapPin size={17} aria-hidden="true" />
            {group.city} · Hosted by {owner.name}
          </p>
        </div>
        <span className="tag green">
          {group.max_size - group.member_ids.length} places left
        </span>
      </div>
      <div className="details-photo">
        <Photo
          src={destinationImage(group.city)}
          alt={`${group.city}, the destination for ${group.name}`}
          loading="eager"
        />
        <span>{group.city} · April 2027</span>
      </div>
      <div className="details-layout">
        <div className="space-y-7">
          <section className="card detail-section">
            <h2>A little about this trip</h2>
            <div className="detail-stats">
              <div>
                <CalendarDays size={20} aria-hidden="true" />
                <span>
                  Travel dates
                  <strong>{tripDates(group.check_in, group.check_out)}</strong>
                </span>
              </div>
              <div>
                <UsersRound size={20} aria-hidden="true" />
                <span>
                  Small group
                  <strong>
                    {group.member_ids.length} of {group.max_size} travellers
                  </strong>
                </span>
              </div>
            </div>
            <h3>The proposed itinerary</h3>
            <p className="itinerary">{group.itinerary}</p>
          </section>
          <section className="card detail-section">
            <h2>Meet your travel group</h2>
            <p className="text-muted-foreground mb-5">
              A shared plan starts with a little common ground.
            </p>
            <div className="space-y-4">
              {members.map((member) => (
                <GroupMemberCard
                  key={member.traveller_id}
                  traveller={member}
                  owner={member.traveller_id === owner.traveller_id}
                />
              ))}
            </div>
          </section>
          <section className="card detail-section">
            <h2>How your plans line up</h2>
            {match ? (
              <>
                <h3 className="mb-3">Your shared interests</h3>
                <InterestTags values={match.shared_interests} />
                <MatchExplanation reasons={match.explanations} />
                <p className="field-hint mt-4">
                  Demo ranking: {match.score} points. All six eligibility rules
                  are satisfied for your search.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                {isMember
                  ? "You are already a member, so this group is excluded from discovery matches."
                  : "This group does not meet all six conditions for your current search. Return to search to adjust your plans."}
              </p>
            )}
          </section>
        </div>
        <aside className="details-aside">
          <section className="card interest-panel">
            <h2>A trip worth sharing</h2>
            <span className="price-label">
              Approximate trip budget / person
            </span>
            <strong className="detail-price">{money(group.budget_inr)}</strong>
            <p className="field-hint">A planning budget, not a hotel quote.</p>
            <div className="interest-action" aria-live="polite">
              {request ? (
                <div className="pending-state">
                  <Clock3 size={22} aria-hidden="true" />
                  <strong>Request pending</strong>
                  <p>
                    Your demo interest is saved in this browser. No request has
                    been sent to the owner.
                  </p>
                </div>
              ) : isMember ? (
                <p className="muted-panel">
                  {group.owner_id === actor
                    ? "You are hosting this group."
                    : "You are already part of this group."}
                </p>
              ) : group.member_ids.length >= group.max_size ? (
                <Button disabled className="w-full">
                  Group full
                </Button>
              ) : (
                <>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={expressInterest}
                    disabled={!match || saving}
                  >
                    {saving ? "Recording interest…" : "Interested"}
                  </Button>
                  {!match ? (
                    <p className="field-hint mt-2">
                      This group does not match your current search.
                    </p>
                  ) : null}
                </>
              )}
              {actionError ? (
                <p role="alert" className="field-error mt-3">
                  {actionError}
                </p>
              ) : null}
            </div>
            <div className="interest-reassurance">
              <ShieldCheck size={20} aria-hidden="true" />
              <p>
                No payment or reservation.
                <br />
                Just a first step towards a shared trip.
              </p>
            </div>
          </section>
          <section className="host-note">
            <span className="avatar">{owner.name.charAt(0)}</span>
            <div>
              <p>Your group host</p>
              <h3>{owner.name}</h3>
              <p>
                {owner.home_city} ·{" "}
                {owner.gender_preference === "ANY"
                  ? "Any gender welcome"
                  : "Same-gender travel preference"}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
