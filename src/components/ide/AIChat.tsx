import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bot, Send, X, Sparkles, User, Loader2, FileCode, Bug, Lightbulb, TestTube,
  Zap, Code, Copy, Check, ChevronDown, ChevronRight, Play, FileEdit, Brain,
  Wrench, StopCircle, Trash2, CheckCircle2, XCircle, AlertCircle, Paintbrush,
  GitBranch, GitCommit as GitCommitIcon, Download, Globe, Lock, Link2, Twitter,
  Linkedin, Mail, Share2, GitFork, Star, History, MessageCircleQuestion, Save,
  PlayCircle, Music, Key, Settings, Diff, Paperclip, Image, FileVideo, FileAudio, FileText,
  GripVertical, ArrowUp, ArrowDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { FileNode, TerminalLine, Workflow } from '@/types/ide';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentChat } from '@/hooks/useAgentChat';
import { AgentMessage, AgentStep, CodeChange, WorkflowAction, GeneratedImage, GeneratedAudio, AIModel, InteractiveQuestion } from '@/types/agent';
import { useApiKeys, PROVIDER_MODELS, PROVIDER_INFO } from '@/hooks/useApiKeys';
import { SettingsDialog } from './SettingsDialog';
import { getDiffLines } from '@/lib/diffUtils';
import { useAttachments, ChatAttachment } from '@/hooks/useAttachments';
import { ChatWidgetRenderer } from './ChatWidgets';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  requiresFile: boolean;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  currentFile: FileNode | null;
  consoleOutput?: TerminalLine[];
  onInsertCode?: (code: string) => void;
  onApplyCode?: (code: string, fileName: string) => void;
  onRunTest?: (testCode: string) => void;
  workflows?: Workflow[];
  onCreateWorkflow?: (workflow: Omit<Workflow, 'id'>) => void;
  onRunWorkflow?: (workflow: Workflow) => void;
  onLoadingChange?: (loading: boolean) => void;
  onInstallPackage?: (packageName: string) => void;
  onSetTheme?: (theme: string) => void;
  onCreateCustomTheme?: (name: string, colors: import('@/contexts/ThemeContext').CustomThemeColors) => void;
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
  onChangeTemplate?: (template: string) => void;
  onRenameFile?: (oldName: string, newName: string) => void;
  onDeleteFile?: (name: string) => void;
}

const quickActions: QuickAction[] = [
  {
    id: 'analyze',
    label: 'Analyze',
    icon: <Brain className="w-3.5 h-3.5" />,
    prompt: 'Analyze this code comprehensively. Look for bugs, security issues, performance problems, and code quality issues. For each issue found, propose a specific fix with code.',
    requiresFile: true,
  },
  {
    id: 'fix',
    label: 'Fix Issues',
    icon: <Wrench className="w-3.5 h-3.5" />,
    prompt: 'Find and fix all issues in this code. Show me the corrected code that I can apply directly. Explain each fix briefly.',
    requiresFile: true,
  },
  {
    id: 'explain',
    label: 'Explain',
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    prompt: 'Explain this code step by step. Break down the logic, explain the purpose of each section, and highlight any important patterns or techniques used.',
    requiresFile: true,
  },
  {
    id: 'debug',
    label: 'Debug',
    icon: <Bug className="w-3.5 h-3.5" />,
    prompt: 'Debug this code. Analyze the logic flow, identify potential runtime errors, check for edge cases, and provide corrected code with explanations.',
    requiresFile: true,
  },
  {
    id: 'refactor',
    label: 'Refactor',
    icon: <Zap className="w-3.5 h-3.5" />,
    prompt: 'Refactor this code for better quality. Apply SOLID principles, improve naming, extract reusable functions, and enhance readability. Show me the refactored code.',
    requiresFile: true,
  },
  {
    id: 'test',
    label: 'Generate Tests',
    icon: <TestTube className="w-3.5 h-3.5" />,
    prompt: 'Generate comprehensive unit tests for this code using Vitest. Include happy path, edge cases, error scenarios, and boundary conditions. Provide ready-to-use test code.',
    requiresFile: true,
  },
  // General actions that don't require a file
  {
    id: 'generate',
    label: 'Generate Code',
    icon: <Code className="w-3.5 h-3.5" />,
    prompt: 'Help me generate code. What would you like me to create?',
    requiresFile: false,
  },
  {
    id: 'workflow',
    label: 'Create Workflow',
    icon: <Zap className="w-3.5 h-3.5" />,
    prompt: 'Help me create a new workflow. I can create run, build, test, deploy, or custom workflows. What would you like to automate?',
    requiresFile: false,
  },
  {
    id: 'ask',
    label: 'Ask Anything',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    prompt: 'I\'m ready to help! What programming question do you have?',
    requiresFile: false,
  },
];

