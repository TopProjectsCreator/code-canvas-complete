## Plan: Customizable Discord Rich Presence

### Goals
1. **Landing page**: show a custom status (e.g. `"Canvas IDE"` / `"Looking at home"`)
2. **Override file-editing text**: instead of `"Editing index.html"` / `"Working in HTML"`, show your own text
3. **Settings UI**: configure all of this from the settings pane

### Design

**1. New "Discord" tab in `SettingsDialog.tsx`**

Add a 6th tab alongside Profile / AI / Notifications / Theme / Editor:

```
┌─ Discord Rich Presence ─────────────────────────────┐
│                                                      │
│  ☑ Show elapsed time                                 │
│                                                      │
│  ── Landing Page ──                                  │
│  ☑ Custom landing status                             │
│  Details: [Canvas IDE              ]                 │
│  State:   [Looking at 🏠           ]                 │
│                                                      │
│  ── Editing Files ──                                 │
│  ☑ Custom editing status                             │
│  Details: [Working on something    ]                 │
│  State:   [Hacking away           ]                  │
│                                                      │
│  ── Running Code ──                                  │
│  ☑ Custom running status                             │
│  Details: [Running my app          ]                 │
│  State:   [Executing...           ]                  │
│                                                      │
│  (auto-generated if toggles are off)                 │
└──────────────────────────────────────────────────────┘
```

Placeholders like `{fileName}`, `{projectName}`, `{language}` can be supported in a v2.

**2. Storage — `localStorage` key: `discordPresence`**

```json
{
  "showElapsedTime": true,
  "landing": { "enabled": true,  "details": "Canvas IDE",          "state": "Looking at 🏠" },
  "editing": { "enabled": false, "details": "Editing {fileName}",  "state": "Working in {language}" },
  "running": { "enabled": false, "details": "Running {fileName}",  "state": "Executing" }
}
```

Follows the existing pattern used by editor settings (`localStorage` → `useState` lazy init → `useEffect` sync).

**3. Modify `updateRichPresence` in `src/lib/discord.ts`**

The function currently builds details/state from hardcoded logic. Change it to:

```ts
export async function updateRichPresence(
  fileName?: string | null,
  language?: string | null,
  projectName?: string | null,
  isRunning?: boolean,
  context?: 'landing' | 'editing' | 'running' | 'idle'
): Promise<void> {
  const settings = loadDiscordSettings(); // reads from localStorage

  if (context && settings[context]?.enabled) {
    // Use custom text from settings
    details = settings[context].details;
    state = settings[context].state;
  } else {
    // Fall back to current auto-generated logic
    ...
  }
  ...
}
```

**4. Wire the landing page** — In `App.tsx`, detect landing routes and call `updateRichPresence` with `context: 'landing'`.

**5. Wire the IDE** — `IDELayout.tsx` already calls `updateRichPresence`; no changes needed except passing `context`.

### Files to change

| File | Change |
|------|--------|
| `src/lib/discord.ts` | Accept new `context` param; read localStorage overrides |
| `src/contexts/DiscordContext.tsx` | Update `updateRichPresence` type signature |
| `src/components/ide/SettingsDialog.tsx` | Add 6th "Discord" tab with the custom presence UI |
| `src/App.tsx` | On landing routes, call `updateRichPresence` with `context: 'landing'` |
| `src/components/ide/IDELayout.tsx` | Pass `context` to `updateRichPresence` |

### Edge cases / notes
- The `DiscordIndicator` component already shows when connected; no changes needed there
- If `showElapsedTime` is off, omit `timestamps` from the activity
- The tab should be hidden entirely if not inside a Discord Activity (`isInDiscord()` is false) — or kept visible but grayed out with a "Running inside Discord" message
