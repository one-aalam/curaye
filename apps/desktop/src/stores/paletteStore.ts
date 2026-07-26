import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { fetchAiConfig, fetchEmbedding, streamCompletion, type AiProviderConfig, type AiMessage } from "@/lib/aiClient";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTreeStore } from "@/stores/treeStore";

export type PalettePhase = "input" | "streaming" | "diff";

export interface AttachedSpec {
  id: string;
  label: string;
  docType: string;
}

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

export interface RagContext {
  hits: Array<{ title: string; type: string; filePath: string; body: string }>;
  prdContent: string | null;
  stackContent: string | null;
  truncated: boolean;
}

// Which doc sections to search per command
const RAG_DOC_TYPES: Partial<Record<ActionType, string[]>> = {
  "semantic-search": ["planned", "current", "shipped", "decisions"],
  "draft-spec": ["planned", "shipped"],
  "generate-ac": ["shipped", "planned"],
};

const RAG_CHAR_BUDGET = 12000;
const PRD_CHAR_BUDGET = 800;
const STACK_CHAR_BUDGET = 600;

function trimAtSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const sub = text.slice(0, maxChars);
  const last = Math.max(sub.lastIndexOf("."), sub.lastIndexOf("!"), sub.lastIndexOf("?"));
  return last > 0 ? sub.slice(0, last + 1) : sub;
}

