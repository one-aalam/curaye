/**
 * Canonical spec-status colour map. All components that render a status badge
 * must use these helpers — never define a local STATUS_COLORS map.
 * See .curaye/conventions.md → "Spec status colours".
 */

/** CSS classes for a filled badge (text + background). */
const STATUS_BADGE: Record<string, string> = {
  draft:    "text-[var(--status-draft-color)] bg-[var(--status-draft-surface)]",
  ready:    "text-[var(--status-ready-color)] bg-[var(--status-ready-surface)]",
  building: "text-[var(--status-building-color)] bg-[var(--status-building-surface)]",
  done:     "text-[var(--status-done-color)] bg-[var(--status-done-surface)]",
  shelved:  "text-[var(--status-shelved-color)] bg-[var(--status-shelved-surface)]",
};

/** CSS classes for a bordered chip (text + background + border). */
const STATUS_CHIP: Record<string, string> = {
  draft:    "text-[var(--status-draft-color)] bg-[var(--status-draft-surface)] border-[var(--status-draft-border)]",
  ready:    "text-[var(--status-ready-color)] bg-[var(--status-ready-surface)] border-[var(--status-ready-border)]",
  building: "text-[var(--status-building-color)] bg-[var(--status-building-surface)] border-[var(--status-building-border)]",
  done:     "text-[var(--status-done-color)] bg-[var(--status-done-surface)] border-[var(--status-done-border)]",
  shelved:  "text-[var(--status-shelved-color)] bg-[var(--status-shelved-surface)] border-[var(--status-shelved-border)]",
};

const BADGE_FALLBACK = "text-muted-foreground bg-muted/60";
const CHIP_FALLBACK  = "text-muted-foreground bg-muted/60 border-muted-foreground/20";

/** Returns badge classes (text + bg) for a given status. */
export function statusBadgeClass(status: string | undefined): string {
  if (!status) return BADGE_FALLBACK;
  return STATUS_BADGE[status] ?? BADGE_FALLBACK;
}

/** Returns chip classes (text + bg + border) for a given status. */
export function statusChipClass(status: string | undefined): string {
  if (!status) return CHIP_FALLBACK;
  return STATUS_CHIP[status] ?? CHIP_FALLBACK;
}
