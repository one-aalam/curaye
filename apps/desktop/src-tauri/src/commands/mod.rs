use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{command, Emitter};
use tauri_plugin_dialog::DialogExt;

// ── Registry types ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryProject {
    pub name: String,
    pub curaye_path: String,
    pub sync_status: Option<String>,
    pub ready_count: Option<u32>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct RegistryFile {
    projects: Vec<RegistryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RegistryEntry {
    name: String,
    path: String,
}

fn registry_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".curaye")
        .join("projects.yaml")
}

#[command]
pub async fn read_registry() -> Result<Vec<RegistryProject>, String> {
    let path = registry_path();
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())?;
    let file: RegistryFile = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
    let projects = file
        .projects
        .into_iter()
        .map(|e| RegistryProject {
            name: e.name,
            curaye_path: e.path,
            sync_status: None,
            ready_count: None,
        })
        .collect();
    Ok(projects)
}

#[command]
pub async fn write_registry(projects: Vec<RegistryProject>) -> Result<(), String> {
    let path = registry_path();
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    let entries: Vec<RegistryEntry> = projects
        .into_iter()
        .map(|p| RegistryEntry {
            name: p.name,
            path: p.curaye_path,
        })
        .collect();
    let file = RegistryFile { projects: entries };
    let yaml = serde_yaml::to_string(&file).map_err(|e| e.to_string())?;
    write_atomic(&path, yaml.as_bytes()).await
}

#[command]
pub async fn link_project(path: String) -> Result<(), String> {
    let dir = PathBuf::from(&path);
    let name = dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("project")
        .to_string();

    let curaye_path = dir.join(".curaye").to_string_lossy().to_string();

    let mut projects = read_registry().await?;
    if !projects.iter().any(|p| p.name == name) {
        projects.push(RegistryProject {
            name,
            curaye_path,
            sync_status: None,
            ready_count: None,
        });
        write_registry(projects).await?;
    }
    Ok(())
}

#[command]
pub async fn unlink_project(name: String) -> Result<(), String> {
    let mut projects = read_registry().await?;
    projects.retain(|p| p.name != name);
    write_registry(projects).await
}

// ── Document scanning ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub section: String,
    pub status: Option<String>,
    pub is_draft: bool,
    pub has_validation_error: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ProjectTree {
    pub planned: Vec<TreeNode>,
    pub current: Vec<TreeNode>,
    pub shipped: Vec<TreeNode>,
    pub decisions: Vec<TreeNode>,
    pub root: Vec<TreeNode>,
}

#[command]
pub async fn scan_project(curaye_path: String) -> Result<ProjectTree, String> {
    let base = PathBuf::from(&curaye_path);
    let mut tree = ProjectTree::default();

    scan_section(&base, "planned", &mut tree.planned).await;
    scan_section(&base, "current", &mut tree.current).await;
    scan_section(&base, "shipped", &mut tree.shipped).await;
    scan_section(&base, "decisions", &mut tree.decisions).await;

    for name in &["prd.md", "stack.md", "AGENTS.md"] {
        let path = base.join(name);
        if path.exists() {
            tree.root.push(TreeNode {
                name: name.to_string(),
                path: path.to_string_lossy().to_string(),
                section: "root".to_string(),
                status: None,
                is_draft: false,
                has_validation_error: false,
            });
        }
    }

    Ok(tree)
}

async fn scan_section(base: &Path, section: &str, nodes: &mut Vec<TreeNode>) {
    let dir = base.join(section);
    if !dir.is_dir() {
        return;
    }
    let Ok(mut entries) = tokio::fs::read_dir(&dir).await else {
        return;
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let is_draft = name.starts_with('_');

        let mut status = None;
        let mut has_validation_error = false;

        if let Ok(content) = tokio::fs::read_to_string(&path).await {
            let parsed = parse_frontmatter_quick(&content);
            status = parsed.get("status").and_then(|v| v.as_str()).map(|s| s.to_string());
            // basic validation: spec docs should have id, title, status
            if section == "planned" || section == "shipped" {
                let has_id = parsed.contains_key("id");
                let has_title = parsed.contains_key("title");
                if !has_id || !has_title || status.is_none() {
                    has_validation_error = true;
                }
            }
        }

        nodes.push(TreeNode {
            name,
            path: path.to_string_lossy().to_string(),
            section: section.to_string(),
            status,
            is_draft,
            has_validation_error,
        });
    }
    nodes.sort_by(|a, b| a.name.cmp(&b.name));
}

