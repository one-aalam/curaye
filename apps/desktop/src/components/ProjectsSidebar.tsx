import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, RefreshCw, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectStore, type RegistryProject } from "@/stores/projectStore";
import { useTreeStore } from "@/stores/treeStore";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";

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

function ProjectItem({ project, selected }: { project: RegistryProject; selected: boolean }) {
  const selectProject = useProjectStore((s) => s.selectProject);
  const loadTree = useTreeStore((s) => s.loadTree);

  const handleSelect = () => {
    selectProject(project.name);
    loadTree(project.curaye_path);
  };

  return (
    <MenuRoot>
      <MenuTrigger
        render={
          <button
            type="button"
            onClick={handleSelect}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring",
              selected
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <SyncDot status={project.sync_status} />
            <span className="flex-1 truncate">{project.name}</span>
            {(project.ready_count ?? 0) > 0 && (
              <span className="text-[10px] text-sidebar-primary font-medium">
                {project.ready_count}
              </span>
            )}
          </button>
        }
      />
      <MenuContent side="right" align="start" sideOffset={4}>
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
      className="flex flex-col h-full"
      style={{ background: "var(--sidebar)" }}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-sidebar-border">
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

      <div className="border-t border-sidebar-border p-1.5">
        <button
          type="button"
          onClick={() => void handleAddProject()}
          className={cn(
            "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs",
            "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
          )}
        >
          <Plus size={12} />
          Add project
        </button>
      </div>
    </aside>
  );
}
