import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useTreeStore } from "@/stores/treeStore";

export interface ReleaseSpec {
  path: string;
  id: string | null;
  title: string;
  status: string;
  effort: string | null;
}

export interface ReleaseDetail {
  id: string;
  title: string;
  status: string;
  target: string | null;
  path: string;
  specs: ReleaseSpec[];
  total: number;
  done: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ReleaseState {
  detail: ReleaseDetail | null;
  loading: boolean;

  loadRelease: (curayePath: string, releaseId: string) => Promise<void>;
  updateSpecStatus: (specPath: string, newStatus: string) => Promise<void>;
  shipRelease: (curayePath: string, releaseId: string) => Promise<void>;
}

export const useReleaseStore = create<ReleaseState>((set) => ({
  detail: null,
  loading: false,

  loadRelease: async (curayePath: string, releaseId: string) => {
    set({ loading: true });
    try {
      const [releases, rawSpecs] = await Promise.all([
        invoke<Array<{
          id: string;
          title: string;
          status: string;
          target: string | null;
          path: string;
          total: number;
          done: number;
        }>>("scan_releases", { curayePath }),
        invoke<Array<{
          path: string;
          id: string | null;
          title: string;
          status: string;
          effort: string | null;
        }>>("scan_release_specs", { curayePath, releaseId }),
      ]);

      const release = releases.find((r) => r.id === releaseId);
      if (!release) {
        set({ loading: false, detail: null });
        return;
      }

      const specs: ReleaseSpec[] = rawSpecs.map((s) => ({
        path: s.path,
        id: s.id,
        title: s.title,
        status: s.status,
        effort: s.effort,
      }));

      const done = specs.filter((s) => s.status === "done").length;

      set({
        loading: false,
        detail: {
          id: release.id,
          title: release.title,
          status: release.status,
          target: release.target,
          path: release.path,
          specs,
          total: specs.length,
          done,
        },
      });
    } catch {
      set({ loading: false });
    }
  },

  updateSpecStatus: async (specPath: string, newStatus: string) => {
    const today = todayIso();
    await invoke("update_spec_status", { path: specPath, status: newStatus, updated: today });
    set((state) => {
      if (!state.detail) return state;
      const specs = state.detail.specs.map((s) =>
        s.path === specPath ? { ...s, status: newStatus } : s,
      );
      const done = specs.filter((s) => s.status === "done").length;
      return { detail: { ...state.detail, specs, done, total: specs.length } };
    });
  },

  shipRelease: async (curayePath: string, releaseId: string) => {
    const today = todayIso();
    await invoke<unknown[]>("ship_release", { curayePath, releaseId, today });
    // Reload project tree after shipping
    await useTreeStore.getState().loadTree(curayePath);
    set((state) => {
      if (!state.detail) return state;
      return {
        detail: {
          ...state.detail,
          status: "shipped",
          specs: state.detail.specs.filter((s) => s.status !== "done"),
        },
      };
    });
  },
}));
