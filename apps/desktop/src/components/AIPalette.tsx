import { useEffect, useRef, useCallback, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editorStore";
import {
  usePaletteStore,
  type DiffLine,
} from "@/stores/paletteStore";
import { MarkdownContent } from "@/components/ui/markdown";

// ── Suggestions ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Draft a spec",
  "Re-entry brief for current project",
  "Update current/ from shipped spec",
  "Detect drift in this project",
  "Find where I solved this before",
  "Generate acceptance criteria",
];

// ── Input phase ───────────────────────────────────────────────────────────────

function InputPhase() {
  const { query, setQuery, execute, closePalette } = usePaletteStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll active item into view when navigating by keyboard
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Reset highlight when query is typed manually (not via suggestion click)
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, SUGGESTIONS.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        const s = SUGGESTIONS[activeIndex];
        if (s) { setQuery(s); void execute(); }
      } else if (query.trim()) {
        void execute();
      }
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-(--glass-border)">
        <Search size={14} className="text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to do?"
          className={cn(
            "flex-1 bg-transparent text-sm outline-none",
            "placeholder:text-muted-foreground/50",
          )}
        />
        <button
          type="button"
          onClick={closePalette}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-3">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
          Suggestions
        </p>
        <div ref={listRef} className="space-y-0.5">
          {SUGGESTIONS.map((s, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={s}
                type="button"
                onClick={() => { setQuery(s); void execute(); }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-sm text-left transition-colors",
                  isActive
                    ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                    : "text-foreground/70 hover:bg-primary/6 hover:text-foreground",
                )}
              >
                <Sparkles
                  size={12}
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="flex-1">{s}</span>
                {isActive && (
                  <kbd className="text-[10px] text-primary/60 font-mono">↵</kbd>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Streaming phase ───────────────────────────────────────────────────────────

function StreamingPhase() {
  const { resolvedAction, streamedText, error, saveOutput, cancelStream, closePalette, _abortController } =
    usePaletteStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isStreaming = _abortController !== null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamedText]);

  const actionLabel =
    resolvedAction?.type === "draft-spec"
      ? `Drafting: "${resolvedAction.param ?? "spec"}"`
      : resolvedAction?.type === "reentry-brief"
        ? "Re-entry brief"
        : resolvedAction?.type === "update-current"
          ? "Updating current/"
          : resolvedAction?.type === "drift-detection"
            ? "Detecting drift"
            : resolvedAction?.type === "generate-ac"
              ? "Generating acceptance criteria"
              : "Processing";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-(--glass-border) flex-shrink-0">
        {isStreaming && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        )}
        <span className="text-xs font-medium text-foreground/80 truncate">{actionLabel}</span>
      </div>

      <div
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-y-auto p-4 min-h-0"
      >
        {streamedText && (
          <MarkdownContent>{streamedText}</MarkdownContent>
        )}
        {isStreaming && (
          <span className="inline-block w-0.5 h-3.5 bg-primary align-middle ml-px animate-blink" />
        )}
      </div>

      {error && (
        <p className="px-4 pb-2 text-xs text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-(--glass-border) flex-shrink-0">
        <button
          type="button"
          onClick={isStreaming ? cancelStream : closePalette}
          className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {isStreaming ? "Cancel" : "Discard"}
        </button>
        {!isStreaming && resolvedAction?.type === "draft-spec" && (
          <button
            type="button"
            onClick={() => void saveOutput()}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save to planned/
          </button>
        )}
        {!isStreaming && resolvedAction?.type !== "draft-spec" && (
          <button
            type="button"
            onClick={closePalette}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

// ── Diff view ─────────────────────────────────────────────────────────────────

function DiffColumn({
  lines,
  label,
}: {
  lines: DiffLine[];
  label: string;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-(--glass-border) flex-shrink-0">
        {label}
      </div>
      <div className="overflow-y-auto flex-1 p-2 font-mono text-[11px] leading-5">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "px-1 rounded-sm whitespace-pre-wrap break-words",
              line.kind === "added" && "bg-green-500/10 text-green-400",
              line.kind === "removed" && "bg-red-500/10 text-red-400 line-through opacity-60",
              line.kind === "same" && "text-foreground/70",
            )}
          >
            {line.kind === "added" && <span className="opacity-60 mr-1">+</span>}
            {line.kind === "removed" && <span className="opacity-60 mr-1">-</span>}
            {line.kind === "same" && <span className="opacity-0 mr-1">·</span>}
            {line.text || " "}
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffPhase() {
  const { diffBefore, diffAfter, applyDiff, closePalette, proposedText, targetPath } =
    usePaletteStore();
  const { loadDocument } = useEditorStore();

  const handleEditFirst = async () => {
    if (!proposedText || !targetPath) return;
    await invoke("write_document", { path: targetPath, content: proposedText });
    void loadDocument(targetPath, "spec");
    closePalette();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-(--glass-border) flex-shrink-0">
        <span className="text-xs font-medium text-foreground/80">Review proposed changes</span>
      </div>

      <div className="flex flex-1 min-h-0 divide-x divide-(--glass-border)">
        <DiffColumn lines={diffBefore} label="Before" />
        <DiffColumn lines={diffAfter} label="After (proposed)" />
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-(--glass-border) flex-shrink-0">
        <button
          type="button"
          onClick={closePalette}
          className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={() => void handleEditFirst()}
          className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors text-sm"
        >
          Edit first
        </button>
        <button
          type="button"
          onClick={() => void applyDiff()}
          className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// ── AI unavailable ────────────────────────────────────────────────────────────

function AiUnavailableView() {
  const { closePalette } = usePaletteStore();

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
      <Sparkles size={24} className="text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">AI is not configured.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Set up a provider in Settings → AI to use these features.
        </p>
      </div>
      <button
        type="button"
        onClick={closePalette}
        className="mt-2 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors"
      >
        Close
      </button>
    </div>
  );
}

// ── Root palette ──────────────────────────────────────────────────────────────

export function AIPalette() {
  const { open, phase, aiConfig, aiConfigChecked, closePalette, cancelStream } =
    usePaletteStore();

  const handleBackdropClick = useCallback(() => {
    if (phase === "streaming" && usePaletteStore.getState()._abortController) {
      cancelStream();
    } else {
      closePalette();
    }
  }, [phase, closePalette, cancelStream]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (phase === "streaming" && usePaletteStore.getState()._abortController) {
          cancelStream();
        } else {
          closePalette();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open, phase, closePalette, cancelStream]);

  if (!open) return null;

  const showUnavailable = aiConfigChecked && aiConfig === null;

  const panelHeight =
    phase === "diff" ? "h-[60vh]" : phase === "streaming" ? "h-[70vh]" : "h-auto";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <div
        className={cn(
          "relative w-[600px] rounded-xl overflow-hidden flex flex-col",
          "border border-(--glass-border) shadow-(--glass-shadow)",
          "bg-card",
          panelHeight,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {showUnavailable ? (
          <AiUnavailableView />
        ) : phase === "input" ? (
          <InputPhase />
        ) : phase === "streaming" ? (
          <StreamingPhase />
        ) : (
          <DiffPhase />
        )}
      </div>
    </div>
  );
}