fn parse_frontmatter_quick(content: &str) -> BTreeMap<String, serde_yaml::Value> {
    let stripped = content.trim_start_matches('\u{feff}');
    if !stripped.starts_with("---") {
        return BTreeMap::new();
    }
    let rest = &stripped[3..];
    let end = rest.find("\n---").unwrap_or(0);
    let yaml_str = &rest[..end];
    serde_yaml::from_str(yaml_str).unwrap_or_default()
}

// ── Document read/write ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationIssue {
    pub field: String,
    pub message: String,
    pub severity: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ParsedDocument {
    pub frontmatter: BTreeMap<String, serde_json::Value>,
    pub body: String,
    pub raw: String,
    pub validation_issues: Vec<ValidationIssue>,
}

#[command]
pub async fn read_document(path: String, doc_type: String) -> Result<ParsedDocument, String> {
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())?;

    let (frontmatter, body) = split_frontmatter(&content);
    let mut issues = validate_document(&frontmatter, &doc_type);

    // Inject any existing validation errors from scan
    let fm_json: BTreeMap<String, serde_json::Value> = frontmatter
        .iter()
        .map(|(k, v)| {
            let json_val = match v {
                serde_yaml::Value::String(s) => serde_json::Value::String(s.clone()),
                serde_yaml::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        serde_json::Value::Number(i.into())
                    } else {
                        serde_json::Value::String(n.to_string())
                    }
                }
                serde_yaml::Value::Bool(b) => serde_json::Value::Bool(*b),
                serde_yaml::Value::Sequence(seq) => serde_json::Value::Array(
                    seq.iter()
                        .map(|item| {
                            serde_json::Value::String(
                                item.as_str().unwrap_or("").to_string(),
                            )
                        })
                        .collect(),
                ),
                serde_yaml::Value::Null => serde_json::Value::Null,
                _ => serde_json::Value::String(format!("{:?}", v)),
            };
            (k.clone(), json_val)
        })
        .collect();

    issues.dedup_by(|a, b| a.field == b.field && a.message == b.message);

    Ok(ParsedDocument {
        frontmatter: fm_json,
        body: body.trim_start_matches('\n').to_string(),
        raw: content,
        validation_issues: issues,
    })
}

fn split_frontmatter(content: &str) -> (BTreeMap<String, serde_yaml::Value>, String) {
    let stripped = content.trim_start_matches('\u{feff}');
    if !stripped.starts_with("---") {
        return (BTreeMap::new(), content.to_string());
    }
    let rest = &stripped[3..];
    if let Some(end) = rest.find("\n---") {
        let yaml_str = &rest[..end];
        let body = rest[end + 4..].to_string();
        let fm = serde_yaml::from_str(yaml_str).unwrap_or_default();
        (fm, body)
    } else {
        (BTreeMap::new(), content.to_string())
    }
}

fn validate_document(
    fm: &BTreeMap<String, serde_yaml::Value>,
    doc_type: &str,
) -> Vec<ValidationIssue> {
    let mut issues = vec![];
    if doc_type == "spec" {
        let required = ["id", "title", "status"];
        for field in &required {
            if !fm.contains_key(*field) {
                issues.push(ValidationIssue {
                    field: field.to_string(),
                    message: "Required field is missing".to_string(),
                    severity: "error".to_string(),
                });
            }
        }
    }
    issues
}

#[command]
pub async fn write_document(path: String, content: String) -> Result<(), String> {
    write_atomic(&PathBuf::from(path), content.as_bytes()).await
}

#[command]
pub async fn parse_raw(raw: String) -> Result<ParsedDocument, String> {
    read_document_from_string(raw, "spec")
}

