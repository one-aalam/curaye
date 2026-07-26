import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export const SHARED_CATEGORIES = ["decisions", "patterns", "design", "agents", "stack"] as const;
export type SharedCategory = (typeof SHARED_CATEGORIES)[number];

export interface SharedDocSummary {
  id: string;
  category: SharedCategory;
  title: string;
  adoptedByCount: number;
  promoted: string | null;
}

function validateDocId(id: string): string | null {
  if (!id.trim()) return "Document id is required";
  if (/[/\\:*?"<>|]/.test(id)) return 'Cannot contain / \\ : * ? " < > |';
  if (id === "." || id === "..") return "Cannot be . or ..";
  return null;
}

export { validateDocId };

interface SharedLayerState {
  sharedLayerOpen: boolean;
  selectedCategory: SharedCategory;
  docs: SharedDocSummary[];
  docsLoading: boolean;
  selectedDocId: string | null;
  selectedDocCategory: SharedCategory | null;
  selectedDocContent: string | null;
  docLoading: boolean;
  docError: string | null;
  editedContent: string | null;
  saving: boolean;
  saveError: string | null;
  notificationCount: number;
  showNewDocForm: boolean;
  newDocCategory: SharedCategory;
  newDocId: string;
  newDocIdError: string | null;
  newDocError: string | null;
  creatingDoc: boolean;

  openPanel: () => Promise<void>;
  closePanel: () => void;
  selectCategory: (category: SharedCategory) => void;
  selectDoc: (docId: string, category: SharedCategory) => Promise<void>;
  setEditedContent: (content: string) => void;
  saveDoc: (sourceProjectId?: string) => Promise<void>;
  cancelEdit: () => void;
  showNewForm: () => void;
  hideNewForm: () => void;
  setNewDocCategory: (category: SharedCategory) => void;
  setNewDocId: (id: string) => void;
  createDoc: () => Promise<void>;
  refreshNotificationCount: (projectName: string) => Promise<void>;
}

export const useSharedLayerStore = create<SharedLayerState>((set, get) => ({
  sharedLayerOpen: false,
  selectedCategory: "decisions",
  docs: [],
  docsLoading: false,
  selectedDocId: null,
  selectedDocCategory: null,
  selectedDocContent: null,
  docLoading: false,
  docError: null,
  editedContent: null,
  saving: false,
  saveError: null,
  notificationCount: 0,
  showNewDocForm: false,
  newDocCategory: "decisions",
  newDocId: "",
  newDocIdError: null,
  newDocError: null,
  creatingDoc: false,

  openPanel: async () => {
    set({ sharedLayerOpen: true, docsLoading: true });
    try {
      const docs = await invoke<SharedDocSummary[]>("list_shared_docs", { category: null });
      set({ docs, docsLoading: false });
    } catch {
      set({ docsLoading: false });
    }
  },

  closePanel: () => {
    set({
      sharedLayerOpen: false,
      selectedDocId: null,
      selectedDocCategory: null,
      selectedDocContent: null,
      docLoading: false,
      docError: null,
      editedContent: null,
      saveError: null,
      showNewDocForm: false,
      newDocId: "",
      newDocIdError: null,
      newDocError: null,
    });
  },

  selectCategory: (category) => {
    set({ selectedCategory: category });
  },

  selectDoc: async (docId, category) => {
    set({ selectedDocId: docId, selectedDocCategory: category, selectedDocContent: null, editedContent: null, saveError: null, docLoading: true, docError: null });
    try {
      const content = await invoke<string>("read_shared_doc", { category, docId });
      set({ selectedDocContent: content, editedContent: content, docLoading: false });
    } catch (e) {
      set({ docLoading: false, docError: String(e) });
    }
  },

  setEditedContent: (content) => {
    set({ editedContent: content });
  },

  saveDoc: async (sourceProjectId) => {
    const { selectedDocId, selectedDocCategory, editedContent } = get();
    if (!selectedDocId || !selectedDocCategory || editedContent === null) return;
    set({ saving: true, saveError: null });
    try {
      await invoke<number>("write_shared_doc", {
        category: selectedDocCategory,
        docId: selectedDocId,
        content: editedContent,
        sourceProjectId: sourceProjectId ?? null,
      });
      // Reload the doc list and reset content baseline
      const docs = await invoke<SharedDocSummary[]>("list_shared_docs", { category: null });
      set({ docs, selectedDocContent: editedContent, saving: false });
    } catch (e) {
      set({ saving: false, saveError: String(e) });
    }
  },

  cancelEdit: () => {
    const { selectedDocContent } = get();
    set({ editedContent: selectedDocContent, saveError: null });
  },

  showNewForm: () => {
    const { selectedCategory } = get();
    set({ showNewDocForm: true, newDocCategory: selectedCategory, newDocId: "", newDocIdError: null, newDocError: null });
  },

  hideNewForm: () => {
    set({ showNewDocForm: false, newDocId: "", newDocIdError: null, newDocError: null });
  },

  setNewDocCategory: (category) => {
    set({ newDocCategory: category });
  },

  setNewDocId: (id) => {
    set({ newDocId: id, newDocIdError: validateDocId(id) });
  },

  createDoc: async () => {
    const { newDocCategory, newDocId } = get();
    const idErr = validateDocId(newDocId);
    if (idErr) {
      set({ newDocIdError: idErr });
      return;
    }
    set({ creatingDoc: true, newDocError: null });
    try {
      await invoke<string>("create_shared_doc", { category: newDocCategory, docId: newDocId });
      const docs = await invoke<SharedDocSummary[]>("list_shared_docs", { category: null });
      set({
        docs,
        creatingDoc: false,
        showNewDocForm: false,
        selectedCategory: newDocCategory,
        newDocId: "",
        newDocIdError: null,
        newDocError: null,
      });
      // Select the new doc
      const { selectDoc } = get();
      await selectDoc(newDocId, newDocCategory);
    } catch (e) {
      set({ creatingDoc: false, newDocError: String(e) });
    }
  },

  refreshNotificationCount: async (projectName) => {
    try {
      const count = await invoke<number>("get_notification_count", { projectName });
      set({ notificationCount: count });
    } catch {
      // best-effort
    }
  },
}));
