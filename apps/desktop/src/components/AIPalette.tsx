import { useEffect, useRef, useCallback, useState } from "react";
import {
  Search, Sparkles, X,
  List, Map, Hammer, Rocket, RefreshCw, Globe,
  FileText, FilePlus, ListChecks, CheckSquare, GitPullRequest,
  MessageCircle, BookOpen, ArrowUpCircle, AlertCircle,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editorStore";
import {
  usePaletteStore,
  type DiffLine,
  type AttachedSpec,
} from "@/stores/paletteStore";
import { useProjectStore } from "@/stores/projectStore";
import { MarkdownContent } from "@/components/ui/markdown";

// ── Types & constants ─────────────────────────────────────────────────────────

type CommandType = "instant" | "param" | "portfolio";
type CategoryId = "all" | "plan" | "build" | "ship" | "maintain" | "portfolio";

type IconComponent = React.FC<{ size?: number; className?: string }>;

interface CommandEntry {
  label: string;
  type: CommandType;
  Icon: IconComponent;
  tabs: CategoryId[];
  hint?: string;
  expandWith?: string;
}

interface Category {
  id: CategoryId;
  label: string;
  shortLabel: string;
  Icon: IconComponent;
}

interface DocumentListItem {
  id: string;
  title: string;
  docType: string;
}

const CATEGORIES: Category[] = [
  { id: "all",       label: "All",       shortLabel: "All",   Icon: List      },
  { id: "plan",      label: "Plan",      shortLabel: "Plan",  Icon: Map       },
  { id: "build",     label: "Build",     shortLabel: "Build", Icon: Hammer    },
  { id: "ship",      label: "Ship",      shortLabel: "Ship",  Icon: Rocket    },
  { id: "maintain",  label: "Maintain",  shortLabel: "Maint.", Icon: RefreshCw },
  { id: "portfolio", label: "Portfolio", shortLabel: "Port.", Icon: Globe     },
];

const COMMANDS: CommandEntry[] = [
  { label: "Draft a spec",                    type: "param",     Icon: FileText,     tabs: ["all", "plan"],            hint: "feature name…",       expandWith: "Draft a spec for "                   },
  { label: "Re-entry brief for current project", type: "instant", Icon: BookOpen,   tabs: ["all", "plan", "maintain"]                                                                                 },
  { label: "Generate acceptance criteria",    type: "param",     Icon: CheckSquare,  tabs: ["all", "build"],           hint: "spec name or feature…", expandWith: "Generate acceptance criteria for " },
  { label: "Update current/ from shipped spec", type: "instant", Icon: ArrowUpCircle, tabs: ["all", "maintain"]                                                                                       },
  { label: "Detect drift in this project",   type: "instant",   Icon: AlertCircle,  tabs: ["all", "maintain"]                                                                                         },
  { label: "Find where I solved this before", type: "portfolio", Icon: Search,       tabs: ["all", "portfolio"],       hint: "problem or topic…",   expandWith: "Find where I solved "                },
];

const CONTEXTUAL_CMDS: { label: string; Icon: IconComponent }[] = [
  { label: "What's missing from this spec?", Icon: ListChecks     },
  { label: "Generate acceptance criteria",   Icon: CheckSquare    },
  { label: "Generate a PR description",      Icon: GitPullRequest },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryRailButton({
  category,
  isActive,
  onClick,
}: {
  category: Category;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 w-full py-1.5 px-1 rounded-md transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
      )}
    >
      <category.Icon size={12} />
      <span className="text-[9px] leading-none font-medium">{category.shortLabel}</span>
    </button>
  );
}

