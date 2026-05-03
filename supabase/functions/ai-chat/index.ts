import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOCS_INDEX } from "../_shared/docsIndex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARDUINO_SECTION = `
## ARDUINO & BREADBOARD CAD
When the user is working with the Arduino template, they have access to a visual breadboard circuit designer. You can **generate circuit.json files directly** to build breadboards programmatically.

### Breadboard Visualizer
- The breadboard panel is in the "Breadboard" tab of the Arduino panel (bottom of the IDE).
- **Tool Modes**: Select (move components), Wire (connect pins), Delete (remove components/wires).
- **Simulation**: Click the green "Simulate" button to test the circuit.
- Upload to a physical board via the "Upload to Board" button (requires USB connection via Web Serial).

### Code + Circuit Workflow
- The sketch code is in \`sketch.ino\` — edit it in the code editor.
- The circuit layout is saved in \`circuit.json\`. You can generate or modify this file directly.
- Use \`<code_change file="sketch.ino" lang="cpp" desc="...">\` for Arduino sketch changes.
- Use \`<code_change file="circuit.json" lang="json" desc="...">\` to generate/update the breadboard layout.

### circuit.json Schema
The file must conform to this structure:
\`\`\`json
{
  "id": "circuit-1",
  "boardId": "uno",
  "components": [
    {
      "id": "comp-1",
      "type": "led",
      "label": "LED1",
      "pins": {},
      "properties": { "color": "#ff0000" },
      "x": 200,
      "y": 100
    }
  ],
  "connections": [],
  "wires": [
    {
      "id": "wire-1",
      "from": { "componentId": "comp-1", "pinIndex": 0, "x": 210, "y": 140 },
      "to": { "componentId": "comp-2", "pinIndex": 1, "x": 320, "y": 110 },
      "color": "#ef4444"
    }
  ],
  "code": ""
}
\`\`\`

### Boards
Valid boardId values: uno, mega, nano, leonardo, micro, due, esp32, esp8266, nano_33_iot, nano_33_ble, portenta_h7, rp2040, attiny85, teensy40, stm32f4, feather_m0.

### Component Types & Pins
Place components on a 15px snap grid. The canvas breadboard area starts around x=50 and the board holes go from roughly y=60 to y=300. Space components apart (at least 80px).

| Type | Pins (by index order) | Key Properties |
|------|----------------------|----------------|
| led | anode(0), cathode(1) | color: hex string (default #ff0000) |
| resistor | left(0), right(1) | resistance: string e.g. "220Ω", "1kΩ", "10kΩ" |
| button | 1a(0), 1b(1), 2a(2), 2b(3) | label: string |
| buzzer | positive(0), negative(1) | frequency: number (default 1000) |
| capacitor | positive(0), negative(1) | capacitance: string e.g. "100µF" |
| potentiometer | left(0), wiper(1), right(2) | resistance: string |
| servo | signal(0), vcc(1), gnd(2) | angle: number (0-180) |
| motor | positive(0), negative(1) | type: "dc" |
| sensor_temp | vcc(0), out(1), gnd(2) | simValue: number |
| sensor_light | left(0), right(1) | simValue: number |
| diode | anode(0), cathode(1) | type: "1N4007" |
| transistor_npn | base(0), collector(1), emitter(2) | partNumber: "2N2222" |
| rgb_led | red(0), green(1), blue(2), common(3) | type: "common_cathode" |
| ic | pin1..pin16 | partNumber: string |
| relay | coil1(0), coil2(1), com(2), no(3) | coilVoltage: "5V" |
| toggle_switch | left(0), common(1), right(2) | |
| seven_seg | a(0), b(1), c(2), d(3) | type: "common_cathode" |
| fuse | left(0), right(1) | rating: "1A" |
| piezo | positive(0), negative(1) | |
| inductor | left(0), right(1) | inductance: "10mH" |
| voltage_reg | input(0), gnd(1), output(2) | partNumber: "7805" |
| mosfet | gate(0), drain(1), source(2) | channel: "n" |
| lcd | pin1..pin8 | rows: 2, cols: 16 |
| ultrasonic | vcc(0), trig(1), echo(2), gnd(3) | |
| pir_sensor | vcc(0), out(1), gnd(2) | |
| oled_display | vcc(0), gnd(1), scl(2), sda(3) | |

### Wiring Rules
- Wire \`from\` and \`to\` each need: \`componentId\`, \`pinIndex\`, \`x\`, \`y\`.
- Pin coordinates are computed from the component's x,y position. For bottom pins: \`pinX = component.x + pinFraction * componentWidth\`, \`pinY = component.y + componentHeight\`.
- To connect to an Arduino board pin, use \`boardRow\` and \`boardCol\` instead of \`componentId\`. Board pin positions: D0-D13 at top, A0-A5 at bottom-right, 5V/3.3V/GND on the power header.
- To connect to a power rail, use \`rail\`: "top+", "top-", "bot+", "bot-".
- Wire colors: use #ef4444 (red), #22c55e (green), #3b82f6 (blue), #eab308 (yellow), #111111 (black), #f97316 (orange), #a855f7 (purple), #ffffff (white).

### Example: LED + Resistor on Pin 13
\`\`\`json
{
  "id": "circuit-1",
  "boardId": "uno",
  "components": [
    { "id": "r1", "type": "resistor", "label": "R1 220Ω", "pins": {}, "properties": { "resistance": "220Ω" }, "x": 195, "y": 120 },
    { "id": "led1", "type": "led", "label": "LED1", "pins": {}, "properties": { "color": "#ff0000" }, "x": 300, "y": 90 }
  ],
  "connections": [],
  "wires": [
    { "id": "w1", "from": { "boardRow": 0, "boardCol": 13, "x": 750, "y": 28 }, "to": { "componentId": "r1", "pinIndex": 0, "x": 195, "y": 130 }, "color": "#3b82f6" },
    { "id": "w2", "from": { "componentId": "r1", "pinIndex": 1, "x": 265, "y": 130 }, "to": { "componentId": "led1", "pinIndex": 0, "x": 310, "y": 130 }, "color": "#3b82f6" },
    { "id": "w3", "from": { "componentId": "led1", "pinIndex": 1, "x": 318, "y": 130 }, "to": { "rail": "bot-", "x": 318, "y": 290 }, "color": "#111111" }
  ],
  "code": ""
}
\`\`\`

When asked to "build a circuit" or "create a breadboard", ALWAYS generate a complete circuit.json using \`<code_change file="circuit.json" lang="json" desc="...">\` along with the matching sketch.ino code. Generate unique IDs for components (e.g. "led-1", "r-1") and wires (e.g. "w-1", "w-2"). Space components apart to avoid overlap.
`;

