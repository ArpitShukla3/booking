import { Link } from "react-router-dom";
import { CalendarDays, UsersRound, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InterestTags,
  MatchExplanation,
  Photo,
} from "@/components/shared/common";
import { destinationImage } from "@/data/destinations";
import { money, tripDates } from "@/lib/format";
import type { Group, Match } from "@/types/groupMatch";
export function GroupCard({
  group,
  ownerName,
  match,
  searchParams = "",
}: {
  group: Group;
  ownerName: string;
  match: Match;
  searchParams?: string;
}) {
  const detailsUrl = `/group-match/groups/${group.group_id}${searchParams ? `?${searchParams}` : ""}`;
  const places = group.max_size - group.member_ids.length;
  return (
    <article className="group-card">
      <Photo
        src={destinationImage(group.city)}
        alt={`Discover ${group.city} with a travel group`}
      />
      <div className="group-card-body">
        <div className="group-card-top">
          <div>
            <h3>
              <Link to={detailsUrl}>{group.name}</Link>
            </h3>
            <p className="group-location">
              <MapPin size={14} aria-hidden="true" />
              {group.city} · Hosted by {ownerName}
            </p>
          </div>
          <div className="match-score">
            <span>Demo match score</span>
            <strong>
              {match.score}
              <small> pts</small>
            </strong>
          </div>
        </div>
        <div className="metadata">
          <span>
            <CalendarDays size={15} aria-hidden="true" />
            {tripDates(group.check_in, group.check_out)}
          </span>
          <span>
            <UsersRound size={15} aria-hidden="true" />
            {group.member_ids.length} of {group.max_size} travellers
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {group.itinerary}
        </p>
        <InterestTags values={match.shared_interests} />
        <MatchExplanation reasons={match.explanations.slice(0, 4)} />
        <div className="group-card-bottom">
          <span className="availability-label">
            {places} {places === 1 ? "place" : "places"} left
          </span>
          <div className="group-price">
            <small>Approx. trip budget / person</small>
            <strong>{money(group.budget_inr)}</strong>
          </div>
          <Button asChild>
            <Link to={detailsUrl}>
              View Details <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
