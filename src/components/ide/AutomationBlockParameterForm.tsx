import { useState, useMemo } from 'react';
import { HelpCircle, AlertCircle, ChevronDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { APIParameter, Operation } from '@/data/automationIntegrationRegistry';

const VARIABLE_TEMPLATES = [
  { label: 'Previous result', value: '{{prev.result}}', description: 'Main output from previous step' },
  { label: 'Previous data', value: '{{prev.data}}', description: 'Data array from previous step' },
  { label: 'Previous status', value: '{{prev.status}}', description: 'Status code from previous step' },
  { label: 'Previous text', value: '{{prev.text}}', description: 'Text output from previous step' },
  { label: 'Previous email_id', value: '{{prev.email_id}}', description: 'Email ID from a send step' },
  { label: 'Previous image_url', value: '{{prev.image_url}}', description: 'Image URL from a generation step' },
];

interface AutomationBlockParameterFormProps {
  parameters?: APIParameter[];
  credentialFields?: APIParameter[];
  operations?: Operation[];
  config: Record<string, string>;
  onConfigChange: (config: Record<string, string>) => void;
  blockLabel: string;
  /** Zero-based index of this block in the pipeline. When > 0, variable insertion is available. */
  stepIndex?: number;
}

export const AutomationBlockParameterForm = ({
  parameters = [],
  credentialFields = [],
  operations = [],
  config,
  onConfigChange,
  blockLabel,
  stepIndex = 0,
}: AutomationBlockParameterFormProps) => {
  const [expandedHelp, setExpandedHelp] = useState<string | null>(null);
  const [variableDropdown, setVariableDropdown] = useState<string | null>(null);
  const [selectFilters, setSelectFilters] = useState<Record<string, string>>({});
  const selectedOperation = useMemo(
    () => operations.find((op) => op.id === config.__operation),
    [operations, config.__operation]
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canInsertVariables = stepIndex > 0;

  const validateField = (param: APIParameter, value: string) => {
    if (!value && param.required) {
      return `${param.displayName} is required`;
    }
    if (value && param.pattern) {
      const regex = new RegExp(param.pattern);
      if (!regex.test(value)) {
        return `${param.displayName} does not match required format`;
      }
    }
    if (param.validation) {
      const result = param.validation(value);
      if (result !== true && typeof result === 'string') {
        return result;
      }
    }
    return '';
  };

  const handleFieldChange = (param: APIParameter, value: string) => {
    const error = validateField(param, value);
    setFieldErrors((prev) => {
      if (error) {
        return { ...prev, [param.name]: error };
      } else {
        const newErrors = { ...prev };
        delete newErrors[param.name];
        return newErrors;
      }
    });
    onConfigChange({ ...config, [param.name]: value });
  };

  const insertVariable = (param: APIParameter, variable: string) => {
    const current = String(config[param.name] ?? param.default ?? '');
    handleFieldChange(param, current ? `${current} ${variable}` : variable);
    setVariableDropdown(null);
  };

  const hasVariableTokens = (value: string) => /\{\{prev\.[^}]+\}\}/.test(value);

  const renderVariableInsert = (param: APIParameter) => {
    if (!canInsertVariables) return null;
    if (param.type === 'boolean' || param.type === 'select') return null;

    const isOpen = variableDropdown === param.name;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setVariableDropdown(isOpen ? null : param.name)}
          className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
          title="Insert variable from previous step"
        >
          <Zap className="h-2.5 w-2.5" />
          prev
          <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', isOpen && 'rotate-180')} />
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-border bg-popover p-1 shadow-lg">
            {VARIABLE_TEMPLATES.map((v) => (
              <button
                key={v.value}
                onClick={() => insertVariable(param, v.value)}
                className="w-full rounded px-2 py-1.5 text-left hover:bg-accent transition-colors"
              >
                <p className="text-[11px] font-mono font-medium text-foreground">{v.value}</p>
                <p className="text-[10px] text-muted-foreground">{v.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderParameterField = (param: APIParameter) => {
    const value = String(config[param.name] ?? param.default ?? '');
    const error = fieldErrors[param.name];
    const showVarHighlight = hasVariableTokens(value);

    return (
      <div key={param.name} className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <label className="text-xs font-medium text-foreground flex items-center gap-1">
            {param.displayName}
            {param.required && <span className="text-destructive">*</span>}
          </label>
          <div className="flex items-center gap-1">
            {renderVariableInsert(param)}
            {param.help && (
              <button
                onClick={() => setExpandedHelp(expandedHelp === param.name ? null : param.name)}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                title={param.help}
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {param.description && (
          <p className="text-[11px] text-muted-foreground">{param.description}</p>
        )}

        {expandedHelp === param.name && param.help && (
          <div className="rounded bg-muted/50 p-2 text-[11px] text-muted-foreground border border-border/50">
            {param.help}
          </div>
        )}

        {param.type === 'select' && param.options ? (
          <>
            {param.options.length > 12 && (
              <input
                value={selectFilters[param.name] ?? ''}
                onChange={(e) => setSelectFilters((prev) => ({ ...prev, [param.name]: e.target.value }))}
                placeholder={`Filter ${param.displayName}...`}
                className="w-full rounded border border-border bg-input px-2 py-1.5 text-xs text-foreground mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
            <select
              value={value}
              onChange={(e) => handleFieldChange(param, e.target.value)}
              className={cn(
                'w-full rounded border bg-input px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary',
                error ? 'border-destructive/50' : 'border-border',
              )}
            >
              <option value="">Select {param.displayName}...</option>
              {(param.options || [])
                .filter((opt) => {
                  const filter = selectFilters[param.name]?.toLowerCase().trim();
                  if (!filter) return true;
                  return opt.label.toLowerCase().includes(filter) || opt.value.toLowerCase().includes(filter);
                })
                .map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </>
        ) : param.type === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(param, e.target.value)}
            placeholder={param.placeholder}
            rows={3}
            className={cn(
              'w-full rounded border bg-input px-2 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none',
              error ? 'border-destructive/50' : 'border-border',
              showVarHighlight && 'ring-1 ring-primary/30 border-primary/40',
            )}
          />
        ) : param.type === 'number' ? (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(param, e.target.value)}
            placeholder={param.placeholder}
            className={cn(
              'w-full rounded border bg-input px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary',
              error ? 'border-destructive/50' : 'border-border',
            )}
          />
        ) : param.type === 'boolean' ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => handleFieldChange(param, e.target.checked ? 'true' : 'false')}
              className="w-4 h-4 rounded border border-border"
            />
            <span className="text-xs text-foreground">{param.placeholder || 'Enable'}</span>
          </label>
        ) : (
          <input
            type={param.type}
            value={value}
            onChange={(e) => handleFieldChange(param, e.target.value)}
            placeholder={param.placeholder}
            className={cn(
              'w-full rounded border bg-input px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary',
              error ? 'border-destructive/50' : 'border-border',
              showVarHighlight && 'ring-1 ring-primary/30 border-primary/40',
            )}
          />
        )}

        {showVarHighlight && (
          <p className="text-[10px] text-primary/80 flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" /> Uses output from previous step
          </p>
        )}

        {error && (
          <div className="flex items-start gap-1.5 text-[11px] text-destructive rounded bg-destructive/5 border border-destructive/20 p-1.5">
            <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </div>
    );
  };

  const hasDefined = parameters.length > 0 || credentialFields.length > 0 || operations.length > 0;

  if (!hasDefined) {
    return null;
  }

  return (
    <div className="space-y-4">
      {canInsertVariables && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
          <p className="text-[11px] font-medium text-primary flex items-center gap-1.5">
            <Zap className="h-3 w-3" /> Data from previous step is available
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Use the <span className="font-mono text-primary/80">prev</span> button on any field to insert <code className="font-mono text-primary/80">{'{{prev.result}}'}</code> and pass data between steps.
          </p>
        </div>
      )}

      {credentialFields.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-100 mb-2.5">API Credentials</p>
          <div className="space-y-3">
            {credentialFields.map(renderParameterField)}
          </div>
        </div>
      )}

      {operations.length > 0 && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <p className="text-xs font-semibold text-blue-100 mb-2.5">Operation</p>
          <select
            value={config.__operation ?? ''}
            onChange={(e) => onConfigChange({ ...config, __operation: e.target.value })}
            className="w-full rounded border bg-input px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary border-border"
          >
            <option value="">Select an operation...</option>
            {operations.map((op) => (
              <option key={op.id} value={op.id}>
                {op.name}
              </option>
            ))}
          </select>
          
          {selectedOperation && (
            <div className="mt-3 pt-3 border-t border-blue-500/20 space-y-3">
              {selectedOperation.description && (
                <p className="text-[11px] text-blue-100/80">{selectedOperation.description}</p>
              )}
              {selectedOperation.method && (
                <div className="flex items-center gap-2">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-600/30 text-blue-200">
                    {selectedOperation.method}
                  </span>
                  {selectedOperation.endpoint && (
                    <span className="text-[11px] font-mono text-blue-100/70">{selectedOperation.endpoint}</span>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {selectedOperation.inputFields.map(renderParameterField)}
              </div>
            </div>
          )}
        </div>
      )}

      {parameters.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold text-foreground mb-2.5">
            {blockLabel} Parameters
          </p>
          <div className="space-y-3">
            {parameters.map(renderParameterField)}
          </div>
        </div>
      )}
    </div>
  );
};
