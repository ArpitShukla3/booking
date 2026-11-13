import { create } from "zustand";
export const IDENTITY_KEY = "gtm.active-traveller-id";
const restore = () => {
  try {
    return localStorage.getItem(IDENTITY_KEY) || "T-002";
  } catch {
    return "T-002";
  }
};
interface TravellerState {
  traveller_id: string | null;
  setTraveller: (id: string | null) => void;
}
export const useDemoTravellerStore = create<TravellerState>((set) => ({
  traveller_id: restore(),
  setTraveller: (id) => {
    try {
      if (id) localStorage.setItem(IDENTITY_KEY, id);
      else localStorage.removeItem(IDENTITY_KEY);
    } catch {
      /* Session remains usable without identity persistence. */
    }
    set({ traveller_id: id });
  },
}));
