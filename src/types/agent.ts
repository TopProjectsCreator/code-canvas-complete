// Agent types for multi-step reasoning and tool usage

export type ToolName = 
  | 'analyze_code'
  | 'suggest_fix'
  | 'apply_code'
  | 'search_codebase'
  | 'run_code'
  | 'explain_error'
  | 'generate_tests'
  | 'refactor_code'
  | 'create_workflow'
  | 'run_workflow'
  | 'list_workflows'
  | 'install_package'
  | 'set_theme'
  | 'create_custom_theme'
  | 'generate_image'
  | 'git_commit'
  | 'git_init'
  | 'git_create_branch'
  | 'git_import'
  | 'make_public'
  | 'make_private'
  | 'get_project_link'
  | 'share_twitter'
  | 'share_linkedin'
  | 'share_email'
  | 'fork_project'
  | 'star_project'
  | 'view_history'
  | 'ask_user'
  | 'save_project'
  | 'run_project';

export interface ToolCall {
  id: string;
  name: ToolName;
  arguments: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
}

export interface CodeChange {
  fileName: string;
  language: string;
  originalCode?: string;
  newCode: string;
  description: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface AgentStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'code_change' | 'message';
  content: string;
  timestamp: Date;
  toolCall?: ToolCall;
  codeChange?: CodeChange;
  isCollapsed?: boolean;
}

export interface GeneratedImage {
  prompt: string;
  imageUrl: string;
  isLoading?: boolean;
  error?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  steps?: AgentStep[];
  isStreaming?: boolean;
  hasCodeChanges?: boolean;
  images?: GeneratedImage[];
}

export interface AgentContext {
  currentFile: {
    name: string;
    language: string;
    content: string;
  } | null;
  openFiles: Array<{
    name: string;
    language: string;
  }>;
  consoleErrors: string[];
  projectStructure?: string[];
}

export interface AgentAction {
  type: 'apply_code' | 'insert_code' | 'create_file' | 'run_command' | 'navigate_to_file' | 'create_workflow' | 'run_workflow';
  payload: Record<string, unknown>;
  label: string;
  icon?: string;
}

export interface WorkflowAction {
  name: string;
  type: 'run' | 'build' | 'test' | 'deploy' | 'custom';
  command: string;
  description?: string;
  trigger?: 'manual' | 'on-save' | 'on-commit';
}

// Tool definitions for the AI to use
export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'analyze_code',
      description: 'Analyze the current code for issues, patterns, and improvement opportunities',
      parameters: {
        type: 'object',
        properties: {
          focus: {
            type: 'string',
            enum: ['bugs', 'performance', 'security', 'style', 'all'],
            description: 'What aspect to focus the analysis on'
          }
        },
        required: ['focus']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_fix',
      description: 'Suggest a specific fix for an identified issue',
      parameters: {
        type: 'object',
        properties: {
          issue: { type: 'string', description: 'Description of the issue' },
          suggestion: { type: 'string', description: 'The suggested fix' },
          code: { type: 'string', description: 'The corrected code snippet' }
        },
        required: ['issue', 'suggestion', 'code']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'apply_code',
      description: 'Apply a code change to a file. Use this when you want to modify code.',
      parameters: {
        type: 'object',
        properties: {
          fileName: { type: 'string', description: 'Name of the file to modify' },
          newCode: { type: 'string', description: 'The new code to apply' },
          description: { type: 'string', description: 'Brief description of the change' },
          lineStart: { type: 'number', description: 'Starting line number (optional)' },
          lineEnd: { type: 'number', description: 'Ending line number (optional)' }
        },
        required: ['fileName', 'newCode', 'description']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'explain_error',
      description: 'Explain an error message and provide solutions',
      parameters: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'The error message' },
          context: { type: 'string', description: 'Additional context about when the error occurs' }
        },
        required: ['error']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_tests',
      description: 'Generate unit tests for the specified code',
      parameters: {
        type: 'object',
        properties: {
          targetFunction: { type: 'string', description: 'Name of the function to test' },
          testFramework: { type: 'string', enum: ['jest', 'vitest'], description: 'Test framework to use' }
        },
        required: ['targetFunction', 'testFramework']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'refactor_code',
      description: 'Refactor code to improve quality, readability, or performance',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'The refactoring goal' },
          pattern: { type: 'string', description: 'Design pattern to apply (optional)' }
        },
        required: ['goal']
      }
    }
  }
];
