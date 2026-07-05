import { create } from "zustand";
import { fetchEntries, type Entry } from "../lib/api";

type EntryState = {
  entries: Entry[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
};

export const useEntries = create<EntryState>((set) => ({
  entries: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const { entries } = await fetchEntries();
      set({ entries, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },
}));
