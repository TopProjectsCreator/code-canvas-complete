[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/TopProjectsCreator/code-canvas-complete)

# Code Canvas Complete

Code Canvas Complete is an advanced, browser-based All-In-One IDE featuring an integrated AI assistant, multi-file editing, persistent shell sessions, and a massive suite of specialized editors.

![Code Canvas Teaser](teaser.gif)

## 🚀 Core IDE & Workspace

Code Canvas provides a professional development environment entirely in your browser, powered by the WebContainers API and Supabase for backend services.

<details>
<summary><b>View Workspace Features</b></summary>

- **Multi-file Editing:** Full-featured IDE interface with tabs, split views, and a hierarchical file tree.
- **WebContainer Integration:** Run Node.js, bash, and shell commands directly in your browser with near-native performance.
- **Advanced Workbench:** Integrated tools for professional development including:
    - **Minimap & Sticky Scopes:** Enhanced navigation for large files.
    - **Multi-cursor Column Editing:** Block mode editing for aligned data.
    - **Global Search & Replace:** Powerful regex-based search and replace across the entire project with live impact preview.
- **Git & Version Control:**
    - **Git Panel:** Built-in UI for commits, branching, and repository management.
    - **Provider Integration:** Seamlessly connect and sync with GitHub, GitLab, and Bitbucket.
    - **Diff Viewer:** Side-by-side comparison of file changes.
- **Package Management:** Easy dependency installation (npm, yarn, pnpm) with a dedicated management panel.
- **Environment Manager:** Securely manage, encrypt, and scope `.env` variables for different environments (Preview, Shared, Production).
</details>

## 🤖 AI-Powered Intelligence

Code Canvas features an advanced AI agent designed for full-stack autonomous development.

<details>
<summary><b>View Detailed AI Agent Capabilities</b></summary>

### 🛠️ Core AI Agent Tools
- **File System Control:** Create, read, update, move, and delete files/folders across the workspace.
- **Persistent Shell Execution:** Run complex shell commands, install packages, and manage processes directly through the terminal.
- **Git Operations:** Initialize repos, branch, commit, push, pull, and manage complex merge conflicts autonomously.
- **Project Workflows:** Execute multi-step build, test, and deploy pipelines.
- **Contextual Awareness:** Understands code, docs, hardware setups, and media assets in the current project context.

### 🧠 Intelligent Features
- **Multi-Model Support:** Compare side-by-side outputs from OpenAI, Anthropic, Gemini, and more.
- **Autonomous Modes:** Choose from Safe (human-in-the-loop), Balanced (auto-gated), or Fast (fully autonomous) modes.
- **AI Code Review:** Per-line suggestions with severity ratings and one-click acceptance.
- **Interactive Widgets:** Rich UI components rendered directly in chat (e.g., Code Review, Regex Tester, Dependency Visualizer).
- **Explain-on-Hover:** Instant AI-powered explanations for symbols, functions, or complex code blocks.
- **Multimodal Generation:** Generate media (images/audio) for mockups and documentation assets.
</details>

### 🧩 MCP & Agent Skills

Extend your AI's capabilities with custom protocols and specialized personas.

<details>
<summary><b>How to use MCP (Model Context Protocol)</b></summary>

Model Context Protocol (MCP) allows the AI to connect to external tools and data sources.
1. Navigate to the **MCP & Skills** panel in the sidebar.
2. Click **Add Server** under the MCP Servers tab.
3. Provide a **Name**, **URL** (e.g., `https://mcp.example.com`), and optional **API Key**.
4. Toggle the server to **Enabled** to give the AI access to its tools.
</details>

<details>
<summary><b>How to use Agent Skills</b></summary>

Agent Skills are custom "personas" or instruction sets that guide the AI's behavior.
1. Open the **MCP & Skills** panel and select the **Agent Skills** tab.
2. Click **Add Skill** to create your own, or browse the **Library** for presets. Browse and search over 10,000+ community AI skills from <a href="https://ai-skills.io" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">ai-skills.io</a> powered by Firecrawl.
3. Define the **Name**, **Icon**, and **Instructions** (e.g., "Always use Tailwind utility classes for styling").
4. When enabled, the AI will prioritize these instructions in every interaction.
</details>

## 💻 Persistent Shell & Terminal

Code Canvas offers a professional-grade, persistent terminal environment, ensuring your workflows remain uninterrupted.

<details>
<summary><b>View Shell & Execution Features</b></summary>

