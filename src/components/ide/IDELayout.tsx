import { useState, useCallback, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { applyDiff } from "@/lib/diffUtils";
import { useNavigate } from "react-router-dom";
import { FileNode, Tab, TerminalLine, GitState, GitCommit, GitChange, Workflow } from "@/types/ide";
import { getTemplateFiles, findFileById, findFilePathById, getFileLanguage } from "@/data/defaultFiles";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { EditorTabs } from "./EditorTabs";
import { CodeEditor } from "./CodeEditor";
import { Terminal } from "./Terminal";
import { Preview } from "./Preview";
import { LanguagePicker } from "./LanguagePicker";
import { MobileBottomNav } from "./MobileBottomNav";
import type { LanguageTemplate } from "@/data/templateRegistry";
import { AIChat } from "./AIChat";
import { ProjectsDialog } from "./ProjectsDialog";
import { SaveProjectDialog } from "./SaveProjectDialog";
import { ShareDialog } from "./ShareDialog";
import { GitProviderImportDialog } from "./GitProviderImportDialog";
import { CollabDialog, PresenceAvatars } from "./CollabDialog";
import { useCollaboration } from "@/hooks/useCollaboration";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCodeExecution } from "@/hooks/useCodeExecution";
import { useProjects, Project } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScratchArchive, importScratchArchive } from "@/services/scratchSb3";
import { createDataProvider } from "@/integrations/data/provider";
import { buildProjectShareUrl } from "@/lib/publishing";
import { useGitHubImport } from "@/hooks/useGitHubImport";
import { useGitProviderImport } from "@/hooks/useGitProviderImport";
import { createShellWorkflowAdapter, runWorkflow } from "@/lib/workflowRuntime";
import { CollaborationSyncEngine, isRemotePatchEnvelope } from "@/services/collabSyncEngine";
import { useOfflineProject } from "@/hooks/useOfflineProject";

const GITHUB_TEMPLATE_REPOS: Partial<Record<LanguageTemplate, string>> = {
  ftc: "https://github.com/FIRST-Tech-Challenge/FtcRobotController",
};

const ArduinoPanel = lazy(() => import("@/components/arduino").then((m) => ({ default: m.ArduinoPanel })));
const ScratchPanel = lazy(() => import("@/components/scratch/ScratchPanel").then((m) => ({ default: m.ScratchPanel })));
const FTCPanel = lazy(() => import("@/components/ftc").then((m) => ({ default: m.FTCPanel })));
const MinecraftEditor = lazy(() => import("@/components/minecraft").then((m) => ({ default: m.MinecraftEditor })));
const AutomationTemplatePane = lazy(() => import("@/components/ide/AutomationTemplatePane").then((m) => ({ default: m.AutomationTemplatePane })));
import { PartsInventoryDialog } from "@/components/ide/PartsInventoryDialog";

interface IDELayoutProps {
  projectId?: string;
  publishSlug?: string | null;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

// Initial Git state
const initialGitState: GitState = {
  branches: [],
  currentBranch: "main",
  changes: [],
  isInitialized: false,
};

// Get default workflows based on template
const getDefaultWorkflows = (template: LanguageTemplate): Workflow[] => {
  const baseWorkflows: Workflow[] = [];

  switch (template) {
    case "javascript":
    case "typescript":
      baseWorkflows.push(
        {
          id: generateId(),
          name: "Run",
          type: "run",
          command: "node index.js",
          description: "Run the main file",
          trigger: "manual",
          isDefault: true,
        },
        {
          id: generateId(),
          name: "Dev Server",
          type: "run",
          command: "npm run dev",
          description: "Start development server",
          trigger: "manual",
        },
        {
          id: generateId(),
          name: "Build",
          type: "build",
          command: "npm run build",
          description: "Build for production",
          trigger: "manual",
        },
        {
          id: generateId(),
          name: "Test",
          type: "test",
          command: "npm test",
          description: "Run test suite",
          trigger: "manual",
        },
      );
      break;
    case "python":
      baseWorkflows.push(
        {
          id: generateId(),
          name: "Run",
          type: "run",
          command: "python main.py",
          description: "Run the main file",
          trigger: "manual",
          isDefault: true,
        },
        {
          id: generateId(),
          name: "Test",
          type: "test",
          command: "pytest",
          description: "Run pytest tests",
          trigger: "manual",
        },
        {
          id: generateId(),
          name: "Lint",
          type: "custom",
          command: "pylint *.py",
          description: "Check code quality",
          trigger: "manual",
        },
      );
      break;
    case "go":
      baseWorkflows.push(
        {
          id: generateId(),
          name: "Run",
          type: "run",
          command: "go run main.go",
          description: "Run the main file",
          trigger: "manual",
          isDefault: true,
        },
        {
          id: generateId(),
          name: "Build",
          type: "build",
          command: "go build",
          description: "Compile the project",
          trigger: "manual",
        },
        {
          id: generateId(),
          name: "Test",
          type: "test",
          command: "go test ./...",
          description: "Run all tests",
          trigger: "manual",
        },
      );
      break;
    case "rust":
      baseWorkflows.push(
        {
          id: generateId(),
          name: "Run",
          type: "run",
          command: "cargo run",
          description: "Build and run",
          trigger: "manual",
          isDefault: true,
        },
        {
          id: generateId(),
          name: "Build",
          type: "build",
          command: "cargo build --release",
          description: "Build for release",
          trigger: "manual",
        },
        {
          id: generateId(),
          name: "Test",
          type: "test",
          command: "cargo test",
          description: "Run cargo tests",
          trigger: "manual",
        },
      );
      break;
    case "html":
    case "scratch":
      baseWorkflows.push(
        {
          id: generateId(),
          name: "Preview",
          type: "run",
          command: "open index.html",
          description: "Open in browser",
          trigger: "manual",
          isDefault: true,
        },
        {
          id: generateId(),
          name: "Live Server",
          type: "run",
          command: "npx live-server",
          description: "Start live reload server",
          trigger: "manual",
        },
      );
      break;
    default:
      baseWorkflows.push({
        id: generateId(),
        name: "Run",
        type: "run",
        command: 'echo "Configure your run command"',
        description: "Default run task",
        trigger: "manual",
        isDefault: true,
      });
  }

  return baseWorkflows;
};

export const IDELayout = ({ projectId, publishSlug }: IDELayoutProps) => {
  const { user } = useAuth();
  const dataProvider = useMemo(() => createDataProvider(), []);
  const { toast } = useToast();
  const { addCustomTheme } = useTheme();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject, loadProject, forkProject, toggleStar } = useProjects();
  const isMobile = useIsMobile();

  const [localProjectName, setLocalProjectName] = useState("my-canvas");
  const [selectedTemplate, setSelectedTemplate] = useState<LanguageTemplate | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([
    {
      id: "1",
      type: "info",
      content: '🚀 Welcome to Canvas Shell! Type "help" for available commands.',
      timestamp: new Date(),
    },
    {
      id: "2",
      type: "output",
      content: "Click Run to execute your code, or type commands below.",
      timestamp: new Date(),
    },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [isTerminalMinimized, setIsTerminalMinimized] = useState(false);
  const [stdinPrompt, setStdinPrompt] = useState<{ prompts: string[]; code: string; language: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [mobileActivePanel, setMobileActivePanel] = useState<"editor" | "preview" | "terminal" | "ai">("editor");
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [originalFileContents, setOriginalFileContents] = useState<Record<string, string>>({});
  const [gitState, setGitState] = useState<GitState>(initialGitState);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [currentlyRunningWorkflow, setCurrentlyRunningWorkflow] = useState<string | null>(null);
  const [showProjectsDialog, setShowProjectsDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showGitImportDialog, setShowGitImportDialog] = useState(false);
  const [showCollabDialog, setShowCollabDialog] = useState(false);
  const [showPartsInventory, setShowPartsInventory] = useState(false);
  const [partsInventoryPlatform, setPartsInventoryPlatform] = useState<"ftc" | "arduino" | "general" | undefined>(undefined);
  const [partsInventoryInitialTab, setPartsInventoryInitialTab] = useState<"inventory" | "add" | "catalog">("inventory");
  const [partsInventoryIdentifyWithImage, setPartsInventoryIdentifyWithImage] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [scratchArchive, setScratchArchive] = useState<ScratchArchive | null>(null);
  const [historyEntries, setHistoryEntries] = useState<
    Array<{
      id: string;
      type:
        | "file-edit"
        | "file-create"
        | "file-delete"
        | "terminal-command"
        | "git-commit"
        | "template-change"
        | "rename";
      label: string;
      detail?: string;
      timestamp: Date;
    }>
  >([]);
  const editedFilesRef = useRef<Set<string>>(new Set());
  const collabEngineRef = useRef<CollaborationSyncEngine>(new CollaborationSyncEngine());
  const { executeCode, executeShellCommand, isExecuting } = useCodeExecution();
  const collab = useCollaboration(currentProject?.id);
  const { importRepository: gitImportRepo } = useGitHubImport();
  const { importRepository: gitProviderImport } = useGitProviderImport();
  const { saveLocally, isOfflineCapable: checkOffline } = useOfflineProject();
  const offlineSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addHistoryEntry = useCallback(
    (type: (typeof historyEntries)[0]["type"], label: string, detail?: string) => {
      // Capture snapshot of current state for rollback
      const snapshot =
        type === "file-edit" || type === "file-create" || type === "file-delete" || type === "template-change"
          ? { files: JSON.parse(JSON.stringify(files)), fileContents: { ...fileContents } }
          : undefined;
      setHistoryEntries((prev) =>
        [
          {
            id: generateId(),
            type,
            label,
            detail,
            timestamp: new Date(),
            snapshot,
          },
          ...prev,
        ].slice(0, 100),
      );
    },
    [files, fileContents],
  );

  const handleSelectTemplate = useCallback(async (template: LanguageTemplate) => {
    setSelectedTemplate(template);
    const templateFiles = getTemplateFiles(template);
    setFiles(templateFiles);

    // Store original file contents for Git tracking
    const originals: Record<string, string> = {};
    const collectContents = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        if (node.type === "file" && node.content) {
          originals[node.id] = node.content;
        }
        if (node.children) collectContents(node.children);
      });
    };
    collectContents(templateFiles);
    setOriginalFileContents(originals);

    // Create default workflows based on template
    const defaultWorkflows = getDefaultWorkflows(template);
    setWorkflows(defaultWorkflows);

    // For FIRST robotics templates, clone from GitHub
    const githubRepo = GITHUB_TEMPLATE_REPOS[template];
    if (githubRepo) {
      toast({ title: "Cloning template", description: `Importing from GitHub...` });
      try {
        // Use the provider import (tree API) which is much faster and avoids rate limits
        const imported = await gitProviderImport(githubRepo, 'github');
        if (imported) {
          setFiles(imported);
          const importOriginals: Record<string, string> = {};
          const collectImportedContents = (nodes: FileNode[]) => {
            nodes.forEach((node) => {
              if (node.type === "file" && node.content) {
                importOriginals[node.id] = node.content;
              }
              if (node.children) collectImportedContents(node.children);
            });
          };
          collectImportedContents(imported);
          setOriginalFileContents(importOriginals);
          toast({ title: "Template loaded", description: "Repository cloned successfully!" });
        }
      } catch {
        toast({ title: "Clone failed", description: "Using default template files", variant: "destructive" });
      }
    }
  }, [gitProviderImport, toast]);

