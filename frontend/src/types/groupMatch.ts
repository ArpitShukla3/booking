export type Gender = "MALE" | "FEMALE";
export type GenderPreference = "ANY" | "SAME_GENDER";
export interface Traveller {
  traveller_id: string;
  name: string;
  age: number;
  gender: Gender;
  home_city: string;
  home_airport: string;
  interests: string[];
  gender_preference: GenderPreference;
}
export interface Group {
  group_id: string;
  name: string;
  owner_id: string;
  member_ids: string[];
  city: string;
  check_in: string;
  check_out: string;
  max_size: number;
  budget_inr: number;
  itinerary: string;
}
export interface GroupSearch {
  city: string;
  check_in: string;
  check_out: string;
  budget_inr: number;
  interests: string[];
  gender_preference: GenderPreference;
}
export interface Match {
  group: Group;
  owner: Traveller;
  shared_nights: number;
  shared_interests: string[];
  explanations: string[];
  score: number;
}
export type MatchSort = "score" | "budget" | "overlap";
export interface InterestedRequest {
  request_id: string;
  group_id: string;
  traveller_id: string;
  status: "PENDING";
}
export interface GroupDetails {
  group: Group;
  owner: Traveller;
  members: Traveller[];
  match: Match | null;
  request: InterestedRequest | null;
}
export interface GroupMatchService {
  getTravellers(): Promise<Traveller[]>;
  getTraveller(id: string): Promise<Traveller>;
  searchGroups(
    input: GroupSearch,
    actor: string,
    sort?: MatchSort,
  ): Promise<Match[]>;
  getGroupDetails(
    groupId: string,
    input: GroupSearch,
    actor: string,
  ): Promise<GroupDetails>;
  expressInterest(
    groupId: string,
    input: GroupSearch,
    actor: string,
  ): Promise<InterestedRequest>;
}
