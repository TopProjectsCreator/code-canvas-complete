import { useState, useCallback, useRef, useMemo } from 'react';
import type { AutonomyConfig } from '@/hooks/useAutonomyMode';
import { supabase } from '@/integrations/supabase/client';
import { AgentMessage, AgentStep, CodeChange, ToolCall, WorkflowAction, GeneratedImage, GeneratedAudio, AIModel, InteractiveQuestion, QuestionOption, ChatWidget, ChatWidgetType } from '@/types/agent';
import { Workflow } from '@/types/ide';
import { CustomThemeColors } from '@/contexts/ThemeContext';
import { createAIProvider } from '@/integrations/ai/provider';
import { isPotentiallyDestructiveShellCommand } from '@/lib/agentSafety';

interface CustomThemeAction {
  name: string;
  colors: CustomThemeColors;
}

interface GitAction {
  type: 'git_commit' | 'git_init' | 'git_create_branch' | 'git_import';
  message?: string;
  branchName?: string;
  url?: string;
}

interface ShareAction {
  type: 'make_public' | 'make_private' | 'get_project_link' | 'share_twitter' | 'share_linkedin' | 'share_email' | 'fork_project' | 'star_project' | 'view_history' | 'ask_user' | 'save_project' | 'run_project';
  question?: string;
}

interface MusicAction {
  prompt: string;
  bpm?: number;
  duration?: number;
}

interface UseAgentChatProps {
  onCodeChange?: (change: CodeChange) => void;
  onApplyCode?: (code: string, fileName: string) => void;
  onCreateWorkflow?: (workflow: Omit<Workflow, 'id'>) => void;
  onRunWorkflow?: (workflow: Workflow) => void;
  onInstallPackage?: (packageName: string) => void;
  onSetTheme?: (theme: string) => void;
  onCreateCustomTheme?: (name: string, colors: CustomThemeColors) => void;
  onGitCommit?: (message: string) => void;
  onGitInit?: () => void;
  onGitCreateBranch?: (name: string) => void;
  onGitImport?: (url: string) => void;
  onMakePublic?: () => void;
  onMakePrivate?: () => void;
  onGetProjectLink?: () => void;
  onShareTwitter?: () => void;
  onShareLinkedin?: () => void;
  onShareEmail?: () => void;
  onForkProject?: () => void;
  onStarProject?: () => void;
  onViewHistory?: () => void;
  onAskUser?: (question: string) => void;
  onSaveProject?: () => void;
  onRunProject?: () => void;
  onRenameFile?: (oldName: string, newName: string) => void;
  onDeleteFile?: (name: string) => void;
  workflows?: Workflow[];
  autonomyConfig?: AutonomyConfig;
}

