import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { fetchAiConfig, fetchEmbedding } from "@/lib/aiClient";
import { useProjectStore } from "@/stores/projectStore";

export interface SearchHit {
  projectId: string;
  type: string;
  title: string;
  filePath: string;
  snippet: string;
  score: number;
}

type SearchMode = "semantic" | "keyword" | "none";

interface SearchState {
  query: string;
  hits: SearchHit[];
  loading: boolean;
  mode: SearchMode;
  stale: boolean;
  allProjects: boolean;
  active: boolean;
  typeFilter: string | undefined;

  setQuery: (q: string) => void;
  setAllProjects: (v: boolean) => void;
  setTypeFilter: (t: string | undefined) => void;
  runSearch: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  hits: [],
  loading: false,
  mode: "none",
  stale: false,
  allProjects: false,
  active: false,
  typeFilter: undefined,

  setQuery: (q) => set({ query: q }),
  setAllProjects: (v) => set({ allProjects: v }),
  setTypeFilter: (t) => set({ typeFilter: t }),

  clearSearch: () => set({ query: "", hits: [], mode: "none", stale: false, active: false }),

  runSearch: async (query: string) => {
    if (!query.trim()) {
      set({ hits: [], mode: "none", stale: false, active: false });
      return;
    }

    set({ loading: true, active: true, query });

    const { allProjects, typeFilter } = get();
    const projectState = useProjectStore.getState();
    const selectedId = projectState.selectedProjectId;

    const projects = allProjects
      ? projectState.projects
      : projectState.projects.filter((p) => p.name === selectedId);

    const curayePaths = projects.map((p) => p.curaye_path);
    const projectId = allProjects ? undefined : selectedId ?? undefined;

    try {
      const aiConfig = await fetchAiConfig();
      const canEmbed =
        aiConfig !== null &&
        (aiConfig.embedProvider !== undefined ||
          aiConfig.kind === "ollama" ||
          aiConfig.kind === "openai");

      // Check if the index exists
      const status = await invoke<{ exists: boolean }>("search_index_status");

      if (canEmbed && status.exists && aiConfig !== null) {
        // Semantic mode
        let vector: number[];
        try {
          vector = await fetchEmbedding(aiConfig, query);
        } catch {
          // Embedding failed — fall back to keyword
          const hits = await invoke<SearchHit[]>("search_keyword", {
            query,
            curayePaths,
            docType: typeFilter ?? null,
          });
          set({ hits, loading: false, mode: "keyword", stale: false });
          return;
        }

        const hits = await invoke<SearchHit[]>("search_semantic", {
          queryVector: vector,
          projectId: projectId ?? null,
          docType: typeFilter ?? null,
          limit: 20,
        });

        // Stale check: keyword hits not in semantic results?
        const keyHits = await invoke<SearchHit[]>("search_keyword", {
          query,
          curayePaths,
          docType: typeFilter ?? null,
        });
        const semanticPaths = new Set(hits.map((h) => h.filePath));
        const stale = keyHits.some((h) => !semanticPaths.has(h.filePath));

        set({ hits, loading: false, mode: "semantic", stale });
      } else {
        // Keyword fallback
        const hits = await invoke<SearchHit[]>("search_keyword", {
          query,
          curayePaths,
          docType: typeFilter ?? null,
        });
        set({ hits, loading: false, mode: "keyword", stale: false });
      }
    } catch {
      set({ hits: [], loading: false, mode: "none", stale: false });
    }
  },
}));
