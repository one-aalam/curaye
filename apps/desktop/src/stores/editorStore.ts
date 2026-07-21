import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type EditorMode = "structured" | "raw";

export interface FrontmatterFields {
  id?: string;
  title?: string;
  status?: string;
  effort?: string;
  impact?: string;
  desire?: string;
  requires?: string[];
  tags?: string[];
  release?: string;
  created?: string;
  updated?: string;
  [key: string]: unknown;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ParsedDocument {
  frontmatter: FrontmatterFields;
  body: string;
  raw: string;
  validation_issues: ValidationIssue[];
}

interface EditorState {
  document: ParsedDocument | null;
  currentPath: string | null;
  mode: EditorMode;
  unsaved: boolean;
  loading: boolean;
  saving: boolean;
  activeIssueField: string | null;
  loadDocument: (path: string, docType: string) => Promise<void>;
  updateFrontmatter: (key: string, value: unknown) => void;
  updateBody: (body: string) => void;
  updateRaw: (raw: string) => void;
  setMode: (mode: EditorMode) => void;
  save: () => Promise<void>;
  discard: () => void;
  highlightField: (field: string | null) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: null,
  currentPath: null,
  mode: "structured",
  unsaved: false,
  loading: false,
  saving: false,
  activeIssueField: null,

  loadDocument: async (path: string, docType: string) => {
    set({ loading: true, unsaved: false, activeIssueField: null });
    try {
      const doc = await invoke<ParsedDocument>("read_document", { path, docType });
      set({ document: doc, currentPath: path, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  updateFrontmatter: (key: string, value: unknown) => {
    set((state) => {
      if (!state.document) return state;
      const today = todayIso();
      return {
        document: {
          ...state.document,
          frontmatter: {
            ...state.document.frontmatter,
            [key]: value,
            updated: today,
          },
        },
        unsaved: true,
      };
    });
  },

  updateBody: (body: string) => {
    set((state) => {
      if (!state.document) return state;
      return { document: { ...state.document, body }, unsaved: true };
    });
  },

  updateRaw: (raw: string) => {
    set((state) => {
      if (!state.document) return state;
      return { document: { ...state.document, raw }, unsaved: true };
    });
  },

  setMode: (mode: EditorMode) => {
    const { document, mode: currentMode } = get();
    if (!document || mode === currentMode) return;

    if (currentMode === "raw" && mode === "structured") {
      // parse the raw text back into frontmatter+body
      invoke<ParsedDocument>("parse_raw", { raw: document.raw })
        .then((parsed) => {
          set({ document: parsed, mode });
        })
        .catch(() => {
          set({ mode });
        });
    } else if (currentMode === "structured" && mode === "raw") {
      // serialize frontmatter+body into raw text
      invoke<string>("serialize_document", {
        frontmatter: document.frontmatter,
        body: document.body,
      })
        .then((raw) => {
          set({ document: { ...document, raw }, mode });
        })
        .catch(() => {
          set({ mode });
        });
    }
  },

  save: async () => {
    const { document, currentPath, mode } = get();
    if (!document || !currentPath) return;
    set({ saving: true });

    try {
      let content: string;
      if (mode === "raw") {
        content = document.raw;
      } else {
        content = await invoke<string>("serialize_document", {
          frontmatter: document.frontmatter,
          body: document.body,
        });
      }
      await invoke("write_document", { path: currentPath, content });
      set({ unsaved: false, saving: false });
    } catch {
      set({ saving: false });
    }
  },

  discard: () => {
    set({ unsaved: false });
  },

  highlightField: (field: string | null) => {
    set({ activeIssueField: field });
  },
}));
