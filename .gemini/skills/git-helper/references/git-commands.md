# Git Commands Reference

A guide to core Git commands and their typical use cases.

## Basic Workflow

- **`git status`**: Shows the working tree status. Use to see which files are staged, unstaged, or untracked.
- **`git add <file>`**: Adds file contents to the index (stages changes).
- **`git commit -m "<message>"`**: Records changes to the repository.
- **`git log`**: Shows the commit history.

## Branching & Merging

- **`git branch`**: Lists, creates, or deletes branches.
- **`git checkout <branch>`**: Switches branches or restores working tree files.
- **`git merge <branch>`**: Joins two or more development histories together.
- **`git rebase <base>`**: Reapplies commits on top of another base tip.

## Remote Operations

- **`git pull`**: Fetches from and integrates with another repository or a local branch.
- **`git push`**: Updates remote refs along with associated objects.
- **`git fetch`**: Downloads objects and refs from another repository.

## State Management

- **`git stash`**: Stashes the changes in a dirty working directory away.
- **`git reset <commit>`**: Resets current HEAD to the specified state.
- **`git diff`**: Shows changes between commits, commit and working tree, etc.
