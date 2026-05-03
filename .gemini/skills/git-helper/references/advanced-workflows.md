# Advanced Git Workflows

## Power-User Operations

- **`git cherry-pick <commit>`**: Apply the changes introduced by some existing commits.
- **`git squash` (via `rebase -i`)**: Combine multiple commits into one for cleaner history.
  - Usage: `git rebase -i HEAD~n` where `n` is the number of commits.
- **`git reflog`**: Recover lost commits or reset states by viewing the history of HEAD.
  - Recovery: Find the SHA in reflog, then `git reset --hard <sha>`.
- **`git bisect`**: Perform a binary search through commit history to find the commit that introduced a bug.
- **`git revert <commit>`**: Create a new commit that undoes the changes of a previous one.

## Repository Cleanup

- **`git gc`**: Run a number of housekeeping tasks on the current repository, such as compressing file revisions.
- **`git prune`**: Prune unreachable objects from the object database.
