import { useState } from "react";
import { ChevronRight, ChevronDown, Plus, AlertCircle, Package, FileText, Sparkles, ArrowUpFromLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTreeStore, type TreeNode, type DocSection, type ReleaseSummary } from "@/stores/treeStore";
import { useEditorStore } from "@/stores/editorStore";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";
import { useViewStore } from "@/stores/viewStore";
import { useBriefStore } from "@/stores/briefStore";
import { PromoteModal } from "@/components/PromoteModal";
import { MenuRoot, MenuContent, MenuItem } from "@/components/ui/menu";
import { SearchBar } from "@/components/SearchBar";

const STATUS_LABEL: Record<string, string> = {
  draft: "draft",
  ready: "ready",
  building: "wip",
  done: "done",
  shelved: "shelved",
};

const STATUS_BG: Record<string, string> = {
  draft: "bg-zinc-400/10 text-zinc-400",
  ready: "bg-blue-400/10 text-blue-400",
  building: "bg-amber-400/10 text-amber-400",
  done: "bg-green-500/10 text-green-500",
  shelved: "bg-zinc-600/10 text-zinc-500",
};

const SECTION_LABELS: Record<DocSection, string> = {
  planned: "planned/",
  current: "current/",
  shipped: "shipped/",
  decisions: "decisions/",
  root: "Root docs",
};

const DOC_TYPES: Record<DocSection, string> = {
  planned: "spec",
  current: "current",
  shipped: "spec",
  decisions: "decision",
  root: "generic",
};

function StatusLabel({ status, selected }: { status?: string; selected: boolean }) {
  if (!status) return null;
  const label = STATUS_LABEL[status] ?? status;
  const colors = selected
    ? "bg-primary/15 text-primary/80"
    : (STATUS_BG[status] ?? "bg-zinc-400/10 text-zinc-400");
  return (
    <span className={cn("text-[9px] font-semibold uppercase tracking-wide flex-shrink-0 px-1.5 py-0.5 rounded", colors)}>
      {label}
    </span>
  );
}

type FilenamePrefix =
  | { kind: "ordinal"; label: string }
  | { kind: "date"; label: string };

function parseFilenamePrefix(name: string): FilenamePrefix | null {
  const stem = name.replace(/\.md$/, "").replace(/^_/, "");
  const dateMatch = stem.match(/^(\d{4})-(\d{2})-(\d{2})[-_]/);
  if (dateMatch) {
    const d = new Date(
      parseInt(dateMatch[1]!),
      parseInt(dateMatch[2]!) - 1,
      parseInt(dateMatch[3]!),
    );
    return { kind: "date", label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
  }
  const ordinalMatch = stem.match(/^(\d{1,3})-/);
  if (ordinalMatch) {
    return { kind: "ordinal", label: String(parseInt(ordinalMatch[1]!)) };
  }
  return null;
}

function TreeItem({ node, section }: { node: TreeNode; section: DocSection }) {
  const selectedPath = useTreeStore((s) => s.selectedPath);
  const selectDocument = useTreeStore((s) => s.selectDocument);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const selected = selectedPath === node.path;

  const [menuAnchor, setMenuAnchor] = useState<{ getBoundingClientRect: () => DOMRect } | null>(null);
  const [showPromote, setShowPromote] = useState(false);

  const canPromote = section === "current" || section === "decisions";

  const stem = node.name.replace(/\.md$/, "").replace(/^_/, "");
  const prefix = parseFilenamePrefix(node.name);
  const displayName = node.title ?? (
    prefix
      ? stem.replace(/^[\d]{1,3}-/, "").replace(/^\d{4}-\d{2}-\d{2}[-_]/, "")
      : stem
  );

  const handleClick = () => {
    selectDocument(node.path);
    void loadDocument(node.path, DOC_TYPES[section] ?? "generic");
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canPromote) return;
    e.preventDefault();
    const { clientX, clientY } = e;
    setMenuAnchor({
      getBoundingClientRect: () =>
        DOMRect.fromRect({ x: clientX, y: clientY, width: 0, height: 0 }),
    });
  };

  return (
    <>
      <MenuRoot
        open={menuAnchor !== null}
        onOpenChange={(open) => { if (!open) setMenuAnchor(null); }}
      >
        <MenuContent anchor={menuAnchor ?? null} side="bottom" align="start">
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setShowPromote(true);
            }}
          >
            <ArrowUpFromLine size={11} />
            Promote to shared layer
          </MenuItem>
        </MenuContent>
      </MenuRoot>

      <button
        type="button"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={cn(
          "group flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-all",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "active:scale-[0.99]",
          selected
            ? "bg-primary/[0.14] text-primary font-medium border-l-2 border-primary pl-[6px] rounded-r-md"
            : "rounded-md text-foreground/70 hover:bg-primary/[0.07] hover:text-foreground active:bg-primary/[0.12]",
          node.isDraft && "opacity-60",
        )}
      >
        {node.hasValidationError && (
          <AlertCircle size={10} className="text-destructive flex-shrink-0" />
        )}
        {prefix !== null && (
          <span className={cn(
            "flex-shrink-0 font-mono text-[9px] font-semibold tabular-nums leading-none px-1 py-0.5 rounded",
            prefix.kind === "ordinal"
              ? "bg-primary/10 text-primary/60"
              : "bg-blue-400/10 text-blue-400/70",
          )}>
            {prefix.label}
          </span>
        )}
        <span className={cn(
          "flex-1 truncate text-[11px]",
          node.isDraft && "italic",
        )}>
          {displayName}
        </span>
        {section === "planned" && node.status !== undefined && (
          <StatusLabel status={node.status} selected={selected} />
        )}
      </button>

      {showPromote && selectedProjectId && (
        <PromoteModal
          filePath={node.path}
          section={section}
          projectName={selectedProjectId}
          onClose={() => setShowPromote(false)}
        />
      )}
    </>
  );
}