- **Full Terminal Access:** A browser-based terminal emulator with support for standard Linux commands, shell scripts, and build tools.
- **State Persistence:** Your environment remains active across sessions. Installed packages (npm/pip), file system changes, and process states (background servers/watchers) are persisted.
- **Multi-Terminal Support:** Open and manage multiple terminal instances simultaneously for parallel tasks (e.g., running a dev server in one, tests in another).
- **Container-Backed Execution:** Powered by secure, containerized runtimes, providing a near-native environment for your projects.
- **Integration with AI:** The AI agent can read terminal output, run commands to diagnose errors, and perform automated fixes based on execution results.
- **API for Advanced Automation:** Interact with the environment via `POST /sessions` and `POST /execute` endpoints.

### API Specification & Execution Modes
The `execute-code` service handles routing to different execution environments:

- **Executor Modes:**
    - `wandbox`: Standard sandboxed execution.
    - `container`: Full persistent container runner.
    - `hybrid`: Routes shell and python to containers while keeping others sandboxed.

### API Reference
- `POST /sessions`: Initialize a new persistent session.
- `POST /execute`: Run commands within a specific `sessionId` to maintain state (e.g., across `pip install` commands).

### Custom Shell Runner Example
```javascript
// Example of a compatible Shell Runner API
app.post('/sessions', (req, res) => {
  const sessionId = uuidv4();
  const shell = pty.spawn('bash', [], { name: 'xterm-color', cwd: process.env.HOME });
  // ... session management logic
  res.json({ sessionId });
});

app.post('/execute', (req, res) => {
  const { sessionId, command } = req.body;
  // ... execute in virtual terminal
  res.json({ output: session.getOutput() });
});
```
</details>

## 🛠️ Specialized Editors & Tools

Code Canvas goes beyond code, offering a full suite of creative and technical editors.

<details>
<summary><b>Arduino IDE — Board Setup, Coding, Sim, and Upload</b></summary>

### What you can do
- Create `.ino` sketches with syntax highlighting, snippets, and live diagnostics.
- Target AVR and ESP boards from a guided board selector.
- Run compile checks before upload to catch errors earlier.
- Flash firmware through USB, OTA, and supported wireless flows.
- Prototype circuits in a virtual breadboard with components and wires.
- Save and share hardware project templates across your team.

### Board + upload capabilities
- AVR tooling support with `avrdude` style workflows.
- ESP upload flows powered by `esptool`/`espota` paths.
- Board presets for common memory, clock, and upload profiles.
- Auto-detection hints for ports and device-family compatibility.
- Progress UI for compile and upload phases.
- Failure diagnostics with next-step suggestions.

### Breadboard visualizer features
- Drag-and-drop component palette (sensors, LEDs, motors, displays, modules).
- Wire mode with pin-to-pin snapping.
- Delete/select interaction modes.
- Grid-aligned placement for fast cleanup.
- Sim-centric circuit composition for rapid idea testing.
- Helpful empty/error states for beginners.

### AI-assisted hardware workflows
- “Generate starter sketch for ESP32 temperature logger.”
- “Add debounce logic to my button handling.”
- “Explain why compile fails on this board profile.”
- “Refactor this sketch into modular helper functions.”
- “Create a test matrix for sensors and expected values.”
- “Walk me through OTA flashing safely.”

### Best for
- Rapid prototyping.
- Education and workshops.
- Embedded proof-of-concepts.
- Sensor + actuator demos.

</details>

<details>
<summary><b>Scratch Integration — Visual Logic + Project Prototyping</b></summary>

### What you can do
- Build with drag-and-drop visual programming blocks.
- Prototype gameplay and interaction logic quickly.
- Switch between block-first and code-adjacent ideation.
- Use sprites and scenes to model user flows.
- Iterate with beginner-friendly feedback loops.
- Share visual concepts with non-technical stakeholders.

### Key Scratch workflows
- Event-driven logic blocks for input and state transitions.
- Motion, looks, and control stacks for scene behavior.
- Variables/lists for lightweight state management.
- Sound-trigger interactions for richer demos.
- Multi-sprite orchestration for game-like projects.
- Fast concepting before production implementation.

### AI-assisted ideas
- “Convert this gameplay idea into block logic steps.”
- “Design a beginner tutorial level mechanic.”
- “Add scoring and win/loss conditions.”
- “Explain this block script in plain language.”
- “Suggest accessibility improvements for young learners.”
- “Generate lesson prompts using this project.”

### Best for
- Education.
- Interactive storytelling.
- Product walkthrough mockups.
- Early gameplay mechanics.

</details>

<details>
<summary><b>3D Editor — Modeling Workspace + Text-to-3D</b></summary>

