import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/ide/Sidebar";
import type { FileNode, GitState } from "@/types/ide";

vi.mock("@/components/ide/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree" />,
}));
vi.mock("@/components/ide/NewFileDialog", () => ({
  NewFileDialog: () => null,
}));
vi.mock("@/components/ide/GitPanel", () => ({
  GitPanel: () => <div data-testid="git-panel" />,
}));
vi.mock("@/components/ide/PackagePanel", () => ({
  PackagePanel: () => <div data-testid="package-panel" />,
}));
vi.mock("@/components/ide/WorkflowsPanel", () => ({
  WorkflowsPanel: () => <div data-testid="workflows-panel" />,
}));
vi.mock("@/components/ide/HistoryPanel", () => ({
  HistoryPanel: () => <div data-testid="history-panel" />,
}));
vi.mock("@/components/ide/FileIcon", () => ({
  FileIcon: () => <span data-testid="file-icon" />,
}));
vi.mock("@/components/ide/SettingsDialog", () => ({
  SettingsDialog: () => null,
}));
vi.mock("@/components/ide/ExtensionsPanel", () => ({
  ExtensionsPanel: () => <div data-testid="extensions-panel" />,
}));
vi.mock("@/components/ide/VulnerabilityScannerPanel", () => ({
  VulnerabilityScannerPanel: () => <div data-testid="vulnerability-panel" />,
}));

const noop = () => {};

const gitState: GitState = {
  branches: [],
  currentBranch: "main",
  changes: [],
  isInitialized: false,
  remote: null,
  isPulling: false,
  isPushing: false,
};

const files: FileNode[] = [
  {
    id: "file-1",
    name: "app.ts",
    type: "file",
    content: "persisted content only",
  },
];

describe("Sidebar search", () => {
  it("searches unsaved in-memory file content", () => {
    render(
      <Sidebar
        files={files}
        fileContents={{ "file-1": "line one\nFresh Unsaved Match Value" }}
        onFileSelect={noop}
        onCreateFile={noop}
        onDeleteFile={noop}
        onRenameFile={noop}
        onUploadFiles={noop}
        activeFileId={null}
        currentLanguage="typescript"
        gitState={gitState}
        onGitCommit={noop}
        onGitStageFile={noop}
        onGitUnstageFile={noop}
        onGitDiscardChanges={noop}
        onGitCreateBranch={noop}
        onGitSwitchBranch={noop}
        onGitInitRepo={noop}
        onUpdateFileContent={noop}
        workflows={[]}
        onRunWorkflow={noop}
        onCreateWorkflow={noop}
        onUpdateWorkflow={noop}
        onDeleteWorkflow={noop}
        currentlyRunningWorkflow={null}
        historyEntries={[]}
        onInvite={noop}
      />,
    );

    fireEvent.click(screen.getByTitle("Search"));
    fireEvent.change(screen.getByPlaceholderText("Search in files..."), {
      target: { value: "unsaved match value" },
    });

    expect(screen.queryByText(/No results found for/i)).not.toBeInTheDocument();
    expect(screen.getByText("app.ts")).toBeInTheDocument();
    expect(screen.getByText("1 match")).toBeInTheDocument();
  });
});
