import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, UsersRound, MapPin, ChevronRight, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatchExplanation, Photo } from "@/components/shared/common";
import { destinationImage } from "@/data/destinations";
import { money, tripDates } from "@/lib/format";
import { cityPhoto } from "@/features/groups/media";
import type { LiveMatch } from "@/types/search";

/** Warm the details page chunk so opening a match feels instant. */
const prefetch = () => { void import("@/features/groups/GroupPage"); };

/** One live match. The card links to the Group Details page (/groups/:groupId). */
export function GroupCard({
  match,
  labels,
  style,
}: {
  match: LiveMatch;
  labels: Map<string, string>;
  style?: CSSProperties;
}) {
  const { group, reasons } = match;
  const detailsUrl = `/groups/${group.group_id}`;
  const photo = cityPhoto(group.city, 600);
  return (
    <article className="group-card gm-card" style={style} onMouseEnter={prefetch} onFocus={prefetch}>
      <Photo src={photo.src} fallback={destinationImage(group.city)} alt={`${group.city}, ${group.country_name}`} />
      <div className="group-card-body">
        <div className="group-card-top">
          <div>
            <h3><Link to={detailsUrl}>{group.name}</Link></h3>
            <p className="group-location">
              <MapPin size={14} aria-hidden="true" />
              {group.city}, {group.country_name} · <Crown size={13} aria-hidden="true" /> Hosted by {group.owner.name}
            </p>
          </div>
          <div className="match-score" title="Ranking score out of 100: shared interests 50, budget closeness 30, date overlap 20">
            <span>Match score</span>
            <strong>{match.score}<small>/100</small></strong>
          </div>
        </div>
        <div className="metadata">
          <span><CalendarDays size={15} aria-hidden="true" />{tripDates(group.check_in, group.check_out)} · {group.nights} nights</span>
          <span><UsersRound size={15} aria-hidden="true" />{group.members_count}/{group.max_size} travellers</span>
        </div>
        {group.itinerary ? <p className="line-clamp-2 text-sm text-muted-foreground">{group.itinerary}</p> : null}
        <div className="tags">
          {reasons.shared_interests.map((i) => <span className="tag blue" key={i}>{labels.get(i) ?? i}</span>)}
        </div>
        <MatchExplanation reasons={match.explanations} />
        <div className="group-card-bottom">
          <span className="availability-label">
            {reasons.spots_left} {reasons.spots_left === 1 ? "spot" : "spots"} left
          </span>
          <div className="group-price">
            <small>Approx. trip budget / person</small>
            <strong>{money(group.budget_inr)}</strong>
          </div>
          <Button asChild>
            <Link to={detailsUrl}>View Details <ChevronRight aria-hidden="true" /></Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
