# AGENTS.md

Guidance for AI agents (and humans) working in the `CheckGitHubRepo` repository.

## Project type

- **Single-file browser tool.** The whole application is `github_pr_checker.html` (vanilla HTML + CSS + ES6 in one IIFE). It runs entirely in the browser — no server, no build step, no package manager.
- **This is NOT a Docker/Python project.** The parent folder is named `DockerSource` by accident. Do **not** run commands for `suno_song_poster`, `test_imports.py`, `docker compose build`, or the `static/js/**` syntax loop — none of those exist here.
- Repo scope: `github_pr_checker.html` (source), `.gitignore`, plus docs and `.opencode/` skills. Runtime SQLite files (`github_pr_stats_*.sqlite`) and `CheckGitHubRepo.code-workspace` are untracked.

## Verification before commit/push

There are **no tests, no linter, no CI**. The verification gate is a careful review of the diff plus basic sanity:

- Read the full `git diff` and confirm no problems (see below).
- Basic sanity check of the single file (Node, no install needed):
  ```bash
  node -e "const fs=require('fs');const s=fs.readFileSync('github_pr_checker.html','utf8');let open=0;for(const c of s){if(c==='{')open++;if(c==='}')open--;if(open<0){console.log('FAIL');process.exit(1)}}console.log('OK bytes:',s.length,'| <script>:',(s.match(/<script[^>]*>/gi)||[]).length)"
  ```
- If the project later gains real checks (`scripts/`, CI), prefer those over the inline check.

## Hard rules (do not violate)

- **Token hygiene:** the user's GitHub token lives **only** in `localStorage`/`sessionStorage` under `ghPrChecker.token` at runtime. **Never** hard-code a token in the source and **never** commit secrets.
- **XSS safety (primary rule):** any user-controlled data (usernames, orgs, repository names, PR titles, labels, authors) rendered into HTML must go through the `esc()` escape helper (`github_pr_checker.html:345`). **Never** inject unescaped user data via `innerHTML`.
- **No debug leftovers:** no `console.log(`, `debugger`, or unfinished `TODO`/`FIXME` in shipped code.
- **No dead-code deletion without proof:** an element/function may be removed only after `grep` confirms it is not referenced elsewhere in the HTML.

## Versioning & releases

- Releases are **Git-Tag driven** (see `.opencode/skills/commit-push/SKILL.md`, `.opencode/skills/release-prs/SKILL.md`, and `CONTEXT.md`).
- The **`VERSION` file** mirrors the latest Git tag and is the source of truth for the version shown in the Web UI. However, **`VERSION` does not exist yet** — it is created by the first release and is not present in feature commits.
- Bump `VERSION` **only during a release step**, commit it **before** tagging, and push the **tag before the branch**.

## Conventions

- Commit messages: **conventional commits** — `feat:`, `fix:`, `fix(ui):`, `refactor:`, `chore:`, `docs:`, `security:`.
- UI copy and labels are **English** — keep new UI strings in English.
- Keep everything in the single `github_pr_checker.html` unless there is a strong reason to split.
