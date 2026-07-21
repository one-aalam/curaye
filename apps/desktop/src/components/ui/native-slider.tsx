import { cn } from "@/lib/utils";

interface NativeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onValueChange: (value: number) => void;
  label?: string;
  className?: string;
}

export function NativeSlider({ min, max, step = 1, value, onValueChange, label, className }: NativeSliderProps) {
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onValueChange(step % 1 !== 0 ? parseFloat(e.target.value) : parseInt(e.target.value))}
      className={cn("w-full accent-primary", className)}
    />
  );
}
