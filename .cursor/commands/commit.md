# Git Stage, Commit, and Push

## Overview

Inspect git status and diffs, draft a comprehensive commit message based on actual changes, then stage, commit, and push.

## Workflow

### 1) Inspect changes
- Run `git status` to see modified/untracked files and current branch.
- Run `git diff --stat` and `git diff` to review all changes.
- Run `git log --oneline -5` to see recent commit message style.
- If nothing to commit, stop and report clean tree.

### 2) Determine scope
- Default to all tracked + untracked files (`git add -A`).
- Read changed files to understand the full context of modifications.

### 3) Draft commit message
- Create a comprehensive commit message derived from the actual diffs:
  - Summary line (<=72 chars) describing the main change.
  - Blank line.
  - Body with bullet points describing key changes, mentioning notable files, new features, or behavior shifts.
- Use HEREDOC format for multi-line messages to preserve formatting.

### 4) Stage and commit
- Use `git add -A` to stage all changes.
- Use `git commit -m "$(cat <<'EOF' ... EOF)"` for multi-line messages.
- If commit fails (hooks, conflicts, etc.), report the error and fix if possible.

### 5) Push (always)
- Always push after a successful commit.
- If upstream exists, run `git push`.
- If no upstream, run `git push -u origin <branch>` to set upstream.

### 6) Verify result
- Run `git status` to confirm clean working tree.
- Show the commit with `git log -1 --stat` so the user can confirm.
- Report the commit hash and that changes were pushed.
