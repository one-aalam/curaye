import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "raat" | "neel" | "saffron" | "chaadar";
export type UiFont = "inter" | "dm-sans" | "work-sans" | "space-grotesk";

interface ConfigState {
  theme: Theme;
  uiFont: UiFont;
  leftPanelWidth: number;
  middlePanelWidth: number;
  setTheme: (theme: Theme) => void;
  setUiFont: (font: UiFont) => void;
  setLeftPanelWidth: (w: number) => void;
  setMiddlePanelWidth: (w: number) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      theme: "raat",
      uiFont: "inter",
      leftPanelWidth: 200,
      middlePanelWidth: 240,
      setTheme: (theme) => set({ theme }),
      setUiFont: (uiFont) => set({ uiFont }),
      setLeftPanelWidth: (w) => set({ leftPanelWidth: w }),
      setMiddlePanelWidth: (w) => set({ middlePanelWidth: w }),
    }),
    { name: "curaye-config" },
  ),
);