fn read_document_from_string(content: String, doc_type: &str) -> Result<ParsedDocument, String> {
    let (frontmatter, body) = split_frontmatter(&content);
    let issues = validate_document(&frontmatter, doc_type);

    let fm_json: BTreeMap<String, serde_json::Value> = frontmatter
        .iter()
        .map(|(k, v)| {
            let json_val = yaml_to_json(v);
            (k.clone(), json_val)
        })
        .collect();

    Ok(ParsedDocument {
        frontmatter: fm_json,
        body: body.trim_start_matches('\n').to_string(),
        raw: content,
        validation_issues: issues,
    })
}

fn yaml_to_json(v: &serde_yaml::Value) -> serde_json::Value {
    match v {
        serde_yaml::Value::String(s) => serde_json::Value::String(s.clone()),
        serde_yaml::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                serde_json::Value::Number(i.into())
            } else {
                serde_json::Value::String(n.to_string())
            }
        }
        serde_yaml::Value::Bool(b) => serde_json::Value::Bool(*b),
        serde_yaml::Value::Sequence(seq) => {
            serde_json::Value::Array(seq.iter().map(yaml_to_json).collect())
        }
        serde_yaml::Value::Null => serde_json::Value::Null,
        serde_yaml::Value::Mapping(m) => {
            let obj: serde_json::Map<String, serde_json::Value> = m
                .iter()
                .filter_map(|(k, v)| k.as_str().map(|ks| (ks.to_string(), yaml_to_json(v))))
                .collect();
            serde_json::Value::Object(obj)
        }
        _ => serde_json::Value::String(format!("{:?}", v)),
    }
}

#[command]
pub async fn serialize_document(
    frontmatter: BTreeMap<String, serde_json::Value>,
    body: String,
) -> Result<String, String> {
    let yaml_fm: BTreeMap<String, serde_yaml::Value> = frontmatter
        .iter()
        .map(|(k, v)| (k.clone(), json_to_yaml(v)))
        .collect();

    let fm_yaml = serde_yaml::to_string(&yaml_fm).map_err(|e| e.to_string())?;
    let result = format!("---\n{}---\n\n{}", fm_yaml, body);
    Ok(result)
}

fn json_to_yaml(v: &serde_json::Value) -> serde_yaml::Value {
    match v {
        serde_json::Value::String(s) => serde_yaml::Value::String(s.clone()),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                serde_yaml::Value::Number(i.into())
            } else {
                serde_yaml::Value::String(n.to_string())
            }
        }
        serde_json::Value::Bool(b) => serde_yaml::Value::Bool(*b),
        serde_json::Value::Array(arr) => {
            serde_yaml::Value::Sequence(arr.iter().map(json_to_yaml).collect())
        }
        serde_json::Value::Null => serde_yaml::Value::Null,
        serde_json::Value::Object(m) => {
            let mapping: serde_yaml::Mapping = m
                .iter()
                .map(|(k, v)| {
                    (
                        serde_yaml::Value::String(k.clone()),
                        json_to_yaml(v),
                    )
                })
                .collect();
            serde_yaml::Value::Mapping(mapping)
        }
    }
}

// ── Create new document ───────────────────────────────────────────────────────

#[command]
pub async fn create_document(curaye_path: String, section: String) -> Result<String, String> {
    let dir = PathBuf::from(&curaye_path).join(&section);
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| e.to_string())?;

    let today = chrono_today();
    let filename = format!("_{}.md", today);
    let path = dir.join(&filename);

    let content = if section == "planned" {
        format!(
            "---\nid: \ntitle: \nstatus: draft\neffort: m\nimpact: medium\ndesire: medium\ncreated: {}\nupdated: {}\n---\n\n## Problem\n\n## Goal\n\n## Non-goals\n\n## Acceptance criteria\n",
            today, today
        )
    } else {
        format!("---\ntitle: \ncreated: {}\nupdated: {}\n---\n\n", today, today)
    };

    write_atomic(&path, content.as_bytes()).await?;
    Ok(path.to_string_lossy().to_string())
}

