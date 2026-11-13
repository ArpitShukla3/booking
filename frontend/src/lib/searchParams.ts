import type { GroupSearch } from "../types/groupMatch";
export const defaultSearch: GroupSearch = {
  city: "Kyoto",
  check_in: "2027-04-10",
  check_out: "2027-04-15",
  budget_inr: 60000,
  interests: ["TEMPLES", "STREET_FOOD", "PHOTOGRAPHY"],
  gender_preference: "SAME_GENDER",
};
export function searchFromParams(params: URLSearchParams): GroupSearch {
  return {
    city: params.get("city") || defaultSearch.city,
    check_in: params.get("check_in") || defaultSearch.check_in,
    check_out: params.get("check_out") || defaultSearch.check_out,
    budget_inr: Number(params.get("budget_inr") || defaultSearch.budget_inr),
    interests: params.has("interests")
      ? params.get("interests")!.split(",").filter(Boolean)
      : defaultSearch.interests,
    gender_preference:
      params.get("gender_preference") === "ANY" ? "ANY" : "SAME_GENDER",
  };
}
export function searchToParams(input: GroupSearch) {
  return new URLSearchParams({
    ...input,
    budget_inr: String(input.budget_inr),
    interests: input.interests.join(","),
  });
}
