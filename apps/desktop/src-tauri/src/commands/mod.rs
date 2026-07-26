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
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub adopts: Vec<String>,
    pub sync_status: Option<String>,
    pub ready_count: Option<u32>,
    pub drift_count: Option<u32>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct RegistryFile {
    projects: Vec<RegistryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct RegistryEntry {
    name: String,
    path: String,
    #[serde(default)]
    id: String,
    #[serde(default)]
    adopts: Vec<String>,
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
        .map(|e| {
            // Registry stores the project root; curaye_path is always root/.curaye
            let curaye_path = PathBuf::from(&e.path)
                .join(".curaye")
                .to_string_lossy()
                .to_string();
            RegistryProject {
                name: e.name,
                curaye_path,
                id: e.id,
                adopts: e.adopts,
                sync_status: None,
                ready_count: None,
                drift_count: None,
            }
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
        .map(|p| {
            // Strip /.curaye suffix to store the project root
            let root = PathBuf::from(&p.curaye_path)
                .parent()
                .map(|parent| parent.to_string_lossy().to_string())
                .unwrap_or(p.curaye_path);
            RegistryEntry {
                name: p.name,
                path: root,
                id: p.id,
                adopts: p.adopts,
            }
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
    // Deduplicate by name or by resolved curaye_path
    if !projects.iter().any(|p| p.name == name || p.curaye_path == curaye_path) {
        projects.push(RegistryProject {
            name,
            curaye_path,
            id: String::new(),
            adopts: Vec::new(),
            sync_status: None,
            ready_count: None,
            drift_count: None,
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

// ── Cross-project backlog ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacklogSpec {
    pub project_name: String,
    pub project_curaye_path: String,
    pub path: String,
    pub id: Option<String>,
    pub title: String,
    pub status: String,
    pub effort: Option<String>,
    pub impact: Option<String>,
    pub desire: Option<String>,
    pub release: Option<String>,
}

#[command]
pub async fn scan_backlog() -> Result<Vec<BacklogSpec>, String> {
    let reg_path = registry_path();
    if !reg_path.exists() {
        return Ok(vec![]);
    }
    let content = tokio::fs::read_to_string(&reg_path)
        .await
        .map_err(|e| e.to_string())?;
    let file: RegistryFile = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    let mut specs = Vec::new();

    for entry in file.projects {
        let curaye_path = PathBuf::from(&entry.path).join(".curaye");
        let planned_dir = curaye_path.join("planned");

        if !planned_dir.is_dir() {
            continue;
        }

        let Ok(mut dir_entries) = tokio::fs::read_dir(&planned_dir).await else {
            continue;
        };

        while let Ok(Some(dir_entry)) = dir_entries.next_entry().await {
            let path = dir_entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("md") {
                continue;
            }

            let Ok(file_content) = tokio::fs::read_to_string(&path).await else {
                continue;
            };

            let fm = parse_frontmatter_quick(&file_content);

            let status = fm
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if status != "draft" && status != "ready" {
                continue;
            }

            let title = fm
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if title.is_empty() {
                continue;
            }

            let id = fm
                .get("id")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());

            let effort = fm
                .get("effort")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let impact = fm
                .get("impact")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let desire = fm
                .get("desire")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let release = fm
                .get("release")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());

            specs.push(BacklogSpec {
                project_name: entry.name.clone(),
                project_curaye_path: curaye_path.to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                id,
                title,
                status,
                effort,
                impact,
                desire,
                release,
            });
        }
    }

    Ok(specs)
}

#[command]
pub async fn update_spec_status(
    path: String,
    status: String,
    updated: String,
) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| e.to_string())?;

    let (mut fm, body) = split_frontmatter(&content);
    fm.insert("status".to_string(), serde_yaml::Value::String(status));
    fm.insert("updated".to_string(), serde_yaml::Value::String(updated));

    let fm_yaml = serde_yaml::to_string(&fm).map_err(|e| e.to_string())?;
    let new_content = format!("---\n{}---\n\n{}", fm_yaml, body.trim_start_matches('\n'));

    write_atomic(&file_path, new_content.as_bytes()).await
}

// ── Releases ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseSummary {
    pub id: String,
    pub title: String,
    pub status: String,
    pub target: Option<String>,
    pub path: String,
    pub total: usize,
    pub done: usize,
}

fn releases_dir(curaye_path: &str) -> PathBuf {
    PathBuf::from(curaye_path).join("releases")
}

async fn count_release_specs(curaye_path: &str, release_id: &str) -> (usize, usize) {
    let planned_dir = PathBuf::from(curaye_path).join("planned");
    let Ok(mut entries) = tokio::fs::read_dir(&planned_dir).await else {
        return (0, 0);
    };
    let mut total = 0usize;
    let mut done = 0usize;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let Ok(content) = tokio::fs::read_to_string(&path).await else {
            continue;
        };
        let fm = parse_frontmatter_quick(&content);
        let release = fm.get("release").and_then(|v| v.as_str()).unwrap_or("");
        if release != release_id {
            continue;
        }
        let status = fm.get("status").and_then(|v| v.as_str()).unwrap_or("");
        if status == "shelved" {
            continue;
        }
        total += 1;
        if status == "done" {
            done += 1;
        }
    }
    (total, done)
}

#[command]
pub async fn scan_releases(curaye_path: String) -> Result<Vec<ReleaseSummary>, String> {
    let dir = releases_dir(&curaye_path);
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let Ok(mut entries) = tokio::fs::read_dir(&dir).await else {
        return Ok(vec![]);
    };

    let mut files: Vec<PathBuf> = vec![];
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            files.push(path);
        }
    }
    files.sort();

    let mut summaries = Vec::new();
    for file_path in files {
        let Ok(content) = tokio::fs::read_to_string(&file_path).await else {
            continue;
        };
        let fm = parse_frontmatter_quick(&content);

        let id = fm
            .get("id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                file_path
                    .file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string()
            });

        let title = fm
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or(&id)
            .to_string();

        let status = fm
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("planning")
            .to_string();

        let target = fm
            .get("target")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let (total, done) = count_release_specs(&curaye_path, &id).await;

        summaries.push(ReleaseSummary {
            id,
            title,
            status,
            target,
            path: file_path.to_string_lossy().to_string(),
            total,
            done,
        });
    }

    Ok(summaries)
}

#[command]
pub async fn create_release(
    curaye_path: String,
    name: String,
    target: Option<String>,
) -> Result<ReleaseSummary, String> {
    let dir = releases_dir(&curaye_path);
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| e.to_string())?;

    let id = name
        .replace('.', "-")
        .replace(|c: char| !c.is_alphanumeric() && c != '-', "-")
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let filename = format!("{}.md", id);
    let file_path = dir.join(&filename);

    let today = chrono_today();
    let mut lines = vec![
        "---".to_string(),
        format!("id: {}", id),
        format!("title: \"{}\"", name),
        "status: planning".to_string(),
    ];
    if let Some(t) = &target {
        lines.push(format!("target: {}", t));
    }
    lines.push(format!("created: {}", today));
    lines.push(format!("updated: {}", today));
    lines.push("---".to_string());
    lines.push(String::new());
    lines.push(format!("# {}", name));
    lines.push(String::new());

    let content = lines.join("\n");
    write_atomic(&file_path, content.as_bytes()).await?;

    Ok(ReleaseSummary {
        id,
        title: name,
        status: "planning".to_string(),
        target,
        path: file_path.to_string_lossy().to_string(),
        total: 0,
        done: 0,
    })
}

#[command]
pub async fn assign_spec_to_release(
    spec_path: String,
    release_id: String,
    updated: String,
) -> Result<(), String> {
    let file_path = PathBuf::from(&spec_path);
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| e.to_string())?;

    let (mut fm, body) = split_frontmatter(&content);
    fm.insert("release".to_string(), serde_yaml::Value::String(release_id));
    fm.insert("updated".to_string(), serde_yaml::Value::String(updated));

    let fm_yaml = serde_yaml::to_string(&fm).map_err(|e| e.to_string())?;
    let new_content = format!("---\n{}---\n\n{}", fm_yaml, body.trim_start_matches('\n'));

    write_atomic(&file_path, new_content.as_bytes()).await
}