### What you can do
- Build and edit 3D scenes directly in the IDE.
- Move, rotate, and scale objects with familiar controls.
- Organize assets for game, web, or product visualization.
- Generate 3D content from text prompts.
- Iterate with AI-assisted scene composition.
- Export assets for downstream use.

### Scene editing features
- Object selection and transform handles.
- Basic hierarchy/scene organization patterns.
- Camera/navigation controls for inspection.
- Iterative layout for prototypes and demos.
- Asset-first workflows for design + engineering teams.
- Integrated environment with code and media tabs.

### AI-assisted 3D workflows
- “Generate a low-poly desk setup.”
- “Create a sci-fi crate asset with clean silhouette.”
- “Suggest better lighting composition for this scene.”
- “List optimization ideas for real-time rendering.”
- “Generate naming conventions for scene objects.”
- “Plan LOD strategy for these models.”

### Best for
- Product mockups.
- Game asset concepting.
- Web 3D experiments.
- Rapid visual prototyping.

</details>

<details>
<summary><b>Media Suite — Audio + Video Editors in One Workspace</b></summary>

### What you can do
- Edit audio and video without leaving the project.
- Keep media assets next to source code and docs.
- Use timeline-based operations for quick cuts.
- Prepare demos, tutorials, and social clips faster.
- Align media output with product release workflows.
- Combine AI prompt generation with manual edits.

### Audio editor features
- Track-level editing for common audio tasks.
- Clip trimming and arrangement workflows.
- Iterative content prep for podcasts/voiceovers.
- Utility edits for product explainers.
- Fast access from same IDE sidebar context.
- Useful for devrel and documentation teams.

### Video editor features
- Clip sequencing and basic cut workflows.
- Intro/outro + short-form assembly patterns.
- Visual prep for release notes and changelogs.
- Quick corrections to tutorial content.
- Project-local asset iteration.
- No tool-switch penalty for engineering teams.

### AI-assisted media workflows
- “Generate a storyboard for this feature demo.”
- “Write a 30-second script for release notes video.”
- “Draft chapter markers from this transcript.”
- “Suggest pacing improvements for this timeline.”
- “Create caption copy in concise style.”
- “Turn this changelog into social post copy.”

### Best for
- Launch videos.
- Internal demos.
- Tutorial production.
- Developer marketing.

</details>

<details>
<summary><b>Office Suite — Word, Excel, PowerPoint, and Rich Text</b></summary>

### What you can do
- Open and edit document formats in the same workspace.
- Build specs, planning docs, and status updates fast.
- Maintain slide decks beside implementation tasks.
- Use spreadsheet views for planning and lightweight analysis.
- Keep technical docs versioned with project code.
- Share office-style artifacts without app switching.

### Word + rich text workflows
- Draft PRDs, RFCs, runbooks, and onboarding docs.
- Apply consistent formatting inside the IDE.
- Capture architecture notes during implementation.
- Convert rough notes into polished documentation.
- Pair with AI summarization for speed.
- Keep context tied to code changes.

### Excel workflows
- Manage feature matrices and test plans.
- Track estimates, staffing, and milestones.
- Compare options with tabular scorecards.
- Build quick dashboards for project health.
- Maintain structured data close to code.
- Export/share as needed.

### PowerPoint workflows
- Create stakeholder updates and demos.
- Build engineering architecture presentations.
- Maintain release recap decks.
- Turn changelogs into slides quickly.
- Collaborate with teams in one place.
- Reuse assets from project files.

### AI-assisted office tasks
- “Summarize this spec into an executive brief.”
- “Generate a rollout timeline slide structure.”
- “Create risk table from these tickets.”
- “Rewrite this memo for non-technical audience.”
- “Turn this sprint data into a narrative update.”
- “Draft a troubleshooting appendix section.”

### Best for
- Product planning.
- Team communication.
- Executive reporting.
- Training materials.

</details>

<details>
<summary><b>CAD Editor — Parametric Thinking + Visual Design</b></summary>

### What you can do
- Build CAD-style models inside the same IDE session.
- Iterate with quick tool switching and previews.
- Explore concepts before formal manufacturing pipelines.
- Keep design references near firmware/app code.
- Prototype enclosure and mechanical ideas rapidly.
- Review models collaboratively with team context.

### CAD workflow highlights
- Quick tool access for common geometry tasks.
- View mode switching for design inspection.
- Iterative loop between concept and refinement.
- Local project integration for assets and notes.
- Fast feedback cycles with AI explanation support.
- Cross-discipline collaboration in one workspace.