  // Load shared project from URL
  useEffect(() => {
    if (projectId && !currentProject) {
      loadProject(projectId).then((project) => {
        if (project) {
          // Check if user has access (public or owner)
          if (!project.is_public && project.user_id !== user?.id) {
            toast({
              title: "Access denied",
              description: "This project is private.",
              variant: "destructive",
            });
            navigate("/");
            return;
          }

          setFiles(project.files);
          setSelectedTemplate(project.language as LanguageTemplate);

          // Store original file contents
          const originals: Record<string, string> = {};
          const collectContents = (nodes: FileNode[]) => {
            nodes.forEach((node) => {
              if (node.type === "file" && node.content) {
                originals[node.id] = node.content;
              }
              if (node.children) collectContents(node.children);
            });
          };
          collectContents(project.files);
          setOriginalFileContents(originals);

          // Set workflows
          const defaultWorkflows = getDefaultWorkflows(project.language as LanguageTemplate);
          setWorkflows(defaultWorkflows);

          toast({
            title: "Project loaded",
            description: `Viewing "${project.name}"`,
          });
        }
      });
    }
  }, [projectId, currentProject, loadProject, user, navigate, toast]);

  useEffect(() => {
    if (!publishSlug || currentProject) return;
    dataProvider.getProjectByPublishSlug(publishSlug).then((project) => {
      if (!project) return;
      setCurrentProject(project);
      setFiles(project.files);
      setSelectedTemplate(project.language as LanguageTemplate);
    });
  }, [publishSlug, currentProject, dataProvider, setCurrentProject]);

  // Get the active file
  const activeTab = openTabs.find((tab) => tab.id === activeTabId);
  const activeFile = activeTab ? findFileById(files, activeTab.fileId) : null;

  // Prepare active file with updated content
  const activeFileWithContent = activeFile
    ? { ...activeFile, content: fileContents?.[activeFile.id] ?? activeFile.content }
    : null;
  const activeFilePath = activeFile ? findFilePathById(files, activeFile.id) || activeFile.name : null;

  useEffect(() => {
    if (!activeFilePath) return;
    void collab.updatePresence({ currentFile: activeFilePath });
  }, [activeFilePath, collab]);

  useEffect(() => {
    const engine = collabEngineRef.current;
    engine.reset();

    const registerNodes = (nodes: FileNode[], parentPath = "") => {
      nodes.forEach((node) => {
        const nextPath = parentPath ? `${parentPath}/${node.name}` : node.name;
        if (node.type === "file") {
          const content = fileContents[node.id] ?? node.content ?? "";
          engine.initializeFile(node.id, nextPath, content);
          return;
        }
        if (node.children) registerNodes(node.children, nextPath);
      });
    };

    registerNodes(files);
  }, [files, fileContents]);

  useEffect(() => {
    const remoteUpdate = collab.remoteFileUpdate;
    if (!remoteUpdate) return;

    setFileContents((prev) => {
      if (prev[remoteUpdate.fileId] === remoteUpdate.content) return prev;
      return { ...prev, [remoteUpdate.fileId]: remoteUpdate.content };
    });

    setFiles((prev) => {
      const applyUpdate = (nodes: FileNode[]): FileNode[] =>
        nodes.map((node) => {
          if (node.id === remoteUpdate.fileId && node.type === 'file') {
            return { ...node, content: remoteUpdate.content };
          }
          if (node.children) return { ...node, children: applyUpdate(node.children) };
          return node;
        });
      return applyUpdate(prev);
    });
  }, [collab.remoteFileUpdate]);

  useEffect(() => {
    const patch = collab.remoteFilePatch;
    if (!patch || !isRemotePatchEnvelope(patch)) return;

    const update = collabEngineRef.current.materializeUpdate(patch);
    if (!update) return;

    setFileContents((prev) => {
      if (prev[update.fileId] === update.content) return prev;
      return { ...prev, [update.fileId]: update.content };
    });

    setFiles((prev) => {
      const applyUpdate = (nodes: FileNode[]): FileNode[] =>
        nodes.map((node) => {
          if (node.id === update.fileId && node.type === "file") {
            return { ...node, content: update.content };
          }
          if (node.children) return { ...node, children: applyUpdate(node.children) };
          return node;
        });
      return applyUpdate(prev);
    });
  }, [collab.remoteFilePatch]);

