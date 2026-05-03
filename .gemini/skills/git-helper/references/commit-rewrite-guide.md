# Bulk Commit Modification Guide

## Batch-Renaming Commits or Changing Author

If you need to update commit messages or authorship across your entire history (e.g., adding a username or updating emails), follow these methods.

### Method 1: Interactive Rebase (Recommended for Recent History)
Use this if you only need to change a few recent commits.
1. `git rebase -i HEAD~n` (where 'n' is the number of commits to modify).
2. Change `pick` to `edit` for the commits you want to change.
3. Once rebase pauses, run: 
   `git commit --amend --author="Your Name <email@example.com>"` 
   (or modify the message if needed).
4. `git rebase --continue`.

### Method 2: Git Filter-Repo (Recommended for Full History)
Use `git-filter-repo` for deep, automated repository-wide changes. 
*Note: This is destructive; always back up your repository first.*

1. **Prerequisite**: Install via `pip install git-filter-repo` or your package manager.
2. **Execute**:
   `git filter-repo --name-callback 'return name + " (YourUsername)"' --email-callback 'return email'`
3. This command iterates through every commit and appends your username to the author field.

## Critical Safety Warning
- **Pushing**: After rewriting history, you **must** use `git push --force` to update the remote. 
- **Collaboration**: **Never** rewrite history on shared branches where others have already pulled your changes, as this will break their workflow.
