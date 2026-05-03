# Rebase Resolution Guide

## Workflow for Stalled Rebases

If a rebase is stalled:

1. **Diagnosis**: 
   - `git status` to see the current state.
   - `git diff` to inspect changes.
2. **Conflict Resolution**:
   - Resolve conflicts in files.
   - `git add <file>` to stage resolutions.
3. **Continue**:
   - `git rebase --continue`.
4. **Safety Escape**:
   - If a rebase has gone completely sideways, `git rebase --abort` restores the branch to the pre-rebase state.