function CommandRow({
  cmd,
  isActive,
  onActivate,
  onHover,
}: {
  cmd: CommandEntry;
  isActive: boolean;
  onActivate: () => void;
  onHover: () => void;
}) {
  const isPortfolio = cmd.type === "portfolio";
  const keyBadge = cmd.type === "param" ? "→" : "↵";

  return (
    <button
      type="button"
      onClick={onActivate}
      onMouseEnter={onHover}
      className={cn(
        "flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-sm text-left transition-colors group",
        isActive
          ? "bg-primary/12 text-primary ring-1 ring-primary/25"
          : "text-foreground/70 hover:bg-primary/6 hover:text-foreground",
      )}
    >
      <cmd.Icon
        size={12}
        className={cn(
          "shrink-0 transition-colors",
          isPortfolio
            ? isActive ? "text-foreground/60" : "text-foreground/40"
            : isActive ? "text-primary" : "text-muted-foreground",
        )}
      />
      <span className="flex-1 flex items-baseline gap-1.5 min-w-0">
        <span className="shrink-0">{cmd.label}</span>
        {cmd.hint && (
          <span
            className={cn(
              "text-[11px] truncate transition-colors",
              isActive ? "text-primary/35" : "text-muted-foreground/25",
            )}
          >
            {cmd.hint}
          </span>
        )}
      </span>
      {isPortfolio && (
        <span
          className={cn(
            "text-[9px] px-1 py-0.5 rounded border font-medium shrink-0",
            isActive
              ? "border-foreground/20 text-foreground/60"
              : "border-muted-foreground/20 text-muted-foreground/50",
          )}
        >
          all projects
        </span>
      )}
      <kbd
        className={cn(
          "text-[10px] font-mono shrink-0 transition-opacity",
          isActive
            ? "opacity-100 text-primary/60"
            : "opacity-0 group-hover:opacity-100 text-muted-foreground/40",
        )}
      >
        {keyBadge}
      </kbd>
    </button>
  );
}

function CommandGroup({
  label,
  commands,
  activeIndex,
  globalOffset,
  onActivate,
  onHover,
}: {
  label: string;
  commands: CommandEntry[];
  activeIndex: number;
  globalOffset: number;
  onActivate: (cmd: CommandEntry) => void;
  onHover: (idx: number) => void;
}) {
  if (commands.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">
        {label}
      </p>
      <div className="space-y-0.5">
        {commands.map((cmd, localIdx) => (
          <CommandRow
            key={cmd.label}
            cmd={cmd}
            isActive={globalOffset + localIdx === activeIndex}
            onActivate={() => onActivate(cmd)}
            onHover={() => onHover(globalOffset + localIdx)}
          />
        ))}
      </div>
    </div>
  );
}

function ContextSection({
  target,
  onActivate,
  onChangeClick,
}: {
  target: { label: string } | null;
  onActivate: (label: string) => void;
  onChangeClick: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0">
        <FileText size={11} className="text-primary shrink-0" />
        <span className="text-xs text-muted-foreground font-medium">For this spec</span>
        {target && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium truncate max-w-[160px]">
            {target.label}
          </span>
        )}
        <button
          type="button"
          onClick={onChangeClick}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          change
        </button>
      </div>
      <div className="flex-1 space-y-0.5 px-2 pb-2">
        {CONTEXTUAL_CMDS.map(({ label, Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => onActivate(label)}
            className={cn(
              "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs text-left transition-colors group",
              "text-foreground/70 hover:bg-primary/8 hover:text-foreground",
            )}
          >
            <Icon size={11} className="text-primary shrink-0" />
            <span className="flex-1">
              {label === "What's missing from this spec?"
                ? `What's missing from this spec?`
                : label}
            </span>
            <kbd className="text-[9px] text-muted-foreground/40 font-mono shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              ↵
            </kbd>
          </button>
        ))}
      </div>
    </div>
  );
}

function AttachmentSection({
  attachQuery,
  setAttachQuery,
  specList,
  onSelect,
  showCancel,
  onCancel,
}: {
  attachQuery: string;
  setAttachQuery: (v: string) => void;
  specList: DocumentListItem[];
  onSelect: (item: DocumentListItem) => void;
  showCancel: boolean;
  onCancel: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-3 py-2 shrink-0">
        <FilePlus size={11} className="text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground font-medium">Attach a spec</span>
        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            cancel
          </button>
        )}
      </div>
      <div className="px-3 pb-1.5 shrink-0">
        <input
          ref={searchRef}
          value={attachQuery}
          onChange={(e) => setAttachQuery(e.target.value)}
          placeholder="Search specs…"
          className="w-full bg-accent/40 rounded px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/40"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-1">
        {specList.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/40 px-2 py-1">No specs found</p>
        ) : (
          <div className="space-y-0.5">
            {specList.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "flex items-center gap-2 w-full rounded-md px-2 py-1 text-xs text-left transition-colors group",
                  "text-foreground/70 hover:bg-accent hover:text-foreground",
                )}
              >
                <FileText size={10} className="text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{item.title}</span>
                <kbd className="text-[9px] text-muted-foreground/40 font-mono shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  ↵
                </kbd>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Input phase ───────────────────────────────────────────────────────────────

