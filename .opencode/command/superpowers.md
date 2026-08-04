---
description: Toggle superpowers on or off. Usage: /superpowers [on|off]
agent: build
---

Toggle the superpowers plugin on or off for this workspace.

The superpowers gate plugin checks a flag file to decide whether to load.
When enabled, the superpowers skills and bootstrap context are active.

Current state: check if the flag file exists and report it.

If `$ARGUMENTS` contains "off" or "--off" or "disable":
1. Use the `bash` tool to run: `rm -f ~/.config/opencode/superpowers.enabled`
2. Report: "Superpowers OFF. Skills and bootstrap removed. Restart opencode to fully unload, or just continue without them."

If `$ARGUMENTS` contains "on" or "--on" or "enable" or is empty:
1. Use the `bash` tool to run: `mkdir -p ~/.config/opencode && touch ~/.config/opencode/superpowers.enabled`
2. Report: "Superpowers ON. Bootstrap context is now active. Restart opencode for skills to appear in the skill tool."

If `$ARGUMENTS` contains "status" or "--status" or "check":
1. Use the `bash` tool to run: `test -f ~/.config/opencode/superpowers.enabled && echo "ON" || echo "OFF"`
2. Report the result.

Always confirm what you did.
