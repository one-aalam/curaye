import { useEffect, useCallback, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Pencil, Eye, Check, ChevronDown as ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore, type EditorMode, type ValidationIssue } from "@/stores/editorStore";
import { useTreeStore } from "@/stores/treeStore";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { MarkdownContent } from "@/components/ui/markdown";

// ── Segmented control ─────────────────────────────────────────────────────────

function SegmentedControl({
  options,
  value,
  onChange,
  field,
}: {
  options: string[];
  value: string | undefined;
  onChange: (v: string) => void;
  field: string;
}) {
  const activeField = useEditorStore((s) => s.activeIssueField);
  const isHighlighted = activeField === field;

  return (
    <div
      className={cn(
        "flex gap-0.5 rounded-md p-0.5",
        "bg-muted/50 border border-border/50",
        isHighlighted && "ring-2 ring-destructive",
      )}
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] capitalize transition-colors",
            value === opt
              ? "bg-primary/15 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── Tag input ─────────────────────────────────────────────────────────────────

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
  const activeField = useEditorStore((s) => s.activeIssueField);
  const isHighlighted = activeField === field;
  const [input, setInput] = useState("");

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  };

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 rounded-md px-2 py-1 min-h-[28px]",
        "bg-muted/30 border border-border/50 focus-within:border-ring/50 transition-colors",
        isHighlighted && "ring-2 ring-destructive",
      )}
    >
      {values.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(values.filter((v) => v !== tag))}
            className="opacity-60 hover:opacity-100 leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(input);
          } else if (e.key === "Backspace" && input === "" && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (input.trim()) addTag(input);
        }}
        placeholder={values.length === 0 ? placeholder : undefined}
        className="flex-1 min-w-16 bg-transparent text-[10px] outline-none placeholder:text-muted-foreground/40"
      />
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <label className="w-16 pt-0.5 text-[10px] font-medium text-muted-foreground flex-shrink-0 capitalize">
        {label}
      </label>
      <div className="flex-1">{children}</div>
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

// ── Structured form ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["draft", "ready", "building", "done", "shelved"];
const EFFORT_OPTIONS = ["xs", "s", "m", "l", "xl"];
const LEVEL_OPTIONS = ["low", "medium", "high"];

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

// ── Spec ID multi-select ──────────────────────────────────────────────────────

function SpecIdSelect({
  values,
  onChange,
  field,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  field: string;
}) {
  const activeField = useEditorStore((s) => s.activeIssueField);
  const isHighlighted = activeField === field;
  const tree = useTreeStore((s) => s.tree);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive spec IDs from the planned section of the tree
  const plannedIds = (tree?.planned ?? [])
    .map((n) => n.name.replace(/\.md$/, "").replace(/^_/, ""))
    .filter((id) => id.length > 0);

  const filtered = filter
    ? plannedIds.filter((id) => id.includes(filter.toLowerCase()))
    : plannedIds;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (id: string) => {
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((o) => !o); }}
        className={cn(
          "flex flex-wrap gap-1 rounded-md px-2 py-1 min-h-[28px] cursor-pointer",
          "bg-muted/30 border border-border/50 focus-within:border-ring/50 transition-colors",
          isHighlighted && "ring-2 ring-destructive",
        )}
      >
        {values.length === 0 && (
          <span className="text-[10px] text-muted-foreground/40 self-center">none</span>
        )}
        {values.map((id) => (
          <span
            key={id}
            className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
          >
            {id}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(id); }}
              className="opacity-60 hover:opacity-100 leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <ChevronDownIcon size={10} className="ml-auto self-center text-muted-foreground/50" />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-md border border-border/50 bg-card shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-border/30">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter spec ids…"
              className="w-full text-[10px] bg-transparent outline-none placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="max-h-40 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-1.5 text-[10px] text-muted-foreground/40">No matching specs</p>
            )}
            {filtered.map((id) => {
              const selected = values.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 text-[10px] text-left transition-colors",
                    selected
                      ? "text-primary bg-primary/5"
                      : "text-foreground/80 hover:bg-accent",
                  )}
                >
                  {selected && <Check size={9} className="flex-shrink-0" />}
                  {!selected && <span className="w-[9px] flex-shrink-0" />}
                  {id}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Body editor: markdown preview with edit toggle ────────────────────────────

function BodyEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Body
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          {editing ? <><Eye size={10} />Preview</> : <><Pencil size={10} />Edit</>}
        </button>
      </div>

      {editing ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          className={cn(
            "flex-1 w-full px-4 pb-4 font-mono text-xs resize-none bg-transparent",
            "focus:outline-none text-foreground/90",
            "placeholder:text-muted-foreground/30",
          )}
          placeholder={"## Problem\n...\n\n## Goal\n..."}
          spellCheck={false}
        />
      ) : (
        <div
          className="flex-1 overflow-y-auto px-4 pb-4 cursor-text"
          onClick={() => setEditing(true)}
        >
          {value.trim() ? (
            <MarkdownContent>{value}</MarkdownContent>
          ) : (
            <p
              className="text-xs text-muted-foreground/30 italic"
              onClick={() => setEditing(true)}
            >
              Click to start writing…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StructuredForm() {
  const { document, updateFrontmatter, updateBody } = useEditorStore();
  if (!document) return null;

  const fm = document.frontmatter;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-3 border-b border-border/50 overflow-y-auto flex-shrink-0">
        <FieldRow label="title">
          <TextInput
            field="title"
            value={fm["title"] as string | undefined}
            onChange={(v) => updateFrontmatter("title", v)}
            placeholder="Untitled"
          />
        </FieldRow>

        <FieldRow label="status">
          <SegmentedControl
            field="status"
            options={STATUS_OPTIONS}
            value={fm["status"] as string | undefined}
            onChange={(v) => updateFrontmatter("status", v)}
          />
        </FieldRow>

        <FieldRow label="effort">
          <SegmentedControl
            field="effort"
            options={EFFORT_OPTIONS}
            value={fm["effort"] as string | undefined}
            onChange={(v) => updateFrontmatter("effort", v)}
          />
        </FieldRow>

        <FieldRow label="impact">
          <SegmentedControl
            field="impact"
            options={LEVEL_OPTIONS}
            value={fm["impact"] as string | undefined}
            onChange={(v) => updateFrontmatter("impact", v)}
          />
        </FieldRow>

        <FieldRow label="desire">
          <SegmentedControl
            field="desire"
            options={LEVEL_OPTIONS}
            value={fm["desire"] as string | undefined}
            onChange={(v) => updateFrontmatter("desire", v)}
          />
        </FieldRow>

        <FieldRow label="requires">
          <SpecIdSelect
            field="requires"
            values={(fm["requires"] as string[] | undefined) ?? []}
            onChange={(v) => updateFrontmatter("requires", v)}
          />
        </FieldRow>

        <FieldRow label="tags">
          <TagInput
            field="tags"
            values={(fm["tags"] as string[] | undefined) ?? []}
            onChange={(v) => updateFrontmatter("tags", v)}
            placeholder="tag…"
          />
        </FieldRow>

        <FieldRow label="release">
          <TextInput
            field="release"
            value={fm["release"] as string | undefined}
            onChange={(v) => updateFrontmatter("release", v)}
            placeholder="v1.0"
          />
        </FieldRow>

        <DateField label="created" value={fm["created"] as string | undefined} />
        <DateField label="updated" value={fm["updated"] as string | undefined} />
      </div>

      <BodyEditor value={document.body} onChange={updateBody} />
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
        {mode === "structured" ? <StructuredForm /> : <RawEditor />}
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
