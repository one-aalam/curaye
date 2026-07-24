import { useEffect, useRef } from "react";
import { X, Save, ArrowRight, Loader2 } from "lucide-react";
import { useBriefStore } from "@/stores/briefStore";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTreeStore } from "@/stores/treeStore";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/ui/markdown";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BriefView() {
  const { content, streaming, error, suggestedSpecPath, closeBrief, saveBrief, cancelBrief } =
    useBriefStore();
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const { projects } = useProjectStore();
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const selectDocument = useTreeStore((s) => s.selectDocument);
  const scrollRef = useRef<HTMLDivElement>(null);

  const project = projects.find((p) => p.name === selectedProjectId);

  // Auto-scroll while streaming
  useEffect(() => {
    if (streaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, streaming]);

  const handleSave = async () => {
    if (!project) return;
    await saveBrief(project.curaye_path, today());
  };

  const handleStartWorking = async () => {
    if (!suggestedSpecPath) return;
    selectDocument(suggestedSpecPath);
    await loadDocument(suggestedSpecPath, "spec");
    closeBrief();
  };

  const handleClose = () => {
    if (streaming) cancelBrief();
    closeBrief();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Re-entry Brief
          </span>
          {streaming && (
            <Loader2 size={11} className="animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {!streaming && content && (
            <button
              type="button"
              onClick={() => void handleSave()}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Save brief to .curaye/briefs/"
            >
              <Save size={11} />
              Save
            </button>
          )}
          {!streaming && suggestedSpecPath && (
            <button
              type="button"
              onClick={() => void handleStartWorking()}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-primary/10 hover:bg-primary/20 text-primary transition-colors font-medium"
              title="Open recommended spec"
            >
              Start working
              <ArrowRight size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Close brief"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}
        {!error && (
          <div
            className={cn(
              streaming && "after:content-['▊'] after:animate-pulse after:text-primary",
            )}
          >
            {content
              ? <MarkdownContent>{content}</MarkdownContent>
              : streaming
                ? null
                : <p className="text-xs text-muted-foreground">Generating brief…</p>
            }
          </div>
        )}
      </div>
    </div>
  );
}
