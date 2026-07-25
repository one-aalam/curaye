import { useEffect, useCallback, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Pencil, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore, type EditorMode, type ValidationIssue } from "@/stores/editorStore";
import { useTreeStore } from "@/stores/treeStore";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { MarkdownContent } from "@/components/ui/markdown";
import { TagCombobox, MultiCombobox } from "@/components/ui/combobox";

// ── Tag field — thin wrapper that reads isHighlighted from store ──────────────

function TagInput({
  values,
  onChange,
  field,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  field: string;
  placeholder?: string;
}) {
  const isHighlighted = useEditorStore((s) => s.activeIssueField) === field;
  return (
    <TagCombobox
      values={values}
      onChange={onChange}
      placeholder={placeholder}
      isHighlighted={isHighlighted}
    />
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <label className="w-16 pt-0.5 text-[10px] font-medium text-muted-foreground flex-shrink-0 capitalize">
        {label}
      </label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  field,
  placeholder,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  field: string;
  placeholder?: string;
}) {
  const activeField = useEditorStore((s) => s.activeIssueField);
  const isHighlighted = activeField === field;

  return (
    <input
      data-field={field}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-md px-2 py-1 text-xs bg-muted/30 border border-border/50",
        "focus:outline-none focus:border-ring/50 transition-colors",
        "placeholder:text-muted-foreground/40",
        isHighlighted && "ring-2 ring-destructive",
      )}
    />
  );
}

// ── Read-only date field ──────────────────────────────────────────────────────

function DateField({ value, label }: { value: string | undefined; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-[10px] font-medium text-muted-foreground flex-shrink-0 capitalize">
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground/60 tabular-nums">
        {value ?? "—"}
      </span>
    </div>
  );
}

// ── Spec ID field — thin wrapper that reads store state ───────────────────────

function SpecIdSelect({
  values,
  onChange,
  field,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  field: string;
}) {
  const isHighlighted = useEditorStore((s) => s.activeIssueField) === field;
  const tree = useTreeStore((s) => s.tree);
  const options = (tree?.planned ?? [])
    .map((n) => n.name.replace(/\.md$/, "").replace(/^_/, ""))
    .filter((id) => id.length > 0);

  return (
    <MultiCombobox
      options={options}
      values={values}
      onChange={onChange}
      placeholder="none"
      isHighlighted={isHighlighted}
      emptyText="No matching specs"
    />
  );
}

// ── Doc section detection ─────────────────────────────────────────────────────

function getDocSection(path: string | null): "planned" | "other" {
  if (!path) return "other";
  return /[/\\]\.curaye[/\\]planned[/\\]/.test(path) ? "planned" : "other";
}

// ── Status badge colors ───────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: "text-muted-foreground bg-muted/60",
  ready: "text-blue-400 bg-blue-400/10",
  building: "text-amber-400 bg-amber-400/10",
  done: "text-emerald-400 bg-emerald-400/10",
  shelved: "text-muted-foreground/40 bg-muted/30",
};

const STATUS_OPTIONS = ["draft", "ready", "building", "done", "shelved"];
const EFFORT_OPTIONS = ["xs", "s", "m", "l", "xl"];
const LEVEL_OPTIONS = ["low", "medium", "high"];

// ── Metadata strip ────────────────────────────────────────────────────────────

function MetadataStrip({ onEdit }: { onEdit: () => void }) {
  const doc = useEditorStore((s) => s.document);
  if (!doc) return null;

  const fm = doc.frontmatter;
  const status = fm.status as string | undefined;
  const effort = fm.effort as string | undefined;
  const impact = fm.impact as string | undefined;
  const desire = fm.desire as string | undefined;
  const tags = (fm.tags as string[] | undefined) ?? [];

  const hasAnyMeta = status ?? effort ?? impact ?? desire ?? tags.length > 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30 flex-shrink-0 min-h-[30px]">
      {status && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
            STATUS_COLORS[status] ?? "text-muted-foreground bg-muted/50",
          )}
        >
          {status}
        </span>
      )}
      {effort && (
        <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">{effort}</span>
      )}
      {impact && (
        <span className="text-[10px] text-muted-foreground/50">
          <span className="text-muted-foreground/25 mr-0.5">impact</span>{impact}
        </span>
      )}
      {desire && (
        <span className="text-[10px] text-muted-foreground/50">
          <span className="text-muted-foreground/25 mr-0.5">desire</span>{desire}
        </span>
      )}
      {tags.slice(0, 4).map((tag) => (
        <span key={tag} className="text-[10px] text-primary/50">#{tag}</span>
      ))}
      {tags.length > 4 && (
        <span className="text-[10px] text-muted-foreground/30">+{tags.length - 4}</span>
      )}
      {!hasAnyMeta && (
        <span className="text-[10px] text-muted-foreground/30 italic">No metadata</span>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      >
        <Pencil size={9} />
        Edit metadata
      </button>
    </div>
  );
}

// ── Metadata panel (slide-in overlay) ────────────────────────────────────────

function MetadataPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditorStore((s) => s.document);
  const updateFrontmatter = useEditorStore((s) => s.updateFrontmatter);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!doc) return null;
  const fm = doc.frontmatter;

  return (
    <div
      style={{ backgroundColor: "var(--card)" }}
      className={cn(
        "absolute top-0 right-0 bottom-0 z-20 w-60 flex flex-col",
        "border-l border-border/60 shadow-xl",
        "transition-transform duration-200 ease-out",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 flex-shrink-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Metadata
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <FieldRow label="title">
          <TextInput
            field="title"
            value={fm.title as string | undefined}
            onChange={(v) => updateFrontmatter("title", v)}
            placeholder="Untitled"
          />
        </FieldRow>

        <FieldRow label="status">
          <Select
            options={STATUS_OPTIONS}
            value={fm.status as string | undefined}
            onValueChange={(v) => updateFrontmatter("status", v)}
            placeholder="pick status"
          />
        </FieldRow>

        <FieldRow label="effort">
          <Select
            options={EFFORT_OPTIONS}
            value={fm.effort as string | undefined}
            onValueChange={(v) => updateFrontmatter("effort", v)}
            placeholder="pick effort"
          />
        </FieldRow>

        <FieldRow label="impact">
          <Select
            options={LEVEL_OPTIONS}
            value={fm.impact as string | undefined}
            onValueChange={(v) => updateFrontmatter("impact", v)}
            placeholder="pick impact"
          />
        </FieldRow>

        <FieldRow label="desire">
          <Select
            options={LEVEL_OPTIONS}
            value={fm.desire as string | undefined}
            onValueChange={(v) => updateFrontmatter("desire", v)}
            placeholder="pick desire"
          />
        </FieldRow>

        <FieldRow label="requires">
          <SpecIdSelect
            field="requires"
            values={(fm.requires as string[] | undefined) ?? []}
            onChange={(v) => updateFrontmatter("requires", v)}
          />
        </FieldRow>

        <FieldRow label="tags">
          <TagInput
            field="tags"
            values={(fm.tags as string[] | undefined) ?? []}
            onChange={(v) => updateFrontmatter("tags", v)}
            placeholder="tag…"
          />
        </FieldRow>

        <FieldRow label="release">
          <TextInput
            field="release"
            value={fm.release as string | undefined}
            onChange={(v) => updateFrontmatter("release", v)}
            placeholder="v1.0"
          />
        </FieldRow>

        <div className="pt-2 border-t border-border/20 space-y-1.5">
          <DateField label="created" value={fm.created as string | undefined} />
          <DateField label="updated" value={fm.updated as string | undefined} />
        </div>
      </div>
    </div>
  );
}

// ── Body editor ───────────────────────────────────────────────────────────────

function BodyEditor({
  value,
  title,
  onOpenMetadata,
  onChange,
}: {
  value: string;
  title?: string | undefined;
  onOpenMetadata?: (() => void) | undefined;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {editing ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-end px-4 pt-2 pb-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <Eye size={10} />
              Preview
            </button>
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            className={cn(
              "flex-1 w-full px-5 pb-6 font-mono text-xs resize-none bg-transparent",
              "focus:outline-none text-foreground/90 placeholder:text-muted-foreground/30",
            )}
            placeholder={"## Problem\n...\n\n## Goal\n..."}
            spellCheck={false}
          />
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto px-5 pt-4 pb-6 cursor-text"
          onClick={() => setEditing(true)}
        >
          {title && (
            <h1
              className={cn(
                "text-base font-semibold text-foreground mb-4 leading-snug transition-colors",
                onOpenMetadata && "cursor-pointer hover:text-primary/80",
              )}
              onClick={onOpenMetadata ? (e) => { e.stopPropagation(); onOpenMetadata(); } : undefined}
              title={onOpenMetadata ? "Click to edit metadata" : undefined}
            >
              {title}
            </h1>
          )}
          {value.trim() ? (
            <MarkdownContent>{value}</MarkdownContent>
          ) : (
            <p className="text-xs text-muted-foreground/30 italic">
              Click to start writing…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Structured view ───────────────────────────────────────────────────────────

function StructuredView() {
  const doc = useEditorStore((s) => s.document);
  const currentPath = useEditorStore((s) => s.currentPath);
  const updateBody = useEditorStore((s) => s.updateBody);
  const [panelOpen, setPanelOpen] = useState(false);

  const isPlannedSpec = getDocSection(currentPath) === "planned";

  // Auto-open metadata panel in creation mode (empty body) — planned specs only
  useEffect(() => {
    if (isPlannedSpec && doc && !doc.body.trim()) {
      setPanelOpen(true);
    } else {
      setPanelOpen(false);
    }
  }, [currentPath]); // reset per document, not on every body keystroke

  if (!doc) return null;

  const rawTitle = doc.frontmatter.title as string | undefined;
  const title = isPlannedSpec && rawTitle ? rawTitle : undefined;

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {isPlannedSpec && <MetadataStrip onEdit={() => setPanelOpen(true)} />}
      <BodyEditor
        value={doc.body}
        title={title}
        onOpenMetadata={isPlannedSpec ? () => setPanelOpen(true) : undefined}
        onChange={updateBody}
      />
      {isPlannedSpec && <MetadataPanel open={panelOpen} onClose={() => setPanelOpen(false)} />}
    </div>
  );
}

// ── Raw editor ────────────────────────────────────────────────────────────────

function RawEditor() {
  const { document, updateRaw } = useEditorStore();
  if (!document) return null;

  return (
    <textarea
      value={document.raw}
      onChange={(e) => updateRaw(e.target.value)}
      className={cn(
        "w-full h-full p-4 font-mono text-xs resize-none bg-transparent",
        "focus:outline-none text-foreground/90",
      )}
      spellCheck={false}
    />
  );
}

// ── Validation tray ───────────────────────────────────────────────────────────

function ValidationTray({ issues }: { issues: ValidationIssue[] }) {
  const highlightField = useEditorStore((s) => s.highlightField);
  const [open, setOpen] = useState(true);

  if (issues.length === 0) return null;

  return (
    <div className="border-t border-border/50 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {issues.filter((i) => i.severity === "error").length} error
        {issues.filter((i) => i.severity === "error").length !== 1 ? "s" : ""},&nbsp;
        {issues.filter((i) => i.severity === "warning").length} warning
        {issues.filter((i) => i.severity === "warning").length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-1">
          {issues.map((issue, i) => (
            <button
              key={i}
              type="button"
              onClick={() => highlightField(issue.field)}
              className="flex w-full items-start gap-1.5 text-left text-[10px] hover:text-foreground transition-colors"
            >
              {issue.severity === "error" ? (
                <AlertCircle size={10} className="text-destructive mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle size={10} className="text-amber-400 mt-0.5 flex-shrink-0" />
              )}
              <span className="text-muted-foreground">
                <span className="font-medium">{issue.field}</span>: {issue.message}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Save prompt dialog ────────────────────────────────────────────────────────

function UnsavedPrompt({
  title,
  onSave,
  onDiscard,
  onCancel,
}: {
  title: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-xl border border-(--glass-border) bg-card shadow-(--glass-shadow) p-5 w-80">
        <p className="text-sm font-semibold mb-1">Save changes?</p>
        <p className="text-xs text-muted-foreground mb-4">
          Save changes to <span className="font-medium text-foreground">{title}</span>?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-3 py-1.5 text-xs rounded hover:bg-accent transition-colors text-muted-foreground"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function DocumentEditor() {
  const { document, mode, unsaved, loading, saving, setMode, save, discard } = useEditorStore();
  const selectedPath = useTreeStore((s) => s.selectedPath);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const pendingLoadRef = useRef<(() => void) | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (unsaved) void save();
      }
    },
    [unsaved, save],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Intercept path changes when unsaved
  useEffect(() => {
    if (!selectedPath || selectedPath === useEditorStore.getState().currentPath) return;
    if (unsaved) {
      setPendingPath(selectedPath);
      setShowPrompt(true);
    }
  }, [selectedPath, unsaved]);

  const handleSaveAndNavigate = async () => {
    await save();
    setShowPrompt(false);
    if (pendingPath) {
      await useEditorStore.getState().loadDocument(pendingPath, "spec");
      setPendingPath(null);
    }
    if (pendingLoadRef.current) {
      pendingLoadRef.current();
      pendingLoadRef.current = null;
    }
  };

  const handleDiscardAndNavigate = () => {
    discard();
    setShowPrompt(false);
    if (pendingPath) {
      void useEditorStore.getState().loadDocument(pendingPath, "spec");
      setPendingPath(null);
    }
  };

  if (!document && !loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        Select a document to edit.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        Loading…
      </div>
    );
  }

  const title = (document?.frontmatter["title"] as string | undefined) ?? "Untitled";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 flex-shrink-0">
        <span className="flex-1 text-xs font-medium truncate text-foreground/80">
          {title}
          {unsaved && <span className="ml-1 text-primary">•</span>}
        </span>
        {saving && (
          <span className="text-[10px] text-muted-foreground">Saving…</span>
        )}
        <TabsRoot
          value={mode}
          onValueChange={(v) => setMode(v as EditorMode)}
          className="flex-shrink-0"
        >
          <TabsList className="flex gap-0.5 rounded-md bg-muted/40 p-0.5 border-0 py-0 px-0">
            <TabsTab value="structured" className="text-[10px] px-2 py-0.5">
              Structured
            </TabsTab>
            <TabsTab value="raw" className="text-[10px] px-2 py-0.5">
              Raw
            </TabsTab>
          </TabsList>
          <TabsPanel value="structured" />
          <TabsPanel value="raw" />
        </TabsRoot>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {mode === "structured" ? <StructuredView /> : <RawEditor />}
      </div>

      {/* Validation tray */}
      {document !== null && (
        <ValidationTray issues={document.validation_issues} />
      )}

      {/* Unsaved prompt */}
      {showPrompt && (
        <UnsavedPrompt
          title={title}
          onSave={() => void handleSaveAndNavigate()}
          onDiscard={handleDiscardAndNavigate}
          onCancel={() => {
            setShowPrompt(false);
            setPendingPath(null);
          }}
        />
      )}
    </div>
  );
}
