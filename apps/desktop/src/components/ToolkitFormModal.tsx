import { Globe, Monitor, Smartphone, Terminal, Zap, Package2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToolkitStore } from "@/stores/toolkitStore";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogClose,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { GlassRadioGroup } from "@/components/ui/radio-group";
import { GlassCheckboxGroup } from "@/components/ui/checkbox-group";
import type { ReactNode } from "react";
import type { ToolkitTools } from "@/stores/toolkitStore";

// ── Constants ────────────────────────────────────────────────────────────────

const KNOWN_RUNTIMES = ["node", "rust", "python", "go", "bun", "ruby", "java", "dotnet"] as const;
const KNOWN_APP_TYPES = ["desktop", "web", "cli", "api", "mobile", "library"] as const;
const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;

type AppType = typeof KNOWN_APP_TYPES[number];

const DESIGN_SYSTEM_TYPES = new Set<string>(["web", "desktop", "mobile"]);

const APP_TYPE_ICONS: Record<AppType, ReactNode> = {
  desktop: <Monitor size={11} />,
  web:     <Globe size={11} />,
  cli:     <Terminal size={11} />,
  api:     <Zap size={11} />,
  mobile:  <Smartphone size={11} />,
  library: <Package2 size={11} />,
};

const APP_TYPE_OPTIONS = KNOWN_APP_TYPES.map((t) => ({
  value: t,
  label: t,
  icon: APP_TYPE_ICONS[t],
}));

// ── Styles ───────────────────────────────────────────────────────────────────

const inputCn = cn(
  "w-full rounded-md border bg-card/30 px-3 py-1.5",
  "text-xs text-foreground placeholder:text-muted-foreground/40",
  "focus:outline-none focus:ring-1 focus:border-primary/40 focus:ring-primary/20",
  "border-border/50 transition-colors",
);

// ── Sub-components ───────────────────────────────────────────────────────────

