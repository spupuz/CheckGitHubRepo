---
name: commit-push
description: Review working-tree changes, verify they introduce no problems (HTML/JS sanity, anti-XSS rules), then commit and push to origin/main with a conventional message, and create the corresponding GitHub release. Use when the user asks to commit and push local changes.
---

# Commit & Push

**Goal:** Verify local changes are safe before committing, then commit, push them to `origin/main` with a conventional commit message, and publish a GitHub release for the push (versioning is Git-Tag driven — see CONTEXT.md).

> **This project is a single-file browser tool:** the entire application lives in `github_pr_checker.html` (vanilla HTML + CSS + ES6, one IIFE, no build step, no package manager). There is **no Python, no Docker, no JS module files, no `tests/`, no `requirements.txt`**. Do NOT run verification commands meant for the old Python/Docker repo (`suno_song_poster`, `test_imports.py`, `docker compose build`, the `for f in static/js/**` loop) — they do not exist here.

## Rules

- Only commit what the user asked for; never commit secrets.
- If any verification step fails, fix it and re-run — **never commit or push a failing tree**.
- This is a client-side tool: XSS safety and token hygiene are the top concerns.
- Only push after the user explicitly asks to commit/push (or invokes this skill).

## Steps

### 1. Inspect the Working Tree

```bash
git status --short
git diff --stat
git log --oneline -10
```

### 2. Review the Diff for Problems

```bash
git diff
```

Manually verify before committing:

- **No secrets**: no tokens, credentials, or API keys in the diff (e.g. `ghPrChecker.token`, a real GitHub PAT, `.env` values). At runtime the user's token is stored only in `localStorage`/`sessionStorage` (`ghPrChecker.token`) — never hard-code it in the source. If found, **stop** and report.
- **No debug leftovers**: no stray `console.log(`, `debugger`, or unfinished `TODO`/`FIXME` added to the HTML/JS.
- **No deleted functionality**: removing an element/function must be confirmed unused first — `grep` for its id/name across `github_pr_checker.html` before deleting.
- **XSS safety (primary rule for this project)**: any user-controlled data (usernames, org names, repo names, PR titles, labels, authors) rendered into HTML must go through the existing `esc()` escape helper (`github_pr_checker.html:345`) — never raw `innerHTML` with unescaped user data. Confirm any new `innerHTML=<...>` construction either uses `esc()` or interpolates only trusted constants.

### 3. Run Verification

All must pass before committing. Because this is a single-file, no-build, no-test project, the concrete checks are:

```bash
# Working tree diff is the primary review step (step 2)
git diff --stat

# HTML well-formedness / basic sanity of the single source (uses Node, no build needed)
node -e "
const fs=require('fs');
const s=fs.readFileSync('github_pr_checker.html','utf8');
const scriptTags=(s.match(/<script[^>]*>/gi)||[]).length;
let open=0;
for(const c of s){ if(c==='{') open++; if(c==='}') open--; if(open<0){ console.log('FAIL: unbalanced braces'); process.exit(1);} }
console.log('OK bytes:',s.length,'| <script>:',scriptTags,'| brace-depth balanced');
"
```

If the project later gains real checks (a `scripts/` folder, tests, CI), prefer those over the crudimentary inline check above. If any step fails: fix, re-run, and only then continue.

### 4. Stage and Commit

Review `git status --short`, stage the intended files:

```bash
git add -A
```

Write a conventional commit message in the repo style (`feat:`, `fix:`, `fix(ui):`, `refactor:`, `chore:`, `docs:`, `security:`). Summarize the change set, e.g.:

```
security: escape user data in PR table, harden token handling
```

If the changes cover multiple distinct concerns, split into multiple commits.

### 5. Push

```bash
git push origin main
```

### 6. Create GitHub Release

Versioning is **Git-Tag driven** (CONTEXT.md: tag `vX.Y.Z`, push `--tags`, then create a release referencing the tag). After the push, tag HEAD and publish the release. **Skip if HEAD is already tagged** (release already exists):

```bash
if git describe --tags --exact-match HEAD >/dev/null 2>&1; then
  echo "HEAD already tagged — release already exists"
  exit 0
fi

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
SUBJECT=$(git log -1 --format=%s)

# Semantic bump: breaking change ("!") → major, feat → minor, everything else → patch
NEW_VERSION=$(python3 -c '
import re, sys
maj, minor, patch = (int(x) for x in sys.argv[1].lstrip("vV").split("."))
m = re.match(r"([a-z]+)(\([^)]*\))?(!)?:", sys.argv[2])
bump = "major" if (m and m.group(3)) else ("minor" if (m and m.group(1) == "feat") else "patch")
if bump == "major": maj, minor, patch = maj + 1, 0, 0
elif bump == "minor": minor, patch = minor + 1, 0
else: patch += 1
print(f"v{maj}.{minor}.{patch}")
' "$LAST_TAG" "$SUBJECT")

# Release notes = commit subjects since the previous tag (before the bump commit)
NOTES=$(git log "$LAST_TAG"..HEAD --format='- %s')

# Sync the VERSION file with the new tag (must be committed BEFORE tagging so the
# tag points at a tree where VERSION == tag — see scripts/check_version_aligned.sh)
echo "$NEW_VERSION" > VERSION
git add VERSION
if ! git diff --cached --quiet; then
  git commit -m "chore: bump version to $NEW_VERSION"
fi

git tag "$NEW_VERSION"

# Push the tag BEFORE the branch so CI's version-alignment check (which compares
# VERSION to the latest fetched tag) stays green on the release push.
git push origin "$NEW_VERSION"
git push origin main

gh release create "$NEW_VERSION" --title "$NEW_VERSION" --notes "$NOTES"
```

If `gh` is unavailable or the release cannot be created, **do not block the push** — report the tag so a release can be created manually.

**VERSION alignment**: The `VERSION` file is the source of truth for the version shown in the Web UI and must always match the latest Git tag. It is bumped **only** during this release step — never inside feature commits. `scripts/check_version_aligned.sh` enforces this locally and in CI. If you commit the VERSION file outside a release, the check will fail until the release is tagged. (This project does not yet have `VERSION`/`scripts/check_version_aligned.sh` — they are created by the first release; the rule still governs once present.)

### 7. Report

Report the commit hash, the release tag/URL, the change summary, and the verification results.
