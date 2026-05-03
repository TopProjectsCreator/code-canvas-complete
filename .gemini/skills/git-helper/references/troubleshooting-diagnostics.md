# Troubleshooting & Diagnostics

## Common Failure Modes & Remediation

- **Detached HEAD State**
  - *Cause*: You checked out a specific commit instead of a branch.
  - *Fix*: Create a new branch: `git checkout -b <new-branch-name>`
- **Index Lock File Found**
  - *Cause*: Another Git process is running, or a previous one crashed.
  - *Fix*: Remove the lock file: `rm -f .git/index.lock`
- **Remote Diverged**
  - *Cause*: Local and remote have conflicting histories.
  - *Fix*: `git pull --rebase` or resolve conflicts manually.
- **Large File Error (LFS)**
  - *Cause*: Trying to commit a file > 100MB.
  - *Fix*: Use Git LFS or `git rm --cached <file>` to remove it from tracking.

## Git Health Check
- Check config: `git config --list`
- Check remotes: `git remote -v`
- Cleanup local branches: `git fetch -p` (removes deleted remote branches)