// Thinking step component
const ThinkingStep = ({ step, isExpanded, onToggle }: { 
  step: AgentStep; 
  isExpanded: boolean; 
  onToggle: () => void;
}) => (
  <div className="border border-border/50 rounded-lg overflow-hidden bg-muted/30">
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
    >
      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      <Brain className="w-3 h-3 text-violet-400" />
      <span>Thinking process</span>
    </button>
    {isExpanded && (
      <div className="px-3 pb-3 text-xs text-muted-foreground italic border-t border-border/30">
        {step.content}
      </div>
    )}
  </div>
);

// Code change component with apply button
const CodeChangeBlock = ({ 
  change, 
  onApply, 
  isApplied 
}: { 
  change: CodeChange; 
  onApply: () => void;
  isApplied: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  
  const copyCode = async () => {
    const text = change.isDiff ? (change.diffContent || '') : change.newCode;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const diffLines = change.isDiff && change.diffContent ? getDiffLines(change.diffContent) : null;

  return (
    <div className="border border-primary/30 rounded-lg overflow-hidden bg-primary/5 my-2">
      <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-primary/20">
        <div className="flex items-center gap-2">
          {change.isDiff ? <Diff className="w-3.5 h-3.5 text-primary" /> : <FileEdit className="w-3.5 h-3.5 text-primary" />}
          <span className="text-xs font-medium text-foreground">{change.fileName}</span>
          {change.isDiff && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono">DIFF</span>}
          <span className="text-xs text-muted-foreground">• {change.description}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyCode}
            className="p-1.5 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onApply}
            disabled={isApplied}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all",
              isApplied 
                ? "bg-green-500/20 text-green-400 cursor-default"
                : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105"
            )}
          >
            {isApplied ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Applied
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                Apply
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="p-3 overflow-x-auto text-xs bg-background/30">
        {diffLines ? (
          <code>
            {diffLines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  'leading-relaxed',
                  line.type === 'added' && 'text-green-400 bg-green-500/10',
                  line.type === 'removed' && 'text-red-400 bg-red-500/10 line-through',
                  line.type === 'context' && 'text-muted-foreground'
                )}
              >
                <span className="select-none opacity-50 mr-2 inline-block w-4 text-right">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                {line.content}
              </div>
            ))}
          </code>
        ) : (
          <code className="text-foreground">{change.newCode}</code>
        )}
      </pre>
    </div>
  );
};