#[command]
pub async fn update_release_status(
    release_path: String,
    status: String,
    updated: String,
) -> Result<(), String> {
    let file_path = PathBuf::from(&release_path);
    let content = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| e.to_string())?;

    let (mut fm, body) = split_frontmatter(&content);
    fm.insert("status".to_string(), serde_yaml::Value::String(status));
    fm.insert("updated".to_string(), serde_yaml::Value::String(updated));

    let fm_yaml = serde_yaml::to_string(&fm).map_err(|e| e.to_string())?;
    let new_content = format!("---\n{}---\n\n{}", fm_yaml, body.trim_start_matches('\n'));

    write_atomic(&file_path, new_content.as_bytes()).await
}

#[derive(Debug, Serialize)]
pub struct ShippedSpecResult {
    pub spec_id: String,
    pub shipped_path: String,
}

#[command]
pub async fn ship_release(
    curaye_path: String,
    release_id: String,
    today: String,
) -> Result<Vec<ShippedSpecResult>, String> {
    let planned_dir = PathBuf::from(&curaye_path).join("planned");
    let shipped_dir = PathBuf::from(&curaye_path).join("shipped");
    let releases_dir_path = releases_dir(&curaye_path);

    tokio::fs::create_dir_all(&shipped_dir)
        .await
        .map_err(|e| e.to_string())?;

    // Collect all done specs in this release
    let Ok(mut entries) = tokio::fs::read_dir(&planned_dir).await else {
        return Err("Cannot read planned/ directory".to_string());
    };

    let mut done_specs: Vec<(PathBuf, BTreeMap<String, serde_yaml::Value>, String)> = vec![];
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let Ok(content) = tokio::fs::read_to_string(&path).await else {
            continue;
        };
        let (fm, body) = split_frontmatter(&content);
        let release = fm.get("release").and_then(|v| v.as_str()).unwrap_or("");
        let status = fm.get("status").and_then(|v| v.as_str()).unwrap_or("");
        if release == release_id && status == "done" {
            done_specs.push((path, fm, body));
        }
    }

    let mut results = Vec::new();

    for (spec_path, fm, _body) in &done_specs {
        let spec_id = fm
            .get("id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                spec_path
                    .file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string()
            });

        let title = fm
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or(&spec_id)
            .to_string();

        let shipped_path = shipped_dir.join(format!("{}.md", spec_id));
        let shipped_content = format!(
            "---\nid: {}\ntitle: \"{}\"\nshipped: {}\nrelease: \"{}\"\nspec_ref: \"{}\"\n---\n\n# {}\n\n> Shipped in {} on {}\n\n## What shipped\n\n## Changes to current/\n\n## Notes\n",
            spec_id, title, today, release_id, spec_id, title, release_id, today
        );

        write_atomic(&shipped_path, shipped_content.as_bytes()).await?;
        tokio::fs::remove_file(spec_path)
            .await
            .map_err(|e| e.to_string())?;

        results.push(ShippedSpecResult {
            spec_id,
            shipped_path: shipped_path.to_string_lossy().to_string(),
        });
    }

    // Mark release as shipped
    let release_file = releases_dir_path.join(format!("{}.md", release_id));
    if release_file.exists() {
        update_release_status(
            release_file.to_string_lossy().to_string(),
            "shipped".to_string(),
            today,
        )
        .await?;
    }

    Ok(results)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseSpecItem {
    pub path: String,
    pub id: Option<String>,
    pub title: String,
    pub status: String,
    pub effort: Option<String>,
    pub release: Option<String>,
}

#[command]
pub async fn scan_release_specs(
    curaye_path: String,
    release_id: String,
) -> Result<Vec<ReleaseSpecItem>, String> {
    let planned_dir = PathBuf::from(&curaye_path).join("planned");
    if !planned_dir.is_dir() {
        return Ok(vec![]);
    }

    let Ok(mut entries) = tokio::fs::read_dir(&planned_dir).await else {
        return Ok(vec![]);
    };

    let mut specs: Vec<ReleaseSpecItem> = vec![];

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let Ok(content) = tokio::fs::read_to_string(&path).await else {
            continue;
        };
        let fm = parse_frontmatter_quick(&content);

        let release = fm
            .get("release")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if release != release_id {
            continue;
        }

        let status = fm
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("draft")
            .to_string();

        if status == "shelved" {
            continue;
        }

        let title = fm
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if title.is_empty() {
            continue;
        }

        let id = fm
            .get("id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        let effort = fm
            .get("effort")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        specs.push(ReleaseSpecItem {
            path: path.to_string_lossy().to_string(),
            id,
            title,
            status,
            effort,
            release: Some(release),
        });
    }

    specs.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(specs)
}

// ── Document scanning ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub section: String,
    pub status: Option<String>,
    pub title: Option<String>,
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
    pub releases: Vec<ReleaseSummary>,
}

#[command]
pub async fn scan_project(curaye_path: String) -> Result<ProjectTree, String> {
    let base = PathBuf::from(&curaye_path);
    let mut tree = ProjectTree::default();

    scan_section(&base, "planned", &mut tree.planned).await;
    scan_section(&base, "current", &mut tree.current).await;
    scan_section(&base, "shipped", &mut tree.shipped).await;
    scan_section(&base, "decisions", &mut tree.decisions).await;
    tree.releases = scan_releases(curaye_path.clone()).await.unwrap_or_default();

    for name in &["prd.md", "stack.md", "AGENTS.md"] {
        let path = base.join(name);
        if path.exists() {
            tree.root.push(TreeNode {
                name: name.to_string(),
                path: path.to_string_lossy().to_string(),
                section: "root".to_string(),
                status: None,
                title: None,
                is_draft: false,
                has_validation_error: false,
            });
        }
    }

    Ok(tree)
}

// ── Palette document list ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentListItem {
    pub id: String,
    pub title: String,
    pub doc_type: String,
}

#[command]
pub async fn list_documents(curaye_path: String) -> Result<Vec<DocumentListItem>, String> {
    let base = PathBuf::from(&curaye_path);
    let mut items: Vec<DocumentListItem> = Vec::new();

    for section in &["planned", "shipped"] {
        let dir = base.join(section);
        if !dir.is_dir() {
            continue;
        }
        let Ok(mut entries) = tokio::fs::read_dir(&dir).await else {
            continue;
        };
        let mut files: Vec<PathBuf> = Vec::new();
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                files.push(path);
            }
        }
        files.sort();

        for path in files {
            let Ok(content) = tokio::fs::read_to_string(&path).await else {
                continue;
            };
            let fm = parse_frontmatter_quick(&content);
            let id = fm.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let title = fm.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if id.is_empty() || title.is_empty() {
                continue;
            }
            items.push(DocumentListItem {
                id,
                title,
                doc_type: section.to_string(),
            });
        }
    }

    Ok(items)
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

        let mut title = None;
        if let Ok(content) = tokio::fs::read_to_string(&path).await {
            let parsed = parse_frontmatter_quick(&content);
            status = parsed.get("status").and_then(|v| v.as_str()).map(|s| s.to_string());
            title = parsed.get("title").and_then(|v| v.as_str()).map(|s| s.to_string());
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
            title,
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
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

// ── AI config ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    pub kind: String,
    pub api_key: Option<String>,
    pub model: String,
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embed_provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embed_model: Option<String>,
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
            AiProviderConfig { kind: "anthropic".into(), api_key, model, base_url: None, embed_provider: None, embed_model: None }
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
            AiProviderConfig { kind: "ollama".into(), api_key: None, model, base_url, embed_provider: None, embed_model: None }
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
            AiProviderConfig { kind: "openai".into(), api_key, model, base_url, embed_provider: None, embed_model: None }
        }
        _ => return Ok(None),
    };

    let embed_provider = ai.get("embed").and_then(|v| v.get("provider")).and_then(|v| v.as_str()).map(|s| s.to_string());
    let embed_model = ai.get("embed").and_then(|v| v.get("model")).and_then(|v| v.as_str()).map(|s| s.to_string());

    Ok(Some(AiProviderConfig { embed_provider, embed_model, ..cfg }))
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

