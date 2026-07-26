---
title: Claude Code Handoff — Desktop Integration
type: current
updated: 2026-07-26
---

# Claude Code Handoff — Desktop Integration

The Curaye desktop app can hand specs off to a Claude Code session in two ways.
Both are triggered from the spec context menu in the Backlog view.

---

## Option A — Copy build command (manual paste)

Click **"Copy build command"** on any spec. The command `/curaye-build <spec-id>`
is copied to your clipboard. Paste it into any Claude Code terminal and press Enter.

No setup required.

---

## Option B — Queue for build (watcher daemon)

Click **"Queue for build"** on any spec. Curaye writes a trigger file to:

```
<project>/.curaye/.build-queue/<spec-id>
```

A watcher script picks this up and starts the build session automatically.

### Setup (one-time)

**Step 1 — Install fswatch**

```bash
brew install fswatch
```

**Step 2 — Create the watcher script**

Save this to `~/bin/curaye-watch` and make it executable:

```bash
#!/usr/bin/env bash
# curaye-watch — watches all registered .curaye/.build-queue/ dirs and
# fires /curaye-build <spec-id> in a new Claude Code session.

set -euo pipefail

REGISTRY="$HOME/.curaye/projects.yaml"

# Collect all .build-queue dirs from registered projects
mapfile -t WATCH_DIRS < <(
  grep -oP '(?<=path: ).*' "$REGISTRY" 2>/dev/null \
  | while read -r p; do
      q="$p/.build-queue"
      mkdir -p "$q"
      echo "$q"
    done
)

if [[ ${#WATCH_DIRS[@]} -eq 0 ]]; then
  echo "No projects registered in $REGISTRY"
  exit 1
fi

echo "Watching ${#WATCH_DIRS[@]} build-queue dir(s)…"

fswatch -0 --event Created "${WATCH_DIRS[@]}" | while IFS= read -r -d '' trigger; do
  spec_id="$(basename "$trigger")"
  echo "[curaye-watch] Queuing build for: $spec_id"
  # Open a new Terminal window running claude with the build skill
  osascript - "$spec_id" <<'APPLESCRIPT'
    on run argv
      set specId to item 1 of argv
      tell application "Terminal"
        activate
        do script "claude --print '/curaye-build " & specId & "'"
      end tell
    end run
APPLESCRIPT
  # Remove the trigger so it doesn't re-fire
  rm -f "$trigger"
done
```

```bash
chmod +x ~/bin/curaye-watch
```

> **`claude` path**: the script assumes `claude` is in `$PATH`. If not, replace
> `claude` with its full path — typically `/Users/<you>/.claude/local/claude`.
> Run `which claude` to verify.

**Step 3 — Test it**

```bash
~/bin/curaye-watch &
# Then click "Queue for build" on a spec in the desktop app
```

**Step 4 (optional) — Auto-start as a LaunchAgent**

Save this to `~/Library/LaunchAgents/com.curaye.watch.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.curaye.watch</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/YOUR_USERNAME/bin/curaye-watch</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/curaye-watch.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/curaye-watch.log</string>
</dict>
</plist>
```

Replace `YOUR_USERNAME` with your macOS username, then load it:

```bash
launchctl load ~/Library/LaunchAgents/com.curaye.watch.plist
```

To stop: `launchctl unload ~/Library/LaunchAgents/com.curaye.watch.plist`
To view logs: `tail -f /tmp/curaye-watch.log`

---

## How the trigger file works

```
Desktop app
  └─ invoke queue_spec_build(curaye_path, spec_id)
       └─ creates  <project>/.curaye/.build-queue/<spec-id>  (contains Unix timestamp)

fswatch daemon
  └─ detects new file
       └─ extracts basename as spec_id
            └─ opens Terminal → claude /curaye-build <spec_id>
                 └─ deletes trigger file
```

The `.build-queue/` directory is gitignored by Curaye's default `.gitignore` pattern
(`**/.build-queue/`), so trigger files never land in version control.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Copied to clipboard" but paste is empty | Tauri webview clipboard requires the window to be focused. Click the desktop window first. |
| `fswatch: command not found` | Run `brew install fswatch` |
| `claude: command not found` in watch script | Add `export PATH="$HOME/.claude/local:$PATH"` to the top of `curaye-watch` |
| Terminal opens but build doesn't start | Check that `claude --print '/curaye-build ...'` works manually in Terminal |
| LaunchAgent not running after reboot | Run `launchctl list | grep curaye` to confirm it loaded; check `/tmp/curaye-watch.log` |
