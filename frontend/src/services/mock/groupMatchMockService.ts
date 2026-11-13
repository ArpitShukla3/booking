import { z } from "zod";
import travellerSeed from "../../data/travellers.json";
import groupSeed from "../../data/groups.json";
import { searchSchema } from "../../lib/schemas";
import { evaluateMatch, rankMatches } from "./matching";
import type {
  Group,
  GroupMatchService,
  InterestedRequest,
  Traveller,
} from "../../types/groupMatch";

import { MOCK_STORAGE_KEY } from './storageKey';
export { MOCK_STORAGE_KEY } from './storageKey';
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const requestStoreSchema = z.object({
  version: z.literal(1),
  requests: z.array(
    z.object({
      request_id: z.string(),
      group_id: z.string(),
      traveller_id: z.string(),
      status: z.literal("PENDING"),
    }),
  ),
});
const travellers = travellerSeed as Traveller[];
const groups = groupSeed as Group[];
function validateSearch(input: Parameters<GroupMatchService["searchGroups"]>[0]) {
  const result = searchSchema.safeParse(input);
  if (!result.success) throw new Error(`Check your search: ${result.error.issues[0].message}`);
  return result.data;
}

/** Promise-based browser-only boundary; no backend calls, profile writes or approval workflow. */
export function createMockService(storage: StorageLike): GroupMatchService {
  function person(id: string) {
    const person = travellers.find((t) => t.traveller_id === id);
    if (!person)
      throw new Error(
        "Traveller not found. Choose a sample traveller in the header.",
      );
    return person;
  }
  function group(id: string) {
    const group = groups.find((g) => g.group_id === id);
    if (!group)
      throw new Error(
        "Group not found. Return to Group Match and choose another trip.",
      );
    return group;
  }
  function requests(): InterestedRequest[] {
    try {
      const value = storage.getItem(MOCK_STORAGE_KEY);
      return value ? requestStoreSchema.parse(JSON.parse(value)).requests : [];
    } catch {
      throw new Error(
        "Your saved requests could not be read. Clear this demo’s requests using the traveller menu.",
      );
    }
  }
  return {
    async getTravellers() {
      return structuredClone(travellers);
    },
    async getTraveller(id) {
      return structuredClone(person(id));
    },
    async searchGroups(input, actor, sort = "score") {
      const search = validateSearch(input);
      const seeker = person(actor);
      return rankMatches(
        groups.flatMap((g) => {
          const match = evaluateMatch(g, person(g.owner_id), seeker, search);
          return match ? [structuredClone(match)] : [];
        }),
        sort,
      );
    },
    async getGroupDetails(groupId, input, actor) {
      const g = group(groupId);
      const seeker = person(actor);
      const owner = person(g.owner_id);
      return structuredClone({
        group: g,
        owner,
        members: g.member_ids.map(person),
        match: evaluateMatch(g, owner, seeker, input),
        request:
          requests().find(
            (r) => r.group_id === groupId && r.traveller_id === actor,
          ) || null,
      });
    },
    async expressInterest(groupId, input, actor) {
      const g = group(groupId);
      const search = validateSearch(input);
      if (!evaluateMatch(g, person(g.owner_id), person(actor), search))
        throw new Error(
          "This group does not meet all six conditions for your search. Update your search and try another group.",
        );
      const saved = requests();
      const existing = saved.find(
        (r) => r.group_id === groupId && r.traveller_id === actor,
      );
      if (existing) return existing;
      const request: InterestedRequest = {
        request_id: `REQ-DEMO-${crypto.randomUUID()}`,
        group_id: groupId,
        traveller_id: actor,
        status: "PENDING",
      };
      try {
        storage.setItem(
          MOCK_STORAGE_KEY,
          JSON.stringify({ version: 1, requests: [...saved, request] }),
        );
      } catch {
        throw new Error(
          "Browser storage is unavailable or full. Enable local storage and try again.",
        );
      }
      return request;
    },
  };
}
