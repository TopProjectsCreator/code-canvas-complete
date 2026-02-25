# Code Canvas Complete

Code Canvas Complete is a browser-based coding workspace with an integrated AI assistant, multi-file editing, workflow automation, package management helpers, and optional BYOK (bring-your-own-key) model routing.

## What this project is

This app is a Vite + React + TypeScript IDE-style interface with:

- File/project editing UI
- AI chat with tool-style actions (code changes, workflows, package installs, etc.)
- Interactive question prompts (`ask_prompt` blocks rendered in-chat)
- Optional BYOK provider support (OpenAI, Anthropic, Gemini, Perplexity, DeepSeek, xAI, Cohere, OpenRouter)
- Supabase Edge Functions backend for chat and media generation flows

## AI assistant functions

The in-app AI assistant supports the following tool/function actions:

- `analyze_code` — analyze code for bugs, style, performance, security, or overall quality.
- `suggest_fix` — propose a concrete fix for a specific issue.
- `apply_code` — apply code changes to a file.
- `search_codebase` — search the project for relevant files/snippets.
- `run_code` — run code and inspect results.
- `explain_error` — explain an error and suggest solutions.
- `generate_tests` — generate tests for a target function.
- `refactor_code` — refactor code for readability, structure, or performance.
- `create_workflow` — create reusable workflow automation.
- `run_workflow` — execute a saved workflow.
- `list_workflows` — list available workflows.
- `install_package` — install a dependency/package.
- `set_theme` — change the editor/UI theme.
- `create_custom_theme` — create and apply a custom theme.
- `generate_image` — generate an image from a prompt.
- `generate_music` — generate music/audio from a prompt.
- `git_commit` — create a Git commit.
- `git_init` — initialize a Git repository.
- `git_create_branch` — create a new Git branch.
- `git_import` — import a repository/project from Git.
- `make_public` — make a project publicly shareable.
- `make_private` — make a project private.
- `get_project_link` — retrieve a project share link.
- `share_twitter` — prepare/share to X (Twitter).
- `share_linkedin` — prepare/share to LinkedIn.
- `share_email` — prepare/share via email.
- `fork_project` — fork a project.
- `star_project` — star/favorite a project.
- `view_history` — view project history/changes.
- `ask_user` — ask follow-up questions via interactive prompts.
- `save_project` — save current project state.
- `run_project` — run/preview the full project.
- `run_shell` — execute shell commands.

## AI assistant widgets and interactive capabilities

In addition to tool calls, the assistant can render interactive chat widgets and prompts:

- **Thinking process visibility** — the chat can show step-by-step reasoning/status blocks (e.g. thinking, tool calls, and code changes) so you can follow what the assistant is doing.
- **Interactive questions** — follow-up prompts such as text, multiple choice, ranking, sliders, yes/no, number, date/time, and email inputs.
- `color_picker` — pick and preview colors.
- `coin_flip` — flip a virtual coin.
- `dice_roll` — roll dice.
- `calculator` — run quick calculations.
- `spinner` — spin a random selector.
- `stock` — view stock info widgets.
- `change_template` — switch project/template context.
- `pomodoro` — run a pomodoro timer.
- `project_stats` — show project-level stats.
- `logic_visualizer` — visualize logic/flow.
- `asset_search` — search for assets.
- `viewport_preview` — preview multiple viewport sizes.
- `a11y_audit` — run accessibility-oriented checks.
- `todo_tracker` — track tasks and status.
- `dependency_visualizer` — visualize project dependencies.
- `readme_generator` — generate README scaffolding/content.
- `code_review` — render review-oriented feedback widgets.

## Tech stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui + Radix UI
- Supabase (Auth + Edge Functions + DB)

## Local development

### Prerequisites

