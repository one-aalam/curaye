import { ChevronRight, ChevronDown, Plus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTreeStore, type TreeNode, type DocSection } from "@/stores/treeStore";
import { useEditorStore } from "@/stores/editorStore";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/projectStore";

const STATUS_DOT: Record<string, string> = {
  draft: "bg-zinc-400",
  ready: "bg-blue-400",
  building: "bg-amber-400",
  done: "bg-green-500",
  shelved: "bg-zinc-600",
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

function StatusBadge({ status }: { status?: string | undefined }) {
  if (status === undefined) return null;
  const color = STATUS_DOT[status] ?? "bg-zinc-400";
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full flex-shrink-0", color)} />;
}

function TreeItem({ node, section }: { node: TreeNode; section: DocSection }) {
  const selectedPath = useTreeStore((s) => s.selectedPath);
  const selectDocument = useTreeStore((s) => s.selectDocument);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const selected = selectedPath === node.path;

  const handleClick = () => {
    selectDocument(node.path);
    void loadDocument(node.path, DOC_TYPES[section] ?? "generic");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        selected
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/70 hover:bg-accent hover:text-foreground",
        node.isDraft && "italic text-muted-foreground",
      )}
    >
      {section === "planned" && <StatusBadge status={node.status} />}
      {node.hasValidationError && (
        <AlertCircle size={10} className="text-destructive flex-shrink-0" />
      )}
      <span className="flex-1 truncate">{node.name}</span>
    </button>
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
          "flex flex-1 items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
          "text-muted-foreground hover:text-foreground transition-colors",
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
        className="mr-1 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent text-muted-foreground"
        title={`New ${section} document`}
      >
        <Plus size={10} />
      </button>
    </div>
  );
}

export function DocumentTree() {
  const { tree, expandedSections, toggleSection, loading } = useTreeStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground px-4 text-center">
        Select a project to browse its documents.
      </div>
    );
  }

  const sections: DocSection[] = ["planned", "current", "shipped", "decisions", "root"];

  return (
    <div className="flex flex-col h-full overflow-y-auto py-1">
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
    </div>
  );
}