### AI-assisted CAD tasks
- “Suggest tolerances checklist for this part.”
- “Create a design review rubric.”
- “Explain potential stress points in simple terms.”
- “Generate naming standards for part versions.”
- “Draft manufacturing handoff notes.”
- “List test scenarios for fit validation.”

### Best for
- Hardware enclosures.
- Mechanical ideation.
- Design-review prep.
- Cross-functional collaboration.

</details>

<details>
<summary><b>Database Designer — ERD-Style Planning + SQL Export</b></summary>

### What you can do
- Model entities and relationships visually.
- Design schemas before writing migration code.
- Export production-ready SQL from diagram-first planning.
- Align app data modeling with team discussion.
- Validate shape of data before implementation.
- Document constraints and table intent clearly.

### Schema planning features
- ERD-like structure for tables and relations.
- Relationship mapping for one-to-many and beyond.
- Planning-friendly workflow for collaborative design.
- SQL handoff ready for implementation phases.
- Better visibility into evolving data models.
- Reduced ambiguity across backend/frontend teams.

### AI-assisted database workflows
- “Generate initial schema for multi-tenant SaaS.”
- “Review this model for normalization issues.”
- “Suggest indexes for top query paths.”
- “Explain tradeoffs between UUID and serial ids.”
- “Create migration rollout checklist.”
- “Draft seed data strategy for staging.”

### Best for
- New backend architecture.
- Legacy schema modernization.
- Data contract reviews.
- Performance planning.

</details>

<details>
<summary><b>API Playground — REST + GraphQL Testing Hub</b></summary>

### What you can do
- Test REST and GraphQL endpoints from inside the IDE.
- Iterate on API contracts while editing code.
- Validate request/response shapes quickly.
- Debug auth, headers, and payload structures.
- Keep endpoint tests close to implementation.
- Share repeatable API testing patterns.

### Core API workflows
- Compose and run HTTP requests.
- Validate JSON output and error payloads.
- Compare endpoint behavior across versions.
- Reproduce bugs with saved request patterns.
- Check schema behavior in GraphQL queries.
- Shorten backend debugging loops.

### AI-assisted API tasks
- “Generate test cases for this endpoint.”
- “Convert this cURL command into readable docs.”
- “Explain why this response is 422.”
- “Create GraphQL query variants for edge cases.”
- “Draft contract test checklist.”
- “Suggest pagination strategy improvements.”

### Best for
- Backend testing.
- Integration debugging.
- API documentation.
- QA collaboration.

</details>

<details>
<summary><b>Workflows Panel — Visual Build/Test/Deploy Automation</b></summary>

### What you can do
- Create project workflows with visual steps.
- Automate repetitive build/test/deploy actions.
- Re-run workflows as project state evolves.
- Keep automation config in the same workspace.
- Combine manual and scheduled patterns.
- Improve consistency across contributors.

### Workflow builder capabilities
- Define named workflows with command steps.
- Support run/build/test/deploy style stages.
- Trigger via manual or contextual events.
- Inspect run history for troubleshooting.
- Iterate quickly with editor-side feedback.
- Align with CI-style behavior locally.

### AI-assisted automation tasks
- “Create a lint + test + build pipeline.”
- “Add rollback-safe deploy checklist steps.”
- “Optimize this workflow for faster feedback.”
- “Generate branch-based workflow strategy.”
- “Draft environment variable audit steps.”
- “Explain failed step and suggest fixes.”

### Best for
- Team standards.
- Release safety.
- Developer productivity.
- CI/CD rehearsal.

</details>

<details>
<summary><b>Extensions Panel — Build Widget, Command, and Chat-Tool Runtimes</b></summary>

### What you can do
- Create custom IDE extensions in-project.
- Choose runtime style: widget, command, or chat-tool.
- Build private helpers for your team.
- Prototype utilities directly next to your app.
- Package reusable workflows for repeated tasks.
- Extend AI behavior with focused tool adapters.

### Extension runtime options
- **Widget runtime:** UI tools inside the IDE panel.
- **Command runtime:** action-style commands for workflows.
- **Chat-tool runtime:** assistant-callable tools with scoped behavior.
- Runtime-aware development surfaces for faster iteration.
- Built-in placement in project workflow.
- Strong fit for internal platform teams.

### AI-assisted extension tasks
- “Scaffold a chat-tool for schema summaries.”
- “Create a widget for environment validation.”
- “Build command extension for release tagging.”
- “Write docs for this extension manifest.”
- “Generate test prompts for extension quality.”
- “Refactor extension code for maintainability.”

