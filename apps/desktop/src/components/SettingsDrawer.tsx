import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfigStore, type Theme, type UiFont } from "@/stores/configStore";
import { usePaletteStore } from "@/stores/paletteStore";
import { fetchAiConfig, type AiProviderConfig } from "@/lib/aiClient";
import {
  DrawerRoot,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ColorSwatch } from "@/components/ui/color-swatch";

// ── Theme section ─────────────────────────────────────────────────────────────

const THEMES: { id: Theme; label: string; color: string }[] = [
  { id: "raat",    label: "Raat",    color: "#f0a830" },
  { id: "neel",    label: "Neel",    color: "#00c8c8" },
  { id: "saffron", label: "Saffron", color: "#d4850a" },
  { id: "chaadar", label: "Chaadar", color: "#7c4dff" },
];

const UI_FONTS: { id: UiFont; label: string; sample: string }[] = [
  { id: "inter",         label: "Inter",         sample: "Ag" },
  { id: "dm-sans",       label: "DM Sans",       sample: "Ag" },
  { id: "work-sans",     label: "Work Sans",      sample: "Ag" },
  { id: "space-grotesk", label: "Space Grotesk",  sample: "Ag" },
];

const FONT_FAMILY: Record<UiFont, string> = {
  "inter":         "'Inter Variable', sans-serif",
  "dm-sans":       "'DM Sans Variable', sans-serif",
  "work-sans":     "'Work Sans Variable', sans-serif",
  "space-grotesk": "'Space Grotesk Variable', sans-serif",
};

function ThemeSection() {
  const { theme, setTheme, uiFont, setUiFont } = useConfigStore();

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Appearance
      </h3>
      <div className="flex items-center gap-3 mb-5">
        {THEMES.map((t) => (
          <div key={t.id} className="flex flex-col items-center gap-1.5">
            <ColorSwatch
              color={t.color}
              selected={theme === t.id}
              onSelect={() => setTheme(t.id)}
              label={t.label}
            />
            <span className="text-[9px] text-muted-foreground">{t.label}</span>
          </div>
        ))}
      </div>

      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        UI Font
      </h3>
      <div className="flex items-center gap-2">
        {UI_FONTS.map((f) => {
          const active = uiFont === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setUiFont(f.id)}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all border w-16",
                active
                  ? "bg-primary/10 border-primary/50 text-primary ring-1 ring-primary/30"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {active && (
                <Check
                  size={8}
                  className="absolute top-1 right-1 text-primary"
                  strokeWidth={3}
                />
              )}
              <span
                className="text-base leading-none"
                style={{ fontFamily: FONT_FAMILY[f.id] }}
              >
                {f.sample}
              </span>
              <span className="text-[9px] whitespace-nowrap">{f.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── AI section ────────────────────────────────────────────────────────────────

type ProviderKind = "anthropic" | "ollama" | "openai" | "";

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-5",
  ollama: "llama3",
  openai: "gpt-4o",
};

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_OPENAI_URL = "https://api.openai.com/v1";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-medium text-muted-foreground block mb-1">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-md px-2.5 py-1.5 text-xs bg-muted/30 border border-border/50",
        "focus:outline-none focus:border-ring/50 transition-colors",
        "placeholder:text-muted-foreground/40",
      )}
    />
  );
}

function MaskedInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-md px-2.5 py-1.5 pr-8 text-xs bg-muted/30 border border-border/50",
          "focus:outline-none focus:border-ring/50 transition-colors",
          "placeholder:text-muted-foreground/40",
        )}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff size={11} /> : <Eye size={11} />}
      </button>
    </div>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  ollama: "Ollama",
  openai: "OpenAI",
  "": "None",
};