// ── Re-entry brief ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlannedSpecSummary {
    pub id: String,
    pub title: String,
    pub status: String,
    pub effort: String,
    pub impact: Option<String>,
    pub updated: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrentDocSummary {
    pub id: String,
    pub title: String,
    pub domain: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionSummary {
    pub id: String,
    pub title: String,
    pub status: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShippedSpecSummary {
    pub id: String,
    pub title: String,
    pub shipped: String,
    pub release: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BriefContext {
    pub project_name: String,
    pub last_activity_date: String,
    pub current_docs: Vec<CurrentDocSummary>,
    pub planned_specs: Vec<PlannedSpecSummary>,
    pub decisions: Vec<DecisionSummary>,
    pub recent_shipped: Vec<ShippedSpecSummary>,
    pub prd_content: Option<String>,
    pub stack_content: Option<String>,
}

fn parse_body(content: &str) -> String {
    let stripped = content.trim_start_matches('\u{feff}');
    if !stripped.starts_with("---") {
        return content.to_string();
    }
    let rest = &stripped[3..];
    if let Some(end) = rest.find("\n---") {
        rest[end + 4..].trim_start_matches('\n').to_string()
    } else {
        content.to_string()
    }
}

async fn read_doc_files(dir: &PathBuf) -> Vec<(BTreeMap<String, serde_yaml::Value>, String, String)> {
    let mut result = Vec::new();
    let Ok(mut entries) = tokio::fs::read_dir(dir).await else {
        return result;
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        // skip drafts
        if name.starts_with('_') {
            continue;
        }
        let Ok(content) = tokio::fs::read_to_string(&path).await else {
            continue;
        };
        let fm = parse_frontmatter_quick(&content);
        let body = parse_body(&content);
        result.push((fm, body, name));
    }
    result.sort_by(|a, b| a.2.cmp(&b.2));
    result
}

fn latest_date(dates: &[String]) -> String {
    let mut sorted = dates.to_vec();
    sorted.sort();
    sorted.last().cloned().unwrap_or_else(|| "unknown".to_string())
}

#[command]
pub async fn generate_brief_context(curaye_path: String) -> Result<BriefContext, String> {
    let base = PathBuf::from(&curaye_path);
    let project_name = base.parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("Project")
        .to_string();

    // Read root docs
    let prd_content = tokio::fs::read_to_string(base.join("prd.md")).await.ok();
    let stack_content = tokio::fs::read_to_string(base.join("stack.md")).await.ok();

    // current/
    let current_raw = read_doc_files(&base.join("current")).await;
    let current_docs: Vec<CurrentDocSummary> = current_raw.iter().map(|(fm, body, _)| {
        CurrentDocSummary {
            id: fm.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            title: fm.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            domain: fm.get("domain").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            body: body.clone(),
        }
    }).collect();

    // planned/
    let planned_raw = read_doc_files(&base.join("planned")).await;
    let mut all_dates: Vec<String> = Vec::new();
    let planned_specs: Vec<PlannedSpecSummary> = planned_raw.iter().filter_map(|(fm, body, _)| {
        let status = fm.get("status").and_then(|v| v.as_str()).unwrap_or("draft").to_string();
        if status == "done" || status == "shelved" {
            return None;
        }
        let id = fm.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let title = fm.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let effort = fm.get("effort").and_then(|v| v.as_str()).unwrap_or("m").to_string();
        let impact = fm.get("impact").and_then(|v| v.as_str()).map(|s| s.to_string());
        let updated = fm.get("updated").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if !updated.is_empty() {
            all_dates.push(updated.clone());
        }
        Some(PlannedSpecSummary { id, title, status, effort, impact, updated, body: body.clone() })
    }).collect();

    // decisions/
    let decisions_raw = read_doc_files(&base.join("decisions")).await;
    let decisions: Vec<DecisionSummary> = decisions_raw.iter().map(|(fm, body, _)| {
        DecisionSummary {
            id: fm.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            title: fm.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            status: fm.get("status").and_then(|v| v.as_str()).unwrap_or("active").to_string(),
            body: body.clone(),
        }
    }).collect();

    // shipped/ — most recent 5, sorted by shipped date descending
    let mut shipped_raw = read_doc_files(&base.join("shipped")).await;
    shipped_raw.sort_by(|a, b| {
        let da = a.0.get("shipped").and_then(|v| v.as_str()).unwrap_or("");
        let db = b.0.get("shipped").and_then(|v| v.as_str()).unwrap_or("");
        db.cmp(da)
    });
    let recent_shipped: Vec<ShippedSpecSummary> = shipped_raw.iter().take(5).map(|(fm, _, _)| {
        let shipped_date = fm.get("shipped").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if !shipped_date.is_empty() {
            all_dates.push(shipped_date.clone());
        }
        ShippedSpecSummary {
            id: fm.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            title: fm.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            shipped: shipped_date,
            release: fm.get("release").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        }
    }).collect();

    let last_activity_date = latest_date(&all_dates);

    Ok(BriefContext {
        project_name,
        last_activity_date,
        current_docs,
        planned_specs,
        decisions,
        recent_shipped,
        prd_content,
        stack_content,
    })
}

#[command]
pub async fn save_brief(curaye_path: String, content: String, date: String) -> Result<String, String> {
    let briefs_dir = PathBuf::from(&curaye_path).join("briefs");
    tokio::fs::create_dir_all(&briefs_dir)
        .await
        .map_err(|e| e.to_string())?;
    let dest = briefs_dir.join(format!("{}.md", date));
    write_atomic(&dest, content.as_bytes()).await?;
    Ok(dest.to_string_lossy().to_string())
}

// ── Desktop state (last_opened tracking) ─────────────────────────────────────

fn desktop_state_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".curaye")
        .join("desktop-state.json")
}

async fn read_desktop_state() -> serde_json::Map<String, serde_json::Value> {
    let path = desktop_state_path();
    if !path.exists() {
        return serde_json::Map::new();
    }
    let Ok(content) = tokio::fs::read_to_string(&path).await else {
        return serde_json::Map::new();
    };
    serde_json::from_str::<serde_json::Value>(&content)
        .ok()
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

async fn write_desktop_state(state: &serde_json::Map<String, serde_json::Value>) -> Result<(), String> {
    let path = desktop_state_path();
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    write_atomic(&path, content.as_bytes()).await
}

#[command]
pub async fn get_last_opened(curaye_path: String) -> Result<Option<String>, String> {
    let state = read_desktop_state().await;
    let last_opened = state.get("last_opened")
        .and_then(|v| v.as_object())
        .and_then(|m| m.get(&curaye_path))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    Ok(last_opened)
}

#[command]
pub async fn set_last_opened(curaye_path: String, date: String) -> Result<(), String> {
    let mut state = read_desktop_state().await;
    let last_opened = state
        .entry("last_opened")
        .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));
    if let Some(obj) = last_opened.as_object_mut() {
        obj.insert(curaye_path, serde_json::Value::String(date));
    }
    write_desktop_state(&state).await
}

// ── Pattern promotion ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromoteSharedResult {
    pub shared_path: String,
    pub doc_ref: String,
    pub is_update: bool,
    pub projects_notified: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct NotificationsFile {
    #[serde(default)]
    notifications: Vec<NotificationEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NotificationEntry {
    #[serde(rename = "docId")]
    doc_id: String,
    category: String,
    #[serde(rename = "adoptedBy")]
    adopted_by: Vec<String>,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

fn notifications_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".curaye")
        .join("notifications.yaml")
}

async fn update_shared_notification(
    doc_id: &str,
    category: &str,
    adopted_by: Vec<String>,
    updated_at: &str,
) -> Result<(), String> {
    let nf_path = notifications_path();
    let mut nf: NotificationsFile = if nf_path.exists() {
        let content = tokio::fs::read_to_string(&nf_path)
            .await
            .map_err(|e| e.to_string())?;
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        NotificationsFile::default()
    };

    let entry = NotificationEntry {
        doc_id: doc_id.to_string(),
        category: category.to_string(),
        adopted_by,
        updated_at: updated_at.to_string(),
    };

    let existing = nf.notifications.iter().position(|n| n.doc_id == doc_id);
    if let Some(idx) = existing {
        nf.notifications[idx] = entry;
    } else {
        nf.notifications.push(entry);
    }

    if let Some(parent) = nf_path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }

    let content = serde_yaml::to_string(&nf).map_err(|e| e.to_string())?;
    write_atomic(&nf_path, content.as_bytes()).await
}

