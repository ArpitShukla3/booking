import { describe, expect, it } from "vitest";
import { createMockService } from "./groupMatchMockService";
const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
const search = {
  city: "Kyoto",
  check_in: "2027-04-10",
  check_out: "2027-04-15",
  budget_inr: 60000,
  interests: ["TEMPLES", "STREET_FOOD"],
  gender_preference: "SAME_GENDER" as const,
};
describe("discovery mock service", () => {
  it("filters the official sample groups for arbitrary searches", async () => {
    const service = createMockService(memory());
    expect(
      (await service.searchGroups(search, "T-002")).some(
        (m) => m.group.group_id === "G-01",
      ),
    ).toBe(true);
    expect(
      (await service.searchGroups({ ...search, city: "Dubai" }, "T-002")).some(
        (m) => m.group.group_id === "G-01",
      ),
    ).toBe(false);
  });
  it("persists a pending request independently of active identity and returns duplicates idempotently", async () => {
    const storage = memory();
    const service = createMockService(storage);
    const request = await service.expressInterest("G-01", search, "T-002");
    expect(request.status).toBe("PENDING");
    const restored = createMockService(storage);
    expect(
      (await restored.getGroupDetails("G-01", search, "T-002")).request
        ?.request_id,
    ).toBe(request.request_id);
    expect(
      (await restored.expressInterest("G-01", search, "T-002")).request_id,
    ).toBe(request.request_id);
    expect(
      (await restored.getGroupDetails("G-01", search, "T-003")).request,
    ).toBeNull();
  });
  it("rejects invalid searches, missing records and ineligible requests", async () => {
    const service = createMockService(memory());
    await expect(
      service.searchGroups({ ...search, budget_inr: 0 }, "T-002"),
    ).rejects.toThrow();
    await expect(service.getTraveller("missing")).rejects.toThrow(/traveller/i);
    await expect(
      service.getGroupDetails("missing", search, "T-002"),
    ).rejects.toThrow(/group/i);
    await expect(
      service.expressInterest("G-01", { ...search, city: "Dubai" }, "T-002"),
    ).rejects.toThrow(/six/i);
  });
  it("reports unavailable or corrupted storage without claiming interest was recorded", async () => {
    const broken = createMockService({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    await expect(
      broken.expressInterest("G-01", search, "T-002"),
    ).rejects.toThrow(/storage/i);
    const corrupt = createMockService({
      getItem: () => "{bad",
      setItem: () => {},
    });
    await expect(
      corrupt.getGroupDetails("G-01", search, "T-002"),
    ).rejects.toThrow(/saved/i);
  });
});
