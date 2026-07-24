import { useRef, useCallback, useEffect } from "react";
import { Search, X, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchStore, type SearchHit } from "@/stores/searchStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTreeStore } from "@/stores/treeStore";

// ── Star score ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="w-12 h-1 rounded-full bg-border/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-color-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground/50 w-6 text-right">{pct}%</span>
    </div>
  );
}

// ── Result item ───────────────────────────────────────────────────────────────

function ResultItem({ hit }: { hit: SearchHit }) {
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const selectDocument = useTreeStore((s) => s.selectDocument);
  const clearSearch = useSearchStore((s) => s.clearSearch);

  const docType =
    hit.type === "planned" ? "spec" :
    hit.type === "decisions" ? "decision" :
    hit.type === "shipped" ? "spec" : "current";

  const handleClick = () => {
    selectDocument(hit.filePath);
    void loadDocument(hit.filePath, docType);
    clearSearch();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent/50 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-foreground truncate">{hit.title || hit.filePath.split("/").pop()}</p>
          <p className="text-[9px] text-muted-foreground/60 mt-0.5">
            {hit.projectId} / {hit.type}
          </p>
          {hit.snippet && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-2 leading-snug">
              {hit.snippet}
            </p>
          )}
        </div>
        {hit.score > 0 && <ScoreBar score={hit.score} />}
      </div>
    </button>
  );
}

// ── Search bar ────────────────────────────────────────────────────────────────

const TYPE_FILTERS: { label: string; value: string | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Planned", value: "planned" },
  { label: "Current", value: "current" },
  { label: "Decisions", value: "decisions" },
  { label: "Shipped", value: "shipped" },
];

export function SearchBar() {
  const { query, hits, loading, mode, stale, allProjects, active, typeFilter, setQuery, setAllProjects, setTypeFilter, runSearch, clearSearch } =
    useSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void runSearch(val);
      }, 350);
    },
    [setQuery, runSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSearch();
        inputRef.current?.blur();
      }
    },
    [clearSearch],
  );

  // Close on Escape globally when active
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSearch();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, clearSearch]);

  return (
    <div className="flex-shrink-0">
      {/* Input row */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30">
        <Search size={11} className="text-muted-foreground/50 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search docs…"
          className={cn(
            "flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/40",
            "outline-none border-none min-w-0",
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => { clearSearch(); inputRef.current?.focus(); }}
            className="text-muted-foreground/40 hover:text-muted-foreground/70 flex-shrink-0"
          >
            <X size={10} />
          </button>
        )}
        <button
          type="button"
          onClick={() => { setAllProjects(!allProjects); if (query) void runSearch(query); }}
          title={allProjects ? "All projects" : "Current project only"}
          className={cn(
            "flex-shrink-0 p-0.5 rounded transition-colors",
            allProjects
              ? "text-color-accent"
              : "text-muted-foreground/30 hover:text-muted-foreground/60",
          )}
        >
          <Globe size={10} />
        </button>
      </div>

      {/* Type filter chips */}
      {active && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-border/30 overflow-x-auto">
          {TYPE_FILTERS.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                setTypeFilter(value);
                if (query) void runSearch(query);
              }}
              className={cn(
                "flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] transition-colors",
                typeFilter === value
                  ? "bg-color-accent/20 text-color-accent"
                  : "text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-accent/30",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Results panel */}
      {active && (
        <div className="border-b border-border/30 max-h-72 overflow-y-auto">
          {loading && (
            <p className="px-3 py-2 text-[10px] text-muted-foreground/50">Searching…</p>
          )}
          {!loading && hits.length === 0 && query && (
            <p className="px-3 py-2 text-[10px] text-muted-foreground/50">
              No results for &ldquo;{query}&rdquo;
              {mode === "keyword" ? " (keyword)" : ""}.
            </p>
          )}
          {!loading && hits.length > 0 && (
            <div className="p-1">
              <p className="px-2 py-0.5 text-[9px] text-muted-foreground/40 uppercase tracking-wider">
                {hits.length} result{hits.length === 1 ? "" : "s"} · {mode}
              </p>
              {hits.map((hit) => (
                <ResultItem key={hit.filePath} hit={hit} />
              ))}
              {stale && (
                <p className="px-2 py-1 text-[9px] text-amber-400/70 italic">
                  Index is stale — run <code>curaye index</code> for complete semantic results.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
