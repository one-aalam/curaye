import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface RadioGroupOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface GlassRadioGroupProps<T extends string> {
  options: RadioGroupOption<T>[];
  value: T | undefined;
  onValueChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function GlassRadioGroup<T extends string>({
  options,
  value,
  onValueChange,
  columns = 1,
  className,
}: GlassRadioGroupProps<T>) {
  return (
    <BaseRadioGroup
      value={value ?? ""}
      onValueChange={(v) => { if (v) onValueChange(v as T); }}
      className={cn(
        "grid gap-1",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        className,
      )}
    >
      {options.map((opt) => (
        <Radio.Root
          key={String(opt.value)}
          value={opt.value}
          className={cn(
            "group flex items-center gap-2.5 rounded-md border px-3 py-2 text-xs",
            "cursor-default select-none transition-colors",
            // Glassmorphic base — semi-transparent so it reads as a glass card
            "border-border/40 bg-card/20 text-muted-foreground",
            "hover:border-border/70 hover:bg-card/40 hover:text-foreground",
            // Selected state via data attribute set by base-ui
            "data-checked:border-primary/50 data-checked:bg-primary/8 data-checked:text-primary",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          )}
        >
          {/* Radio circle — styled via group-data-checked on parent */}
          <span
            className={cn(
              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-all",
              "border-muted-foreground/40",
              "group-data-checked:border-primary group-data-checked:bg-primary/20",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary scale-0 transition-transform group-data-checked:scale-100" />
          </span>
          {opt.icon !== undefined && (
            <span className="flex-shrink-0 opacity-60 transition-opacity group-data-checked:opacity-100">
              {opt.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <span className="font-medium capitalize">{opt.label}</span>
            {opt.description !== undefined && (
              <span className="ml-1.5 text-[10px] opacity-60">{opt.description}</span>
            )}
          </div>
        </Radio.Root>
      ))}
    </BaseRadioGroup>
  );
}