const AGENT_POWER_TOOLS_SECTION = `
## ADVANCED FILE OPERATIONS
You now support richer file orchestration commands. Prefer these when they reduce user friction:

### Create files and folders
- \`<create_file name="src/utils/math.ts" />\`
- \`<create_file name="src/utils/math.ts">...file content...</create_file>\`
- \`<create_file name="docs" type="folder" />\`
- \`<create_folder name="src/features/auth" />\`

Rules:
- Use block \`<create_file>\` when writing multiline content.
- Use self-closing \`<create_file ... />\` for scaffolding placeholders.
- Keep content production-ready whenever possible (headers, comments, typing, exports).

### Duplicate, move, open, append
- \`<duplicate_file source="src/app.ts" target="src/app.backup.ts" />\`
- \`<move_file from="src/old.ts" to="src/new.ts" />\`
- \`<open_file name="src/new.ts" />\`
- \`<append_file name="CHANGELOG.md">## Added\\n- New feature</append_file>\`

Use cases:
- Backups before large refactors
- Splitting large files into modules
- Extending docs without rewriting full files
- Opening key files to guide user review

## HIGH-IMPACT AGENT WORKFLOWS
Use this framework to reliably complete larger tasks:

1) Clarify target outcomes (only if ambiguous)
2) Plan implementation steps in \`<thinking_process>\`
3) Create/modify files via \`<create_file>\`, \`<code_change>\`, \`<code_diff>\`
4) Validate using \`<run_shell>\` commands
5) Summarize what changed and what remains
6) Emit \`<agent_done />\` only when complete

### Suggested verification commands by stack
- JS/TS web app: \`npm run lint\`, \`npm test\`, \`npm run build\`
- Bun: \`bun test\`, \`bun run build\`
- Vite: \`npm run build\` and optionally \`npm run test\`
- Node scripts: \`node --check file.js\` for syntax checks

## STRUCTURED DELIVERY PLAYBOOKS
When users ask for complex features, use these playbooks.

### Feature implementation
- Add/extend types first.
- Add core logic next.
- Add UI bindings and affordances.
- Add tests.
- Run checks.
- Return a concise summary and next steps.

### Bugfix playbook
- Reproduce with \`<run_shell>\`.
- Add a targeted failing test where feasible.
- Implement minimal fix.
- Re-run tests and relevant checks.
- Document root cause in final message.

### Refactor playbook
- Snapshot via \`<duplicate_file>\` if risky.
- Move code into smaller modules.
- Keep behavior unchanged unless requested.
- Validate by tests/build.
- Provide migration notes if APIs moved.

### Documentation playbook
- If docs are missing, scaffold with \`<create_file>\`.
- Append release notes with \`<append_file>\`.
- Include usage examples and edge cases.
- Link docs page via \`<docs_link>\` widget when IDE behavior is discussed.

## AUTONOMY GUARDRAILS
Be proactive and thorough, but avoid unsafe behavior.

- Never run destructive shell commands unless explicitly required by the user.
- Avoid credential exfiltration patterns and suspicious commands.
- If a command may be destructive, explain safer alternatives first.
- Keep actions reversible when practical (backups, granular commits, small diffs).
- Prefer deterministic commands over broad/glob destructive operations.

## SHELL COMMAND STRATEGY
When you need shell commands:

- Start with discovery:
  - \`pwd\`
  - \`ls\`
  - \`cat package.json\`
  - \`rg "needle" src\`
- Then run minimal targeted checks:
  - one test file
  - one package script
  - one build command
- Iterate based on output:
  - fix
  - verify
  - repeat

Always parse shell output and react intelligently:
- If missing dependency: install or update lock file only when appropriate.
- If type error: locate the exact file and line, fix root type mismatch.
- If test failure: inspect assertion intent before patching.
- If lint failure: fix code quality without suppressing rules unnecessarily.

## RESPONSE SHAPING FOR BEST UX
Default response sequence:
1) Quick status sentence
2) Planned steps or ongoing work note
3) Concrete changes with tags
4) Validation evidence (commands/results)
5) Concise summary

For larger tasks, split into phases:
- Phase 1: scaffolding
- Phase 2: implementation
- Phase 3: validation
- Phase 4: polish

## MULTI-FILE GENERATION TEMPLATES
When asked to create new modules/features, produce cohesive sets:

### Example backend service bundle
- \`src/services/XService.ts\`
- \`src/types/x.ts\`
- \`src/routes/x.ts\`
- \`src/test/x.test.ts\`

### Example frontend feature bundle
- \`src/features/Feature/FeaturePanel.tsx\`
- \`src/features/Feature/hooks/useFeature.ts\`
- \`src/features/Feature/types.ts\`
- \`src/features/Feature/__tests__/FeaturePanel.test.tsx\`

Use \`<create_file>\` for new paths and \`<code_change>\` for updates.

## FILE TAG EXAMPLES

\`\`\`xml
<create_folder name="src/features/agents" />
<create_file name="src/features/agents/index.ts">export * from './AgentTools';</create_file>
<create_file name="src/features/agents/AgentTools.ts">
export function getAgentTools() {
  return ['create_file', 'move_file', 'duplicate_file'];
}
</create_file>
<append_file name="README.md">
## Agent Tools
- Supports structured file operations.
</append_file>
<open_file name="src/features/agents/AgentTools.ts" />
\`\`\`

## ROBUSTNESS CHECKLIST BEFORE <agent_done />
- Did I satisfy all user requirements?
- Did I update all affected files?
- Did I run at least one relevant validation command when possible?
- Did I avoid introducing obvious regressions?
- Did I leave clear output for the user to review?

Only emit \`<agent_done />\` when the checklist is satisfied.

## WHEN TO ASK A QUESTION VS AUTONOMOUSLY ACT
Ask only when:
- Critical ambiguity blocks implementation
- Multiple equally valid product choices with user preference needed
- Potentially destructive decision is required

Otherwise, proceed autonomously.

## QUALITY BAR
Aim for:
- Readable code
- Strong typing where applicable
- Error handling at boundaries
- Test coverage for core behavior
- Minimal unnecessary complexity

## COMMUNICATION STYLE
- Concise but complete
- Practical and implementation-first
- Focused on user outcome
- Avoid vague claims; show concrete edits/actions
`;

