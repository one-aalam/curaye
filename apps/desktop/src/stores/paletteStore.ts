import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { fetchAiConfig, streamCompletion, type AiProviderConfig, type AiMessage } from "@/lib/aiClient";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTreeStore } from "@/stores/treeStore";
import { useSearchStore } from "@/stores/searchStore";

export type PalettePhase = "input" | "streaming" | "diff";

export type ActionType =
  | "draft-spec"
  | "reentry-brief"
  | "update-current"
  | "semantic-search"
  | "drift-detection"
  | "generate-ac"
  | "generic";

export interface ResolvedAction {
  type: ActionType;
  param?: string;
}

export interface DiffLine {
  kind: "same" | "added" | "removed";
  text: string;
}

function resolveAction(query: string): ResolvedAction {
  const q = query.trim().toLowerCase();

  const draftMatch = /^draft\s+(?:a\s+)?spec\s+(?:for\s+)?(.+)$/i.exec(query.trim());
  if (draftMatch?.[1]) return { type: "draft-spec", param: draftMatch[1].trim() };

  if (/\bbrief\b/.test(q) || /where\s+was\s+i/.test(q) || /re.?entry/.test(q)) {
    return { type: "reentry-brief" };
  }

  if (/update\s+current/.test(q) || /ship\s+/.test(q)) {
    return { type: "update-current" };
  }

  if (/find\s+where\s+i\s+solved/.test(q) || /search\s+for\s+/.test(q)) {
    const param = query.replace(/find\s+where\s+i\s+solved\s*/i, "").replace(/search\s+for\s*/i, "").trim();
    return { type: "semantic-search", param };
  }

  if (/detect\s+drift/.test(q) || /\bdrift\b/.test(q)) {
    return { type: "drift-detection" };
  }

  if (/generate\s+ac/.test(q) || /acceptance\s+criteria/.test(q)) {
    return { type: "generate-ac" };
  }

  return { type: "generic", param: query.trim() };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildMessages(action: ResolvedAction, context: PaletteContext): AiMessage[] {
  const msgs: AiMessage[] = [];

  const sysLines = [
    "You are a technical specification writer for a software project management tool called Curaye.",
    "Curaye uses markdown files with YAML frontmatter to track specs, decisions, and project state.",
  ];
  if (context.openDocId) {
    sysLines.push(`The currently open document has id: "${context.openDocId}".`);
  }
  if (context.projectName) {
    sysLines.push(`The current project is: "${context.projectName}".`);
  }
  msgs.push({ role: "system", content: sysLines.join("\n") });

  const today = todayIso();

  switch (action.type) {
    case "draft-spec": {
      const title = action.param ?? "Untitled Feature";
      const id = slugify(title);
      msgs.push({
        role: "user",
        content: `Generate a complete Curaye spec document for: "${title}".

Use this exact format (fill in all sections with meaningful content):

---
id: ${id}
title: ${title}
status: draft
effort: m
impact: medium
desire: medium
created: ${today}
updated: ${today}
---

# ${title}

## Problem

## Goal

## Non-goals

## Acceptance criteria

1.

Write the full spec now. Be specific and practical.`,
      });
      break;
    }

    case "reentry-brief": {
      msgs.push({
        role: "user",
        content: `Provide a concise re-entry brief for the ${context.projectName ?? "current"} project. Summarise: what was last being worked on, what the immediate next step should be, and any known blockers or open questions. Keep it under 200 words.`,
      });
      break;
    }

    case "update-current": {
      if (context.openDocContent) {
        msgs.push({
          role: "user",
          content: `Update the following current/ document to reflect the latest state of the project. Keep the same structure. Only update content that is likely stale — do not change what still seems accurate.\n\n${context.openDocContent}`,
        });
      } else {
        msgs.push({ role: "user", content: "No current document is open." });
      }
      break;
    }

    case "semantic-search": {
      msgs.push({
        role: "user",
        content: `I need to find where this problem was previously solved: "${action.param ?? ""}". Based on typical software project patterns, describe where in a spec/decision/current document one might look, and what keywords to search for.`,
      });
      break;
    }

    case "drift-detection": {
      msgs.push({
        role: "user",
        content: `Analyse potential drift for the ${context.projectName ?? "current"} project. Consider: Are shipped specs reflected in current/ docs? Are there any obvious gaps between what was planned and what current/ documents describe? Return a brief analysis with specific action items.`,
      });
      break;
    }

    case "generate-ac": {
      if (context.openDocContent) {
        msgs.push({
          role: "user",
          content: `Generate detailed acceptance criteria for the following spec. Add them as a numbered list under "## Acceptance criteria". Return only the acceptance criteria list, not the whole spec.\n\n${context.openDocContent}`,
        });
      } else {
        msgs.push({
          role: "user",
          content: "No document is open. Open a spec document first.",
        });
      }
      break;
    }

    default: {
      msgs.push({
        role: "user",
        content: action.param ?? "Hello",
      });
      break;
    }
  }

  return msgs;
}

export interface PaletteContext {
  curayePath: string | null;
  projectName: string | null;
  openDocId: string | null;
  openDocPath: string | null;
  openDocContent: string | null;
}

function gatherContext(): PaletteContext {
  const projectState = useProjectStore.getState();
  const editorState = useEditorStore.getState();

  const selectedId = projectState.selectedProjectId;
  const project = selectedId
    ? (projectState.projects.find((p) => p.name === selectedId) ?? null)
    : null;

  const openDocId =
    (editorState.document?.frontmatter["id"] as string | undefined) ?? null;

  return {
    curayePath: project?.curaye_path ?? null,
    projectName: project?.name ?? null,
    openDocId,
    openDocPath: editorState.currentPath,
    openDocContent: editorState.document?.raw ?? null,
  };
}

function computeDiff(before: string, after: string): { before: DiffLine[]; after: DiffLine[] } {
  const bLines = before.split("\n");
  const aLines = after.split("\n");
  const m = bLines.length;
  const n = aLines.length;

  // Flat 1D array for the LCS DP table — avoids noUncheckedIndexedAccess issues
  const dp = new Array<number>((m + 1) * (n + 1)).fill(0);
  const at = (i: number, j: number): number => dp[i * (n + 1) + j] ?? 0;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i * (n + 1) + j] =
        bLines[i - 1] === aLines[j - 1]
          ? at(i - 1, j - 1) + 1
          : Math.max(at(i - 1, j), at(i, j - 1));
    }
  }

  const beforeResult: DiffLine[] = [];
  const afterResult: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && bLines[i - 1] === aLines[j - 1]) {
      beforeResult.unshift({ kind: "same", text: bLines[i - 1] ?? "" });
      afterResult.unshift({ kind: "same", text: aLines[j - 1] ?? "" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || at(i, j - 1) >= at(i - 1, j))) {
      afterResult.unshift({ kind: "added", text: aLines[j - 1] ?? "" });
      j--;
    } else {
      beforeResult.unshift({ kind: "removed", text: bLines[i - 1] ?? "" });
      i--;
    }
  }

  return { before: beforeResult, after: afterResult };
}

