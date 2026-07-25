import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label?: string;
}

interface SelectProps {
  options: string[] | SelectOption[];
  value: string | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function toOptions(raw: string[] | SelectOption[]): SelectOption[] {
  return (raw as Array<string | SelectOption>).map((o) =>
    typeof o === "string" ? { value: o } : o,
  );
}

// Scoped CSS — vars resolve through the [data-theme] cascade at paint time,
// bypassing Tailwind's --color-* naming requirement. Injected once per mount.
//
// var(--accent) = var(--color-surface) in all themes, which is identical to the
// popup background — invisible as a hover. A foreground-tinted overlay works
// across both light and dark themes without needing per-theme values.
const ITEM_STYLES = `
  .gs-item { color: var(--foreground); }
  .gs-item[data-highlighted] {
    background-color: color-mix(in srgb, var(--foreground) 8%, transparent);
    color: var(--foreground);
  }
  .gs-item[data-selected] { color: var(--primary); }
  .gs-item[data-selected][data-highlighted] { color: var(--primary); }
`;

export function Select({ options, value, onValueChange, placeholder, className }: SelectProps) {
  const opts = toOptions(options);

  return (
    <BaseSelect.Root
      value={value ?? null}
      onValueChange={(v) => { if (v !== null) onValueChange(v); }}
    >
      <BaseSelect.Trigger
        className={cn(
          "flex w-full items-center justify-between gap-1.5",
          "rounded-md px-2 py-1 text-[10px] capitalize",
          "border border-border/50 bg-muted/30",
          "cursor-default select-none focus:outline-none transition-colors",
          "hover:border-border/80 data-popup-open:border-ring/60",
          className,
        )}
        style={{ color: "var(--foreground)" }}
      >
        <BaseSelect.Value
          className="capitalize"
          placeholder={
            <span
              className="normal-case"
              style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
            >
              {placeholder ?? "—"}
            </span>
          }
        />
        <BaseSelect.Icon
          className="flex-shrink-0 transition-transform duration-150 data-popup-open:rotate-180"
          style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
        >
          <ChevronDown size={10} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>

      <BaseSelect.Portal>
        <BaseSelect.Positioner side="bottom" align="start" sideOffset={4}>
          <BaseSelect.Popup
            style={{
              // 90% card keeps items readable against any backdrop; blur adds glass depth
              backgroundColor: "color-mix(in srgb, var(--card) 90%, transparent)",
              backdropFilter: "blur(var(--glass-blur, 12px))",
              WebkitBackdropFilter: "blur(var(--glass-blur, 12px))",
              minWidth: "var(--anchor-width)",
              // Stacked shadows: thin outline ring + depth shadow
              boxShadow: "0 0 0 1px var(--glass-border), var(--glass-shadow)",
            }}
            className={cn(
              "z-50 min-w-24 overflow-hidden rounded-md",
              "origin-(--transform-origin)",
              "transition-[opacity,scale] duration-150",
              "data-starting-style:opacity-0 data-starting-style:scale-95",
              "data-ending-style:opacity-0 data-ending-style:scale-95",
            )}
          >
            {/* Scoped styles — injected inside the portal so they travel with the popup */}
            <style>{ITEM_STYLES}</style>
            <BaseSelect.List className="py-1 max-h-52 overflow-y-auto">
              {opts.map((opt) => (
                <BaseSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className="gs-item flex items-center gap-2 px-2 py-1.5 text-[10px] capitalize cursor-default select-none outline-none transition-colors"
                >
                  <BaseSelect.ItemIndicator
                    className="w-3 flex-shrink-0 flex items-center"
                    style={{ color: "var(--primary)" }}
                  >
                    <Check size={9} />
                  </BaseSelect.ItemIndicator>
                  <BaseSelect.ItemText>{opt.label ?? opt.value}</BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