function SectionHeader({
  section,
  nodes,
  expanded,
  onToggle,
}: {
  section: DocSection;
  nodes: TreeNode[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const { projects } = useProjectStore();
  const loadTree = useTreeStore((s) => s.loadTree);

  const project = projects.find((p) => p.name === selectedProjectId);

  const handleNew = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project) return;
    try {
      const newPath = await invoke<string>("create_document", {
        curayePath: project.curaye_path,
        section,
      });
      await loadTree(project.curaye_path);
      useTreeStore.getState().selectDocument(newPath);
      await useEditorStore.getState().loadDocument(newPath, DOC_TYPES[section] ?? "generic");
      // focus title field after load
      setTimeout(() => {
        const titleEl = document.querySelector<HTMLElement>('[data-field="title"]');
        titleEl?.focus();
      }, 100);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center group">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex flex-1 items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-sm",
          "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors",
        )}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {SECTION_LABELS[section]}
        {nodes.length > 0 && (
          <span className="ml-auto text-[9px] opacity-50">{nodes.length}</span>
        )}
      </button>
      <button
        type="button"
        onClick={(e) => void handleNew(e)}
        className="mr-1 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-foreground/[0.06] text-muted-foreground"
        title={`New ${section} document`}
      >
        <Plus size={10} />
      </button>
    </div>
  );
}

// ── Release progress bar ──────────────────────────────────────────────────────

function ReleaseProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <div className="h-1 flex-1 rounded-full bg-card/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500/70 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground/40 flex-shrink-0">
        {done}/{total}
      </span>
    </div>
  );
}

// ── Release item ──────────────────────────────────────────────────────────────

const RELEASE_STATUS_DOTS: Record<string, string> = {
  planning: "bg-zinc-400",
  active: "bg-blue-400",
  shipped: "bg-green-500",
};

function ReleaseItem({ release }: { release: ReleaseSummary }) {
  const openRelease = useViewStore((s) => s.openRelease);
  const currentReleaseId = useViewStore((s) => s.currentReleaseId);
  const view = useViewStore((s) => s.view);
  const isActive = view === "releases" && currentReleaseId === release.id;
  const dot = RELEASE_STATUS_DOTS[release.status] ?? "bg-zinc-400";

  return (
    <button
      type="button"
      onClick={() => openRelease(release.id)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground",
        release.status === "shipped" && !isActive && "opacity-50",
      )}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full flex-shrink-0", dot)} />
      <span className="truncate flex-shrink-0 max-w-[80px]">{release.title}</span>
      {release.total > 0 && (
        <ReleaseProgressBar done={release.done} total={release.total} />
      )}
    </button>
  );
}

// ── Releases section ──────────────────────────────────────────────────────────

