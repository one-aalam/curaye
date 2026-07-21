# @curaye/cli

The Curaye command-line interface. Every action the desktop app performs is available here.

## Installation

```bash
# Run without installing
npx curaye <command>

# Or install globally
npm install -g curaye
```

## Usage

```
curaye [--json] <command>

Options:
  --json    Output structured JSON (useful in scripts and CI)
  --help    Show help
```

## Commands

### Project management

```bash
curaye init [path]          # Scaffold .curaye/ in a directory
curaye link [path]          # Register a project in ~/.curaye/projects.yaml
curaye unlink <id>          # Remove a project from the registry
curaye projects             # List all registered projects
```

### Spec lifecycle

```bash
curaye new <title>          # Create a new planned spec
curaye new <title> --type decision   # Create a decision document
curaye list                 # List planned specs
curaye list --status ready  # Filter by status
curaye list --tag infra     # Filter by tag
curaye status <id> <status> # Update a spec's status
curaye ship <id>            # Mark a spec as shipped
curaye ship <id> --release v1.0.0
```

### Sync

```bash
curaye sync init <remote-url>   # One-time setup: clone or init the sync repo
curaye sync                     # Push current project to remote (default)
curaye sync --pull              # Pull from remote
curaye sync --all               # Sync every registered project
curaye sync status              # Report ahead/behind/clean state
```

### Search

```bash
curaye search "offline sync"              # Search all registered projects
curaye search "auth" --project myapp      # Search within a specific project
curaye search "spec" --type planned       # Filter by document type
```

### AI-assisted (requires provider config)

```bash
curaye ai status                # Check which provider is configured
curaye ai draft "dark mode"     # Draft a new spec from a title
curaye ai brief                 # Generate a re-entry brief for the current project
curaye ai update-current <id>   # Propose an update to a current/ document
```

## AI provider setup

Create `~/.curaye/ai.yaml`:

```yaml
provider: anthropic   # anthropic | openai | ollama
model: claude-sonnet-5
api_key: sk-ant-...
```

## JSON output

Every command supports `--json` for scripting:

```bash
curaye --json projects | jq '.[].id'
curaye --json list --status ready | jq 'length'
curaye --json search "auth" | jq '.[].filePath'
```

Errors are written to `stderr` with a non-zero exit code.

## Stack

- [Commander.js](https://github.com/tj/commander.js) — command parsing
- [@clack/prompts](https://github.com/bombshell-dev/clack) — interactive prompts and spinners
