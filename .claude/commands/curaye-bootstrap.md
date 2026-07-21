Bootstrap a new or blank project with a `.curaye/` folder. Conducts a conversational interview, seeds from the shared layer, and produces a complete initial scaffold.

Project path (optional): $ARGUMENTS

If a path is provided, use it. Otherwise use the current working directory.

## Step 1 — Pre-flight checks

Check that `.curaye/` does not already exist at the target path. If it does, stop:
"This project already has a .curaye/ folder. Use `/curaye-build` to work on existing specs, or `/curaye-import` if the docs are incomplete."

Check for existing files that can pre-fill interview answers:
- `README.md` — read it for project name, description, purpose
- `package.json` / `Cargo.toml` / `pyproject.toml` — detect stack and app type
- Any existing docs folder

Note what you found. You will use this to suggest answers during the interview.

## Step 2 — The interview

Ask the following five questions conversationally, one at a time. Where you found relevant info in Step 1, suggest it as a default the user can confirm or replace.

**Q1 — What is this project?**
One sentence. This becomes the opening line of `prd.md`.
(Suggest from README description if found.)

**Q2 — Who is it for?**
One sentence describing the target user. This seeds the "Target user" section of `prd.md`.

**Q3 — What type of app is it?**
Present as a choice:
- Desktop (Tauri)
- Web app
- CLI tool
- Mobile
- Library / package
- Other

(Suggest from detected stack if found.) This selects the matching `shared/stack/` document to seed `stack.md`.

**Q4 — Which shared decisions apply here?**
Run `curaye shared list --category decisions` and present the results as a numbered list. The user selects which apply (can say "none" or "all").
Skip this question silently if the shared layer has no decisions.

**Q5 — What do you want to build first?**
Free text. This becomes the title of the first planned spec.

Record all answers before proceeding.

## Step 3 — Run the mechanical scaffold

Call the CLI to create the folder structure:

```bash
curaye init <path>
```

This creates `.curaye/` with empty subfolders and stub root documents.

## Step 4 — Draft the documents with AI

Using the interview answers, write the following documents:

**`prd.md`** — a considered product brief:
- One clear north star paragraph from Q1 + Q2
- "What it does" — infer from Q1 and Q3
- "What it is not" — ask yourself what it would be easy to confuse this with
- "Target user" — from Q2

**`stack.md`** — seed from the matching `shared/stack/` document (Q3) if available. Otherwise derive from detected `package.json` / manifests. Mark unconfirmed entries with `# to verify`.

**`product.md`** — stub with distribution and interface strategy appropriate to the app type from Q3.

**First planned spec** — draft a full spec from Q5 in the standard format:
- Derive the problem from the project context
- Write a goal, non-goals, and 5–8 acceptance criteria
- Set `status: draft`, `effort: m` (adjust if obviously different), `created` and `updated` to today

## Step 5 — Copy selected shared decisions

For each decision selected in Q4:
1. Read the shared decision from `~/.curaye/shared/decisions/`
2. Copy it to `.curaye/decisions/<id>.md`
3. Add a `source: shared/decisions/<id>` field to its frontmatter

## Step 6 — Register the project

```bash
curaye link <path>
```

This adds the project to `~/.curaye/projects.yaml`.

## Step 7 — Report

Print a summary:
- `.curaye/` created at: path
- Documents written: list
- First planned spec: id and title
- Shared decisions seeded: list (or "none")
- Registered as: project id

"Bootstrap complete. Run `/curaye-build <first-spec-id>` to start building."