function ReleasesSection({ releases }: { releases: ReleaseSummary[] }) {
  const [expanded, setExpanded] = useState(true);

  const activeReleases = releases.filter((r) => r.status !== "shipped");
  const shippedReleases = releases.filter((r) => r.status === "shipped");

  const visibleReleases = expanded
    ? activeReleases
    : [];

  return (
    <div className="mb-1">
      <div className="flex items-center group">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className={cn(
            "flex flex-1 items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
            "text-muted-foreground hover:text-foreground transition-colors",
          )}
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <Package size={9} className="flex-shrink-0" />
          releases/
          {releases.length > 0 && (
            <span className="ml-auto text-[9px] opacity-50">{releases.length}</span>
          )}
        </button>
      </div>
      {expanded && (
        <div className="px-1.5 pb-1">
          {visibleReleases.map((r) => (
            <ReleaseItem key={r.id} release={r} />
          ))}
          {shippedReleases.length > 0 && (
            <ShippedReleasesGroup releases={shippedReleases} />
          )}
          {releases.length === 0 && (
            <p className="px-2 py-1 text-[10px] text-muted-foreground/40">
              No releases yet. Run <code className="font-mono">curaye release new</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ShippedReleasesGroup({ releases }: { releases: ReleaseSummary[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
      >
        {open ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
        Shipped ({releases.length})
      </button>
      {open && releases.map((r) => <ReleaseItem key={r.id} release={r} />)}
    </div>
  );
}

// ── Tree panel header ─────────────────────────────────────────────────────────

function TreePanelHeader() {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const { projects } = useProjectStore();
  const { generateBrief, isDormant } = useBriefStore();
  const project = projects.find((p) => p.name === selectedProjectId);

  const handleBrief = async () => {
    if (!project) return;
    // Get AI config from backend
    let aiConfig: unknown | null = null;
    try {
      aiConfig = await invoke("get_ai_config");
    } catch {
      aiConfig = null;
    }
    await generateBrief(project.curaye_path, aiConfig);
  };

  if (!project) return null;

  return (
    <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/30 flex-shrink-0">
      <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider truncate flex-1 mr-1">
        {project.name}
      </span>
      <button
        type="button"
        onClick={() => void handleBrief()}
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors flex-shrink-0",
          isDormant
            ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
            : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/[0.06]",
        )}
        title="Generate re-entry brief"
      >
        <FileText size={10} />
        Brief
      </button>
    </div>
  );
}

// ── Re-entry prompt banner ────────────────────────────────────────────────────

function ReentryBanner() {
  const { isDormant, lastOpenedDate, generateBrief } = useBriefStore();
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const { projects } = useProjectStore();
  const [dismissed, setDismissed] = useState(false);

  const project = projects.find((p) => p.name === selectedProjectId);

  if (!isDormant || dismissed || !project) return null;

  const daysAgo = lastOpenedDate
    ? Math.floor((Date.now() - new Date(lastOpenedDate).getTime()) / 86_400_000)
    : null;

  const handleGenerate = async () => {
    setDismissed(true);
    let aiConfig: unknown | null = null;
    try {
      aiConfig = await invoke("get_ai_config");
    } catch {
      aiConfig = null;
    }
    await generateBrief(project.curaye_path, aiConfig);
  };

  return (
    <div className="mx-2 mt-1.5 mb-1 rounded border border-amber-500/20 bg-amber-500/5 p-2">
      <div className="flex items-start gap-1.5">
        <Sparkles size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-amber-300/80 leading-snug">
            {daysAgo !== null ? `Not opened in ${daysAgo} days.` : "Dormant project."}
          </p>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            className="mt-1 text-[10px] text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
          >
            Generate re-entry brief
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground/60 flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Main DocumentTree ─────────────────────────────────────────────────────────

export function DocumentTree() {
  const { tree, expandedSections, toggleSection, loading } = useTreeStore();

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TreePanelHeader />
        <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground px-4 text-center">
          Select a project to browse its documents.
        </div>
      </div>
    );
  }

  const sections: DocSection[] = ["planned", "current", "shipped", "decisions", "root"];

  return (
    <div className="flex flex-col h-full">
      <TreePanelHeader />
      <SearchBar />
      <ReentryBanner />
      <div className="flex-1 overflow-y-auto py-1">
        {sections.map((section) => {
          const nodes = tree[section] ?? [];
          const expanded = expandedSections.has(section);
          const drafts = nodes.filter((n) => n.isDraft);
          const nonDrafts = nodes.filter((n) => !n.isDraft);

          return (
            <div key={section} className="mb-1">
              <SectionHeader
                section={section}
                nodes={nodes}
                expanded={expanded}
                onToggle={() => toggleSection(section)}
              />
              {expanded && (
                <div className="px-1.5 pb-1">
                  {nonDrafts.map((node) => (
                    <TreeItem key={node.path} node={node} section={section} />
                  ))}
                  {drafts.length > 0 && (
                    <div className="mt-1">
                      <p className="px-2 text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">
                        Drafts
                      </p>
                      {drafts.map((node) => (
                        <TreeItem key={node.path} node={node} section={section} />
                      ))}
                    </div>
                  )}
                  {nodes.length === 0 && (
                    <p className="px-2 py-1 text-[10px] text-muted-foreground/40">Empty</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <ReleasesSection releases={tree.releases ?? []} />
      </div>
    </div>
  );
}