#[command]
pub async fn get_promoted_to_ref(path: String) -> Option<String> {
    let content = tokio::fs::read_to_string(&path).await.ok()?;
    let (fm, _) = split_frontmatter(&content);
    fm.get("promoted_to").and_then(|v| v.as_str()).map(|s| s.to_string())
}

// ── Non-streaming AI completion helpers ───────────────────────────────────────

async fn complete_anthropic_once(config: &AiProviderConfig, system: &str, user_msg: &str) -> Result<String, String> {
    let api_key = config.api_key.as_deref().unwrap_or("");
    let body = serde_json::json!({
        "model": config.model,
        "max_tokens": 8192,
        "system": system,
        "messages": [{"role": "user", "content": user_msg}],
    });
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
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    v["content"][0]["text"].as_str().map(|s| s.to_string())
        .ok_or_else(|| "Unexpected Anthropic response".to_string())
}

async fn complete_ollama_once(config: &AiProviderConfig, system: &str, user_msg: &str) -> Result<String, String> {
    let base_url = config.base_url.as_deref().unwrap_or("http://localhost:11434");
    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": config.model,
        "stream": false,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg}
        ],
    });
    let client = make_client()?;
    let resp = client.post(&url).header("Content-Type", "application/json").json(&body)
        .send().await.map_err(|e| format!("Cannot reach Ollama at {url}: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama HTTP {status}: {body_text}"));
    }
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    v["message"]["content"].as_str().map(|s| s.to_string())
        .ok_or_else(|| "Unexpected Ollama response".to_string())
}

async fn complete_openai_once(config: &AiProviderConfig, system: &str, user_msg: &str) -> Result<String, String> {
    let base_url = config.base_url.as_deref().unwrap_or("https://api.openai.com/v1");
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let effective_key = config.api_key.as_deref().filter(|k| !k.is_empty());
    let body = serde_json::json!({
        "model": config.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg}
        ],
    });
    let client = make_client()?;
    let mut req = client.post(&url).header("Content-Type", "application/json").json(&body);
    if let Some(key) = effective_key {
        req = req.header("Authorization", format!("Bearer {key}"));
    }
    let resp = req.send().await.map_err(|e| format!("Cannot reach {url}: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body_text = resp.text().await.unwrap_or_default();
        return Err(format!("Server at {url} returned HTTP {status}: {body_text}"));
    }
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    v["choices"][0]["message"]["content"].as_str().map(|s| s.to_string())
        .ok_or_else(|| "Unexpected OpenAI response".to_string())
}

#[command]
pub async fn generalize_document(source_path: String) -> Result<String, String> {
    let content = tokio::fs::read_to_string(&source_path)
        .await
        .map_err(|e| format!("Cannot read source file: {e}"))?;

    let config = get_ai_config().await?
        .ok_or_else(|| "No AI provider configured".to_string())?;

    let system = "You rewrite technical documents for a shared knowledge layer. \
        Remove all project-specific names, identifiers, and repository names. \
        Replace concrete project names with generic placeholders like \"your-project\". \
        Keep the structure, insights, and decisions intact. \
        Return ONLY the rewritten document — no preamble, no commentary.";
    let user_msg = format!("Rewrite this document to be project-neutral:\n\n{content}");

    match config.kind.as_str() {
        "anthropic" => complete_anthropic_once(&config, system, &user_msg).await,
        "ollama"    => complete_ollama_once(&config, system, &user_msg).await,
        "openai"    => complete_openai_once(&config, system, &user_msg).await,
        other => Err(format!("Unknown provider: {other}")),
    }
}

#[command]
pub async fn shared_doc_exists(category: String, doc_id: String) -> bool {
    dirs::home_dir()
        .map(|h| h.join(".curaye").join("shared").join(&category).join(format!("{}.md", doc_id)))
        .map(|p| p.exists())
        .unwrap_or(false)
}

#[command]
pub async fn promote_to_shared(
    source_path: String,
    category: String,
    doc_id: String,
    project_id: String,
    update_source: bool,
    content_override: Option<String>,
) -> Result<PromoteSharedResult, String> {
    let valid_categories = ["decisions", "patterns", "design", "agents", "stack"];
    if !valid_categories.contains(&category.as_str()) {
        return Err(format!("Invalid category '{}'", category));
    }

    let source_path_obj = PathBuf::from(&source_path);

    // Detect section: the parent directory name of the source file
    let parent_dir = source_path_obj
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("");

    if parent_dir == "planned" {
        return Err("Only current/ and decisions/ documents can be promoted.".to_string());
    }

    // content_override is the generalized version; fall back to reading the source file
    let content_for_shared = if let Some(ov) = content_override {
        ov
    } else {
        tokio::fs::read_to_string(&source_path_obj)
            .await
            .map_err(|e| e.to_string())?
    };

    let (mut fm, body) = split_frontmatter(&content_for_shared);

    // Build shared document path
    let shared_base = dirs::home_dir()
        .ok_or_else(|| "Cannot determine home directory".to_string())?
        .join(".curaye")
        .join("shared");

    let category_dir = shared_base.join(&category);
    tokio::fs::create_dir_all(&category_dir)
        .await
        .map_err(|e| e.to_string())?;

    let shared_path = category_dir.join(format!("{}.md", doc_id));
    let doc_ref = format!("shared/{}/{}", category, doc_id);

    // Detect update vs new promotion, carry forward existing adopted_by
    let is_update = shared_path.exists();
    let mut existing_adopted: Vec<String> = Vec::new();
    if is_update {
        if let Ok(existing_content) = tokio::fs::read_to_string(&shared_path).await {
            let (existing_fm, _) = split_frontmatter(&existing_content);
            if let Some(serde_yaml::Value::Sequence(seq)) = existing_fm.get("adopted_by") {
                existing_adopted = seq
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect();
            }
        }
    }

    // Build adopted_by: existing + current project (deduped)
    if !existing_adopted.contains(&project_id) {
        existing_adopted.push(project_id.clone());
    }

    // Set shared-layer metadata
    let today = chrono_today();
    fm.insert(
        "source_project".to_string(),
        serde_yaml::Value::String(project_id.clone()),
    );
    fm.insert(
        "promoted".to_string(),
        serde_yaml::Value::String(today.clone()),
    );
    fm.insert(
        "adopted_by".to_string(),
        serde_yaml::Value::Sequence(
            existing_adopted
                .iter()
                .map(|s| serde_yaml::Value::String(s.clone()))
                .collect(),
        ),
    );

    let fm_yaml = serde_yaml::to_string(&fm).map_err(|e| e.to_string())?;
    let shared_content = format!("---\n{}---{}", fm_yaml, body);
    write_atomic(&shared_path, shared_content.as_bytes()).await?;

    // Notify other registered projects
    let reg_path = registry_path();
    let all_projects: Vec<RegistryEntry> = if reg_path.exists() {
        let content = tokio::fs::read_to_string(&reg_path).await.unwrap_or_default();
        let file: RegistryFile = serde_yaml::from_str(&content).unwrap_or_default();
        file.projects
    } else {
        Vec::new()
    };

    let other_projects: Vec<String> = all_projects
        .iter()
        .filter(|p| p.name != project_id)
        .map(|p| p.name.clone())
        .collect();

    let projects_notified = other_projects.len();
    if !other_projects.is_empty() {
        update_shared_notification(&doc_id, &category, other_projects, &today).await?;
    }

    // Optionally back-link source document — always read the original file,
    // since content_for_shared may be a generalized rewrite.
    if update_source {
        let original = tokio::fs::read_to_string(&source_path_obj)
            .await
            .map_err(|e| e.to_string())?;
        let (mut src_fm, src_body) = split_frontmatter(&original);
        src_fm.insert(
            "promoted_to".to_string(),
            serde_yaml::Value::String(doc_ref.clone()),
        );
        let src_fm_yaml = serde_yaml::to_string(&src_fm).map_err(|e| e.to_string())?;
        let updated_source = format!("---\n{}---{}", src_fm_yaml, src_body);
        write_atomic(&source_path_obj, updated_source.as_bytes()).await?;
    }

    Ok(PromoteSharedResult {
        shared_path: shared_path.to_string_lossy().to_string(),
        doc_ref,
        is_update,
        projects_notified,
    })
}

