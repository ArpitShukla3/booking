import { create } from 'zustand'

// Example store — replace with real app state later.
type CounterState = {
  count: number
  increment: () => void
  reset: () => void
}

export const useCounterStore = create<CounterState>()((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  reset: () => set({ count: 0 }),
}))
