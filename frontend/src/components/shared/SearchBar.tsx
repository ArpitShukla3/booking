import { BedDouble, CalendarDays, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
/** Deliberately visual-only: never navigates or claims inventory was searched. */
export function SearchBar() {
  return (
    <div className="stay-search-demo">
      <div className="stay-search" role="group" aria-label="Hotel search preview">
        <div className="search-cell">
          <BedDouble aria-hidden="true" />
          <span>
            <strong>Where are you going?</strong>
            <span>Explore your next destination</span>
          </span>
        </div>
        <div className="search-cell">
          <CalendarDays aria-hidden="true" />
          <span>
            <strong>Check-in — Check-out</strong>
            <span>Your travel dates</span>
          </span>
        </div>
        <div className="search-cell">
          <UsersRound aria-hidden="true" />
          <span>
            <strong>2 adults · 0 children · 1 room</strong>
            <span>Travellers and rooms</span>
          </span>
        </div>
        <Button className="search-submit" disabled>
          Search
        </Button>
      </div>
      <p className="search-caption">
        Hotel search preview only.{" "}
        <span>Looking for travel companions? Try Group Match below.</span>
      </p>
    </div>
  );
}
