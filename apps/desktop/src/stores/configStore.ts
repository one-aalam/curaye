import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "raat" | "neel" | "saffron" | "chaadar";

interface ConfigState {
  theme: Theme;
  leftPanelWidth: number;
  middlePanelWidth: number;
  setTheme: (theme: Theme) => void;
  setLeftPanelWidth: (w: number) => void;
  setMiddlePanelWidth: (w: number) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      theme: "raat",
      leftPanelWidth: 200,
      middlePanelWidth: 240,
      setTheme: (theme) => set({ theme }),
      setLeftPanelWidth: (w) => set({ leftPanelWidth: w }),
      setMiddlePanelWidth: (w) => set({ middlePanelWidth: w }),
    }),
    { name: "curaye-config" },
  ),
);
