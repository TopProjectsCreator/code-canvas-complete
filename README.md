[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/TopProjectsCreator/code-canvas-complete)

# Code Canvas Complete

Code Canvas Complete is a powerful, browser-based coding workspace featuring an integrated AI assistant, multi-file editing, workflow automation, and a rich set of editors for various media types.

![Code Canvas Teaser](teaser.gif)

## Key Features

### 🚀 IDE & Core Editor
- **Multi-file Editing:** Full-featured IDE interface with tabs and file tree.
- **WebContainer Integration:** Run Node.js, bash, and shell commands directly in your browser.
- **Advanced Workbench:** Integrated tools for professional development workflows.
- **Git Integration:** Built-in Git panel for commits, branching, and repository management.
- **Package Management:** Easy dependency installation and management.
- **Search & Replace:** Global search and replace across the entire codebase.

### 🤖 AI-Powered Development
- **Intelligent Assistant:** Multi-model AI (OpenAI, Anthropic, Gemini, etc.) that can write code, run commands, and manage files.
- **MCP & Skills:** Support for Model Context Protocol (MCP) and custom AI skills.
- **AI Comparison:** Compare outputs from different AI models side-by-side.
- **Workflow Automation:** Create and execute complex automated workflows.

<details>
<summary><b>View AI Assistant Tools & Functions</b></summary>

The in-app AI assistant supports a wide range of tool-style actions to automate your development:

#### Code & Project Management
- `analyze_code` — analyze code for bugs, style, performance, security, or quality.
- `suggest_fix` — propose a concrete fix for a specific issue.
- `apply_code` — apply code changes to a file.
- `search_codebase` — search the project for relevant files/snippets.
- `run_code` — run code and inspect results.
- `explain_error` — explain an error and suggest solutions.
- `generate_tests` — generate tests for a target function.
- `refactor_code` — refactor code for readability, structure, or performance.
- `rename_file` / `delete_file` — manage the file system.
- `save_project` / `run_project` — manage project lifecycle.

#### Terminal & Workflow
- `run_shell` — execute shell commands (via WebContainers).
- `install_package` — install a dependency/package.
- `create_workflow` / `run_workflow` / `list_workflows` — automate complex tasks.

#### Git Operations
- `git_init` — initialize a Git repository.
- `git_commit` — create a Git commit.
- `git_create_branch` — create a new Git branch.
- `git_import` — import a repository/project from Git.

#### Media & UI
- `generate_image` — generate an image from a prompt.
- `generate_music` — generate music/audio from a prompt.
- `set_theme` / `create_custom_theme` — customize the editor UI.

#### Collaboration & Sharing
- `make_public` / `make_private` — control project visibility.
- `get_project_link` — retrieve a project share link.
- `share_twitter` / `share_linkedin` / `share_email` — social sharing.
- `fork_project` / `star_project` — social features.

#### Interactive Widgets
The assistant can also render specialized widgets in chat:
- `color_picker`, `calculator`, `pomodoro`, `stock` viewer, `logic_visualizer`, `regex_tester`, `json_viewer`, `todo_tracker`, `a11y_audit`, and more.
</details>

### 🎨 Specialized Editors
- **Arduino IDE:** Full Arduino support with serial upload, library manager, and breadboard visualizer.
- **Scratch Integration:** Visual programming with Scratch blocks.
- **Media Editors:** Built-in Audio, Video, and CAD editors.
- **Office Suite:** Edit RTF, Rich Text, and other office-style documents.
- **Theme Creator:** Fully customizable UI with a built-in theme editor.

### 🌐 Collaboration & Publishing
- **Real-time Collaboration:** Share your workspace and collaborate with others in real-time.
- **Instant Publishing:** Publish projects to custom subdomains (e.g., `your-project.codecanvas.app`).
- **Social Sharing:** Easily share your work on Twitter, LinkedIn, or via email.

---

## Deployment Methods

<details>
<summary><b>Deploy on Vercel</b></summary>

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, **New Project** → import the repository.
3. Framework preset: **Vite** (usually auto-detected).
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add environment variables (at least frontend Supabase values).
7. Deploy.

> Note: Supabase Edge Functions are deployed through Supabase CLI, not Vercel.
</details>

<details>
<summary><b>Deploy on Koyeb</b></summary>

1. Create a new **Web Service** from your repository.
2. Use a Node buildpack or Dockerfile-based service.
3. Configure:
   - Build command: `npm run build`
   - Run command (static serving option): `npm run preview -- --host 0.0.0.0 --port $PORT`
4. Add required environment variables.
5. Deploy service.

For production-grade static hosting on Koyeb, you can also deploy via a custom Docker image using an Nginx/static server stage.
</details>

<details>
<summary><b>Deploy on Replit</b></summary>

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
</details>

<details>
<summary><b>Deploy on Lovable</b></summary>

1. Create a project connected to this repository.
2. Configure required environment variables in project settings.
3. Use the platform publish/deploy flow to build and host the app.
4. Deploy Supabase Edge Functions separately via Supabase CLI.
</details>

---

## Tech Stack
- React 18 & TypeScript
- Vite
- Tailwind CSS
- shadcn/ui + Radix UI
- Supabase (Auth + Edge Functions + DB)
- WebContainers API

## Local Development

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase project (for auth + edge functions)

### Setup
1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment:**
   Create a `.env` file with your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **Start dev server:**
   ```bash
   npm run dev
   ```

## Contributing
We are open to contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for more info.

## License
This project is licensed under the terms of the [license.md](license.md) file.
