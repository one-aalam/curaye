import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface PlannedSpecSummary {
  id: string;
  title: string;
  status: string;
  effort: string;
  impact?: string;
  updated: string;
  body: string;
}

export interface CurrentDocSummary {
  id: string;
  title: string;
  domain: string;
  body: string;
}

export interface DecisionSummary {
  id: string;
  title: string;
  status: string;
  body: string;
}

export interface BriefContext {
  projectName: string;
  lastActivityDate: string;
  currentDocs: CurrentDocSummary[];
  plannedSpecs: PlannedSpecSummary[];
  decisions: DecisionSummary[];
  prdContent: string | null;
  stackContent: string | null;
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  if (!dateStr || dateStr === "unknown") return "unknown";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "today";
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? "s" : ""} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? "s" : ""} ago`;
}

const STATUS_ORDER: Record<string, number> = { building: 0, ready: 1, draft: 2 };
const IMPACT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function suggestNext(specs: PlannedSpecSummary[]): PlannedSpecSummary | null {
  const building = specs.filter((s) => s.status === "building");
  if (building.length > 0) return building[0] ?? null;
  const ready = specs.filter((s) => s.status === "ready");
  if (ready.length === 0) return null;
  return (
    [...ready].sort(
      (a, b) =>
        (IMPACT_ORDER[a.impact ?? "low"] ?? 3) - (IMPACT_ORDER[b.impact ?? "low"] ?? 3),
    )[0] ?? null
  );
}

function latestUpdated(specs: PlannedSpecSummary[]): PlannedSpecSummary | null {
  if (specs.length === 0) return null;
  return [...specs].sort((a, b) => b.updated.localeCompare(a.updated))[0] ?? null;
}

export function buildDeterministicBrief(ctx: BriefContext): string {
  const divider = "─────────────────────────────────────────";
  const ago = timeAgo(ctx.lastActivityDate);
  const lines: string[] = [
    divider,
    `CURAYE  Re-entry Brief: ${ctx.projectName}`,
    `Last activity: ${ago} (${ctx.lastActivityDate})`,
    divider,
    "",
    "CURRENT STATE",
  ];

  if (ctx.currentDocs.length === 0) {
    lines.push("  No current/ documents found.");
  } else {
    for (const doc of ctx.currentDocs) {
      lines.push(`  ${doc.title}${doc.domain ? ` (${doc.domain})` : ""}`);
    }
  }

  lines.push("", "WHAT WAS PLANNED");
  const sorted = [...ctx.plannedSpecs].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5),
  );
  if (sorted.length === 0) {
    lines.push("  No planned specs.");
  } else {
    for (const spec of sorted) {
      lines.push(`  ${spec.status.padEnd(10)}  ${spec.id} (${spec.effort})  — ${spec.title}`);
    }
  }

  lines.push("", "WHERE YOU LEFT OFF");
  const latest = latestUpdated(ctx.plannedSpecs);
  if (!latest) {
    lines.push("  No planned specs found.");
  } else {
    lines.push(`  Last touched: ${latest.id}, updated ${latest.updated}.`);
    lines.push(`  "${latest.title}"`);
  }

  lines.push("", "DECISIONS TO REVISIT");
  const superseded = ctx.decisions.filter((d) => d.status === "superseded");
  if (superseded.length === 0) {
    lines.push("  No superseded decisions found.");
  } else {
    for (const d of superseded) {
      lines.push(`  ⚠  ${d.id} — ${d.title} (superseded)`);
    }
  }

  lines.push("", "SUGGESTED FIRST STEP");
  const next = suggestNext(ctx.plannedSpecs);
  if (!next) {
    lines.push("  No planned specs to build next.");
  } else {
    const reason =
      next.status === "building" ? "already in progress" : "highest-impact ready spec";
    lines.push(`  Build ${next.id} — ${next.title}`);
    lines.push(`  Reason: ${reason}. Estimated effort: ${next.effort}.`);
  }

  lines.push("", "VISION CHECK");
  if (!ctx.prdContent) {
    lines.push("  No prd.md found — add one to enable vision alignment checks.");
  } else {
    const count = ctx.plannedSpecs.length;
    if (count === 0) {
      lines.push("  prd.md found. No active planned specs — backlog may be complete.");
    } else {
      lines.push(
        `  prd.md found. ${count} active spec${count !== 1 ? "s" : ""} in the backlog.`,
      );
      lines.push("  Configure an AI provider for a full alignment check.");
    }
  }

  lines.push(divider);
  return lines.join("\n");
}

function buildAiMessages(ctx: BriefContext): Array<{ role: string; content: string }> {
  const ago = timeAgo(ctx.lastActivityDate);
  const contextParts: string[] = [
    `# Context for Re-entry Brief: ${ctx.projectName}`,
    "",
  ];
  if (ctx.prdContent) {
    contextParts.push("## PRD (North Star)", ctx.prdContent, "");
  }
  if (ctx.stackContent) {
    contextParts.push("## Stack", ctx.stackContent, "");
  }
  if (ctx.currentDocs.length > 0) {
    contextParts.push("## Current State Documents");
    for (const doc of ctx.currentDocs) {
      contextParts.push(`### ${doc.title} (${doc.domain})`, doc.body);
    }
    contextParts.push("");
  }
  contextParts.push("## Planned Specs");
  if (ctx.plannedSpecs.length === 0) {
    contextParts.push("None.");
  } else {
    const sorted = [...ctx.plannedSpecs].sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5),
    );
    for (const s of sorted) {
      contextParts.push(
        `- [${s.status}] ${s.id} (effort: ${s.effort}, impact: ${s.impact ?? "unset"}) — ${s.title} — updated: ${s.updated}`,
      );
    }
  }
  contextParts.push("");
  if (ctx.decisions.length > 0) {
    contextParts.push("## Decisions");
    for (const d of ctx.decisions) {
      contextParts.push(`- [${d.status}] ${d.id} — ${d.title}`);
    }
  }

  const divider = "─────────────────────────────────────────";
  return [
    {
      role: "system",
      content:
        "You are a developer tool that generates re-entry briefs. Output ONLY the brief in the specified format — no preamble, no explanation.",
    },
    {
      role: "user",
      content: `Generate a re-entry brief for the project "${ctx.projectName}" (last activity: ${ago}, ${ctx.lastActivityDate}).

${contextParts.join("\n")}

Output the brief in EXACTLY this format:

${divider}
CURAYE  Re-entry Brief: ${ctx.projectName}
Last activity: ${ago} (${ctx.lastActivityDate})
${divider}

CURRENT STATE
[3–5 sentence summary derived from the current/ documents]

WHAT WAS PLANNED
[List of planned specs sorted: building first, then ready, then draft. If none, say so explicitly.]

WHERE YOU LEFT OFF
[The most-recently-updated planned spec with a one-sentence summary]

DECISIONS TO REVISIT
[List superseded decisions and any referencing potentially outdated libraries. If none, say so.]

SUGGESTED FIRST STEP
[Single recommendation. Prefer status:building, else highest-impact status:ready]

VISION CHECK
[One sentence on whether planned specs align with the PRD north star, or note prd.md is missing.]
${divider}`,
    },
  ];
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface AiStreamEvent {
  type: "Token" | "Done" | "Error";
  payload?: string;
}

