import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type DocSection = "planned" | "current" | "shipped" | "decisions" | "root";

export interface TreeNode {
  name: string;
  path: string;
  section: DocSection;
  status?: string;
  isDraft: boolean;
  hasValidationError: boolean;
}

export interface ReleaseSummary {
  id: string;
  title: string;
  status: string;
  target: string | null;
  path: string;
  total: number;
  done: number;
}

export interface ProjectTree {
  planned: TreeNode[];
  current: TreeNode[];
  shipped: TreeNode[];
  decisions: TreeNode[];
  root: TreeNode[];
  releases: ReleaseSummary[];
}

interface TreeState {
  tree: ProjectTree | null;
  expandedSections: Set<DocSection>;
  selectedPath: string | null;
  loading: boolean;
  loadTree: (curayePath: string) => Promise<void>;
  toggleSection: (section: DocSection) => void;
  selectDocument: (path: string) => void;
}

const DEFAULT_EXPANDED: DocSection[] = ["planned", "current", "decisions", "root"];

export const useTreeStore = create<TreeState>((set, get) => ({
  tree: null,
  expandedSections: new Set(DEFAULT_EXPANDED),
  selectedPath: null,
  loading: false,

  loadTree: async (curayePath: string) => {
    set({ loading: true, tree: null, selectedPath: null });
    try {
      const index = await invoke<ProjectTree>("scan_project", { curayePath });
      set({ tree: index, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  toggleSection: (section: DocSection) => {
    set((state) => {
      const next = new Set(state.expandedSections);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return { expandedSections: next };
    });
  },

  selectDocument: (path: string) => {
    const { selectedPath } = get();
    if (selectedPath === path) return;
    set({ selectedPath: path });
  },
}));
