import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, disabled, className }: SwitchProps) {
  return (
    <BaseSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "data-checked:bg-primary data-unchecked:bg-muted",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <BaseSwitch.Thumb
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow transition-transform",
          "data-checked:translate-x-4.5 data-unchecked:translate-x-0.5",
        )}
      />
    </BaseSwitch.Root>
  );
}
