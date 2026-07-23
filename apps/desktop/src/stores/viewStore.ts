import { create } from "zustand";

export type ViewMode = "main" | "backlog" | "releases";

interface ViewState {
  view: ViewMode;
  currentReleaseId: string | null;
  setView: (v: ViewMode) => void;
  openRelease: (releaseId: string) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: "main",
  currentReleaseId: null,
  setView: (view) => set({ view }),
  openRelease: (releaseId) => set({ view: "releases", currentReleaseId: releaseId }),
}));
