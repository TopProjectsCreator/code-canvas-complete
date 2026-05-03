#!/bin/bash
# git-helper/scripts/quick-fixes.sh

case "$1" in
  "unlock")
    rm -f .git/index.lock
    echo "Removed .git/index.lock"
    ;;
  "sync")
    git fetch -p
    git pull --rebase
    echo "Synced local branch with remote."
    ;;
  "cleanup")
    git gc --prune=now
    echo "Repository garbage collected."
    ;;
  *)
    echo "Usage: git-helper-fix [unlock|sync|cleanup]"
    ;;
esac
