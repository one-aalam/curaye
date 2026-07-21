interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}

export function ProgressRing({ value, size = 36, strokeWidth = 4.5, color = "var(--color-primary)", className }: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (value / 100) * circ;
  const cx = size / 2;

  return (
    <svg width={size} height={size} style={{ overflow: "visible" }} className={className}>
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="rgba(0,0,0,0.5)"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={dash}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
      />
    </svg>
  );
}
