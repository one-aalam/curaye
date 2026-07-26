import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Archive,
  ChevronDown,
  Clipboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBacklogStore, type BacklogSpec, type SortField } from "@/stores/backlogStore";
import { useViewStore } from "@/stores/viewStore";

async function copyBuildCommand(specId: string) {
  await navigator.clipboard.writeText(`/curaye-build ${specId}`);
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

function isHighImpact(s: BacklogSpec) {
  return s.impact === "high";
}

function isHighDesire(s: BacklogSpec) {
  return s.desire === "high";
}

function isUnscored(s: BacklogSpec) {
  return s.impact === null || s.desire === null;
}

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_CYCLE: Record<string, string> = {
  draft: "ready",
  ready: "building",
  building: "draft",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  ready: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  building: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

function StatusChip({
  status,
  specPath,
}: {
  status: string;
  specPath: string;
}) {
  const updateStatus = useBacklogStore((s) => s.updateStatus);
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = STATUS_CYCLE[status] ?? "draft";
    setLoading(true);
    try {
      await updateStatus(specPath, next);
    } finally {
      setLoading(false);
    }
  };

  const colors = STATUS_COLORS[status] ?? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      disabled={loading}
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium transition-opacity",
        "hover:opacity-80 disabled:opacity-50",
        colors,
      )}
      title="Click to advance status"
    >
      {status}
    </button>
  );
}

// ── Effort badge ──────────────────────────────────────────────────────────────

const EFFORT_COLORS: Record<string, string> = {
  xs: "text-green-400",
  s: "text-green-400",
  m: "text-yellow-400",
  l: "text-orange-400",
  xl: "text-red-400",
};

function EffortBadge({ effort }: { effort: string | null }) {
  if (!effort) return <span className="text-muted-foreground/30">—</span>;
  return (
    <span className={cn("font-mono text-[10px]", EFFORT_COLORS[effort] ?? "text-muted-foreground")}>
      {effort}
    </span>
  );
}

// ── Level badge ───────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  high: "text-emerald-400",
  medium: "text-yellow-400",
  low: "text-zinc-500",
};

function LevelBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground/30">—</span>;
  return (
    <span className={cn("text-[10px]", LEVEL_COLORS[value] ?? "text-muted-foreground")}>
      {value}
    </span>
  );
}

// ── Spec card (for 2×2 quadrants) ─────────────────────────────────────────────

function SpecCard({ spec }: { spec: BacklogSpec }) {
  const shelveSpec = useBacklogStore((s) => s.shelveSpec);
  const openSpec = useBacklogStore((s) => s.openSpec);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  return (
    <div
      className={cn(
        "group relative rounded-md border border-(--glass-border) bg-card/60 px-2.5 py-2",
        "hover:bg-card/90 transition-colors cursor-default",
      )}
    >
      {toast && (
        <div className="absolute -top-6 right-0 z-50 rounded bg-card/90 border border-(--glass-border) px-2 py-0.5 text-[10px] text-foreground backdrop-blur-md whitespace-nowrap shadow">
          {toast}
        </div>
      )}
      <div className="flex items-start gap-1.5 min-w-0">
        <StatusChip status={spec.status} specPath={spec.path} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-foreground leading-tight truncate">
            {spec.title}
          </p>
          <p className="text-[10px] text-muted-foreground/60 truncate">{spec.project_name}</p>
        </div>
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-accent transition-all text-muted-foreground"
          >
            <ChevronDown size={10} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className={cn(
                  "absolute right-0 top-full mt-1 z-50 min-w-44 rounded-md",
                  "border border-(--glass-border) bg-card/90 backdrop-blur-md shadow-lg text-xs py-1",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void openSpec(spec);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground"
                >
                  <ExternalLink size={11} />
                  Open spec
                </button>
                {spec.id && (
                  <>
                    <div className="my-1 border-t border-(--glass-border)" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void copyBuildCommand(spec.id!).then(() => showToast("Copied to clipboard"));
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground"
                    >
                      <Clipboard size={11} />
                      Copy build command
                    </button>
                  </>
                )}
                <div className="my-1 border-t border-(--glass-border)" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void shelveSpec(spec.path);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-destructive"
                >
                  <Archive size={11} />
                  Shelve
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 2×2 Quadrant ─────────────────────────────────────────────────────────────

interface QuadrantProps {
  label: string;
  sublabel: string;
  specs: BacklogSpec[];
  highlight?: boolean;
}

function Quadrant({ label, sublabel, specs, highlight }: QuadrantProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border p-3 gap-2 min-h-[140px]",
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-(--glass-border) bg-card/20",
      )}
    >
      <div className="flex-shrink-0">
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            highlight ? "text-primary" : "text-muted-foreground/60",
          )}
        >
          {label}
        </p>
        <p className="text-[10px] text-muted-foreground/40">{sublabel}</p>
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
        {specs.map((s) => (
          <SpecCard key={s.path} spec={s} />
        ))}
        {specs.length === 0 && (
          <p className="text-[10px] text-muted-foreground/30 py-2">Empty</p>
        )}
      </div>
    </div>
  );
}