function InputPhase() {
  const { query, setQuery, execute, closePalette, attachedSpec, setAttachedSpec } =
    usePaletteStore();
  const { document: openDoc } = useEditorStore();
  const { projects, selectedProjectId } = useProjectStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");
  const [showAttachment, setShowAttachment] = useState(false);
  const [attachQuery, setAttachQuery] = useState("");
  const [specList, setSpecList] = useState<DocumentListItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const openDocTitle =
    typeof openDoc?.frontmatter.title === "string" ? openDoc.frontmatter.title : null;
  const hasOpenDoc = openDocTitle !== null;

  const effectiveTarget: { label: string } | null = hasOpenDoc
    ? { label: openDocTitle }
    : attachedSpec
      ? { label: attachedSpec.label }
      : null;

  const project = selectedProjectId
    ? (projects.find((p) => p.name === selectedProjectId) ?? null)
    : null;

  // On mount: if no open doc and no attached spec, enter attachment mode immediately
  useEffect(() => {
    if (!hasOpenDoc && !attachedSpec) {
      setShowAttachment(true);
    }
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load spec list when entering attachment mode
  useEffect(() => {
    if (!showAttachment || !project?.curaye_path) return;
    void invoke<DocumentListItem[]>("list_documents", { curayePath: project.curaye_path })
      .then((items) => setSpecList(items))
      .catch(() => setSpecList([]));
  }, [showAttachment, project?.curaye_path]);

  // Reset keyboard highlight on query change
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  // Scroll active command row into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const expandedHint = COMMANDS.find((c) => c.expandWith && query === c.expandWith)?.hint;
  const placeholder = expandedHint ?? "What do you want to do?";

  // Filtered & grouped commands
  const filteredCommands =
    activeCategory === "all"
      ? COMMANDS
      : COMMANDS.filter((c) => c.tabs.includes(activeCategory));

  const paramCmds     = filteredCommands.filter((c) => c.type === "param");
  const instantCmds   = filteredCommands.filter((c) => c.type === "instant");
  const portfolioCmds = filteredCommands.filter((c) => c.type === "portfolio");

  // Flat list for keyboard navigation (ordered same as visual rendering)
  const flatCmds =
    activeCategory === "all"
      ? [...paramCmds, ...instantCmds, ...portfolioCmds]
      : filteredCommands;

  const activateCommand = useCallback(
    (cmd: CommandEntry) => {
      if (cmd.expandWith) {
        setQuery(cmd.expandWith);
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        setQuery(cmd.label);
        void execute();
      }
    },
    [setQuery, execute],
  );

  const activateContextualCommand = useCallback(
    (label: string) => {
      let finalQuery = label;
      if (!hasOpenDoc && effectiveTarget) {
        if (label === "Generate acceptance criteria") {
          finalQuery = `Generate acceptance criteria for ${effectiveTarget.label}`;
        } else if (label === "What's missing from this spec?") {
          finalQuery = `What's missing from the '${effectiveTarget.label}' spec?`;
        } else {
          finalQuery = `${label} for ${effectiveTarget.label}`;
        }
      }
      setQuery(finalQuery);
      void execute();
    },
    [hasOpenDoc, effectiveTarget, setQuery, execute],
  );

  const handleSelectSpec = useCallback(
    (item: DocumentListItem) => {
      const spec: AttachedSpec = { id: item.id, label: item.title, docType: item.docType };
      setAttachedSpec(spec);
      setShowAttachment(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [setAttachedSpec],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatCmds.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        const cmd = flatCmds[activeIndex];
        if (cmd) activateCommand(cmd);
      } else if (query.trim()) {
        void execute();
      }
    }
  };

  const filteredSpecList = specList.filter(
    (s) =>
      attachQuery === "" ||
      s.title.toLowerCase().includes(attachQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(attachQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-(--glass-border) shrink-0">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "flex-1 bg-transparent text-sm outline-none",
            "placeholder:text-muted-foreground/50",
          )}
        />
        <button
          type="button"
          onClick={closePalette}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex h-[320px]">
        {/* Left icon rail */}
        <div className="w-[50px] border-r border-(--glass-border) flex flex-col items-center py-2 gap-0.5 shrink-0">
          <CategoryRailButton
            category={CATEGORIES[0]!}
            isActive={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          />
          {/* Thin rule separating All from lifecycle categories */}
          <div className="w-6 border-t border-(--glass-border) my-1" />
          {CATEGORIES.slice(1).map((cat) => (
            <CategoryRailButton
              key={cat.id}
              category={cat}
              isActive={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
            />
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Contextual section — fixed height */}
          <div className="h-[140px] border-b border-(--glass-border) flex flex-col shrink-0">
            {showAttachment ? (
              <AttachmentSection
                attachQuery={attachQuery}
                setAttachQuery={setAttachQuery}
                specList={filteredSpecList}
                onSelect={handleSelectSpec}
                showCancel={hasOpenDoc || attachedSpec !== null}
                onCancel={() => {
                  setShowAttachment(false);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              />
            ) : (
              <ContextSection
                target={effectiveTarget}
                onActivate={activateContextualCommand}
                onChangeClick={() => {
                  setAttachQuery("");
                  setShowAttachment(true);
                }}
              />
            )}
          </div>

          {/* Command list */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-2">
            {activeCategory === "all" ? (
              <>
                <CommandGroup
                  label="Needs input"
                  commands={paramCmds}
                  activeIndex={activeIndex}
                  globalOffset={0}
                  onActivate={activateCommand}
                  onHover={setActiveIndex}
                />
                <CommandGroup
                  label="Quick actions"
                  commands={instantCmds}
                  activeIndex={activeIndex}
                  globalOffset={paramCmds.length}
                  onActivate={activateCommand}
                  onHover={setActiveIndex}
                />
                <CommandGroup
                  label="Across all projects"
                  commands={portfolioCmds}
                  activeIndex={activeIndex}
                  globalOffset={paramCmds.length + instantCmds.length}
                  onActivate={activateCommand}
                  onHover={setActiveIndex}
                />
              </>
            ) : (
              <div className="space-y-0.5">
                {filteredCommands.map((cmd, idx) => (
                  <CommandRow
                    key={cmd.label}
                    cmd={cmd}
                    isActive={idx === activeIndex}
                    onActivate={() => activateCommand(cmd)}
                    onHover={() => setActiveIndex(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Freeform footer — always visible */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 border-t border-dashed border-(--glass-border) shrink-0",
          "text-muted-foreground/60 hover:text-muted-foreground text-xs transition-colors text-left",
        )}
      >
        <MessageCircle size={12} className="shrink-0" />
        <span>Ask anything about this project…</span>
      </button>
    </div>
  );
}

// ── Streaming phase ───────────────────────────────────────────────────────────

function StreamingPhase() {
  const { resolvedAction, streamedText, error, saveOutput, cancelStream, closePalette, _abortController } =
    usePaletteStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isStreaming = _abortController !== null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamedText]);

  const actionLabel =
    resolvedAction?.type === "draft-spec"
      ? `Drafting: "${resolvedAction.param ?? "spec"}"`
      : resolvedAction?.type === "reentry-brief"
        ? "Re-entry brief"
        : resolvedAction?.type === "update-current"
          ? "Updating current/"
          : resolvedAction?.type === "drift-detection"
            ? "Detecting drift"
            : resolvedAction?.type === "generate-ac"
              ? "Generating acceptance criteria"
              : resolvedAction?.type === "semantic-search"
                ? `Finding: "${resolvedAction.param ?? ""}"`
                : "Processing";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-(--glass-border) flex-shrink-0">
        {isStreaming && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        )}
        <span className="text-xs font-medium text-foreground/80 truncate">{actionLabel}</span>
      </div>

      <div
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-y-auto p-4 min-h-0"
      >
        {streamedText && (
          <MarkdownContent>{streamedText}</MarkdownContent>
        )}
        {isStreaming && (
          <span className="inline-block w-0.5 h-3.5 bg-primary align-middle ml-px animate-blink" />
        )}
      </div>

      {error && (
        <p className="px-4 pb-2 text-xs text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-(--glass-border) flex-shrink-0">
        <button
          type="button"
          onClick={isStreaming ? cancelStream : closePalette}
          className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {isStreaming ? "Cancel" : "Discard"}
        </button>
        {!isStreaming && resolvedAction?.type === "draft-spec" && (
          <button
            type="button"
            onClick={() => void saveOutput()}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Save draft
          </button>
        )}
        {!isStreaming && resolvedAction?.type !== "draft-spec" && (
          <button
            type="button"
            onClick={closePalette}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

// ── Diff view ─────────────────────────────────────────────────────────────────

function DiffColumn({
  lines,
  label,
}: {
  lines: DiffLine[];
  label: string;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-(--glass-border) flex-shrink-0">
        {label}
      </div>
      <div className="overflow-y-auto flex-1 p-2 font-mono text-[11px] leading-5">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "px-1 rounded-sm whitespace-pre-wrap break-words",
              line.kind === "added" && "bg-green-500/10 text-green-400",
              line.kind === "removed" && "bg-red-500/10 text-red-400 line-through opacity-60",
              line.kind === "same" && "text-foreground/70",
            )}
          >
            {line.kind === "added" && <span className="opacity-60 mr-1">+</span>}
            {line.kind === "removed" && <span className="opacity-60 mr-1">-</span>}
            {line.kind === "same" && <span className="opacity-0 mr-1">·</span>}
            {line.text || " "}
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffPhase() {
  const { diffBefore, diffAfter, applyDiff, closePalette, proposedText, targetPath } =
    usePaletteStore();
  const { loadDocument } = useEditorStore();

  const handleEditFirst = async () => {
    if (!proposedText || !targetPath) return;
    await invoke("write_document", { path: targetPath, content: proposedText });
    void loadDocument(targetPath, "spec");
    closePalette();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 border-b border-(--glass-border) flex-shrink-0">
        <span className="text-xs font-medium text-foreground/80">Review proposed changes</span>
      </div>

      <div className="flex flex-1 min-h-0 divide-x divide-(--glass-border)">
        <DiffColumn lines={diffBefore} label="Before" />
        <DiffColumn lines={diffAfter} label="After (proposed)" />
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-(--glass-border) flex-shrink-0">
        <button
          type="button"
          onClick={closePalette}
          className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={() => void handleEditFirst()}
          className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors text-sm"
        >
          Edit first
        </button>
        <button
          type="button"
          onClick={() => void applyDiff()}
          className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// ── AI unavailable ────────────────────────────────────────────────────────────

function AiUnavailableView() {
  const { closePalette } = usePaletteStore();

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
      <Sparkles size={24} className="text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">AI is not configured.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Set up a provider in Settings → AI to use these features.
        </p>
      </div>
      <button
        type="button"
        onClick={closePalette}
        className="mt-2 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-colors"
      >
        Close
      </button>
    </div>
  );
}

// ── Root palette ──────────────────────────────────────────────────────────────

export function AIPalette() {
  const { open, phase, aiConfig, aiConfigChecked, closePalette, cancelStream } =
    usePaletteStore();

  const handleBackdropClick = useCallback(() => {
    if (phase === "streaming" && usePaletteStore.getState()._abortController) {
      cancelStream();
    } else {
      closePalette();
    }
  }, [phase, closePalette, cancelStream]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (phase === "streaming" && usePaletteStore.getState()._abortController) {
          cancelStream();
        } else {
          closePalette();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open, phase, closePalette, cancelStream]);

  if (!open) return null;

  const showUnavailable = aiConfigChecked && aiConfig === null;

  const panelHeight =
    phase === "diff" ? "h-[60vh]" : phase === "streaming" ? "h-[70vh]" : "h-auto";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <div
        className={cn(
          "relative w-[600px] rounded-xl overflow-hidden flex flex-col",
          "border border-(--glass-border) shadow-(--glass-shadow)",
          "bg-card",
          panelHeight,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {showUnavailable ? (
          <AiUnavailableView />
        ) : phase === "input" ? (
          <InputPhase />
        ) : phase === "streaming" ? (
          <StreamingPhase />
        ) : (
          <DiffPhase />
        )}
      </div>
    </div>
  );
}
