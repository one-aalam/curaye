import { useEffect, useState } from "react";
import { ArrowLeft, Ship, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReleaseStore, type ReleaseSpec } from "@/stores/releaseStore";
import { useViewStore } from "@/stores/viewStore";
import { useProjectStore } from "@/stores/projectStore";

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: Array<{ status: string; label: string; color: string }> = [
  { status: "draft", label: "Draft", color: "text-zinc-400" },
  { status: "ready", label: "Ready", color: "text-blue-400" },
  { status: "building", label: "Building", color: "text-amber-400" },
  { status: "done", label: "Done", color: "text-green-400" },
];

const EFFORT_COLORS: Record<string, string> = {
  xs: "text-green-400",
  s: "text-green-400",
  m: "text-yellow-400",
  l: "text-orange-400",
  xl: "text-red-400",
};

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-32 rounded-full bg-card/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground/50">
        {done}/{total} done
      </span>
    </div>
  );
}

// ── Kanban card ───────────────────────────────────────────────────────────────

function KanbanCard({
  spec,
  onDragStart,
}: {
  spec: ReleaseSpec;
  onDragStart: (e: React.DragEvent, spec: ReleaseSpec) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, spec)}
      className={cn(
        "rounded-md border border-(--glass-border) bg-card/60 px-2.5 py-2 cursor-grab active:cursor-grabbing",
        "hover:bg-card/90 transition-colors",
      )}
    >
      <p className="text-[11px] font-medium text-foreground leading-snug">
        {spec.title}
      </p>
      {spec.effort && (
        <span
          className={cn(
            "font-mono text-[10px] mt-0.5 inline-block",
            EFFORT_COLORS[spec.effort] ?? "text-muted-foreground",
          )}
        >
          {spec.effort}
        </span>
      )}
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  color,
  specs,
  onDrop,
  onDragOver,
}: {
  status: string;
  label: string;
  color: string;
  specs: ReleaseSpec[];
  onDrop: (e: React.DragEvent, targetStatus: string) => void;
  onDragOver: (e: React.DragEvent) => void;
}) {
  const updateSpecStatus = useReleaseStore((s) => s.updateSpecStatus);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    setDragging(false);
    onDrop(e, status);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
    onDragOver(e);
  };

  const handleDragLeave = () => setDragging(false);

  void updateSpecStatus;

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "flex flex-col rounded-lg border min-h-[200px] p-3 gap-2 flex-1",
        dragging
          ? "border-primary/40 bg-primary/5"
          : "border-(--glass-border) bg-card/20",
        "transition-colors",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={cn("text-[10px] font-semibold uppercase tracking-wider", color)}>
          {label}
        </span>
        <span className="text-[10px] text-muted-foreground/40">{specs.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        {specs.map((spec) => (
          <KanbanCard
            key={spec.path}
            spec={spec}
            onDragStart={(e, s) => {
              e.dataTransfer.setData("text/plain", s.path);
              e.dataTransfer.effectAllowed = "move";
            }}
          />
        ))}
        {specs.length === 0 && (
          <p className="text-[10px] text-muted-foreground/30 py-2 text-center">Empty</p>
        )}
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

const RELEASE_STATUS_COLORS: Record<string, string> = {
  planning: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  active: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shipped: "bg-green-500/20 text-green-400 border-green-500/30",
};

// ── Root ReleaseView ──────────────────────────────────────────────────────────

export function ReleaseView() {
  const setView = useViewStore((s) => s.setView);
  const currentReleaseId = useViewStore((s) => s.currentReleaseId);
  const { detail, loading, loadRelease, updateSpecStatus, shipRelease } = useReleaseStore();
  const { projects, selectedProjectId } = useProjectStore();
  const [shipping, setShipping] = useState(false);

  const project = projects.find((p) => p.name === selectedProjectId);

  useEffect(() => {
    if (project && currentReleaseId) {
      void loadRelease(project.curaye_path, currentReleaseId);
    }
  }, [project, currentReleaseId, loadRelease]);

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const specPath = e.dataTransfer.getData("text/plain");
    if (!specPath || !detail) return;
    const spec = detail.specs.find((s) => s.path === specPath);
    if (!spec || spec.status === targetStatus) return;
    await updateSpecStatus(specPath, targetStatus);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleShipRelease = async () => {
    if (!project || !detail) return;
    const doneCount = detail.specs.filter((s) => s.status === "done").length;
    if (doneCount === 0) return;
    setShipping(true);
    try {
      await shipRelease(project.curaye_path, detail.id);
    } finally {
      setShipping(false);
    }
  };

  const specsByStatus = Object.fromEntries(
    COLUMNS.map(({ status }) => [
      status,
      (detail?.specs ?? []).filter((s) => s.status === status),
    ]),
  );

  const doneCount = detail?.specs.filter((s) => s.status === "done").length ?? 0;
  const isShipped = detail?.status === "shipped";

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--background)" }}>
      {/* Titlebar spacer */}
      <div
        className="drag-region flex-shrink-0"
        style={{ height: "env(titlebar-area-height, 38px)" }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 border-b flex-shrink-0"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <button
          type="button"
          onClick={() => setView("main")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={13} />
          Back
        </button>

        {detail && (
          <>
            <span className="text-xs font-semibold text-foreground/80">{detail.title}</span>
            <span
              className={cn(
                "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
                RELEASE_STATUS_COLORS[detail.status] ?? RELEASE_STATUS_COLORS["planning"],
              )}
            >
              {detail.status}
            </span>
            {detail.target && (
              <span className="text-[10px] text-muted-foreground/50">
                target: {detail.target}
              </span>
            )}
            <ProgressBar done={detail.done} total={detail.total} />
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (project && currentReleaseId) {
                void loadRelease(project.curaye_path, currentReleaseId);
              }
            }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <RefreshCw size={10} />
            Refresh
          </button>

          {!isShipped && doneCount > 0 && (
            <button
              type="button"
              onClick={() => void handleShipRelease()}
              disabled={shipping}
              className={cn(
                "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
                "bg-green-500/20 text-green-400 border border-green-500/30",
                "hover:bg-green-500/30 disabled:opacity-50",
              )}
            >
              <Ship size={12} />
              {shipping ? "Shipping…" : `Ship release (${doneCount} done)`}
            </button>
          )}

          {isShipped && (
            <span className="text-[10px] text-green-400/60 font-medium">Release shipped</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground/40">
          Loading release…
        </div>
      ) : !detail ? (
        <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground/40">
          Release not found.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {detail.specs.length === 0 && (
            <p className="text-xs text-muted-foreground/40 text-center py-8">
              No specs assigned to this release.
              <br />
              Run <code className="font-mono">curaye release assign &lt;spec-id&gt; {detail.id}</code> to add specs.
            </p>
          )}
          {detail.specs.length > 0 && (
            <div className="flex gap-3 h-full">
              {COLUMNS.map(({ status, label, color }) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  label={label}
                  color={color}
                  specs={specsByStatus[status] ?? []}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