  // Track Git changes when files are modified
  useEffect(() => {
    if (!gitState.isInitialized) return;

    const changes: GitChange[] = [];

    // Check for modified files
    Object.entries(fileContents).forEach(([fileId, content]) => {
      const originalContent = originalFileContents[fileId];
      const file = findFileById(files, fileId);

      if (file && content !== (originalContent ?? file.content)) {
        changes.push({
          fileId,
          fileName: file.name,
          status: originalContent === undefined ? "added" : "modified",
          originalContent,
        });
      }
    });

    // Check for new files not in original
    const checkNewFiles = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        if (node.type === "file" && !originalFileContents[node.id] && !changes.find((c) => c.fileId === node.id)) {
          changes.push({
            fileId: node.id,
            fileName: node.name,
            status: "added",
          });
        }
        if (node.children) checkNewFiles(node.children);
      });
    };
    checkNewFiles(files);

    setGitState((prev) => ({ ...prev, changes }));
  }, [fileContents, files, originalFileContents, gitState.isInitialized]);

  // Git handlers
  const handleGitInitRepo = useCallback(() => {
    const initialCommit: GitCommit = {
      id: generateId(),
      message: "Initial commit",
      timestamp: new Date(),
      author: "You",
      files: [],
    };

    // Collect all current files for initial commit
    const fileNames: string[] = [];
    const collectFiles = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        if (node.type === "file") fileNames.push(node.name);
        if (node.children) collectFiles(node.children);
      });
    };
    collectFiles(files);
    initialCommit.files = fileNames;

    // Store current contents as original
    const originals: Record<string, string> = {};
    const collectContents = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        if (node.type === "file") {
          originals[node.id] = fileContents[node.id] ?? node.content ?? "";
        }
        if (node.children) collectContents(node.children);
      });
    };
    collectContents(files);
    setOriginalFileContents(originals);

    setGitState({
      isInitialized: true,
      currentBranch: "main",
      branches: [{ name: "main", isActive: true, commits: [initialCommit] }],
      changes: [],
    });

    setTerminalHistory((prev) => [
      ...prev,
      {
        id: generateId(),
        type: "info",
        content: "📦 Initialized Git repository with initial commit",
        timestamp: new Date(),
      },
    ]);
  }, [files, fileContents]);

  const handleGitCommit = useCallback(
    (message: string) => {
      if (gitState.changes.length === 0) return;

      const commit: GitCommit = {
        id: generateId(),
        message,
        timestamp: new Date(),
        author: "You",
        files: gitState.changes.map((c) => c.fileName),
      };

      // Update original contents to current
      const newOriginals = { ...originalFileContents };
      gitState.changes.forEach((change) => {
        if (change.status !== "deleted") {
          const file = findFileById(files, change.fileId);
          if (file) {
            newOriginals[change.fileId] = fileContents[change.fileId] ?? file.content ?? "";
          }
        }
      });
      setOriginalFileContents(newOriginals);

      setGitState((prev) => ({
        ...prev,
        changes: [],
        branches: prev.branches.map((branch) =>
          branch.name === prev.currentBranch ? { ...branch, commits: [commit, ...branch.commits] } : branch,
        ),
      }));

      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "info",
          content: `✓ Committed: "${message}" (${gitState.changes.length} file${gitState.changes.length !== 1 ? "s" : ""})`,
          timestamp: new Date(),
        },
      ]);

      addHistoryEntry("git-commit", `Committed: "${message}"`, `${gitState.changes.length} file(s)`);
    },
    [gitState.changes, files, fileContents, originalFileContents, addHistoryEntry],
  );

  const handleGitStageFile = useCallback((fileId: string) => {
    // In this simplified implementation, all changes are automatically staged
  }, []);

  const handleGitUnstageFile = useCallback((fileId: string) => {
    // In this simplified implementation, we can't unstage
  }, []);

  const handleGitDiscardChanges = useCallback(
    (fileId: string) => {
      const originalContent = originalFileContents[fileId];
      const file = findFileById(files, fileId);

      if (file) {
        setFileContents((prev) => ({
          ...prev,
          [fileId]: originalContent ?? file.content ?? "",
        }));
      }
    },
    [files, originalFileContents],
  );

  const handleGitCreateBranch = useCallback(
    (name: string) => {
      const currentBranch = gitState.branches.find((b) => b.name === gitState.currentBranch);

      setGitState((prev) => ({
        ...prev,
        currentBranch: name,
        branches: [
          ...prev.branches.map((b) => ({ ...b, isActive: false })),
          { name, isActive: true, commits: currentBranch?.commits || [] },
        ],
      }));

      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "info",
          content: `🌿 Created and switched to branch: ${name}`,
          timestamp: new Date(),
        },
      ]);
    },
    [gitState.branches, gitState.currentBranch],
  );

  const handleGitSwitchBranch = useCallback((name: string) => {
    setGitState((prev) => ({
      ...prev,
      currentBranch: name,
      branches: prev.branches.map((b) => ({ ...b, isActive: b.name === name })),
    }));

    setTerminalHistory((prev) => [
      ...prev,
      {
        id: generateId(),
        type: "info",
        content: `🔀 Switched to branch: ${name}`,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Workflow handlers
  const handleRunWorkflow = useCallback(
    async (workflow: Workflow) => {
      setCurrentlyRunningWorkflow(workflow.id);

      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "info",
          content: `⚡ Running workflow: ${workflow.name}`,
          timestamp: new Date(),
        },
        {
          id: generateId(),
          type: "input",
          content: `$ ${workflow.command}`,
          timestamp: new Date(),
        },
      ]);

      try {
        const runResult = await runWorkflow(
          workflow.command,
          createShellWorkflowAdapter(async (command) => executeShellCommand(command)),
          {
            workflowId: workflow.id,
            workflowName: workflow.name,
            vars: {
              branch: gitState.currentBranch,
            },
          },
          {
            maxParallel: 2,
          },
        );
        const success = runResult.status === "success";

        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === workflow.id ? { ...w, lastRun: new Date(), lastStatus: success ? "success" : "failed" } : w,
          ),
        );

        setTerminalHistory((prev) => {
          const outputLines = runResult.output.map((line) => ({
            id: generateId(),
            type: success ? ("output" as const) : ("error" as const),
            content: line,
            timestamp: new Date(),
          }));

          const statusLine: TerminalLine = {
            id: generateId(),
            type: success ? "output" : "error",
            content: success
              ? `✅ Workflow "${workflow.name}" completed successfully`
              : `❌ Workflow "${workflow.name}" failed`,
            timestamp: new Date(),
          };

          return [...prev, ...outputLines, statusLine];
        });
      } finally {
        setCurrentlyRunningWorkflow(null);
      }
    },
    [executeShellCommand, gitState.currentBranch],
  );

  const handleCreateWorkflow = useCallback((workflow: Omit<Workflow, "id">) => {
    const newWorkflow: Workflow = {
      id: generateId(),
      ...workflow,
    };
    setWorkflows((prev) => [...prev, newWorkflow]);

    setTerminalHistory((prev) => [
      ...prev,
      {
        id: generateId(),
        type: "info",
        content: `✨ Created workflow: ${workflow.name}`,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleUpdateWorkflow = useCallback((id: string, updates: Partial<Workflow>) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  }, []);

  const handleDeleteWorkflow = useCallback(
    (id: string) => {
      const workflow = workflows.find((w) => w.id === id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));

      if (workflow) {
        setTerminalHistory((prev) => [
          ...prev,
          {
            id: generateId(),
            type: "info",
            content: `🗑️ Deleted workflow: ${workflow.name}`,
            timestamp: new Date(),
          },
        ]);
      }
    },
    [workflows],
  );

  // Get content for preview
  const getFileContent = (fileName: string): string => {
    const findFile = (nodes: FileNode[]): FileNode | null => {
      for (const node of nodes) {
        if (node.name === fileName && node.type === "file") return node;
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const file = findFile(files);
    if (!file) return "";
    return fileContents[file.id] ?? file.content ?? "";
  };

  const rawHtmlContent = getFileContent("index.html");
  const cssContent = getFileContent("style.css");
  const jsContent = getFileContent("script.js");

  // For React templates, inject App.jsx into the HTML as a Babel-transpiled script
  const htmlContent = (() => {
    if (selectedTemplate === "react") {
      const appJsxContent = getFileContent("App.jsx");
      if (appJsxContent && rawHtmlContent) {
        const babelScript = `<script type="text/babel">\n${appJsxContent}\n\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(React.createElement(App));\n</script>`;
        return rawHtmlContent.replace("<!-- APP_JSX_PLACEHOLDER -->", babelScript);
      }
    }
    return rawHtmlContent;
  })();

  const handleFileSelect = useCallback(
    (file: FileNode) => {
      if (file.type === "folder") return;

      // Check if tab already exists
      const existingTab = openTabs.find((tab) => tab.fileId === file.id);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        return;
      }

      // Create new tab
      const newTab: Tab = {
        id: generateId(),
        name: file.name,
        fileId: file.id,
        isModified: false,
      };

      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    },
    [openTabs],
  );

  const handleCreateFile = useCallback(
    (parentId: string | null, name: string, type: "file" | "folder") => {
      // Check for duplicate names among siblings
      const getSiblings = (nodes: FileNode[], targetParentId: string | null): FileNode[] => {
        if (!targetParentId) {
          const root = nodes[0];
          return root?.type === "folder" ? root.children || [] : nodes;
        }
        for (const node of nodes) {
          if (node.id === targetParentId && node.type === "folder") return node.children || [];
          if (node.children) {
            const found = getSiblings(node.children, targetParentId);
            if (found.length > 0 || node.children.some((c) => c.id === targetParentId)) return found;
          }
        }
        return [];
      };

      const siblings = getSiblings(files, parentId);
      if (siblings.some((s) => s.name === name)) {
        toast({
          title: "File already exists",
          description: `A ${type} named "${name}" already exists in this directory.`,
          variant: "destructive",
        });
        return;
      }

      const newFile: FileNode = {
        id: generateId(),
        name,
        type,
        ...(type === "file" && {
          content: type === "file" ? getDefaultContent(name) : undefined,
          language: getFileLanguage(name),
        }),
        ...(type === "folder" && { children: [] }),
      };

      setFiles((prev) => {
        const addToParent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.id === parentId && node.type === "folder") {
              return {
                ...node,
                children: [...(node.children || []), newFile],
              };
            }
            if (node.children) {
              return { ...node, children: addToParent(node.children) };
            }
            return node;
          });
        };

        if (!parentId) {
          // Add to root level
          const root = prev[0];
          if (root && root.type === "folder") {
            return [
              {
                ...root,
                children: [...(root.children || []), newFile],
              },
            ];
          }
          return [...prev, newFile];
        }

        return addToParent(prev);
      });

      // If it's a file, open it in a new tab
      if (type === "file") {
        const newTab: Tab = {
          id: generateId(),
          name: newFile.name,
          fileId: newFile.id,
          isModified: false,
        };
        setOpenTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }

      addHistoryEntry("file-create", `Created ${type}: ${name}`);
    },
    [addHistoryEntry],
  );

  // addFile is defined further below (after handleContentChange) to avoid TDZ issues

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      setFiles((prev) => {
        const removeFile = (nodes: FileNode[]): FileNode[] => {
          return nodes
            .filter((node) => node.id !== fileId)
            .map((node) => ({
              ...node,
              children: node.children ? removeFile(node.children) : undefined,
            }));
        };
        return removeFile(prev);
      });

      // Close any open tabs for this file
      setOpenTabs((prev) => prev.filter((tab) => tab.fileId !== fileId));

      // Clear active tab if it was the deleted file
      if (activeTab?.fileId === fileId) {
        setActiveTabId(null);
      }
    },
    [activeTab],
  );

  const handleRenameFile = useCallback((fileId: string, newName: string) => {
    setFiles((prev) => {
      const renameInTree = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === fileId) {
            return {
              ...node,
              name: newName,
              language: node.type === "file" ? getFileLanguage(newName) : undefined,
            };
          }
          if (node.children) {
            return { ...node, children: renameInTree(node.children) };
          }
          return node;
        });
      };
      return renameInTree(prev);
    });

    // Update tab name if file is open
    setOpenTabs((prev) => prev.map((tab) => (tab.fileId === fileId ? { ...tab, name: newName } : tab)));
  }, []);

  const handleUploadFiles = useCallback(
    (uploadedFiles: { name: string; content: string; language: string }[]) => {
      const rootFolder = files[0];
      const parentId = rootFolder?.id || null;

      uploadedFiles.forEach((file) => {
        const newFile: FileNode = {
          id: generateId(),
          name: file.name,
          type: "file",
          content: file.content,
          language: file.language,
        };

        setFiles((prev) => {
          const addToParent = (nodes: FileNode[]): FileNode[] => {
            return nodes.map((node) => {
              if (node.id === parentId && node.type === "folder") {
                return {
                  ...node,
                  children: [...(node.children || []), newFile],
                };
              }
              if (node.children) {
                return { ...node, children: addToParent(node.children) };
              }
              return node;
            });
          };

          if (!parentId) {
            const root = prev[0];
            if (root && root.type === "folder") {
              return [
                {
                  ...root,
                  children: [...(root.children || []), newFile],
                },
              ];
            }
            return [...prev, newFile];
          }

          return addToParent(prev);
        });

        // Open the file in a new tab
        const newTab: Tab = {
          id: generateId(),
          name: file.name,
          fileId: newFile.id,
          isModified: false,
        };
        setOpenTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      });
    },
    [files],
  );

  const handleImportScratchProject = useCallback(async (file: File) => {
    try {
      const parsed = await importScratchArchive(await file.arrayBuffer());
      setScratchArchive(parsed.archive);
      setSelectedTemplate("scratch");
      const templateFiles = getTemplateFiles("scratch");
      setFiles(
        templateFiles.map((node) => {
          if (node.type === "folder") {
            return {
              ...node,
              children: (node.children || []).map((child) =>
                child.name === "project.json" ? { ...child, content: parsed.archive.projectJson } : child,
              ),
            };
          }
          return node;
        }),
      );
      setTerminalHistory((prev) => [
        ...prev,
        { id: generateId(), type: "info", content: `📦 Imported Scratch project: ${file.name}`, timestamp: new Date() },
      ]);
    } catch (error) {
      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "error",
          content: `❌ Failed to import Scratch project (.sb/.sb2/.sb3): ${error instanceof Error ? error.message : 'unknown error'}`,
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const handleTabClose = useCallback(
    (tabId: string) => {
      setOpenTabs((prev) => {
        const newTabs = prev.filter((tab) => tab.id !== tabId);

        // If closing active tab, activate another
        if (activeTabId === tabId && newTabs.length > 0) {
          const closedIndex = prev.findIndex((tab) => tab.id === tabId);
          const newActiveIndex = Math.min(closedIndex, newTabs.length - 1);
          setActiveTabId(newTabs[newActiveIndex].id);
        } else if (newTabs.length === 0) {
          setActiveTabId(null);
        }

        return newTabs;
      });
    },
    [activeTabId],
  );

  const handleContentChange = useCallback(
    (fileId: string, content: string) => {
      setFileContents((prev) => ({ ...prev, [fileId]: content }));

      const filePath = findFilePathById(files, fileId);
      if (filePath) {
        void collab.broadcastFilePatch(collabEngineRef.current, fileId, filePath, content);
        void collab.broadcastFileChange({ fileId, filePath, content });
      }

      // Track file edits in history (deduplicate rapid edits)
      if (!editedFilesRef.current.has(fileId)) {
        editedFilesRef.current.add(fileId);
        const fileName = openTabs.find((t) => t.fileId === fileId)?.name || "file";
        addHistoryEntry("file-edit", `Edited ${fileName}`);
        // Reset after 5s to allow new history entries for the same file
        setTimeout(() => editedFilesRef.current.delete(fileId), 5000);
      }

      // Mark tab as modified
      setOpenTabs((prev) => prev.map((tab) => (tab.fileId === fileId ? { ...tab, isModified: true } : tab)));
    },
    [addHistoryEntry, collab, files, openTabs],
  );

  const handleCreateOrUpdateFile = useCallback(
    (name: string, content: string, language?: string) => {
      const findByName = (nodes: FileNode[]): FileNode | null => {
        for (const node of nodes) {
          if (node.type === "file" && node.name === name) return node;
          if (node.children) {
            const found = findByName(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const existing = findByName(files);
      if (existing) {
        handleContentChange(existing.id, content);
        handleFileSelect(existing);
        return;
      }

      const newFileId = generateId();
      const newFile: FileNode = {
        id: newFileId,
        name,
        type: "file",
        content,
        language: language || getFileLanguage(name),
      };

      setFiles((prev) => {
        const root = prev[0];
        if (root && root.type === "folder") {
          return [{ ...root, children: [...(root.children || []), newFile] }];
        }
        return [...prev, newFile];
      });
      setFileContents((prev) => ({ ...prev, [newFileId]: content }));
      const newTab: Tab = { id: generateId(), name, fileId: newFileId, isModified: true };
      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      addHistoryEntry("file-create", `Created: ${name}`, "generated content");
    },
    [addHistoryEntry, files, handleContentChange, handleFileSelect],
  );

  // helper kept for existing integrations like Arduino panel
  const addFile = useCallback(
    (name: string, content: string, language?: string) => {
      handleCreateOrUpdateFile(name, content, language);
    },
    [handleCreateOrUpdateFile],
  );

  const handleCommand = useCallback(
    (command: string, output: string[], isError: boolean) => {
      // Check for clear command
      if (output.length === 1 && output[0] === "\x1Bc") {
        setTerminalHistory([]);
        return;
      }

      const inputLine: TerminalLine = {
        id: generateId(),
        type: "input",
        content: command,
        timestamp: new Date(),
      };

      const outputLines: TerminalLine[] = output.map((line) => ({
        id: generateId(),
        type: isError ? "error" : "output",
        content: line,
        timestamp: new Date(),
      }));

      // Handle special commands locally
      if (command === "run" || command === "npm start") {
        setIsRunning(true);
        outputLines.push({
          id: generateId(),
          type: "info",
          content: "🚀 Starting development server...",
          timestamp: new Date(),
        });
        outputLines.push({
          id: generateId(),
          type: "output",
          content: "Server started at https://my-canvas.codecanvas.app",
          timestamp: new Date(),
        });
      }

      setTerminalHistory((prev) => [...prev, inputLine, ...outputLines]);

      addHistoryEntry("terminal-command", `Ran: ${command}`, isError ? "Error" : undefined);
    },
    [addHistoryEntry],
  );

  const handleRun = useCallback(async () => {
    // Auto-detect the main entry point file based on language conventions
    const findFileByName = (nodes: FileNode[], fileName: string): FileNode | null => {
      for (const node of nodes) {
        if (node.name === fileName && node.type === "file") return node;
        if (node.children) {
          const found = findFileByName(node.children, fileName);
          if (found) return found;
        }
      }
      return null;
    };

    // Priority order for entry point detection (language-specific main files first)
    const entryPointPriority = [
      // Python
      "main.py",
      "app.py",
      "run.py",
      // Java
      "Main.java",
      "App.java",
      // C/C++
      "main.cpp",
      "main.c",
      // Go
      "main.go",
      // Rust
      "main.rs",
      // JavaScript/TypeScript
      "index.js",
      "index.ts",
      "main.js",
      "main.ts",
      "app.js",
      "app.ts",
      // Ruby
      "main.rb",
      "app.rb",
      // PHP
      "index.php",
      "main.php",
      // Swift
      "main.swift",
      // Kotlin
      "Main.kt",
      "App.kt",
      // C#
      "Program.cs",
      "Main.cs",
      // Shell
      "main.sh",
      "run.sh",
      "script.sh",
      // Perl
      "main.pl",
      "script.pl",
      // Lua
      "main.lua",
      // Scala
      "Main.scala",
      "App.scala",
      // R
      "main.R",
      "script.R",
      // Haskell
      "Main.hs",
      // Elixir
      "main.exs",
      // Julia
      "main.jl",
      // Dart
      "main.dart",
      // Web
      "script.js",
      "index.html",
    ];

    let fileToRun: FileNode | null = null;

    // For React templates, render in preview (not via code execution)
    if (selectedTemplate === "react") {
      setIsRunning(true);
      setTerminalHistory((prev) => [
        ...prev,
        { id: generateId(), type: "info", content: "🚀 Starting React app...", timestamp: new Date() },
        { id: generateId(), type: "output", content: "⚛️ React app rendered in preview", timestamp: new Date() },
      ]);
      return;
    }

    if (selectedTemplate === "scratch") {
      setIsRunning(true);
      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "info",
          content: "🏁 Scratch green flag started in workspace preview.",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    if (selectedTemplate === "arduino") {
      setIsRunning(false);
      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "info",
          content:
            '🔧 Ready to go! Use "Upload to Board" to flash your Arduino, or try the simulator to test your circuit virtually.',
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // For HTML/web templates, always prioritize index.html (JS runs inside the preview)
    if (selectedTemplate === "html" || selectedTemplate === "nodejs") {
      const htmlFile = findFileByName(files, "index.html");
      if (htmlFile) {
        fileToRun = { ...htmlFile, content: fileContents[htmlFile.id] ?? htmlFile.content };
      }
    }

    // If no HTML entry found, try language-specific entry points
    if (!fileToRun) {
      for (const entryFile of entryPointPriority) {
        const found = findFileByName(files, entryFile);
        if (found) {
          fileToRun = { ...found, content: fileContents[found.id] ?? found.content };
          break;
        }
      }
    }

    // If no entry point found, fall back to active file
    if (!fileToRun && activeFileWithContent) {
      fileToRun = activeFileWithContent;
    }

    if (!fileToRun || !fileToRun.content) {
      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "error",
          content: "No file to run. Open a file or create one first.",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setIsTerminalMinimized(false);

    const language = fileToRun.language || getFileLanguage(fileToRun.name);
    const code = fileToRun.content;

    // Detect stdin-needing patterns
    const stdinPatterns: Record<string, RegExp[]> = {
      python: [/\binput\s*\(/],
      javascript: [/\breadline\s*\(/, /process\.stdin/],
      c: [/\bscanf\s*\(/, /\bgets\s*\(/, /\bfgets\s*\(/],
      cpp: [/\bcin\s*>>/, /\bgetline\s*\(/],
      java: [/Scanner\s*\(/, /BufferedReader/],
      rust: [/stdin\(\)\.read_line/],
      go: [/fmt\.Scan/, /bufio\.NewReader\(os\.Stdin\)/],
      ruby: [/\bgets\b/, /\breadline\b/],
    };

    const patterns = stdinPatterns[language] || [];
    const needsStdin = patterns.some((p) => p.test(code));

    if (needsStdin) {
      // Extract prompt strings from input() calls if possible
      const promptRegex = /input\s*\(\s*(['"`])(.+?)\1\s*\)/g;
      const prompts: string[] = [];
      let match;
      while ((match = promptRegex.exec(code)) !== null) {
        prompts.push(match[2]);
      }

      // Count total input calls (some may not have prompt strings)
      const inputCallCount =
        (code.match(/\binput\s*\(/g) || []).length ||
        (code.match(/\bscanf\s*\(/g) || []).length ||
        (code.match(/\bcin\s*>>/g) || []).length ||
        1;

      // Fill missing prompts with generic ones
      while (prompts.length < inputCallCount) {
        prompts.push(`Enter input ${prompts.length + 1}:`);
      }

      setStdinPrompt({ prompts, code, language });

      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "info",
          content: `🚀 Running ${fileToRun!.name}...`,
          timestamp: new Date(),
        },
        {
          id: generateId(),
          type: "info",
          content: `📝 This program needs input. Enter values below:`,
          timestamp: new Date(),
        },
      ]);
      return;
    }

    setIsRunning(true);

    // Add running message
    setTerminalHistory((prev) => [
      ...prev,
      {
        id: generateId(),
        type: "info",
        content: `🚀 Running ${fileToRun!.name}...`,
        timestamp: new Date(),
      },
    ]);

    // Execute the code
    const result = await executeCode(code, language);

    // Add output to terminal
    if (result.error) {
      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "error",
          content: result.error!,
          timestamp: new Date(),
        },
      ]);
    } else if (result.output.length > 0) {
      const outputLines: TerminalLine[] = result.output.map((line) => ({
        id: generateId(),
        type: "output" as const,
        content: line,
        timestamp: new Date(),
      }));
      setTerminalHistory((prev) => [...prev, ...outputLines]);
    }

    // Add completion message
    setTerminalHistory((prev) => [
      ...prev,
      {
        id: generateId(),
        type: "info",
        content: `✅ Finished running ${fileToRun!.name}`,
        timestamp: new Date(),
      },
    ]);

    // Keep preview running for HTML/web files so the iframe stays visible
    if (!result.isPreview) {
      setIsRunning(false);
    }
  }, [activeFileWithContent, files, fileContents, executeCode, selectedTemplate]);

  // Handle stdin submission from terminal
  const handleStdinSubmit = useCallback(
    async (stdinValue: string) => {
      if (!stdinPrompt) return;

      setStdinPrompt(null);
      setIsRunning(true);

      const result = await executeCode(stdinPrompt.code, stdinPrompt.language, stdinValue);

      if (result.error) {
        setTerminalHistory((prev) => [
          ...prev,
          { id: generateId(), type: "error", content: result.error!, timestamp: new Date() },
        ]);
      } else if (result.output.length > 0) {
        const outputLines: TerminalLine[] = result.output.map((line) => ({
          id: generateId(),
          type: "output" as const,
          content: line,
          timestamp: new Date(),
        }));
        setTerminalHistory((prev) => [...prev, ...outputLines]);
      }

      setTerminalHistory((prev) => [
        ...prev,
        { id: generateId(), type: "info", content: `✅ Finished`, timestamp: new Date() },
      ]);
      setIsRunning(false);
    },
    [stdinPrompt, executeCode],
  );

  const handleStop = useCallback(() => {
    setIsRunning(false);
    setTerminalHistory((prev) => [
      ...prev,
      {
        id: generateId(),
        type: "info",
        content: "⏹ Stopped.",
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Handle selecting a project from the dialog
  const handleSelectProject = useCallback(
    (project: Project) => {
      setCurrentProject(project);
      setFiles(project.files);
      setSelectedTemplate(project.language as LanguageTemplate);
      setFileContents({});
      setOpenTabs([]);
      setActiveTabId(null);
      setHasUnsavedChanges(false);

      // Store original file contents
      const originals: Record<string, string> = {};
      const collectContents = (nodes: FileNode[]) => {
        nodes.forEach((node) => {
          if (node.type === "file" && node.content) {
            originals[node.id] = node.content;
          }
          if (node.children) collectContents(node.children);
        });
      };
      collectContents(project.files);
      setOriginalFileContents(originals);
    },
    [setCurrentProject],
  );

  // Merge file contents with current edits — used for saving and for panels that need latest content
  const filesWithContent = useMemo((): FileNode[] => {
    const mergeContent = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.type === "file") {
          const updated = fileContents[node.id];
          return updated !== undefined ? { ...node, content: updated } : node;
        }
        if (node.children) {
          return {
            ...node,
            children: mergeContent(node.children),
          };
        }
        return node;
      });
    };
    return mergeContent(files);
  }, [files, fileContents]);

  const getFilesWithContent = useCallback((): FileNode[] => filesWithContent, [filesWithContent]);

  const handleProjectSaved = useCallback(
    (project: Project) => {
      setCurrentProject(project);
      setHasUnsavedChanges(false);
      // Update original file contents after save
      const originals: Record<string, string> = {};
      const collectContents = (nodes: FileNode[]) => {
        nodes.forEach((node) => {
          if (node.type === "file" && node.content) {
            originals[node.id] = node.content;
          }
          if (node.children) collectContents(node.children);
        });
      };
      collectContents(project.files);
      setOriginalFileContents(originals);
    },
    [setCurrentProject],
  );

  const handleNewProject = useCallback(() => {
    setSelectedTemplate(null);
    setCurrentProject(null);
    setFiles([]);
    setFileContents({});
    setOpenTabs([]);
    setActiveTabId(null);
    setHasUnsavedChanges(false);
  }, [setCurrentProject]);

  // Handle fork
  const handleFork = useCallback(async () => {
    if (!currentProject) return;
    setIsForking(true);
    // Merge current edits into project files before forking
    const mergeContents = (nodes: FileNode[]): FileNode[] =>
      nodes.map((node) => ({
        ...node,
        ...(node.type === "file" && fileContents[node.id] !== undefined ? { content: fileContents[node.id] } : {}),
        ...(node.children ? { children: mergeContents(node.children) } : {}),
      }));
    const projectWithEdits = { ...currentProject, files: mergeContents(files) };
    const forked = await forkProject(projectWithEdits);
    if (forked) {
      handleSelectProject(forked);
    }
    setIsForking(false);
  }, [currentProject, forkProject, handleSelectProject, files, fileContents]);

  // Handle star
  const handleStar = useCallback(async () => {
    if (!currentProject) return;
    const success = await toggleStar(currentProject.id);
    if (success) {
      setIsStarred(!isStarred);
      setCurrentProject({
        ...currentProject,
        stars_count: isStarred ? currentProject.stars_count - 1 : currentProject.stars_count + 1,
      });
    }
  }, [currentProject, toggleStar, isStarred, setCurrentProject]);

  // Track unsaved changes
  useEffect(() => {
    if (Object.keys(fileContents).length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [fileContents]);

  // Auto-save to IndexedDB for offline-capable templates (debounced 3s)
  useEffect(() => {
    if (!selectedTemplate || !checkOffline(selectedTemplate)) return;
    if (files.length === 0) return;

    if (offlineSaveTimerRef.current) clearTimeout(offlineSaveTimerRef.current);
    offlineSaveTimerRef.current = setTimeout(() => {
      // Apply in-memory edits to file tree before saving
      const mergedFiles = JSON.parse(JSON.stringify(files)) as FileNode[];
      const applyEdits = (nodes: FileNode[]) => {
        for (const node of nodes) {
          if (node.type === 'file' && fileContents[node.id]) {
            node.content = fileContents[node.id];
          }
          if (node.children) applyEdits(node.children);
        }
      };
      applyEdits(mergedFiles);

      saveLocally(
        mergedFiles,
        selectedTemplate,
        localProjectName,
        currentProject?.id ? `remote-${currentProject.id}` : undefined,
        currentProject?.id,
      );
    }, 3000);

    return () => {
      if (offlineSaveTimerRef.current) clearTimeout(offlineSaveTimerRef.current);
    };
  }, [files, fileContents, selectedTemplate, localProjectName, currentProject, saveLocally, checkOffline]);


  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      // Ctrl+S — Save project
      if (isMod && e.key === "s") {
        e.preventDefault();
        if (user) setShowSaveDialog(true);
      }

      // Ctrl+B — Toggle sidebar
      if (isMod && e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }

      // Ctrl+` — Toggle terminal
      if (isMod && e.key === "`") {
        e.preventDefault();
        setIsTerminalMinimized((prev) => !prev);
      }

      // F5 — Run code
      if (e.key === "F5") {
        e.preventDefault();
        handleRun();
      }

      // Ctrl+Enter — Run current file
      if (isMod && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }

      // Ctrl+Shift+F — Search in files (open sidebar to search tab)
      if (isMod && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setIsSidebarOpen(true);
        // The sidebar exposes a search tab; we trigger it via a custom event
        window.dispatchEvent(new CustomEvent("ide-focus-search"));
      }

      // Ctrl+P — Quick file open (prevent browser print)
      if (isMod && e.key === "p") {
        e.preventDefault();
        // Could open a command palette in the future
        setIsSidebarOpen(true);
        window.dispatchEvent(new CustomEvent("ide-focus-search"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Listen for parts inventory open event from ToolsPanel
    const handleOpenParts = (event: Event) => {
      const customEvent = event as CustomEvent<{
        platform?: "ftc" | "arduino" | "general";
        initialTab?: "inventory" | "add" | "catalog";
        identifyWithImage?: boolean;
      }>;
      setPartsInventoryPlatform(customEvent.detail?.platform);
      setPartsInventoryInitialTab(customEvent.detail?.initialTab ?? "inventory");
      setPartsInventoryIdentifyWithImage(Boolean(customEvent.detail?.identifyWithImage));
      setShowPartsInventory(true);
    };
    window.addEventListener("open-parts-inventory", handleOpenParts as EventListener);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-parts-inventory", handleOpenParts as EventListener);
    };
  }, [user, handleRun]);

  // Handle Git import
  const handleGitImport = useCallback(
    (importedFiles: FileNode[], repoName: string) => {
      setFiles(importedFiles);
      setSelectedTemplate("javascript"); // Default template for imported repos
      setFileContents({});
      setOpenTabs([]);
      setActiveTabId(null);

      // Store original file contents
      const originals: Record<string, string> = {};
      const collectContents = (nodes: FileNode[]) => {
        nodes.forEach((node) => {
          if (node.type === "file" && node.content) {
            originals[node.id] = node.content;
          }
          if (node.children) collectContents(node.children);
        });
      };
      collectContents(importedFiles);
      setOriginalFileContents(originals);

      toast({
        title: "Repository imported",
        description: `Successfully imported "${repoName}"`,
      });

      setTerminalHistory((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "info",
          content: `📦 Imported GitHub repository: ${repoName}`,
          timestamp: new Date(),
        },
      ]);
    },
    [toast],
  );

  // Handle rename project
  const handleRenameProject = useCallback(
    (newName: string) => {
      setLocalProjectName(newName);
      if (currentProject) {
        setCurrentProject({ ...currentProject, name: newName });
      }
      addHistoryEntry("rename", `Renamed project to "${newName}"`);
      toast({
        title: "Project renamed",
        description: `Project renamed to "${newName}"`,
      });
    },
    [currentProject, setCurrentProject, toast, addHistoryEntry],
  );

  // Handle change template (resets files to new template)
  const handleChangeTemplate = useCallback(
    (template: LanguageTemplate) => {
      handleSelectTemplate(template);
      setOpenTabs([]);
      setActiveTabId(null);
      setFileContents({});
      setHasUnsavedChanges(true);
      addHistoryEntry("template-change", `Changed template to ${template}`);
      toast({
        title: "Template changed",
        description: `Switched to ${template} template`,
      });
    },
    [handleSelectTemplate, toast, addHistoryEntry],
  );

  // On mobile, sync mobile panel state with AI chat
  useEffect(() => {
    if (isMobile) {
      if (mobileActivePanel === "ai") {
        setIsAIChatOpen(true);
      } else {
        setIsAIChatOpen(false);
      }
    }
  }, [mobileActivePanel, isMobile]);

  // Show language picker if no template selected
  if (!selectedTemplate) {
    return (
      <>
        <LanguagePicker onSelect={handleSelectTemplate} />
        <ProjectsDialog
          open={showProjectsDialog}
          onOpenChange={setShowProjectsDialog}
          onSelectProject={handleSelectProject}
          onNewProject={handleNewProject}
        />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header
        projectName={currentProject?.name || localProjectName}
        isRunning={isRunning}
        onRun={handleRun}
        onStop={handleStop}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onToggleAIChat={() => {
          if (isMobile) {
            setMobileActivePanel("ai");
          } else {
            setIsAIChatOpen(!isAIChatOpen);
          }
        }}
        isAIChatOpen={isAIChatOpen || mobileActivePanel === "ai"}
        isAILoading={isAILoading}
        onOpenProjects={() => setShowProjectsDialog(true)}
        onSaveProject={() => setShowSaveDialog(true)}
        hasUnsavedChanges={hasUnsavedChanges}
        currentProject={currentProject}
        onFork={handleFork}
        onStar={handleStar}
        onShare={() => setShowShareDialog(true)}
        onGitImport={() => setShowGitImportDialog(true)}
        onCollab={() => setShowCollabDialog(true)}
        presence={collab.presence}
        isStarred={isStarred}
        isForking={isForking}
        starsCount={currentProject?.stars_count || 0}
        onRenameProject={handleRenameProject}
        onChangeTemplate={handleChangeTemplate}
      />

      <ProjectsDialog
        open={showProjectsDialog}
        onOpenChange={setShowProjectsDialog}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
      />

      <SaveProjectDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        files={getFilesWithContent()}
        language={selectedTemplate}
        currentProject={currentProject}
        onSaved={handleProjectSaved}
      />

      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        project={currentProject}
        onProjectUpdated={setCurrentProject}
      />

      <CollabDialog open={showCollabDialog} onOpenChange={setShowCollabDialog} projectId={currentProject?.id} />

      <Suspense fallback={null}>
        <PartsInventoryDialog
          open={showPartsInventory}
          onOpenChange={(open) => {
            setShowPartsInventory(open);
            if (!open) {
              setPartsInventoryInitialTab("inventory");
              setPartsInventoryIdentifyWithImage(false);
            }
          }}
          currentTemplate={selectedTemplate || undefined}
          preferredPlatform={partsInventoryPlatform}
          initialTab={partsInventoryInitialTab}
          identifyWithImage={partsInventoryIdentifyWithImage}
        />
      </Suspense>

      <GitProviderImportDialog
        open={showGitImportDialog}
        onOpenChange={setShowGitImportDialog}
        onImport={handleGitImport}
      />

      <div className="flex-1 flex overflow-hidden pb-0 md:pb-0" style={{ paddingBottom: isMobile ? "56px" : "0" }}>
        {/* Sidebar - Desktop: slide panel, Mobile: drawer overlay */}
        {isMobile ? (
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetContent side="left" className="w-[min(92vw,440px)] p-0 sm:w-[420px]">
              <Sidebar
                files={files}
                fileContents={fileContents}
                onFileSelect={handleFileSelect}
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
                onRenameFile={handleRenameFile}
                onUploadFiles={handleUploadFiles}
                onImportScratchProject={handleImportScratchProject}
                activeFileId={activeTab?.fileId || null}
                currentLanguage={selectedTemplate || "javascript"}
                gitState={gitState}
                onGitCommit={handleGitCommit}
                onGitStageFile={handleGitStageFile}
                onGitUnstageFile={handleGitUnstageFile}
                onGitDiscardChanges={handleGitDiscardChanges}
                onGitCreateBranch={handleGitCreateBranch}
                onGitSwitchBranch={handleGitSwitchBranch}
                onGitInitRepo={handleGitInitRepo}
                onUpdateFileContent={handleContentChange}
                workflows={workflows}
                onRunWorkflow={handleRunWorkflow}
                onCreateWorkflow={handleCreateWorkflow}
                onUpdateWorkflow={handleUpdateWorkflow}
                onDeleteWorkflow={handleDeleteWorkflow}
                currentlyRunningWorkflow={currentlyRunningWorkflow}
                historyEntries={historyEntries}
                onRestoreEntry={(entry) => {
                  if (!entry.snapshot) {
                    toast({
                      title: "Cannot rollback",
                      description: "This event has no restorable snapshot.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setFiles(entry.snapshot.files);
                  setFileContents(entry.snapshot.fileContents);
                  setHasUnsavedChanges(true);
                  addHistoryEntry("file-edit", `Rolled back to: ${entry.label}`);
                  toast({ title: "Rolled back", description: `Restored state from "${entry.label}"` });
                }}
                onInvite={() => setShowShareDialog(true)}
              />
            </SheetContent>
          </Sheet>
        ) : (
          <div
            className={cn(
              "hidden md:block transition-all duration-200 border-r border-border overflow-hidden",
              isSidebarOpen ? "w-[22rem] xl:w-[24rem]" : "w-0",
            )}
          >
            <Sidebar
              files={files}
              fileContents={fileContents}
              onFileSelect={handleFileSelect}
              onCreateFile={handleCreateFile}
              onDeleteFile={handleDeleteFile}
              onRenameFile={handleRenameFile}
              onUploadFiles={handleUploadFiles}
              onImportScratchProject={handleImportScratchProject}
              activeFileId={activeTab?.fileId || null}
              currentLanguage={selectedTemplate || "javascript"}
              gitState={gitState}
              onGitCommit={handleGitCommit}
              onGitStageFile={handleGitStageFile}
              onGitUnstageFile={handleGitUnstageFile}
              onGitDiscardChanges={handleGitDiscardChanges}
              onGitCreateBranch={handleGitCreateBranch}
              onGitSwitchBranch={handleGitSwitchBranch}
              onGitInitRepo={handleGitInitRepo}
              onUpdateFileContent={handleContentChange}
              workflows={workflows}
              onRunWorkflow={handleRunWorkflow}
              onCreateWorkflow={handleCreateWorkflow}
              onUpdateWorkflow={handleUpdateWorkflow}
              onDeleteWorkflow={handleDeleteWorkflow}
              currentlyRunningWorkflow={currentlyRunningWorkflow}
              historyEntries={historyEntries}
              onRestoreEntry={(entry) => {
                if (!entry.snapshot) {
                  toast({
                    title: "Cannot rollback",
                    description: "This event has no restorable snapshot.",
                    variant: "destructive",
                  });
                  return;
                }
                setFiles(entry.snapshot.files);
                setFileContents(entry.snapshot.fileContents);
                setHasUnsavedChanges(true);
                addHistoryEntry("file-edit", `Rolled back to: ${entry.label}`);
                toast({ title: "Rolled back", description: `Restored state from "${entry.label}"` });
              }}
              onInvite={() => setShowShareDialog(true)}
            />
          </div>
        )}

        {/* Main content area - Mobile: stacked panels, Desktop: resizable */}
        <div className="flex-1 flex overflow-hidden">
          {isMobile ? (
            // Mobile: Single panel view with bottom nav switcher
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Editor Panel */}
              {mobileActivePanel === "editor" && selectedTemplate !== "scratch" && selectedTemplate !== "automation" && (
                <div className="h-full flex flex-col">
                  <EditorTabs
                    tabs={openTabs}
                    activeTabId={activeTabId}
                    onTabClick={handleTabClick}
                    onTabClose={handleTabClose}
                  />
                  <div className="flex-1 overflow-hidden">
                    <CodeEditor file={activeFileWithContent} allFiles={filesWithContent} currentFilePath={activeFilePath} onContentChange={handleContentChange} onCreateOrUpdateFile={handleCreateOrUpdateFile} collab={collab} />
                  </div>
                </div>
              )}

              {/* Preview Panel */}
              {mobileActivePanel === "preview" && (
                <div className="h-full flex flex-col">
                  {selectedTemplate === "arduino" ? (
                    <Suspense fallback={<div className="p-4 text-muted-foreground">Loading Arduino panel...</div>}>
                      <ArduinoPanel
                        files={filesWithContent}
                        onFileUpdate={handleContentChange}
                        onAddFile={addFile}
                        currentTemplate={selectedTemplate}
                      />
                    </Suspense>
                  ) : selectedTemplate === "ftc" ? (
                    <Suspense fallback={<div className="p-4 text-muted-foreground">Loading {selectedTemplate.toUpperCase()} panel...</div>}>
                      <FTCPanel
                        files={filesWithContent}
                        onFileUpdate={handleContentChange}
                      />
                    </Suspense>
                  ) : selectedTemplate === "automation" ? (
                    <Suspense fallback={<div className="p-4 text-muted-foreground">Loading Automation Canvas...</div>}>
                      <AutomationTemplatePane />
                    </Suspense>
                  ) : selectedTemplate === "scratch" ? (
                    <Suspense fallback={<div className="p-4 text-muted-foreground">Loading Scratch panel...</div>}>
                      <ScratchPanel
                        archive={scratchArchive}
                        onArchiveChange={setScratchArchive}
                        onProjectJsonUpdate={(json) => {
                          setFiles((prev) =>
                            prev.map((node) => {
                              if (node.type !== "folder") return node;
                              return {
                                ...node,
                                children: (node.children || []).map((child) =>
                                  child.name === "project.json" ? { ...child, content: json } : child,
                                ),
                              };
                            }),
                          );
                        }}
                        isRunning={isRunning}
                        onRun={() => setIsRunning(true)}
                        onStop={handleStop}
                      />
                    </Suspense>
                  ) : selectedTemplate === "minecraft" ? (
                    <Suspense fallback={<div className="p-4 text-muted-foreground">Loading Minecraft panel...</div>}>
                      <MinecraftEditor
                        files={filesWithContent}
                        currentFile={activeFileWithContent}
                        onFileChange={handleTabClick}
                      />
                    </Suspense>
                  ) : (
                    <Preview
                      htmlContent={htmlContent}
                      cssContent={cssContent}
                      jsContent={jsContent}
                      isRunning={isRunning}
                    />
                  )}
                </div>
              )}

              {/* Terminal Panel */}
              {mobileActivePanel === "terminal" && (
                <div className="h-full flex flex-col">
                  <Terminal
                    history={terminalHistory}
                    onCommand={handleCommand}
                    isMinimized={false}
                    onToggleMinimize={() => {}}
                    stdinPrompt={stdinPrompt}
                    onStdinSubmit={handleStdinSubmit}
                  />
                </div>
              )}

              {/* AI Panel is handled by AIChat component */}
            </div>
          ) : (
            // Desktop: Resizable panels
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              {/* Editor panel - hidden for scratch, automation, and minecraft templates */}
              {selectedTemplate !== "scratch" && selectedTemplate !== "automation" && selectedTemplate !== "minecraft" && (
                <>
                  <ResizablePanel defaultSize={54} minSize={34}>
                    <div className="h-full flex flex-col">
                      <EditorTabs
                        tabs={openTabs}
                        activeTabId={activeTabId}
                        onTabClick={handleTabClick}
                        onTabClose={handleTabClose}
                      />
                      <div className="flex-1 flex flex-col overflow-hidden">
                        <CodeEditor file={activeFileWithContent} allFiles={filesWithContent} currentFilePath={activeFilePath} onContentChange={handleContentChange} onCreateOrUpdateFile={handleCreateOrUpdateFile} collab={collab} />
                        <Terminal
                          history={terminalHistory}
                          onCommand={handleCommand}
                          isMinimized={isTerminalMinimized}
                          onToggleMinimize={() => setIsTerminalMinimized(!isTerminalMinimized)}
                          stdinPrompt={stdinPrompt}
                          onStdinSubmit={handleStdinSubmit}
                        />
                      </div>
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle className="bg-border" />
                </>
              )}

              {/* Preview panel or Arduino/Scratch/Automation panel */}
              <ResizablePanel defaultSize={selectedTemplate === "scratch" || selectedTemplate === "automation" ? 100 : 46} minSize={24}>
                {selectedTemplate === "arduino" ? (
                  <Suspense fallback={<div className="p-4 text-muted-foreground">Loading Arduino panel...</div>}>
                    <ArduinoPanel
                      files={filesWithContent}
                      onFileUpdate={handleContentChange}
                      onAddFile={addFile}
                      currentTemplate={selectedTemplate}
                    />
                  </Suspense>
                ) : selectedTemplate === "ftc" ? (
                  <Suspense fallback={<div className="p-4 text-muted-foreground">Loading {selectedTemplate.toUpperCase()} panel...</div>}>
                    <FTCPanel
                      files={filesWithContent}
                      onFileUpdate={handleContentChange}
                    />
                  </Suspense>
                ) : selectedTemplate === "automation" ? (
                  <Suspense fallback={<div className="p-4 text-muted-foreground">Loading Automation Canvas...</div>}>
                    <AutomationTemplatePane />
                  </Suspense>
                ) : selectedTemplate === "scratch" ? (
                  <Suspense fallback={<div className="p-4 text-gray-400">Loading Scratch panel...</div>}>
                    <ScratchPanel
                      archive={scratchArchive}
                      onArchiveChange={setScratchArchive}
                      onProjectJsonUpdate={(json) => {
                        setFiles((prev) =>
                          prev.map((node) => {
                            if (node.type !== "folder") return node;
                            return {
                              ...node,
                              children: (node.children || []).map((child) =>
                                child.name === "project.json" ? { ...child, content: json } : child,
                              ),
                            };
                          }),
                        );
                      }}
                      isRunning={isRunning}
                      onRun={() => setIsRunning(true)}
                      onStop={handleStop}
                    />
                  </Suspense>
                ) : selectedTemplate === "minecraft" ? (
                  <Suspense fallback={<div className="p-4 text-muted-foreground">Loading Minecraft panel...</div>}>
                    <MinecraftEditor
                      files={filesWithContent}
                      currentFile={activeFileWithContent}
                      onFileChange={handleTabClick}
                    />
                  </Suspense>
                ) : (
                  <Preview
                    htmlContent={htmlContent}
                    cssContent={cssContent}
                    jsContent={jsContent}
                    isRunning={isRunning}
                  />
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          )}

          {/* AI Chat Sidebar - Mobile: full screen, Desktop: sidebar */}
          <AIChat
            isOpen={isAIChatOpen || mobileActivePanel === "ai"}
            onClose={() => {
              if (isMobile) {
                setMobileActivePanel("editor");
              } else {
                setIsAIChatOpen(false);
              }
            }}
            currentFile={activeFileWithContent}
            consoleOutput={terminalHistory}
            onInsertCode={(code) => {
              if (activeFile) {
                const currentContent = fileContents[activeFile.id] ?? activeFile.content ?? "";
                handleContentChange(activeFile.id, currentContent + "\n\n" + code);
              }
            }}
            onApplyCode={(code, fileName) => {
              // Try to find an existing file with that name
              const findFileByName = (nodes: FileNode[], name: string): FileNode | null => {
                for (const node of nodes) {
                  if (node.type === "file" && node.name === name) return node;
                  if (node.children) {
                    const found = findFileByName(node.children, name);
                    if (found) return found;
                  }
                }
                return null;
              };
              const existingFile = findFileByName(files, fileName);

              // Check if code is a unified diff (starts with @@ or diff header)
              const isDiffContent =
                /^@@\s*-\d+/.test(code.trim()) || /^---\s/.test(code.trim()) || /^diff\s/.test(code.trim());

              if (existingFile) {
                if (isDiffContent) {
                  const originalContent = fileContents[existingFile.id] || existingFile.content || "";
                  try {
                    const patched = applyDiff(originalContent, code);
                    handleContentChange(existingFile.id, patched);
                  } catch {
                    handleContentChange(existingFile.id, code);
                  }
                } else {
                  handleContentChange(existingFile.id, code);
                }
                handleFileSelect(existingFile);
              } else {
                // Create new file in root folder
                const newFileId = generateId();
                const newFile: FileNode = {
                  id: newFileId,
                  name: fileName,
                  type: "file",
                  content: code,
                  language: getFileLanguage(fileName),
                };
                setFiles((prev) => {
                  const root = prev[0];
                  if (root && root.type === "folder") {
                    return [{ ...root, children: [...(root.children || []), newFile] }];
                  }
                  return [...prev, newFile];
                });
                setFileContents((prev) => ({ ...prev, [newFileId]: code }));
                const newTab: Tab = { id: generateId(), name: fileName, fileId: newFileId, isModified: false };
                setOpenTabs((prev) => [...prev, newTab]);
                setActiveTabId(newTab.id);
                addHistoryEntry("file-create", `Created: ${fileName}`, "via AI");
              }
              toast({ title: "Code applied", description: `Applied changes to "${fileName}"` });
            }}
            workflows={workflows}
            onCreateWorkflow={handleCreateWorkflow}
            onRunWorkflow={handleRunWorkflow}
            onLoadingChange={setIsAILoading}
            onInstallPackage={(packageName) => {
              // Add to installed packages list and show terminal feedback
              setTerminalHistory((prev) => [
                ...prev,
                {
                  id: generateId(),
                  type: "info",
                  content: `📦 Installing package: ${packageName}...`,
                  timestamp: new Date(),
                },
                {
                  id: generateId(),
                  type: "output",
                  content: `✅ Package "${packageName}" added successfully`,
                  timestamp: new Date(),
                },
              ]);
              toast({ title: `Package installed`, description: `"${packageName}" has been added.` });
            }}
            onSetTheme={(themeName) => {
              // Import and use theme context - we need to trigger theme change
              document.documentElement.setAttribute("data-theme", themeName);
              localStorage.setItem("ide-theme", themeName);
              setTerminalHistory((prev) => [
                ...prev,
                {
                  id: generateId(),
                  type: "info",
                  content: `🎨 Theme changed to: ${themeName}`,
                  timestamp: new Date(),
                },
              ]);
              toast({ title: "Theme changed", description: `Switched to "${themeName}"` });
            }}
            onCreateCustomTheme={(themeName, colors) => {
              const themeId = Math.random().toString(36).substring(2, 9);
              addCustomTheme({ id: themeId, name: themeName, colors });
              setTerminalHistory((prev) => [
                ...prev,
                {
                  id: generateId(),
                  type: "info",
                  content: `🎨 Created and applied custom theme: "${themeName}"`,
                  timestamp: new Date(),
                },
              ]);
              toast({ title: "Custom theme created", description: `"${themeName}" is now active` });
            }}
            onGitCommit={(message) => {
              if (!gitState.isInitialized) {
                handleGitInitRepo();
              }
              handleGitCommit(message);
            }}
            onGitInit={handleGitInitRepo}
            onGitCreateBranch={(name) => {
              if (!gitState.isInitialized) {
                handleGitInitRepo();
              }
              handleGitCreateBranch(name);
            }}
            onGitImport={(url) => {
              setShowGitImportDialog(true);
            }}
            onMakePublic={async () => {
              if (!currentProject) {
                toast({
                  title: "Save project first",
                  description: "Save the project before changing visibility",
                  variant: "destructive",
                });
                return;
              }
              const updatedProject = await dataProvider.updateProject({
                ...currentProject,
                is_public: true,
                publish_slug: currentProject.publish_slug || currentProject.name.toLowerCase().replace(/\s+/g, "-"),
                published_at: new Date().toISOString(),
              });
              if (updatedProject) {
                setCurrentProject(updatedProject);
                toast({ title: "Project is now public", description: "Anyone with the link can view this project" });
              }
            }}
            onMakePrivate={async () => {
              if (!currentProject) {
                toast({
                  title: "Save project first",
                  description: "Save the project before changing visibility",
                  variant: "destructive",
                });
                return;
              }
              const updatedProject = await dataProvider.updateProject({
                ...currentProject,
                is_public: false,
              });
              if (updatedProject) {
                setCurrentProject(updatedProject);
                toast({ title: "Project is now private", description: "Only you can access this project" });
              }
            }}
            onGetProjectLink={() => {
              const link = currentProject ? buildProjectShareUrl(currentProject.id) : window.location.href;
              navigator.clipboard.writeText(link);
              toast({ title: "Link copied!", description: link });
            }}
            onShareTwitter={() => {
              const link = currentProject
                ? `${window.location.origin}/project/${currentProject.id}`
                : window.location.href;
              const text = `Check out "${currentProject?.name || "my project"}" on Code Canvas Complete!`;
              window.open(
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`,
                "_blank",
              );
            }}
            onShareLinkedin={() => {
              const link = currentProject
                ? `${window.location.origin}/project/${currentProject.id}`
                : window.location.href;
              window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, "_blank");
            }}
            onShareEmail={() => {
              const link = currentProject
                ? `${window.location.origin}/project/${currentProject.id}`
                : window.location.href;
              const title = currentProject?.name || "My Project";
              window.open(
                `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Check out "${title}"!\n\n${link}`)}`,
                "_blank",
              );
            }}
            onForkProject={() => {
              handleFork();
            }}
            onStarProject={() => {
              handleStar();
            }}
            onViewHistory={() => {
              // Open the sidebar history panel
              setIsSidebarOpen(true);
              toast({
                title: "History panel",
                description: "Check the History tab in the sidebar to browse and rollback changes.",
              });
            }}
            onAskUser={(question) => {
              toast({ title: "Agent Question", description: question, duration: 10000 });
            }}
            onSaveProject={() => {
              setShowSaveDialog(true);
            }}
            onRunProject={() => {
              handleRun();
            }}
            onChangeTemplate={(template) => {
              handleChangeTemplate(template as LanguageTemplate);
            }}
            onRenameFile={(oldName, newName) => {
              const findFileByName = (nodes: FileNode[], name: string): FileNode | null => {
                for (const node of nodes) {
                  if (node.type === "file" && node.name === name) return node;
                  if (node.children) {
                    const found = findFileByName(node.children, name);
                    if (found) return found;
                  }
                }
                return null;
              };
              const target = findFileByName(files, oldName);
              if (target) handleRenameFile(target.id, newName);
            }}
            onDeleteFile={(name) => {
              const findFileByName = (nodes: FileNode[], targetName: string): FileNode | null => {
                for (const node of nodes) {
                  if (node.type === "file" && node.name === targetName) return node;
                  if (node.children) {
                    const found = findFileByName(node.children, targetName);
                    if (found) return found;
                  }
                }
                return null;
              };
              const target = findFileByName(files, name);
              if (target) handleDeleteFile(target.id);
            }}
            onCreateFile={(name, type, content) => {
              const normalizedName = name.trim();
              if (!normalizedName) return;

              const pathParts = normalizedName.split("/").filter(Boolean);
              const finalName = pathParts[pathParts.length - 1];
              if (!finalName) return;

              const ensureFolderByPath = (nodes: FileNode[], segments: string[]): string | null => {
                if (segments.length === 0) return null;
                const root = nodes[0];
                if (!root || root.type !== "folder") return null;

                let currentFolder = root;
                for (const segment of segments) {
                  const children = currentFolder.children || [];
                  let nextFolder = children.find(
                    (child) => child.type === "folder" && child.name === segment,
                  );
                  if (!nextFolder) {
                    const folderNode: FileNode = {
                      id: generateId(),
                      name: segment,
                      type: "folder",
                      children: [],
                    };
                    setFiles((prev) => {
                      const clone = structuredClone(prev) as FileNode[];
                      const rootClone = clone[0];
                      if (!rootClone || rootClone.type !== "folder") return prev;
                      const walk = (folder: FileNode): FileNode => {
                        if (folder.id === currentFolder.id) {
                          return { ...folder, children: [...(folder.children || []), folderNode] };
                        }
                        return {
                          ...folder,
                          children: (folder.children || []).map((child) =>
                            child.type === "folder" ? walk(child) : child,
                          ),
                        };
                      };
                      return [walk(rootClone)];
                    });
                    nextFolder = folderNode;
                  }
                  currentFolder = nextFolder;
                }
                return currentFolder.id;
              };

              const parentPath = pathParts.slice(0, -1);
              const parentId = ensureFolderByPath(files, parentPath);
              handleCreateFile(parentId, finalName, type);

              if (type === "file" && typeof content === "string" && content.trim()) {
                const updateFileContentByName = (nodes: FileNode[]): FileNode[] =>
                  nodes.map((node) => {
                    if (node.type === "file" && node.name === finalName) {
                      return { ...node, content };
                    }
                    if (node.children) {
                      return { ...node, children: updateFileContentByName(node.children) };
                    }
                    return node;
                  });
                setFiles((prev) => updateFileContentByName(prev));
              }
            }}
            onDuplicateFile={(sourceName, targetName) => {
              const findFileByName = (nodes: FileNode[], target: string): FileNode | null => {
                for (const node of nodes) {
                  if (node.type === "file" && node.name === target) return node;
                  if (node.children) {
                    const found = findFileByName(node.children, target);
                    if (found) return found;
                  }
                }
                return null;
              };
              const source = findFileByName(files, sourceName);
              if (!source || source.type !== "file") return;
              handleCreateFile(null, targetName, "file");
              setFiles((prev) =>
                prev.map((node) =>
                  node.type === "folder"
                    ? {
                        ...node,
                        children: (node.children || []).map((child) =>
                          child.type === "file" && child.name === targetName
                            ? { ...child, content: source.content, language: source.language }
                            : child,
                        ),
                      }
                    : node,
                ),
              );
            }}
            onOpenFile={(name) => {
              const findFileByName = (nodes: FileNode[], targetName: string): FileNode | null => {
                for (const node of nodes) {
                  if (node.type === "file" && node.name === targetName) return node;
                  if (node.children) {
                    const found = findFileByName(node.children, targetName);
                    if (found) return found;
                  }
                }
                return null;
              };
              const target = findFileByName(files, name);
              if (target) handleFileSelect(target);
            }}
            onAppendToFile={(name, appendedContent) => {
              setFiles((prev) => {
                const appendToTarget = (nodes: FileNode[]): FileNode[] =>
                  nodes.map((node) => {
                    if (node.type === "file" && node.name === name) {
                      const existing = node.content || "";
                      const next = existing.endsWith("\n") || existing.length === 0
                        ? `${existing}${appendedContent}`
                        : `${existing}\n${appendedContent}`;
                      return { ...node, content: next };
                    }
                    if (node.children) return { ...node, children: appendToTarget(node.children) };
                    return node;
                  });
                return appendToTarget(prev);
              });
            }}
            currentTemplate={selectedTemplate || undefined}
          />
        </div>

        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <MobileBottomNav
            activePanel={mobileActivePanel}
            onPanelChange={setMobileActivePanel}
            showPreview={selectedTemplate !== "typescript" && selectedTemplate !== "python"}
            showTerminal={selectedTemplate !== "scratch" && selectedTemplate !== "automation"}
          />
        )}
      </div>
    </div>
  );
};

// Helper to get default content for new files
function getDefaultContent(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "html":
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
</head>
<body>
  
</body>
</html>`;
    case "css":
      return `/* ${filename} */\n`;
    case "js":
    case "ts":
      return `// ${filename}\n`;
    case "json":
      return `{\n  \n}`;
    case "md":
      return `# ${filename.replace(/\.md$/, "")}\n`;
    default:
      return "";
  }
}
