# Context

Facts, conventions, and invariants that opencode agents should know and respect when working in this `CheckGitHubRepo` repository.

## Project Overview

**GitHub Open PR Checker** is a **self-contained, single-file, browser-based web tool** (UI in English). Open `github_pr_checker.html` in a browser — there is no server, no build step, and no package manager.

It scans one or more GitHub users/orgs and shows, per repository, the open pull requests with health metrics (draft count, "no reviewer", stale PRs >30d, oldest PR age, open issues, stars, last update), charts (ECharts), aggregations (top authors, frequent labels), delta vs. the previous scan, and CSV/JSON export. Data persists in an in-browser SQLite DB via `sql.js` (WASM), auto-saved to a user-selected folder.

## Repository Layout

- `github_pr_checker.html` — the **entire application** (HTML + CSS + ES6 JS in one IIFE). ~1000 lines. Single source of truth.
- `.gitignore` — ignores `*.sqlite`, `*.sqlite-journal`, `*.sqlite-wal`, `*.sqlite-shm`.
- `VERSION` — may be created by the first release; mirrors the latest Git tag (what the Web UI displays).
- `CheckGitHubRepo.code-workspace` — VS Code workspace file (untracked/optional).
- `github_pr_stats_*.sqlite` — runtime-generated, gitignored; not source.

> **No** Python, no Docker, no `tests/`, no JS module files, no `package.json`, no `scripts/`, no CI/GitHub Actions. Do not run repos-specific commands from other projects (e.g. `suno_song_poster`, `test_imports.py`, `docker compose build`).

## Stack & External Dependencies

- Vanilla ES6, IIFE, no bundler.
- CDN: `echarts@5` (charts) and `sql.js@1.8.0` (SQLite → WASM) — pinned versions in the HTML.
- GitHub REST API (`api.github.com`) for no-token counting; GitHub **GraphQL** API for extended metrics (requires a personal access token, supports private repos, draft PRs, reviewers, labels, issues).

## Security / Safety Invariants

These override raw speed — treat them as hard rules (an agent/CI should fail rather than violate them).

- **Token hygiene:** the user's GitHub token lives only in `localStorage`/`sessionStorage` under `ghPrChecker.token` (chosen at runtime). Never hard-code a token in the source; never commit secrets.
- **XSS safety — primary rule for this single-file tool:** any user-controlled data (usernames, orgs, repo names, PR titles, labels, authors) that is rendered into the DOM must go through the `esc()` escape helper (`github_pr_checker.html:345`). Never inject unescaped user data via `innerHTML`.
- **No debug leftovers** in shipped code (`console.log`, `debugger`, unfinished TODO/FIXME).
- **No dead-code deletions without proof:** an element/function may be removed only after `grep` confirms it is not referenced elsewhere in the HTML.

## Versioning & Releases (Git-Tag driven)

- Versioning is **shared** across the `commit-push` and `release-prs` skills (`.opencode/skills/`).
- Releases are **Git-Tag driven**: tag `vX.Y.Z`, push `--tags`, then create a GitHub release referencing the tag via `gh release create`.
- The **`VERSION` file is the source of truth** for the version shown in the Web UI and **must always equal the latest Git tag**.
- `VERSION` is bumped **only during a release step** — never inside feature commits.
- Sequence constraints to keep version-alignment checks green:
  1. Bump + commit `VERSION` **before** tagging (so the tag points at a tree where `VERSION == tag`).
  2. Push the **tag before the branch** on the release push.
- Semantic bump rules: breaking change (`!`) → major; `feat:` → minor; everything else → patch.
- Remote: `origin` → `https://github.com/spupuz/CheckGitHubRepo.git` (single remote, `main` branch).

## Opinions / Conventions

- Commit messages: **conventional commits** — `feat:`, `fix:`, `fix(ui):`, `refactor:`, `chore:`, `docs:`, `security:`.
- UI copy and labels are **Italian** — keep new UI strings in Italian to match.
- Keep everything in the single HTML file unless there's a strong reason to split (there currently isn't).