### Best for
- Internal tooling.
- Team accelerators.
- Custom AI affordances.
- Platform engineering.

</details>

<details>
<summary><b>All Editors Together — Why This Matters</b></summary>

### Unified environment advantages
- Keep source code, docs, hardware, and media in one place.
- Reduce context switching across disconnected tools.
- Maintain a single AI assistant context across domains.
- Collaborate with shared project artifacts and history.
- Shorten time from idea to prototype to delivery.
- Support education, startups, and enterprise teams alike.

### AI + editor synergy
- Ask for help in the exact domain tab you are using.
- Generate artifacts (code/docs/media) and apply immediately.
- Convert planning notes into implementation tasks.
- Tie automation and testing into day-to-day editing.
- Use model comparison before committing major changes.
- Scale from solo prototyping to team governance.

### Typical end-to-end flow
1. Plan in docs/spreadsheets.
2. Implement in code editor.
3. Validate in API playground.
4. Automate in workflows panel.
5. Prepare demo assets in media tools.
6. Ship with built-in Git and share actions.

</details>

## 👥 Teams & Enterprise Collaboration

Code Canvas is designed for team-scale productivity and oversight.

<details>
<summary><b>View Team & Collaboration Features</b></summary>

- **Team Administration:** Manage members, roles, and set granular spending limits for AI usage.
- **Shared Policies:** Enforce security and coding standards across the entire team.
- **Real-time Pairing:** Collaborative editing with live cursor presence and WebRTC-powered **Voice/Video rooms**.
- **Session Recordings:** Capture and replay coding sessions for audits, debugging, or training.
- **Collaboration Tools:**
    - **Context Pins:** Pin symbols or files with notes for your team.
    - **Code Review Threads:** Threaded feedback synced to specific lines of code.
    - **Project Bookmarks:** Share named hotspots across the project for fast context switching.
- **Analytics Tab:** Monitor team spending and resource usage in real-time.
</details>

---

## 🌐 Deployment & Cloud Development

Select your preferred method for deploying or developing Code Canvas Complete.


<details>
<summary><b>Deploy to Vercel</b></summary>

1. Push your repository to GitHub, GitLab, or Bitbucket.
2. In the Vercel Dashboard, click **New Project** and import the repository.
3. Vercel will auto-detect the Vite framework.
4. **Build Settings:**
    - Build Command: `npm run build`
    - Output Directory: `dist`
5. **Environment Variables:** Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. 
6. Click **Deploy**.

*Note: Supabase Edge Functions must be deployed separately using the Supabase CLI.*
</details>

<details>
<summary><b>Deploy to Replit (One-Click)</b></summary>

1. **Create a new repl** from the GitHub repository on Replit.
<img width="600" height="296" alt="image" src="https://github.com/user-attachments/assets/f0033af4-cba9-4941-b89d-241ee891a6e4" />

2. Select **Github**, then input: `https://github.com/TopProjectsCreator/code-canvas-complete`.
<img width="600" height="296" alt="image" src="https://github.com/user-attachments/assets/33e866c9-cab2-4810-aad4-516f8635933b" />

3. **Replit Agent** will handle the environment setup.
<img width="600" height="296" alt="image" src="https://github.com/user-attachments/assets/2bbe95b5-da39-4f2e-b521-75dff2852713" />

4. For production mode:
   ```bash
   npm run build
   npm run preview -- --host 0.0.0.0 --port 3000
   ```

Note: To open the preview in a new window, click the pop-out icon <img width="15" height="15" alt="image" src="https://github.com/user-attachments/assets/26fbe487-c17a-4aac-a086-b64f9805094f" /> in the top right.
<img width="600" height="296" alt="image" src="https://github.com/user-attachments/assets/0fa4a615-f25c-441d-a77c-0abee9f44c12" />
</details>

<details>
<summary><b>Deploy to Koyeb</b></summary>

1. In Koyeb, create a new **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
    - Build Command: `npm run build`
    - Run Command: `npm run preview -- --host 0.0.0.0 --port $PORT`
4. Add required environment variables in the **App Settings**.
5. Deploy the service.
</details>

<details>
<summary><b>Deploy to Lovable</b></summary>

Coming soon! We are finalizing the GitHub Actions and documentation for a seamless remix-and-publish experience. Get ready for the easiest deploy yet!

</details>

---

## 💻 Local Development
1. **Install Dependencies:** `npm install`
2. **Environment:** Create a `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. 
3. **Run Dev:** `npm run dev`

---

## 📄 License & Contributing
Licensed under [license.md](license.md). Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).
