import { CheckboxGroup as BaseCheckboxGroup } from "@base-ui/react/checkbox-group";
import { Checkbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxGroupOption {
  value: string;
  label?: string;
}

interface GlassCheckboxGroupProps {
  options: CheckboxGroupOption[] | string[];
  value: string[];
  onValueChange: (values: string[]) => void;
  columns?: 2 | 3 | 4;
  className?: string;
}

function toOpts(raw: string[] | CheckboxGroupOption[]): CheckboxGroupOption[] {
  return (raw as Array<string | CheckboxGroupOption>).map((o) =>
    typeof o === "string" ? { value: o } : o,
  );
}

export function GlassCheckboxGroup({
  options,
  value,
  onValueChange,
  columns = 3,
  className,
}: GlassCheckboxGroupProps) {
  const opts = toOpts(options);

  return (
    <BaseCheckboxGroup
      value={value}
      onValueChange={(v) => onValueChange(v)}
      className={cn(
        "grid gap-1",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-4",
        className,
      )}
    >
      {opts.map((opt) => (
        <Checkbox.Root
          key={opt.value}
          value={opt.value}
          className={cn(
            "group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
            "cursor-default select-none transition-colors",
            // Glassmorphic base
            "border-border/40 bg-card/20 text-muted-foreground",
            "hover:border-border/70 hover:bg-card/40 hover:text-foreground",
            // Checked state
            "data-checked:border-primary/50 data-checked:bg-primary/8 data-checked:text-primary",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          )}
        >
          {/* Checkbox tick box — styled via group-data-checked */}
          <span
            className={cn(
              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
              "border-muted-foreground/40 bg-transparent",
              "group-data-checked:border-primary group-data-checked:bg-primary/20",
            )}
          >
            <Check
              size={8}
              className="text-primary opacity-0 transition-opacity group-data-checked:opacity-100"
            />
          </span>
          <span className="font-medium capitalize">{opt.label ?? opt.value}</span>
        </Checkbox.Root>
      ))}
    </BaseCheckboxGroup>
  );
}
