import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { applyDiff } from "@/lib/diffUtils";
import { useNavigate } from "react-router-dom";
import { FileNode, Tab, TerminalLine, GitState, GitCommit, GitChange, Workflow } from "@/types/ide";
import { getTemplateFiles, findFileById, getFileLanguage } from "@/data/defaultFiles";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { EditorTabs } from "./EditorTabs";
import { CodeEditor } from "./CodeEditor";
import { Terminal } from "./Terminal";
import { Preview } from "./Preview";
import { LanguagePicker } from "./LanguagePicker";
import type { LanguageTemplate } from "@/data/templateRegistry";
import { AIChat } from "./AIChat";
import { ProjectsDialog } from "./ProjectsDialog";
import { SaveProjectDialog } from "./SaveProjectDialog";
import { ShareDialog } from "./ShareDialog";
import { GitProviderImportDialog } from "./GitProviderImportDialog";
import { CollabDialog, PresenceAvatars } from "./CollabDialog";
import { useCollaboration } from "@/hooks/useCollaboration";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { useCodeExecution } from "@/hooks/useCodeExecution";
import { useProjects, Project } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { ScratchArchive, importSb3 } from "@/services/scratchSb3";

const ArduinoPanel = lazy(() => import("@/components/arduino").then((m) => ({ default: m.ArduinoPanel })));
const ScratchPanel = lazy(() => import("@/components/scratch/ScratchPanel").then((m) => ({ default: m.ScratchPanel })));

interface IDELayoutProps {
  projectId?: string;
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

export const IDELayout = ({ projectId }: IDELayoutProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addCustomTheme } = useTheme();
  const navigate = useNavigate();
  const { currentProject, setCurrentProject, loadProject, forkProject, toggleStar } = useProjects();

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
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
  const { executeCode, executeShellCommand, isExecuting } = useCodeExecution();
  const collab = useCollaboration(currentProject?.id);

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

  const handleSelectTemplate = useCallback((template: LanguageTemplate) => {
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
  }, []);

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

  // Get the active file
  const activeTab = openTabs.find((tab) => tab.id === activeTabId);
  const activeFile = activeTab ? findFileById(files, activeTab.fileId) : null;

  // Prepare active file with updated content
  const activeFileWithContent = activeFile
    ? { ...activeFile, content: fileContents?.[activeFile.id] ?? activeFile.content }
    : null;

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
        const result = await executeShellCommand(workflow.command);
        const success = !result.error;

        setWorkflows((prev) =>
          prev.map((w) =>
            w.id === workflow.id ? { ...w, lastRun: new Date(), lastStatus: success ? "success" : "failed" } : w,
          ),
        );

        setTerminalHistory((prev) => {
          const outputLines = result.output.map((line) => ({
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
              : `❌ Workflow "${workflow.name}" failed: ${result.error}`,
            timestamp: new Date(),
          };

          return [...prev, ...outputLines, statusLine];
        });
      } finally {
        setCurrentlyRunningWorkflow(null);
      }
    },
    [executeShellCommand],
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
    const parsed = await importSb3(await file.arrayBuffer());
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
    [openTabs, addHistoryEntry],
  );

  // helper that wraps createFile and also sets initial content
  const addFile = useCallback(
    (name: string, content: string, language?: string) => {
      handleCreateFile(null, name, "file");
      setTimeout(() => {
        const findAndSet = (nodes: FileNode[]): string | null => {
          for (const node of nodes) {
            if (node.type === "file" && node.name === name) {
              handleContentChange(node.id, content);
              return node.id;
            }
            if (node.children) {
              const res = findAndSet(node.children);
              if (res) return res;
            }
          }
          return null;
        };
        findAndSet(files);
      }, 0);
    },
    [handleCreateFile, handleContentChange, files],
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
          content: "🔧 Ready to go! Use \"Upload to Board\" to flash your Arduino, or try the simulator to test your circuit virtually.",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // For HTML/web templates, always prioritize index.html (JS runs inside the preview)
    if (
      selectedTemplate === "html" ||
      selectedTemplate === "nodejs" ||
      selectedTemplate === "flask" ||
      selectedTemplate === "django"
    ) {
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

  // Merge file contents with current edits for saving
  const getFilesWithContent = useCallback((): FileNode[] => {
    const mergeContent = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.type === "file") {
          return {
            ...node,
            content: fileContents[node.id] ?? node.content,
          };
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
    return () => window.removeEventListener("keydown", handleKeyDown);
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
        onToggleAIChat={() => setIsAIChatOpen(!isAIChatOpen)}
        isAIChatOpen={isAIChatOpen}
        isAILoading={isAILoading}
        onOpenProjects={() => setShowProjectsDialog(true)}
        onSaveProject={() => setShowSaveDialog(true)}
        hasUnsavedChanges={hasUnsavedChanges}
        currentProject={currentProject}
        onFork={handleFork}
        onStar={handleStar}
        onShare={() => setShowShareDialog(true)}
        onGitImport={() => setShowGitImportDialog(true)}
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

      <CollabDialog
        open={showCollabDialog}
        onOpenChange={setShowCollabDialog}
        projectId={currentProject?.id}
      />

      <GitProviderImportDialog
        open={showGitImportDialog}
        onOpenChange={setShowGitImportDialog}
        onImport={handleGitImport}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            "transition-all duration-200 border-r border-border overflow-hidden",
            isSidebarOpen ? "w-64" : "w-0",
          )}
        >
          <Sidebar
            files={files}
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

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* Editor panel - hidden for scratch template */}
            {selectedTemplate !== "scratch" && (
              <>
                <ResizablePanel defaultSize={50} minSize={30}>
                  <div className="h-full flex flex-col">
                    <EditorTabs
                      tabs={openTabs}
                      activeTabId={activeTabId}
                      onTabClick={handleTabClick}
                      onTabClose={handleTabClose}
                    />
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <CodeEditor file={activeFileWithContent} onContentChange={handleContentChange} />
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

            {/* Preview panel or Arduino/Scratch panel */}
            <ResizablePanel defaultSize={selectedTemplate === "scratch" ? 100 : 50} minSize={20}>
              {selectedTemplate === "arduino" ? (
                <Suspense fallback={<div className="p-4 text-gray-400">Loading Arduino panel...</div>}>
                  <ArduinoPanel
                    files={files}
                    onFileUpdate={handleContentChange}
                    onAddFile={addFile}
                    currentTemplate={selectedTemplate}
                  />
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

          {/* AI Chat Sidebar */}
          <AIChat
            isOpen={isAIChatOpen}
            onClose={() => setIsAIChatOpen(false)}
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
              const { error } = await (await import("@/integrations/supabase/client")).supabase
                .from("projects")
                .update({ is_public: true })
                .eq("id", currentProject.id);
              if (!error) {
                setCurrentProject({ ...currentProject, is_public: true });
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
              const { error } = await (await import("@/integrations/supabase/client")).supabase
                .from("projects")
                .update({ is_public: false })
                .eq("id", currentProject.id);
              if (!error) {
                setCurrentProject({ ...currentProject, is_public: false });
                toast({ title: "Project is now private", description: "Only you can access this project" });
              }
            }}
            onGetProjectLink={() => {
              const link = currentProject
                ? `${window.location.origin}/project/${currentProject.id}`
                : window.location.href;
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
          />
        </div>
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