function AiSection() {
  const refreshAiConfig = usePaletteStore((s) => s.refreshAiConfig);

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderKind>("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load current config when the section mounts
  useEffect(() => {
    fetchAiConfig()
      .then((cfg) => {
        if (!cfg) return;
        setProvider(cfg.kind);
        setModel(cfg.model);
        if (cfg.apiKey) setApiKey(cfg.apiKey);
        setBaseUrl(
          cfg.baseUrl ??
            (cfg.kind === "ollama" ? DEFAULT_OLLAMA_URL : cfg.kind === "openai" ? DEFAULT_OPENAI_URL : ""),
        );
      })
      .catch(() => setLoadError("Could not read current config."))
      .finally(() => setLoading(false));
  }, []);

  const handleProviderChange = (kind: ProviderKind) => {
    setProvider(kind);
    setModel(kind ? (DEFAULT_MODELS[kind] ?? "") : "");
    setApiKey("");
    setBaseUrl(kind === "ollama" ? DEFAULT_OLLAMA_URL : kind === "openai" ? DEFAULT_OPENAI_URL : "");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      let config: AiProviderConfig | null = null;
      if (provider) {
        config = {
          kind: provider,
          model: model.trim() || (DEFAULT_MODELS[provider] ?? ""),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(provider === "ollama"
            ? { baseUrl: baseUrl.trim() || DEFAULT_OLLAMA_URL }
            : provider === "openai" && baseUrl.trim() && baseUrl.trim() !== DEFAULT_OPENAI_URL
              ? { baseUrl: baseUrl.trim() }
              : {}),
        };
      }
      await invoke("write_ai_config", { config });
      await refreshAiConfig();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setLoadError("Failed to save config.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        AI Provider
      </h3>

      {loadError && (
        <p className="text-xs text-destructive mb-3">{loadError}</p>
      )}

      {/* Provider selector */}
      <div className="mb-4">
        <FieldLabel>Provider</FieldLabel>
        {loading ? (
          <div className="flex gap-1.5">
            {[80, 64, 56, 44].map((w) => (
              <div
                key={w}
                className="h-[26px] rounded animate-pulse bg-muted/40 border border-border/30"
                style={{ width: w }}
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            {(["anthropic", "ollama", "openai", ""] as ProviderKind[]).map((k) => {
              const active = provider === k;
              return (
                <button
                  key={k || "none"}
                  type="button"
                  onClick={() => handleProviderChange(k)}
                  className={cn(
                    "relative flex items-center gap-1 rounded px-2.5 py-1 text-[11px] border transition-all",
                    active
                      ? "border-primary/50 bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  {active && <Check size={9} strokeWidth={3} />}
                  {PROVIDER_LABELS[k]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {provider !== "" && (
        <div className="space-y-3">
          {/* API key — Anthropic & OpenAI */}
          {(provider === "anthropic" || provider === "openai") && (
            <div>
              <FieldLabel>
                API Key{provider === "openai" ? " (optional for local servers)" : ""}
              </FieldLabel>
              <MaskedInput
                value={apiKey}
                onChange={setApiKey}
                placeholder={provider === "anthropic" ? "sk-ant-…" : "sk-… (leave blank for local)"}
              />
            </div>
          )}

          {/* Base URL — Ollama and OpenAI-compatible */}
          {(provider === "ollama" || provider === "openai") && (
            <div>
              <FieldLabel>Base URL</FieldLabel>
              <TextInput
                value={baseUrl}
                onChange={setBaseUrl}
                placeholder={
                  provider === "ollama"
                    ? "http://localhost:11434"
                    : "https://api.openai.com/v1"
                }
              />
              {provider === "openai" && baseUrl !== DEFAULT_OPENAI_URL && baseUrl !== "" && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Using custom endpoint — compatible with Jan, LM Studio, and other OpenAI-compatible servers.
                </p>
              )}
            </div>
          )}

          {/* Model */}
          <div>
            <FieldLabel>Model</FieldLabel>
            <TextInput
              value={model}
              onChange={setModel}
              placeholder={DEFAULT_MODELS[provider] ?? "model-name"}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className={cn(
          "mt-4 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors",
          "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50",
        )}
      >
        {saved ? <Check size={12} /> : null}
        {saving ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
    </section>
  );
}

// ── Root drawer ───────────────────────────────────────────────────────────────

export function SettingsTrigger() {
  return (
    <DrawerRoot>
      <DrawerTrigger
        render={
          <button
            type="button"
            title="Settings"
            className={cn(
              "flex items-center justify-center rounded p-1.5",
              "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
            )}
          >
            <Settings size={13} />
          </button>
        }
      />
      <DrawerContent side="right" width="w-80">
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--glass-border)">
          <DrawerTitle className="text-sm font-semibold">Settings</DrawerTitle>
          <DrawerClose
            render={
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors text-xs"
              >
                ✕
              </button>
            }
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <ThemeSection />
          <div className="border-t border-border/30" />
          <AiSection />
        </div>
      </DrawerContent>
    </DrawerRoot>
  );
}
