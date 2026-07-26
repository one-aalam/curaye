import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowUpFromLine, Check, Sparkles, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogClose,
} from "@/components/ui/dialog";

const SHARED_CATEGORIES = ["decisions", "patterns", "design", "agents", "stack"] as const;
type SharedCategory = (typeof SHARED_CATEGORIES)[number];

const CATEGORY_DESCRIPTIONS: Record<SharedCategory, string> = {
  decisions: "Architecture and design decisions",
  patterns: "Reusable implementation patterns",
  design: "Design systems and component patterns",
  agents: "Agent steering and workflow patterns",
  stack: "Technology stack conventions",
};

interface PromoteSharedResult {
  sharedPath: string;
  docRef: string;
  isUpdate: boolean;
  projectsNotified: number;
}

interface PromoteModalProps {
  filePath: string;
  section: string;
  projectName: string;
  onClose: () => void;
}

function sectionToDefaultCategory(section: string): SharedCategory {
  if ((SHARED_CATEGORIES as readonly string[]).includes(section)) {
    return section as SharedCategory;
  }
  return "patterns";
}

function validateDocId(id: string): string | null {
  if (!id.trim()) return "Document id is required";
  if (/[/\\:*?"<>|]/.test(id)) return "Cannot contain / \\ : * ? \" < > |";
  if (id === "." || id === "..") return "Cannot be . or ..";
  return null;
}

export function PromoteModal({ filePath, section, projectName, onClose }: PromoteModalProps) {
  const fileName = filePath.split("/").pop() ?? "";
  const defaultId = fileName.replace(/\.md$/, "");

  const [category, setCategory] = useState<SharedCategory>(() => sectionToDefaultCategory(section));
  const [docId, setDocId] = useState(defaultId);
  const [docIdError, setDocIdError] = useState<string | null>(null);
  const [updateSource, setUpdateSource] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PromoteSharedResult | null>(null);

  // Pre-flight checks
  const [docExists, setDocExists] = useState(false);
  const [promotedToRef, setPromotedToRef] = useState<string | null>(null);

  // AI generalization
  const [aiAvailable, setAiAvailable] = useState(false);
  const [generalizing, setGeneralizing] = useState(false);
  const [generalizeError, setGeneralizeError] = useState<string | null>(null);
  const [generalizedContent, setGeneralizedContent] = useState<string | null>(null);

  useEffect(() => {
    void invoke<string | null>("get_promoted_to_ref", { path: filePath }).then(setPromotedToRef).catch(() => {});
    void invoke<unknown>("get_ai_config").then((cfg) => setAiAvailable(cfg !== null)).catch(() => {});
  }, [filePath]);

  useEffect(() => {
    if (!docId.trim()) return;
    void invoke<boolean>("shared_doc_exists", { category, docId })
      .then(setDocExists)
      .catch(() => setDocExists(false));
  }, [category, docId]);

  const handleDocIdChange = (value: string) => {
    setDocId(value);
    setDocIdError(validateDocId(value));
  };

  const handleGeneralize = async () => {
    setGeneralizeError(null);
    setGeneralizing(true);
    try {
      const generalized = await invoke<string>("generalize_document", { sourcePath: filePath });
      setGeneralizedContent(generalized);
    } catch (e) {
      setGeneralizeError(String(e));
    } finally {
      setGeneralizing(false);
    }
  };

  const handlePromote = async () => {
    const idErr = validateDocId(docId);
    if (idErr) { setDocIdError(idErr); return; }
    setError(null);
    setPromoting(true);
    try {
      const res = await invoke<PromoteSharedResult>("promote_to_shared", {
        sourcePath: filePath,
        category,
        docId,
        projectId: projectName,
        updateSource,
        // Use the edited textarea content (not the raw AI output) when a generalized version exists
        contentOverride: generalizedContent ?? null,
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setPromoting(false);
    }
  };

  return (
    <DialogRoot open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader
          title="Promote to shared layer"
          description={`${fileName} → ~/.curaye/shared/`}
          onClose={onClose}
        />

        {result ? (
          <div className="p-5">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20">
                <Check size={11} className="text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {result.isUpdate ? "Updated" : "Promoted"}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground break-all">
                  {result.docRef}
                </p>
                {result.projectsNotified > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {result.projectsNotified} other project{result.projectsNotified !== 1 ? "s" : ""} notified.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <DialogClose className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                Done
              </DialogClose>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Re-promote indicator */}
            {promotedToRef && (
              <p className="rounded-md border border-blue-500/20 bg-blue-500/8 px-3 py-2 text-xs text-blue-400">
                Previously promoted to{" "}
                <span className="font-mono">{promotedToRef}</span> — this will re-sync it.
              </p>
            )}

            {/* Category picker */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Target category</p>
              <div
                role="radiogroup"
                aria-label="Target category"
                className="grid grid-cols-1 gap-1"
                onKeyDown={(e) => {
                  const idx = SHARED_CATEGORIES.indexOf(category);
                  if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                    e.preventDefault();
                    setCategory(SHARED_CATEGORIES[(idx + 1) % SHARED_CATEGORIES.length]!);
                  } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    setCategory(SHARED_CATEGORIES[(idx - 1 + SHARED_CATEGORIES.length) % SHARED_CATEGORIES.length]!);
                  }
                }}
              >
                {SHARED_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="radio"
                    aria-checked={category === cat}
                    tabIndex={category === cat ? 0 : -1}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
                      category === cat
                        ? "border-primary/40 bg-primary/8 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      category === cat ? "bg-primary" : "bg-muted-foreground/40",
                    )} />
                    <span className="font-mono font-medium">{cat}/</span>
                    <span className="text-[10px] opacity-60">{CATEGORY_DESCRIPTIONS[cat]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Shared document id */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Shared document id
              </label>
              <input
                type="text"
                value={docId}
                onChange={(e) => handleDocIdChange(e.target.value)}
                className={cn(
                  "w-full rounded-md border bg-card/50 px-3 py-1.5",
                  "font-mono text-xs text-foreground placeholder:text-muted-foreground/40",
                  "focus:outline-none focus:ring-1 transition-colors",
                  docIdError
                    ? "border-destructive/50 focus:border-destructive/60 focus:ring-destructive/20"
                    : "border-border/50 focus:border-primary/40 focus:ring-primary/20",
                )}
                placeholder={defaultId}
              />
              {docIdError && (
                <p className="mt-1 text-[10px] text-destructive">{docIdError}</p>
              )}
            </div>

            {/* Metadata preview */}
            <div className="rounded-md border border-border/30 bg-muted/20 p-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Frontmatter preview
              </p>
              <pre className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                {`source_project: ${projectName}\npromoted: ${new Date().toISOString().slice(0, 10)}`}
              </pre>
              <p className="mt-1.5 text-[10px] text-muted-foreground/50">
                adopted_by will {docExists ? "merge with existing adopters" : `be set to [${projectName}]`}
              </p>
            </div>

            {docExists && (
              <p className="rounded-md border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-500">
                shared/{category}/{docId} already exists — promoting will update it in place.
              </p>
            )}

            {/* AI generalization */}
            {aiAvailable && (
              <div className="space-y-2">
                {generalizedContent !== null ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={10} className="text-green-400 flex-shrink-0" />
                        <span className="text-xs text-green-400">Generalized version (editable)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setGeneralizedContent(null); setGeneralizeError(null); }}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <RotateCcw size={9} />
                        Reset
                      </button>
                    </div>
                    <textarea
                      value={generalizedContent}
                      onChange={(e) => setGeneralizedContent(e.target.value)}
                      rows={6}
                      className={cn(
                        "w-full rounded-md border border-border/50 bg-card/50 px-3 py-2",
                        "font-mono text-[10px] text-foreground leading-relaxed resize-y",
                        "focus:outline-none focus:ring-1 focus:border-primary/40 focus:ring-primary/20",
                        "overflow-y-auto",
                      )}
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleGeneralize()}
                    disabled={generalizing}
                    className={cn(
                      "flex w-full items-center justify-center gap-1.5 rounded-md border border-border/40 px-3 py-2",
                      "text-xs text-muted-foreground hover:border-border hover:text-foreground transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    <Sparkles size={10} className={generalizing ? "animate-pulse" : ""} />
                    {generalizing ? "Generalizing…" : "Generalize with AI"}
                  </button>
                )}
                {generalizeError && (
                  <p className="rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                    {generalizeError}
                  </p>
                )}
              </div>
            )}

            {/* Update source checkbox */}
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={updateSource}
                onChange={(e) => setUpdateSource(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              <span className="text-xs text-muted-foreground">
                Add <span className="font-mono">promoted_to</span> reference to{" "}
                <span className="font-mono">{fileName}</span>
              </span>
            </label>

            {error && (
              <p className="rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <DialogClose
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                onClick={onClose}
              >
                Cancel
              </DialogClose>
              <button
                type="button"
                onClick={() => void handlePromote()}
                disabled={promoting || !!docIdError || !docId.trim()}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                <ArrowUpFromLine size={11} />
                {promoting ? "Promoting…" : "Promote"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
