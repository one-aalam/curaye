import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface RegistryProject {
  name: string;
  curaye_path: string;
  sync_status?: "clean" | "ahead" | "behind" | "diverged";
  ready_count?: number;
}

interface ProjectState {
  projects: RegistryProject[];
  selectedProjectId: string | null;
  loading: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  selectProject: (name: string) => void;
  refreshSyncStatus: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  loading: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await invoke<RegistryProject[]>("read_registry");
      set({ projects, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  selectProject: (name: string) => {
    set({ selectedProjectId: name });
    const { projects } = get();
    const project = projects.find((p) => p.name === name);
    if (project) {
      // Lazy import to avoid circular deps — briefStore imports nothing from projectStore
      void import("./briefStore").then(({ useBriefStore }) => {
        void useBriefStore.getState().loadLastOpened(project.curaye_path);
        void useBriefStore.getState().recordOpened(project.curaye_path);
      });
    }
  },

  refreshSyncStatus: async () => {
    const { projects } = get();
    if (projects.length === 0) return;
    try {
      const updated = await invoke<RegistryProject[]>("read_registry");
      set({ projects: updated });
    } catch {
      // silent — sync status is best-effort
    }
  },
}));
