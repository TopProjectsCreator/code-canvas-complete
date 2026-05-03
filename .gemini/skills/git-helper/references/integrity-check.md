# Proactive Repository Health Check

Agents should run this diagnostic suite whenever a Git command fails, to provide the user with a comprehensive status report.

## The Maestro Diagnostic Routine

1. **Workspace Integrity**:
   - `git status --porcelain` (check for dirty working tree)
   - `[ -f .git/index.lock ] && echo "LOCKED"`
2. **Branch Health**:
   - `git branch -vv` (check tracking status)
   - `git fetch --dry-run` (check for upstream changes)
3. **History Consistency**:
   - `git log -n 1 --graph --oneline` (check current HEAD status)

## When to use `quick-fixes.sh`:
- If `LOCKED` found: run `scripts/quick-fixes.sh unlock`
- If branch diverged: run `scripts/quick-fixes.sh sync`
- If repository is sluggish: run `scripts/quick-fixes.sh cleanup`
