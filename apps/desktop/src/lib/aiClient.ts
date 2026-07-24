import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface AiProviderConfig {
  kind: "anthropic" | "ollama" | "openai";
  apiKey?: string;
  model: string;
  baseUrl?: string;
  embedProvider?: "ollama" | "openai";
  embedModel?: string;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function fetchAiConfig(): Promise<AiProviderConfig | null> {
  return invoke<AiProviderConfig | null>("get_ai_config");
}

export async function fetchEmbedding(
  config: AiProviderConfig,
  text: string,
): Promise<number[]> {
  const provider = config.embedProvider ?? (config.kind !== "anthropic" ? config.kind : null);
  const model = config.embedModel ?? config.model;

  if (provider === "ollama") {
    const baseUrl = (config.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: HTTP ${res.status}`);
    const data = await res.json() as { embedding: number[] };
    return data.embedding;
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey ?? ""}`,
      },
      body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) throw new Error(`OpenAI embed failed: HTTP ${res.status}`);
    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0]?.embedding ?? [];
  }

  throw new Error("No embedding provider available (Anthropic does not support embeddings)");
}

type StreamEvent =
  | { type: "Token"; payload: string }
  | { type: "Done" }
  | { type: "Error"; payload: string };

// Streams tokens from the Rust backend via Tauri events.
// The Rust backend makes the HTTP request directly, bypassing WebView header restrictions.
export async function* streamCompletion(
  config: AiProviderConfig,
  messages: AiMessage[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  const queue: StreamEvent[] = [];
  let notify: (() => void) | null = null;

  const push = (ev: StreamEvent) => {
    queue.push(ev);
    if (notify) { notify(); notify = null; }
  };

  const unlisten = await listen<StreamEvent>("ai-stream", (e) => {
    push(e.payload);
  });

  const onAbort = () => {
    push({ type: "Done" });
    void invoke("cancel_ai_stream");
  };
  signal.addEventListener("abort", onAbort);

  try {
    await invoke("start_ai_stream", { config, messages });

    while (true) {
      if (queue.length === 0) {
        await new Promise<void>((r) => { notify = r; });
      }
      const ev = queue.shift()!;
      if (ev.type === "Done") return;
      if (ev.type === "Error") throw new Error(ev.payload);
      yield ev.payload;
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
    unlisten();
  }
}
