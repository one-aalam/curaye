import { cn } from "@/lib/utils";

interface ColorSwatchProps {
  color: string;
  selected: boolean;
  onSelect: () => void;
  label?: string;
  className?: string;
}

export function ColorSwatch({ color, selected, onSelect, label, className }: ColorSwatchProps) {
  return (
    <button
      type="button"
      title={label}
      onClick={onSelect}
      className={cn(
        "h-5 w-5 rounded-full transition-transform hover:scale-110",
        selected
          ? "ring-2 ring-primary ring-offset-1 ring-offset-card"
          : "ring-1 ring-black/10",
        className,
      )}
      style={{ background: color }}
    />
  );
}
