import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, RefreshCw, Plus, LayoutList, Folder, FolderDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectStore, type RegistryProject } from "@/stores/projectStore";
import { useTreeStore } from "@/stores/treeStore";
import { useViewStore } from "@/stores/viewStore";
import { MenuRoot, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { SettingsTrigger } from "@/components/SettingsDrawer";

const STATUS_COLORS: Record<string, string> = {
  clean: "bg-green-500",
  ahead: "bg-amber-400",
  behind: "bg-blue-400",
  diverged: "bg-red-500",
};

function SyncDot({ status }: { status?: string | undefined }) {
  const color = status !== undefined ? (STATUS_COLORS[status] ?? "bg-muted-foreground/40") : "bg-muted-foreground/40";
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full flex-shrink-0", color)} />;
}

type VirtualAnchor = { getBoundingClientRect: () => DOMRect };

function ProjectItem({ project, selected }: { project: RegistryProject; selected: boolean }) {
  const selectProject = useProjectStore((s) => s.selectProject);
  const loadTree = useTreeStore((s) => s.loadTree);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<VirtualAnchor | null>(null);

  const handleSelect = () => {
    selectProject(project.name);
    void loadTree(project.curaye_path);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    setAnchor({
      getBoundingClientRect: () =>
        DOMRect.fromRect({ x, y, width: 0, height: 0 }),
    });
    setMenuOpen(true);
  };

  return (
    <MenuRoot open={menuOpen} onOpenChange={(open) => setMenuOpen(open)}>
      <button
        type="button"
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        className={cn(
          "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-all",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
          selected
            ? "bg-sidebar-primary/15 text-sidebar-primary font-medium shadow-sm"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        {selected
          ? <FolderDot size={13} className="flex-shrink-0 text-sidebar-primary" />
          : <Folder size={13} className="flex-shrink-0 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70 transition-colors" />
        }
        <span className="flex-1 truncate">{project.name}</span>
        {(project.drift_count ?? 0) > 0 && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 bg-amber-400"
            title={`${project.drift_count} drift finding${(project.drift_count ?? 0) === 1 ? "" : "s"}`}
          />
        )}
        {(project.ready_count ?? 0) > 0 && (
          <span className={cn(
            "text-[9px] font-semibold px-1 py-0.5 rounded-full flex-shrink-0",
            selected ? "bg-sidebar-primary/20 text-sidebar-primary" : "bg-sidebar-accent text-sidebar-foreground/60",
          )}>
            {project.ready_count}
          </span>
        )}
        <SyncDot status={project.sync_status} />
      </button>
      <MenuContent anchor={anchor} side="bottom" align="start" sideOffset={4}>
        <MenuItem onClick={() => invoke("reveal_in_finder", { path: project.curaye_path })}>
          <FolderOpen size={12} />
          Reveal in Finder
        </MenuItem>
        <MenuItem onClick={() => invoke("sync_project", { curayePath: project.curaye_path })}>
          <RefreshCw size={12} />
          Sync now
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          destructive
          onClick={() => invoke("unlink_project", { name: project.name })}
        >
          Unlink
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}

export function ProjectsSidebar() {
  const { projects, loading, loadProjects, selectedProjectId, refreshSyncStatus } = useProjectStore();
  const setView = useViewStore((s) => s.setView);
  const view = useViewStore((s) => s.view);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void loadProjects();

    intervalRef.current = setInterval(() => {
      void refreshSyncStatus();
    }, 30_000);

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [loadProjects, refreshSyncStatus]);

  const handleAddProject = async () => {
    try {
      const selected = await invoke<string | null>("pick_directory");
      if (selected === null) return;
      await invoke("link_project", { path: selected });
      await loadProjects();
    } catch {
      // user cancelled or error
    }
  };

  return (
    <aside
      className="flex flex-col h-full vibrancy-sidebar"
      style={{
        background: "var(--sidebar)",
        borderRight: "1px solid var(--glass-border)",
      }}
    >
      {/* Overlay titlebar spacer — drag region for traffic lights */}
      <div
        className="drag-region flex-shrink-0"
        style={{ height: "env(titlebar-area-height, 38px)" }}
      />
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Projects
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1.5">
        {loading && (
          <p className="px-2 py-4 text-xs text-sidebar-foreground/40">Loading…</p>
        )}
        {!loading && projects.length === 0 && (
          <p className="px-2 py-4 text-xs text-sidebar-foreground/40">No projects yet.</p>
        )}
        {projects.map((p) => (
          <ProjectItem key={p.name} project={p} selected={selectedProjectId === p.name} />
        ))}
      </div>

      <div className="border-t border-sidebar-border p-1.5 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setView(view === "backlog" ? "main" : "backlog")}
          className={cn(
            "flex items-center gap-2 rounded px-2.5 py-1.5 text-xs transition-colors",
            view === "backlog"
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <LayoutList size={12} />
          Backlog
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handleAddProject()}
            className={cn(
              "flex flex-1 items-center gap-2 rounded px-2.5 py-1.5 text-xs",
              "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
            )}
          >
            <Plus size={12} />
            Add project
          </button>
          <SettingsTrigger />
        </div>
      </div>
    </aside>
  );
}