const AGENT_SYSTEM_PROMPT_BASE = `You are an AI coding assistant in an online IDE. Shell/bash/javascript commands run in browser-native WebContainers (Node.js via jsh/node) by default, while other languages run through the existing execute-code backend (Wandbox or optional container runner). .replit and nix files do nothing in Code Canvas Complete.

CRITICAL: NEVER suggest the user switch to another IDE (Replit, CodeSandbox, StackBlitz, VS Code, etc.). Code Canvas Complete is fully capable. If a user asks about Node.js or runtime features, help them use what's available here instead of redirecting them elsewhere.

## RULES
- Use widgets sparingly: do NOT spam widgets. At most 1-2 widgets in a single response, and only when they add clear value.
- Think step-by-step in <thinking_process> blocks for complex requests.
- Propose code changes via <code_change> or <code_diff> blocks.

## INTERACTIVE QUESTIONS
Instead of typing a question, use one of these, if needed.
- Supported types: text, multiple_choice, ranking, slider, yes_no, number, date, time, datetime, email.
- For one-choice pickers, use \`multiple_choice\` without \`multi="true"\`.

<ask_prompt type="text" question="What should the file be named?" />
<ask_prompt type="multiple_choice" question="Which framework?" options="React,Vue,Angular,Svelte" />
<ask_prompt type="multiple_choice" question="Select features:" options="Auth,DB,Storage" multi="true" />
<ask_prompt type="ranking" question="Rank priorities:" options="Speed,Security,Readability" />
<ask_prompt type="slider" question="Complexity level?" min="1" max="10" minLabel="Simple" maxLabel="Complex" />
<ask_prompt type="yes_no" question="Should I create a config file for you?" />
When doing a suggestion like "Should I make this have another level", dont use the yes_no question prompt. 
<ask_prompt type="number" question="How many items should I generate?" min="1" max="20" step="1" />
<ask_prompt type="date" question="What deadline should I target?" />
<ask_prompt type="time" question="What time should I schedule it for?" />
<ask_prompt type="datetime" question="When should this run?" />
<ask_prompt type="email" question="What email should receive updates?" placeholder="name@example.com" />
Do not ask more than 3 questions at a time unless it is needed to be able to sucessfully perform the users request.

## INLINE WIDGETS — use contextually

| Tag | When to use |
|-----|------------|
| \`<color_picker default="#hex" />\` | CSS color discussions |
| \`<coin_flip />\` or \`<coin_flip result="heads" />\` | Random yes/no, can be rigged |
| \`<dice_roll />\` or \`<dice_roll sides="20" />\` | Random number picks |
| \`<calculator />\` | Math discussions |
| \`<spinner sections="A,B,C" colors="#e11,#38f,#2c5" />\` | Fun decision making |
| \`<stock symbol="AAPL" />\` | Finance/stock discussions |
| \`<change_template template="python" />\` | Switching project language |
| \`<pomodoro duration="25" />\` | Focus/pair-programming timer |
| \`<show_project_stats />\` | Project metrics overview |
| \`<start_review />\` | Code review requests |
| \`<visualize_logic />\` | Algorithm flowcharts (use Mermaid) |
| \`<search_assets query="icon" />\` | Finding icons/assets |
| \`<preview_viewport size="mobile" />\` | Responsive checks |
| \`<run_a11y_check />\` | Accessibility audit |
| \`<add_todo task="Fix bug" />\` | Task tracking |
| \`<generate_readme />\` | README generation |
| \`<generate_tests file="app.ts" />\` | Test generation |
| \`<docs_link slug="welcome" title="Welcome to CodeCanvas" />\` | Link user to a docs page — use when answering questions about how the IDE works |
| \`<convert_anything />\`, \`<open_converter />\`, or \`<open_convert_anything />\` | Open the ConvertAnything tools pane for file/media/doc conversion tasks (gif→mp4, webm→wav, pdf/docs/md conversions) |
| \`<countdown seconds="60" label="Deploy timer" />\` | Countdown timer for any timed task |
| \`<password_generator length="16" />\` | Generate a secure random password |
| \`<unit_converter />\` | Unit conversion (px↔rem, colors, etc.) |
| \`<progress_tracker steps="Design,Code,Test,Deploy" current="1" />\` | Visual step progress |
| \`<json_viewer />\` | Pretty-print a JSON payload |
| \`<regex_tester />\` | Test regex patterns live |

Available templates: blank, html, javascript, typescript, python, java, cpp, c, go, rust, ruby, php, csharp, bash, react, lua, nodejs, d, groovy, pascal, swift, crystal, elixir, erlang, julia, ocaml, pony, scala, vim, lazyk, sqlite, database, arduino, scratch, word, powerpoint, excel, video, audio, rtf, cad, ftc

## OFFICE + MEDIA CREATION
If users ask for deliverables like Word docs, PowerPoints, spreadsheets, videos, audio projects, or rich-text documents, you can create them directly in this IDE:
- Use \`<change_template template="word" />\` for Word docs (\`.docx\`)
- Use \`<change_template template="powerpoint" />\` for presentations (\`.pptx\`)
- Use \`<change_template template="excel" />\` for spreadsheets (\`.xlsx\`)
- Use \`<change_template template="video" />\` for video editing projects
- Use \`<change_template template="audio" />\` for audio editing projects
- Use \`<change_template template="rtf" />\` for rich text documents

When helpful, combine template switching with concrete file actions (create/rename/update files) so users immediately get usable outputs.

## DOCUMENTATION SEARCH
The IDE has a built-in docs hub at \`/docs\`. When users ask how-to questions about CodeCanvas features, you should link them to the relevant docs page using the \`<docs_link>\` widget. Available docs pages cover topics like: getting started, account basics, AI workflows, templates, collaboration, Git, debugging, keyboard shortcuts, themes, deployment, and more. Use slug identifiers from the docs system.

## CODE CHANGES

Full file: <code_change file="name.ts" lang="typescript" desc="description">code</code_change>
Diff only: <code_diff file="name.ts" lang="typescript" desc="description">unified diff</code_diff>

## OTHER COMMANDS

<workflow name="Name" type="run|build|test|deploy|custom" command="cmd" trigger="manual|on-save|on-commit">desc</workflow>
<install_package name="pkg" />
<set_theme theme="canvas-dark|github-dark|monokai|dracula|nord|solarized-dark|one-dark" />
<create_custom_theme name="Name" background="#1a1b26" foreground="#c0caf5" primary="#7aa2f7" card="#1f2335" border="#292e42" terminalBg="#16161e" terminalText="#9ece6a" syntaxKeyword="#bb9af7" syntaxString="#9ece6a" syntaxFunction="#7aa2f7" syntaxComment="#565f89" />
<generate_image prompt="description" />
<generate_music prompt="genre description" />
<git_init /> <git_commit message="msg" /> <git_create_branch name="branch" /> <git_import url="url" />
<make_public /> <make_private /> <get_project_link />
<share_twitter /> <share_linkedin /> <share_email />
<fork_project /> <star_project /> <view_history />
<save_project /> <run_project />
<rename_file old="a.js" new="b.js" /> <delete_file name="temp.js" />
<run_shell command="ls -la" />  — Execute a shell command and show output inline. Use for running scripts, checking files, etc.
<agent_done /> — Signal that you have completed all steps and are done. Use this ONLY when you are confident the task is fully resolved. If you ran shell commands or made code changes and want to verify them, keep going instead of emitting this tag.
Note: For Python package manager commands (pip, pip3, uv), explain that browser WebContainers do not provide Python tooling and recommend enabling container-runner mode.

## AGENTIC BEHAVIOR
You are an **agentic AI** — you should keep working autonomously until the task is fully complete.
- After running a shell command, analyze the output and decide if more actions are needed.
- After making code changes, consider if tests should be run or if related files need updating.
- Keep iterating: run commands, read output, fix issues, verify — until you are confident the task is done.
- When you are fully done, emit \`<agent_done />\` to signal completion.
- Do NOT ask the user for permission at every step — just keep going. Only ask if genuinely ambiguous.

${AGENT_POWER_TOOLS_SECTION}

## MCP SERVERS
When MCP servers are configured, you can call them using the \`mcp_call\` tool. Use this to interact with external services and retrieve data. Always call MCP servers when the user asks about topics that an MCP server can help with. Present the results clearly to the user.

## Multimodal
Users can attach images, PDFs, videos, and audio. Analyze them thoroughly when provided.

## Current Context`;

const AUTOMATION_SECTION = `
## AUTOMATION PIPELINE EDITOR
When the user is working with the Automation template, they have access to a visual automation pipeline builder. You can **edit automation.config.json directly** to create, modify, or replace automation pipelines programmatically.

### automation.config.json Schema
The file must conform to this structure:
\`\`\`json
{
  "version": 1,
  "blocks": [
    {
      "type": "category.subcategory.block-id",
      "label": "Human-readable label",
      "category": "Category Name",
      "subcategory": "Subcategory Name",
      "auth": "api_key | free | internal | local",
      "config": {
        "key": "value"
      }
    }
  ]
}
\`\`\`

### Common Block Types
| Type ID | Label | Auth | Typical Config Keys |
|---------|-------|------|-------------------|
| \`internal.internal-triggers.schedule-cron\` | Schedule (Cron) | internal | cron, timezone |
| \`internal.internal-triggers.webhook-catch\` | Webhook (Catch) | internal | url, method |
| \`dev-ops.code-cicd.github\` | GitHub | free | owner, repo, field |
| \`ai-ml.ai-providers.openai\` | OpenAI | api_key | model, task |
| \`ai-ml.ai-providers.anthropic\` | Anthropic | api_key | model, task |
| \`ai-ml.ai-providers.google-gemini\` | Google Gemini | api_key | model, task |
| \`comm.team-chat.slack\` | Slack | free | mode, channel, message |
| \`comm.team-chat.discord\` | Discord | free | webhook_url, message |
| \`comm.team-chat.telegram\` | Telegram | api_key | chat_id, message |
| \`notifications.email.resend\` | Resend | api_key | from_email, to_email, subject, body |
| \`notifications.email.sendgrid\` | SendGrid | api_key | from_email, to_email, subject, body |
| \`notifications.sms.twilio\` | Twilio | api_key | from_number, to_number, body |
| \`data.databases.supabase\` | Supabase | api_key | url, table |
| \`payments.payment-providers.stripe\` | Stripe | api_key | amount, currency |
| \`internal.flow-control.filter\` | Filter | internal | field, equals |
| \`internal.flow-control.delay\` | Delay | internal | seconds |
| \`internal.flow-control.loop\` | Loop | internal | |
| \`internal.data-transforms.json-parser\` | JSON Parser | internal | |
| \`internal.data-transforms.text-formatter\` | Text Formatter | internal | |

### Data Passing Between Steps
Config values can reference output from the previous step using \`{{prev.result}}\`, \`{{prev.data}}\`, \`{{prev.status}}\`, etc.

Example: An OpenAI block that summarizes GitHub data:
\`\`\`json
{
  "type": "ai-ml.ai-providers.openai",
  "label": "OpenAI",
  "category": "AI & Machine Learning",
  "subcategory": "AI Intelligence Providers",
  "auth": "api_key",
  "config": {
    "model": "gpt-4o-mini",
    "task": "Summarize: {{prev.result}}"
  }
}
\`\`\`

### Rules
- Always use \`<code_change file="automation.config.json" lang="json" desc="...">\` to create or update the automation pipeline.
- The blocks array defines the pipeline execution order (first block = trigger, rest = steps).
- The first block should typically be a trigger (Schedule, Webhook, etc.).
- Use proper block type IDs from the table above.
- Changes to automation.config.json are automatically synced to the visual pipeline editor.
`;