fn chrono_today() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = secs / 86400;
    // rough ISO date from epoch days (good enough for filenames)
    let y = 1970 + days / 365;
    let d_in_y = days % 365;
    let m = (d_in_y / 30) + 1;
    let d = (d_in_y % 30) + 1;
    format!("{:04}-{:02}-{:02}", y, m.min(12), d.min(31))
}

// ── AI config ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    pub kind: String,
    pub api_key: Option<String>,
    pub model: String,
    pub base_url: Option<String>,
}

fn ai_config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".curaye")
        .join("config.yaml")
}

#[command]
pub async fn get_ai_config() -> Result<Option<AiProviderConfig>, String> {
    let path = ai_config_path();
    if !path.exists() {
        return Ok(None);
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())?;
    let parsed: serde_yaml::Value =
        serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    let ai = match parsed.get("ai") {
        Some(v) => v.clone(),
        None => return Ok(None),
    };

    let provider_str = match ai.get("provider").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return Ok(None),
    };

    let cfg = match provider_str {
        "anthropic" => {
            let section = ai.get("anthropic");
            let api_key = section
                .and_then(|v| v.get("apiKey"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let model = section
                .and_then(|v| v.get("model"))
                .and_then(|v| v.as_str())
                .unwrap_or("claude-sonnet-5")
                .to_string();
            AiProviderConfig { kind: "anthropic".into(), api_key, model, base_url: None }
        }
        "ollama" => {
            let section = ai.get("ollama");
            let base_url = section
                .and_then(|v| v.get("baseUrl"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let model = section
                .and_then(|v| v.get("model"))
                .and_then(|v| v.as_str())
                .unwrap_or("llama3")
                .to_string();
            AiProviderConfig { kind: "ollama".into(), api_key: None, model, base_url }
        }
        "openai" => {
            let section = ai.get("openai");
            let api_key = section
                .and_then(|v| v.get("apiKey"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let model = section
                .and_then(|v| v.get("model"))
                .and_then(|v| v.as_str())
                .unwrap_or("gpt-4o")
                .to_string();
            let base_url = section
                .and_then(|v| v.get("baseUrl"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            AiProviderConfig { kind: "openai".into(), api_key, model, base_url }
        }
        _ => return Ok(None),
    };

    Ok(Some(cfg))
}

// ── AI streaming ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum AiStreamEvent {
    Token(String),
    Done,
    Error(String),
}

pub struct AiStreamState(pub Arc<Mutex<Option<tokio::task::AbortHandle>>>);

#[command]
pub async fn start_ai_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, AiStreamState>,
    config: AiProviderConfig,
    messages: Vec<AiMessage>,
) -> Result<(), String> {
    // Cancel any in-flight stream
    if let Some(handle) = state.0.lock().unwrap().take() {
        handle.abort();
    }

    let state_arc = Arc::clone(&state.0);
    let join = tokio::task::spawn(async move {
        let result = run_ai_stream(&app, &config, &messages).await;
        let ev = match result {
            Ok(()) => AiStreamEvent::Done,
            Err(e) => AiStreamEvent::Error(e),
        };
        let _ = app.emit("ai-stream", ev);
        if let Ok(mut g) = state_arc.lock() {
            *g = None;
        }
    });

    *state.0.lock().unwrap() = Some(join.abort_handle());
    Ok(())
}

#[command]
pub async fn cancel_ai_stream(state: tauri::State<'_, AiStreamState>) -> Result<(), String> {
    if let Some(handle) = state.0.lock().unwrap().take() {
        handle.abort();
    }
    Ok(())
}

async fn run_ai_stream(
    app: &tauri::AppHandle,
    config: &AiProviderConfig,
    messages: &[AiMessage],
) -> Result<(), String> {
    match config.kind.as_str() {
        "anthropic" => stream_anthropic(app, config, messages).await,
        "ollama" => stream_ollama(app, config, messages).await,
        "openai" => stream_openai_compat(app, config, messages).await,
        other => Err(format!("Unknown provider: {other}")),
    }
}

fn msgs_to_json(messages: &[AiMessage]) -> Vec<serde_json::Value> {
    messages
        .iter()
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect()
}

fn emit_line_openai(app: &tauri::AppHandle, line: &str) -> bool {
    if !line.starts_with("data: ") {
        return false;
    }
    let data = line[6..].trim();
    if data == "[DONE]" {
        return true; // signal to stop
    }
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
        if let Some(text) = v["choices"][0]["delta"]["content"].as_str() {
            if !text.is_empty() {
                let _ = app.emit("ai-stream", AiStreamEvent::Token(text.to_string()));
            }
        }
    }
    false
}

async fn drain_sse_stream(
    app: &tauri::AppHandle,
    response: reqwest::Response,
    is_anthropic: bool,
) -> Result<(), String> {
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        let last_nl = buffer.rfind('\n').map(|i| i + 1).unwrap_or(0);
        let to_process = buffer[..last_nl].to_string();
        buffer = buffer[last_nl..].to_string();

        for line in to_process.lines() {
            if is_anthropic {
                if !line.starts_with("data: ") { continue; }
                let data = line[6..].trim();
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                    if v["type"] == "content_block_delta" {
                        if let Some(text) = v["delta"]["text"].as_str() {
                            if !text.is_empty() {
                                let _ = app.emit("ai-stream", AiStreamEvent::Token(text.to_string()));
                            }
                        }
                    }
                }
            } else if emit_line_openai(app, line) {
                return Ok(());
            }
        }
    }
    Ok(())
}

fn make_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())
}