// Tool call indicator
const ToolCallIndicator = ({ toolCall, onApplyTheme, onApplyGit, onApplyShare, isApplied }: { 
  toolCall: AgentStep['toolCall'];
  onApplyTheme?: () => void;
  onApplyGit?: () => void;
  onApplyShare?: () => void;
  isApplied?: boolean;
}) => {
  if (!toolCall) return null;
  
  const isThemeAction = toolCall.name === 'set_theme' || toolCall.name === 'create_custom_theme';
  const isGitAction = toolCall.name === 'git_commit' || toolCall.name === 'git_init' || toolCall.name === 'git_create_branch' || toolCall.name === 'git_import';
  const isShareAction = ['make_public', 'make_private', 'get_project_link', 'share_twitter', 'share_linkedin', 'share_email', 'fork_project', 'star_project', 'view_history', 'ask_user', 'save_project', 'run_project'].includes(toolCall.name);
  const isPending = toolCall.status === 'pending';
  
  const statusIcon = (isThemeAction || isGitAction || isShareAction) && isPending
    ? isGitAction ? <GitBranch className="w-3 h-3 text-primary" /> 
    : isShareAction ? <Share2 className="w-3 h-3 text-primary" />
    : <Paintbrush className="w-3 h-3 text-primary" />
    : {
        pending: <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />,
        running: <Loader2 className="w-3 h-3 animate-spin text-primary" />,
        completed: <CheckCircle2 className="w-3 h-3 text-green-400" />,
        failed: <XCircle className="w-3 h-3 text-red-400" />,
      }[toolCall.status];

  const gitIcon = toolCall.name === 'git_commit' ? <GitCommitIcon className="w-3 h-3" />
    : toolCall.name === 'git_import' ? <Download className="w-3 h-3" />
    : <GitBranch className="w-3 h-3" />;

  const gitLabel = toolCall.name === 'git_commit' ? 'Commit'
    : toolCall.name === 'git_init' ? 'Init Repo'
    : toolCall.name === 'git_create_branch' ? 'Create Branch'
    : toolCall.name === 'git_import' ? 'Import Repo'
    : '';

  const shareIcon = toolCall.name === 'make_public' ? <Globe className="w-3 h-3" />
    : toolCall.name === 'make_private' ? <Lock className="w-3 h-3" />
    : toolCall.name === 'get_project_link' ? <Link2 className="w-3 h-3" />
    : toolCall.name === 'share_twitter' ? <Twitter className="w-3 h-3" />
    : toolCall.name === 'share_linkedin' ? <Linkedin className="w-3 h-3" />
    : toolCall.name === 'share_email' ? <Mail className="w-3 h-3" />
    : toolCall.name === 'fork_project' ? <GitFork className="w-3 h-3" />
    : toolCall.name === 'star_project' ? <Star className="w-3 h-3" />
    : toolCall.name === 'view_history' ? <History className="w-3 h-3" />
    : toolCall.name === 'ask_user' ? <MessageCircleQuestion className="w-3 h-3" />
    : toolCall.name === 'save_project' ? <Save className="w-3 h-3" />
    : toolCall.name === 'run_project' ? <PlayCircle className="w-3 h-3" />
    : <Share2 className="w-3 h-3" />;

  const shareLabel = toolCall.name === 'make_public' ? 'Make Public'
    : toolCall.name === 'make_private' ? 'Make Private'
    : toolCall.name === 'get_project_link' ? 'Copy Link'
    : toolCall.name === 'share_twitter' ? 'Share on Twitter'
    : toolCall.name === 'share_linkedin' ? 'Share on LinkedIn'
    : toolCall.name === 'share_email' ? 'Share via Email'
    : toolCall.name === 'fork_project' ? 'Fork'
    : toolCall.name === 'star_project' ? 'Star'
    : toolCall.name === 'view_history' ? 'View History'
    : toolCall.name === 'ask_user' ? 'Answer'
    : toolCall.name === 'save_project' ? 'Save'
    : toolCall.name === 'run_project' ? 'Run'
    : '';

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-xs">
      {statusIcon}
      <Wrench className="w-3 h-3 text-muted-foreground" />
      <span className="text-muted-foreground flex-1">
        {toolCall.name.replace(/_/g, ' ')}
      </span>
      {isThemeAction && isPending && !isApplied && onApplyTheme && (
        <button
          onClick={onApplyTheme}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-[11px] font-medium transition-colors"
        >
          <Paintbrush className="w-3 h-3" />
          Apply Theme
        </button>
      )}
      {isGitAction && isPending && !isApplied && onApplyGit && (
        <button
          onClick={onApplyGit}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-[11px] font-medium transition-colors"
        >
          {gitIcon}
          {gitLabel}
        </button>
      )}
      {isShareAction && isPending && !isApplied && onApplyShare && (
        <button
          onClick={onApplyShare}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/20 hover:bg-primary/30 text-primary text-[11px] font-medium transition-colors"
        >
          {shareIcon}
          {shareLabel}
        </button>
      )}
      {isApplied && (
        <span className="flex items-center gap-1 text-green-400 text-[11px]">
          <CheckCircle2 className="w-3 h-3" />
          Applied
        </span>
      )}
    </div>
  );
};

