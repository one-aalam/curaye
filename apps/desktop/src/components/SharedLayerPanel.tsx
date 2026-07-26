import { useEffect, useRef } from "react";
import { ToolkitFormModal } from "@/components/ToolkitFormModal";
import { ArrowLeft, Plus, X, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSharedLayerStore,
  SHARED_CATEGORIES,
  type SharedCategory,
  type SharedDocSummary,
} from "@/stores/sharedLayerStore";
import { useProjectStore } from "@/stores/projectStore";
import {
  useToolkitStore,
  type ToolkitPreset,
} from "@/stores/toolkitStore";

// ── Frontmatter parser (lightweight, display-only) ───────────────────────────

function extractFrontmatterField(raw: string, field: string): string | null {
  const match = new RegExp(`^${field}:\\s*(.+)$`, "m").exec(raw);
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

function extractAdoptedBy(raw: string): string[] {
  const fmMatch = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (!fmMatch?.[1]) return [];
  const fm = fmMatch[1];
  // Inline list: adopted_by: [a, b, c]
  const inlineMatch = /^adopted_by:\s*\[([^\]]*)\]/m.exec(fm);
  if (inlineMatch?.[1] !== undefined) {
    return inlineMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // Block list
  const blockMatch = /^adopted_by:\s*\n((?:\s+-\s+.+\n?)*)/m.exec(fm);
  if (blockMatch?.[1] !== undefined) {
    return blockMatch[1]
      .split("\n")
      .map((l) => l.replace(/^\s+-\s+/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function computeNotifiedCount(editedContent: string | null, sourceProjectId: string | null): number {
  if (!editedContent) return 0;
  const adopted = extractAdoptedBy(editedContent);
  return adopted.filter((p) => p !== sourceProjectId).length;
}

// ── Category tab ─────────────────────────────────────────────────────────────

function CategoryTab({
  category,
  count,
  selected,
  onSelect,
}: {
  category: SharedCategory;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors",
        selected
          ? "bg-primary/15 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <span>{category}</span>
      <span
        className={cn(
          "text-[9px] font-medium",
          selected ? "text-primary/70" : "text-muted-foreground/50",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ── Doc row ───────────────────────────────────────────────────────────────────

function DocRow({
  doc,
  selected,
  onSelect,
}: {
  doc: SharedDocSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group w-full text-left rounded-md px-2.5 py-2 transition-colors",
        selected
          ? "bg-primary/15 text-primary"
          : "text-foreground/80 hover:bg-accent hover:text-foreground",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-xs font-mono leading-snug truncate", selected && "font-medium")}>
          {doc.title !== doc.id ? doc.title : doc.id}
        </span>
        {doc.adoptedByCount > 0 && (
          <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium bg-muted/60 text-muted-foreground">
            {doc.adoptedByCount}
          </span>
        )}
      </div>
      {doc.promoted && (
        <p className="mt-0.5 text-[10px] text-muted-foreground/50">{doc.promoted}</p>
      )}
    </button>
  );
}

// ── New doc form ──────────────────────────────────────────────────────────────

function NewDocForm() {
  const {
    newDocCategory,
    newDocId,
    newDocIdError,
    newDocError,
    creatingDoc,
    setNewDocCategory,
    setNewDocId,
    createDoc,
    hideNewForm,
  } = useSharedLayerStore();

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="border-b border-border/30 p-3 space-y-2.5 bg-card/30">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">New shared document</span>
        <button
          type="button"
          onClick={hideNewForm}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Category picker */}
      <div className="flex flex-wrap gap-1">
        {SHARED_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setNewDocCategory(cat)}
            className={cn(
              "rounded px-2 py-1 text-[10px] transition-colors",
              newDocCategory === cat
                ? "bg-primary/15 text-primary font-medium"
                : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Doc id input */}
      <div>
        <input
          ref={inputRef}
          type="text"
          value={newDocId}
          onChange={(e) => setNewDocId(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void createDoc(); }}
          placeholder="doc-id"
          className={cn(
            "w-full rounded border bg-card/50 px-2.5 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/40",
            "focus:outline-none focus:ring-1 transition-colors",
            newDocIdError
              ? "border-destructive/50 focus:border-destructive/60 focus:ring-destructive/20"
              : "border-border/50 focus:border-primary/40 focus:ring-primary/20",
          )}
        />
        {newDocIdError && (
          <p className="mt-0.5 text-[10px] text-destructive">{newDocIdError}</p>
        )}
      </div>

      {newDocError && (
        <p className="rounded border border-destructive/20 bg-destructive/8 px-2.5 py-1.5 text-[10px] text-destructive">
          {newDocError}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={hideNewForm}
          className="rounded px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void createDoc()}
          disabled={creatingDoc || !!newDocIdError || !newDocId.trim()}
          className={cn(
            "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
            "bg-primary/15 text-primary hover:bg-primary/25",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {creatingDoc ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}

// ── Metadata strip ────────────────────────────────────────────────────────────

function MetadataStrip({ content }: { content: string }) {
  const sourceProject = extractFrontmatterField(content, "source_project");
  const promoted = extractFrontmatterField(content, "promoted");
  const adoptedBy = extractAdoptedBy(content);

  return (
    <div className="flex-shrink-0 border-b border-border/30 bg-muted/10 px-4 py-2.5 space-y-1.5">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {sourceProject && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">source</span>
            <span className="font-mono text-[11px] text-foreground/80">{sourceProject}</span>
          </div>
        )}
        {promoted && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">promoted</span>
            <span className="font-mono text-[11px] text-foreground/80">{promoted}</span>
          </div>
        )}
      </div>
      {adoptedBy.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">adopted by</span>
          {adoptedBy.map((p) => (
            <span
              key={p}
              className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary/80"
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Toolkit preset card ───────────────────────────────────────────────────────

function ToolkitCard({
  preset,
  onEdit,
  onDelete,
  deleting,
}: {
  preset: ToolkitPreset;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const toolList = [preset.tools.formatter, preset.tools.linter, preset.tools.test, preset.tools.e2e]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-md border border-border/40 bg-card/30 p-3 space-y-2 hover:border-border/60 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-mono font-medium text-foreground truncate">{preset.id}</p>
          <p className="text-[11px] text-muted-foreground truncate">{preset.title}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Edit preset"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
            title="Delete preset"
          >
            {deleting ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {preset.app_type && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/80">
            {preset.app_type}
          </span>
        )}
        {preset.runtime.map((r) => (
          <span key={r} className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {r}
          </span>
        ))}
      </div>

      {preset.framework.length > 0 && (
        <p className="text-[10px] text-muted-foreground/70">
          <span className="text-muted-foreground/50">Frameworks: </span>
          {preset.framework.join(", ")}
        </p>
      )}

      {preset.starter_kit && (
        <div>
          <p className="text-[10px] text-muted-foreground/70">
            <span className="text-muted-foreground/50">Starter kit: </span>
            {preset.starter_kit}
          </p>
          {preset.starter_kit_cmd && (
            <p className="font-mono text-[10px] text-muted-foreground/50 truncate">{preset.starter_kit_cmd}</p>
          )}
        </div>
      )}

      {preset.design_system && (
        <p className="text-[10px] text-muted-foreground/70">
          <span className="text-muted-foreground/50">Design system: </span>
          {preset.design_system}
        </p>
      )}

      {toolList && (
        <p className="text-[10px] text-muted-foreground/70">
          <span className="text-muted-foreground/50">Tools: </span>
          {toolList}
        </p>
      )}
    </div>
  );
}

// ── Stack tab — toolkit cards + plain docs ────────────────────────────────────

function StackTabContent({
  docs,
  selectedDocId,
  onSelectDoc,
}: {
  docs: SharedDocSummary[];
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
}) {
  const { presets, loading, deletingId, loadPresets, openAddForm, openEditForm, deletePreset } =
    useToolkitStore();

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  // Docs that have no matching preset id
  const presetIds = new Set(presets.map((p) => p.id));
  const plainDocs = docs.filter((d) => !presetIds.has(d.id));

  return (
    <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3">
      {/* Add preset button */}
      <button
        type="button"
        onClick={openAddForm}
        className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border/50 px-3 py-2 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Plus size={11} />
        Add preset
      </button>

      {/* Preset cards */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      ) : presets.length === 0 && plainDocs.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-muted-foreground">
          No stack documents yet. Add a preset or create a stack document.
        </p>
      ) : (
        <>
          {presets.map((preset) => (
            <ToolkitCard
              key={preset.id}
              preset={preset}
              onEdit={() => openEditForm(preset)}
              onDelete={() => void deletePreset(preset.id)}
              deleting={deletingId === preset.id}
            />
          ))}

          {/* Plain stack docs without toolkit fields */}
          {plainDocs.length > 0 && (
            <div>
              <p className="px-1 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground/50">
                Stack docs (no preset)
              </p>
              {plainDocs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  selected={selectedDocId === doc.id}
                  onSelect={() => onSelectDoc(doc.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function SharedLayerPanel() {
  const {
    sharedLayerOpen,
    selectedCategory,
    docs,
    docsLoading,
    selectedDocId,
    selectedDocContent,
    docLoading,
    docError,
    editedContent,
    saving,
    saveError,
    showNewDocForm,
    closePanel,
    selectCategory,
    selectDoc,
    setEditedContent,
    saveDoc,
    cancelEdit,
    showNewForm,
  } = useSharedLayerStore();

  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);

  useEffect(() => {
    if (!sharedLayerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sharedLayerOpen, closePanel]);

  if (!sharedLayerOpen) return null;

  const isStackTab = selectedCategory === "stack";
  const filteredDocs = docs.filter((d) => d.category === selectedCategory);
  const docCountByCategory = Object.fromEntries(
    SHARED_CATEGORIES.map((cat) => [cat, docs.filter((d) => d.category === cat).length]),
  ) as Record<typeof SHARED_CATEGORIES[number], number>;

  const isUnchanged = editedContent === selectedDocContent;
  const notifiedCount = computeNotifiedCount(editedContent, selectedProjectId);
  const saveLabel = saving
    ? "Saving…"
    : notifiedCount > 0
    ? `Save · ${notifiedCount} notified`
    : "Save";

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border/40"
        style={{ paddingTop: "calc(env(titlebar-area-height, 38px) + 0.625rem)" }}
      >
        <button
          type="button"
          onClick={closePanel}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft size={13} />
          Close
        </button>
        <span className="text-sm font-semibold text-foreground">Shared Layer</span>
        <button
          type="button"
          onClick={showNewForm}
          className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus size={12} />
          New
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column */}
        <div
          className="flex flex-col border-r border-border/40 overflow-hidden"
          style={{ width: "240px", flexShrink: 0 }}
        >
          {/* Category tabs */}
          <div className="flex-shrink-0 flex flex-wrap gap-1 p-2.5 border-b border-border/30">
            {SHARED_CATEGORIES.map((cat) => (
              <CategoryTab
                key={cat}
                category={cat}
                count={docCountByCategory[cat]}
                selected={selectedCategory === cat}
                onSelect={() => selectCategory(cat)}
              />
            ))}
          </div>

          {/* Stack tab: cards view */}
          {isStackTab ? (
            <StackTabContent
              docs={filteredDocs}
              selectedDocId={selectedDocId}
              onSelectDoc={(id) => void selectDoc(id, "stack")}
            />
          ) : (
            <>
              {/* New doc form (inline, at top of list) */}
              {showNewDocForm && <NewDocForm />}

              {/* Doc list */}
              <div className="flex-1 overflow-y-auto py-1 px-1.5">
                {docsLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  </div>
                )}
                {!docsLoading && filteredDocs.length === 0 && (
                  <div className="py-6 px-3 text-center space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      No shared documents in this category yet
                    </p>
                    {!showNewDocForm && (
                      <button
                        type="button"
                        onClick={showNewForm}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Create the first one →
                      </button>
                    )}
                  </div>
                )}
                {!docsLoading && filteredDocs.map((doc) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    selected={selectedDocId === doc.id && selectedCategory === doc.category}
                    onSelect={() => void selectDoc(doc.id, doc.category)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {docLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : docError ? (
            <div className="flex flex-1 items-center justify-center px-8">
              <p className="text-xs text-destructive text-center break-all">{docError}</p>
            </div>
          ) : selectedDocContent !== null ? (
            <>
              <MetadataStrip content={selectedDocContent} />
              <textarea
                value={editedContent ?? ""}
                onChange={(e) => setEditedContent(e.target.value)}
                className={cn(
                  "flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed",
                  "text-foreground placeholder:text-muted-foreground/30",
                  "focus:outline-none",
                )}
                spellCheck={false}
              />
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-border/40">
                {saveError && (
                  <p className="text-[11px] text-destructive truncate max-w-sm">{saveError}</p>
                )}
                {!saveError && <span />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isUnchanged}
                    className={cn(
                      "rounded px-3 py-1.5 text-xs transition-colors",
                      "text-muted-foreground hover:bg-accent hover:text-foreground",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveDoc(selectedProjectId ?? undefined)}
                    disabled={isUnchanged || saving}
                    className={cn(
                      "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    {saveLabel}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground/50">
                {isStackTab ? "Select a stack doc to view and edit" : "Select a document to view and edit"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toolkit preset form modal */}
      <ToolkitFormModal />
    </div>
  );
}