// ── Drift detection ───────────────────────────────────────────────────────────

fn drift_ignores_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".curaye")
        .join("drift-ignores.yaml")
}

fn shared_base_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".curaye")
        .join("shared")
}

fn shared_reviews_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".curaye")
        .join("shared-reviews")
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct DriftIgnoresFile {
    #[serde(default)]
    ignores: Vec<DriftIgnoreEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DriftIgnoreEntry {
    #[serde(rename = "projectId")]
    project_id: String,
    #[serde(rename = "docId")]
    doc_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftFinding {
    pub doc_id: String,
    pub doc_ref: String,
    pub category: String,
    pub classification: String,
    pub shared_path: String,
    pub shared_snippet: String,
}

async fn load_ignored_docs(project_id: &str) -> std::collections::HashSet<String> {
    let path = drift_ignores_path();
    if !path.exists() {
        return std::collections::HashSet::new();
    }
    let Ok(content) = tokio::fs::read_to_string(&path).await else {
        return std::collections::HashSet::new();
    };
    let file: DriftIgnoresFile = serde_yaml::from_str(&content).unwrap_or_default();
    file.ignores
        .into_iter()
        .filter(|e| e.project_id == project_id)
        .map(|e| e.doc_id)
        .collect()
}

const DRIFT_COMMON_WORDS: &[&str] = &[
    "the", "and", "for", "are", "but", "not", "you", "all", "any", "can",
    "was", "one", "our", "out", "day", "get", "has", "how", "its", "let",
    "may", "now", "say", "see", "set", "two", "way", "who", "did", "man",
    "new", "put", "too", "use", "via", "this", "that", "with", "have",
    "from", "they", "will", "been", "when", "more", "than", "what", "some",
    "each", "then", "them", "also", "into", "your", "over", "even", "most",
    "just", "such", "well", "back", "only", "here", "both", "much", "were",
    "same", "need", "like", "very", "take", "used", "make", "data", "type",
    "base", "code", "file", "name", "list", "page", "text", "true", "main",
    "must", "docs", "view", "spec", "test", "work", "does", "able", "call",
    "show", "keep", "sure", "left", "read", "user", "path", "long", "run",
    "done", "item", "key", "api", "url", "ide", "cli", "app",
];

fn extract_key_terms(text: &str) -> std::collections::HashSet<String> {
    let mut terms = std::collections::HashSet::new();
    let common: std::collections::HashSet<&str> = DRIFT_COMMON_WORDS.iter().copied().collect();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i].is_ascii_alphabetic() {
            let start = i;
            // Consume alphanumeric and hyphen (for package-style names)
            while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '-') {
                i += 1;
            }
            let word: String = chars[start..i].iter().collect();
            // Strip trailing hyphens
            let word = word.trim_end_matches('-').to_string();
            if word.len() < 3 { continue; }
            let lower = word.to_lowercase();
            if !common.contains(lower.as_str()) {
                terms.insert(lower);
            }
        } else {
            i += 1;
        }
    }
    terms
}

fn compute_term_drift(shared_raw: &str, local_content: &str) -> bool {
    let shared_terms = extract_key_terms(shared_raw);
    let local_terms = extract_key_terms(local_content);
    let missing: Vec<_> = shared_terms.iter().filter(|t| {
        if local_terms.contains(*t) { return false; }
        let lookslike_tech = t.chars().any(|c| c.is_ascii_digit()) || t.contains('-') || t.len() > 6;
        lookslike_tech
    }).collect();
    !missing.is_empty()
}

async fn read_project_local_content(project_path: &str) -> String {
    let curaye_path = PathBuf::from(project_path).join(".curaye");
    let mut parts: Vec<String> = Vec::new();
    for root_file in &["stack.md", "prd.md"] {
        if let Ok(content) = tokio::fs::read_to_string(curaye_path.join(root_file)).await {
            parts.push(content);
        }
    }
    for section in &["decisions", "current"] {
        let dir = curaye_path.join(section);
        let Ok(mut entries) = tokio::fs::read_dir(&dir).await else { continue; };
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("md") { continue; }
            if let Ok(content) = tokio::fs::read_to_string(&path).await {
                parts.push(content);
            }
        }
    }
    parts.join("\n")
}

async fn get_project_id(project_name: &str, project_path: &str) -> String {
    if let Ok(content) = tokio::fs::read_to_string(&registry_path()).await {
        if let Ok(file) = serde_yaml::from_str::<RegistryFile>(&content) {
            if let Some(entry) = file.projects.iter().find(|p| p.name == project_name || p.path == project_path) {
                if !entry.id.is_empty() {
                    return entry.id.clone();
                }
            }
        }
    }
    project_name.to_string()
}

async fn detect_drift_findings(
    project_name: &str,
    project_path: &str,
) -> Result<Vec<DriftFinding>, String> {
    let reg_path = registry_path();
    if !reg_path.exists() {
        return Ok(vec![]);
    }
    let content = tokio::fs::read_to_string(&reg_path).await.map_err(|e| e.to_string())?;
    let file: RegistryFile = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    let project_entry = file.projects.iter().find(|p| p.name == project_name || p.path == project_path);
    let adopts = match project_entry {
        Some(e) => e.adopts.clone(),
        None => return Ok(vec![]),
    };
    let project_id = match project_entry {
        Some(e) if !e.id.is_empty() => e.id.clone(),
        _ => project_name.to_string(),
    };

    if adopts.is_empty() {
        return Ok(vec![]);
    }

    let ignored = load_ignored_docs(&project_id).await;
    let shared_base = shared_base_path();
    let reviews_dir = shared_reviews_path();
    let local_content = read_project_local_content(project_path).await;
    let categories = ["decisions", "patterns", "design", "agents", "stack"];

    let mut findings: Vec<DriftFinding> = Vec::new();

    for doc_ref in &adopts {
        let parts: Vec<&str> = doc_ref.split('/').collect();
        let doc_id = match parts.last() {
            Some(id) if !id.is_empty() => *id,
            _ => continue,
        };

        if ignored.contains(doc_id) {
            continue;
        }

        let mut shared_raw: Option<String> = None;
        let mut found_category = String::new();
        let mut found_path = PathBuf::new();
        for cat in &categories {
            let path = shared_base.join(cat).join(format!("{}.md", doc_id));
            if let Ok(content) = tokio::fs::read_to_string(&path).await {
                shared_raw = Some(content);
                found_category = cat.to_string();
                found_path = path;
                break;
            }
        }

        let Some(shared_content) = shared_raw else { continue; };

        let shared_body = parse_body(&shared_content);
        let shared_snippet: String = shared_body.chars().take(400).collect();

        // Stage 1: pending-update — snapshot differs from current shared doc
        let review_path = reviews_dir.join(&project_id).join(format!("{}.md", doc_id));
        if let Ok(snapshot) = tokio::fs::read_to_string(&review_path).await {
            if snapshot != shared_content {
                findings.push(DriftFinding {
                    doc_id: doc_id.to_string(),
                    doc_ref: doc_ref.clone(),
                    category: found_category,
                    classification: "pending-update".to_string(),
                    shared_path: found_path.to_string_lossy().to_string(),
                    shared_snippet,
                });
                continue;
            }
        }

        // Stage 2: intentional override — local decisions/ has superseded_by matching this ref
        let curaye_decisions = PathBuf::from(project_path).join(".curaye").join("decisions");
        let mut has_override = false;
        if let Ok(mut entries) = tokio::fs::read_dir(&curaye_decisions).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("md") { continue; }
                if let Ok(raw) = tokio::fs::read_to_string(&path).await {
                    let fm = parse_frontmatter_quick(&raw);
                    if let Some(v) = fm.get("superseded_by") {
                        let val_str = match v {
                            serde_yaml::Value::String(s) => s.clone(),
                            _ => format!("{:?}", v),
                        };
                        if val_str == *doc_ref {
                            has_override = true;
                            break;
                        }
                    }
                }
            }
        }
        if has_override { continue; }

        // Stage 3: term-drift
        if compute_term_drift(&shared_content, &local_content) {
            findings.push(DriftFinding {
                doc_id: doc_id.to_string(),
                doc_ref: doc_ref.clone(),
                category: found_category,
                classification: "drift".to_string(),
                shared_path: found_path.to_string_lossy().to_string(),
                shared_snippet,
            });
        }
    }

    Ok(findings)
}