// ── 2×2 matrix ───────────────────────────────────────────────────────────────

function Matrix({ specs }: { specs: BacklogSpec[] }) {
  const scored = specs.filter((s) => !isUnscored(s));
  const unscored = specs.filter(isUnscored);

  const buildNext = scored.filter((s) => isHighImpact(s) && isHighDesire(s));
  const strategic = scored.filter((s) => isHighImpact(s) && !isHighDesire(s));
  const bored = scored.filter((s) => !isHighImpact(s) && isHighDesire(s));
  const shelveZone = scored.filter((s) => !isHighImpact(s) && !isHighDesire(s));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 grid grid-cols-2 gap-1 text-[9px] text-muted-foreground/40 px-0.5">
          <div />
          <div className="flex items-center gap-1">
            <span className="flex-1 text-center">low desire</span>
            <span className="flex-1 text-center">high desire</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-[9px] text-muted-foreground/40 text-right pr-1">high impact</div>
          <div className="text-[9px] text-muted-foreground/40 text-right pr-1 mt-auto">
            low impact
          </div>
        </div>

        <div className="col-span-1 grid grid-cols-2 gap-2">
          <Quadrant
            label="Build if strategic"
            sublabel="high impact, low desire"
            specs={strategic}
          />
          <Quadrant
            label="Build next"
            sublabel="high impact, high desire"
            specs={buildNext}
            highlight
          />
          <Quadrant
            label="Shelve or drop"
            sublabel="low impact, low desire"
            specs={shelveZone}
          />
          <Quadrant
            label="Build when bored"
            sublabel="low impact, high desire"
            specs={bored}
          />
        </div>
      </div>

      {unscored.length > 0 && (
        <div className="rounded-lg border border-(--glass-border) bg-card/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
            Unscored ({unscored.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unscored.map((s) => (
              <SpecCard key={s.path} spec={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sortable column header ────────────────────────────────────────────────────

function ColHeader({
  label,
  field,
  current,
  dir,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: "asc" | "desc";
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = field === current;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
        active ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground",
        className,
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp size={9} />
        ) : (
          <ArrowDown size={9} />
        )
      ) : (
        <ArrowUpDown size={9} className="opacity-30" />
      )}
    </button>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListRow({ spec }: { spec: BacklogSpec }) {
  const shelveSpec = useBacklogStore((s) => s.shelveSpec);
  const openSpec = useBacklogStore((s) => s.openSpec);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  return (
    <div className="group relative flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/30 transition-colors text-[11px]">
      {toast && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 z-50 rounded bg-card/90 border border-(--glass-border) px-2 py-0.5 text-[10px] text-foreground backdrop-blur-md whitespace-nowrap shadow">
          {toast}
        </div>
      )}
      <span className="w-24 truncate text-muted-foreground/60 flex-shrink-0">
        {spec.project_name}
      </span>
      <span className="flex-1 min-w-0 font-medium text-foreground truncate">{spec.title}</span>
      <StatusChip status={spec.status} specPath={spec.path} />
      <span className="w-10 flex-shrink-0 text-center">
        <EffortBadge effort={spec.effort} />
      </span>
      <span className="w-14 flex-shrink-0 text-center">
        <LevelBadge value={spec.impact} />
      </span>
      <span className="w-14 flex-shrink-0 text-center">
        <LevelBadge value={spec.desire} />
      </span>
      <span className="w-16 flex-shrink-0 text-muted-foreground/50 truncate text-[10px]">
        {spec.release ?? "—"}
      </span>
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((p) => !p)}
          className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-accent transition-all text-muted-foreground"
        >
          <ChevronDown size={10} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className={cn(
                "absolute right-0 top-full mt-1 z-50 min-w-44 rounded-md",
                "border border-(--glass-border) bg-card/90 backdrop-blur-md shadow-lg text-xs py-1",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void openSpec(spec);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground"
              >
                <ExternalLink size={11} />
                Open spec
              </button>
              {spec.id && (
                <>
                  <div className="my-1 border-t border-(--glass-border)" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void copyBuildCommand(spec.id!).then(() => showToast("Copied to clipboard"));
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-foreground"
                  >
                    <Clipboard size={11} />
                    Copy build command
                  </button>
                </>
              )}
              <div className="my-1 border-t border-(--glass-border)" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void shelveSpec(spec.path);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-destructive"
              >
                <Archive size={11} />
                Shelve
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ListView() {
  const allSpecs = useBacklogStore((s) => s.specs);
  const sortBy = useBacklogStore((s) => s.sortBy);
  const sortDir = useBacklogStore((s) => s.sortDir);
  const setSortBy = useBacklogStore((s) => s.setSortBy);
  const filterProject = useBacklogStore((s) => s.filterProject);
  const filterStatus = useBacklogStore((s) => s.filterStatus);
  const filterEffort = useBacklogStore((s) => s.filterEffort);
  const filterImpact = useBacklogStore((s) => s.filterImpact);
  const filterDesire = useBacklogStore((s) => s.filterDesire);
  const setFilterProject = useBacklogStore((s) => s.setFilterProject);
  const setFilterStatus = useBacklogStore((s) => s.setFilterStatus);
  const setFilterEffort = useBacklogStore((s) => s.setFilterEffort);
  const setFilterImpact = useBacklogStore((s) => s.setFilterImpact);
  const setFilterDesire = useBacklogStore((s) => s.setFilterDesire);
  const clearFilters = useBacklogStore((s) => s.clearFilters);
  const filteredAndSorted = useBacklogStore((s) => s.filteredAndSorted);

  const specs = filteredAndSorted();
  const projects = [...new Set(allSpecs.map((s) => s.project_name))].sort();
  const hasFilters =
    filterProject !== null ||
    filterStatus !== null ||
    filterEffort !== null ||
    filterImpact !== null ||
    filterDesire !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Filter row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-(--glass-border) flex-shrink-0 flex-wrap">
        <select
          value={filterProject ?? ""}
          onChange={(e) => setFilterProject(e.target.value || null)}
          className="rounded border border-(--glass-border) bg-card/50 px-2 py-1 text-[11px] text-foreground outline-none"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={filterStatus ?? ""}
          onChange={(e) => setFilterStatus(e.target.value || null)}
          className="rounded border border-(--glass-border) bg-card/50 px-2 py-1 text-[11px] text-foreground outline-none"
        >
          <option value="">All statuses</option>
          <option value="draft">draft</option>
          <option value="ready">ready</option>
        </select>
        <select
          value={filterEffort ?? ""}
          onChange={(e) => setFilterEffort(e.target.value || null)}
          className="rounded border border-(--glass-border) bg-card/50 px-2 py-1 text-[11px] text-foreground outline-none"
        >
          <option value="">All efforts</option>
          {["xs", "s", "m", "l", "xl"].map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select
          value={filterImpact ?? ""}
          onChange={(e) => setFilterImpact(e.target.value || null)}
          className="rounded border border-(--glass-border) bg-card/50 px-2 py-1 text-[11px] text-foreground outline-none"
        >
          <option value="">All impacts</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
        <select
          value={filterDesire ?? ""}
          onChange={(e) => setFilterDesire(e.target.value || null)}
          className="rounded border border-(--glass-border) bg-card/50 px-2 py-1 text-[11px] text-foreground outline-none"
        >
          <option value="">All desires</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/40">
          {specs.length} spec{specs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-(--glass-border) flex-shrink-0">
        <ColHeader
          label="Project"
          field="project"
          current={sortBy}
          dir={sortDir}
          onSort={setSortBy}
          className="w-24 flex-shrink-0"
        />
        <ColHeader
          label="Title"
          field="title"
          current={sortBy}
          dir={sortDir}
          onSort={setSortBy}
          className="flex-1"
        />
        <ColHeader
          label="Status"
          field="status"
          current={sortBy}
          dir={sortDir}
          onSort={setSortBy}
          className="w-16 flex-shrink-0"
        />
        <ColHeader
          label="Effort"
          field="effort"
          current={sortBy}
          dir={sortDir}
          onSort={setSortBy}
          className="w-10 flex-shrink-0 justify-center"
        />
        <ColHeader
          label="Impact"
          field="impact"
          current={sortBy}
          dir={sortDir}
          onSort={setSortBy}
          className="w-14 flex-shrink-0 justify-center"
        />
        <ColHeader
          label="Desire"
          field="desire"
          current={sortBy}
          dir={sortDir}
          onSort={setSortBy}
          className="w-14 flex-shrink-0 justify-center"
        />
        <ColHeader
          label="Release"
          field="release"
          current={sortBy}
          dir={sortDir}
          onSort={setSortBy}
          className="w-16 flex-shrink-0"
        />
        <div className="w-6 flex-shrink-0" />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto py-1">
        {specs.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground/40">No specs match the current filters.</p>
        )}
        {specs.map((spec) => (
          <ListRow key={spec.path} spec={spec} />
        ))}
      </div>
    </div>
  );
}

// ── Root BacklogView ──────────────────────────────────────────────────────────

export function BacklogView() {
  const setView = useViewStore((s) => s.setView);
  const loadBacklog = useBacklogStore((s) => s.loadBacklog);
  const loading = useBacklogStore((s) => s.loading);
  const specs = useBacklogStore((s) => s.specs);

  useEffect(() => {
    void loadBacklog();
  }, [loadBacklog]);

  const allScored = specs.filter((s) => !isUnscored(s));
  const allUnscored = specs.filter(isUnscored);

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
        <span className="text-xs font-semibold text-foreground/80">Backlog</span>
        {!loading && (
          <span className="text-[10px] text-muted-foreground/40">
            {specs.length} planned spec{specs.length !== 1 ? "s" : ""} across{" "}
            {new Set(specs.map((s) => s.project_name)).size} project
            {new Set(specs.map((s) => s.project_name)).size !== 1 ? "s" : ""}
          </span>
        )}
        <button
          type="button"
          onClick={() => void loadBacklog()}
          className="ml-auto text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground/40">
          Loading backlog…
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 gap-0">
          {/* Left: 2×2 matrix */}
          <div
            className="w-[480px] flex-shrink-0 overflow-y-auto p-4 border-r"
            style={{ borderColor: "var(--glass-border)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-3">
              Impact × Desire
            </p>
            <Matrix specs={[...allScored, ...allUnscored]} />
          </div>

          {/* Right: list view */}
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            <ListView />
          </div>
        </div>
      )}
    </div>
  );
}