interface PaletteState {
  open: boolean;
  phase: PalettePhase;
  query: string;
  resolvedAction: ResolvedAction | null;
  streamedText: string;
  originalText: string | null;
  proposedText: string | null;
  diffBefore: DiffLine[];
  diffAfter: DiffLine[];
  targetPath: string | null;
  error: string | null;
  aiConfig: AiProviderConfig | null;
  aiConfigChecked: boolean;
  // not subscribed by components — stored for cancel
  _abortController: AbortController | null;
  // saved focus target for restoration (criterion 10)
  _previousFocus: Element | null;

  openPalette: () => Promise<void>;
  closePalette: () => void;
  setQuery: (v: string) => void;
  execute: () => Promise<void>;
  saveOutput: () => Promise<void>;
  applyDiff: () => Promise<void>;
  cancelStream: () => void;
  refreshAiConfig: () => Promise<void>;
}

export const usePaletteStore = create<PaletteState>((set, get) => ({
  open: false,
  phase: "input",
  query: "",
  resolvedAction: null,
  streamedText: "",
  originalText: null,
  proposedText: null,
  diffBefore: [],
  diffAfter: [],
  targetPath: null,
  error: null,
  aiConfig: null,
  aiConfigChecked: false,
  _abortController: null,
  _previousFocus: null,

  openPalette: async () => {
    // Criterion 9: don't open if a text input has focus
    const active = document.activeElement;
    const tag = active?.tagName.toLowerCase();
    if (
      active &&
      (tag === "input" || tag === "textarea" || (active as HTMLElement).isContentEditable)
    ) {
      return;
    }

    // Criterion 10: save current focus to restore on close
    set({ _previousFocus: active });

    set({ open: true, phase: "input", query: "", error: null, streamedText: "" });

    // Check AI config if not yet checked
    const { aiConfigChecked } = get();
    if (!aiConfigChecked) {
      try {
        const config = await fetchAiConfig();
        set({ aiConfig: config, aiConfigChecked: true });
      } catch {
        set({ aiConfig: null, aiConfigChecked: true });
      }
    }
  },

  closePalette: () => {
    const { _abortController, _previousFocus } = get();
    _abortController?.abort();
    set({
      open: false,
      phase: "input",
      query: "",
      resolvedAction: null,
      streamedText: "",
      originalText: null,
      proposedText: null,
      diffBefore: [],
      diffAfter: [],
      targetPath: null,
      error: null,
      _abortController: null,
    });

    // Criterion 10: restore focus
    if (_previousFocus instanceof HTMLElement) {
      _previousFocus.focus();
    }
    set({ _previousFocus: null });
  },

  setQuery: (v: string) => set({ query: v }),

  execute: async () => {
    const { query, aiConfig } = get();
    if (!query.trim()) return;

    const action = resolveAction(query);
    const context = gatherContext();

    // Semantic search bypasses streaming — hands off to the search panel
    if (action.type === "semantic-search" && action.param) {
      get().closePalette();
      void useSearchStore.getState().runSearch(action.param);
      return;
    }

    set({
      resolvedAction: action,
      phase: "streaming",
      streamedText: "",
      error: null,
    });

    if (!aiConfig) {
      // Should not happen as UI guards against this, but just in case
      set({ error: "AI is not configured." });
      return;
    }

    const controller = new AbortController();
    set({ _abortController: controller });

    // For update-current, grab the original text now
    const originalText = context.openDocContent ?? null;
    if (action.type === "update-current") {
      set({ originalText });
    }

    // Compute target write path for draft-spec
    let targetPath: string | null = null;
    if (action.type === "draft-spec" && context.curayePath) {
      const slug = slugify(action.param ?? "draft");
      targetPath = `${context.curayePath}/planned/_${todayIso()}-${slug}.md`;
    }
    if (action.type === "update-current" && context.openDocPath) {
      targetPath = context.openDocPath;
    }
    set({ targetPath });

    const messages = buildMessages(action, context);

    try {
      for await (const token of streamCompletion(aiConfig, messages, controller.signal)) {
        set((state) => ({ streamedText: state.streamedText + token }));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // cancelled — closePalette() already handles cleanup
        return;
      }
      // Keep phase as "streaming" so the error banner is visible
      set({ error: String(err), _abortController: null });
      return;
    }

    // Streaming complete
    const { streamedText } = get();
    if (action.type === "update-current" && originalText) {
      const proposed = streamedText;
      const { before, after } = computeDiff(originalText, proposed);
      set({
        proposedText: proposed,
        diffBefore: before,
        diffAfter: after,
        phase: "diff",
      });
    }
    // For non-diff actions, stay in streaming phase (user sees Save/Discard)

    set({ _abortController: null });
  },

  saveOutput: async () => {
    const { streamedText, targetPath, resolvedAction } = get();
    if (!streamedText || !targetPath) return;

    await invoke("write_document", { path: targetPath, content: streamedText });

    // Refresh tree and load the saved doc in editor
    const context = gatherContext();
    if (context.curayePath) {
      void useTreeStore.getState().loadTree(context.curayePath);
    }
    if (resolvedAction?.type === "draft-spec") {
      void useEditorStore.getState().loadDocument(targetPath, "spec");
    }

    get().closePalette();
  },

  applyDiff: async () => {
    const { proposedText, targetPath } = get();
    if (!proposedText || !targetPath) return;

    await invoke("write_document", { path: targetPath, content: proposedText });

    const context = gatherContext();
    if (context.curayePath) {
      void useTreeStore.getState().loadTree(context.curayePath);
    }
    void useEditorStore.getState().loadDocument(targetPath, "spec");

    get().closePalette();
  },

  cancelStream: () => {
    const { _abortController } = get();
    _abortController?.abort();
    set({ _abortController: null });
    get().closePalette();
  },

  refreshAiConfig: async () => {
    try {
      const config = await fetchAiConfig();
      set({ aiConfig: config, aiConfigChecked: true });
    } catch {
      set({ aiConfig: null, aiConfigChecked: true });
    }
  },
}));