async fn stream_anthropic(
    app: &tauri::AppHandle,
    config: &AiProviderConfig,
    messages: &[AiMessage],
) -> Result<(), String> {
    let api_key = config.api_key.as_deref().unwrap_or("");
    let mut system: Option<String> = None;
    let user_msgs: Vec<serde_json::Value> = messages
        .iter()
        .filter_map(|m| {
            if m.role == "system" {
                system = Some(m.content.clone());
                None
            } else {
                Some(serde_json::json!({ "role": m.role, "content": m.content }))
            }
        })
        .collect();

    let mut body = serde_json::json!({
        "model": config.model,
        "max_tokens": 4096,
        "messages": user_msgs,
        "stream": true,
    });
    if let Some(sys) = system {
        body["system"] = serde_json::Value::String(sys);
    }

    let client = make_client()?;
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("Content-Type", "application/json")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic HTTP {status}: {body_text}"));
    }

    drain_sse_stream(app, resp, true).await
}

async fn stream_ollama(
    app: &tauri::AppHandle,
    config: &AiProviderConfig,
    messages: &[AiMessage],
) -> Result<(), String> {
    let base_url = config.base_url.as_deref().unwrap_or("http://localhost:11434");
    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": config.model,
        "messages": msgs_to_json(messages),
        "stream": true,
    });

    let client = make_client()?;
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Cannot reach Ollama at {url}: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama HTTP {status}: {body_text}"));
    }

    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&chunk);
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() { continue; }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(content) = v["message"]["content"].as_str() {
                    if !content.is_empty() {
                        let _ = app.emit("ai-stream", AiStreamEvent::Token(content.to_string()));
                    }
                }
                if v["done"].as_bool() == Some(true) { return Ok(()); }
            }
        }
    }
    Ok(())
}

async fn stream_openai_compat(
    app: &tauri::AppHandle,
    config: &AiProviderConfig,
    messages: &[AiMessage],
) -> Result<(), String> {
    let base_url = config.base_url.as_deref().unwrap_or("https://api.openai.com/v1");
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    // Only send Authorization if a key was explicitly configured.
    // Local servers like Jan require their own key or no header at all;
    // injecting a fake "local" bearer causes 401s on Jan.
    let effective_key = config
        .api_key
        .as_deref()
        .filter(|k| !k.is_empty());

    let body = serde_json::json!({
        "model": config.model,
        "messages": msgs_to_json(messages),
        "stream": true,
    });

    let client = make_client()?;
    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body);
    if let Some(key) = effective_key {
        req = req.header("Authorization", format!("Bearer {key}"));
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Cannot reach {url}: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("Server at {url} returned HTTP {status}: {body_text}"));
    }

    drain_sse_stream(app, resp, false).await
}

