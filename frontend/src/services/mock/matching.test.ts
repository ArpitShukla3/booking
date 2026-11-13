import { describe, expect, it } from "vitest";
import { evaluateMatch, rankMatches } from "./matching";
import type { Group, GroupSearch, Traveller } from "../../types/groupMatch";

const owner: Traveller = {
  traveller_id: "owner",
  name: "Owner",
  age: 27,
  gender: "FEMALE",
  home_city: "Pune",
  home_airport: "PNQ",
  interests: ["TEMPLES", "STREET_FOOD"],
  gender_preference: "ANY",
};
const seeker: Traveller = { ...owner, traveller_id: "seeker" };
const group: Group = {
  group_id: "trip",
  name: "A sample trip",
  owner_id: "owner",
  member_ids: ["owner"],
  city: "Kyoto",
  check_in: "2027-04-10",
  check_out: "2027-04-15",
  max_size: 3,
  budget_inr: 60000,
  itinerary: "Visit temples and markets",
};
const search: GroupSearch = {
  city: "Kyoto",
  check_in: "2027-04-10",
  check_out: "2027-04-15",
  budget_inr: 60000,
  interests: ["TEMPLES", "STREET_FOOD"],
  gender_preference: "ANY",
};
describe("temporary pure mock eligibility", () => {
  it("returns a six-condition explanation for an eligible group", () => {
    const match = evaluateMatch(group, owner, seeker, search);
    expect(match?.shared_nights).toBe(5);
    expect(match?.shared_interests).toHaveLength(2);
    expect(match?.explanations).toHaveLength(6);
  });
  it("requires the exact destination city", () => {
    expect(
      evaluateMatch(group, owner, seeker, { ...search, city: "Tokyo" }),
    ).toBeNull();
  });
  it("accepts exactly two overlapping nights", () => {
    expect(
      evaluateMatch(group, owner, seeker, {
        ...search,
        check_in: "2027-04-13",
      }),
    ).not.toBeNull();
  });
  it("rejects one shared night and touching check-in/check-out dates", () => {
    expect(
      evaluateMatch(group, owner, seeker, {
        ...search,
        check_in: "2027-04-14",
      }),
    ).toBeNull();
    expect(
      evaluateMatch(group, owner, seeker, {
        ...search,
        check_in: "2027-04-15",
        check_out: "2027-04-17",
      }),
    ).toBeNull();
  });
  it("includes exactly 40 percent of the lower budget and rejects one rupee over", () => {
    expect(
      evaluateMatch(group, owner, seeker, { ...search, budget_inr: 84000 }),
    ).not.toBeNull();
    expect(
      evaluateMatch(group, owner, seeker, { ...search, budget_inr: 84001 }),
    ).toBeNull();
    expect(
      evaluateMatch({ ...group, budget_inr: 84000 }, owner, seeker, search),
    ).not.toBeNull();
  });
  it("compares search interests to owner interests, not members or seeker profile", () => {
    expect(
      evaluateMatch(group, owner, { ...seeker, interests: [] }, search),
    ).not.toBeNull();
    expect(
      evaluateMatch(group, owner, seeker, {
        ...search,
        interests: ["TEMPLES", "HIKING"],
      }),
    ).toBeNull();
  });
  it("does not count duplicate interests twice", () => {
    expect(
      evaluateMatch(group, owner, seeker, {
        ...search,
        interests: ["TEMPLES", "TEMPLES"],
      }),
    ).toBeNull();
  });
  it("checks gender preference in both directions", () => {
    const male = { ...seeker, gender: "MALE" as const };
    expect(
      evaluateMatch(group, owner, male, {
        ...search,
        gender_preference: "SAME_GENDER",
      }),
    ).toBeNull();
    expect(
      evaluateMatch(
        group,
        { ...owner, gender_preference: "SAME_GENDER" },
        male,
        search,
      ),
    ).toBeNull();
    expect(evaluateMatch(group, owner, male, search)).not.toBeNull();
  });
  it("accepts the last place and rejects full groups", () => {
    expect(
      evaluateMatch({ ...group, max_size: 2 }, owner, seeker, search),
    ).not.toBeNull();
    expect(
      evaluateMatch({ ...group, max_size: 1 }, owner, seeker, search),
    ).toBeNull();
  });
  it("excludes current members and does not match invalid input", () => {
    expect(evaluateMatch(group, owner, owner, search)).toBeNull();
    expect(
      evaluateMatch(group, owner, seeker, {
        ...search,
        check_in: "2027-04-31",
      }),
    ).toBeNull();
  });
  it("ranks eligible matches separately, deterministically and without mutation", () => {
    const a = evaluateMatch(group, owner, seeker, search)!;
    const b = {
      ...a,
      group: { ...group, group_id: "second", budget_inr: 65000 },
      score: a.score - 5,
    };
    const items = [b, a];
    expect(rankMatches(items, "score")[0].group.group_id).toBe("trip");
    expect(items[0].group.group_id).toBe("second");
    expect(rankMatches(items, "budget")[0].group.budget_inr).toBe(60000);
  });
});
