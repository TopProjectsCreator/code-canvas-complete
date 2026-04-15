[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/TopProjectsCreator/code-canvas-complete)

# Code Canvas Complete

Code Canvas Complete is an advanced, browser-based All-In-One IDE featuring an integrated AI assistant, multi-file editing, persistent shell sessions, and a massive suite of specialized editors.

![Code Canvas Teaser](teaser.gif)

## 🚀 Core IDE & Workspace

Code Canvas provides a professional development environment entirely in your browser, powered by the WebContainers API.

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

Experience the next generation of coding with an AI assistant that doesn't just suggest code, but executes tasks.

<details>
<summary><b>View AI Assistant Capabilities</b></summary>

- **Multi-Model Support:** Switch between OpenAI, Anthropic, Gemini, and more. Compare outputs side-by-side with the **AI Comparison Panel**.
- **Agentic Actions:** The AI can autonomously analyze code, suggest fixes, apply changes, run tests, and manage your file system.
- **Autonomy Modes:**
    - **Safe:** Manual-first, auto-runs only low-risk actions.
    - **Balanced:** Auto-applies common actions, gates risky operations.
    - **Fast:** Maximum autonomy for rapid iteration.
    - **Custom:** Granular control over file changes, shell commands, git actions, and more.
- **AI Code Review:** Get per-line suggestions with severity ratings and one-click "Accept/Reject" controls.
- **Explain on Hover:** Hover over any symbol to get an AI-powered explanation of its purpose and implementation.
- **Interactive Widgets:** The assistant renders specialized tools like **Color Picker**, **Coin Flip**, **Dice Roll**, **Calculator**, **Spinner**, **Stock Ticker**, **Template Changer**, **Pair Programming Timer**, **Docs Linker**, **Countdown**, **Password Generator**, **Unit Converter**, **Progress Tracker**, **JSON Viewer**, and **Regex Tester** directly in the chat.
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

## 🛠️ Specialized Editors & Tools

Code Canvas goes beyond code, offering a full suite of creative and technical editors.

<details>
<summary><b>View All Specialized Editors</b></summary>

- **Arduino IDE:** Professional hardware development in the browser.
    - **Supported Boards:** Uno, Nano, Mega, ESP32, ESP8266, Leonardo, Micro, Due, Zero, MKR WiFi 1010, Nano 33 IoT, Portenta H7, GIGA R1 WiFi.
    - **Breadboard Visualizer:** Virtual prototyping with 100+ components including Actuators (LEDs, Servos, Motors), Sensors (Temp, Light, PIR, Ultrasonic, MQ Gas, etc.), and Modules (OLED, LCD, WiFi, Bluetooth, H-Bridge, etc.).
- **Scratch Integration:** Visual programming with Scratch blocks, perfect for rapid prototyping and education.
- **3D Editor:** A full 3D workspace with object manipulation and **Text-to-3D** asset generation.
- **Media Suite:** Professional **Audio** and **Video** editors built into the IDE.
- **Office Suite:** Edit **Word**, **Excel**, **PowerPoint**, and **Rich Text** documents natively.
- **CAD Editor:** Design and visualize CAD models without leaving the workspace.
- **Database Designer:** Design ERD-like schemas and export production-ready SQL.
- **API Playground:** Built-in REST and GraphQL client for testing your project's endpoints.
- **Workflows Panel:** Automate your build, test, and deployment pipelines with a visual workflow builder.
</details>

## 💻 Persistent Shell & Python API

For advanced workflows, Code Canvas supports persistent, container-backed execution environments.

<details>
<summary><b>View API & Executor Details</b></summary>

The `execute-code` service handles routing to different execution environments:

- **Executor Modes:**
    - `wandbox`: Standard sandboxed execution.
    - `container`: Full persistent container runner.
    - `hybrid`: Routes shell and python to containers while keeping others sandboxed.

### API Specification
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