#[command]
pub async fn write_ai_config(config: Option<AiProviderConfig>) -> Result<(), String> {
    let path = ai_config_path();

    // Preserve any existing non-ai keys in the config file
    let mut yaml: serde_yaml::Value = if path.exists() {
        let content = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| e.to_string())?;
        serde_yaml::from_str(&content)
            .unwrap_or_else(|_| serde_yaml::Value::Mapping(serde_yaml::Mapping::new()))
    } else {
        serde_yaml::Value::Mapping(serde_yaml::Mapping::new())
    };

    let ai_value = match config {
        None => serde_yaml::Value::Null,
        Some(cfg) => {
            let mut ai_map = serde_yaml::Mapping::new();
            ai_map.insert(
                serde_yaml::Value::String("provider".into()),
                serde_yaml::Value::String(cfg.kind.clone()),
            );
            match cfg.kind.as_str() {
                "anthropic" => {
                    let mut m = serde_yaml::Mapping::new();
                    if let Some(k) = cfg.api_key {
                        m.insert(
                            serde_yaml::Value::String("apiKey".into()),
                            serde_yaml::Value::String(k),
                        );
                    }
                    m.insert(
                        serde_yaml::Value::String("model".into()),
                        serde_yaml::Value::String(cfg.model),
                    );
                    ai_map.insert(
                        serde_yaml::Value::String("anthropic".into()),
                        serde_yaml::Value::Mapping(m),
                    );
                }
                "ollama" => {
                    let mut m = serde_yaml::Mapping::new();
                    if let Some(u) = cfg.base_url {
                        m.insert(
                            serde_yaml::Value::String("baseUrl".into()),
                            serde_yaml::Value::String(u),
                        );
                    }
                    m.insert(
                        serde_yaml::Value::String("model".into()),
                        serde_yaml::Value::String(cfg.model),
                    );
                    ai_map.insert(
                        serde_yaml::Value::String("ollama".into()),
                        serde_yaml::Value::Mapping(m),
                    );
                }
                "openai" => {
                    let mut m = serde_yaml::Mapping::new();
                    if let Some(k) = cfg.api_key {
                        m.insert(
                            serde_yaml::Value::String("apiKey".into()),
                            serde_yaml::Value::String(k),
                        );
                    }
                    if let Some(u) = cfg.base_url {
                        m.insert(
                            serde_yaml::Value::String("baseUrl".into()),
                            serde_yaml::Value::String(u),
                        );
                    }
                    m.insert(
                        serde_yaml::Value::String("model".into()),
                        serde_yaml::Value::String(cfg.model),
                    );
                    ai_map.insert(
                        serde_yaml::Value::String("openai".into()),
                        serde_yaml::Value::Mapping(m),
                    );
                }
                _ => {}
            }
            serde_yaml::Value::Mapping(ai_map)
        }
    };

    if let serde_yaml::Value::Mapping(ref mut root) = yaml {
        root.insert(serde_yaml::Value::String("ai".into()), ai_value);
    }

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let content = serde_yaml::to_string(&yaml).map_err(|e| e.to_string())?;
    write_atomic(&path, content.as_bytes()).await
}

// ── Shell helpers ─────────────────────────────────────────────────────────────

#[command]
pub async fn pick_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .pick_folder(move |path| {
            let _ = tx.send(path.map(|p| p.to_string()));
        });
    let result = rx.await.map_err(|e| e.to_string())?;
    Ok(result)
}

#[command]
pub async fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        tokio::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .status()
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub async fn sync_project(_curaye_path: String) -> Result<(), String> {
    // Delegates to @curaye/sync via a future sidecar integration.
    // For now, a no-op placeholder.
    Ok(())
}

// ── Atomic write ──────────────────────────────────────────────────────────────

async fn write_atomic(path: &Path, data: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    tokio::fs::write(&tmp, data)
        .await
        .map_err(|e| e.to_string())?;
    tokio::fs::rename(&tmp, path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
