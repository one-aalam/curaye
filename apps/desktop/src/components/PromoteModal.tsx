import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowUpFromLine, Check } from "lucide-react";
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

export function PromoteModal({ filePath, section, projectName, onClose }: PromoteModalProps) {
  const fileName = filePath.split("/").pop() ?? "";
  const defaultId = fileName.replace(/\.md$/, "");

  const [category, setCategory] = useState<SharedCategory>(() => sectionToDefaultCategory(section));
  const [docId, setDocId] = useState(defaultId);
  const [updateSource, setUpdateSource] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PromoteSharedResult | null>(null);
  const [docExists, setDocExists] = useState(false);

  useEffect(() => {
    if (!docId.trim()) return;
    void invoke<boolean>("shared_doc_exists", { category, docId })
      .then(setDocExists)
      .catch(() => setDocExists(false));
  }, [category, docId]);

  const handlePromote = async () => {
    setError(null);
    setPromoting(true);
    try {
      const res = await invoke<PromoteSharedResult>("promote_to_shared", {
        sourcePath: filePath,
        category,
        docId,
        projectId: projectName,
        updateSource,
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
              <DialogClose
                className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                Done
              </DialogClose>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Category picker */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Target category</p>
              <div className="grid grid-cols-1 gap-1">
                {SHARED_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                      category === cat
                        ? "border-primary/40 bg-primary/8 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full flex-shrink-0",
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
                onChange={(e) => setDocId(e.target.value)}
                className={cn(
                  "w-full rounded-md border border-border/50 bg-card/50 px-3 py-1.5",
                  "font-mono text-xs text-foreground placeholder:text-muted-foreground/40",
                  "focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20",
                )}
                placeholder={defaultId}
              />
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

            {/* Update source checkbox */}
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={updateSource}
                onChange={(e) => setUpdateSource(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-primary"
              />
              <span className="text-xs text-muted-foreground">
                Add <span className="font-mono">promoted_to</span> reference to source document
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
                disabled={promoting || !docId.trim()}
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