// Interactive question prompt component
const InteractiveQuestionBlock = ({ 
  question, 
  onAnswer,
  onSendAnswer,
}: { 
  question: InteractiveQuestion; 
  onAnswer: (answer: string | string[] | number | boolean) => void;
  onSendAnswer: (question: string, answer: string) => void;
}) => {
  const [textValue, setTextValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [sliderValue, setSliderValue] = useState(question.min ?? 1);
  const [rankedOptions, setRankedOptions] = useState<string[]>(
    question.options?.map(o => o.label) || []
  );
  const [numberValue, setNumberValue] = useState<number | ''>(question.min ?? '');
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [dateTimeValue, setDateTimeValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [yesNoValue, setYesNoValue] = useState<'yes' | 'no' | null>(null);

  if (question.answered) {
    const displayAnswer = Array.isArray(question.answer)
      ? question.answer.join(', ')
      : String(question.answer ?? '');
    return (
      <div className="border border-primary/30 rounded-lg p-3 bg-primary/5 my-2">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs font-medium text-foreground">{question.question}</span>
        </div>
        <p className="text-xs text-muted-foreground ml-5">Answer: {displayAnswer}</p>
      </div>
    );
  }

  const handleSubmit = () => {
    let answer: string | string[] | number | boolean;
    let answerText: string;
    if (question.type === 'text') {
      answer = textValue;
      answerText = textValue;
    } else if (question.type === 'multiple_choice') {
      answer = selectedOptions;
      answerText = selectedOptions.join(', ');
    } else if (question.type === 'slider') {
      answer = sliderValue;
      answerText = String(sliderValue);
    } else if (question.type === 'number') {
      const numericAnswer = typeof numberValue === 'number' ? numberValue : question.min ?? 0;
      answer = numericAnswer;
      answerText = String(numericAnswer);
    } else if (question.type === 'date') {
      answer = dateValue;
      answerText = dateValue;
    } else if (question.type === 'time') {
      answer = timeValue;
      answerText = timeValue;
    } else if (question.type === 'datetime') {
      answer = dateTimeValue;
      answerText = dateTimeValue;
    } else if (question.type === 'email') {
      answer = emailValue;
      answerText = emailValue;
    } else if (question.type === 'yes_no') {
      answer = yesNoValue === 'yes';
      answerText = yesNoValue === 'yes' ? 'Yes' : 'No';
    } else {
      answer = rankedOptions;
      answerText = rankedOptions.map((o, i) => `${i + 1}. ${o}`).join(', ');
    }
    onAnswer(answer);
    onSendAnswer(question.question, answerText);
  };

  const moveRank = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= rankedOptions.length) return;
    const updated = [...rankedOptions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setRankedOptions(updated);
  };

  const toggleOption = (label: string) => {
    if (question.multiSelect) {
      setSelectedOptions(prev =>
        prev.includes(label) ? prev.filter(o => o !== label) : [...prev, label]
      );
    } else {
      setSelectedOptions([label]);
    }
  };

  return (
    <div className="border border-primary/30 rounded-lg overflow-hidden bg-primary/5 my-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-b border-primary/20">
        <MessageCircleQuestion className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">{question.question}</span>
        {question.multiSelect && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono">MULTI</span>
        )}
      </div>
      <div className="p-3 space-y-2">
        {question.type === 'text' && (
          <input
            type="text"
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder={question.placeholder || 'Type your answer...'}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        {question.type === 'number' && (
          <input
            type="number"
            value={numberValue}
            min={question.min}
            max={question.max}
            step={question.step ?? 1}
            onChange={e => setNumberValue(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={question.placeholder || 'Enter a number...'}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        {question.type === 'date' && (
          <input
            type="date"
            value={dateValue}
            onChange={e => setDateValue(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        {question.type === 'time' && (
          <input
            type="time"
            value={timeValue}
            onChange={e => setTimeValue(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        {question.type === 'datetime' && (
          <input
            type="datetime-local"
            value={dateTimeValue}
            onChange={e => setDateTimeValue(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        {question.type === 'email' && (
          <input
            type="email"
            value={emailValue}
            onChange={e => setEmailValue(e.target.value)}
            placeholder={question.placeholder || 'name@example.com'}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        {question.type === 'yes_no' && (
          <div className="grid grid-cols-2 gap-2">
            {['yes', 'no'].map(choice => (
              <button
                key={choice}
                onClick={() => setYesNoValue(choice as 'yes' | 'no')}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs transition-all border font-medium',
                  yesNoValue === choice
                    ? 'bg-primary/20 border-primary/50 text-foreground'
                    : 'bg-background/50 border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                )}
              >
                {choice === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        )}

        {question.type === 'multiple_choice' && question.options && (
          <div className="space-y-1">
            {question.options.map(opt => (
              <button
                key={opt.id}
                onClick={() => toggleOption(opt.label)}
                className={cn(
                  'w-full text-left px-3 py-1.5 rounded-md text-xs transition-all border',
                  selectedOptions.includes(opt.label)
                    ? 'bg-primary/20 border-primary/50 text-foreground'
                    : 'bg-background/50 border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn(
                    'w-3.5 h-3.5 rounded border flex items-center justify-center',
                    question.multiSelect ? 'rounded-sm' : 'rounded-full',
                    selectedOptions.includes(opt.label) ? 'bg-primary border-primary' : 'border-muted-foreground/50'
                  )}>
                    {selectedOptions.includes(opt.label) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                  </span>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        )}

        {question.type === 'ranking' && (
          <div className="space-y-1">
            {rankedOptions.map((opt, i) => (
              <div key={opt} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-background/50 border border-border text-xs">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                <GripVertical className="w-3 h-3 text-muted-foreground" />
                <span className="flex-1 text-foreground">{opt}</span>
                <button onClick={() => moveRank(i, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-30">
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button onClick={() => moveRank(i, 1)} disabled={i === rankedOptions.length - 1} className="p-0.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-30">
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {question.type === 'slider' && (
          <div className="space-y-2">
            <input
              type="range"
              min={question.min ?? 1}
              max={question.max ?? 10}
              step={question.step ?? 1}
              value={sliderValue}
              onChange={e => setSliderValue(Number(e.target.value))}
              className="w-full accent-primary h-1.5"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{question.minLabel ?? question.min ?? 1}</span>
              <span className="text-xs font-semibold text-primary">{sliderValue}</span>
              <span>{question.maxLabel ?? question.max ?? 10}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={
            (question.type === 'text' && !textValue.trim()) ||
            (question.type === 'multiple_choice' && selectedOptions.length === 0) ||
            (question.type === 'number' && (numberValue === '' || (typeof numberValue === 'number' && ((question.min !== undefined && numberValue < question.min) || (question.max !== undefined && numberValue > question.max)))) ) ||
            (question.type === 'date' && !dateValue) ||
            (question.type === 'time' && !timeValue) ||
            (question.type === 'datetime' && !dateTimeValue) ||
            (question.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim())) ||
            (question.type === 'yes_no' && !yesNoValue)
          }
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all w-full justify-center',
            'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Send className="w-3 h-3" />
          Submit Answer
        </button>
      </div>
    </div>
  );
};

export const AIChat = ({ 
  isOpen, 
  onClose, 
  currentFile, 
  consoleOutput,
  onInsertCode,
  onApplyCode,
  onRunTest,
  workflows,
  onCreateWorkflow,
  onRunWorkflow,
  onLoadingChange,
  onInstallPackage,
  onSetTheme,
  onCreateCustomTheme,
  onGitCommit,
  onGitInit,
  onGitCreateBranch,
  onGitImport,
  onMakePublic,
  onMakePrivate,
  onGetProjectLink,
  onShareTwitter,
  onShareLinkedin,
  onShareEmail,
  onForkProject,
  onStarProject,
  onViewHistory,
  onAskUser,
  onSaveProject,
  onRunProject,
  onChangeTemplate,
  onRenameFile,
  onDeleteFile
}: AIChatProps) => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const [appliedChanges, setAppliedChanges] = useState<Set<string>>(new Set());
  const [showApiKeys, setShowApiKeys] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    attachments, fileInputRef, addFiles, removeAttachment,
    clearAttachments, openFilePicker, buildContentParts, acceptString,
  } = useAttachments();

  const { 
    messages, 
    isLoading, 
    currentStep,
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
    answerQuestion
  } = useAgentChat({
    onApplyCode: (code, fileName) => {
      if (onApplyCode) {
        onApplyCode(code, fileName);
      }
    },
    onCreateWorkflow,
    onRunWorkflow,
    onInstallPackage,
    onSetTheme,
    onCreateCustomTheme,
    onGitCommit,
    onGitInit,
    onGitCreateBranch,
    onGitImport,
    onMakePublic,
    onMakePrivate,
    onGetProjectLink,
    onShareTwitter,
    onShareLinkedin,
    onShareEmail,
    onForkProject,
    onStarProject,
    onViewHistory,
    onAskUser,
    onSaveProject,
    onRunProject,
    onRenameFile,
    onDeleteFile,
    workflows,
  });

  const { apiKeys, fetchApiKeys: refetchApiKeys } = useApiKeys();
  const connectedProviders = apiKeys.map(k => k.provider);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStep]);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const recentErrors = consoleOutput
    ?.filter(line => line.type === 'error')
    .slice(-5)
    .map(line => line.content)
    .join('\n');

  const handleFixLatestError = () => {
    if (!recentErrors) return;
    sendMessage(`Please diagnose and fix this console error. Include likely causes, exact code changes, and use <web_search /> if this looks version-specific.\n\n${recentErrors}`, {
      currentFile: currentFile ? {
        name: currentFile.name,
        language: currentFile.language,
        content: currentFile.content,
      } : null,
      consoleErrors: recentErrors,
      agentMode: true,
    });
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    
    if (!user) {
      return;
    }

    const multimodalContent = buildContentParts(input, attachments);

    sendMessage(input, {
      currentFile: currentFile ? {
        name: currentFile.name,
        language: currentFile.language,
        content: currentFile.content,
      } : null,
      consoleErrors: recentErrors,
      agentMode: true,
      multimodalContent: attachments.length > 0 ? multimodalContent : undefined,
    });
    
    setInput('');
    clearAttachments();
  };

  const handleQuickAction = (action: QuickAction) => {
    if (action.requiresFile && !currentFile) return;
    
    sendMessage(action.prompt, {
      currentFile: currentFile ? {
        name: currentFile.name,
        language: currentFile.language,
        content: currentFile.content,
      } : null,
      consoleErrors: recentErrors,
      agentMode: true,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleThinking = (stepId: string) => {
    setExpandedThinking(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const handleApplyChange = (change: CodeChange, changeId: string) => {
    applyCodeChange(change);
    setAppliedChanges(prev => new Set(prev).add(changeId));
  };

  // Resizable width
  const [panelWidth, setPanelWidth] = useState(320);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(320);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.max(280, Math.min(700, startWidthRef.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  if (!isOpen) return null;

  return (
    <div
      className="h-full flex flex-col bg-card border-l border-border relative"
      style={{ width: window.innerWidth < 768 ? '100%' : panelWidth }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20"
      />
      {/* Header - Replit style */}
      <div className="flex items-center justify-between h-12 px-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-sm text-foreground">AI Assistant</h3>
            <p className="text-[10px] text-muted-foreground">
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
                  {currentStep || 'Thinking...'}
                </span>
              ) : (
                'Ready'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={clearMessages}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Clear"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Removed - model selector moved to input area */}
      
      <SettingsDialog open={showApiKeys} onOpenChange={(open) => {
        setShowApiKeys(open);
        if (!open) refetchApiKeys();
      }} defaultTab="ai" />

      {/* Current file indicator */}
      {currentFile && (
        <div className="px-3 py-1.5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-1.5 text-[11px]">
            <FileCode className="w-3 h-3 text-primary" />
            <span className="text-muted-foreground">Context:</span>
            <span className="text-foreground font-medium truncate">{currentFile.name}</span>
          </div>
        </div>
      )}

      {/* Quick Actions - Replit style pills */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex flex-wrap gap-1.5">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action)}
              disabled={isLoading || (action.requiresFile && !currentFile)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all',
                action.requiresFile && !currentFile
                  ? 'bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-accent/50 text-foreground hover:bg-accent'
              )}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4 ide-scrollbar">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              {message.role === 'assistant' ? (
                <div className="space-y-2">
                  {/* Render thinking steps first */}
                  {message.steps?.filter(s => s.type === 'thinking').map((step) => (
                    <ThinkingStep
                      key={step.id}
                      step={step}
                      isExpanded={expandedThinking.has(step.id)}
                      onToggle={() => toggleThinking(step.id)}
                    />
                  ))}
                  
                  {/* Render main content */}
                  {message.content && (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          code: ({ className, children, ...props }) => {
                            const isInline = !className;
                            const codeContent = String(children).replace(/\n$/, '');
                            
                            if (isInline) {
                              return (
                                <code className="bg-background/50 px-1 py-0.5 rounded text-xs" {...props}>
                                  {children}
                                </code>
                              );
                            }
                            
                            return (
                              <div className="relative group my-2">
                                <pre className="bg-background/50 p-3 rounded-lg overflow-x-auto">
                                  <code className="text-xs" {...props}>
                                    {children}
                                  </code>
                                </pre>
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(codeContent);
                                    }}
                                    className="p-1.5 rounded bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                                    title="Copy code"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  {onInsertCode && (
                                    <button
                                      onClick={() => onInsertCode(codeContent)}
                                      className="p-1.5 rounded bg-background/80 hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-colors"
                                      title="Insert into editor"
                                    >
                                      <Code className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          },
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Render code changes and tool calls after content */}
                  {message.steps?.filter(s => s.type !== 'thinking').map((step) => (
                    <div key={step.id}>
                      {step.type === 'tool_call' && step.toolCall && (
                        <ToolCallIndicator 
                          toolCall={step.toolCall}
                          isApplied={appliedChanges.has(step.id)}
                          onApplyTheme={() => {
                            if (appliedChanges.has(step.id)) return;
                            setAppliedChanges(prev => new Set(prev).add(step.id));
                            const tc = step.toolCall!;
                            if (tc.name === 'set_theme' && onSetTheme) {
                              onSetTheme(tc.arguments.theme as string);
                            } else if (tc.name === 'create_custom_theme' && onCreateCustomTheme) {
                              onCreateCustomTheme(
                                tc.arguments.name as string,
                                tc.arguments.colors as import('@/contexts/ThemeContext').CustomThemeColors
                              );
                            }
                          }}
                          onApplyGit={() => {
                            if (appliedChanges.has(step.id)) return;
                            setAppliedChanges(prev => new Set(prev).add(step.id));
                            const tc = step.toolCall!;
                            if (tc.name === 'git_commit' && onGitCommit) {
                              onGitCommit(tc.arguments.message as string);
                            } else if (tc.name === 'git_init' && onGitInit) {
                              onGitInit();
                            } else if (tc.name === 'git_create_branch' && onGitCreateBranch) {
                              onGitCreateBranch(tc.arguments.branchName as string);
                            } else if (tc.name === 'git_import' && onGitImport) {
                              onGitImport(tc.arguments.url as string);
                            }
                          }}
                          onApplyShare={() => {
                            if (appliedChanges.has(step.id)) return;
                            setAppliedChanges(prev => new Set(prev).add(step.id));
                            const tc = step.toolCall!;
                            if (tc.name === 'make_public' && onMakePublic) onMakePublic();
                            else if (tc.name === 'make_private' && onMakePrivate) onMakePrivate();
                            else if (tc.name === 'get_project_link' && onGetProjectLink) onGetProjectLink();
                            else if (tc.name === 'share_twitter' && onShareTwitter) onShareTwitter();
                            else if (tc.name === 'share_linkedin' && onShareLinkedin) onShareLinkedin();
                            else if (tc.name === 'share_email' && onShareEmail) onShareEmail();
                            else if (tc.name === 'fork_project' && onForkProject) onForkProject();
                            else if (tc.name === 'star_project' && onStarProject) onStarProject();
                            else if (tc.name === 'view_history' && onViewHistory) onViewHistory();
                            else if (tc.name === 'ask_user' && onAskUser) onAskUser(tc.arguments?.question as string || 'The agent has a question for you.');
                            else if (tc.name === 'save_project' && onSaveProject) onSaveProject();
                            else if (tc.name === 'run_project' && onRunProject) onRunProject();
                          }}
                        />
                      )}
                      {step.type === 'code_change' && step.codeChange && (
                        <CodeChangeBlock
                          change={step.codeChange}
                          onApply={() => handleApplyChange(step.codeChange!, step.id)}
                          isApplied={appliedChanges.has(step.id)}
                        />
                      )}
                    </div>
                  ))}

                  {/* Generated images */}
                  {message.images && message.images.length > 0 && (
                    <div className="space-y-2">
                      {message.images.map((img, idx) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-border/50">
                          {img.isLoading ? (
                            <div className="flex items-center gap-2 p-4 bg-muted/30">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              <span className="text-xs text-muted-foreground">Generating: {img.prompt}</span>
                            </div>
                          ) : img.error ? (
                            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-xs">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{img.error}</span>
                            </div>
                          ) : img.imageUrl ? (
                            <div>
                              <img
                                src={img.imageUrl}
                                alt={img.prompt}
                                className="w-full max-h-64 object-contain bg-background/50"
                              />
                              <div className="px-2 py-1.5 bg-muted/30 text-[10px] text-muted-foreground truncate">
                                {img.prompt}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generated audio */}
                  {message.audios && message.audios.length > 0 && (
                    <div className="space-y-2">
                      {message.audios.map((audio, idx) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-border/50">
                          {audio.isLoading ? (
                            <div className="flex items-center gap-2 p-4 bg-muted/30">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                              <Music className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs text-muted-foreground">Generating music: {audio.prompt}</span>
                            </div>
                          ) : audio.error ? (
                            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-xs">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{audio.error}</span>
                            </div>
                          ) : audio.audioUrl ? (
                            <div className="p-3 bg-muted/30 space-y-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Music className="w-3.5 h-3.5 text-primary" />
                                <span className="truncate">{audio.prompt}</span>
                                {audio.duration && <span className="text-[10px]">({audio.duration}s)</span>}
                              </div>
                              <audio controls className="w-full h-8" src={audio.audioUrl} />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interactive questions */}
                  {message.questions && message.questions.length > 0 && (
                    <div className="space-y-2">
                      {message.questions.map(q => (
                        <InteractiveQuestionBlock
                          key={q.id}
                          question={q}
                          onAnswer={(answer) => answerQuestion(message.id, q.id, answer)}
                          onSendAnswer={(question, answerText) => {
                            // Auto-send the answer as a user message
                            const recentErrors = consoleOutput
                              ?.filter(line => line.type === 'error')
                              .slice(-5)
                              .map(line => line.content)
                              .join('\n');
                            sendMessage(`**${question}**\nMy answer: ${answerText}`, {
                              currentFile: currentFile ? {
                                name: currentFile.name,
                                language: currentFile.language,
                                content: currentFile.content,
                              } : null,
                              consoleErrors: recentErrors,
                              agentMode: true,
                            });
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Chat widgets */}
                  {message.widgets && message.widgets.length > 0 && (
                    <div className="space-y-2">
                      {message.widgets.map(w => (
                        <ChatWidgetRenderer key={w.id} widget={w} onChangeTemplate={onChangeTemplate} />
                      ))}
                    </div>
                  )}
                  
                  {/* Streaming indicator */}
                  {message.isStreaming && !message.content && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">{currentStep || 'Thinking...'}</span>
                    </div>
                  )}
                </div>
              ) : (
                message.content
              )}
            </div>
            {message.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
        
        {/* Loading indicator when waiting for response */}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-muted rounded-xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{currentStep || 'Thinking...'}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        {!user ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span>Sign in to use AI assistant</span>
          </div>
        ) : (
          <>
            {/* Model selector row */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {/* Built-in tiers */}
              {([
                { id: 'lite' as AIModel, label: 'Lite', icon: '⚡', sub: 'FREE' },
                { id: 'flash' as AIModel, label: 'Flash', icon: '🔥', sub: '10/day' },
                { id: 'pro' as AIModel, label: 'Pro', icon: '💎', sub: '5/day' },
              ]).map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id); setByokProvider(null); setByokModel(null); }}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-medium transition-all',
                    selectedModel === m.id && !byokProvider
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-accent/50 text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                  title={m.sub}
                >
                  {m.icon} {m.label}
                </button>
              ))}

              {/* Divider */}
              {connectedProviders.length > 0 && (
                <div className="w-px h-4 bg-border mx-0.5" />
              )}

              {/* BYOK provider buttons */}
              {connectedProviders.map(provider => (
                <button
                  key={provider}
                  onClick={() => {
                    setByokProvider(provider);
                    setByokModel(PROVIDER_MODELS[provider]?.[0]?.id || null);
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-medium transition-all',
                    byokProvider === provider
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-accent/50 text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  🔑 {PROVIDER_INFO[provider].label}
                </button>
              ))}

              <div className="flex-1" />
              <button
                onClick={() => setShowApiKeys(true)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="API Keys & Limits"
              >
                <Key className="w-3 h-3" />
              </button>
            </div>

            {/* BYOK model picker */}
            {byokProvider && PROVIDER_MODELS[byokProvider] && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] text-muted-foreground">Model:</span>
                <select
                  value={byokModel || ''}
                  onChange={e => setByokModel(e.target.value)}
                  className="text-[10px] bg-accent/50 border border-border rounded px-1.5 py-0.5 text-foreground outline-none focus:ring-1 focus:ring-primary flex-1"
                >
                  {PROVIDER_MODELS[byokProvider].map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/50 border border-border text-[11px]">
                    {att.type === 'image' ? <Image className="w-3 h-3 text-primary" /> :
                     att.type === 'video' ? <FileVideo className="w-3 h-3 text-primary" /> :
                     att.type === 'audio' ? <FileAudio className="w-3 h-3 text-primary" /> :
                     <FileText className="w-3 h-3 text-primary" />}
                    <span className="max-w-[100px] truncate text-foreground">{att.name}</span>
                    <button onClick={() => removeAttachment(att.id)} className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptString}
              className="hidden"
              onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = ''; } }}
            />

            {/* Text input + attach + send */}
            {recentErrors && (
              <button
                onClick={handleFixLatestError}
                className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
              >
                <AlertCircle className="w-3 h-3" />
                Fix this error
              </button>
            )}
            <div className="flex gap-2">
              <button
                onClick={openFilePicker}
                disabled={isLoading}
                className="p-2.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Attach file (image, video, audio, PDF)"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentFile ? `Ask about ${currentFile.name}...` : 'Ask me anything...'}
                className="flex-1 resize-none bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[40px] max-h-[120px]"
                rows={1}
              />
              {isLoading ? (
                <button
                  onClick={stopGeneration}
                  className="p-2.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  title="Stop generating"
                >
                  <StopCircle className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
                  className={cn(
                    'p-2.5 rounded-lg transition-colors',
                    (input.trim() || attachments.length > 0)
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
