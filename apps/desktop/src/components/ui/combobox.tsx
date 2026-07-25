import { useRef, useState } from "react";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Scoped item styles — injected inside the portal so they travel with the popup.
// Uses CSS var cascade (same approach as select.tsx).
const ITEM_STYLES = `
  .cbx-item { color: var(--foreground); }
  .cbx-item[data-highlighted] {
    background-color: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }
  .cbx-item[data-selected] { color: var(--primary); }
  .cbx-item[data-selected][data-highlighted] { color: var(--primary); }
`;

const POPUP_STYLE: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--card) 90%, transparent)",
  backdropFilter: "blur(var(--glass-blur, 12px))",
  WebkitBackdropFilter: "blur(var(--glass-blur, 12px))",
  minWidth: "var(--anchor-width)",
  boxShadow: "0 0 0 1px var(--glass-border), var(--glass-shadow)",
};

const POPUP_CLASS = cn(
  "z-50 overflow-hidden rounded-md",
  "origin-(--transform-origin)",
  "transition-[opacity,scale] duration-150",
  "data-starting-style:opacity-0 data-starting-style:scale-95",
  "data-ending-style:opacity-0 data-ending-style:scale-95",
);

const ITEM_CLASS =
  "cbx-item flex items-center gap-2 px-2 py-1.5 text-[10px] cursor-default select-none outline-none transition-colors";

function InputGroup({
  children,
  isHighlighted,
  className,
}: {
  children: React.ReactNode;
  isHighlighted?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <BaseCombobox.InputGroup
      className={cn(
        "flex flex-wrap items-center gap-1 w-full min-w-0 overflow-hidden rounded-md px-2 py-1 min-h-[26px]",
        "border border-border/50 bg-muted/30 transition-colors",
        "hover:border-border/80 focus-within:border-ring/60",
        isHighlighted && "ring-2 ring-destructive",
        className,
      )}
      style={{ color: "var(--foreground)" }}
    >
      {children}
    </BaseCombobox.InputGroup>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <BaseCombobox.Chip
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
      style={{
        backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
        color: "var(--primary)",
      }}
    >
      {label}
      <BaseCombobox.ChipRemove
        aria-label={`Remove ${label}`}
        className="opacity-60 hover:opacity-100 leading-none flex items-center"
        onClick={onRemove}
      >
        <X size={8} />
      </BaseCombobox.ChipRemove>
    </BaseCombobox.Chip>
  );
}

// ── TagCombobox — creatable multi-combobox for free-form string tags ──────────

export interface TagComboboxProps {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
  isHighlighted?: boolean | undefined;
}

export function TagCombobox({
  values,
  onChange,
  placeholder,
  className,
  isHighlighted,
}: TagComboboxProps) {
  const [inputValue, setInputValue] = useState("");
  const highlightedRef = useRef<string | undefined>(undefined);

  const trimmed = inputValue.trim();
  const items = trimmed && !values.includes(trimmed) ? [trimmed] : [];

  const createTag = (tag: string) => {
    if (tag && !values.includes(tag)) {
      onChange([...values, tag]);
    }
    setInputValue("");
  };

  return (
    <BaseCombobox.Root
      multiple
      items={items}
      value={values}
      onValueChange={(selected) => {
        onChange(selected);
        setInputValue("");
      }}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      onItemHighlighted={(item) => {
        highlightedRef.current = item;
      }}
      filter={null}
    >
      <InputGroup isHighlighted={isHighlighted} className={className}>
        <BaseCombobox.Chips className="flex flex-wrap items-center gap-1 w-full">
          <BaseCombobox.Value>
            {(selected: string[]) => (
              <>
                {selected.map((tag) => (
                  <Chip key={tag} label={tag} />
                ))}
                <BaseCombobox.Input
                  aria-label="Add tag"
                  placeholder={selected.length === 0 ? placeholder : undefined}
                  className="flex-1 min-w-0 bg-transparent text-[10px] outline-none placeholder:opacity-50"
                  style={{ color: "var(--foreground)" }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === ",") && !highlightedRef.current) {
                      e.preventDefault();
                      createTag(trimmed);
                    }
                  }}
                />
              </>
            )}
          </BaseCombobox.Value>
        </BaseCombobox.Chips>
      </InputGroup>

      <BaseCombobox.Portal>
        <BaseCombobox.Positioner side="bottom" align="start" sideOffset={4}>
          <BaseCombobox.Popup className={POPUP_CLASS} style={POPUP_STYLE}>
            <style>{ITEM_STYLES}</style>
            <BaseCombobox.List className="py-1">
              {(item: string) => (
                <BaseCombobox.Item value={item} className={ITEM_CLASS}>
                  <span
                    className="w-3 flex-shrink-0 flex items-center"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <Plus size={9} />
                  </span>
                  Add "{item}"
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
            <BaseCombobox.Empty
              className="px-2 py-1.5 text-[10px]"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            >
              Type to add a tag
            </BaseCombobox.Empty>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}

// ── MultiCombobox — filterable multi-select from a predefined string list ─────

export interface MultiComboboxProps {
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
  isHighlighted?: boolean | undefined;
  emptyText?: string | undefined;
}

export function MultiCombobox({
  options,
  values,
  onChange,
  placeholder,
  className,
  isHighlighted,
  emptyText = "No matches",
}: MultiComboboxProps) {
  return (
    <BaseCombobox.Root
      multiple
      items={options}
      value={values}
      onValueChange={onChange}
    >
      <InputGroup isHighlighted={isHighlighted} className={className}>
        <BaseCombobox.Chips className="flex flex-wrap items-center gap-1 w-full">
          <BaseCombobox.Value>
            {(selected: string[]) => (
              <>
                {selected.map((id) => (
                  <Chip key={id} label={id} />
                ))}
                <BaseCombobox.Input
                  aria-label="Filter options"
                  placeholder={selected.length === 0 ? placeholder : undefined}
                  className="flex-1 min-w-0 bg-transparent text-[10px] outline-none placeholder:opacity-50"
                  style={{ color: "var(--foreground)" }}
                />
              </>
            )}
          </BaseCombobox.Value>
        </BaseCombobox.Chips>
      </InputGroup>

      <BaseCombobox.Portal>
        <BaseCombobox.Positioner side="bottom" align="start" sideOffset={4}>
          <BaseCombobox.Popup className={POPUP_CLASS} style={POPUP_STYLE}>
            <style>{ITEM_STYLES}</style>
            <BaseCombobox.List className="py-1 max-h-52 overflow-y-auto">
              {(item: string) => (
                <BaseCombobox.Item value={item} className={ITEM_CLASS}>
                  <BaseCombobox.ItemIndicator
                    className="w-3 flex-shrink-0 flex items-center"
                    style={{ color: "var(--primary)" }}
                  >
                    <Check size={9} />
                  </BaseCombobox.ItemIndicator>
                  {item}
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
            <BaseCombobox.Empty
              className="px-2 py-1.5 text-[10px]"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            >
              {emptyText}
            </BaseCombobox.Empty>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