- Node.js 18+
- npm 9+
- **PLATFORM DEPENDENT**: Supabase project (for auth + edge functions)

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create a `.env` file (or equivalent platform env config) with your frontend variables, for example:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
# VITE_DEPLOY_PLATFORM=generic|replit|lovable   (It should autodetect)
# Optional auth-specific toggles used by platform detection fallback:
# VITE_REPLIT_AUTH_ENABLED=true
# VITE_LOVABLE_AUTH_ENABLED=true
# VITE_REPLIT_AI_BASE_URL=https://...
# VITE_REPLIT_DB_BASE_URL=https://...
# VITE_REPLIT_DB_TOKEN=...
# VITE_LOVABLE_AI_BASE_URL=https://...
# VITE_LOVABLE_DB_BASE_URL=https://...
# VITE_LOVABLE_DB_TOKEN=...
```

If running Edge Functions locally/remotely, configure function secrets in Supabase as needed (for example service role keys and any AI gateway keys used by your setup).

### 3) Start dev server

```bash
npm run dev
```

### 4) Build for production

```bash
npm run build
npm run preview
```

## Deployment

Below are self-managed deployment paths.

---

### Deploy on Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, **New Project** → import the repository.
3. Framework preset: **Vite** (usually auto-detected).
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add environment variables (at least frontend Supabase values).
7. Deploy.

> Note: Supabase Edge Functions are deployed through Supabase CLI, not Vercel.

---

### Deploy on Koyeb

1. Create a new **Web Service** from your repository.
2. Use a Node buildpack or Dockerfile-based service.
3. Configure:
   - Build command: `npm run build`
   - Run command (static serving option): `npm run preview -- --host 0.0.0.0 --port $PORT`
4. Add required environment variables.
5. Deploy service.

For production-grade static hosting on Koyeb, you can also deploy via a custom Docker image using an Nginx/static server stage.

---

### Deploy on Replit


1. **Create a new Canvas project** from the GitHub repository on Replit.
<img width="600" height="296" alt="image" src="https://github.com/user-attachments/assets/f0033af4-cba9-4941-b89d-241ee891a6e4" />

2. Select **Github**, then input the following URL:
`https://github.com/TopProjectsCreator/code-canvas-complete`
<img width="600" height="296" alt="image" src="https://github.com/user-attachments/assets/33e866c9-cab2-4810-aad4-516f8635933b" />

3. **Replit Agent** will automatically set up the environment and prepare Code Canvas Complete to run.
<img width="600" height="296" alt="image" src="https://github.com/user-attachments/assets/2bbe95b5-da39-4f2e-b521-75dff2852713" />

Notes:
 - On the top right of the preview:
 <img width="200" height="150" alt="image" src="https://github.com/user-attachments/assets/f8f095ce-ea1e-4736-bda7-a190cc12cec2" />
is a icon that looks like <img width="15" height="15" alt="image" src="https://github.com/user-attachments/assets/26fbe487-c17a-4aac-a086-b64f9805094f" />.
Click on it to get it pop out into a new page
<img width="600" height="296" alt="image" src="https://github.com/user-attachments/assets/0fa4a615-f25c-441d-a77c-0abee9f44c12" />


**Key Features**

* **Automated Migration:** Replit Agent handles the transfer of your database and AI providers directly into the Replit ecosystem.
* **Deployment:** For an always-on or public-facing application, remember to configure a **Replit Deployment** within the project settings.


For production mode on Replit (Code Canvas Complete):

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 3000
```

---

### Deploy on Lovable

1. Create a project connected to this repository.
2. Configure required environment variables in project settings.
3. Use the platform publish/deploy flow to build and host the app.
4. Deploy Supabase Edge Functions separately via Supabase CLI.

---

## Supabase Edge Functions

This repo includes Edge Functions under `supabase/functions/` (e.g. AI chat handling).

Typical deployment flow:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy ai-chat
```

Repeat deploy for any additional functions you use.

## Useful scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run preview` — preview built app
- `npm run lint` — linting
- `npm run test` — run tests

## Notes

- If BYOK is enabled, make sure user API keys are saved for the desired provider before testing provider-specific model routing.
- Keep frontend env vars (`VITE_*`) separate from sensitive server secrets used by Edge Functions.

## Contributing

We are open to contributions! See CONTRIBUTING.md for more info.