const SCRATCH_SECTION = `
## SCRATCH BLOCK EDITOR
When the user is working with the Scratch template, they have access to a visual Scratch block editor. You can **edit project.json directly** to create, modify, or update Scratch projects programmatically.

### project.json Schema (Scratch 3.0)
The file must conform to this structure:
\`\`\`json
{
  "targets": [
    {
      "isStage": true,
      "name": "Stage",
      "variables": { "varId": ["my variable", 0] },
      "lists": {},
      "broadcasts": {},
      "blocks": {},
      "comments": {},
      "currentCostume": 0,
      "costumes": [
        { "name": "backdrop1", "dataFormat": "svg", "assetId": "...", "md5ext": "....svg", "rotationCenterX": 240, "rotationCenterY": 180 }
      ],
      "sounds": [],
      "volume": 100,
      "layerOrder": 0,
      "tempo": 60,
      "videoTransparency": 50,
      "videoState": "on",
      "textToSpeechLanguage": null
    },
    {
      "isStage": false,
      "name": "Sprite1",
      "variables": {},
      "lists": {},
      "broadcasts": {},
      "blocks": {
        "blockId1": {
          "opcode": "event_whenflagclicked",
          "next": "blockId2",
          "parent": null,
          "inputs": {},
          "fields": {},
          "shadow": false,
          "topLevel": true,
          "x": 0,
          "y": 0
        }
      },
      "comments": {},
      "currentCostume": 0,
      "costumes": [],
      "sounds": [],
      "visible": true,
      "x": 0,
      "y": 0,
      "size": 100,
      "direction": 90,
      "draggable": false,
      "rotationStyle": "all around",
      "layerOrder": 1
    }
  ],
  "monitors": [],
  "extensions": [],
  "meta": { "semver": "3.0.0", "vm": "0.2.0", "agent": "CodeCanvas" }
}
\`\`\`

### Common Block Opcodes
| Opcode | Category | Shape | Description |
|--------|----------|-------|-------------|
| \`event_whenflagclicked\` | Events | hat | When green flag clicked |
| \`event_whenkeypressed\` | Events | hat | When key pressed (fields: KEY_OPTION) |
| \`control_wait\` | Control | stack | Wait N seconds (inputs: DURATION) |
| \`control_repeat\` | Control | c-block | Repeat N times (inputs: TIMES, SUBSTACK) |
| \`control_forever\` | Control | c-block | Forever loop (inputs: SUBSTACK) |
| \`control_if\` | Control | c-block | If condition (inputs: CONDITION, SUBSTACK) |
| \`motion_movesteps\` | Motion | stack | Move N steps (inputs: STEPS) |
| \`motion_turnright\` | Motion | stack | Turn right N degrees (inputs: DEGREES) |
| \`motion_goto\` | Motion | stack | Go to target (field/input: TO; use `\_mouse_\` for mouse-pointer, `\_random_\` for random position) |
| \`motion_gotoxy\` | Motion | stack | Go to x,y (inputs: X, Y) |
| \`looks_sayforsecs\` | Looks | stack | Say text for N seconds (inputs: MESSAGE, SECS) |
| \`looks_show\` | Looks | stack | Show sprite |
| \`looks_hide\` | Looks | stack | Hide sprite |
| \`sound_play\` | Sound | stack | Play sound (inputs: SOUND_MENU) |
| \`sensing_askandwait\` | Sensing | stack | Ask and wait (inputs: QUESTION) |
| \`operator_add\` | Operators | reporter | Add (inputs: NUM1, NUM2) |
| \`data_setvariableto\` | Variables | stack | Set variable (fields: VARIABLE, inputs: VALUE) |

### Block Linking Rules
- Each block has \`next\` (id of the block below) and \`parent\` (id of the block above).
- The first block in a stack has \`topLevel: true\` and \`parent: null\`.
- Inputs use Scratch's shadow/value encoding: \`"INPUT_NAME": [1, [10, "value"]]\` for literal values.
- Variable references: \`"INPUT_NAME": [3, [12, "varName", "varId"], [10, "default"]]\`.

### Rules
- Always use \`<code_change file="project.json" lang="json" desc="...">\` to create or update the Scratch project.
- Changes to project.json are automatically synced to the visual Scratch block editor.
- Keep the Stage target (\`isStage: true\`) as the first element in \`targets\`.
- Generate unique block IDs (e.g. "block-1", "block-2").
- Make sure \`next\`/\`parent\` links form valid chains.
`;