/// Count unresolved drift findings for a project (used for desktop sidebar badge).
#[command]
pub async fn check_project_drift(project_name: String, project_path: String) -> Result<u32, String> {
    let findings = detect_drift_findings(&project_name, &project_path).await?;
    Ok(findings.len() as u32)
}

/// Return full per-finding detail — called on demand when the Drift Panel opens.
#[command]
pub async fn get_drift_findings(project_name: String, project_path: String) -> Result<Vec<DriftFinding>, String> {
    detect_drift_findings(&project_name, &project_path).await
}

/// Copy the current shared doc to the review snapshot, clearing the pending-update finding.
#[command]
pub async fn mark_reviewed(
    project_name: String,
    project_path: String,
    doc_id: String,
    shared_path: String,
) -> Result<(), String> {
    let project_id = get_project_id(&project_name, &project_path).await;
    let shared_content = tokio::fs::read_to_string(&shared_path)
        .await
        .map_err(|e| e.to_string())?;
    let review_dir = shared_reviews_path().join(&project_id);
    tokio::fs::create_dir_all(&review_dir)
        .await
        .map_err(|e| e.to_string())?;
    let review_path = review_dir.join(format!("{}.md", doc_id));
    write_atomic(&review_path, shared_content.as_bytes()).await
}

/// Append this doc to drift-ignores.yaml so it is suppressed until the next sync.
#[command]
pub async fn ignore_drift_finding(
    project_name: String,
    project_path: String,
    doc_id: String,
) -> Result<(), String> {
    let project_id = get_project_id(&project_name, &project_path).await;
    let path = drift_ignores_path();

    let mut file: DriftIgnoresFile = if path.exists() {
        let content = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| e.to_string())?;
        serde_yaml::from_str(&content).unwrap_or_default()
    } else {
        DriftIgnoresFile::default()
    };

    if file.ignores.iter().any(|e| e.project_id == project_id && e.doc_id == doc_id) {
        return Ok(());
    }

    file.ignores.push(DriftIgnoreEntry { project_id, doc_id });

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let content = serde_yaml::to_string(&file).map_err(|e| e.to_string())?;
    write_atomic(&path, content.as_bytes()).await
}

/// Create a stub override decision in decisions/ and return its path.
/// Returns the existing path without overwriting if the file already exists.
#[command]
pub async fn create_override_decision(
    curaye_path: String,
    doc_id: String,
    doc_ref: String,
) -> Result<String, String> {
    let decisions_dir = PathBuf::from(&curaye_path).join("decisions");
    tokio::fs::create_dir_all(&decisions_dir)
        .await
        .map_err(|e| e.to_string())?;

    let file_path = decisions_dir.join(format!("override-{}.md", doc_id));
    if file_path.exists() {
        return Ok(file_path.to_string_lossy().to_string());
    }

    let today = chrono_today();
    let content = format!(
        "---\nid: override-{doc_id}\ntitle: \"Override: {doc_ref}\"\nstatus: active\nsuperseded_by: {doc_ref}\ncreated: {today}\nupdated: {today}\n---\n\n# Override: {doc_ref}\n\nThis project intentionally diverges from the shared layer document `{doc_ref}`.\n\n## Reason\n\n[Explain why this project's approach differs from the shared layer]\n"
    );

    write_atomic(&file_path, content.as_bytes()).await?;
    Ok(file_path.to_string_lossy().to_string())
}

// ── Shared layer panel commands ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedDocSummary {
    pub id: String,
    pub category: String,
    pub title: String,
    pub adopted_by_count: usize,
    pub promoted: Option<String>,
}

#[command]
pub async fn list_shared_docs(category: Option<String>) -> Result<Vec<SharedDocSummary>, String> {
    let shared_base = shared_base_path();
    let all_cats: &[&str] = &["decisions", "patterns", "design", "agents", "stack"];
    let categories: Vec<&str> = match category.as_deref() {
        Some(c) => vec![c],
        None => all_cats.to_vec(),
    };

    let mut summaries = Vec::new();

    for cat in categories {
        let cat_dir = shared_base.join(cat);
        if !cat_dir.is_dir() {
            continue;
        }
        let Ok(mut entries) = tokio::fs::read_dir(&cat_dir).await else {
            continue;
        };
        let mut files: Vec<PathBuf> = Vec::new();
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                files.push(path);
            }
        }
        files.sort();

        for file_path in files {
            let Ok(content) = tokio::fs::read_to_string(&file_path).await else {
                continue;
            };
            let fm = parse_frontmatter_quick(&content);

            let id = fm
                .get("id")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .unwrap_or_else(|| {
                    file_path
                        .file_stem()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string()
                });

            let title = fm
                .get("title")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .unwrap_or_else(|| id.clone());

            let adopted_by_count = fm
                .get("adopted_by")
                .and_then(|v| v.as_sequence())
                .map(|s| s.len())
                .unwrap_or(0);

            let promoted = fm
                .get("promoted")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            summaries.push(SharedDocSummary {
                id,
                category: cat.to_string(),
                title,
                adopted_by_count,
                promoted,
            });
        }
    }

    Ok(summaries)
}