function FormField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {hint !== undefined && (
          <span className="text-[10px] text-muted-foreground/50">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 whitespace-nowrap">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/30" />
    </div>
  );
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateId(id: string): string | null {
  if (!id.trim()) return "Preset id is required";
  if (/[/\\:*?"<>|\s]/.test(id)) return "No spaces or special characters";
  return null;
}

// ── ToolkitFormModal ─────────────────────────────────────────────────────────

export function ToolkitFormModal() {
  const {
    formOpen,
    formMode,
    formInput,
    formSaving,
    formError,
    closeForm,
    setFormField,
    setToolField,
    saveForm,
  } = useToolkitStore();

  const idError = formInput.id ? validateId(formInput.id) : null;
  const showDesignSystem =
    formInput.app_type !== undefined &&
    DESIGN_SYSTEM_TYPES.has(formInput.app_type);

  return (
    <DialogRoot open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader
          title={formMode === "add" ? "Add toolkit preset" : `Edit preset: ${formInput.id}`}
          description={
            formInput.id.trim()
              ? `~/.curaye/shared/stack/${formInput.id}.md`
              : "~/.curaye/shared/stack/"
          }
          onClose={closeForm}
        />

        <div className="space-y-4 p-5 pb-4 max-h-[72vh] overflow-y-auto">

          {/* ── Identity ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Title">
              <input
                type="text"
                value={formInput.title}
                onChange={(e) => setFormField("title", e.target.value)}
                className={inputCn}
                placeholder="Tauri + React"
              />
            </FormField>

            <FormField label="ID / slug">
              <input
                type="text"
                value={formInput.id}
                onChange={(e) => setFormField("id", e.target.value)}
                className={cn(
                  inputCn,
                  idError !== null &&
                    "border-destructive/50 focus:border-destructive/60 focus:ring-destructive/20",
                )}
                placeholder="tauri-react"
                disabled={formMode === "edit"}
              />
              {idError !== null && (
                <p className="mt-1 text-[10px] text-destructive">{idError}</p>
              )}
            </FormField>
          </div>

          {/* ── Environment ──────────────────────────────────────────────── */}
          <SectionDivider label="Environment" />

          <FormField label="Runtime(s)">
            <GlassCheckboxGroup
              options={[...KNOWN_RUNTIMES]}
              value={formInput.runtime}
              onValueChange={(v) => setFormField("runtime", v)}
              columns={4}
            />
          </FormField>

          {/* ── App type ─────────────────────────────────────────────────── */}
          <FormField label="App type">
            <GlassRadioGroup
              options={APP_TYPE_OPTIONS}
              value={formInput.app_type as AppType | undefined}
              onValueChange={(v) => setFormField("app_type", v)}
              columns={3}
            />
          </FormField>

          {/* ── Stack ────────────────────────────────────────────────────── */}
          <SectionDivider label="Stack" />

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Package manager">
              <Select
                options={[...PACKAGE_MANAGERS]}
                value={formInput.tools.package_manager}
                onValueChange={(v) => setToolField("package_manager", v)}
                placeholder="Select…"
              />
            </FormField>

            <FormField label="Frameworks" hint="comma-separated">
              <input
                type="text"
                value={formInput.framework.join(", ")}
                onChange={(e) =>
                  setFormField(
                    "framework",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                className={inputCn}
                placeholder="react, tauri"
              />
            </FormField>
          </div>

          {/* Design system — only for web, desktop, mobile */}
          {showDesignSystem && (
            <FormField label="Design system" hint="web · desktop · mobile">
              <input
                type="text"
                value={formInput.design_system ?? ""}
                onChange={(e) =>
                  setFormField("design_system", e.target.value || undefined)
                }
                className={inputCn}
                placeholder="shadcn/ui, MUI, Radix UI…"
              />
            </FormField>
          )}

          {/* ── Starter kit ──────────────────────────────────────────────── */}
          <SectionDivider label="Starter kit" />

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name">
              <input
                type="text"
                value={formInput.starter_kit ?? ""}
                onChange={(e) =>
                  setFormField("starter_kit", e.target.value || undefined)
                }
                className={inputCn}
                placeholder="create-tauri-app"
              />
            </FormField>

            <FormField label="Command">
              <input
                type="text"
                value={formInput.starter_kit_cmd ?? ""}
                onChange={(e) =>
                  setFormField("starter_kit_cmd", e.target.value || undefined)
                }
                className={cn(
                  inputCn,
                  !formInput.starter_kit && "opacity-40 cursor-not-allowed",
                )}
                placeholder="npx create-tauri-app"
                disabled={!formInput.starter_kit}
              />
            </FormField>
          </div>

          {/* ── Tools ────────────────────────────────────────────────────── */}
          <SectionDivider label="Tools" />

          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { key: "formatter", label: "Formatter",   placeholder: "prettier, biome" },
                { key: "linter",    label: "Linter",      placeholder: "eslint, clippy" },
                { key: "test",      label: "Test runner", placeholder: "vitest, cargo test" },
                { key: "e2e",       label: "E2E runner",  placeholder: "playwright, cypress" },
              ] as const satisfies { key: keyof ToolkitTools; label: string; placeholder: string }[]
            ).map(({ key, label, placeholder }) => (
              <FormField key={key} label={label}>
                <input
                  type="text"
                  value={formInput.tools[key] ?? ""}
                  onChange={(e) => setToolField(key, e.target.value)}
                  className={inputCn}
                  placeholder={placeholder}
                />
              </FormField>
            ))}
          </div>

          {/* ── Notes ────────────────────────────────────────────────────── */}
          <SectionDivider label="Notes" />

          <textarea
            value={formInput.body}
            onChange={(e) => setFormField("body", e.target.value)}
            rows={3}
            className={cn(
              inputCn,
              "resize-y font-mono text-[10px] leading-relaxed",
            )}
            placeholder="> Add rationale and notes here."
            spellCheck={false}
          />

          {/* ── Error ────────────────────────────────────────────────────── */}
          {formError !== null && (
            <p className="rounded-md border border-destructive/20 bg-destructive/8 px-3 py-2 text-xs text-destructive">
              {formError}
            </p>
          )}

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-2 pt-1 pb-1">
            <DialogClose
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
              onClick={closeForm}
            >
              Cancel
            </DialogClose>
            <button
              type="button"
              onClick={() => void saveForm()}
              disabled={formSaving || idError !== null || !formInput.id.trim()}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {formSaving
                ? "Saving…"
                : formMode === "add"
                  ? "Add preset"
                  : "Save changes"}
            </button>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