export const useAgentChat = ({ onCodeChange, onApplyCode, onCreateWorkflow, onRunWorkflow, onInstallPackage, onSetTheme, onCreateCustomTheme, onGitCommit, onGitInit, onGitCreateBranch, onGitImport, onMakePublic, onMakePrivate, onGetProjectLink, onShareTwitter, onShareLinkedin, onShareEmail, onForkProject, onStarProject, onViewHistory, onAskUser, onSaveProject, onRunProject, onRenameFile, onDeleteFile, workflows = [], autonomyConfig }: UseAgentChatProps = {}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "👋 Hi! I'm **Canvas Agent** - your AI coding partner.\n\nI can:\n- 🔍 **Analyze** your code and find issues\n- 🛠️ **Fix bugs** and apply changes directly\n- ⚡ **Refactor** for better performance\n- 🧪 **Generate tests** for your functions\n- 📝 **Explain** complex code\n- 🎨 **Generate images** from text descriptions\n- 🎵 **Generate music** with AI (Lyria)\n- 🌐 **Search the web** for information\n\nI'll show you my thinking process and let you approve changes before I apply them!",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel>('flash');
  const [byokProvider, setByokProvider] = useState<string | null>(null);
  const [byokModel, setByokModel] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const executedActionsRef = useRef<Set<string>>(new Set());
  const shellSessionIdRef = useRef<string | null>(null);
  const aiProvider = useMemo(() => createAIProvider(), []);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const parseToolCalls = (content: string): { toolCalls: ToolCall[], cleanContent: string } => {
    const toolCalls: ToolCall[] = [];
    let cleanContent = content;
    const toolRegex = /<tool:(\w+)>([\s\S]*?)<\/tool>/g;
    let match;
    while ((match = toolRegex.exec(content)) !== null) {
      try {
        const args = JSON.parse(match[2]);
        toolCalls.push({ id: generateId(), name: match[1] as ToolCall['name'], arguments: args, status: 'completed' });
        cleanContent = cleanContent.replace(match[0], '');
      } catch { /* skip */ }
    }
    return { toolCalls, cleanContent: cleanContent.trim() };
  };

  const parseCodeChanges = (content: string): { codeChanges: CodeChange[], cleanContent: string } => {
    const codeChanges: CodeChange[] = [];
    let cleanContent = content;

    // Parse full code changes
    const codeRegex = /<code_change\s+file="([^"]+)"\s+(?:lang="([^"]+)"\s+)?desc="([^"]+)">([\s\S]*?)<\/code_change>/g;
    let match;
    while ((match = codeRegex.exec(content)) !== null) {
      codeChanges.push({ fileName: match[1], language: match[2] || 'typescript', description: match[3], newCode: match[4].trim() });
      cleanContent = cleanContent.replace(match[0], '');
    }

    // Parse diff-based changes
    const diffRegex = /<code_diff\s+file="([^"]+)"\s+(?:lang="([^"]+)"\s+)?desc="([^"]+)">([\s\S]*?)<\/code_diff>/g;
    while ((match = diffRegex.exec(content)) !== null) {
      codeChanges.push({ fileName: match[1], language: match[2] || 'typescript', description: match[3], newCode: '', isDiff: true, diffContent: match[4].trim() });
      cleanContent = cleanContent.replace(match[0], '');
    }

    return { codeChanges, cleanContent: cleanContent.trim() };
  };

  const parseWorkflowCommands = (content: string): { workflowActions: WorkflowAction[], cleanContent: string } => {
    const workflowActions: WorkflowAction[] = [];
    let cleanContent = content;
    const workflowRegex = /<workflow\s+name="([^"]+)"\s+type="([^"]+)"\s+command="([^"]+)"(?:\s+trigger="([^"]+)")?>([\s\S]*?)<\/workflow>/g;
    let match;
    while ((match = workflowRegex.exec(content)) !== null) {
      workflowActions.push({ name: match[1], type: match[2] as any, command: match[3], trigger: (match[4] as any) || 'manual', description: match[5].trim() });
      cleanContent = cleanContent.replace(match[0], '');
    }
    return { workflowActions, cleanContent: cleanContent.trim() };
  };

  const parsePackageInstalls = (content: string): { packages: string[], cleanContent: string } => {
    const packages: string[] = [];
    let cleanContent = content;
    const pkgRegex = /<install_package\s+name="([^"]+)"\s*\/>/g;
    let match;
    while ((match = pkgRegex.exec(content)) !== null) {
      packages.push(match[1]);
      cleanContent = cleanContent.replace(match[0], '');
    }
    return { packages, cleanContent: cleanContent.trim() };
  };

  const parseThemeChanges = (content: string): { theme: string | null, cleanContent: string } => {
    let cleanContent = content;
    let theme: string | null = null;
    const themeRegex = /<set_theme\s+theme="([^"]+)"\s*\/>/g;
    const match = themeRegex.exec(content);
    if (match) { theme = match[1]; cleanContent = cleanContent.replace(match[0], ''); }
    return { theme, cleanContent: cleanContent.trim() };
  };

  const parseCustomThemeCreation = (content: string): { customTheme: CustomThemeAction | null, cleanContent: string } => {
    let cleanContent = content;
    let customTheme: CustomThemeAction | null = null;
    const themeRegex = /<create_custom_theme\s+name="([^"]+)"\s+background="([^"]+)"\s+foreground="([^"]+)"\s+primary="([^"]+)"\s+card="([^"]+)"\s+border="([^"]+)"\s+terminalBg="([^"]+)"\s+terminalText="([^"]+)"\s+syntaxKeyword="([^"]+)"\s+syntaxString="([^"]+)"\s+syntaxFunction="([^"]+)"\s+syntaxComment="([^"]+)"\s*\/>/g;
    const match = themeRegex.exec(content);
    if (match) {
      customTheme = { name: match[1], colors: { background: match[2], foreground: match[3], primary: match[4], card: match[5], border: match[6], terminalBg: match[7], terminalText: match[8], syntaxKeyword: match[9], syntaxString: match[10], syntaxFunction: match[11], syntaxComment: match[12] } };
      cleanContent = cleanContent.replace(match[0], '');
    }
    return { customTheme, cleanContent: cleanContent.trim() };
  };

  const parseImageGenerations = (content: string): { imagePrompts: string[], cleanContent: string } => {
    const imagePrompts: string[] = [];
    let cleanContent = content;
    const imgRegex = /<generate_image\s+prompt="([^"]+)"\s*\/>/g;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      imagePrompts.push(match[1]);
      cleanContent = cleanContent.replace(match[0], '');
    }
    return { imagePrompts, cleanContent: cleanContent.trim() };
  };

  const parseMusicGenerations = (content: string): { musicActions: MusicAction[], cleanContent: string } => {
    const musicActions: MusicAction[] = [];
    let cleanContent = content;
    // Parse <generate_music prompt="..." /> or <generate_music prompt="..." bpm="120" duration="15" />
    const musicRegex = /<generate_music\s+prompt="([^"]+)"(?:\s+bpm="(\d+)")?(?:\s+duration="(\d+)")?\s*\/>/g;
    let match;
    while ((match = musicRegex.exec(content)) !== null) {
      musicActions.push({
        prompt: match[1],
        bpm: match[2] ? parseInt(match[2]) : undefined,
        duration: match[3] ? parseInt(match[3]) : undefined,
      });
      cleanContent = cleanContent.replace(match[0], '');
    }
    return { musicActions, cleanContent: cleanContent.trim() };
  };

  const parseGitCommands = (content: string): { gitActions: GitAction[], cleanContent: string } => {
    const gitActions: GitAction[] = [];
    let cleanContent = content;
    const initRegex = /<git_init\s*\/>/g;
    let match;
    while ((match = initRegex.exec(content)) !== null) { gitActions.push({ type: 'git_init' }); cleanContent = cleanContent.replace(match[0], ''); }
    const commitRegex = /<git_commit\s+message="([^"]+)"\s*\/>/g;
    while ((match = commitRegex.exec(content)) !== null) { gitActions.push({ type: 'git_commit', message: match[1] }); cleanContent = cleanContent.replace(match[0], ''); }
    const branchRegex = /<git_create_branch\s+name="([^"]+)"\s*\/>/g;
    while ((match = branchRegex.exec(content)) !== null) { gitActions.push({ type: 'git_create_branch', branchName: match[1] }); cleanContent = cleanContent.replace(match[0], ''); }
    const importRegex = /<git_import\s+url="([^"]+)"\s*\/>/g;
    while ((match = importRegex.exec(content)) !== null) { gitActions.push({ type: 'git_import', url: match[1] }); cleanContent = cleanContent.replace(match[0], ''); }
    return { gitActions, cleanContent: cleanContent.trim() };
  };

  const parseShareActions = (content: string): { shareActions: ShareAction[], cleanContent: string } => {
    const shareActions: ShareAction[] = [];
    let cleanContent = content;
    const simpleTags: ShareAction['type'][] = ['make_public', 'make_private', 'get_project_link', 'share_twitter', 'share_linkedin', 'share_email', 'fork_project', 'star_project', 'view_history', 'save_project', 'run_project'];
    for (const tag of simpleTags) {
      const regex = new RegExp(`<${tag}\\s*\\/>`, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) { shareActions.push({ type: tag }); cleanContent = cleanContent.replace(match[0], ''); }
    }
    return { shareActions, cleanContent: cleanContent.trim() };
  };

  const parseInteractiveQuestions = (content: string): { questions: InteractiveQuestion[], cleanContent: string } => {
    const questions: InteractiveQuestion[] = [];
    let cleanContent = content;
    const promptRegex = /<ask_prompt\s+([^>]+)\/>/g;
    const validTypes: InteractiveQuestion['type'][] = ['text', 'multiple_choice', 'ranking', 'slider', 'yes_no', 'number', 'date', 'time', 'datetime', 'email'];
    let match;
    while ((match = promptRegex.exec(content)) !== null) {
      const attrs = match[1];
      const getAttr = (name: string) => {
        const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(attrs);
        return m ? m[1] : undefined;
      };
      const rawType = (getAttr('type') || 'text').toLowerCase();
      const typeAliases: Record<string, InteractiveQuestion['type']> = {
        boolean: 'yes_no',
        bool: 'yes_no',
        integer: 'number',
        numeric: 'number',
        scale: 'slider',
        single_choice: 'multiple_choice',
        single: 'multiple_choice',
        'datetime-local': 'datetime',
        datetime_local: 'datetime',
      };
      const normalizedType = typeAliases[rawType] || rawType;
      const type = validTypes.includes(normalizedType as InteractiveQuestion['type'])
        ? (normalizedType as InteractiveQuestion['type'])
        : 'text';
      const question = getAttr('question') || 'Please answer:';
      const optionsStr = getAttr('options');
      const options: QuestionOption[] | undefined = optionsStr
        ? optionsStr
            .split(',')
            .map(o => o.trim())
            .filter(Boolean)
            .map((label, i) => ({ id: `opt_${i}`, label }))
        : undefined;
      const multi = getAttr('multi') === 'true';
      const parseNumericAttr = (name: 'min' | 'max' | 'step') => {
        const value = getAttr(name);
        if (value === undefined) return undefined;
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      };
      const min = parseNumericAttr('min');
      const max = parseNumericAttr('max');
      const step = parseNumericAttr('step');
      const minLabel = getAttr('minLabel');
      const maxLabel = getAttr('maxLabel');
      const placeholder = getAttr('placeholder');

      questions.push({
        id: generateId(),
        type,
        question,
        options,
        multiSelect: type === 'multiple_choice' ? multi : false,
        min,
        max,
        step,
        minLabel,
        maxLabel,
        placeholder,
      });
      cleanContent = cleanContent.replace(match[0], '');
    }
    return { questions, cleanContent: cleanContent.trim() };
  };

  const parseChatWidgets = (content: string): { widgets: ChatWidget[], cleanContent: string } => {
    const widgets: ChatWidget[] = [];
    let cleanContent = content;
    const widgetTypes: ChatWidgetType[] = ['color_picker', 'coin_flip', 'dice_roll', 'calculator', 'spinner', 'stock', 'change_template', 'pomodoro', 'logic_visualizer', 'asset_search', 'viewport_preview', 'a11y_audit', 'todo_tracker', 'dependency_visualizer', 'readme_generator', 'project_stats', 'code_review', 'docs_link', 'countdown', 'password_generator', 'unit_converter', 'progress_tracker', 'json_viewer', 'regex_tester'];
    for (const wType of widgetTypes) {
      const regex = new RegExp(`<${wType}(\\s+[^>]*)?\\/?>`, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const config: Record<string, unknown> = {};
        if (match[1]) {
          const attrRegex = /(\w+)="([^"]*)"/g;
          let attrMatch;
          while ((attrMatch = attrRegex.exec(match[1])) !== null) {
            config[attrMatch[1]] = attrMatch[2];
          }
        }
        widgets.push({ id: generateId(), type: wType, config });
        cleanContent = cleanContent.replace(match[0], '');
      }
    }

    const aliases: Record<string, ChatWidgetType> = {
      start_review: 'code_review',
      show_project_stats: 'project_stats',
      visualize_logic: 'logic_visualizer',
      search_assets: 'asset_search',
      preview_viewport: 'viewport_preview',
      run_a11y_check: 'a11y_audit',
      add_todo: 'todo_tracker',
      generate_readme: 'readme_generator',
    };

    for (const [tag, type] of Object.entries(aliases)) {
      const regex = new RegExp(`<${tag}(\\s+[^>]*)?\\s*\\/>`, 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const config: Record<string, unknown> = {};
        if (match[1]) {
          const attrRegex = /(\w+)="([^"]*)"/g;
          let attrMatch;
          while ((attrMatch = attrRegex.exec(match[1])) !== null) {
            config[attrMatch[1]] = attrMatch[2];
          }
        }
        widgets.push({ id: generateId(), type, config });
        cleanContent = cleanContent.replace(match[0], '');
      }
    }

    return { widgets, cleanContent: cleanContent.trim() };
  };

  const parseFileManagementActions = (content: string): { actions: Array<{ type: 'rename' | 'delete'; oldName?: string; newName?: string; name?: string }>; cleanContent: string } => {
    const actions: Array<{ type: 'rename' | 'delete'; oldName?: string; newName?: string; name?: string }> = [];
    let cleanContent = content;

    const renameRegex = /<rename_file\s+old="([^"]+)"\s+new="([^"]+)"\s*\/>/g;
    let match;
    while ((match = renameRegex.exec(content)) !== null) {
      actions.push({ type: 'rename', oldName: match[1], newName: match[2] });
      cleanContent = cleanContent.replace(match[0], '');
    }

    const deleteRegex = /<delete_file\s+name="([^"]+)"\s*\/>/g;
    while ((match = deleteRegex.exec(content)) !== null) {
      actions.push({ type: 'delete', name: match[1] });
      cleanContent = cleanContent.replace(match[0], '');
    }

    return { actions, cleanContent: cleanContent.trim() };
  };

  const parseShellCommands = (content: string): { shellCommands: string[], cleanContent: string } => {
    const shellCommands: string[] = [];
    let cleanContent = content;
    const shellRegex = /<run_shell\s+command="([^"]+)"\s*\/>/g;
    let match;
    while ((match = shellRegex.exec(content)) !== null) {
      shellCommands.push(match[1]);
      cleanContent = cleanContent.replace(match[0], '');
    }
    return { shellCommands, cleanContent: cleanContent.trim() };
  };

  const parseAgentDone = (content: string): { isDone: boolean, cleanContent: string } => {
    const cleanContent = content.replace(/<agent_done\s*\/>/g, '');
    return { isDone: content.includes('<agent_done'), cleanContent: cleanContent.trim() };
  };



  const parseGenerateTestsTags = (content: string): { codeChanges: CodeChange[]; cleanContent: string } => {
    const codeChanges: CodeChange[] = [];
    let cleanContent = content;
    const regex = /<generate_tests\s+file="([^"]+)"\s*\/>/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const sourceFile = match[1];
      const testFile = sourceFile.replace(/\.(\w+)$/, '_test.$1');
      codeChanges.push({
        fileName: testFile,
        language: testFile.endsWith('.ts') ? 'typescript' : 'javascript',
        description: `Generated starter tests for ${sourceFile}`,
        newCode: `import { describe, it, expect } from 'vitest';\n\ndescribe('${sourceFile}', () => {\n  it('should implement behavior', () => {\n    expect(true).toBe(true);\n  });\n});`,
      });
      cleanContent = cleanContent.replace(match[0], '');
    }
    return { codeChanges, cleanContent: cleanContent.trim() };
  };

  const parseThinkingBlocks = (content: string): { steps: AgentStep[], cleanContent: string } => {
    const steps: AgentStep[] = [];
    let cleanContent = content;
    const thinkingRegex = /<(?:thinking_process|thinking)>([\s\S]*?)<\/(?:thinking_process|thinking)>/g;
    let match;
    while ((match = thinkingRegex.exec(content)) !== null) {
      steps.push({ id: generateId(), type: 'thinking', content: match[1].trim(), timestamp: new Date(), isCollapsed: true });
      cleanContent = cleanContent.replace(match[0], '');
    }
    return { steps, cleanContent: cleanContent.trim() };
  };

  const processAgentResponse = (rawContent: string): { 
    content: string; 
    steps: AgentStep[];
    hasCodeChanges: boolean;
    hasWorkflowChanges: boolean;
    imagePrompts: string[];
    musicActions: MusicAction[];
    questions: InteractiveQuestion[];
    widgets: ChatWidget[];
    shellCommands: string[];
    isDone: boolean;
  } => {
    let content = rawContent;
    const allSteps: AgentStep[] = [];
    
    const { steps: thinkingSteps, cleanContent: afterThinking } = parseThinkingBlocks(content);
    allSteps.push(...thinkingSteps);
    content = afterThinking;
    
    const { toolCalls, cleanContent: afterTools } = parseToolCalls(content);
    toolCalls.forEach(tc => {
      allSteps.push({ id: tc.id, type: 'tool_call', content: `Running ${tc.name}...`, timestamp: new Date(), toolCall: tc });
    });
    content = afterTools;
    
    const { codeChanges: inlineCodeChanges, cleanContent: afterCode } = parseCodeChanges(content);
    const { codeChanges: generatedTests, cleanContent: afterGeneratedTests } = parseGenerateTestsTags(afterCode);
    const codeChanges = [...inlineCodeChanges, ...generatedTests];
    codeChanges.forEach(cc => {
      allSteps.push({ id: generateId(), type: 'code_change', content: cc.description, timestamp: new Date(), codeChange: cc });
      const ccKey = `code:${cc.fileName}:${cc.description}`;
      if (onCodeChange && !executedActionsRef.current.has(ccKey)) { executedActionsRef.current.add(ccKey); onCodeChange(cc); }
    });
    content = afterGeneratedTests;
    
    const { workflowActions, cleanContent: afterWorkflows } = parseWorkflowCommands(content);
    workflowActions.forEach(wa => {
      allSteps.push({ id: generateId(), type: 'tool_call', content: `Creating workflow: ${wa.name}`, timestamp: new Date(), toolCall: { id: generateId(), name: 'create_workflow', arguments: { ...wa } as Record<string, unknown>, status: 'completed' } });
      const wfKey = `workflow:${wa.name}:${wa.command}`;
      if (onCreateWorkflow && !executedActionsRef.current.has(wfKey)) { executedActionsRef.current.add(wfKey); onCreateWorkflow({ name: wa.name, type: wa.type, command: wa.command, description: wa.description, trigger: wa.trigger }); }
    });
    content = afterWorkflows;
    
    const { packages, cleanContent: afterPackages } = parsePackageInstalls(content);
    packages.forEach(pkg => {
      allSteps.push({ id: generateId(), type: 'tool_call', content: `Installing package: ${pkg}`, timestamp: new Date(), toolCall: { id: generateId(), name: 'install_package', arguments: { name: pkg }, status: 'completed' } });
      const pkgKey = `pkg:${pkg}`;
      if (onInstallPackage && !executedActionsRef.current.has(pkgKey)) { executedActionsRef.current.add(pkgKey); onInstallPackage(pkg); }
    });
    content = afterPackages;

    const { theme, cleanContent: afterTheme } = parseThemeChanges(content);
    if (theme) { allSteps.push({ id: generateId(), type: 'tool_call', content: `Changing theme to: ${theme}`, timestamp: new Date(), toolCall: { id: generateId(), name: 'set_theme', arguments: { theme }, status: 'pending' } }); }
    content = afterTheme;

    const { customTheme, cleanContent: afterCustomTheme } = parseCustomThemeCreation(content);
    if (customTheme) { allSteps.push({ id: generateId(), type: 'tool_call', content: `Creating custom theme: ${customTheme.name}`, timestamp: new Date(), toolCall: { id: generateId(), name: 'create_custom_theme', arguments: { name: customTheme.name, colors: customTheme.colors as unknown as Record<string, unknown> }, status: 'pending' } }); }
    content = afterCustomTheme;

    const { imagePrompts, cleanContent: afterImages } = parseImageGenerations(content);
    imagePrompts.forEach(prompt => {
      allSteps.push({ id: generateId(), type: 'tool_call', content: `Generating image: ${prompt}`, timestamp: new Date(), toolCall: { id: generateId(), name: 'generate_image', arguments: { prompt }, status: 'pending' } });
    });
    content = afterImages;

    // Parse music generation requests
    const { musicActions, cleanContent: afterMusic } = parseMusicGenerations(content);
    musicActions.forEach(action => {
      allSteps.push({ id: generateId(), type: 'tool_call', content: `Generating music: ${action.prompt}`, timestamp: new Date(), toolCall: { id: generateId(), name: 'generate_music', arguments: { prompt: action.prompt, bpm: action.bpm, duration: action.duration }, status: 'pending' } });
    });
    content = afterMusic;

    const { gitActions, cleanContent: afterGit } = parseGitCommands(content);
    gitActions.forEach(action => {
      const labelMap: Record<string, string> = { git_init: 'Initialize Git repository', git_commit: `Commit: "${action.message}"`, git_create_branch: `Create branch: ${action.branchName}`, git_import: `Import repo: ${action.url}` };
      allSteps.push({ id: generateId(), type: 'tool_call', content: labelMap[action.type] || action.type, timestamp: new Date(), toolCall: { id: generateId(), name: action.type as ToolCall['name'], arguments: { message: action.message, branchName: action.branchName, url: action.url } as Record<string, unknown>, status: 'pending' } });
    });
    content = afterGit;

    const { shareActions, cleanContent: afterShare } = parseShareActions(content);
    shareActions.forEach(action => {
      const labelMap: Record<string, string> = { make_public: 'Make project public', make_private: 'Make project private', get_project_link: 'Get project link', share_twitter: 'Share on Twitter', share_linkedin: 'Share on LinkedIn', share_email: 'Share via Email', fork_project: 'Fork project', star_project: 'Star project', view_history: 'View history', ask_user: action.question ? `Question: "${action.question}"` : 'Ask user a question', save_project: 'Save project', run_project: 'Run project' };
      allSteps.push({ id: generateId(), type: 'tool_call', content: labelMap[action.type] || action.type, timestamp: new Date(), toolCall: { id: generateId(), name: action.type as ToolCall['name'], arguments: action.question ? { question: action.question } : {}, status: 'pending' } });
    });
    content = afterShare;

    const { questions: parsedQuestions, cleanContent: afterQuestions } = parseInteractiveQuestions(content);
    content = afterQuestions;

    const { widgets: parsedWidgets, cleanContent: afterWidgets } = parseChatWidgets(content);
    content = afterWidgets;

    const { actions: fileActions, cleanContent: afterFileActions } = parseFileManagementActions(content);
    fileActions.forEach((action) => {
      if (action.type === 'rename' && action.oldName && action.newName) {
        onRenameFile?.(action.oldName, action.newName);
        allSteps.push({ id: generateId(), type: 'tool_call', content: `Renamed file: ${action.oldName} → ${action.newName}`, timestamp: new Date(), toolCall: { id: generateId(), name: 'apply_code', arguments: { oldName: action.oldName, newName: action.newName }, status: 'completed' } });
      }
      if (action.type === 'delete' && action.name) {
        onDeleteFile?.(action.name);
        allSteps.push({ id: generateId(), type: 'tool_call', content: `Deleted file: ${action.name}`, timestamp: new Date(), toolCall: { id: generateId(), name: 'apply_code', arguments: { name: action.name }, status: 'completed' } });
      }
    });
    content = afterFileActions;

    const { shellCommands, cleanContent: afterShell } = parseShellCommands(content);
    shellCommands.forEach(cmd => {
      allSteps.push({ id: generateId(), type: 'tool_call', content: `Running shell: ${cmd}`, timestamp: new Date(), toolCall: { id: generateId(), name: 'run_shell', arguments: { command: cmd }, status: 'pending' } });
    });
    content = afterShell;

    const { isDone, cleanContent: afterDone } = parseAgentDone(content);
    content = afterDone;

    return {
      content,
      steps: allSteps,
      hasCodeChanges: codeChanges.length > 0,
      hasWorkflowChanges: workflowActions.length > 0,
      imagePrompts,
      musicActions,
      questions: parsedQuestions,
      widgets: parsedWidgets,
      shellCommands,
      isDone,
    };
  };

  const sendMessage = useCallback(async (
    messageContent: string,
    context: {
      currentFile?: { name: string; language?: string; content?: string } | null;
      consoleErrors?: string;
      agentMode?: boolean;
      workflows?: Array<{ name: string; type: string; command: string }>;
      multimodalContent?: any; // OpenAI-compatible content parts (array) or string
      template?: string;
    } = {}
  ) => {
    if (!messageContent.trim() || isLoading) return;
    executedActionsRef.current.clear();

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: '🔒 **Authentication Required**\n\nPlease sign in to use the AI assistant.' }]);
      return;
    }

    const userMessage: AgentMessage = { id: generateId(), role: 'user', content: messageContent };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setCurrentStep('Thinking...');

    let assistantId = generateId();
    let fullContent = '';

    try {
      abortControllerRef.current = new AbortController();
      
      // Build messages array, using multimodal content for the latest user message if provided
      const historyMessages = messages.slice(1).map(m => ({ role: m.role, content: m.content }));
      const latestUserMsg = {
        role: 'user' as const,
        content: context.multimodalContent || messageContent,
      };

      const response = await aiProvider.chat({
        messages: [...historyMessages, latestUserMsg],
        currentFile: context.currentFile ? { name: context.currentFile.name, language: context.currentFile.language, content: context.currentFile.content?.slice(0, 10000) } : null,
        consoleErrors: context.consoleErrors || null,
        workflows: context.workflows || workflows?.map(w => ({ name: w.name, type: w.type, command: w.command })) || null,
        agentMode: true,
        model: selectedModel,
        byokProvider: aiProvider.allowsBYOK ? (byokProvider || undefined) : undefined,
        byokModel: aiProvider.allowsBYOK ? (byokModel || undefined) : undefined,
        template: context.template,
      }, {
        accessToken: session.access_token,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }

      if (!response.body) throw new Error('No response body');

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', isStreaming: true }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              if ((fullContent.includes('<thinking_process>') && !fullContent.includes('</thinking_process>')) || (fullContent.includes('<thinking>') && !fullContent.includes('</thinking>'))) { setCurrentStep('Analyzing...'); }
              else if (fullContent.includes('<code_change')) { setCurrentStep('Preparing changes...'); }
              else if (fullContent.includes('<generate_music')) { setCurrentStep('Preparing music...'); }
              else { setCurrentStep(null); }
              
              const processed = processAgentResponse(fullContent);
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, ...processed, isStreaming: true } : m));
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Final processing
      const processed = processAgentResponse(fullContent);
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: processed.content, steps: processed.steps, hasCodeChanges: processed.hasCodeChanges, questions: processed.questions, widgets: processed.widgets, isStreaming: false } : m));

      // Handle image generation requests
      if (processed.imagePrompts && processed.imagePrompts.length > 0) {
        const { data: { session: imgSession } } = await supabase.auth.getSession();
        if (imgSession?.access_token) {
          for (const prompt of processed.imagePrompts) {
            const imgKey = `img:${prompt}`;
            if (executedActionsRef.current.has(imgKey)) continue;
            executedActionsRef.current.add(imgKey);

            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, images: [...(m.images || []), { prompt, imageUrl: '', isLoading: true }] } : m));

            try {
              const imgResponse = await aiProvider.generateImage(prompt, { accessToken: imgSession.access_token });
              const imgData = await imgResponse.json();
              setMessages(prev => prev.map(m => { if (m.id !== assistantId) return m; const images = (m.images || []).map(img => img.prompt === prompt ? { ...img, imageUrl: imgData.imageUrl || '', isLoading: false, error: imgData.error } : img); return { ...m, images }; }));
            } catch {
              setMessages(prev => prev.map(m => { if (m.id !== assistantId) return m; const images = (m.images || []).map(img => img.prompt === prompt ? { ...img, isLoading: false, error: 'Failed to generate image' } : img); return { ...m, images }; }));
            }
          }
        }
      }

      // Handle music generation requests
      if (processed.musicActions && processed.musicActions.length > 0) {
        const { data: { session: musicSession } } = await supabase.auth.getSession();
        if (musicSession?.access_token) {
          for (const action of processed.musicActions) {
            const musicKey = `music:${action.prompt}`;
            if (executedActionsRef.current.has(musicKey)) continue;
            executedActionsRef.current.add(musicKey);

            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, audios: [...(m.audios || []), { prompt: action.prompt, audioUrl: '', isLoading: true }] } : m));

            try {
              const musicResponse = await aiProvider.generateMusic({ prompt: action.prompt, bpm: action.bpm, duration: action.duration }, { accessToken: musicSession.access_token });
              const musicData = await musicResponse.json();
              setMessages(prev => prev.map(m => { if (m.id !== assistantId) return m; const audios = (m.audios || []).map(a => a.prompt === action.prompt ? { ...a, audioUrl: musicData.audioUrl || '', isLoading: false, error: musicData.error, duration: musicData.duration } : a); return { ...m, audios }; }));
            } catch {
              setMessages(prev => prev.map(m => { if (m.id !== assistantId) return m; const audios = (m.audios || []).map(a => a.prompt === action.prompt ? { ...a, isLoading: false, error: 'Failed to generate music' } : a); return { ...m, audios }; }));
            }
          }
        }
      }

      // ── Agentic loop: keep executing tools and calling AI until done ──
      const MAX_AGENT_ITERATIONS = 8;
      let loopProcessed = processed;
      let loopContent = fullContent;
      const conversationSoFar: Array<{ role: string; content: string }> = [
        ...historyMessages,
        latestUserMsg,
      ];

      for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration++) {
        // If the AI signaled it's done, or there are no actionable tool calls, stop
        const hasShell = loopProcessed.shellCommands && loopProcessed.shellCommands.length > 0 && (autonomyConfig?.shell !== false);
        if (loopProcessed.isDone && !hasShell) break;
        if (!hasShell) break; // No shell commands to execute = nothing to loop on

        // Execute shell commands
        const shellExecutionSummaries: Array<{ command: string; output: string; success: boolean }> = [];
        for (const cmd of loopProcessed.shellCommands) {
          const shellKey = `shell:${cmd}:${iteration}`;
          if (executedActionsRef.current.has(shellKey)) continue;
          executedActionsRef.current.add(shellKey);

          if (autonomyConfig?.blockDestructiveShell && isPotentiallyDestructiveShellCommand(cmd)) {
            const blockedReason = `Blocked potentially destructive shell command: ${cmd}`;
            shellExecutionSummaries.push({ command: cmd, output: blockedReason, success: false });
            setMessages(prev => prev.map(m => {
              if (m.id !== assistantId) return m;
              const steps = m.steps?.map(s =>
                s.toolCall?.name === 'run_shell' && (s.toolCall.arguments as any).command === cmd
                  ? { ...s, content: blockedReason, toolCall: { ...s.toolCall!, status: 'failed' as const, result: blockedReason } }
                  : s
              );
              return { ...m, steps };
            }));
            continue;
          }

          setMessages(prev => prev.map(m => {
            if (m.id !== assistantId) return m;
            const steps = m.steps?.map(s => 
              s.toolCall?.name === 'run_shell' && (s.toolCall.arguments as any).command === cmd
                ? { ...s, toolCall: { ...s.toolCall!, status: 'running' as const } }
                : s
            );
            return { ...m, steps };
          }));

          try {
            const { data, error } = await supabase.functions.invoke('execute-code', {
              body: { code: cmd, language: 'shell', sessionId: shellSessionIdRef.current || undefined }
            });
            if (data?.sessionId) shellSessionIdRef.current = data.sessionId;

            const output = error ? `Error: ${error.message}` : 
              (data?.error ? `Error: ${data.error}` : (data?.output?.join('\n') || '(no output)'));
            const success = !error && !data?.error;
            shellExecutionSummaries.push({ command: cmd, output, success });

            setMessages(prev => prev.map(m => {
              if (m.id !== assistantId) return m;
              const steps = m.steps?.map(s => 
                s.toolCall?.name === 'run_shell' && (s.toolCall.arguments as any).command === cmd
                  ? { ...s, content: `Shell: ${cmd}\n\`\`\`\n${output}\n\`\`\``, toolCall: { ...s.toolCall!, status: 'completed' as const, result: output } }
                  : s
              );
              return { ...m, steps };
            }));
          } catch (err) {
            setMessages(prev => prev.map(m => {
              if (m.id !== assistantId) return m;
              const steps = m.steps?.map(s => 
                s.toolCall?.name === 'run_shell' && (s.toolCall.arguments as any).command === cmd
                  ? { ...s, toolCall: { ...s.toolCall!, status: 'failed' as const, result: String(err) } }
                  : s
              );
              return { ...m, steps };
            }));
            shellExecutionSummaries.push({ command: cmd, output: String(err), success: false });
          }
        }

        if (shellExecutionSummaries.length === 0) break;

        // Feed results back to the AI for the next iteration
        setCurrentStep(`Agent working... (step ${iteration + 2})`);
        const toolFeedback = shellExecutionSummaries
          .map(({ command, output, success }) => `Command: ${command}\nStatus: ${success ? 'success' : 'failed'}\nOutput:\n${output}`)
          .join('\n\n---\n\n');

        conversationSoFar.push(
          { role: 'assistant', content: loopContent },
          { role: 'user', content: `Tool results:\n\n${toolFeedback}\n\nContinue working. If done, emit <agent_done />.` },
        );

        const followUpResponse = await aiProvider.chat({
          messages: conversationSoFar,
          currentFile: context.currentFile ? { name: context.currentFile.name, language: context.currentFile.language, content: context.currentFile.content?.slice(0, 10000) } : null,
          consoleErrors: context.consoleErrors || null,
          workflows: context.workflows || workflows?.map(w => ({ name: w.name, type: w.type, command: w.command })) || null,
          agentMode: true,
          model: selectedModel,
          byokProvider: aiProvider.allowsBYOK ? (byokProvider || undefined) : undefined,
          byokModel: aiProvider.allowsBYOK ? (byokModel || undefined) : undefined,
        }, {
          accessToken: session.access_token,
          signal: abortControllerRef.current?.signal,
        });

        if (!followUpResponse.ok || !followUpResponse.body) break;

        const followReader = followUpResponse.body.getReader();
        const followDecoder = new TextDecoder();
        let followBuffer = '';
        let followContent = '';

        while (true) {
          const { done, value } = await followReader.read();
          if (done) break;
          followBuffer += followDecoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = followBuffer.indexOf('\n')) !== -1) {
            let line = followBuffer.slice(0, newlineIndex);
            followBuffer = followBuffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) followContent += content;
            } catch {
              followBuffer = line + '\n' + followBuffer;
              break;
            }
          }
        }

        loopContent = followContent;
        loopProcessed = processAgentResponse(followContent);

        if (loopProcessed.content || loopProcessed.steps.length > 0) {
          const followUpId = generateId();
          assistantId = followUpId;
          setMessages(prev => [...prev, {
            id: followUpId,
            role: 'assistant',
            content: loopProcessed.content,
            steps: loopProcessed.steps,
            hasCodeChanges: loopProcessed.hasCodeChanges,
            questions: loopProcessed.questions,
            widgets: loopProcessed.widgets,
          }]);
        }

        // If the AI says it's done, stop looping
        if (loopProcessed.isDone) break;
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Agent chat error:', error);
      setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]);
    } finally {
      setIsLoading(false);
      setCurrentStep(null);
      abortControllerRef.current = null;
    }
  }, [isLoading, messages, onCodeChange, selectedModel, byokProvider, byokModel, onApplyCode, onCreateWorkflow, onRunWorkflow, onInstallPackage, onSetTheme, onCreateCustomTheme, onGitCommit, onGitInit, onGitCreateBranch, onGitImport, onMakePublic, onMakePrivate, onGetProjectLink, onShareTwitter, onShareLinkedin, onShareEmail, onForkProject, onStarProject, onViewHistory, onAskUser, onSaveProject, onRunProject, onRenameFile, onDeleteFile, workflows, aiProvider]);

  const applyCodeChange = useCallback((change: CodeChange) => {
    if (onApplyCode) {
      if (change.isDiff && change.diffContent) {
        // For diff changes, we pass the diff content and let the consumer apply it
        onApplyCode(change.diffContent, change.fileName);
      } else {
        onApplyCode(change.newCode, change.fileName);
      }
    }
  }, [onApplyCode]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([{ id: '1', role: 'assistant', content: "👋 Conversation cleared! How can I help you?" }]);
  }, []);

  const answerQuestion = useCallback((messageId: string, questionId: string, answer: string | string[] | number | boolean) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const updatedQuestions = m.questions?.map(q =>
        q.id === questionId ? { ...q, answered: true, answer } : q
      );
      return { ...m, questions: updatedQuestions };
    }));
  }, []);

  return {
    messages,
    isLoading,
    currentStep,
    aiPlatform: aiProvider.platform,
    supportsManagedAI: aiProvider.supportsManagedAI,
    allowsBYOK: aiProvider.allowsBYOK,
    selectedModel,
    setSelectedModel,
    byokProvider,
    setByokProvider,
    byokModel,
    setByokModel,
    sendMessage,
    applyCodeChange,
    stopGeneration,
    clearMessages,
    answerQuestion,
  };
};