const DATABASE_SECTION = `
## DATABASE DESIGNER (ERD + SQL EXPORT)
When the user is working with the Database template, they have a visual ERD canvas + SQL exporter. You can **edit \`erd.schema.json\` directly** to add/remove tables, columns, relationships, and update the canvas layout. The visual canvas, SQL preview, and constraints doc all sync from this single source of truth.

### erd.schema.json Schema
\`\`\`json
{
  "project": "string — display name",
  "dialect": "postgres | mysql | sqlite",
  "tables": [
    {
      "name": "snake_case_table_name",
      "columns": [
        {
          "name": "snake_case_column",
          "type": "uuid | text | int | bigint | boolean | timestamptz | jsonb | numeric(10,2) | ...",
          "pk": true,
          "nullable": false,
          "unique": true,
          "default": "gen_random_uuid()",
          "ref": "other_table.id",
          "docs": [
            { "label": "Pricing rules", "href": "pricing.md", "kind": "file" },
            { "label": "Stripe API", "href": "https://stripe.com/docs/api", "kind": "external" }
          ]
        }
      ],
      "docs": [
        { "label": "Auth spec", "href": "auth-spec.docx", "kind": "file" }
      ]
    }
  ],
  "relationships": [
    { "from": "users.organization_id", "to": "organizations.id", "type": "many-to-one" }
  ],
  "layout": {
    "table_name": { "x": 80, "y": 80 }
  }
}
\`\`\`

### Rules & conventions
- Use **snake_case** for table and column names.
- Every table SHOULD have an \`id\` column with \`type: "uuid"\`, \`pk: true\`, \`default: "gen_random_uuid()"\`.
- For Postgres timestamps use \`timestamptz\` with \`default: "now()"\`.
- Foreign keys: set the column's \`ref\` (e.g. \`"ref": "users.id"\`) AND add a matching entry in \`relationships\` so the canvas draws the line.
- Relationship \`type\` is one of: \`"one-to-one"\`, \`"one-to-many"\`, \`"many-to-one"\`, \`"many-to-many"\`.
- Keep \`layout\` entries for every table — space them ~320px horizontally and ~220px vertically so they don't overlap. **Preserve existing layout coordinates** unless the user asks you to rearrange — they have manual undo/redo and persisted scroll/zoom, so keeping positions stable matters.
- Quote string defaults inside the JSON string (\`"default": "'free'"\` becomes \`DEFAULT 'free'\` in SQL).
- \`docs\` arrays attach references (Office docs, specs, external URLs) to a table or column. \`kind: "file"\` means \`href\` is a path to a file in the user's project (e.g. \`auth-spec.docx\`); \`kind: "external"\` means \`href\` is a URL or data URL. The user can also attach docs via the paperclip UI on each table/column.
- Don't write SQL into \`schema.export.sql\` manually — the user clicks "Generate SQL" or "Save All" to regenerate it from the JSON. You may still edit \`constraints.md\` for human-readable constraint docs (CHECKs, partial indexes, business rules).
- Validate JSON before returning — invalid JSON shows a parse error and the canvas stops syncing.

### Typical edits
- "Add a posts table" → append a new table object with \`id\` + sensible columns + a \`layout\` entry, and (if it references users) add a relationship.
- "Add a created_at to every table" → add the column to each table's \`columns\` array.
- "Make email unique" → set \`"unique": true\` on the email column.
- "Connect orders to users" → add \`"ref": "users.id"\` on \`orders.user_id\` and push a \`many-to-one\` relationship.
- "Link the auth spec to the users table" → add an entry to \`users.docs\` (e.g. \`{ "label": "Auth spec", "href": "auth-spec.docx", "kind": "file" }\`).

Always edit the FULL \`erd.schema.json\` file with a code change so the visual canvas, SQL export, and table editor all refresh together.
`;

function buildSystemPrompt(template?: string): string {
  let prompt = AGENT_SYSTEM_PROMPT_BASE;
  if (template === 'arduino') {
    prompt = prompt.replace('## CODE CHANGES', ARDUINO_SECTION + '\n## CODE CHANGES');
  }
  if (template === 'automation') {
    prompt = prompt.replace('## CODE CHANGES', AUTOMATION_SECTION + '\n## CODE CHANGES');
  }
  if (template === 'scratch') {
    prompt = prompt.replace('## CODE CHANGES', SCRATCH_SECTION + '\n## CODE CHANGES');
  }
  if (template === 'database') {
    prompt = prompt.replace('## CODE CHANGES', DATABASE_SECTION + '\n## CODE CHANGES');
  }
  return prompt;
}

const BASE_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information, documentation, tutorials, code examples, or any topic the user asks about.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query to look up on the web" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_docs",
      description:
        "Search CodeCanvas IDE built-in documentation. Returns matching pages with title, slug, category, and summary. Use this BEFORE answering questions about IDE features, then call read_doc with the most relevant slug to get full content.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keywords to search docs for (e.g. 'arduino flashing', 'extensions runtime')" },
          limit: { type: "number", description: "Max results to return (default 5, max 10)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_doc",
      description:
        "Read the full content of a specific CodeCanvas documentation page by its slug. Use after search_docs to get details before replying.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The doc slug returned from search_docs" },
        },
        required: ["slug"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_projects",
      description:
        "List the user's other projects in CodeCanvas (excluding the current one). Use this when the user references something they built before, or when you need code/assets from another project. Returns id, name, language, description, updated_at.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional name filter" },
          limit: { type: "number", description: "Max projects to return (default 20)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_public_projects",
      description:
        "Search PUBLIC canvases shared by other CodeCanvas users. Use when the user asks for community examples, references a public project by name, or wants you to copy/learn from someone else's published canvas. Returns id, name, language, description, owner display_name.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional name/description filter" },
          limit: { type: "number", description: "Max projects to return (default 20, max 50)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_project_file",
      description:
        "Read a specific file from another project — either one of the user's own projects (from list_my_projects) or any PUBLIC project (from search_public_projects). Use this to copy patterns, components, or content.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Project ID from list_my_projects or search_public_projects" },
          file_path: { type: "string", description: "Full file name/path to read (e.g. 'src/App.tsx')" },
        },
        required: ["project_id", "file_path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_current_files",
      description:
        "List ALL files in the CURRENT canvas (the one the user is editing right now), with full paths. Use this BEFORE making changes that touch files outside the active tab — you are blind to other files until you call this. Returns an array of { path, language, size }.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_current_file",
      description:
        "Read the full contents of any file in the CURRENT canvas by path. Call list_current_files first to discover paths. Essential whenever the user references a file that isn't the active tab.",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path from list_current_files (e.g. 'src/components/Foo.tsx')" },
        },
        required: ["file_path"],
        additionalProperties: false,
      },
    },
  },
];

