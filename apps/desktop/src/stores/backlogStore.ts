import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useTreeStore } from "@/stores/treeStore";
import { useEditorStore } from "@/stores/editorStore";
import { useViewStore } from "@/stores/viewStore";

export interface BacklogSpec {
  project_name: string;
  project_curaye_path: string;
  path: string;
  id: string | null;
  title: string;
  status: string;
  effort: string | null;
  impact: string | null;
  desire: string | null;
  release: string | null;
}

export type SortField =
  | "project"
  | "title"
  | "status"
  | "effort"
  | "impact"
  | "desire"
  | "release";

export type SortDir = "asc" | "desc";

const EFFORT_ORDER: Record<string, number> = {
  xs: 0,
  s: 1,
  m: 2,
  l: 3,
  xl: 4,
};

const LEVEL_ORDER: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function compareSpecs(a: BacklogSpec, b: BacklogSpec, sortBy: SortField, dir: SortDir): number {
  let cmp = 0;

  switch (sortBy) {
    case "project":
      cmp = a.project_name.localeCompare(b.project_name);
      break;
    case "title":
      cmp = a.title.localeCompare(b.title);
      break;
    case "status":
      cmp = a.status.localeCompare(b.status);
      break;
    case "effort": {
      const aOrd = EFFORT_ORDER[a.effort ?? ""] ?? -1;
      const bOrd = EFFORT_ORDER[b.effort ?? ""] ?? -1;
      cmp = aOrd - bOrd;
      break;
    }
    case "impact": {
      const aOrd = LEVEL_ORDER[a.impact ?? ""] ?? 0;
      const bOrd = LEVEL_ORDER[b.impact ?? ""] ?? 0;
      cmp = bOrd - aOrd; // default descending for impact
      break;
    }
    case "desire": {
      const aOrd = LEVEL_ORDER[a.desire ?? ""] ?? 0;
      const bOrd = LEVEL_ORDER[b.desire ?? ""] ?? 0;
      cmp = bOrd - aOrd; // default descending for desire
      break;
    }
    case "release":
      cmp = (a.release ?? "").localeCompare(b.release ?? "");
      break;
  }

  return dir === "desc" ? -cmp : cmp;
}

interface BacklogState {
  specs: BacklogSpec[];
  loading: boolean;
  sortBy: SortField;
  sortDir: SortDir;
  filterProject: string | null;
  filterStatus: string | null;
  filterEffort: string | null;
  filterImpact: string | null;
  filterDesire: string | null;
  filterRelease: string | null;

  loadBacklog: () => Promise<void>;
  setSortBy: (field: SortField) => void;
  setFilterProject: (v: string | null) => void;
  setFilterStatus: (v: string | null) => void;
  setFilterEffort: (v: string | null) => void;
  setFilterImpact: (v: string | null) => void;
  setFilterDesire: (v: string | null) => void;
  setFilterRelease: (v: string | null) => void;
  clearFilters: () => void;
  updateStatus: (specPath: string, newStatus: string) => Promise<void>;
  shelveSpec: (specPath: string) => Promise<void>;
  openSpec: (spec: BacklogSpec) => Promise<void>;
  filteredAndSorted: () => BacklogSpec[];
}

export const useBacklogStore = create<BacklogState>((set, get) => ({
  specs: [],
  loading: false,
  sortBy: "impact",
  sortDir: "asc",
  filterProject: null,
  filterStatus: null,
  filterEffort: null,
  filterImpact: null,
  filterDesire: null,
  filterRelease: null,

  loadBacklog: async () => {
    set({ loading: true });
    try {
      const specs = await invoke<BacklogSpec[]>("scan_backlog");
      set({ specs, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setSortBy: (field: SortField) => {
    const { sortBy, sortDir } = get();
    if (sortBy === field) {
      set({ sortDir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      const defaultDesc = field === "impact" || field === "desire";
      set({ sortBy: field, sortDir: defaultDesc ? "desc" : "asc" });
    }
  },

  setFilterProject: (v) => set({ filterProject: v }),
  setFilterStatus: (v) => set({ filterStatus: v }),
  setFilterEffort: (v) => set({ filterEffort: v }),
  setFilterImpact: (v) => set({ filterImpact: v }),
  setFilterDesire: (v) => set({ filterDesire: v }),
  setFilterRelease: (v) => set({ filterRelease: v }),

  clearFilters: () =>
    set({
      filterProject: null,
      filterStatus: null,
      filterEffort: null,
      filterImpact: null,
      filterDesire: null,
      filterRelease: null,
    }),

  updateStatus: async (specPath: string, newStatus: string) => {
    const today = todayIso();
    await invoke("update_spec_status", { path: specPath, status: newStatus, updated: today });
    set((state) => ({
      specs: state.specs.map((s) =>
        s.path === specPath ? { ...s, status: newStatus } : s,
      ),
    }));
  },

  shelveSpec: async (specPath: string) => {
    const today = todayIso();
    await invoke("update_spec_status", {
      path: specPath,
      status: "shelved",
      updated: today,
    });
    set((state) => ({
      specs: state.specs.filter((s) => s.path !== specPath),
    }));
  },

  openSpec: async (spec: BacklogSpec) => {
    useViewStore.getState().setView("main");
    useProjectStore.getState().selectProject(spec.project_name);
    await useTreeStore.getState().loadTree(spec.project_curaye_path);
    useTreeStore.getState().selectDocument(spec.path);
    await useEditorStore.getState().loadDocument(spec.path, "spec");
  },

  filteredAndSorted: () => {
    const {
      specs,
      sortBy,
      sortDir,
      filterProject,
      filterStatus,
      filterEffort,
      filterImpact,
      filterDesire,
      filterRelease,
    } = get();

    let result = specs;

    if (filterProject !== null) result = result.filter((s) => s.project_name === filterProject);
    if (filterStatus !== null) result = result.filter((s) => s.status === filterStatus);
    if (filterEffort !== null) result = result.filter((s) => s.effort === filterEffort);
    if (filterImpact !== null) result = result.filter((s) => s.impact === filterImpact);
    if (filterDesire !== null) result = result.filter((s) => s.desire === filterDesire);
    if (filterRelease !== null) result = result.filter((s) => s.release === filterRelease);

    return [...result].sort((a, b) => compareSpecs(a, b, sortBy, sortDir));
  },
}));