interface BriefState {
  active: boolean;
  streaming: boolean;
  content: string;
  context: BriefContext | null;
  suggestedSpecPath: string | null;
  error: string | null;
  // Last-opened tracking
  lastOpenedDate: string | null;
  isDormant: boolean;
  generateBrief: (curayePath: string, aiConfig: unknown | null) => Promise<void>;
  cancelBrief: () => void;
  saveBrief: (curayePath: string, date: string) => Promise<string>;
  closeBrief: () => void;
  loadLastOpened: (curayePath: string) => Promise<void>;
  recordOpened: (curayePath: string) => Promise<void>;
}

export const useBriefStore = create<BriefState>((set, get) => ({
  active: false,
  streaming: false,
  content: "",
  context: null,
  suggestedSpecPath: null,
  error: null,
  lastOpenedDate: null,
  isDormant: false,

  generateBrief: async (curayePath: string, aiConfig: unknown | null) => {
    set({ active: true, streaming: true, content: "", error: null });
    try {
      const ctx = await invoke<BriefContext>("generate_brief_context", { curayePath });
      set({ context: ctx });

      // Determine suggested spec path for "Start working"
      const next = suggestNext(ctx.plannedSpecs);
      const specPath = next ? `${curayePath}/planned/${next.id}.md` : null;
      set({ suggestedSpecPath: specPath });

      if (!aiConfig) {
        // Deterministic
        const brief = buildDeterministicBrief(ctx);
        set({ content: brief, streaming: false });
        return;
      }

      // AI streaming via existing infrastructure
      const messages = buildAiMessages(ctx);
      let accumulated = "";

      const unlisten = await listen<AiStreamEvent>("ai-stream", (event) => {
        const ev = event.payload;
        if (ev.type === "Token" && ev.payload) {
          accumulated += ev.payload;
          set({ content: accumulated });
        } else if (ev.type === "Done") {
          set({ streaming: false, content: accumulated });
        } else if (ev.type === "Error") {
          set({ streaming: false, error: ev.payload ?? "AI stream error" });
        }
      });

      try {
        await invoke("start_ai_stream", { config: aiConfig, messages });
      } finally {
        unlisten();
      }
    } catch (err) {
      set({ streaming: false, error: String(err) });
    }
  },

  cancelBrief: () => {
    void invoke("cancel_ai_stream");
    set({ streaming: false });
  },

  saveBrief: async (curayePath: string, date: string): Promise<string> => {
    const { content } = get();
    return await invoke<string>("save_brief", { curayePath, content, date });
  },

  closeBrief: () => {
    set({ active: false, content: "", context: null, error: null, streaming: false });
  },

  loadLastOpened: async (curayePath: string) => {
    try {
      const date = await invoke<string | null>("get_last_opened", { curayePath });
      if (!date) {
        set({ lastOpenedDate: null, isDormant: false });
        return;
      }
      const diffMs = Date.now() - new Date(date).getTime();
      const days = Math.floor(diffMs / 86_400_000);
      set({ lastOpenedDate: date, isDormant: days > 30 });
    } catch {
      set({ lastOpenedDate: null, isDormant: false });
    }
  },

  recordOpened: async (curayePath: string) => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      await invoke("set_last_opened", { curayePath, date: today });
      set({ lastOpenedDate: today, isDormant: false });
    } catch {
      // best-effort
    }
  },
}));