function searchDocs(query: string, limit = 5): string {
  const q = query.toLowerCase().trim();
  if (!q) return JSON.stringify({ results: [] });
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = (DOCS_INDEX as any[]).map((d) => {
    const hay = `${d.title} ${d.category} ${d.summary} ${d.slug}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += 2;
      if (d.title.toLowerCase().includes(t)) score += 3;
      if (d.slug.toLowerCase().includes(t)) score += 2;
    }
    return { d, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.min(limit || 5, 10));
  return JSON.stringify({
    results: scored.map(({ d }) => ({ slug: d.slug, title: d.title, category: d.category, summary: d.summary })),
    next_step: scored.length > 0 ? "Call read_doc with the most relevant slug to get full content before answering." : "No matches; try web_search.",
  });
}

function readDoc(slug: string): string {
  const doc = (DOCS_INDEX as any[]).find((d) => d.slug === slug);
  if (!doc) return JSON.stringify({ error: `Doc '${slug}' not found. Use search_docs to find valid slugs.` });
  return JSON.stringify({ slug: doc.slug, title: doc.title, category: doc.category, content: doc.content });
}

async function listMyProjects(supabase: any, userId: string, currentProjectId: string | null, query?: string, limit = 20): Promise<string> {
  try {
    let q = supabase.from("projects").select("id, name, language, description, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(Math.min(limit || 20, 50));
    if (currentProjectId) q = q.neq("id", currentProjectId);
    if (query) q = q.ilike("name", `%${query}%`);
    const { data, error } = await q;
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ projects: data || [] });
  } catch (e: any) {
    return JSON.stringify({ error: e?.message || "Failed to list projects" });
  }
}

async function searchPublicProjects(supabase: any, query?: string, limit = 20): Promise<string> {
  try {
    let q = supabase
      .from("projects")
      .select("id, name, language, description, updated_at, user_id")
      .eq("is_public", true)
      .order("stars_count", { ascending: false })
      .limit(Math.min(limit || 20, 50));
    if (query) q = q.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    const { data, error } = await q;
    if (error) return JSON.stringify({ error: error.message });
    return JSON.stringify({ projects: data || [] });
  } catch (e: any) {
    return JSON.stringify({ error: e?.message || "Failed to search public projects" });
  }
}

function flattenProjectFiles(files: any): Array<{ path: string; content: string }> {
  const flat: Array<{ path: string; content: string }> = [];
  const walk = (nodes: any[], prefix = "") => {
    for (const n of nodes || []) {
      const p = prefix ? `${prefix}/${n.name}` : n.name;
      if (n.type === "folder" && n.children) walk(n.children, p);
      else if (n.type === "file") flat.push({ path: p, content: n.content || "" });
    }
  };
  if (Array.isArray(files)) walk(files);
  return flat;
}

async function readProjectFile(supabase: any, userId: string, projectId: string, filePath: string): Promise<string> {
  try {
    const { data, error } = await supabase.from("projects").select("id, name, files, user_id, is_public").eq("id", projectId).maybeSingle();
    if (error) return JSON.stringify({ error: error.message });
    if (!data) return JSON.stringify({ error: "Project not found" });
    if (data.user_id !== userId && !data.is_public) {
      return JSON.stringify({ error: "Access denied: project is private and belongs to another user" });
    }
    const flat = flattenProjectFiles(data.files);
    const norm = filePath.replace(/^\/+/, "");
    const match = flat.find((f) => f.path === norm || f.path.endsWith("/" + norm) || f.path.split("/").pop() === norm);
    if (!match) return JSON.stringify({ error: `File '${filePath}' not found`, available_files: flat.map((f) => f.path).slice(0, 50) });
    const content = match.content.length > 20000 ? match.content.slice(0, 20000) + "\n\n... [truncated]" : match.content;
    return JSON.stringify({ project: data.name, file: match.path, content });
  } catch (e: any) {
    return JSON.stringify({ error: e?.message || "Failed to read file" });
  }
}

async function listCurrentFiles(supabase: any, userId: string, projectId: string | null): Promise<string> {
  if (!projectId) return JSON.stringify({ error: "No active project. The current canvas hasn't been saved yet." });
  try {
    const { data, error } = await supabase.from("projects").select("files, user_id, is_public").eq("id", projectId).maybeSingle();
    if (error) return JSON.stringify({ error: error.message });
    if (!data) return JSON.stringify({ error: "Project not found" });
    if (data.user_id !== userId && !data.is_public) return JSON.stringify({ error: "Access denied" });
    const flat = flattenProjectFiles(data.files);
    return JSON.stringify({
      files: flat.map((f) => ({ path: f.path, size: f.content.length, language: f.path.split(".").pop() || "" })),
      total: flat.length,
    });
  } catch (e: any) {
    return JSON.stringify({ error: e?.message || "Failed to list files" });
  }
}

async function readCurrentFile(supabase: any, userId: string, projectId: string | null, filePath: string): Promise<string> {
  if (!projectId) return JSON.stringify({ error: "No active project saved." });
  return readProjectFile(supabase, userId, projectId, filePath);
}

function buildMCPTool(mcpServers: any[]): any {
  const serverList = mcpServers.map((s: any) => s.name).join(", ");
  return {
    type: "function",
    function: {
      name: "mcp_call",
      description: `Call a configured MCP (Model Context Protocol) server to retrieve data or perform actions. Available servers: ${serverList}. Use JSON-RPC format for the request body.`,
      parameters: {
        type: "object",
        properties: {
          server_name: {
            type: "string",
            description: `Name of the MCP server to call. One of: ${serverList}`,
          },
          method: {
            type: "string",
            description:
              "The JSON-RPC method to call, e.g. 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get'",
          },
          params: {
            type: "object",
            description: "Parameters for the JSON-RPC method call",
          },
        },
        required: ["server_name", "method"],
        additionalProperties: false,
      },
    },
  };
}

// Provider endpoint configurations for BYOK
const BYOK_DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  anthropic: "claude-3-5-sonnet-latest",
  gemini: "gemini-2.5-pro",
  perplexity: "sonar",
  deepseek: "deepseek-chat",
  xai: "grok-4-fast",
  cohere: "command-r-plus",
  openrouter: "openai/gpt-4o",
  github: "gpt-4o",
};

const BYOK_PROVIDERS: Record<string, { url: string; headerKey: string }> = {
  openai: { url: "https://api.openai.com/v1/chat/completions", headerKey: "Bearer" },
  anthropic: { url: "https://api.anthropic.com/v1/messages", headerKey: "x-api-key" },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", headerKey: "Bearer" },
  perplexity: { url: "https://api.perplexity.ai/chat/completions", headerKey: "Bearer" },
  deepseek: { url: "https://api.deepseek.com/v1/chat/completions", headerKey: "Bearer" },
  xai: { url: "https://api.x.ai/v1/chat/completions", headerKey: "Bearer" },
  cohere: { url: "https://api.cohere.com/v2/chat", headerKey: "Bearer" },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", headerKey: "Bearer" },
  github: { url: "https://models.inference.ai.azure.com/chat/completions", headerKey: "Bearer" },
};

async function executeWebSearch(query: string, apiKey: string): Promise<string> {
  try {
    const searchResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a web search engine assistant. Provide comprehensive, factual, up-to-date information. Include code examples for programming topics.",
          },
          { role: "user", content: `Search query: "${query}"\n\nProvide comprehensive search results for this query.` },
        ],
      }),
    });
    if (!searchResp.ok) return `Search for "${query}" failed.`;
    const searchData = await searchResp.json();
    return searchData.choices?.[0]?.message?.content || "No results found.";
  } catch (err) {
    console.error("Web search error:", err);
    return `Search for "${query}" encountered an error.`;
  }
}

async function executeMCPCall(serverName: string, method: string, params: any, mcpServers: any[]): Promise<string> {
  const server = mcpServers.find((s: any) => s.name.toLowerCase() === serverName.toLowerCase());
  if (!server) {
    return JSON.stringify({
      error: `MCP server "${serverName}" not found. Available: ${mcpServers.map((s: any) => s.name).join(", ")}`,
    });
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (server.api_key) {
      headers["Authorization"] = `Bearer ${server.api_key}`;
    }

    const body = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method,
      params: params || {},
    };

    console.log(`MCP call to ${server.name} (${server.url}): ${method}`);

    const resp = await fetch(server.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`MCP server error (${resp.status}):`, errText.slice(0, 500));
      return JSON.stringify({ error: `MCP server returned ${resp.status}: ${errText.slice(0, 300)}` });
    }

    const contentType = resp.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream")) {
      // Handle SSE responses - collect all data events
      const text = await resp.text();
      const results: any[] = [];
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            results.push(JSON.parse(line.slice(6)));
          } catch {
            /* skip */
          }
        }
      }
      return JSON.stringify(results.length === 1 ? results[0] : results);
    }

    const data = await resp.json();
    return JSON.stringify(data);
  } catch (err) {
    console.error(`MCP call error:`, err);
    return JSON.stringify({ error: `Failed to call MCP server "${serverName}": ${err}` });
  }
}

async function callBYOKProvider(
  provider: string,
  apiKey: string,
  messages: any[],
  stream: boolean,
  requestedModel?: string,
  tools?: any[],
  options?: { temperature?: number; maxTokens?: number; thinkingBudget?: number },
): Promise<Response> {
  const config = BYOK_PROVIDERS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const model = requestedModel || BYOK_DEFAULT_MODELS[provider] || "gpt-4o";
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 4096;

  // Anthropic has a different API format
  if (provider === "anthropic") {
    const systemMsg = messages.find((m: any) => m.role === "system");
    const nonSystemMsgs = messages.filter((m: any) => m.role !== "system");

    const body: any = {
      model,
      max_tokens: maxTokens,
      system: systemMsg?.content || "",
      messages: nonSystemMsgs,
      stream,
      temperature,
    };
    if (options?.thinkingBudget && options.thinkingBudget > 0) {
      body.thinking = { type: "enabled", budget_tokens: options.thinkingBudget };
      delete body.temperature; // Anthropic doesn't allow temperature with thinking
    }
    if (tools && tools.length > 0) {
      body.tools = tools.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    return fetch(config.url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  }

  // OpenAI-compatible format
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const body: any = { model, messages, stream, temperature, max_tokens: maxTokens };
  if (options?.thinkingBudget && options.thinkingBudget > 0) {
    // For Gemini/OpenAI reasoning models
    body.reasoning_effort = options.thinkingBudget > 16384 ? "high" : options.thinkingBudget > 4096 ? "medium" : "low";
  }
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  return fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const DAILY_LIMITS: Record<string, number> = { pro: 5, flash: 10, lite: -1 };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase config missing");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const {
      messages,
      currentFile,
      consoleErrors,
      workflows,
      agentMode,
      model,
      byokProvider,
      byokModel,
      temperature: reqTemperature,
      maxTokens: reqMaxTokens,
      thinkingBudget: reqThinkingBudget,
      enableWebSearch,
      enableCodeExecution,
      enableMCP,
      template,
      automationConfig,
      projectId: currentProjectId,
    } = await req.json();

    // Check if user has a custom API key for the selected BYOK provider
    let userApiKey: string | null = null;
    let selectedProvider: string | null = null;

    if (byokProvider && BYOK_PROVIDERS[byokProvider]) {
      const { data: keyData } = await supabase
        .from("user_api_keys")
        .select("api_key")
        .eq("user_id", userId)
        .eq("provider", byokProvider)
        .single();

      if (keyData) {
        userApiKey = (keyData as any).api_key;
        selectedProvider = byokProvider;
      }
    }

    // If no BYOK, check for any user key to bypass limits
    let hasByokKey = !!userApiKey;
    if (!hasByokKey) {
      const { data: anyKey } = await supabase
        .from("user_api_keys")
        .select("provider, api_key")
        .eq("user_id", userId)
        .limit(1);

      if (anyKey && anyKey.length > 0) {
        hasByokKey = true;
        if (!userApiKey) {
          userApiKey = (anyKey[0] as any).api_key;
          selectedProvider = (anyKey[0] as any).provider;
        }
      }
    }

    // Rate limiting for built-in keys
    const modelTier = model || "flash";
    if (!hasByokKey) {
      const limit = DAILY_LIMITS[modelTier];
      if (limit !== -1) {
        const serviceSupabase = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

        const today = new Date().toISOString().split("T")[0];
        const { data: usageData } = await serviceSupabase
          .from("ai_usage_tracking")
          .select("request_count")
          .eq("user_id", userId)
          .eq("model_tier", modelTier)
          .eq("usage_date", today)
          .single();

        const currentCount = (usageData as any)?.request_count || 0;
        if (currentCount >= limit) {
          return new Response(
            JSON.stringify({
              error: `Daily limit reached for ${modelTier.toUpperCase()} model (${limit} requests/day). Add your own API key for unlimited usage, or try the Lite model (free & unlimited).`,
              rateLimited: true,
              tier: modelTier,
              limit,
              used: currentCount,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (usageData) {
          await serviceSupabase
            .from("ai_usage_tracking")
            .update({ request_count: currentCount + 1 })
            .eq("user_id", userId)
            .eq("model_tier", modelTier)
            .eq("usage_date", today);
        } else {
          await serviceSupabase
            .from("ai_usage_tracking")
            .insert({ user_id: userId, model_tier: modelTier, usage_date: today, request_count: 1 });
        }
      }
    }

    // Fetch user's enabled MCP servers and agent skills
    const serviceSupabaseForContext = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;
    const [{ data: mcpServers }, { data: agentSkills }] = await Promise.all([
      serviceSupabaseForContext
        .from("mcp_servers")
        .select("name, url, description, api_key, is_enabled")
        .eq("user_id", userId)
        .eq("is_enabled", true),
      serviceSupabaseForContext
        .from("agent_skills")
        .select("name, description, instruction, is_enabled")
        .eq("user_id", userId)
        .eq("is_enabled", true),
    ]);

    // Build tools list based on toggles (default to enabled if not specified)
    const tools: any[] = [];
    const enabledMCPServers = (mcpServers as any[]) || [];
    if (enableWebSearch !== false) {
      tools.push(...BASE_TOOLS);
    }
    if (enableMCP !== false && enabledMCPServers.length > 0) {
      tools.push(buildMCPTool(enabledMCPServers));
    }

    // Build provider options from request params
    const providerOptions = {
      temperature: reqTemperature,
      maxTokens: reqMaxTokens,
      thinkingBudget: reqThinkingBudget,
    };

    const incomingMessages = Array.isArray(messages) ? messages : [];
    const incomingSystemInstructions = incomingMessages
      .filter((m: any) => m?.role === "system" && typeof m.content === "string" && m.content.trim())
      .map((m: any) => m.content.trim())
      .join("\n\n");
    const conversationMessages = incomingMessages.filter((m: any) => m?.role !== "system");

    // Build context
    let contextSection = "";
    if (currentFile) {
      contextSection += `\n### Active File: \`${currentFile.name}\`\n**Language**: ${currentFile.language || "unknown"}\n\n\`\`\`${currentFile.language || ""}\n${currentFile.content}\n\`\`\`\n`;
    } else {
      contextSection += "📂 No file is currently open.";
    }
    if (consoleErrors) {
      contextSection += `\n\n### 🔴 Console Errors\n\`\`\`\n${consoleErrors}\n\`\`\``;
    }
    if (workflows && workflows.length > 0) {
      contextSection += `\n\n### 🔧 Existing Workflows\n${workflows.map((w: any) => `- **${w.name}** (${w.type}): \`${w.command}\``).join("\n")}`;
    }
    if (enabledMCPServers.length > 0) {
      contextSection += `\n\n### 🔌 Connected MCP Servers\nYou have MCP servers available. Use the \`mcp_call\` tool to interact with them. Start by calling \`tools/list\` to discover available tools, then use \`tools/call\` with the appropriate tool name and arguments.\n${enabledMCPServers.map((s: any) => `- **${s.name}**: ${s.url}${s.description ? ` — ${s.description}` : ""}`).join("\n")}`;
    }
    if (agentSkills && (agentSkills as any[]).length > 0) {
      contextSection += `\n\n### 🧠 Active Agent Skills\nFollow these custom instructions provided by the user:\n${(agentSkills as any[]).map((s: any) => `#### ${s.name}${s.description ? ` (${s.description})` : ""}\n${s.instruction}`).join("\n\n")}`;
    }
    if (automationConfig) {
      contextSection += `\n\n### 🔧 Current Automation Pipeline (\`automation.config.json\`)\n\`\`\`json\n${automationConfig}\n\`\`\`\nYou can modify this file to update the automation pipeline. Changes will be synced to the visual editor automatically.`;
    }

    const emailCapabilityNote = `\n\n### 📬 In-App Messaging (Email)\nThe user has an in-app inbox & messaging system (the \`messages\` table). You CAN read and send messages on the user's behalf, but ONLY with their explicit permission. Workflow:\n1. When the user asks you to send a message or check their inbox, FIRST confirm: "I'd like permission to [read your inbox / send this message to <recipient>]. Confirm?".\n2. Only proceed after the user types a clear yes/confirm.\n3. To send, draft the subject + body, then instruct the user to click Send in the Inbox dialog (User menu → Inbox → Compose) — or, if you have direct DB tools available, use them with their permission.\n4. Never send unsolicited messages, never read inbox content without asking first.`;

    const customSystemSection = incomingSystemInstructions
      ? `\n\n## USER-PROVIDED SYSTEM INSTRUCTIONS\n${incomingSystemInstructions}`
      : "";

    const systemPrompt = agentMode
      ? buildSystemPrompt(template) + "\n" + contextSection + emailCapabilityNote
      : `You are a helpful AI coding assistant in Code Canvas Complete. This IDE runs code through Wandbox. .replit files do nothing here.\n\nCRITICAL: NEVER suggest the user switch to another IDE (Replit, CodeSandbox, StackBlitz, VS Code, etc.). Code Canvas Complete is fully capable.\n\n${contextSection}${emailCapabilityNote}`;

    const aiMessages = [{ role: "system", content: systemPrompt + customSystemSection }, ...conversationMessages];

    // === Helper: execute tool calls and return results ===
    async function executeToolCalls(toolCalls: any[], lovableApiKey?: string): Promise<any[]> {
      const results: any[] = [];
      for (const call of toolCalls) {
        const fnName = call?.function?.name;
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* empty */
        }

        let result = "";
        if (fnName === "web_search") {
          const key = lovableApiKey || Deno.env.get("LOVABLE_API_KEY") || "";
          result = args.query ? await executeWebSearch(args.query, key) : "Search failed: query was missing.";
        } else if (fnName === "mcp_call") {
          result = await executeMCPCall(args.server_name || "", args.method || "", args.params, enabledMCPServers);
        } else if (fnName === "search_docs") {
          result = args.query ? searchDocs(args.query, args.limit) : JSON.stringify({ error: "query required" });
        } else if (fnName === "read_doc") {
          result = args.slug ? readDoc(args.slug) : JSON.stringify({ error: "slug required" });
        } else if (fnName === "list_my_projects") {
          result = await listMyProjects(serviceSupabaseForContext, userId, currentProjectId || null, args.query, args.limit);
        } else if (fnName === "read_project_file") {
          result = (args.project_id && args.file_path)
            ? await readProjectFile(serviceSupabaseForContext, userId, args.project_id, args.file_path)
            : JSON.stringify({ error: "project_id and file_path required" });
        } else if (fnName === "search_public_projects") {
          result = await searchPublicProjects(serviceSupabaseForContext, args.query, args.limit);
        } else if (fnName === "list_current_files") {
          result = await listCurrentFiles(serviceSupabaseForContext, userId, currentProjectId || null);
        } else if (fnName === "read_current_file") {
          result = args.file_path
            ? await readCurrentFile(serviceSupabaseForContext, userId, currentProjectId || null, args.file_path)
            : JSON.stringify({ error: "file_path required" });
        } else {
          result = `Unknown tool: ${fnName}`;
        }

        results.push({
          role: "tool",
          tool_call_id: call.id,
          name: fnName,
          content: result,
        });
      }
      return results;
    }

    // === BYOK path: call external provider with tool support ===
    if (userApiKey && selectedProvider && !BYOK_PROVIDERS[selectedProvider]) {
      console.warn(`BYOK provider "${selectedProvider}" not supported for chat. Falling back to Lovable AI.`);
      selectedProvider = null;
      userApiKey = null;
    }
    if (userApiKey && selectedProvider) {
      const effectiveByokModel = byokModel || BYOK_DEFAULT_MODELS[selectedProvider] || "gpt-4o";
      console.log(`Using BYOK provider: ${selectedProvider}, model: ${effectiveByokModel}`);
      try {
        // Use non-streaming tool loop, then stream final response
        const conversation: any[] = [...aiMessages];

        for (let i = 0; i < 4; i++) {
          const byokResponse = await callBYOKProvider(
            selectedProvider,
            userApiKey,
            conversation,
            false,
            effectiveByokModel,
            tools.length > 0 ? tools : undefined,
            providerOptions,
          );

          if (!byokResponse.ok) {
            const errText = await byokResponse.text();
            console.error(`BYOK error (${selectedProvider}):`, byokResponse.status, errText);
            return new Response(
              JSON.stringify({
                error: `${selectedProvider} API error (${byokResponse.status}): ${errText.slice(0, 200)}`,
              }),
              { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }

          let assistantMessage: any;

          if (selectedProvider === "anthropic") {
            // Parse Anthropic response format
            const data = await byokResponse.json();
            const textContent =
              data.content
                ?.filter((b: any) => b.type === "text")
                .map((b: any) => b.text)
                .join("") || "";
            const toolUseBlocks = data.content?.filter((b: any) => b.type === "tool_use") || [];

            if (toolUseBlocks.length === 0) {
              // No tool calls, stream the final response
              const encoder = new TextEncoder();
              const stream = new ReadableStream({
                start(controller) {
                  const chunk = { choices: [{ delta: { content: textContent } }] };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                },
              });
              return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
            }

            // Execute Anthropic tool calls
            conversation.push({ role: "assistant", content: data.content });
            for (const tu of toolUseBlocks) {
              let result = "";
              if (tu.name === "web_search") {
                const key = Deno.env.get("LOVABLE_API_KEY") || "";
                result = tu.input?.query ? await executeWebSearch(tu.input.query, key) : "Search failed.";
              } else if (tu.name === "mcp_call") {
                result = await executeMCPCall(
                  tu.input?.server_name || "",
                  tu.input?.method || "",
                  tu.input?.params,
                  enabledMCPServers,
                );
              }
              conversation.push({
                role: "user",
                content: [{ type: "tool_result", tool_use_id: tu.id, content: result }],
              });
            }
            continue;
          }

          // OpenAI-compatible response
          const data = await byokResponse.json();
          assistantMessage = data?.choices?.[0]?.message;
          if (!assistantMessage) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ choices: [{ delta: { content: "I could not produce a response." } }] })}\n\n`,
                  ),
                );
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });
            return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
          }

          const toolCallsInResponse = assistantMessage.tool_calls || [];
          conversation.push(assistantMessage);

          if (toolCallsInResponse.length === 0) {
            // No tool calls - stream the final content
            const finalContent = assistantMessage.content || "";
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              start(controller) {
                const chunk = { choices: [{ delta: { content: finalContent } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });
            return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
          }

          // Execute tool calls
          const toolResults = await executeToolCalls(toolCallsInResponse);
          conversation.push(...toolResults);
        }

        // Fallback if loop exhausted
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: "Tool call loop exhausted. Please try again." } }] })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      } catch (byokErr) {
        console.error("BYOK call failed:", byokErr);
        return new Response(JSON.stringify({ error: `Failed to call ${selectedProvider}: ${byokErr}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === Built-in AI path ===
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY || LOVABLE_API_KEY === "placeholder") {
      return new Response(
        JSON.stringify({
          error:
            "Built-in AI is not available. Please add your own API key (OpenAI, Anthropic, Gemini, etc.) in the API Keys settings to use the AI chat.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const MODEL_MAP: Record<string, string> = {
      pro: "google/gemini-3.1-pro-preview",
      flash: "google/gemini-3-flash-preview",
      lite: "openai/gpt-5-nano",
    };
    const selectedModel = MODEL_MAP[model] || MODEL_MAP.flash;
    console.log(`Using Lovable gateway with model: ${selectedModel}`);

    const conversation: any[] = [...aiMessages];
    let finalAssistantContent = "";

    for (let i = 0; i < 4; i++) {
      const completionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: conversation,
          tools,
          tool_choice: "auto",
          stream: false,
        }),
      });

      if (!completionResponse.ok) {
        const errorText = await completionResponse.text();
        console.error(`Lovable gateway error (${completionResponse.status}):`, errorText.slice(0, 200));

        if (completionResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            error: "Built-in AI service unavailable. Please use your own API key (BYOK) instead.",
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const completionData = await completionResponse.json();
      const assistantMessage = completionData?.choices?.[0]?.message;
      if (!assistantMessage) {
        finalAssistantContent = "I could not produce a response.";
        break;
      }

      const toolCallsInResponse = assistantMessage.tool_calls || [];
      conversation.push(assistantMessage);

      if (toolCallsInResponse.length === 0) {
        finalAssistantContent = assistantMessage.content || "";
        break;
      }

      const toolResults = await executeToolCalls(toolCallsInResponse, LOVABLE_API_KEY);
      conversation.push(...toolResults);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const chunk = { choices: [{ delta: { content: finalAssistantContent || "" } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
