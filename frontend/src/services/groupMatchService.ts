import { createMockService } from "./mock/groupMatchMockService";
import type { GroupMatchService } from "../types/groupMatch";
// Pages depend on this interface. Replace this adapter when the backend API is ready.
export const groupMatchService: GroupMatchService = createMockService({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
