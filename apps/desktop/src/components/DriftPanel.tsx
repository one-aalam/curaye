import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogClose,
} from "@/components/ui/dialog";
import { useProjectStore, type DriftFinding } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";

export function DriftPanel() {
  const {
    driftPanelOpen,
    driftPanelProject,
    driftFindings,
    driftLoading,
    closeDriftPanel,
    removeFinding,
  } = useProjectStore();
  const loadDocument = useEditorStore((s) => s.loadDocument);

  if (!driftPanelOpen || !driftPanelProject) return null;

  const projectPath = driftPanelProject.curaye_path.replace(/\/\.curaye$/, "");
  const count = driftFindings.length;

  const subtitleText = driftLoading
    ? "Loading findings…"
    : `${count} finding${count === 1 ? "" : "s"} against adopted shared documents.`;

  const handleMarkReviewed = async (finding: DriftFinding) => {
    try {
      await invoke("mark_reviewed", {
        projectName: driftPanelProject.name,
        projectPath,
        docId: finding.doc_id,
        sharedPath: finding.shared_path,
      });
      removeFinding(finding.doc_id);
    } catch {
      // best-effort
    }
  };

  const handleIgnore = async (finding: DriftFinding) => {
    try {
      await invoke("ignore_drift_finding", {
        projectName: driftPanelProject.name,
        projectPath,
        docId: finding.doc_id,
      });
      removeFinding(finding.doc_id);
    } catch {
      // best-effort
    }
  };

  const handleOverride = async (finding: DriftFinding) => {
    try {
      const path = await invoke<string>("create_override_decision", {
        curayePath: driftPanelProject.curaye_path,
        docId: finding.doc_id,
        docRef: finding.doc_ref,
      });
      removeFinding(finding.doc_id);
      closeDriftPanel();
      await loadDocument(path, "decisions");
    } catch {
      // best-effort
    }
  };

  return (
    <DialogRoot open={driftPanelOpen} onOpenChange={(open) => { if (!open) closeDriftPanel(); }}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader
          title={`Drift — ${driftPanelProject.name}`}
          description={subtitleText}
          onClose={closeDriftPanel}
        />

        <div className="p-5">
          {driftLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {!driftLoading && count === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No drift found. The badge will clear on the next refresh.
              </p>
              <div className="mt-4 flex justify-center">
                <DialogClose
                  className="rounded-md bg-accent px-3 py-1.5 text-xs text-foreground hover:bg-accent/80 transition-colors"
                  onClick={closeDriftPanel}
                >
                  Close
                </DialogClose>
              </div>
            </div>
          )}

          {!driftLoading && count > 0 && (
            <div className="space-y-3">
              {driftFindings.map((finding) => (
                <FindingRow
                  key={finding.doc_id}
                  finding={finding}
                  onMarkReviewed={() => void handleMarkReviewed(finding)}
                  onIgnore={() => void handleIgnore(finding)}
                  onOverride={() => void handleOverride(finding)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

function FindingRow({
  finding,
  onMarkReviewed,
  onIgnore,
  onOverride,
}: {
  finding: DriftFinding;
  onMarkReviewed: () => void;
  onIgnore: () => void;
  onOverride: () => void;
}) {
  const snippet =
    finding.shared_snippet.length > 120
      ? finding.shared_snippet.slice(0, 120) + "…"
      : finding.shared_snippet;

  return (
    <div className="rounded-lg border border-border/40 bg-card/30 p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-medium">{finding.doc_ref}</span>
        <span
          className={cn(
            "flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            finding.classification === "pending-update"
              ? "bg-blue-500/15 text-blue-400"
              : "bg-amber-500/15 text-amber-400",
          )}
        >
          {finding.classification}
        </span>
      </div>

      {snippet && (
        <p className="text-xs leading-relaxed text-muted-foreground/70">
          &ldquo;{snippet}&rdquo;
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onMarkReviewed}
          className="rounded px-2.5 py-1 text-[11px] font-medium bg-accent text-foreground hover:bg-accent/80 transition-colors"
        >
          Mark reviewed
        </button>
        <button
          type="button"
          onClick={onIgnore}
          className="rounded px-2.5 py-1 text-[11px] font-medium bg-accent text-foreground hover:bg-accent/80 transition-colors"
        >
          Ignore until sync
        </button>
        <button
          type="button"
          onClick={onOverride}
          className="rounded px-2.5 py-1 text-[11px] font-medium bg-accent text-foreground hover:bg-accent/80 transition-colors"
        >
          Record override
        </button>
      </div>
    </div>
  );
}
