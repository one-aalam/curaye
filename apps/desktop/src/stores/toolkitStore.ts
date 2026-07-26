import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface ToolkitTools {
  formatter?: string;
  linter?: string;
  test?: string;
  e2e?: string;
  package_manager?: string;
}

export interface ToolkitPreset {
  id: string;
  title: string;
  runtime: string[];
  app_type: string | undefined;
  framework: string[];
  starter_kit: string | undefined;
  starter_kit_cmd: string | undefined;
  design_system: string | undefined;
  tools: ToolkitTools;
  body: string;
  file_path: string;
}

export interface ToolkitPresetInput {
  id: string;
  title: string;
  runtime: string[];
  app_type: string | undefined;
  framework: string[];
  starter_kit: string | undefined;
  starter_kit_cmd: string | undefined;
  design_system: string | undefined;
  tools: ToolkitTools;
  body: string;
}

// Empty preset for "Add" form
export function emptyPresetInput(): ToolkitPresetInput {
  return {
    id: "",
    title: "",
    runtime: [],
    app_type: undefined,
    framework: [],
    starter_kit: undefined,
    starter_kit_cmd: undefined,
    design_system: undefined,
    tools: {},
    body: "",
  };
}

interface ToolkitState {
  presets: ToolkitPreset[];
  loading: boolean;
  error: string | null;

  // Form modal state
  formOpen: boolean;
  formMode: "add" | "edit";
  formInput: ToolkitPresetInput;
  formSaving: boolean;
  formError: string | null;

  // Deletion state
  deletingId: string | null;

  loadPresets: () => Promise<void>;
  openAddForm: () => void;
  openEditForm: (preset: ToolkitPreset) => void;
  closeForm: () => void;
  setFormField: <K extends keyof ToolkitPresetInput>(key: K, value: ToolkitPresetInput[K]) => void;
  setToolField: (key: keyof ToolkitTools, value: string) => void;
  saveForm: () => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
}

export const useToolkitStore = create<ToolkitState>((set, get) => ({
  presets: [],
  loading: false,
  error: null,
  formOpen: false,
  formMode: "add",
  formInput: emptyPresetInput(),
  formSaving: false,
  formError: null,
  deletingId: null,

  loadPresets: async () => {
    set({ loading: true, error: null });
    try {
      const presets = await invoke<ToolkitPreset[]>("list_toolkit_presets");
      set({ presets, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  openAddForm: () => {
    set({ formOpen: true, formMode: "add", formInput: emptyPresetInput(), formError: null });
  },

  openEditForm: (preset) => {
    set({
      formOpen: true,
      formMode: "edit",
      formInput: {
        id: preset.id,
        title: preset.title,
        runtime: preset.runtime,
        app_type: preset.app_type,
        framework: preset.framework,
        starter_kit: preset.starter_kit,
        starter_kit_cmd: preset.starter_kit_cmd,
        design_system: preset.design_system,
        tools: { ...preset.tools },
        body: preset.body,
      },
      formError: null,
    });
  },

  closeForm: () => {
    set({ formOpen: false, formError: null });
  },

  setFormField: (key, value) => {
    set((state) => ({ formInput: { ...state.formInput, [key]: value } }));
  },

  setToolField: (key, value) => {
    set((state) => ({
      formInput: {
        ...state.formInput,
        tools: { ...state.formInput.tools, [key]: value || undefined },
      },
    }));
  },

  saveForm: async () => {
    const { formInput } = get();
    if (!formInput.id.trim()) {
      set({ formError: "Preset id is required" });
      return;
    }
    set({ formSaving: true, formError: null });
    try {
      await invoke("write_toolkit_preset", { preset: formInput });
      const presets = await invoke<ToolkitPreset[]>("list_toolkit_presets");
      set({ presets, formSaving: false, formOpen: false });
    } catch (e) {
      set({ formSaving: false, formError: String(e) });
    }
  },

  deletePreset: async (id) => {
    set({ deletingId: id });
    try {
      await invoke("delete_toolkit_preset", { id });
      const presets = await invoke<ToolkitPreset[]>("list_toolkit_presets");
      set({ presets, deletingId: null });
    } catch (e) {
      set({ deletingId: null, error: String(e) });
    }
  },
}));
