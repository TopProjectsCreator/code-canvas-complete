# Code Canvas Complete

Code Canvas Complete is a browser-based coding workspace with an integrated AI assistant, multi-file editing, workflow automation, package management helpers, and optional BYOK (bring-your-own-key) model routing.

## What this project is

This app is a Vite + React + TypeScript IDE-style interface with:

- File/project editing UI
- AI chat with tool-style actions (code changes, workflows, package installs, etc.)
- Interactive question prompts (`ask_prompt` blocks rendered in-chat)
- Optional BYOK provider support (OpenAI, Anthropic, Gemini, Perplexity, DeepSeek, xAI, Cohere, OpenRouter)
- Supabase Edge Functions backend for chat and media generation flows

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
- Supabase project (for auth + edge functions)

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create a `.env` file (or equivalent platform env config) with your frontend variables, for example:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
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


1. **Create a new Repl** from the GitHub repository.
<img width="600" height="296" alt="image" src="https://github.com/user-attachments/assets/f0033af4-cba9-4941-b89d-241ee891a6e4" />

2. Select **lovable**, then input the following URL:
`https://github.com/TopProjectsCreator/code-canvas-complete`
<img width="600" height="296" alt="image" src="https://github.com/user-attachments/assets/27955b24-1224-43bb-831c-6be61cc9268b" />

3. **Replit Agent** will automatically set up the environment and prepare the project to run.
<img width="250" height="466" alt="image" src="https://github.com/user-attachments/assets/ebf4f5e0-3ad5-4a4e-9b55-9bc60dcb5776" />


**Key Features**

* **Automated Migration:** Replit Agent handles the transfer of your database and AI providers directly into the Replit ecosystem.
* **Deployment:** For an always-on or public-facing application, remember to configure a **Replit Deployment** within the project settings.


For production mode in Replit:

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