#[command]
pub async fn read_shared_doc(category: String, doc_id: String) -> Result<String, String> {
    let path = shared_base_path()
        .join(&category)
        .join(format!("{}.md", doc_id));
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn write_shared_doc(
    category: String,
    doc_id: String,
    content: String,
    source_project_id: Option<String>,
) -> Result<usize, String> {
    let path = shared_base_path()
        .join(&category)
        .join(format!("{}.md", doc_id));

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    write_atomic(&path, content.as_bytes()).await?;

    let fm = parse_frontmatter_quick(&content);
    let adopted_by: Vec<String> = fm
        .get("adopted_by")
        .and_then(|v| v.as_sequence())
        .map(|seq| {
            seq.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let projects_to_notify: Vec<String> = adopted_by
        .into_iter()
        .filter(|p| source_project_id.as_deref().map_or(true, |src| p != src))
        .collect();

    let count = projects_to_notify.len();
    if !projects_to_notify.is_empty() {
        let today = chrono_today();
        update_shared_notification(&doc_id, &category, projects_to_notify, &today).await?;
    }

    Ok(count)
}

#[command]
pub async fn create_shared_doc(category: String, doc_id: String) -> Result<String, String> {
    let valid_categories = ["decisions", "patterns", "design", "agents", "stack"];
    if !valid_categories.contains(&category.as_str()) {
        return Err(format!("Invalid category '{}'", category));
    }

    let path = shared_base_path()
        .join(&category)
        .join(format!("{}.md", doc_id));

    if path.exists() {
        return Err(format!(
            "Shared document '{}/{}' already exists",
            category, doc_id
        ));
    }

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let today = chrono_today();
    let content = format!(
        "---\nid: {}\ntitle: \"\"\ncreated: {}\nadopted_by: []\n---\n\n",
        doc_id, today
    );

    write_atomic(&path, content.as_bytes()).await?;
    Ok(path.to_string_lossy().to_string())
}

#[command]
pub async fn get_notification_count(project_name: String) -> Result<usize, String> {
    let nf_path = notifications_path();
    if !nf_path.exists() {
        return Ok(0);
    }
    let content = tokio::fs::read_to_string(&nf_path)
        .await
        .map_err(|e| e.to_string())?;
    let nf: NotificationsFile = serde_yaml::from_str(&content).unwrap_or_default();
    let count = nf
        .notifications
        .iter()
        .filter(|n| n.adopted_by.contains(&project_name))
        .count();
    Ok(count)
}

// ── Toolkit registry ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolkitTools {
    pub formatter:       Option<String>,
    pub linter:          Option<String>,
    pub test:            Option<String>,
    pub e2e:             Option<String>,
    pub package_manager: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolkitPreset {
    pub id:               String,
    pub title:            String,
    pub runtime:          Vec<String>,
    pub app_type:         Option<String>,
    pub framework:        Vec<String>,
    pub starter_kit:      Option<String>,
    pub starter_kit_cmd:  Option<String>,
    pub design_system:    Option<String>,
    pub tools:            ToolkitTools,
    pub body:             String,
    pub file_path:        String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolkitMatch {
    pub preset: ToolkitPreset,
    pub score:  u32,
}

fn parse_toolkit_preset(raw: &str, file_path: &Path) -> Option<ToolkitPreset> {
    let fm_map = parse_frontmatter_quick(raw);

    let get_str = |key: &str| -> Option<String> {
        fm_map.get(key).and_then(|v| v.as_str()).map(|s| s.to_string())
    };

    let get_list = |key: &str| -> Vec<String> {
        match fm_map.get(key) {
            Some(serde_yaml::Value::Sequence(seq)) => seq
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect(),
            Some(serde_yaml::Value::String(s)) => vec![s.clone()],
            _ => vec![],
        }
    };

    let runtime = get_list("runtime");
    let app_type = get_str("app_type");
    let framework = get_list("framework");
    let starter_kit = get_str("starter_kit");
    let starter_kit_cmd = get_str("starter_kit_cmd");
    let design_system = get_str("design_system");

    let tools_val = fm_map.get("tools");
    let tools = ToolkitTools {
        formatter:       tools_val.and_then(|t| t.get("formatter")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        linter:          tools_val.and_then(|t| t.get("linter")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        test:            tools_val.and_then(|t| t.get("test")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        e2e:             tools_val.and_then(|t| t.get("e2e")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        package_manager: tools_val.and_then(|t| t.get("package_manager")).and_then(|v| v.as_str()).map(|s| s.to_string()),
    };

    let has_toolkit_fields = !runtime.is_empty()
        || app_type.is_some()
        || !framework.is_empty()
        || starter_kit.is_some()
        || starter_kit_cmd.is_some()
        || design_system.is_some()
        || tools.formatter.is_some()
        || tools.linter.is_some()
        || tools.test.is_some()
        || tools.e2e.is_some()
        || tools.package_manager.is_some();

    if !has_toolkit_fields {
        return None;
    }

    let id = get_str("id").unwrap_or_else(|| {
        file_path.file_stem().and_then(|n| n.to_str()).unwrap_or("").to_string()
    });
    let title = get_str("title").unwrap_or_else(|| id.clone());

    let body = {
        let stripped = raw.trim_start_matches('\u{feff}');
        if stripped.starts_with("---") {
            let rest = &stripped[3..];
            if let Some(end) = rest.find("\n---") {
                rest[end + 4..].trim_start_matches('\n').to_string()
            } else {
                String::new()
            }
        } else {
            raw.to_string()
        }
    };

    Some(ToolkitPreset {
        id,
        title,
        runtime,
        app_type,
        framework,
        starter_kit,
        starter_kit_cmd,
        design_system,
        tools,
        body,
        file_path: file_path.to_string_lossy().to_string(),
    })
}

fn stack_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".curaye")
        .join("shared")
        .join("stack")
}

#[command]
pub async fn list_toolkit_presets() -> Result<Vec<ToolkitPreset>, String> {
    let dir = stack_dir();
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let Ok(mut entries) = tokio::fs::read_dir(&dir).await else {
        return Ok(vec![]);
    };
    let mut files: Vec<PathBuf> = Vec::new();
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            files.push(path);
        }
    }
    files.sort();

    let mut presets = Vec::new();
    for file_path in files {
        let Ok(raw) = tokio::fs::read_to_string(&file_path).await else { continue };
        if let Some(preset) = parse_toolkit_preset(&raw, &file_path) {
            presets.push(preset);
        }
    }
    Ok(presets)
}

#[command]
pub async fn get_toolkit_preset(id: String) -> Result<Option<ToolkitPreset>, String> {
    let file_path = stack_dir().join(format!("{}.md", id));
    if !file_path.exists() {
        return Ok(None);
    }
    let raw = tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(parse_toolkit_preset(&raw, &file_path))
}

#[derive(Debug, Deserialize)]
pub struct ToolkitPresetInput {
    pub id:               String,
    pub title:            String,
    pub runtime:          Vec<String>,
    pub app_type:         Option<String>,
    pub framework:        Vec<String>,
    pub starter_kit:      Option<String>,
    pub starter_kit_cmd:  Option<String>,
    pub design_system:    Option<String>,
    pub tools:            ToolkitToolsInput,
    pub body:             String,
}

#[derive(Debug, Deserialize)]
pub struct ToolkitToolsInput {
    pub formatter:       Option<String>,
    pub linter:          Option<String>,
    pub test:            Option<String>,
    pub e2e:             Option<String>,
    pub package_manager: Option<String>,
}

#[command]
pub async fn write_toolkit_preset(preset: ToolkitPresetInput) -> Result<(), String> {
    let dir = stack_dir();
    tokio::fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    let file_path = dir.join(format!("{}.md", preset.id));

    let mut lines = vec![
        "---".to_string(),
        format!("id: {}", preset.id),
        format!("title: \"{}\"", preset.title),
    ];
    if !preset.runtime.is_empty() {
        lines.push(format!("runtime: [{}]", preset.runtime.join(", ")));
    }
    if let Some(ref at) = preset.app_type {
        if !at.is_empty() {
            lines.push(format!("app_type: {}", at));
        }
    }
    if !preset.framework.is_empty() {
        lines.push(format!("framework: [{}]", preset.framework.join(", ")));
    }
    if let Some(ref sk) = preset.starter_kit {
        if !sk.is_empty() {
            lines.push(format!("starter_kit: {}", sk));
        }
    }
    if let Some(ref cmd) = preset.starter_kit_cmd {
        if !cmd.is_empty() {
            lines.push(format!("starter_kit_cmd: {}", cmd));
        }
    }
    if let Some(ref ds) = preset.design_system {
        if !ds.is_empty() {
            lines.push(format!("design_system: {}", ds));
        }
    }
    let has_tools = preset.tools.formatter.as_ref().map(|s| !s.is_empty()).unwrap_or(false)
        || preset.tools.linter.as_ref().map(|s| !s.is_empty()).unwrap_or(false)
        || preset.tools.test.as_ref().map(|s| !s.is_empty()).unwrap_or(false)
        || preset.tools.e2e.as_ref().map(|s| !s.is_empty()).unwrap_or(false)
        || preset.tools.package_manager.as_ref().map(|s| !s.is_empty()).unwrap_or(false);
    if has_tools {
        lines.push("tools:".to_string());
        if let Some(ref pm) = preset.tools.package_manager { if !pm.is_empty() { lines.push(format!("  package_manager: {}", pm)); } }
        if let Some(ref f) = preset.tools.formatter        { if !f.is_empty()  { lines.push(format!("  formatter: {}", f));        } }
        if let Some(ref l) = preset.tools.linter           { if !l.is_empty()  { lines.push(format!("  linter: {}", l));           } }
        if let Some(ref t) = preset.tools.test             { if !t.is_empty()  { lines.push(format!("  test: {}", t));             } }
        if let Some(ref e) = preset.tools.e2e              { if !e.is_empty()  { lines.push(format!("  e2e: {}", e));              } }
    }
    lines.push("adopted_by: []".to_string());
    lines.push("---".to_string());
    lines.push(String::new());
    let body = if preset.body.is_empty() {
        "> Add rationale and notes here.".to_string()
    } else {
        preset.body.clone()
    };
    lines.push(body);
    lines.push(String::new());

    let content = lines.join("\n");
    write_atomic(&file_path, content.as_bytes()).await
}

#[command]
pub async fn delete_toolkit_preset(id: String) -> Result<(), String> {
    let file_path = stack_dir().join(format!("{}.md", id));
    if !file_path.exists() {
        return Err(format!("Toolkit preset '{}' not found", id));
    }
    tokio::fs::remove_file(&file_path)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn match_toolkit_preset(stack_md_content: String) -> Result<Vec<ToolkitMatch>, String> {
    let presets = list_toolkit_presets().await?;
    if presets.is_empty() {
        return Ok(vec![]);
    }

    struct RuntimeGroup { id: &'static str, tokens: &'static [&'static str] }
    struct AppTypeGroup { id: &'static str, tokens: &'static [&'static str] }

    let runtime_groups: &[RuntimeGroup] = &[
        RuntimeGroup { id: "node",   tokens: &["node", "npm", "pnpm", "yarn", "bun"] },
        RuntimeGroup { id: "rust",   tokens: &["rust", "cargo"] },
        RuntimeGroup { id: "python", tokens: &["python", "pip", "uv", "poetry"] },
        RuntimeGroup { id: "go",     tokens: &["go", "golang"] },
        RuntimeGroup { id: "bun",    tokens: &["bun"] },
        RuntimeGroup { id: "java",   tokens: &["java", "maven", "gradle"] },
        RuntimeGroup { id: "dotnet", tokens: &[".net", "c#", "dotnet"] },
        RuntimeGroup { id: "ruby",   tokens: &["ruby", "bundler", "rails"] },
    ];
    let app_type_groups: &[AppTypeGroup] = &[
        AppTypeGroup { id: "desktop", tokens: &["tauri", "electron"] },
        AppTypeGroup { id: "web",     tokens: &["next", "astro", "remix", "sveltekit"] },
        AppTypeGroup { id: "cli",     tokens: &["cli", "commander", "clap", "yargs", "typer", "cobra"] },
        AppTypeGroup { id: "api",     tokens: &["express", "fastify", "fastapi", "axum", "gin", "hono"] },
        AppTypeGroup { id: "mobile",  tokens: &["react native", "expo", "flutter"] },
        AppTypeGroup { id: "library", tokens: &["library", "package", "crate", "gem"] },
    ];

    let lower = stack_md_content.to_lowercase();

    let detected_runtimes: Vec<&str> = runtime_groups
        .iter()
        .filter(|g| g.tokens.iter().any(|t| lower.contains(t)))
        .map(|g| g.id)
        .collect();

    let detected_app_type = app_type_groups
        .iter()
        .find(|g| g.tokens.iter().any(|t| lower.contains(t)))
        .map(|g| g.id);

    let mut matches: Vec<ToolkitMatch> = presets
        .into_iter()
        .filter_map(|preset| {
            let mut score: u32 = 0;

            if let Some(at) = &preset.app_type {
                if detected_app_type.map_or(false, |d| d == at.as_str()) {
                    score += 4;
                }
            }

            for rt in &preset.runtime {
                if detected_runtimes.contains(&rt.as_str()) {
                    score += 2;
                }
            }

            for fw in &preset.framework {
                if lower.contains(&fw.to_lowercase().as_str()) {
                    score += 2;
                }
            }

            if score == 0 { None } else { Some(ToolkitMatch { preset, score }) }
        })
        .collect();

    matches.sort_by(|a, b| b.score.cmp(&a.score));
    Ok(matches)
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

// ── Semantic search ───────────────────────────────────────────────────────────

fn index_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".curaye")
        .join("index")
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchManifestEntry {
    key: String,
    #[serde(rename = "projectId")]
    project_id: String,
    #[serde(rename = "type")]
    doc_type: String,
    title: String,
    #[serde(rename = "filePath")]
    file_path: String,
    snippet: String,
}

#[derive(Debug, Deserialize)]
struct SearchManifest {
    dimensions: usize,
    #[serde(rename = "indexedAt")]
    indexed_at: String,
    entries: Vec<SearchManifestEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "type")]
    pub doc_type: String,
    pub title: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub snippet: String,
    pub score: f32,
}

#[derive(Debug, Serialize)]
pub struct SearchIndexStatus {
    pub exists: bool,
    #[serde(rename = "indexedAt", skip_serializing_if = "Option::is_none")]
    pub indexed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub projects: Option<Vec<String>>,
}

#[command]
pub async fn search_index_status() -> Result<SearchIndexStatus, String> {
    let manifest_path = index_dir().join("manifest.json");
    if !manifest_path.exists() {
        return Ok(SearchIndexStatus { exists: false, indexed_at: None, count: None, projects: None });
    }
    let raw = tokio::fs::read_to_string(&manifest_path).await.map_err(|e| e.to_string())?;
    let manifest: SearchManifest = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let mut projects: Vec<String> = manifest.entries.iter().map(|e| e.project_id.clone()).collect();
    projects.sort();
    projects.dedup();
    Ok(SearchIndexStatus {
        exists: true,
        indexed_at: Some(manifest.indexed_at),
        count: Some(manifest.entries.len()),
        projects: Some(projects),
    })
}

#[command]
pub async fn search_semantic(
    query_vector: Vec<f32>,
    project_id: Option<String>,
    doc_type: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let dir = index_dir();
    let index_path = dir.join("index.usearch");
    let manifest_path = dir.join("manifest.json");

    if !index_path.exists() || !manifest_path.exists() {
        return Ok(vec![]);
    }

    let raw = tokio::fs::read_to_string(&manifest_path).await.map_err(|e| e.to_string())?;
    let manifest: SearchManifest = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if manifest.dimensions == 0 || manifest.entries.is_empty() {
        return Ok(vec![]);
    }

    let index_path_str = index_path.to_string_lossy().to_string();
    let index = tokio::task::spawn_blocking(move || {
        usearch::Index::restore(&index_path_str).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    let lim = limit.unwrap_or(10);
    let k = (index.size() as usize).min(lim * 10).max(1);

    let matches = index.search::<f32>(&query_vector, k).map_err(|e| e.to_string())?;

    let mut results: Vec<SearchResult> = Vec::new();
    for (i, &key) in matches.keys.iter().enumerate() {
        let distance = matches.distances.get(i).copied().unwrap_or(1.0);
        let score = (1.0_f32 - distance).max(0.0).min(1.0);
        let idx = key as usize;
        let Some(entry) = manifest.entries.get(idx) else { continue };

        if let Some(ref pid) = project_id {
            if &entry.project_id != pid { continue; }
        }
        if let Some(ref dt) = doc_type {
            if &entry.doc_type != dt { continue; }
        }

        results.push(SearchResult {
            project_id: entry.project_id.clone(),
            doc_type: entry.doc_type.clone(),
            title: entry.title.clone(),
            file_path: entry.file_path.clone(),
            snippet: entry.snippet.clone(),
            score,
        });

        if results.len() >= lim { break; }
    }

    Ok(results)
}

#[command]
pub async fn search_keyword(
    query: String,
    curaye_paths: Vec<String>,
    doc_type: Option<String>,
) -> Result<Vec<SearchResult>, String> {
    let subdirs: Vec<&str> = match doc_type.as_deref() {
        Some(t) => vec![t],
        None => vec!["planned", "current", "decisions", "shipped"],
    };

    let mut results: Vec<SearchResult> = Vec::new();
    let q_lower = query.to_lowercase();

    for curaye_path in &curaye_paths {
        let project_id = std::path::Path::new(curaye_path)
            .parent()
            .and_then(|p| p.file_name())
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        for subdir in &subdirs {
            let folder = std::path::Path::new(curaye_path).join(subdir);
            let Ok(mut entries) = tokio::fs::read_dir(&folder).await else { continue };
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("md") { continue; }
                let Ok(content) = tokio::fs::read_to_string(&path).await else { continue };
                if !content.to_lowercase().contains(&q_lower) { continue; }

                let title = content.lines()
                    .find(|l| l.starts_with("title:"))
                    .map(|l| l.trim_start_matches("title:").trim().to_string())
                    .unwrap_or_default();

                let snippet_start = content.to_lowercase().find(&q_lower).unwrap_or(0);
                let start = snippet_start.saturating_sub(40);
                let end = (snippet_start + q_lower.len() + 80).min(content.len());
                let snippet = content[start..end].replace('\n', " ").trim().to_string();

                results.push(SearchResult {
                    project_id: project_id.clone(),
                    doc_type: subdir.to_string(),
                    title,
                    file_path: path.to_string_lossy().to_string(),
                    snippet,
                    score: 0.0,
                });
            }
        }
    }

    Ok(results)
}
