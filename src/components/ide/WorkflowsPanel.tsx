import { useState } from 'react';
import { 
  Play, 
  Plus, 
  Trash2, 
  Settings2, 
  Terminal, 
  Globe, 
  Zap,
  Clock,
  ChevronRight,
  Edit2,
  Copy,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Loader2,
  FileCode,
  Server,
  TestTube,
  Package,
  Rocket
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface Workflow {
  id: string;
  name: string;
  type: 'run' | 'build' | 'test' | 'deploy' | 'custom';
  command: string;
  description?: string;
  trigger?: 'manual' | 'on-save' | 'on-commit';
  lastRun?: Date;
  lastStatus?: 'success' | 'failed' | 'running';
  isDefault?: boolean;
}

interface WorkflowsPanelProps {
  workflows: Workflow[];
  onRunWorkflow: (workflow: Workflow) => void;
  onCreateWorkflow: (workflow: Omit<Workflow, 'id'>) => void;
  onUpdateWorkflow: (id: string, workflow: Partial<Workflow>) => void;
  onDeleteWorkflow: (id: string) => void;
  currentlyRunning: string | null;
}

const workflowTypeIcons = {
  run: Play,
  build: Package,
  test: TestTube,
  deploy: Rocket,
  custom: Zap,
};

const workflowTypeColors = {
  run: 'text-green-400',
  build: 'text-blue-400',
  test: 'text-yellow-400',
  deploy: 'text-purple-400',
  custom: 'text-orange-400',
};

const triggerLabels = {
  manual: 'Manual',
  'on-save': 'On Save',
  'on-commit': 'On Commit',
};

export const WorkflowsPanel = ({
  workflows,
  onRunWorkflow,
  onCreateWorkflow,
  onUpdateWorkflow,
  onDeleteWorkflow,
  currentlyRunning,
}: WorkflowsPanelProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    type: 'run' as Workflow['type'],
    command: '',
    description: '',
    trigger: 'manual' as Workflow['trigger'],
  });

  const handleCreate = () => {
    if (!newWorkflow.name.trim() || !newWorkflow.command.trim()) return;
    
    onCreateWorkflow({
      name: newWorkflow.name,
      type: newWorkflow.type,
      command: newWorkflow.command,
      description: newWorkflow.description,
      trigger: newWorkflow.trigger,
    });
    
    setNewWorkflow({
      name: '',
      type: 'run',
      command: '',
      description: '',
      trigger: 'manual',
    });
    setIsCreating(false);
  };

  const handleDuplicate = (workflow: Workflow) => {
    onCreateWorkflow({
      name: `${workflow.name} (copy)`,
      type: workflow.type,
      command: workflow.command,
      description: workflow.description,
      trigger: workflow.trigger,
    });
  };

  const getStatusIcon = (status?: Workflow['lastStatus']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      case 'running':
        return <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Workflows
        </span>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="New Workflow"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto ide-scrollbar">
        {/* Create new workflow form */}
        {isCreating && (
          <div className="p-3 border-b border-border bg-accent/30">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Workflow name"
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              
              <div className="flex gap-2">
                <select
                  value={newWorkflow.type}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, type: e.target.value as Workflow['type'] })}
                  className="flex-1 px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="run">Run</option>
                  <option value="build">Build</option>
                  <option value="test">Test</option>
                  <option value="deploy">Deploy</option>
                  <option value="custom">Custom</option>
                </select>
                
                <select
                  value={newWorkflow.trigger}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, trigger: e.target.value as Workflow['trigger'] })}
                  className="flex-1 px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="manual">Manual</option>
                  <option value="on-save">On Save</option>
                  <option value="on-commit">On Commit</option>
                </select>
              </div>

              <input
                type="text"
                placeholder="Command (e.g., npm run build)"
                value={newWorkflow.command}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, command: e.target.value })}
                className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <input
                type="text"
                placeholder="Description (optional)"
                value={newWorkflow.description}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newWorkflow.name.trim() || !newWorkflow.command.trim()}
                  className="flex-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded text-sm font-medium hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workflow list */}
        <div className="py-1">
          {workflows.length === 0 && !isCreating ? (
            <div className="px-3 py-8 text-center">
              <Zap className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-1">No workflows yet</p>
              <p className="text-xs text-muted-foreground mb-3">
                Create workflows to automate tasks
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Create Workflow
              </button>
            </div>
          ) : (
            workflows.map((workflow) => {
              const Icon = workflowTypeIcons[workflow.type];
              const isRunning = currentlyRunning === workflow.id;
              
              return (
                <div
                  key={workflow.id}
                  className={cn(
                    'group px-3 py-2 border-b border-border/50 hover:bg-accent/50 transition-colors',
                    isRunning && 'bg-primary/10'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn('mt-0.5', workflowTypeColors[workflow.type])}>
                      <Icon className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {workflow.name}
                        </span>
                        {workflow.isDefault && (
                          <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded">
                            Default
                          </span>
                        )}
                        {getStatusIcon(isRunning ? 'running' : workflow.lastStatus)}
                      </div>
                      
                      {workflow.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {workflow.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs text-muted-foreground bg-secondary/50 px-1 py-0.5 rounded font-mono truncate max-w-[150px]">
                          {workflow.command}
                        </code>
                        {workflow.trigger && workflow.trigger !== 'manual' && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {triggerLabels[workflow.trigger]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onRunWorkflow(workflow)}
                        disabled={isRunning}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-green-400 transition-colors disabled:opacity-50"
                        title="Run workflow"
                      >
                        {isRunning ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => onRunWorkflow(workflow)}>
                            <Play className="w-4 h-4 mr-2" />
                            Run
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(workflow)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => onDeleteWorkflow(workflow.id)}
                            className="text-destructive focus:text-destructive"
                            disabled={workflow.isDefault}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick actions section */}
        {workflows.length > 0 && (
          <div className="px-3 py-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick Actions</p>
            <div className="space-y-1">
              <button
                onClick={() => {
                  const runWorkflow = workflows.find(w => w.type === 'run');
                  if (runWorkflow) onRunWorkflow(runWorkflow);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors"
              >
                <Play className="w-4 h-4 text-green-400" />
                <span>Run Main</span>
                <kbd className="ml-auto text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                  ⌘R
                </kbd>
              </button>
              <button
                onClick={() => {
                  const testWorkflow = workflows.find(w => w.type === 'test');
                  if (testWorkflow) onRunWorkflow(testWorkflow);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors"
              >
                <TestTube className="w-4 h-4 text-yellow-400" />
                <span>Run Tests</span>
                <kbd className="ml-auto text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                  ⌘T
                </kbd>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