async function gatherRagContext(
  query: string,
  curayePath: string,
  projectName: string | null,
  docTypes: string[],
  charBudget: number,
  aiConfig: AiProviderConfig | null,
  signal: AbortSignal,
): Promise<RagContext> {
  const prdBudget = PRD_CHAR_BUDGET;
  const stackBudget = STACK_CHAR_BUDGET;
  const hitBudget = charBudget - prdBudget - stackBudget;

  // Load prd.md and stack.md via generate_brief_context
  let prdContent: string | null = null;
  let stackContent: string | null = null;
  try {
    const brief = await invoke<{ prdContent: string | null; stackContent: string | null }>(
      "generate_brief_context",
      { curayePath },
    );
    prdContent = brief.prdContent ? trimAtSentenceBoundary(brief.prdContent, prdBudget) : null;
    stackContent = brief.stackContent ? trimAtSentenceBoundary(brief.stackContent, stackBudget) : null;
  } catch {
    // files don't exist or command unavailable
  }

  if (signal.aborted) return { hits: [], prdContent, stackContent, truncated: false };

  // Determine whether embedding is available (Anthropic without explicit embedProvider falls back to keyword)
  const canEmbed =
    aiConfig !== null &&
    (aiConfig.embedProvider !== undefined ||
      aiConfig.kind === "ollama" ||
      aiConfig.kind === "openai");

  // Tauri SearchResult serialises doc_type as "type"
  interface TauriHit {
    projectId: string;
    type: string;
    title: string;
    filePath: string;
    snippet: string;
    score: number;
  }

  let rawHits: TauriHit[] = [];
  try {
    if (canEmbed && aiConfig !== null) {
      let indexExists = false;
      try {
        const status = await invoke<{ exists: boolean }>("search_index_status");
        indexExists = status.exists;
      } catch {
        // ignore — treat as no index
      }

      if (indexExists && !signal.aborted) {
        try {
          const vector = await fetchEmbedding(aiConfig, query);
          if (!signal.aborted) {
            rawHits = await invoke<TauriHit[]>("search_semantic", {
              queryVector: vector,
              projectId: projectName ?? null,
              docType: null,
              limit: 20,
            });
          }
        } catch {
          // Embedding failed — fall back to keyword silently
          if (!signal.aborted) {
            rawHits = await invoke<TauriHit[]>("search_keyword", {
              query,
              curayePaths: [curayePath],
              docType: null,
            });
          }
        }
      } else if (!signal.aborted) {
        rawHits = await invoke<TauriHit[]>("search_keyword", {
          query,
          curayePaths: [curayePath],
          docType: null,
        });
      }
    } else if (!signal.aborted) {
      rawHits = await invoke<TauriHit[]>("search_keyword", {
        query,
        curayePaths: [curayePath],
        docType: null,
      });
    }
  } catch {
    rawHits = [];
  }

  if (signal.aborted) return { hits: [], prdContent, stackContent, truncated: false };

  // Filter by the relevant doc types for this command and take top hits
  const filtered = rawHits.filter((h) => docTypes.includes(h.type));
  const topHits = filtered.slice(0, 10);
  const truncated = filtered.length > topHits.length;
  const perHitBudget = topHits.length > 0 ? Math.floor(hitBudget / topHits.length) : hitBudget;

  // Read full document bodies subject to per-hit budget
  const hits: RagContext["hits"] = [];
  for (const hit of topHits) {
    if (signal.aborted) break;
    try {
      const doc = await invoke<{ body: string }>("read_document", {
        path: hit.filePath,
        docType: hit.type,
      });
      const body = trimAtSentenceBoundary(doc.body, perHitBudget);
      hits.push({ title: hit.title, type: hit.type, filePath: hit.filePath, body });
    } catch {
      // Skip documents that can't be read
    }
  }

  return { hits, prdContent, stackContent, truncated };
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
    const stripped = query.trim()
      .replace(/generate\s+acceptance\s+criteria\s+for\s*/i, "")
      .replace(/generate\s+acceptance\s+criteria\s*/i, "")
      .replace(/generate\s+ac\s+for\s*/i, "")
      .replace(/generate\s+ac\s*/i, "")
      .trim();
    return stripped ? { type: "generate-ac", param: stripped } : { type: "generate-ac" };
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

function appendRagToSystem(sysLines: string[], ragContext: RagContext | null): void {
  if (!ragContext) return;

  if (ragContext.prdContent || ragContext.stackContent) {
    sysLines.push("\n## Project context");
    if (ragContext.prdContent) {
      sysLines.push("### prd.md\n" + ragContext.prdContent);
    }
    if (ragContext.stackContent) {
      sysLines.push("### stack.md\n" + ragContext.stackContent);
    }
  }

  if (ragContext.hits.length > 0) {
    sysLines.push("\n## Relevant existing documents");
    for (const hit of ragContext.hits) {
      sysLines.push(`### ${hit.title} (${hit.type})\n${hit.body}`);
    }
  }
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

  const today = todayIso();

  switch (action.type) {
    case "draft-spec": {
      appendRagToSystem(sysLines, context.ragContext);
      msgs.push({ role: "system", content: sysLines.join("\n") });

      const title = action.param ?? "Untitled Feature";
      const id = slugify(title);
      msgs.push({
        role: "user",
        content: `Generate a Curaye spec for: "${title}".

Respond with ONLY the file content below — no code fences, no intro text, no title heading in the body. Keep the frontmatter exactly as shown.

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

## Problem

## Goal

## Non-goals

## Acceptance criteria

1.

Fill in every body section now with specific, practical content for "${title}".`,
      });
      break;
    }

    case "reentry-brief": {
      msgs.push({ role: "system", content: sysLines.join("\n") });
      msgs.push({
        role: "user",
        content: `Provide a concise re-entry brief for the ${context.projectName ?? "current"} project. Summarise: what was last being worked on, what the immediate next step should be, and any known blockers or open questions. Keep it under 200 words.`,
      });
      break;
    }

    case "update-current": {
      msgs.push({ role: "system", content: sysLines.join("\n") });
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
      appendRagToSystem(sysLines, context.ragContext);
      msgs.push({ role: "system", content: sysLines.join("\n") });
      msgs.push({
        role: "user",
        content: `I want to find where I previously solved: "${action.param ?? ""}"\n\nBased on the project documents in the system context, which documents are most relevant and what solution or approach do they describe? Cite specific document titles and summarise what each contains. If no documents match, say so clearly.`,
      });
      break;
    }

    case "drift-detection": {
      msgs.push({ role: "system", content: sysLines.join("\n") });
      msgs.push({
        role: "user",
        content: `Analyse potential drift for the ${context.projectName ?? "current"} project. Consider: Are shipped specs reflected in current/ docs? Are there any obvious gaps between what was planned and what current/ documents describe? Return a brief analysis with specific action items.`,
      });
      break;
    }

    case "generate-ac": {
      appendRagToSystem(sysLines, context.ragContext);
      msgs.push({ role: "system", content: sysLines.join("\n") });
      if (action.param) {
        msgs.push({
          role: "user",
          content: `Generate detailed, testable acceptance criteria for: "${action.param}". Return a numbered list only — no preamble.`,
        });
      } else if (context.openDocContent) {
        msgs.push({
          role: "user",
          content: `Generate detailed acceptance criteria for the following spec. Return only the acceptance criteria as a numbered list under "## Acceptance criteria".\n\n${context.openDocContent}`,
        });
      } else {
        msgs.push({
          role: "user",
          content: "No document is open and no feature was specified. Use 'Generate acceptance criteria for [feature name]' or open a spec first.",
        });
      }
      break;
    }

    default: {
      msgs.push({ role: "system", content: sysLines.join("\n") });
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
  ragContext: RagContext | null;
}

function gatherContext(attachedSpec: AttachedSpec | null): PaletteContext {
  const projectState = useProjectStore.getState();
  const editorState = useEditorStore.getState();

  const selectedId = projectState.selectedProjectId;
  const project = selectedId
    ? (projectState.projects.find((p) => p.name === selectedId) ?? null)
    : null;

  const openDocId =
    (editorState.document?.frontmatter["id"] as string | undefined) ??
    attachedSpec?.id ??
    null;

  return {
    curayePath: project?.curaye_path ?? null,
    projectName: project?.name ?? null,
    openDocId,
    openDocPath: editorState.currentPath,
    openDocContent: editorState.document?.raw ?? null,
    ragContext: null,
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
  attachedSpec: AttachedSpec | null;
  // not subscribed by components — stored for cancel
  _abortController: AbortController | null;
  // saved focus target for restoration (criterion 10)
  _previousFocus: Element | null;

  openPalette: () => Promise<void>;
  closePalette: () => void;
  setQuery: (v: string) => void;
  setAttachedSpec: (spec: AttachedSpec | null) => void;
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
  attachedSpec: null,
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
      attachedSpec: null,
      _abortController: null,
    });

    // Criterion 10: restore focus
    if (_previousFocus instanceof HTMLElement) {
      _previousFocus.focus();
    }
    set({ _previousFocus: null });
  },

  setQuery: (v: string) => set({ query: v }),
  setAttachedSpec: (spec: AttachedSpec | null) => set({ attachedSpec: spec }),

  execute: async () => {
    const { query, aiConfig } = get();
    if (!query.trim()) return;

    const action = resolveAction(query);
    const context = gatherContext(get().attachedSpec);

    set({
      resolvedAction: action,
      phase: "streaming",
      streamedText: "",
      error: null,
    });

    if (!aiConfig) {
      set({ error: "AI is not configured." });
      return;
    }

    // Create abort controller early — covers both RAG gathering and streaming (criterion 11)
    const controller = new AbortController();
    set({ _abortController: controller });

    // RAG pre-flight: gather context before calling the AI for the three enriched commands
    const ragDocTypes = RAG_DOC_TYPES[action.type];
    if (ragDocTypes && context.curayePath) {
      const ragQuery =
        action.type === "semantic-search" ? (action.param ?? query) : query;
      try {
        context.ragContext = await gatherRagContext(
          ragQuery,
          context.curayePath,
          context.projectName,
          ragDocTypes,
          RAG_CHAR_BUDGET,
          aiConfig,
          controller.signal,
        );
      } catch {
        // RAG failure is non-fatal — proceed without context
      }
      if (controller.signal.aborted) return;
    }

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
    const context = gatherContext(get().attachedSpec);
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

    const context = gatherContext(get().attachedSpec);
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
