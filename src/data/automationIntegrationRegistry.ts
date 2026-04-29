export type AutomationAuthType = 'api_key' | 'free' | 'internal' | 'local';
export type ParameterType = 'string' | 'number' | 'boolean' | 'select' | 'textarea' | 'password' | 'email' | 'url';

export interface APIParameter {
  name: string;
  displayName: string;
  type: ParameterType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  default?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
  help?: string;
  pattern?: string;
  validation?: (value: any) => boolean | string; // error message if invalid
}

export interface Operation {
  id: string;
  name: string;
  description?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint?: string;
  inputFields: APIParameter[];
  outputFields?: APIParameter[];
  documentation?: string;
  example?: Record<string, any>;
}

export interface AutomationRegistryBlock {
  id: string;
  label: string;
  auth: AutomationAuthType;
  description?: string;
  parameters?: APIParameter[];
  credentialFields?: APIParameter[];
  operations?: Operation[];
  isTrigger?: boolean;
}

export interface AutomationRegistrySubcategory {
  id: string;
  title: string;
  blocks: AutomationRegistryBlock[];
}

export interface AutomationRegistryCategory {
  id: string;
  title: string;
  subcategories: AutomationRegistrySubcategory[];
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const genericHttpParams: APIParameter[] = [
  { name: 'url', displayName: 'Request URL', type: 'url', required: true, description: 'Full API endpoint URL', placeholder: 'https://api.example.com/v1/resource' },
  { name: 'method', displayName: 'HTTP Method', type: 'select', default: 'POST', options: [
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' },
    { label: 'PUT', value: 'PUT' },
    { label: 'PATCH', value: 'PATCH' },
    { label: 'DELETE', value: 'DELETE' },
  ], description: 'HTTP method to use for the request' },
  { name: 'headers', displayName: 'Headers (JSON)', type: 'textarea', description: 'Optional request headers in JSON format', placeholder: '{"Content-Type": "application/json"}' },
  { name: 'query', displayName: 'Query Parameters (JSON)', type: 'textarea', description: 'Optional query parameters in JSON format', placeholder: '{"limit": 10}' },
  { name: 'body', displayName: 'Body (JSON)', type: 'textarea', description: 'Optional JSON body payload', placeholder: '{"key":"value"}' },
];

const genericApiKeyCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const genericLocalParams: APIParameter[] = [
  { name: 'model', displayName: 'Model', type: 'string', required: true, placeholder: 'llama2' },
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true, placeholder: 'Hello from automation' },
  { name: 'temperature', displayName: 'Temperature', type: 'number', default: 0.7 },
  { name: 'max_tokens', displayName: 'Max Tokens', type: 'number', default: 512 },
  { name: 'system_prompt', displayName: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant.' },
];

const genericInternalParamsByLabel: Record<string, APIParameter[]> = {
  'Filter': [
    { name: 'field', displayName: 'Field', type: 'string', required: true, placeholder: 'status' },
    { name: 'equals', displayName: 'Equals', type: 'string', placeholder: 'ok' },
  ],
  'Router': [
    { name: 'routes', displayName: 'Routes (JSON)', type: 'textarea', required: true, placeholder: '[{"name":"success","condition":"status == \'ok\'"}]' },
  ],
  'Loop': [
    { name: 'items', displayName: 'Items (JSON)', type: 'textarea', required: true, placeholder: '[1, 2, 3]' },
  ],
  'Delay': [
    { name: 'seconds', displayName: 'Seconds', type: 'number', required: true, default: 5 },
  ],
  'Wait for Approval': [
    { name: 'approver', displayName: 'Approver', type: 'string', placeholder: 'user@example.com' },
    { name: 'timeout_seconds', displayName: 'Timeout (seconds)', type: 'number', default: 3600 },
  ],
  'Error Handler': [
    { name: 'retry_count', displayName: 'Retry Count', type: 'number', default: 1 },
    { name: 'fallback_message', displayName: 'Fallback Message', type: 'textarea' },
  ],
  'Switch/Case': [
    { name: 'field', displayName: 'Field', type: 'string', required: true, placeholder: 'status' },
    { name: 'cases', displayName: 'Cases (JSON)', type: 'textarea', required: true, placeholder: '[{"value":"ok","next":"success"}]' },
  ],
  'Merge': [
    { name: 'merge_strategy', displayName: 'Merge Strategy', type: 'select', default: 'append', options: [
      { label: 'Append', value: 'append' },
      { label: 'Overwrite', value: 'overwrite' },
    ]},
  ],
  'Parallel Split': [
    { name: 'branches', displayName: 'Branches (JSON)', type: 'textarea', required: true, placeholder: '[{"name":"A"},{"name":"B"}]' },
  ],
  'Debounce': [
    { name: 'interval_ms', displayName: 'Interval (ms)', type: 'number', default: 500 },
  ],
  'Rate Limiter': [
    { name: 'limit_per_minute', displayName: 'Limit / min', type: 'number', default: 60 },
  ],
  'Retry': [
    { name: 'attempts', displayName: 'Attempts', type: 'number', default: 3 },
    { name: 'backoff_seconds', displayName: 'Backoff Seconds', type: 'number', default: 5 },
  ],
  'Circuit Breaker': [
    { name: 'failure_threshold', displayName: 'Failure Threshold', type: 'number', default: 5 },
    { name: 'reset_timeout', displayName: 'Reset Timeout (seconds)', type: 'number', default: 60 },
  ],
  'Sub-Workflow': [
    { name: 'workflow_id', displayName: 'Workflow ID', type: 'string', placeholder: 'child-workflow-id' },
  ],
  'Text Formatter': [
    { name: 'operation', displayName: 'Operation', type: 'select', required: true, default: 'capitalize', options: [
      { label: 'Uppercase', value: 'uppercase' },
      { label: 'Lowercase', value: 'lowercase' },
      { label: 'Title Case', value: 'titlecase' },
      { label: 'Capitalize', value: 'capitalize' },
      { label: 'Replace', value: 'replace' },
    ]},
    { name: 'text', displayName: 'Text', type: 'textarea', required: true },
    { name: 'search', displayName: 'Search', type: 'string' },
    { name: 'replace_with', displayName: 'Replace With', type: 'string' },
  ],
  'Date Formatter': [
    { name: 'date_input', displayName: 'Date Input', type: 'string', required: true, placeholder: '2024-01-15' },
    { name: 'input_format', displayName: 'Input Format', type: 'string', default: 'YYYY-MM-DD' },
    { name: 'output_format', displayName: 'Output Format', type: 'string', default: 'MMMM D, YYYY' },
    { name: 'timezone', displayName: 'Timezone', type: 'string', default: 'UTC' },
  ],
  'Math': [
    { name: 'operation', displayName: 'Operation', type: 'select', required: true, default: 'add', options: [
      { label: 'Add', value: 'add' },
      { label: 'Subtract', value: 'subtract' },
      { label: 'Multiply', value: 'multiply' },
      { label: 'Divide', value: 'divide' },
      { label: 'Power', value: 'power' },
    ]},
    { name: 'value_a', displayName: 'Value A', type: 'number', required: true },
    { name: 'value_b', displayName: 'Value B', type: 'number' },
  ],
  'JSON Parser': [
    { name: 'json_string', displayName: 'JSON String', type: 'textarea', required: true },
    { name: 'path', displayName: 'Path', type: 'string', placeholder: 'user.email' },
    { name: 'action', displayName: 'Action', type: 'select', default: 'parse', options: [
      { label: 'Parse', value: 'parse' },
      { label: 'Stringify', value: 'stringify' },
      { label: 'Extract Value', value: 'extract' },
      { label: 'Validate', value: 'validate' },
    ]},
  ],
  'JS/Python Code': [
    { name: 'language', displayName: 'Language', type: 'select', required: true, default: 'python', options: [
      { label: 'Python', value: 'python' },
      { label: 'JavaScript', value: 'javascript' },
    ]},
    { name: 'code', displayName: 'Code', type: 'textarea', required: true, placeholder: 'print("Hello")' },
    { name: 'input_data', displayName: 'Input Data (JSON)', type: 'textarea', placeholder: '{"key":"value"}' },
  ],
  'CSV Generator': [
    { name: 'data', displayName: 'Data (JSON array)', type: 'textarea', required: true, placeholder: '[{"name":"Alice"}]' },
    { name: 'headers', displayName: 'Column Headers', type: 'string', placeholder: 'name,email' },
  ],
  'PDF Creator': [
    { name: 'title', displayName: 'Document Title', type: 'string', required: true },
    { name: 'content', displayName: 'Content', type: 'textarea', required: true },
    { name: 'orientation', displayName: 'Orientation', type: 'select', default: 'portrait', options: [
      { label: 'Portrait', value: 'portrait' },
      { label: 'Landscape', value: 'landscape' },
    ]},
  ],
  'XML Parser': [
    { name: 'xml_string', displayName: 'XML String', type: 'textarea', required: true },
    { name: 'path', displayName: 'Path', type: 'string', placeholder: 'root.item' },
  ],
  'YAML Parser': [
    { name: 'yaml_string', displayName: 'YAML String', type: 'textarea', required: true },
  ],
  'Base64 Encode/Decode': [
    { name: 'operation', displayName: 'Operation', type: 'select', required: true, default: 'encode', options: [
      { label: 'Encode', value: 'encode' },
      { label: 'Decode', value: 'decode' },
    ]},
    { name: 'input', displayName: 'Input', type: 'textarea', required: true },
  ],
  'Hash Generator': [
    { name: 'algorithm', displayName: 'Algorithm', type: 'select', default: 'sha256', options: [
      { label: 'SHA-256', value: 'sha256' },
      { label: 'MD5', value: 'md5' },
    ]},
    { name: 'input', displayName: 'Input', type: 'textarea', required: true },
  ],
  'UUID Generator': [
    { name: 'version', displayName: 'Version', type: 'select', default: '4', options: [
      { label: 'UUID v4', value: '4' },
      { label: 'UUID v1', value: '1' },
    ]},
  ],
  'Regex Extractor': [
    { name: 'pattern', displayName: 'Pattern', type: 'string', required: true, placeholder: '\\w+' },
    { name: 'input', displayName: 'Input Text', type: 'textarea', required: true },
  ],
  'HTML Parser': [
    { name: 'html', displayName: 'HTML', type: 'textarea', required: true },
    { name: 'selector', displayName: 'CSS Selector', type: 'string', placeholder: 'div.content' },
  ],
  'Markdown to HTML': [
    { name: 'markdown', displayName: 'Markdown', type: 'textarea', required: true },
  ],
  'Image Resizer': [
    { name: 'image_url', displayName: 'Image URL', type: 'url', required: true },
    { name: 'width', displayName: 'Width', type: 'number', required: true },
    { name: 'height', displayName: 'Height', type: 'number', required: true },
  ],
  'QR Code Generator': [
    { name: 'text', displayName: 'Text', type: 'textarea', required: true },
    { name: 'size', displayName: 'Size', type: 'number', default: 300 },
  ],
  'Barcode Generator': [
    { name: 'text', displayName: 'Text', type: 'textarea', required: true },
    { name: 'format', displayName: 'Format', type: 'string', default: 'code128' },
  ],
};

const getDefaultParameters = (label: string, auth: AutomationAuthType): APIParameter[] | undefined => {
  if (auth === 'internal') return genericInternalParamsByLabel[label] ?? [
    { name: 'notes', displayName: 'Notes', type: 'textarea', placeholder: 'Internal block settings' },
  ];

  if (auth === 'local') return genericLocalParams;
  return genericHttpParams;
};

const getDefaultCredentialFields = (auth: AutomationAuthType): APIParameter[] | undefined => {
  if (auth === 'api_key') return genericApiKeyCredentials;
  return undefined;
};

const block = (
  label: string,
  auth: AutomationAuthType,
  description?: string,
  parameters?: APIParameter[],
  credentialFields?: APIParameter[],
  operations?: Operation[],
  isTrigger?: boolean,
): AutomationRegistryBlock => ({
  id: slugify(label),
  label,
  auth,
  description,
  parameters: parameters ?? getDefaultParameters(label, auth),
  credentialFields: credentialFields ?? getDefaultCredentialFields(auth),
  operations,
  isTrigger,
});

const withBlocks = (
  id: string,
  title: string,
  blocks: Array<
    | [string, AutomationAuthType]
    | [string, AutomationAuthType, string | undefined]
    | [string, AutomationAuthType, string | undefined, APIParameter[]]
    | [string, AutomationAuthType, string | undefined, APIParameter[], APIParameter[]]
    | [string, AutomationAuthType, string | undefined, APIParameter[], APIParameter[], Operation[]]
    | [string, AutomationAuthType, string | undefined, APIParameter[], APIParameter[], Operation[], boolean]
  >
): AutomationRegistrySubcategory => ({
  id,
  title,
  blocks: blocks.map(([label, auth, description, parameters, credentialFields, operations, isTrigger]) =>
    block(label, auth, description as string | undefined, parameters as APIParameter[] | undefined, credentialFields as APIParameter[] | undefined, operations as Operation[] | undefined, isTrigger as boolean | undefined)
  ),
});

// ============ API Parameter Schemas ============

const slackParams: APIParameter[] = [
  { name: 'channel', displayName: 'Channel', type: 'string', description: 'Channel name (e.g., #general) or ID', required: true, placeholder: '#general' },
  { name: 'message', displayName: 'Message', type: 'textarea', description: 'Message text to send', required: true, placeholder: 'Your message here...' },
  { name: 'thread_ts', displayName: 'Thread Timestamp', type: 'string', description: 'Optional: reply to a thread', placeholder: '1234567890.123456' },
  { name: 'blocks', displayName: 'Rich Blocks (JSON)', type: 'textarea', description: 'Optional: Slack Block Kit JSON for rich formatting' },
];

const slackCredentials: APIParameter[] = [
  { name: 'webhook_url', displayName: 'Webhook URL', type: 'url', description: 'Slack Incoming Webhook URL', required: true, placeholder: 'https://hooks.slack.com/services/...' },
];

const openaiParams: APIParameter[] = [
  {
    name: 'model',
    displayName: 'Model',
    type: 'select',
    description: 'Select the OpenAI model to use for this request',
    required: true,
    default: 'gpt-5.4',
    options: [
      { label: 'GPT-5.4', value: 'gpt-5.4' },
      { label: 'GPT-5.4 Pro', value: 'gpt-5.4-pro' },
      { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini' },
      { label: 'GPT-5.4 Nano', value: 'gpt-5.4-nano' },
      { label: 'GPT-5.2', value: 'gpt-5.2' },
      { label: 'GPT-5.2 Pro', value: 'gpt-5.2-pro' },
      { label: 'GPT-5.2 Mini', value: 'gpt-5.2-mini' },
      { label: 'GPT-5.1', value: 'gpt-5.1' },
      { label: 'GPT-5.1 Chat Latest', value: 'gpt-5.1-chat-latest' },
      { label: 'GPT-5.1 Codex', value: 'gpt-5.1-codex' },
      { label: 'GPT-5.1 Codex Max', value: 'gpt-5.1-codex-max' },
      { label: 'GPT-5.1 Codex Mini', value: 'gpt-5.1-codex-mini' },
      { label: 'GPT-5', value: 'gpt-5' },
      { label: 'GPT-5 Mini', value: 'gpt-5-mini' },
      { label: 'GPT-5 Nano', value: 'gpt-5-nano' },
      { label: 'GPT-4.1', value: 'gpt-4.1' },
      { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
      { label: 'GPT-4.1 Nano', value: 'gpt-4.1-nano' },
      { label: 'GPT-4o', value: 'gpt-4o' },
      { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
      { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
      { label: 'GPT-4', value: 'gpt-4' },
      { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
      { label: 'GPT Image 1.5', value: 'gpt-image-1.5' },
      { label: 'GPT Image 1', value: 'gpt-image-1' },
      { label: 'GPT Image 1 Mini', value: 'gpt-image-1-mini' },
      { label: 'ChatGPT Image Latest', value: 'chatgpt-image-latest' },
      { label: 'DALL·E 3', value: 'dall-e-3' },
      { label: 'DALL·E 2', value: 'dall-e-2' },
      { label: 'GPT Realtime', value: 'gpt-realtime' },
      { label: 'GPT Realtime Mini', value: 'gpt-realtime-mini' },
      { label: 'GPT Realtime 1.5', value: 'gpt-realtime-1.5' },
      { label: 'GPT Audio', value: 'gpt-audio' },
      { label: 'GPT Audio Mini', value: 'gpt-audio-mini' },
      { label: 'GPT Audio 1.5', value: 'gpt-audio-1.5' },
      { label: 'TTS 1', value: 'tts-1' },
      { label: 'TTS 1 HD', value: 'tts-1-hd' },
      { label: 'Whisper', value: 'whisper-1' },
      { label: 'O3', value: 'o3' },
      { label: 'O3 Mini', value: 'o3-mini' },
      { label: 'O3 Pro', value: 'o3-pro' },
      { label: 'O3 Deep Research', value: 'o3-deep-research' },
      { label: 'O4 Mini', value: 'o4-mini' },
      { label: 'O4 Mini Deep Research', value: 'o4-mini-deep-research' },
      { label: 'O1', value: 'o1' },
      { label: 'O1 Mini', value: 'o1-mini' },
      { label: 'O1 Pro', value: 'o1-pro' },
      { label: 'O1 Preview', value: 'o1-preview' },
      { label: 'Omni Moderation Latest', value: 'omni-moderation-latest' },
      { label: 'Babbage 002', value: 'babbage-002' },
      { label: 'Davinci 002', value: 'davinci-002' },
    ],
  },
  {
    name: 'prompt',
    displayName: 'Prompt',
    type: 'textarea',
    description: 'Instruction or prompt for the model',
    required: true,
    placeholder: 'Summarize the following text or perform a task...',
  },
  {
    name: 'input',
    displayName: 'Input',
    type: 'textarea',
    description: 'Optional input data for the model',
    placeholder: 'Text to process, analyze, or summarize',
  },
  { name: 'temperature', displayName: 'Temperature', type: 'number', description: '0-2, higher = more creative', default: 0.7 },
  { name: 'top_p', displayName: 'Top P', type: 'number', description: 'Nucleus sampling: 0-1', default: 1 },
  { name: 'frequency_penalty', displayName: 'Frequency Penalty', type: 'number', description: 'Penalty for repeated tokens', default: 0 },
  { name: 'presence_penalty', displayName: 'Presence Penalty', type: 'number', description: 'Penalty for introducing new topics', default: 0 },
  { name: 'max_tokens', displayName: 'Max Tokens', type: 'number', description: 'Maximum response length', default: 500 },
  { name: 'stop', displayName: 'Stop Sequences', type: 'textarea', description: 'Stop sequence(s) to end generation early', placeholder: '\n###\n' },
  { name: 'user', displayName: 'User', type: 'string', description: 'Optional end-user identifier', placeholder: 'user-123' },
];

const openaiCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', description: 'OpenAI API Key', required: true, placeholder: 'sk-...' },
];

const twitterParams: APIParameter[] = [
  { name: 'text', displayName: 'Tweet Text', type: 'textarea', description: 'Tweet content (max 280 chars)', required: true, placeholder: 'Your tweet here...' },
  { name: 'reply_to', displayName: 'Reply to Tweet ID', type: 'string', description: 'Optional: reply to another tweet' },
  { name: 'media_ids', displayName: 'Media IDs', type: 'string', description: 'Comma-separated media IDs', placeholder: 'id1,id2,id3' },
];

const twitterCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
  { name: 'api_secret', displayName: 'API Secret', type: 'password', required: true },
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
  { name: 'access_secret', displayName: 'Access Secret', type: 'password', required: true },
];

const twilioParams: APIParameter[] = [
  { name: 'to', displayName: 'To (Phone)', type: 'string', required: true, placeholder: '+1234567890' },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true, placeholder: 'Your SMS text...' },
  { name: 'from', displayName: 'From (Your Number)', type: 'string', placeholder: '+1234567890' },
];

const twilioCredentials: APIParameter[] = [
  { name: 'account_sid', displayName: 'Account SID', type: 'password', required: true },
  { name: 'auth_token', displayName: 'Auth Token', type: 'password', required: true },
];

const stripeParams: APIParameter[] = [
  { name: 'amount', displayName: 'Amount (cents)', type: 'number', required: true, placeholder: '1000' },
  { name: 'currency', displayName: 'Currency', type: 'select', required: true, default: 'usd', options: [{ label: 'USD', value: 'usd' }, { label: 'EUR', value: 'eur' }] },
  { name: 'description', displayName: 'Description', type: 'string', placeholder: 'Order #12345' },
  { name: 'customer_id', displayName: 'Customer ID', type: 'string', placeholder: 'cus_...' },
];

const stripeCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Secret Key', type: 'password', required: true, placeholder: 'sk_live_...' },
];

const githubParams: APIParameter[] = [
  { name: 'owner', displayName: 'Repository Owner', type: 'string', required: true, placeholder: 'facebook' },
  { name: 'repo', displayName: 'Repository Name', type: 'string', required: true, placeholder: 'react' },
  { name: 'field', displayName: 'Field to Extract', type: 'select', description: 'What repository metric to get?', options: [
    { label: 'Stars (stargazers_count)', value: 'stargazers_count' },
    { label: 'Forks', value: 'forks' },
    { label: 'Open Issues', value: 'open_issues_count' },
    { label: 'Watchers', value: 'watchers' },
  ], default: 'stargazers_count' },
];

const cronParams: APIParameter[] = [
  {
    name: 'schedule',
    displayName: 'Run At',
    type: 'select',
    required: true,
    default: 'daily_9am',
    description: 'Choose a human-readable schedule or pick "Custom" for a raw cron expression',
    options: [
      { label: 'Every minute', value: '* * * * *' },
      { label: 'Every 5 minutes', value: '*/5 * * * *' },
      { label: 'Every 15 minutes', value: '*/15 * * * *' },
      { label: 'Every 30 minutes', value: '*/30 * * * *' },
      { label: 'Every hour', value: '0 * * * *' },
      { label: 'Every 4 hours', value: '0 */4 * * *' },
      { label: 'Daily at 9 AM', value: '0 9 * * *' },
      { label: 'Daily at 12 PM (noon)', value: '0 12 * * *' },
      { label: 'Daily at 6 PM', value: '0 18 * * *' },
      { label: 'Daily at midnight', value: '0 0 * * *' },
      { label: 'Tonight at 8 PM', value: '0 20 * * *' },
      { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
      { label: 'Weekends at 10 AM', value: '0 10 * * 0,6' },
      { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
      { label: 'First of month at midnight', value: '0 0 1 * *' },
      { label: 'Custom', value: 'custom' },
    ],
  },
  {
    name: 'cron',
    displayName: 'Custom Cron Expression',
    type: 'string',
    placeholder: '0 9 * * *',
    description: 'Only used when "Run At" is set to Custom',
    help: 'Format: min hour day month dayOfWeek. Examples: "0 9 * * *" (9am daily), "0 */4 * * *" (every 4h)',
  },
  {
    name: 'timezone',
    displayName: 'Timezone',
    type: 'select',
    default: 'UTC',
    options: [
      { label: 'UTC', value: 'UTC' },
      { label: 'America/New_York (Eastern)', value: 'America/New_York' },
      { label: 'America/Chicago (Central)', value: 'America/Chicago' },
      { label: 'America/Denver (Mountain)', value: 'America/Denver' },
      { label: 'America/Los_Angeles (Pacific)', value: 'America/Los_Angeles' },
      { label: 'Europe/London', value: 'Europe/London' },
      { label: 'Europe/Paris', value: 'Europe/Paris' },
      { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
      { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
      { label: 'Australia/Sydney', value: 'Australia/Sydney' },
    ],
  },
];

const rssMonitorParams: APIParameter[] = [
  { name: 'feed_url', displayName: 'RSS Feed URL', type: 'url', required: true, placeholder: 'https://blog.example.com/feed.xml' },
  { name: 'poll_interval', displayName: 'Check Every', type: 'select', default: '300', options: [
    { label: '1 minute', value: '60' },
    { label: '5 minutes', value: '300' },
    { label: '15 minutes', value: '900' },
    { label: '30 minutes', value: '1800' },
    { label: '1 hour', value: '3600' },
  ]},
  { name: 'keyword_filter', displayName: 'Keyword Filter', type: 'string', placeholder: 'Optional keyword to match in titles' },
];

const newsapiParams: APIParameter[] = [
  { name: 'query', displayName: 'Search Query', type: 'string', required: true, placeholder: 'artificial intelligence' },
  { name: 'endpoint', displayName: 'Endpoint', type: 'select', default: 'everything', options: [
    { label: 'Everything', value: 'everything' },
    { label: 'Top Headlines', value: 'top-headlines' },
  ]},
  { name: 'language', displayName: 'Language', type: 'string', default: 'en', placeholder: 'en' },
  { name: 'sort_by', displayName: 'Sort By', type: 'select', default: 'publishedAt', options: [
    { label: 'Published At', value: 'publishedAt' },
    { label: 'Relevancy', value: 'relevancy' },
    { label: 'Popularity', value: 'popularity' },
  ]},
  { name: 'page_size', displayName: 'Page Size', type: 'number', default: 20 },
];

const descriptParams: APIParameter[] = [
  { name: 'project_id', displayName: 'Project ID', type: 'string', required: true, placeholder: 'proj_123' },
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, default: 'transcribe', options: [
    { label: 'Transcribe Audio', value: 'transcribe' },
    { label: 'Create Clip', value: 'create_clip' },
    { label: 'Export Project', value: 'export' },
  ]},
  { name: 'media_url', displayName: 'Media URL', type: 'url', placeholder: 'https://example.com/audio.mp3' },
  { name: 'transcript_format', displayName: 'Transcript Format', type: 'select', default: 'text', options: [
    { label: 'Plain Text', value: 'text' },
    { label: 'SRT', value: 'srt' },
    { label: 'VTT', value: 'vtt' },
    { label: 'JSON', value: 'json' },
  ]},
  { name: 'language', displayName: 'Language', type: 'string', default: 'en', placeholder: 'en' },
];

const gnewsParams: APIParameter[] = [
  { name: 'query', displayName: 'Search Query', type: 'string', required: true, placeholder: 'technology' },
  { name: 'language', displayName: 'Language', type: 'string', default: 'en', placeholder: 'en' },
  { name: 'country', displayName: 'Country', type: 'string', default: 'us', placeholder: 'us' },
  { name: 'max', displayName: 'Max Results', type: 'number', default: 10 },
];

const newEmailParams: APIParameter[] = [
  { name: 'mailbox', displayName: 'Mailbox / Folder', type: 'select', default: 'INBOX', options: [
    { label: 'Inbox', value: 'INBOX' },
    { label: 'Sent', value: 'Sent' },
    { label: 'All Mail', value: 'All Mail' },
  ]},
  { name: 'from_filter', displayName: 'From (filter)', type: 'email', placeholder: 'sender@example.com' },
  { name: 'subject_contains', displayName: 'Subject Contains', type: 'string', placeholder: 'invoice' },
  { name: 'poll_interval', displayName: 'Check Every', type: 'select', default: '300', options: [
    { label: '1 minute', value: '60' },
    { label: '5 minutes', value: '300' },
    { label: '15 minutes', value: '900' },
    { label: '1 hour', value: '3600' },
  ]},
];

const ftpMonitorParams: APIParameter[] = [
  { name: 'host', displayName: 'FTP Host', type: 'string', required: true, placeholder: 'ftp.example.com' },
  { name: 'port', displayName: 'Port', type: 'number', default: '21' },
  { name: 'username', displayName: 'Username', type: 'string', required: true, placeholder: 'ftp_user' },
  { name: 'password', displayName: 'Password', type: 'password', required: true },
  { name: 'watch_path', displayName: 'Watch Path', type: 'string', default: '/', placeholder: '/uploads/' },
  { name: 'poll_interval', displayName: 'Check Every', type: 'select', default: '300', options: [
    { label: '1 minute', value: '60' },
    { label: '5 minutes', value: '300' },
    { label: '15 minutes', value: '900' },
  ]},
];

const fileWatcherParams: APIParameter[] = [
  { name: 'watch_path', displayName: 'Watch Path', type: 'string', required: true, placeholder: '/data/uploads/' },
  { name: 'pattern', displayName: 'File Pattern', type: 'string', default: '*', placeholder: '*.csv, *.json' },
  { name: 'events', displayName: 'Watch For', type: 'select', default: 'created', options: [
    { label: 'File Created', value: 'created' },
    { label: 'File Modified', value: 'modified' },
    { label: 'File Deleted', value: 'deleted' },
    { label: 'Any Change', value: 'all' },
  ]},
  { name: 'recursive', displayName: 'Include Subfolders', type: 'boolean', default: 'true' },
];

const dbChangeParams: APIParameter[] = [
  { name: 'table', displayName: 'Table Name', type: 'string', required: true, placeholder: 'orders' },
  { name: 'event', displayName: 'Event Type', type: 'select', default: 'INSERT', options: [
    { label: 'Row Inserted', value: 'INSERT' },
    { label: 'Row Updated', value: 'UPDATE' },
    { label: 'Row Deleted', value: 'DELETE' },
    { label: 'Any Change', value: '*' },
  ]},
  { name: 'filter_column', displayName: 'Filter Column', type: 'string', placeholder: 'status (optional)' },
  { name: 'filter_value', displayName: 'Filter Value', type: 'string', placeholder: 'completed (optional)' },
];

const queueConsumerParams: APIParameter[] = [
  { name: 'queue_name', displayName: 'Queue / Topic Name', type: 'string', required: true, placeholder: 'my-task-queue' },
  { name: 'provider', displayName: 'Queue Provider', type: 'select', default: 'redis', options: [
    { label: 'Redis / BullMQ', value: 'redis' },
    { label: 'RabbitMQ', value: 'rabbitmq' },
    { label: 'AWS SQS', value: 'sqs' },
    { label: 'Google Pub/Sub', value: 'pubsub' },
  ]},
  { name: 'batch_size', displayName: 'Batch Size', type: 'number', default: '1' },
  { name: 'visibility_timeout', displayName: 'Visibility Timeout (s)', type: 'number', default: '30' },
];

const manualTriggerParams: APIParameter[] = [
  { name: 'label', displayName: 'Button Label', type: 'string', default: 'Run Pipeline', placeholder: 'Run Now' },
  { name: 'confirm', displayName: 'Require Confirmation', type: 'boolean', default: 'true' },
  { name: 'input_fields', displayName: 'Input Fields (JSON)', type: 'textarea', placeholder: '[{"name": "email", "type": "string"}]', help: 'Optional: define input fields that will be prompted when the pipeline is triggered manually' },
];

const discordParams: APIParameter[] = [
  { name: 'webhook_url', displayName: 'Webhook URL', type: 'url', description: 'Discord Webhook URL', required: true, placeholder: 'https://discord.com/api/webhooks/...' },
  { name: 'content', displayName: 'Message', type: 'textarea', description: 'Message text (max 2000 chars)', required: true, placeholder: 'Your message...' },
  { name: 'username', displayName: 'Bot Username', type: 'string', placeholder: 'My Bot' },
  { name: 'avatar_url', displayName: 'Avatar URL', type: 'url', placeholder: 'https://...' },
  { name: 'tts', displayName: 'Text-to-Speech', type: 'boolean', placeholder: 'Enable TTS' },
];

const googleChatParams: APIParameter[] = [
  { name: 'webhook_url', displayName: 'Webhook URL', type: 'url', required: true, placeholder: 'https://chat.googleapis.com/v1/spaces/...' },
  { name: 'text', displayName: 'Message Text', type: 'textarea', required: true, placeholder: 'Your message...' },
  { name: 'thread_key', displayName: 'Thread Key', type: 'string', placeholder: 'Keep messages in the same thread' },
  { name: 'cards_json', displayName: 'Cards Payload (JSON)', type: 'textarea', placeholder: '{"cards": [...]}' },
];

const zohoMailParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true, placeholder: 'recipient@example.com' },
  { name: 'from', displayName: 'From Email', type: 'email', required: true, placeholder: 'sender@example.com' },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true, placeholder: 'Hello from Zoho' },
  { name: 'content', displayName: 'HTML Content', type: 'textarea', required: true, placeholder: '<p>Hello</p>' },
  { name: 'cc', displayName: 'CC', type: 'string', placeholder: 'cc@example.com' },
  { name: 'bcc', displayName: 'BCC', type: 'string', placeholder: 'bcc@example.com' },
  { name: 'reply_to', displayName: 'Reply To', type: 'email', placeholder: 'reply@example.com' },
];

const iCloudMailParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true },
  { name: 'from', displayName: 'From Email', type: 'email', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'body', displayName: 'Message Body', type: 'textarea', required: true },
  { name: 'attach_url', displayName: 'Attachment URL', type: 'url' },
  { name: 'headers', displayName: 'Custom Headers (JSON)', type: 'textarea', placeholder: '{"X-Priority": "1"}' },
];

const yahooBusinessParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'html_body', displayName: 'HTML Body', type: 'textarea', required: true },
  { name: 'from', displayName: 'From Email', type: 'email', required: true },
  { name: 'cc', displayName: 'CC', type: 'string' },
  { name: 'bcc', displayName: 'BCC', type: 'string' },
];

const fastmailParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true, placeholder: 'recipient@example.com' },
  { name: 'from', displayName: 'From Email', type: 'email', required: true, placeholder: 'sender@example.com' },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true, placeholder: 'FastMail message subject' },
  { name: 'text', displayName: 'Text Body', type: 'textarea', placeholder: 'Plain text version' },
  { name: 'html', displayName: 'HTML Body', type: 'textarea', placeholder: '<p>Hello</p>' },
  { name: 'cc', displayName: 'CC', type: 'string', placeholder: 'cc@example.com' },
  { name: 'bcc', displayName: 'BCC', type: 'string', placeholder: 'bcc@example.com' },
  { name: 'reply_to', displayName: 'Reply To', type: 'email', placeholder: 'reply@example.com' },
  { name: 'attachments', displayName: 'Attachments (JSON)', type: 'textarea', placeholder: '[{"filename":"file.txt","content":"..."}]' },
];
const fastmailCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const mailchimpTransactionalParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true, placeholder: 'recipient@example.com' },
  { name: 'from_email', displayName: 'From Email', type: 'email', required: true, placeholder: 'sender@example.com' },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'text', displayName: 'Text Body', type: 'textarea', placeholder: 'Plain text message' },
  { name: 'html', displayName: 'HTML Body', type: 'textarea', placeholder: '<p>Email content</p>' },
  { name: 'cc', displayName: 'CC', type: 'string' },
  { name: 'bcc', displayName: 'BCC', type: 'string' },
  { name: 'reply_to', displayName: 'Reply To', type: 'email' },
  { name: 'headers', displayName: 'Headers (JSON)', type: 'textarea', placeholder: '{"X-Tag":"newsletter"}' },
  { name: 'tags', displayName: 'Tags', type: 'string', placeholder: 'monthly,important' },
];
const mailchimpTransactionalCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const lineParams: APIParameter[] = [
  { name: 'message', displayName: 'Message', type: 'textarea', required: true, placeholder: 'Hello from Line' },
  { name: 'to', displayName: 'Recipient ID', type: 'string', required: true, placeholder: 'U1234567890abcdef' },
  { name: 'notification_disabled', displayName: 'Disable Notification', type: 'boolean' },
];

const wechatParams: APIParameter[] = [
  { name: 'open_id', displayName: 'OpenID', type: 'string', required: true },
  { name: 'template_id', displayName: 'Template ID', type: 'string', placeholder: 'wx1234567890abcdef' },
  { name: 'data', displayName: 'Template Data (JSON)', type: 'textarea', required: true, placeholder: '{"first": {"value": "Hello"}}' },
];

const zulipParams: APIParameter[] = [
  { name: 'stream', displayName: 'Stream', type: 'string', required: true },
  { name: 'topic', displayName: 'Topic', type: 'string', required: true },
  { name: 'content', displayName: 'Message Content', type: 'textarea', required: true },
];

const mattermostParams: APIParameter[] = [
  { name: 'channel', displayName: 'Channel Name', type: 'string', required: true },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
  { name: 'props', displayName: 'Attachments/Props (JSON)', type: 'textarea' },
];

const rocketchatParams: APIParameter[] = [
  { name: 'channel', displayName: 'Channel', type: 'string', required: true },
  { name: 'text', displayName: 'Message', type: 'textarea', required: true },
  { name: 'alias', displayName: 'Alias', type: 'string' },
  { name: 'emoji', displayName: 'Emoji', type: 'string' },
];

const twistParams: APIParameter[] = [
  { name: 'thread_id', displayName: 'Thread ID', type: 'string', required: true },
  { name: 'content', displayName: 'Message Content', type: 'textarea', required: true },
];

const plivoParams: APIParameter[] = [
  { name: 'src', displayName: 'Source Number', type: 'string', required: true, placeholder: '+1234567890' },
  { name: 'dst', displayName: 'Destination Number', type: 'string', required: true, placeholder: '+1098765432' },
  { name: 'text', displayName: 'Message', type: 'textarea', required: true },
];

const sinchParams: APIParameter[] = [
  { name: 'from', displayName: 'From Number', type: 'string', required: true },
  { name: 'to', displayName: 'To Number', type: 'string', required: true },
  { name: 'message', displayName: 'Message Body', type: 'textarea', required: true },
];

const telnyxParams: APIParameter[] = [
  { name: 'from', displayName: 'From Number', type: 'string', required: true },
  { name: 'to', displayName: 'To Number', type: 'string', required: true },
  { name: 'body', displayName: 'SMS Body', type: 'textarea', required: true },
];

const fcmParams: APIParameter[] = [
  { name: 'topic', displayName: 'Topic', type: 'string', required: true },
  { name: 'title', displayName: 'Notification Title', type: 'string', required: true },
  { name: 'body', displayName: 'Notification Body', type: 'textarea', required: true },
  { name: 'data', displayName: 'Data Payload (JSON)', type: 'textarea' },
];

const oneSignalParams: APIParameter[] = [
  { name: 'app_id', displayName: 'App ID', type: 'string', required: true },
  { name: 'contents', displayName: 'Contents (JSON)', type: 'textarea', required: true, placeholder: '{"en":"Hello"}' },
  { name: 'included_segments', displayName: 'Included Segments', type: 'string', placeholder: 'Subscribed Users' },
];

const pusherParams: APIParameter[] = [
  { name: 'channel', displayName: 'Channel', type: 'string', required: true },
  { name: 'event', displayName: 'Event', type: 'string', required: true },
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea', required: true },
];

const simpleTextingParams: APIParameter[] = [
  { name: 'phone_number', displayName: 'Phone Number', type: 'string', required: true },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
];

const clickSendParams: APIParameter[] = [
  { name: 'to', displayName: 'Recipient', type: 'string', required: true },
  { name: 'body', displayName: 'Body', type: 'textarea', required: true },
];

const bandwidthParams: APIParameter[] = [
  { name: 'to', displayName: 'To Number', type: 'string', required: true },
  { name: 'from', displayName: 'From Number', type: 'string', required: true },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
];

const ringCentralParams: APIParameter[] = [
  { name: 'to', displayName: 'To Number', type: 'string', required: true },
  { name: 'from', displayName: 'From Number', type: 'string', required: true },
  { name: 'text', displayName: 'Text', type: 'textarea', required: true },
];

const googleMeetParams: APIParameter[] = [
  { name: 'meeting_title', displayName: 'Meeting Title', type: 'string', required: true },
  { name: 'start_time', displayName: 'Start Time', type: 'string', required: true, placeholder: '2025-01-01T10:00:00Z' },
  { name: 'duration_minutes', displayName: 'Duration (minutes)', type: 'number', default: 60 },
];

const teamsVideoParams: APIParameter[] = [
  { name: 'meeting_subject', displayName: 'Meeting Subject', type: 'string', required: true },
  { name: 'start_time', displayName: 'Start Time', type: 'string', required: true },
  { name: 'duration', displayName: 'Duration (minutes)', type: 'number', default: 60 },
];

const aroundParams: APIParameter[] = [
  { name: 'topic', displayName: 'Topic', type: 'string', required: true },
  { name: 'starts_at', displayName: 'Starts At', type: 'string', required: true, placeholder: '2025-01-01T10:00:00Z' },
];

const jitsiParams: APIParameter[] = [
  { name: 'room_name', displayName: 'Room Name', type: 'string', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string', placeholder: 'Meeting Subject' },
];

const demioParams: APIParameter[] = [
  { name: 'webinar_id', displayName: 'Webinar ID', type: 'string', required: true },
  { name: 'title', displayName: 'Title', type: 'string', required: true },
  { name: 'start_time', displayName: 'Start Time', type: 'string', required: true },
];

const livestormParams: APIParameter[] = [
  { name: 'event_name', displayName: 'Event Name', type: 'string', required: true },
  { name: 'scheduled_at', displayName: 'Scheduled At', type: 'string', required: true },
];

const riversideParams: APIParameter[] = [
  { name: 'recording_name', displayName: 'Recording Name', type: 'string', required: true },
  { name: 'template_id', displayName: 'Template ID', type: 'string', placeholder: 'Template identifier' },
];

const wherebyParams: APIParameter[] = [
  { name: 'room_name', displayName: 'Room Name', type: 'string', required: true },
  { name: 'start_time', displayName: 'Start Time', type: 'string', required: true },
];

const openRouterParams: APIParameter[] = [
  { name: 'model', displayName: 'Model', type: 'string', required: true, placeholder: 'gpt-4.1-mini' },
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
  { name: 'temperature', displayName: 'Temperature', type: 'number', default: 0.7 },
];

const perplexityParams: APIParameter[] = [
  { name: 'query', displayName: 'Query', type: 'textarea', required: true },
  { name: 'source', displayName: 'Source', type: 'string', placeholder: 'web' },
];

const togetherAIParams: APIParameter[] = [
  { name: 'model', displayName: 'Model', type: 'string', required: true, placeholder: 'together-gpt' },
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
];

const huggingFaceParams: APIParameter[] = [
  { name: 'model', displayName: 'Model', type: 'string', required: true, placeholder: 'gpt-4.1-mini' },
  { name: 'inputs', displayName: 'Inputs', type: 'textarea', required: true, placeholder: '{"text":"Hello"}' },
  { name: 'task', displayName: 'Task', type: 'string', placeholder: 'text-generation' },
  { name: 'parameters', displayName: 'Parameters (JSON)', type: 'textarea', placeholder: '{"max_new_tokens":50}' },
];
const huggingFaceCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const replicateParams: APIParameter[] = [
  { name: 'model', displayName: 'Model', type: 'string', required: true, placeholder: 'stability-ai/stable-diffusion-2' },
  { name: 'input', displayName: 'Input Payload (JSON)', type: 'textarea', required: true, placeholder: '{"prompt":"A sunny beach"}' },
  { name: 'version', displayName: 'Version', type: 'string', placeholder: 'Optional model version' },
];
const replicateCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const deepSeekParams: APIParameter[] = [
  { name: 'query', displayName: 'Search Query', type: 'textarea', required: true },
  { name: 'results', displayName: 'Result Count', type: 'number', default: 5 },
];

const midjourneyParams: APIParameter[] = [
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
  { name: 'style', displayName: 'Style', type: 'string', placeholder: 'photorealistic' },
];

const leonardoParams: APIParameter[] = [
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
  { name: 'canvas', displayName: 'Canvas Type', type: 'string', placeholder: 'illustration' },
];

const runwayParams: APIParameter[] = [
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
  { name: 'model', displayName: 'Model', type: 'string', placeholder: 'gen-2' },
];

const pikaParams: APIParameter[] = [
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
];

const fireflyParams: APIParameter[] = [
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
  { name: 'style', displayName: 'Style', type: 'string', placeholder: 'photo' },
];

const lumaParams: APIParameter[] = [
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
];

const splineParams: APIParameter[] = [
  { name: 'scene_name', displayName: 'Scene Name', type: 'string', required: true },
  { name: 'description', displayName: 'Description', type: 'textarea' },
];

const deepgramParams: APIParameter[] = [
  { name: 'audio_url', displayName: 'Audio URL', type: 'url', required: true },
  { name: 'language', displayName: 'Language', type: 'string', default: 'en' },
];

const revAiParams: APIParameter[] = [
  { name: 'audio_url', displayName: 'Audio URL', type: 'url', required: true },
  { name: 'language', displayName: 'Language', type: 'string', default: 'en' },
];

const murfParams: APIParameter[] = [
  { name: 'script', displayName: 'Script', type: 'textarea', required: true },
  { name: 'voice_id', displayName: 'Voice ID', type: 'string', placeholder: 'alloy' },
];

const playhtParams: APIParameter[] = [
  { name: 'text', displayName: 'Text', type: 'textarea', required: true },
  { name: 'voice', displayName: 'Voice', type: 'string', default: 'alloy' },
];

const whisperParams: APIParameter[] = [
  { name: 'audio_url', displayName: 'Audio URL', type: 'url', required: true },
  { name: 'model', displayName: 'Model', type: 'string', default: 'whisper-1' },
];

const sunoParams: APIParameter[] = [
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
];

const udioParams: APIParameter[] = [
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
];

const voicemodParams: APIParameter[] = [
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
  { name: 'voice', displayName: 'Voice', type: 'string' },
];

const notionParams: APIParameter[] = [
  { name: 'page_id', displayName: 'Page ID', type: 'string', required: true, placeholder: '123abc456def789...', description: 'Notion page or database ID' },
  { name: 'action', displayName: 'Action', type: 'select', required: true, default: 'append', options: [
    { label: 'Append Block', value: 'append' },
    { label: 'Update Page Properties', value: 'update' },
    { label: 'Create Database Entry', value: 'create_entry' },
  ]},
  { name: 'content', displayName: 'Content', type: 'textarea', required: true, placeholder: 'Content to add...' },
];

const notionCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'Internal Integration Token', type: 'password', required: true, placeholder: 'secret_...' },
];

const airtableParams: APIParameter[] = [
  { name: 'base_id', displayName: 'Base ID', type: 'string', required: true, placeholder: 'appXXXXXXXXXXXXXX' },
  { name: 'table_name', displayName: 'Table Name', type: 'string', required: true, placeholder: 'My Table' },
  { name: 'fields', displayName: 'Fields (JSON)', type: 'textarea', required: true, placeholder: '{"Name": "John", "Email": "john@example.com"}' },
];

const airtableCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'Personal Access Token', type: 'password', required: true, placeholder: 'pat...' },
];

const sendgridParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true, placeholder: 'recipient@example.com' },
  { name: 'from', displayName: 'From Email', type: 'email', required: true, placeholder: 'sender@example.com' },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true, placeholder: 'Hello!' },
  { name: 'body_html', displayName: 'HTML Body', type: 'textarea', required: true, placeholder: '<h1>Hello</h1>' },
  { name: 'cc', displayName: 'CC (comma-separated)', type: 'string', placeholder: 'cc@example.com' },
  { name: 'bcc', displayName: 'BCC (comma-separated)', type: 'string', placeholder: 'bcc@example.com' },
];

const sendgridCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true, placeholder: 'SG....' },
];

const webhookParams: APIParameter[] = [
  { name: 'url', displayName: 'Webhook URL', type: 'url', description: 'HTTP endpoint to POST data to', required: true, placeholder: 'https://api.example.com/webhook' },
  { name: 'method', displayName: 'HTTP Method', type: 'select', default: 'POST', options: [
    { label: 'POST', value: 'POST' },
    { label: 'PUT', value: 'PUT' },
    { label: 'PATCH', value: 'PATCH' },
    { label: 'GET', value: 'GET' },
  ]},
  { name: 'headers', displayName: 'Custom Headers (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer token", "X-Custom": "value"}' },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"event": "automation", "data": {...}}' },
];

// ============ EMAIL PROVIDERS ============
const resendParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true, placeholder: 'recipient@example.com' },
  { name: 'from', displayName: 'From Email', type: 'email', required: true, default: 'noreply@example.com' },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true, placeholder: 'Your subject' },
  { name: 'text', displayName: 'Plain Text Body', type: 'textarea', description: 'Optional plain text content', placeholder: 'Plain text version of the email' },
  { name: 'html', displayName: 'HTML Body', type: 'textarea', required: true, placeholder: '<p>Email content</p>' },
  { name: 'reply_to', displayName: 'Reply To', type: 'email', placeholder: 'support@example.com' },
  { name: 'cc', displayName: 'CC', type: 'string', placeholder: 'cc@example.com' },
  { name: 'bcc', displayName: 'BCC', type: 'string', placeholder: 'bcc@example.com' },
];
const resendCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true, placeholder: 're_...' },
];

const mailgunParams: APIParameter[] = [
  { name: 'to', displayName: 'To (recipient)', type: 'email', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'text', displayName: 'Text Body', type: 'textarea', required: true },
  { name: 'html', displayName: 'HTML Body', type: 'textarea' },
  { name: 'cc', displayName: 'CC', type: 'string' },
  { name: 'bcc', displayName: 'BCC', type: 'string' },
];
const mailgunCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
  { name: 'domain', displayName: 'Domain', type: 'string', required: true, placeholder: 'mail.example.com' },
];

const postmarkParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'html_body', displayName: 'HTML Body', type: 'textarea', required: true },
  { name: 'from', displayName: 'From Email', type: 'email', required: true },
  { name: 'reply_to', displayName: 'Reply To', type: 'email' },
];
const postmarkCredentials: APIParameter[] = [
  { name: 'auth_token', displayName: 'Server Token', type: 'password', required: true },
];

const gmailParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'message', displayName: 'Message Body', type: 'textarea', required: true },
  { name: 'cc', displayName: 'CC', type: 'string', placeholder: 'cc@example.com' },
  { name: 'bcc', displayName: 'BCC', type: 'string', placeholder: 'bcc@example.com' },
  { name: 'reply_to', displayName: 'Reply To', type: 'email', placeholder: 'reply@example.com' },
  { name: 'thread_id', displayName: 'Thread ID', type: 'string', placeholder: 'Existing thread ID for replies' },
  { name: 'attachments', displayName: 'Attachments (JSON)', type: 'textarea', placeholder: '[{"filename":"file.txt","content":"..."}]' },
];

const outlookParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'message', displayName: 'Message Body', type: 'textarea', required: true },
  { name: 'cc', displayName: 'CC', type: 'string', placeholder: 'cc@example.com' },
  { name: 'bcc', displayName: 'BCC', type: 'string', placeholder: 'bcc@example.com' },
  { name: 'reply_to', displayName: 'Reply To', type: 'email', placeholder: 'reply@example.com' },
  { name: 'importance', displayName: 'Importance', type: 'select', default: 'normal', options: [
    { label: 'Low', value: 'low' },
    { label: 'Normal', value: 'normal' },
    { label: 'High', value: 'high' },
  ]},
];

const brevoParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true, placeholder: 'recipient@example.com' },
  { name: 'from', displayName: 'From Email', type: 'email', required: true, placeholder: 'sender@example.com' },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true, placeholder: 'Hello!' },
  { name: 'text', displayName: 'Text Body', type: 'textarea', placeholder: 'Plain text version' },
  { name: 'html', displayName: 'HTML Body', type: 'textarea', placeholder: '<h1>Hello</h1>' },
  { name: 'cc', displayName: 'CC', type: 'string', placeholder: 'cc@example.com' },
  { name: 'bcc', displayName: 'BCC', type: 'string', placeholder: 'bcc@example.com' },
];
const brevoCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const mailjetParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true, placeholder: 'recipient@example.com' },
  { name: 'from', displayName: 'From Email', type: 'email', required: true, placeholder: 'sender@example.com' },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'text', displayName: 'Text Body', type: 'textarea', placeholder: 'Your message' },
  { name: 'html', displayName: 'HTML Body', type: 'textarea', placeholder: '<p>Email content</p>' },
];
const mailjetCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
  { name: 'api_secret', displayName: 'API Secret', type: 'password', required: true },
];

const protonmailParams: APIParameter[] = [
  { name: 'to', displayName: 'To Email', type: 'email', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'body', displayName: 'Message Body', type: 'textarea', required: true },
  { name: 'cc', displayName: 'CC', type: 'string' },
  { name: 'bcc', displayName: 'BCC', type: 'string' },
];
const protonmailCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const amazonsesParams: APIParameter[] = [
  { name: 'to_addresses', displayName: 'To Addresses (JSON)', type: 'textarea', required: true, placeholder: '["email1@example.com", "email2@example.com"]' },
  { name: 'source', displayName: 'From Email', type: 'email', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'html_body', displayName: 'HTML Body', type: 'textarea', required: true },
];
const amazonsesCredentials: APIParameter[] = [
  { name: 'access_key', displayName: 'Access Key ID', type: 'password', required: true },
  { name: 'secret_key', displayName: 'Secret Access Key', type: 'password', required: true },
  { name: 'region', displayName: 'Region', type: 'select', default: 'us-east-1', options: [
    { label: 'us-east-1', value: 'us-east-1' },
    { label: 'eu-west-1', value: 'eu-west-1' },
    { label: 'us-west-2', value: 'us-west-2' },
  ]},
];

const sparkpostParams: APIParameter[] = [
  { name: 'recipients', displayName: 'Recipients (JSON)', type: 'textarea', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'html', displayName: 'HTML Body', type: 'textarea', required: true },
  { name: 'from', displayName: 'From Email', type: 'email', required: true },
];
const sparkpostCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

// ============ TEAM CHAT & MESSAGING ============
const teamsParams: APIParameter[] = [
  { name: 'channel_id', displayName: 'Channel ID', type: 'string', required: true },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
  { name: 'is_important', displayName: 'Mark Important', type: 'boolean' },
];
const teamsCredentials: APIParameter[] = [
  { name: 'webhook_url', displayName: 'Webhook URL', type: 'url', required: true },
];

const telegramParams: APIParameter[] = [
  { name: 'chat_id', displayName: 'Chat ID', type: 'string', required: true },
  { name: 'text', displayName: 'Message Text', type: 'textarea', required: true },
  { name: 'parse_mode', displayName: 'Parse Mode', type: 'select', default: 'HTML', options: [
    { label: 'HTML', value: 'HTML' },
    { label: 'Markdown', value: 'Markdown' },
    { label: 'None', value: 'None' },
  ]},
];
const telegramCredentials: APIParameter[] = [
  { name: 'bot_token', displayName: 'Bot Token', type: 'password', required: true },
];

const whatsappParams: APIParameter[] = [
  { name: 'phone_number', displayName: 'Recipient Phone', type: 'string', required: true, placeholder: '+1234567890' },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
  { name: 'media_url', displayName: 'Media URL (optional)', type: 'url' },
];
const whatsappCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
  { name: 'phone_number_id', displayName: 'Phone Number ID', type: 'string', required: true },
];

const infobipParams: APIParameter[] = [
  { name: 'to', displayName: 'Recipient Number', type: 'string', required: true, placeholder: '+1234567890' },
  { name: 'from', displayName: 'Sender Name or Number', type: 'string', required: true, placeholder: 'MyApp' },
  { name: 'text', displayName: 'Message Body', type: 'textarea', required: true },
  { name: 'type', displayName: 'Message Type', type: 'select', default: 'sms', options: [
    { label: 'SMS', value: 'sms' },
    { label: 'MMS', value: 'mms' },
  ] },
  { name: 'callback_data', displayName: 'Callback Data', type: 'string', placeholder: 'Optional tracking payload' },
];
const infobipCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

// ============ SMS & VOICE ============
const messagebirdParams: APIParameter[] = [
  { name: 'recipients', displayName: 'Recipients (comma-separated)', type: 'string', required: true },
  { name: 'body', displayName: 'Message Body', type: 'textarea', required: true },
];
const messagebirdCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const vonageParams: APIParameter[] = [
  { name: 'to', displayName: 'To Number', type: 'string', required: true },
  { name: 'text', displayName: 'Message', type: 'textarea', required: true },
  { name: 'from', displayName: 'From Name/Number', type: 'string', required: true },
];
const vonageCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
  { name: 'api_secret', displayName: 'API Secret', type: 'password', required: true },
];

// ============ VIDEO CONFERENCING ============
const zoomParams: APIParameter[] = [
  { name: 'topic', displayName: 'Meeting Topic', type: 'string', required: true },
  { name: 'start_time', displayName: 'Start Time', type: 'string', required: true, placeholder: '2024-01-15T10:00:00Z' },
  { name: 'duration', displayName: 'Duration (minutes)', type: 'number', required: true, default: 60 },
  { name: 'password', displayName: 'Meeting Password', type: 'password' },
];
const zoomCredentials: APIParameter[] = [
  { name: 'client_id', displayName: 'Client ID', type: 'password', required: true },
  { name: 'client_secret', displayName: 'Client Secret', type: 'password', required: true },
];

const webexParams: APIParameter[] = [
  { name: 'title', displayName: 'Meeting Title', type: 'string', required: true },
  { name: 'start_time', displayName: 'Start Time (ISO 8601)', type: 'string', required: true },
  { name: 'end_time', displayName: 'End Time (ISO 8601)', type: 'string', required: true },
  { name: 'password', displayName: 'Participant Password', type: 'password' },
];
const webexCredentials: APIParameter[] = [
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

// ============ AI & ML PROVIDERS ============
const anthropicParams: APIParameter[] = [
  { name: 'model', displayName: 'Model', type: 'select', required: true, default: 'claude-opus', options: [
    { label: 'Claude Opus', value: 'claude-opus' },
    { label: 'Claude Sonnet 3', value: 'claude-3-sonnet' },
    { label: 'Claude Haiku', value: 'claude-3-haiku' },
  ]},
  { name: 'system_prompt', displayName: 'System Prompt', type: 'textarea', required: true },
  { name: 'user_message', displayName: 'User Message', type: 'textarea', required: true },
  { name: 'max_tokens', displayName: 'Max Tokens', type: 'number', default: 1024 },
];
const anthropicCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const googlegeminiParams: APIParameter[] = [
  { name: 'model', displayName: 'Model', type: 'select', required: true, default: 'gemini-pro', options: [
    { label: 'Gemini Pro', value: 'gemini-pro' },
    { label: 'Gemini Pro Vision', value: 'gemini-pro-vision' },
  ]},
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
  { name: 'temperature', displayName: 'Temperature', type: 'number', default: 0.7, description: '0-2, higher = more creative' },
];
const googlegeminiCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const mistralParams: APIParameter[] = [
  { name: 'model', displayName: 'Model', type: 'select', required: true, options: [
    { label: 'Mistral Large', value: 'mistral-large' },
    { label: 'Mistral Medium', value: 'mistral-medium' },
    { label: 'Mistral Small', value: 'mistral-small' },
  ]},
  { name: 'messages', displayName: 'Messages (JSON)', type: 'textarea', required: true },
  { name: 'max_tokens', displayName: 'Max Tokens', type: 'number', default: 1024 },
];
const mistralCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const groqParams: APIParameter[] = [
  { name: 'model', displayName: 'Model', type: 'string', required: true, default: 'mixtral-8x7b-32768' },
  { name: 'messages', displayName: 'Messages (JSON)', type: 'textarea', required: true },
  { name: 'temperature', displayName: 'Temperature', type: 'number', default: 0.7 },
];
const groqCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const cohereParams: APIParameter[] = [
  { name: 'model', displayName: 'Model', type: 'select', required: true, default: 'command', options: [
    { label: 'Command', value: 'command' },
    { label: 'Command Light', value: 'command-light' },
    { label: 'Command Nightly', value: 'command-nightly' },
  ]},
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
  { name: 'max_tokens', displayName: 'Max Tokens', type: 'number', default: 256 },
];
const cohereCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

// ============ IMAGE & VIDEO GENERATION ============
const dalleParams: APIParameter[] = [
  { name: 'prompt', displayName: 'Image Prompt', type: 'textarea', required: true, placeholder: 'A serene landscape...' },
  { name: 'n', displayName: 'Number of Images', type: 'number', default: 1, description: '1-10' },
  { name: 'size', displayName: 'Image Size', type: 'select', default: '1024x1024', options: [
    { label: '256x256', value: '256x256' },
    { label: '512x512', value: '512x512' },
    { label: '1024x1024', value: '1024x1024' },
  ]},
  { name: 'quality', displayName: 'Quality', type: 'select', default: 'standard', options: [
    { label: 'Standard', value: 'standard' },
    { label: 'HD', value: 'hd' },
  ]},
];

const stableParams: APIParameter[] = [
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
  { name: 'negative_prompt', displayName: 'Negative Prompt', type: 'textarea' },
  { name: 'num_inference_steps', displayName: 'Steps', type: 'number', default: 50 },
  { name: 'guidance_scale', displayName: 'Guidance Scale', type: 'number', default: 7.5 },
];

const heygenParams: APIParameter[] = [
  { name: 'video_script', displayName: 'Script/Prompt', type: 'textarea', required: true },
  { name: 'avatar_id', displayName: 'Avatar ID', type: 'string', required: true },
  { name: 'background_id', displayName: 'Background ID', type: 'string' },
];
const heygenCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

// ============ AUDIO & VOICE ============
const elevenLabsParams: APIParameter[] = [
  { name: 'text', displayName: 'Text to Synthesize', type: 'textarea', required: true },
  { name: 'voice_id', displayName: 'Voice ID', type: 'select', required: true, options: [
    { label: 'Rachel', value: '21m00Tcm4TlvDq8ikWAM' },
    { label: 'Clyde', value: '2EiwWnXFnvU5JabPnv94' },
    { label: 'Domi', value: 'AZnzlk1xuWj5Mu32vLCC' },
    { label: 'Bella', value: 'EXAVITQu4vr4xnSDxMaL' },
  ]},
  { name: 'model_id', displayName: 'Model', type: 'select', default: 'eleven_monolingual_v1', options: [
    { label: 'Multilingual v1', value: 'eleven_multilingual_v1' },
    { label: 'Monolingual v1', value: 'eleven_monolingual_v1' },
  ]},
  { name: 'stability', displayName: 'Stability', type: 'number', default: 0.5, description: '0-1' },
];
const elevenLabsCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const assemblyaiParams: APIParameter[] = [
  { name: 'audio_url', displayName: 'Audio URL', type: 'url', required: true },
  { name: 'language_code', displayName: 'Language', type: 'string', default: 'en', placeholder: 'en, es, fr...' },
];
const assemblyaiCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

// ============ DATABASE & PERSISTENCE ============
const mongoParams: APIParameter[] = [
  { name: 'database', displayName: 'Database Name', type: 'string', required: true },
  { name: 'collection', displayName: 'Collection Name', type: 'string', required: true },
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, options: [
    { label: 'Insert One', value: 'insertOne' },
    { label: 'Insert Many', value: 'insertMany' },
    { label: 'Find', value: 'find' },
    { label: 'Update', value: 'updateOne' },
    { label: 'Delete', value: 'deleteOne' },
  ]},
  { name: 'document', displayName: 'Document/Query (JSON)', type: 'textarea', required: true },
];
const mongoCredentials: APIParameter[] = [
  { name: 'connection_string', displayName: 'Connection String', type: 'password', required: true, placeholder: 'mongodb+srv://...' },
];

const firebaseParams: APIParameter[] = [
  { name: 'collection', displayName: 'Collection', type: 'string', required: true },
  { name: 'document_id', displayName: 'Document ID (optional)', type: 'string' },
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, options: [
    { label: 'Add', value: 'add' },
    { label: 'Set', value: 'set' },
    { label: 'Update', value: 'update' },
    { label: 'Delete', value: 'delete' },
    { label: 'Get', value: 'get' },
  ]},
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea', required: true },
];
const firebaseCredentials: APIParameter[] = [
  { name: 'service_account_json', displayName: 'Service Account JSON', type: 'textarea', required: true },
];

const supabaseParams: APIParameter[] = [
  { name: 'table', displayName: 'Table Name', type: 'string', required: true },
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, options: [
    { label: 'Insert', value: 'insert' },
    { label: 'Select', value: 'select' },
    { label: 'Update', value: 'update' },
    { label: 'Delete', value: 'delete' },
  ]},
  { name: 'data', displayName: 'Data/Filter (JSON)', type: 'textarea' },
];
const supabaseCredentials: APIParameter[] = [
  { name: 'url', displayName: 'Supabase URL', type: 'url', required: true },
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const redisParams: APIParameter[] = [
  { name: 'command', displayName: 'Redis Command', type: 'select', required: true, options: [
    { label: 'GET', value: 'GET' },
    { label: 'SET', value: 'SET' },
    { label: 'DEL', value: 'DEL' },
    { label: 'LPUSH', value: 'LPUSH' },
    { label: 'RPOP', value: 'RPOP' },
  ]},
  { name: 'key', displayName: 'Key', type: 'string', required: true },
  { name: 'value', displayName: 'Value (if applicable)', type: 'string' },
];
const redisCredentials: APIParameter[] = [
  { name: 'connection_url', displayName: 'Connection URL', type: 'url', required: true, placeholder: 'redis://...' },
];

// ============ CLOUD STORAGE ============
const googledriveParams: APIParameter[] = [
  { name: 'folder_id', displayName: 'Folder ID', type: 'string', placeholder: 'Parent folder ID (optional)' },
  { name: 'file_name', displayName: 'File Name', type: 'string', required: true },
  { name: 'file_content', displayName: 'File Content', type: 'textarea' },
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, options: [
    { label: 'Upload', value: 'upload' },
    { label: 'List Files', value: 'list' },
    { label: 'Delete', value: 'delete' },
  ]},
];
const googledriveCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const s3Params: APIParameter[] = [
  { name: 'bucket', displayName: 'Bucket Name', type: 'string', required: true },
  { name: 'key', displayName: 'Object Key', type: 'string', required: true },
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, options: [
    { label: 'Upload', value: 'PutObject' },
    { label: 'Download', value: 'GetObject' },
    { label: 'Delete', value: 'DeleteObject' },
    { label: 'List', value: 'ListObjects' },
  ]},
  { name: 'file_content', displayName: 'File Content (for upload)', type: 'textarea' },
];
const s3Credentials: APIParameter[] = [
  { name: 'access_key_id', displayName: 'Access Key ID', type: 'password', required: true },
  { name: 'secret_access_key', displayName: 'Secret Access Key', type: 'password', required: true },
  { name: 'region', displayName: 'Region', type: 'string', required: true, default: 'us-east-1' },
];

const cloudinaryParams: APIParameter[] = [
  { name: 'file_url', displayName: 'File URL', type: 'url', required: true },
  { name: 'public_id', displayName: 'Public ID (optional)', type: 'string', placeholder: 'folder/image' },
  { name: 'transformation', displayName: 'Transformation (optional)', type: 'string', placeholder: 'w_400,h_300,c_fill' },
];
const cloudinaryCredentials: APIParameter[] = [
  { name: 'cloud_name', displayName: 'Cloud Name', type: 'string', required: true },
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
  { name: 'api_secret', displayName: 'API Secret', type: 'password', required: true },
];

const dropboxParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Upload File', value: 'upload' },
    { label: 'Download File', value: 'download' },
    { label: 'Delete File', value: 'delete' },
    { label: 'List Folder', value: 'list' },
  ]},
  { name: 'path', displayName: 'File / Folder Path', type: 'string', required: true, placeholder: '/Apps/MyApp/file.txt' },
  { name: 'file_content', displayName: 'File Content', type: 'textarea' },
];
const boxParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Upload File', value: 'upload' },
    { label: 'Download File', value: 'download' },
    { label: 'Create Folder', value: 'createFolder' },
  ]},
  { name: 'folder_path', displayName: 'Folder Path', type: 'string', required: true, placeholder: '/Apps/MyApp' },
  { name: 'file_name', displayName: 'File Name', type: 'string' },
  { name: 'file_content', displayName: 'File Content', type: 'textarea' },
];
const oneDriveParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Upload File', value: 'upload' },
    { label: 'Download File', value: 'download' },
    { label: 'Delete File', value: 'delete' },
    { label: 'List Folder', value: 'list' },
  ]},
  { name: 'path', displayName: 'File / Folder Path', type: 'string', required: true, placeholder: '/Documents/report.pdf' },
  { name: 'file_content', displayName: 'File Content', type: 'textarea' },
];
const googleCloudStorageParams: APIParameter[] = [
  { name: 'bucket', displayName: 'Bucket Name', type: 'string', required: true },
  { name: 'object_name', displayName: 'Object Name', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Upload Object', value: 'upload' },
    { label: 'Download Object', value: 'download' },
    { label: 'Delete Object', value: 'delete' },
    { label: 'List Objects', value: 'list' },
  ]},
  { name: 'content', displayName: 'Content', type: 'textarea' },
];
const azureBlobParams: APIParameter[] = [
  { name: 'container', displayName: 'Container Name', type: 'string', required: true },
  { name: 'blob_name', displayName: 'Blob Name', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Upload Blob', value: 'upload' },
    { label: 'Download Blob', value: 'download' },
    { label: 'Delete Blob', value: 'delete' },
    { label: 'List Blobs', value: 'list' },
  ]},
  { name: 'content', displayName: 'Content', type: 'textarea' },
];
const backblazeB2Params: APIParameter[] = [
  { name: 'bucket_id', displayName: 'Bucket ID', type: 'string', required: true },
  { name: 'file_name', displayName: 'File Name', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Upload File', value: 'upload' },
    { label: 'Download File', value: 'download' },
    { label: 'Delete File', value: 'delete' },
  ]},
  { name: 'file_content', displayName: 'File Content', type: 'textarea' },
];
const pCloudParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Upload File', value: 'upload' },
    { label: 'Download File', value: 'download' },
    { label: 'Delete File', value: 'delete' },
    { label: 'List Folder', value: 'list' },
  ]},
  { name: 'path', displayName: 'Path', type: 'string', required: true, placeholder: '/Documents/report.docx' },
  { name: 'file_content', displayName: 'File Content', type: 'textarea' },
];
const imageKitParams: APIParameter[] = [
  { name: 'image_url', displayName: 'Image URL', type: 'url', required: true },
  { name: 'transformation', displayName: 'Transformation', type: 'string', placeholder: 'w-400,h-300,c-scale' },
  { name: 'folder', displayName: 'Folder', type: 'string', placeholder: '/images' },
];

const excelOnlineParams: APIParameter[] = [
  { name: 'workbook_id', displayName: 'Workbook ID', type: 'string', required: true },
  { name: 'worksheet_name', displayName: 'Worksheet Name', type: 'string', required: true },
  { name: 'range', displayName: 'Range', type: 'string', placeholder: 'A1:D10' },
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, options: [
    { label: 'Read', value: 'read' },
    { label: 'Write', value: 'write' },
    { label: 'Append', value: 'append' },
    { label: 'Clear', value: 'clear' },
  ]},
  { name: 'values', displayName: 'Values (JSON)', type: 'textarea', placeholder: '[ ["A", "B"], ["C", "D"] ]' },
];
const smartsheetParams: APIParameter[] = [
  { name: 'sheet_id', displayName: 'Sheet ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Add Row', value: 'addRow' },
    { label: 'Update Row', value: 'updateRow' },
    { label: 'List Rows', value: 'listRows' },
  ]},
  { name: 'row_data', displayName: 'Row Data (JSON)', type: 'textarea', placeholder: '[{"columnId": 123, "value": "Hello"}]' },
];
const codaParams: APIParameter[] = [
  { name: 'doc_id', displayName: 'Doc ID', type: 'string', required: true },
  { name: 'table_id', displayName: 'Table ID', type: 'string', required: true },
  { name: 'row_data', displayName: 'Row Data (JSON)', type: 'textarea', required: true },
];
const baserowParams: APIParameter[] = [
  { name: 'base_id', displayName: 'Base ID', type: 'string', required: true },
  { name: 'table_id', displayName: 'Table ID', type: 'string', required: true },
  { name: 'row_data', displayName: 'Row Data (JSON)', type: 'textarea', required: true },
];
const seaTableParams: APIParameter[] = [
  { name: 'table_name', displayName: 'Table Name', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Add Row', value: 'addRow' },
    { label: 'Update Row', value: 'updateRow' },
    { label: 'Delete Row', value: 'deleteRow' },
  ]},
  { name: 'row_data', displayName: 'Row Data (JSON)', type: 'textarea', required: true },
];
const gristParams: APIParameter[] = [
  { name: 'doc_id', displayName: 'Doc ID', type: 'string', required: true },
  { name: 'table_name', displayName: 'Table Name', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Add Record', value: 'addRecord' },
    { label: 'Update Record', value: 'updateRecord' },
    { label: 'List Records', value: 'listRecords' },
  ]},
  { name: 'record_data', displayName: 'Record Data (JSON)', type: 'textarea' },
];

// ============ SPREADSHEETS ============
const googlesheetParams: APIParameter[] = [
  { name: 'spreadsheet_id', displayName: 'Spreadsheet ID', type: 'string', required: true },
  { name: 'sheet_name', displayName: 'Sheet Name', type: 'string', required: true, default: 'Sheet1' },
  { name: 'range', displayName: 'Range (e.g. A1:D10)', type: 'string' },
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, options: [
    { label: 'Read', value: 'read' },
    { label: 'Write', value: 'write' },
    { label: 'Append', value: 'append' },
    { label: 'Clear', value: 'clear' },
  ]},
  { name: 'values', displayName: 'Values (JSON array)', type: 'textarea' },
];

// ============ CI/CD & GIT ============
const gitlabParams: APIParameter[] = [
  { name: 'project_id', displayName: 'Project ID', type: 'string', required: true },
  { name: 'branch', displayName: 'Branch', type: 'string', required: true, default: 'main' },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Issue', value: 'createIssue' },
    { label: 'Create Merge Request', value: 'createMR' },
    { label: 'List Commits', value: 'listCommits' },
  ]},
  { name: 'title', displayName: 'Title', type: 'string' },
  { name: 'description', displayName: 'Description', type: 'textarea' },
];
const gitlabCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Personal Access Token', type: 'password', required: true },
  { name: 'base_url', displayName: 'GitLab Base URL', type: 'url', default: 'https://gitlab.com' },
];

const bitbucketParams: APIParameter[] = [
  { name: 'workspace', displayName: 'Workspace', type: 'string', required: true },
  { name: 'repo_slug', displayName: 'Repository Slug', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'List Issues', value: 'listIssues' },
    { label: 'Create Issue', value: 'createIssue' },
    { label: 'List PRs', value: 'listPRs' },
  ]},
  { name: 'title', displayName: 'Title', type: 'string' },
  { name: 'description', displayName: 'Description', type: 'textarea' },
];
const bitbucketCredentials: APIParameter[] = [
  { name: 'username', displayName: 'Username', type: 'string', required: true },
  { name: 'app_password', displayName: 'App Password', type: 'password', required: true },
];

const circleciParams: APIParameter[] = [
  { name: 'project_slug', displayName: 'Project Slug', type: 'string', required: true, placeholder: 'github/owner/repo' },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Trigger Pipeline', value: 'triggerPipeline' },
    { label: 'List Workflows', value: 'listWorkflows' },
    { label: 'Get Artifacts', value: 'getArtifacts' },
  ]},
  { name: 'branch', displayName: 'Branch', type: 'string', default: 'main' },
];
const circleciCredentials: APIParameter[] = [
  { name: 'api_token', displayName: 'Personal API Token', type: 'password', required: true },
];

const jenkinsParams: APIParameter[] = [
  { name: 'job_name', displayName: 'Job Name', type: 'string', required: true },
  { name: 'parameters', displayName: 'Build Parameters (JSON)', type: 'textarea' },
];
const jenkinsCredentials: APIParameter[] = [
  { name: 'base_url', displayName: 'Jenkins URL', type: 'url', required: true },
  { name: 'username', displayName: 'Username', type: 'string', required: true },
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

// ============ MONITORING ============
const sentryParams: APIParameter[] = [
  { name: 'organization_slug', displayName: 'Organization Slug', type: 'string', required: true },
  { name: 'project_slug', displayName: 'Project Slug', type: 'string', required: true },
  { name: 'environment', displayName: 'Environment', type: 'select', default: 'production', options: [
    { label: 'Production', value: 'production' },
    { label: 'Staging', value: 'staging' },
    { label: 'Development', value: 'development' },
  ]},
];
const sentryCredentials: APIParameter[] = [
  { name: 'auth_token', displayName: 'Auth Token', type: 'password', required: true },
];

const datadogParams: APIParameter[] = [
  { name: 'metric_name', displayName: 'Metric Name', type: 'string', required: true, placeholder: 'custom.metric' },
  { name: 'value', displayName: 'Value', type: 'number', required: true },
  { name: 'tags', displayName: 'Tags (comma-separated)', type: 'string', placeholder: 'env:prod,service:api' },
];
const datadogCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
  { name: 'app_key', displayName: 'App Key', type: 'password', required: true },
  { name: 'site', displayName: 'Site', type: 'select', default: 'datadoghq.com', options: [
    { label: 'US', value: 'datadoghq.com' },
    { label: 'EU', value: 'datadoghq.eu' },
  ]},
];

// ============ PAYMENTS ============
const paypalParams: APIParameter[] = [
  { name: 'amount', displayName: 'Amount', type: 'number', required: true },
  { name: 'currency', displayName: 'Currency', type: 'select', default: 'USD', options: [
    { label: 'USD', value: 'USD' },
    { label: 'EUR', value: 'EUR' },
    { label: 'GBP', value: 'GBP' },
  ]},
  { name: 'description', displayName: 'Description', type: 'string', required: true },
  { name: 'return_url', displayName: 'Return URL', type: 'url', required: true },
];
const paypalCredentials: APIParameter[] = [
  { name: 'client_id', displayName: 'Client ID', type: 'password', required: true },
  { name: 'client_secret', displayName: 'Client Secret', type: 'password', required: true },
];

const squareParams: APIParameter[] = [
  { name: 'amount_money', displayName: 'Amount (cents)', type: 'number', required: true },
  { name: 'currency', displayName: 'Currency', type: 'string', default: 'USD' },
  { name: 'source_id', displayName: 'Payment Source ID', type: 'string', required: true },
];
const squareCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
  { name: 'location_id', displayName: 'Location ID', type: 'string', required: true },
];

// ============ ECOMMERCE ============
const shopifyParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Get Orders', value: 'getOrders' },
    { label: 'Create Product', value: 'createProduct' },
    { label: 'Update Product', value: 'updateProduct' },
    { label: 'Get Customers', value: 'getCustomers' },
  ]},
  { name: 'product_data', displayName: 'Product Data (JSON)', type: 'textarea' },
  { name: 'query', displayName: 'Query/Filter', type: 'string' },
];
const shopifyCredentials: APIParameter[] = [
  { name: 'shop_name', displayName: 'Shop Name', type: 'string', required: true },
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const woocommerceParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'List Products', value: 'listProducts' },
    { label: 'Create Product', value: 'createProduct' },
    { label: 'List Orders', value: 'listOrders' },
  ]},
  { name: 'product_data', displayName: 'Product Data (JSON)', type: 'textarea' },
];
const woocommerceCredentials: APIParameter[] = [
  { name: 'consumer_key', displayName: 'Consumer Key', type: 'password', required: true },
  { name: 'consumer_secret', displayName: 'Consumer Secret', type: 'password', required: true },
  { name: 'site_url', displayName: 'Store URL', type: 'url', required: true },
];

// ============ CRM & SALES ============
const salesforceParams: APIParameter[] = [
  { name: 'sobject', displayName: 'Object Type', type: 'select', required: true, options: [
    { label: 'Account', value: 'Account' },
    { label: 'Contact', value: 'Contact' },
    { label: 'Opportunity', value: 'Opportunity' },
    { label: 'Lead', value: 'Lead' },
  ]},
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create', value: 'create' },
    { label: 'Read', value: 'read' },
    { label: 'Update', value: 'update' },
    { label: 'Delete', value: 'delete' },
  ]},
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea' },
];
const salesforceCredentials: APIParameter[] = [
  { name: 'instance_url', displayName: 'Instance URL', type: 'url', required: true },
  { name: 'client_id', displayName: 'Client ID', type: 'password', required: true },
  { name: 'client_secret', displayName: 'Client Secret', type: 'password', required: true },
];

const hubspotParams: APIParameter[] = [
  { name: 'object_type', displayName: 'Object Type', type: 'select', required: true, options: [
    { label: 'Contact', value: 'contact' },
    { label: 'Company', value: 'company' },
    { label: 'Deal', value: 'deal' },
  ]},
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create', value: 'create' },
    { label: 'Update', value: 'update' },
    { label: 'List', value: 'list' },
  ]},
  { name: 'properties', displayName: 'Properties (JSON)', type: 'textarea', required: true },
];
const hubspotCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const pipedriveParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Add Person', value: 'addPerson' },
    { label: 'Add Deal', value: 'addDeal' },
    { label: 'Update Deal', value: 'updateDeal' },
    { label: 'List Deals', value: 'listDeals' },
  ]},
  { name: 'data', displayName: 'Record Data (JSON)', type: 'textarea' },
];
const pipedriveCredentials: APIParameter[] = [
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
  { name: 'company_domain', displayName: 'Company Domain', type: 'string', required: true },
];

// ============ TASK & PROJECT MANAGEMENT ============
const asanaParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Task', value: 'createTask' },
    { label: 'Update Task', value: 'updateTask' },
    { label: 'List Tasks', value: 'listTasks' },
    { label: 'Complete Task', value: 'completeTask' },
  ]},
  { name: 'project_id', displayName: 'Project ID', type: 'string', required: true },
  { name: 'task_data', displayName: 'Task Data (JSON)', type: 'textarea' },
];
const asanaCredentials: APIParameter[] = [
  { name: 'api_token', displayName: 'Personal Access Token', type: 'password', required: true },
];

const trelloParams: APIParameter[] = [
  { name: 'board_id', displayName: 'Board ID', type: 'string', required: true },
  { name: 'list_id', displayName: 'List ID', type: 'string' },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Card', value: 'createCard' },
    { label: 'Update Card', value: 'updateCard' },
    { label: 'List Cards', value: 'listCards' },
  ]},
  { name: 'card_data', displayName: 'Card Data (JSON)', type: 'textarea' },
];
const trelloCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

const jiraParams: APIParameter[] = [
  { name: 'project_key', displayName: 'Project Key', type: 'string', required: true },
  { name: 'issue_type', displayName: 'Issue Type', type: 'select', required: true, options: [
    { label: 'Bug', value: 'Bug' },
    { label: 'Task', value: 'Task' },
    { label: 'Story', value: 'Story' },
    { label: 'Feature', value: 'Feature' },
  ]},
  { name: 'summary', displayName: 'Summary', type: 'string', required: true },
  { name: 'description', displayName: 'Description', type: 'textarea' },
];
const jiraCredentials: APIParameter[] = [
  { name: 'instance_url', displayName: 'Jira URL', type: 'url', required: true },
  { name: 'email', displayName: 'Email', type: 'email', required: true },
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

const linearParams: APIParameter[] = [
  { name: 'team_key', displayName: 'Team Key', type: 'string', required: true },
  { name: 'title', displayName: 'Issue Title', type: 'string', required: true },
  { name: 'description', displayName: 'Description', type: 'textarea' },
  { name: 'priority', displayName: 'Priority', type: 'select', options: [
    { label: 'Urgent', value: '4' },
    { label: 'High', value: '3' },
    { label: 'Medium', value: '2' },
    { label: 'Low', value: '1' },
  ]},
];
const linearCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const clickupParams: APIParameter[] = [
  { name: 'list_id', displayName: 'List ID', type: 'string', required: true },
  { name: 'task_title', displayName: 'Task Title', type: 'string', required: true },
  { name: 'description', displayName: 'Description', type: 'textarea' },
  { name: 'priority', displayName: 'Priority', type: 'number', description: '1-5' },
];
const clickupCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

// ============ HELP DESK & SUPPORT ============
const zendeskParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Ticket', value: 'createTicket' },
    { label: 'Update Ticket', value: 'updateTicket' },
    { label: 'List Tickets', value: 'listTickets' },
  ]},
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'description', displayName: 'Description', type: 'textarea', required: true },
  { name: 'priority', displayName: 'Priority', type: 'select', options: [
    { label: 'Low', value: 'low' },
    { label: 'Normal', value: 'normal' },
    { label: 'High', value: 'high' },
    { label: 'Urgent', value: 'urgent' },
  ]},
];
const zendeskCredentials: APIParameter[] = [
  { name: 'subdomain', displayName: 'Subdomain', type: 'string', required: true },
  { name: 'email', displayName: 'Email', type: 'email', required: true },
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

const intercomParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Contact', value: 'createContact' },
    { label: 'Send Message', value: 'sendMessage' },
    { label: 'Create Ticket', value: 'createTicket' },
  ]},
  { name: 'email', displayName: 'Email', type: 'email', required: true },
  { name: 'message', displayName: 'Message', type: 'textarea' },
];
const intercomCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

// ============ SURVEYS & FORMS ============
const typeformParams: APIParameter[] = [
  { name: 'form_id', displayName: 'Form ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Get Responses', value: 'getResponses' },
    { label: 'Create Webhook', value: 'createWebhook' },
  ]},
];
const typeformCredentials: APIParameter[] = [
  { name: 'api_token', displayName: 'Personal Access Token', type: 'password', required: true },
];

const helpScoutParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Conversation', value: 'createConversation' },
    { label: 'Add Note', value: 'addNote' },
    { label: 'Send Reply', value: 'sendReply' },
  ]},
  { name: 'customer_email', displayName: 'Customer Email', type: 'email' },
  { name: 'subject', displayName: 'Subject', type: 'string' },
  { name: 'message', displayName: 'Message', type: 'textarea' },
];
const helpScoutCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const frontParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Conversation', value: 'createConversation' },
    { label: 'Send Reply', value: 'sendReply' },
  ]},
  { name: 'subject', displayName: 'Subject', type: 'string' },
  { name: 'message', displayName: 'Message', type: 'textarea' },
  { name: 'recipient_email', displayName: 'Recipient Email', type: 'email' },
];
const frontCredentials: APIParameter[] = [
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

const kustomerParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Conversation', value: 'createConversation' },
    { label: 'Add Note', value: 'addNote' },
  ]},
  { name: 'customer_id', displayName: 'Customer ID', type: 'string' },
  { name: 'message', displayName: 'Message', type: 'textarea' },
];
const kustomerCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const gladlyParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Ticket', value: 'createTicket' },
    { label: 'Post Message', value: 'postMessage' },
  ]},
  { name: 'subject', displayName: 'Subject', type: 'string' },
  { name: 'message', displayName: 'Message', type: 'textarea' },
];
const gladlyCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const crispParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Send Chat Message', value: 'sendMessage' },
    { label: 'Create Contact', value: 'createContact' },
  ]},
  { name: 'website_id', displayName: 'Website ID', type: 'string', placeholder: 'website_id' },
  { name: 'message', displayName: 'Message', type: 'textarea' },
  { name: 'email', displayName: 'Email', type: 'email' },
];
const crispCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const tawkToParams: APIParameter[] = [
  { name: 'widget_id', displayName: 'Widget ID', type: 'string', required: true },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
  { name: 'visitor_name', displayName: 'Visitor Name', type: 'string' },
];
const tawkToCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const driftParams: APIParameter[] = [
  { name: 'contact_email', displayName: 'Contact Email', type: 'email', required: true },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
  { name: 'conversation_type', displayName: 'Conversation Type', type: 'select', options: [
    { label: 'Bot', value: 'bot' },
    { label: 'Human', value: 'human' },
  ]},
];
const driftCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const manyChatParams: APIParameter[] = [
  { name: 'flow_id', displayName: 'Flow ID', type: 'string', required: true },
  { name: 'subscriber_id', displayName: 'Subscriber ID', type: 'string', required: true },
  { name: 'message', displayName: 'Message', type: 'textarea' },
];
const manyChatCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const chatbaseParams: APIParameter[] = [
  { name: 'query', displayName: 'Query', type: 'textarea', required: true },
  { name: 'session_id', displayName: 'Session ID', type: 'string' },
  { name: 'metadata', displayName: 'Metadata (JSON)', type: 'textarea' },
];
const chatbaseCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const landbotParams: APIParameter[] = [
  { name: 'bot_id', displayName: 'Bot ID', type: 'string', required: true },
  { name: 'visitor_id', displayName: 'Visitor ID', type: 'string' },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
];
const landbotCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const liveChatParams: APIParameter[] = [
  { name: 'license_id', displayName: 'License ID', type: 'string', required: true },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
  { name: 'visitor_email', displayName: 'Visitor Email', type: 'email' },
];
const liveChatCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const jotformParams: APIParameter[] = [
  { name: 'form_id', displayName: 'Form ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Get Submissions', value: 'getSubmissions' },
    { label: 'Create Webhook', value: 'createWebhook' },
  ]},
];
const jotformCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const tallyParams: APIParameter[] = [
  { name: 'form_id', displayName: 'Form ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Get Responses', value: 'getResponses' },
    { label: 'Create Webhook', value: 'createWebhook' },
  ]},
];
const tallyCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const surveyMonkeyParams: APIParameter[] = [
  { name: 'survey_id', displayName: 'Survey ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Get Responses', value: 'getResponses' },
    { label: 'Create Collector', value: 'createCollector' },
  ]},
];
const surveyMonkeyCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const userTestingParams: APIParameter[] = [
  { name: 'test_id', displayName: 'Test ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Note', value: 'createNote' },
    { label: 'Get Sessions', value: 'getSessions' },
  ]},
  { name: 'note', displayName: 'Note', type: 'textarea' },
];
const userTestingCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const qualtricsParams: APIParameter[] = [
  { name: 'survey_id', displayName: 'Survey ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Get Responses', value: 'getResponses' },
    { label: 'Send Survey', value: 'sendSurvey' },
  ]},
  { name: 'recipient_email', displayName: 'Recipient Email', type: 'email' },
];
const qualtricsCredentials: APIParameter[] = [
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

const zohoCRMParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Lead', value: 'createLead' },
    { label: 'Create Contact', value: 'createContact' },
    { label: 'Update Deal', value: 'updateDeal' },
  ]},
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea', placeholder: '{"Last_Name":"Doe","Company":"Acme"}' },
];
const zohoCRMCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const copperParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Lead', value: 'createLead' },
    { label: 'Create Contact', value: 'createContact' },
  ]},
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea', placeholder: '{"name":"Jane Doe","email":"jane@example.com"}' },
];
const copperCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const keapParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Contact', value: 'createContact' },
    { label: 'Create Task', value: 'createTask' },
  ]},
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea', placeholder: '{"email":"user@example.com","first_name":"User"}' },
];
const keapCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const closeParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Lead', value: 'createLead' },
    { label: 'Create Opportunity', value: 'createOpportunity' },
  ]},
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea', placeholder: '{"name":"Lead Name","status":"contacted"}' },
];
const closeCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const attioParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Contact', value: 'createContact' },
    { label: 'Update Contact', value: 'updateContact' },
  ]},
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea', placeholder: '{"name":"Alex","email":"alex@example.com"}' },
];
const attioCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const folkParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Contact', value: 'createContact' },
    { label: 'List Contacts', value: 'listContacts' },
  ]},
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea', placeholder: '{"name":"Morgan","email":"morgan@example.com"}' },
];
const folkCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const apolloParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Lead', value: 'createLead' },
    { label: 'Search Contact', value: 'searchContact' },
  ]},
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea', placeholder: '{"name":"Pat","email":"pat@example.com"}' },
];
const apolloCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const linkedInAdsParams: APIParameter[] = [
  { name: 'account_id', displayName: 'Account ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Campaign', value: 'createCampaign' },
    { label: 'Get Campaigns', value: 'getCampaigns' },
  ]},
  { name: 'campaign_data', displayName: 'Campaign Data (JSON)', type: 'textarea' },
];
const linkedInAdsCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const tiktokAdsParams: APIParameter[] = [
  { name: 'advertiser_id', displayName: 'Advertiser ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Campaign', value: 'createCampaign' },
    { label: 'Get Campaigns', value: 'getCampaigns' },
  ]},
  { name: 'campaign_data', displayName: 'Campaign Data (JSON)', type: 'textarea' },
];
const tiktokAdsCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const mixpanelParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Track Event', value: 'trackEvent' },
    { label: 'Create User', value: 'createUser' },
  ]},
  { name: 'event_name', displayName: 'Event Name', type: 'string' },
  { name: 'distinct_id', displayName: 'Distinct ID', type: 'string' },
  { name: 'properties', displayName: 'Properties (JSON)', type: 'textarea' },
];
const mixpanelCredentials: APIParameter[] = [
  { name: 'api_secret', displayName: 'API Secret', type: 'password', required: true },
];

const amplitudeParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Track Event', value: 'trackEvent' },
    { label: 'Identify User', value: 'identifyUser' },
  ]},
  { name: 'event_type', displayName: 'Event Type', type: 'string' },
  { name: 'user_id', displayName: 'User ID', type: 'string' },
  { name: 'event_properties', displayName: 'Event Properties (JSON)', type: 'textarea' },
];
const amplitudeCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const segmentParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Track Event', value: 'trackEvent' },
    { label: 'Identify', value: 'identify' },
  ]},
  { name: 'user_id', displayName: 'User ID', type: 'string' },
  { name: 'event', displayName: 'Event', type: 'string' },
  { name: 'properties', displayName: 'Properties (JSON)', type: 'textarea' },
];
const segmentCredentials: APIParameter[] = [
  { name: 'write_key', displayName: 'Write Key', type: 'password', required: true },
];

const clearbitParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Enrich Person', value: 'enrichPerson' },
    { label: 'Enrich Company', value: 'enrichCompany' },
  ]},
  { name: 'email', displayName: 'Email', type: 'email' },
  { name: 'domain', displayName: 'Domain', type: 'string' },
];
const clearbitCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const mondayComParams: APIParameter[] = [
  { name: 'board_id', displayName: 'Board ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Item', value: 'createItem' },
    { label: 'Update Item', value: 'updateItem' },
  ]},
  { name: 'item_name', displayName: 'Item Name', type: 'string' },
  { name: 'column_values', displayName: 'Column Values (JSON)', type: 'textarea' },
];
const mondayComCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const basecampParams: APIParameter[] = [
  { name: 'project_id', displayName: 'Project ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Todo', value: 'createTodo' },
    { label: 'Create Message', value: 'createMessage' },
  ]},
  { name: 'content', displayName: 'Content', type: 'textarea', required: true },
];
const basecampCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

const todoistParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Task', value: 'createTask' },
    { label: 'Complete Task', value: 'completeTask' },
  ]},
  { name: 'content', displayName: 'Content', type: 'string' },
  { name: 'project_id', displayName: 'Project ID', type: 'string' },
  { name: 'due_string', displayName: 'Due Date', type: 'string', placeholder: 'tomorrow at 9am' },
];
const todoistCredentials: APIParameter[] = [
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

const ticktickParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Task', value: 'createTask' },
    { label: 'Complete Task', value: 'completeTask' },
  ]},
  { name: 'content', displayName: 'Content', type: 'string' },
  { name: 'due_date', displayName: 'Due Date', type: 'string', placeholder: '2026-01-01' },
];
const ticktickCredentials: APIParameter[] = [
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

const confluenceParams: APIParameter[] = [
  { name: 'space_key', displayName: 'Space Key', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Page', value: 'createPage' },
    { label: 'Update Page', value: 'updatePage' },
  ]},
  { name: 'title', displayName: 'Title', type: 'string', required: true },
  { name: 'body', displayName: 'Body', type: 'textarea', required: true },
];
const confluenceCredentials: APIParameter[] = [
  { name: 'base_url', displayName: 'Confluence URL', type: 'url', required: true },
  { name: 'email', displayName: 'Email', type: 'email', required: true },
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

const sliteParams: APIParameter[] = [
  { name: 'workspace_id', displayName: 'Workspace ID', type: 'string', required: true },
  { name: 'title', displayName: 'Title', type: 'string', required: true },
  { name: 'content', displayName: 'Content', type: 'textarea', required: true },
];
const sliteCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const gitbookParams: APIParameter[] = [
  { name: 'space_slug', displayName: 'Space Slug', type: 'string', required: true },
  { name: 'title', displayName: 'Title', type: 'string', required: true },
  { name: 'content', displayName: 'Content', type: 'textarea', required: true },
];
const gitbookCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const guruParams: APIParameter[] = [
  { name: 'board_uid', displayName: 'Board UID', type: 'string', required: true },
  { name: 'title', displayName: 'Title', type: 'string', required: true },
  { name: 'content', displayName: 'Content', type: 'textarea', required: true },
];
const guruCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const slabParams: APIParameter[] = [
  { name: 'workspace_id', displayName: 'Workspace ID', type: 'string', required: true },
  { name: 'title', displayName: 'Title', type: 'string', required: true },
  { name: 'content', displayName: 'Content', type: 'textarea', required: true },
];
const slabCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const evernoteParams: APIParameter[] = [
  { name: 'notebook_guid', displayName: 'Notebook GUID', type: 'string', required: true },
  { name: 'title', displayName: 'Note Title', type: 'string', required: true },
  { name: 'content', displayName: 'Content', type: 'textarea', required: true },
];
const evernoteCredentials: APIParameter[] = [
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

const ollamaParams: APIParameter[] = [
  { name: 'model_path', displayName: 'Model Path', type: 'string', required: true, placeholder: '/models/llama2' },
  { name: 'prompt', displayName: 'Prompt', type: 'textarea', required: true },
  { name: 'temperature', displayName: 'Temperature', type: 'number', default: 0.7 },
  { name: 'max_tokens', displayName: 'Max Tokens', type: 'number', default: 512 },
  { name: 'system_prompt', displayName: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant.' },
];

// ============ MARKETING & ADS ============
const googleadsParams: APIParameter[] = [
  { name: 'customer_id', displayName: 'Customer ID', type: 'string', required: true },
  { name: 'campaign_id', displayName: 'Campaign ID', type: 'string' },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'List Campaigns', value: 'listCampaigns' },
    { label: 'Create Campaign', value: 'createCampaign' },
    { label: 'Update Campaign', value: 'updateCampaign' },
  ]},
  { name: 'campaign_data', displayName: 'Campaign Data (JSON)', type: 'textarea' },
];
const googleadsCredentials: APIParameter[] = [
  { name: 'developer_token', displayName: 'Developer Token', type: 'password', required: true },
  { name: 'client_id', displayName: 'Client ID', type: 'string', required: true },
  { name: 'client_secret', displayName: 'Client Secret', type: 'password', required: true },
];

const metaadsParams: APIParameter[] = [
  { name: 'ad_account_id', displayName: 'Ad Account ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create Campaign', value: 'createCampaign' },
    { label: 'Get Insights', value: 'getInsights' },
    { label: 'Update Campaign', value: 'updateCampaign' },
  ]},
  { name: 'campaign_data', displayName: 'Campaign Data (JSON)', type: 'textarea' },
];
const metaadsCredentials: APIParameter[] = [
  { name: 'access_token', displayName: 'Access Token', type: 'password', required: true },
];

// ============ IDENTITY & AUTH ============
const oktaParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Create User', value: 'createUser' },
    { label: 'List Users', value: 'listUsers' },
    { label: 'Update User', value: 'updateUser' },
  ]},
  { name: 'user_data', displayName: 'User Data (JSON)', type: 'textarea' },
];
const oktaCredentials: APIParameter[] = [
  { name: 'org_url', displayName: 'Okta Org URL', type: 'url', required: true },
  { name: 'api_token', displayName: 'API Token', type: 'password', required: true },
];

const auth0Params: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Get User', value: 'getUser' },
    { label: 'Create User', value: 'createUser' },
    { label: 'List Users', value: 'listUsers' },
    { label: 'Block User', value: 'blockUser' },
  ]},
  { name: 'user_id', displayName: 'User ID', type: 'string' },
  { name: 'user_data', displayName: 'User Data (JSON)', type: 'textarea' },
];
const auth0Credentials: APIParameter[] = [
  { name: 'domain', displayName: 'Domain', type: 'string', required: true, placeholder: 'example.auth0.com' },
  { name: 'client_id', displayName: 'Client ID', type: 'password', required: true },
  { name: 'client_secret', displayName: 'Client Secret', type: 'password', required: true },
];

// ============ UTILITIES ============
const openweathermapParams: APIParameter[] = [
  { name: 'q', displayName: 'Location (City/Coords)', type: 'string', required: true, placeholder: 'New York or 40.7128,-74.0060' },
  { name: 'units', displayName: 'Units', type: 'select', default: 'metric', options: [
    { label: 'Metric (°C)', value: 'metric' },
    { label: 'Imperial (°F)', value: 'imperial' },
  ]},
];
const openweathermapCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

const googlemapsParams: APIParameter[] = [
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Geocode', value: 'geocode' },
    { label: 'Directions', value: 'directions' },
    { label: 'Distance Matrix', value: 'distanceMatrix' },
  ]},
  { name: 'origin', displayName: 'Origin', type: 'string', placeholder: 'Address or coordinates' },
  { name: 'destination', displayName: 'Destination', type: 'string', placeholder: 'Address or coordinates' },
];
const googlemapsCredentials: APIParameter[] = [
  { name: 'api_key', displayName: 'API Key', type: 'password', required: true },
];

// ============ DATA TRANSFORMATION (INTERNAL) ============
const sqlDatabaseParams: APIParameter[] = [
  { name: 'connection_string', displayName: 'Connection String', type: 'string', required: true, description: 'Database connection string or endpoint', placeholder: 'postgres://user:pass@host:5432/db' },
  { name: 'query', displayName: 'Query / SQL', type: 'textarea', required: true, placeholder: 'SELECT * FROM users WHERE active = true' },
  { name: 'parameters', displayName: 'Parameters (JSON)', type: 'textarea', placeholder: '{"limit": 10}' },
];

const graphDatabaseParams: APIParameter[] = [
  { name: 'database', displayName: 'Database', type: 'string', required: true, placeholder: 'neo4j' },
  { name: 'cypher', displayName: 'Cypher Query', type: 'textarea', required: true, placeholder: 'MATCH (n) RETURN n LIMIT 25' },
  { name: 'parameters', displayName: 'Parameters (JSON)', type: 'textarea', placeholder: '{"limit": 25}' },
];

const faunaDBParams: APIParameter[] = [
  { name: 'secret', displayName: 'Secret Key', type: 'password', required: true },
  { name: 'query', displayName: 'FQL Query', type: 'textarea', required: true, placeholder: 'q.Get(q.Ref(q.Collection("users"), "123456"))' },
];

const surrealDBParams: APIParameter[] = [
  { name: 'namespace', displayName: 'Namespace', type: 'string', required: true, placeholder: 'test' },
  { name: 'database', displayName: 'Database', type: 'string', required: true, placeholder: 'test' },
  { name: 'query', displayName: 'SurrealQL Query', type: 'textarea', required: true, placeholder: 'SELECT * FROM users' },
];

const tursoParams: APIParameter[] = [
  { name: 'database', displayName: 'Database Name', type: 'string', required: true, placeholder: 'example' },
  { name: 'query', displayName: 'SQL Query', type: 'textarea', required: true, placeholder: 'SELECT * FROM users' },
  { name: 'parameters', displayName: 'Parameters (JSON)', type: 'textarea', placeholder: '{"limit":10}' },
];

const cdnControlParams: APIParameter[] = [
  { name: 'service_id', displayName: 'Service ID', type: 'string', required: true },
  { name: 'action', displayName: 'Action', type: 'select', required: true, default: 'purge', options: [
    { label: 'Purge Cache', value: 'purge' },
    { label: 'Get Status', value: 'status' },
  ]},
  { name: 'resource', displayName: 'Resource', type: 'string', placeholder: 'URL, tag, or key' },
];

const spreadsheetParams: APIParameter[] = [
  { name: 'document_id', displayName: 'Document / Workbook ID', type: 'string', required: true },
  { name: 'sheet_name', displayName: 'Sheet / Table Name', type: 'string', required: true },
  { name: 'range', displayName: 'Range', type: 'string', placeholder: 'A1:B10' },
  { name: 'values', displayName: 'Values (JSON)', type: 'textarea', placeholder: '[["Name","Email"],["Alice","alice@example.com"]]' },
];

const devOpsParams: APIParameter[] = [
  { name: 'organization', displayName: 'Organization', type: 'string', placeholder: 'my-org' },
  { name: 'project', displayName: 'Project', type: 'string', placeholder: 'my-project' },
  { name: 'repository', displayName: 'Repository', type: 'string', placeholder: 'my-repo' },
  { name: 'action', displayName: 'Action', type: 'string', placeholder: 'create_work_item' },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"title":"Fix bug"}' },
];

const monitoringParams: APIParameter[] = [
  { name: 'account_id', displayName: 'Account ID', type: 'string' },
  { name: 'query', displayName: 'Query', type: 'textarea', placeholder: 'SELECT count(*) FROM errors WHERE status = "failure"' },
  { name: 'event', displayName: 'Event Data', type: 'textarea', placeholder: '{"message":"Deployment completed"}' },
];

const paymentGatewayParams: APIParameter[] = [
  { name: 'amount', displayName: 'Amount (cents)', type: 'number', required: true, placeholder: '1000' },
  { name: 'currency', displayName: 'Currency', type: 'select', required: true, default: 'usd', options: [
    { label: 'USD', value: 'usd' },
    { label: 'EUR', value: 'eur' },
    { label: 'GBP', value: 'gbp' },
  ]},
  { name: 'customer_id', displayName: 'Customer ID', type: 'string' },
  { name: 'payment_method', displayName: 'Payment Method ID', type: 'string' },
  { name: 'description', displayName: 'Description', type: 'string' },
];

const storefrontParams: APIParameter[] = [
  { name: 'store_id', displayName: 'Store ID', type: 'string', required: true },
  { name: 'resource', displayName: 'Resource', type: 'select', required: true, default: 'order', options: [
    { label: 'Order', value: 'order' },
    { label: 'Product', value: 'product' },
    { label: 'Customer', value: 'customer' },
  ]},
  { name: 'resource_id', displayName: 'Resource ID', type: 'string' },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"quantity":1}' },
];

const supportParams: APIParameter[] = [
  { name: 'subject', displayName: 'Subject', type: 'string', required: true },
  { name: 'description', displayName: 'Description', type: 'textarea', required: true },
  { name: 'customer_email', displayName: 'Customer Email', type: 'email' },
  { name: 'priority', displayName: 'Priority', type: 'select', default: 'normal', options: [
    { label: 'Low', value: 'low' },
    { label: 'Normal', value: 'normal' },
    { label: 'High', value: 'high' },
  ]},
];

const web3Params: APIParameter[] = [
  { name: 'network', displayName: 'Network', type: 'select', default: 'ethereum', options: [
    { label: 'Ethereum', value: 'ethereum' },
    { label: 'Solana', value: 'solana' },
    { label: 'Polygon', value: 'polygon' },
  ]},
  { name: 'endpoint', displayName: 'RPC Endpoint', type: 'url', placeholder: 'https://eth-mainnet.alchemyapi.io/v2/...' },
  { name: 'method', displayName: 'RPC Method', type: 'string', placeholder: 'eth_blockNumber' },
  { name: 'params', displayName: 'Parameters (JSON)', type: 'textarea', placeholder: '[]' },
];

const marketDataParams: APIParameter[] = [
  { name: 'symbol', displayName: 'Symbol', type: 'string', placeholder: 'ETH' },
  { name: 'collection', displayName: 'Collection', type: 'string', placeholder: 'cool-cats' },
  { name: 'token_id', displayName: 'Token ID', type: 'string' },
  { name: 'action', displayName: 'Action', type: 'select', default: 'fetch', options: [
    { label: 'Fetch Prices', value: 'fetch' },
    { label: 'Fetch Asset', value: 'asset' },
  ]},
];

const identityParams: APIParameter[] = [
  { name: 'user_id', displayName: 'User ID', type: 'string' },
  { name: 'email', displayName: 'Email', type: 'email' },
  { name: 'action', displayName: 'Action', type: 'select', default: 'authenticate', options: [
    { label: 'Authenticate', value: 'authenticate' },
    { label: 'Create User', value: 'create_user' },
    { label: 'Update User', value: 'update_user' },
  ]},
];

const securityParams: APIParameter[] = [
  { name: 'query', displayName: 'Query', type: 'textarea', required: true, placeholder: 'example.com' },
  { name: 'scan_type', displayName: 'Scan Type', type: 'select', default: 'url', options: [
    { label: 'URL', value: 'url' },
    { label: 'IP', value: 'ip' },
    { label: 'Hash', value: 'hash' },
  ]},
];

const uptimeRobotParams: APIParameter[] = [
  { name: 'monitor_id', displayName: 'Monitor ID', type: 'string' },
  { name: 'friendly_name', displayName: 'Friendly Name', type: 'string' },
  { name: 'url', displayName: 'URL', type: 'url', required: true },
  { name: 'monitor_type', displayName: 'Monitor Type', type: 'select', default: 'http', options: [
    { label: 'HTTP(s)', value: 'http' },
    { label: 'Keyword', value: 'keyword' },
    { label: 'Ping', value: 'ping' },
  ]},
  { name: 'alert_contact', displayName: 'Alert Contact', type: 'string', placeholder: 'email or contact id' },
];

const vercelParams: APIParameter[] = [
  { name: 'project_id', displayName: 'Project ID', type: 'string' },
  { name: 'team_id', displayName: 'Team ID', type: 'string' },
  { name: 'alias', displayName: 'Alias', type: 'string' },
  { name: 'environment', displayName: 'Environment', type: 'select', default: 'production', options: [
    { label: 'Production', value: 'production' },
    { label: 'Preview', value: 'preview' },
    { label: 'Development', value: 'development' },
  ]},
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"target":"production"}' },
];

const netlifyParams: APIParameter[] = [
  { name: 'site_id', displayName: 'Site ID', type: 'string', required: true },
  { name: 'branch', displayName: 'Branch', type: 'string', default: 'main' },
  { name: 'build_command', displayName: 'Build Command', type: 'string', placeholder: 'npm run build' },
  { name: 'deploy_message', displayName: 'Deploy Message', type: 'string' },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"draft":false}' },
];

const dockerhubParams: APIParameter[] = [
  { name: 'repository', displayName: 'Repository', type: 'string', required: true, placeholder: 'username/repo' },
  { name: 'tag', displayName: 'Tag', type: 'string', default: 'latest' },
  { name: 'action', displayName: 'Action', type: 'select', default: 'trigger_build', options: [
    { label: 'Trigger Build', value: 'trigger_build' },
    { label: 'Get Tags', value: 'get_tags' },
    { label: 'Delete Tag', value: 'delete_tag' },
  ]},
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"docker_tag":"latest"}' },
];

const weatherParams: APIParameter[] = [
  { name: 'location', displayName: 'Location', type: 'string', required: true, placeholder: 'New York, NY' },
  { name: 'units', displayName: 'Units', type: 'select', default: 'metric', options: [
    { label: 'Metric', value: 'metric' },
    { label: 'Imperial', value: 'imperial' },
  ]},
];

const iotParams: APIParameter[] = [
  { name: 'device_id', displayName: 'Device ID', type: 'string', required: true },
  { name: 'command', displayName: 'Command', type: 'string', required: true, placeholder: 'turn_on' },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"brightness":80}' },
];

const socialPostParams: APIParameter[] = [
  { name: 'account_id', displayName: 'Account ID', type: 'string' },
  { name: 'content', displayName: 'Content', type: 'textarea', required: true },
  { name: 'media_urls', displayName: 'Media URLs', type: 'string', placeholder: 'https://...' },
  { name: 'scheduled_time', displayName: 'Scheduled Time', type: 'string', placeholder: '2025-01-01T12:00:00Z' },
];

const socialManagementParams: APIParameter[] = [
  { name: 'account_ids', displayName: 'Account IDs', type: 'textarea', placeholder: '["acct1","acct2"]' },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
  { name: 'publish_time', displayName: 'Publish Time', type: 'string', placeholder: '2025-01-01T12:00:00Z' },
];

const cmsParams: APIParameter[] = [
  { name: 'site_id', displayName: 'Site ID', type: 'string' },
  { name: 'content_type', displayName: 'Content Type', type: 'string', placeholder: 'post' },
  { name: 'title', displayName: 'Title', type: 'string' },
  { name: 'body', displayName: 'Body', type: 'textarea', required: true },
];

const hrParams: APIParameter[] = [
  { name: 'employee_id', displayName: 'Employee ID', type: 'string' },
  { name: 'action', displayName: 'Action', type: 'select', default: 'create', options: [
    { label: 'Create', value: 'create' },
    { label: 'Update', value: 'update' },
  ]},
  { name: 'fields', displayName: 'Fields (JSON)', type: 'textarea', placeholder: '{"title":"Engineer"}' },
];

const trainingParams: APIParameter[] = [
  { name: 'course_id', displayName: 'Course ID', type: 'string' },
  { name: 'user_id', displayName: 'User ID', type: 'string' },
  { name: 'action', displayName: 'Action', type: 'select', default: 'enroll', options: [
    { label: 'Enroll', value: 'enroll' },
    { label: 'Complete', value: 'complete' },
  ]},
];

const eSignParams: APIParameter[] = [
  { name: 'document_id', displayName: 'Document ID', type: 'string' },
  { name: 'signer_email', displayName: 'Signer Email', type: 'email', required: true },
  { name: 'subject', displayName: 'Subject', type: 'string' },
];

const healthParams: APIParameter[] = [
  { name: 'patient_id', displayName: 'Patient ID', type: 'string' },
  { name: 'resource', displayName: 'Resource', type: 'string', placeholder: 'vital-signs' },
  { name: 'data', displayName: 'Data (JSON)', type: 'textarea', placeholder: '{"heart_rate":72}' },
];

const logisticsParams: APIParameter[] = [
  { name: 'tracking_number', displayName: 'Tracking Number', type: 'string' },
  { name: 'carrier', displayName: 'Carrier', type: 'string' },
  { name: 'action', displayName: 'Action', type: 'select', default: 'track', options: [
    { label: 'Track', value: 'track' },
    { label: 'Create Shipment', value: 'create_shipment' },
  ]},
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"address":"..."}' },
];

const financeParams: APIParameter[] = [
  { name: 'account_id', displayName: 'Account ID', type: 'string' },
  { name: 'amount', displayName: 'Amount', type: 'number' },
  { name: 'currency', displayName: 'Currency', type: 'string', default: 'usd' },
  { name: 'description', displayName: 'Description', type: 'string' },
];

const designParams: APIParameter[] = [
  { name: 'project_id', displayName: 'Project ID', type: 'string' },
  { name: 'asset_url', displayName: 'Asset URL', type: 'url' },
  { name: 'command', displayName: 'Command', type: 'string', placeholder: 'export_frame' },
];

const notificationParams: APIParameter[] = [
  { name: 'title', displayName: 'Title', type: 'string' },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
  { name: 'recipients', displayName: 'Recipients', type: 'textarea', placeholder: '["user1","user2"]' },
];

const alertParams: APIParameter[] = [
  { name: 'incident_key', displayName: 'Incident Key', type: 'string' },
  { name: 'message', displayName: 'Message', type: 'textarea', required: true },
  { name: 'severity', displayName: 'Severity', type: 'select', default: 'critical', options: [
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Normal', value: 'normal' },
  ]},
];

const searchParams: APIParameter[] = [
  { name: 'index_name', displayName: 'Index Name', type: 'string' },
  { name: 'query', displayName: 'Query', type: 'textarea', required: true },
  { name: 'document', displayName: 'Document (JSON)', type: 'textarea' },
];

const analyticsParams: APIParameter[] = [
  { name: 'property_id', displayName: 'Property ID', type: 'string' },
  { name: 'query', displayName: 'Query', type: 'textarea' },
  { name: 'time_range', displayName: 'Time Range', type: 'string', placeholder: 'last_30_days' },
];

const textFormatterParams: APIParameter[] = [
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, options: [
    { label: 'Uppercase', value: 'uppercase' },
    { label: 'Lowercase', value: 'lowercase' },
    { label: 'Title Case', value: 'titlecase' },
    { label: 'Capitalize', value: 'capitalize' },
    { label: 'Reverse', value: 'reverse' },
    { label: 'Replace', value: 'replace' },
    { label: 'Trim', value: 'trim' },
  ]},
  { name: 'text', displayName: 'Text Input', type: 'textarea', required: true },
  { name: 'search', displayName: 'Search String (for Replace)', type: 'string' },
  { name: 'replace_with', displayName: 'Replace With', type: 'string' },
];

const dateFormatterParams: APIParameter[] = [
  { name: 'date_input', displayName: 'Date Input', type: 'string', required: true, placeholder: '2024-01-15' },
  { name: 'input_format', displayName: 'Input Format', type: 'string', default: 'YYYY-MM-DD' },
  { name: 'output_format', displayName: 'Output Format', type: 'string', default: 'MMMM D, YYYY' },
  { name: 'timezone', displayName: 'Timezone', type: 'string', default: 'UTC' },
];

const jsonparserParams: APIParameter[] = [
  { name: 'json_string', displayName: 'JSON String', type: 'textarea', required: true },
  { name: 'path', displayName: 'Path to Extract (dot notation)', type: 'string', placeholder: 'user.email' },
  { name: 'action', displayName: 'Action', type: 'select', required: true, options: [
    { label: 'Parse', value: 'parse' },
    { label: 'Stringify', value: 'stringify' },
    { label: 'Extract Value', value: 'extract' },
    { label: 'Validate', value: 'validate' },
  ]},
];

const mathParams: APIParameter[] = [
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, options: [
    { label: 'Add', value: 'add' },
    { label: 'Subtract', value: 'subtract' },
    { label: 'Multiply', value: 'multiply' },
    { label: 'Divide', value: 'divide' },
    { label: 'Power', value: 'power' },
    { label: 'Square Root', value: 'sqrt' },
    { label: 'Modulo', value: 'modulo' },
  ]},
  { name: 'value_a', displayName: 'First Value', type: 'number', required: true },
  { name: 'value_b', displayName: 'Second Value', type: 'number' },
];

const codeexecParams: APIParameter[] = [
  { name: 'language', displayName: 'Language', type: 'select', required: true, options: [
    { label: 'JavaScript', value: 'javascript' },
    { label: 'Python', value: 'python' },
    { label: 'Bash', value: 'bash' },
  ]},
  { name: 'code', displayName: 'Code', type: 'textarea', required: true, placeholder: 'console.log("Hello");' },
  { name: 'input_data', displayName: 'Input Data (JSON)', type: 'textarea', placeholder: '{"key": "value"}' },
];

const csvParams: APIParameter[] = [
  { name: 'data', displayName: 'Data (JSON array)', type: 'textarea', required: true },
  { name: 'headers', displayName: 'Column Headers (comma-separated)', type: 'string', required: true },
  { name: 'format', displayName: 'Format', type: 'select', default: 'csv', options: [
    { label: 'CSV', value: 'csv' },
    { label: 'TSV', value: 'tsv' },
  ]},
];

const pdfParams: APIParameter[] = [
  { name: 'title', displayName: 'Document Title', type: 'string', required: true },
  { name: 'content', displayName: 'Content (HTML or Markdown)', type: 'textarea', required: true },
  { name: 'orientation', displayName: 'Orientation', type: 'select', default: 'portrait', options: [
    { label: 'Portrait', value: 'portrait' },
    { label: 'Landscape', value: 'landscape' },
  ]},
];



const expandedApiCatalog: Array<[string, AutomationAuthType, string, APIParameter[]]> = [
  ['Google Calendar', 'free', 'Google Calendar API (events.list/events.insert).', [{ name: 'calendar_id', displayName: 'Calendar ID', type: 'string', required: true, placeholder: 'primary' }, { name: 'operation', displayName: 'Operation', type: 'select', required: true, default: 'events.list', options: [{ label: 'List events', value: 'events.list' }, { label: 'Create event', value: 'events.insert' }] }, { name: 'time_min', displayName: 'Time Min (RFC3339)', type: 'string', placeholder: '2026-05-01T00:00:00Z' }]],
  ['Google Tasks', 'free', 'Google Tasks API (tasks.list/tasks.insert).', [{ name: 'tasklist_id', displayName: 'Task List ID', type: 'string', required: true, placeholder: '@default' }, { name: 'operation', displayName: 'Operation', type: 'select', default: 'tasks.list', options: [{ label: 'List tasks', value: 'tasks.list' }, { label: 'Create task', value: 'tasks.insert' }] }, { name: 'title', displayName: 'Task Title', type: 'string' }]],
  ['Google People', 'free', 'Google People endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Docs', 'free', 'Google Docs endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Slides', 'free', 'Google Slides endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Forms', 'free', 'Google Forms endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Photos', 'free', 'Google Photos endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['YouTube Data', 'free', 'YouTube Data endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['YouTube Analytics', 'free', 'YouTube Analytics endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Search Console', 'free', 'Google Search Console endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Business Profile', 'free', 'Google Business Profile endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Admin SDK', 'free', 'Google Admin SDK endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Classroom', 'free', 'Google Classroom endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Books', 'free', 'Google Books endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Translate', 'free', 'Google Translate endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Vision', 'free', 'Google Vision endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Natural Language', 'free', 'Google Natural Language endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google BigQuery', 'free', 'Google BigQuery endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Pub/Sub', 'free', 'Google Pub/Sub endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Google Cloud Run Admin', 'free', 'Google Cloud Run Admin endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['AWS Lambda', 'api_key', 'AWS Lambda endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['AWS EventBridge', 'api_key', 'AWS EventBridge endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['AWS DynamoDB', 'api_key', 'AWS DynamoDB endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['AWS SQS', 'api_key', 'AWS SQS endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['AWS SNS', 'api_key', 'AWS SNS endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['AWS Step Functions', 'api_key', 'AWS Step Functions endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['AWS CloudWatch', 'api_key', 'AWS CloudWatch endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['AWS Rekognition', 'api_key', 'AWS Rekognition endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['AWS Comprehend', 'api_key', 'AWS Comprehend endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['AWS Textract', 'api_key', 'AWS Textract endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Azure OpenAI', 'api_key', 'Azure OpenAI endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Azure Cognitive Search', 'api_key', 'Azure Cognitive Search endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Azure Cosmos DB', 'api_key', 'Azure Cosmos DB endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Azure Service Bus', 'api_key', 'Azure Service Bus endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Azure Event Grid', 'api_key', 'Azure Event Grid endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Azure Monitor', 'api_key', 'Azure Monitor endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Azure DevOps Boards', 'api_key', 'Azure DevOps Boards endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Microsoft Graph Mail', 'free', 'Microsoft Graph Mail endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Microsoft Graph Calendar', 'free', 'Microsoft Graph Calendar endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Microsoft Graph OneDrive', 'free', 'Microsoft Graph OneDrive endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Microsoft Planner', 'api_key', 'Microsoft Planner endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Microsoft To Do', 'api_key', 'Microsoft To Do endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Microsoft SharePoint', 'api_key', 'Microsoft SharePoint endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Microsoft Intune', 'api_key', 'Microsoft Intune endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Notion Search', 'free', 'Notion Search endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Notion Pages', 'free', 'Notion Pages endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Airtable Records', 'free', 'Airtable Records endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Coda Docs', 'free', 'Coda Docs endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Asana Tasks', 'free', 'Asana Tasks endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Trello Cards', 'free', 'Trello Cards endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['ClickUp Tasks', 'free', 'ClickUp Tasks endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Linear Issues', 'free', 'Linear Issues endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Jira Service Management', 'api_key', 'Jira Service Management endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['GitHub Issues', 'free', 'GitHub Issues endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['GitHub Actions', 'free', 'GitHub Actions endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['GitHub Packages', 'free', 'GitHub Packages endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['GitLab Merge Requests', 'free', 'GitLab Merge Requests endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Bitbucket Pipelines', 'free', 'Bitbucket Pipelines endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['PagerDuty Incidents', 'api_key', 'PagerDuty Incidents endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Opsgenie Alerts', 'api_key', 'Opsgenie Alerts endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Datadog Metrics', 'free', 'Datadog Metrics endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Sentry Events', 'free', 'Sentry Events endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['New Relic NerdGraph', 'api_key', 'New Relic NerdGraph endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Snowflake SQL API', 'api_key', 'Snowflake SQL API endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['BigQuery Data Transfer', 'api_key', 'BigQuery Data Transfer endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Redshift Data API', 'api_key', 'Redshift Data API endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Postgres HTTP API', 'api_key', 'Postgres HTTP API endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['MongoDB Data API', 'api_key', 'MongoDB Data API endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Elasticsearch Query', 'free', 'Elasticsearch Query endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Meilisearch Index', 'free', 'Meilisearch Index endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Algolia Search API', 'api_key', 'Algolia Search API endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Pinecone Vector API', 'api_key', 'Pinecone Vector API endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Weaviate GraphQL API', 'free', 'Weaviate GraphQL API endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Qdrant Collections', 'free', 'Qdrant Collections endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Stripe Checkout', 'api_key', 'Stripe Checkout endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Stripe Billing', 'api_key', 'Stripe Billing endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['PayPal Orders', 'api_key', 'PayPal Orders endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Square Payments', 'api_key', 'Square Payments endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Braintree Transactions', 'api_key', 'Braintree Transactions endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Adyen Payments', 'api_key', 'Adyen Payments endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Shopify Admin', 'api_key', 'Shopify Admin endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['WooCommerce REST', 'free', 'WooCommerce REST endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Salesforce REST', 'api_key', 'Salesforce REST endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['HubSpot CRM', 'free', 'HubSpot CRM endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Pipedrive Deals', 'api_key', 'Pipedrive Deals endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Zendesk Tickets', 'api_key', 'Zendesk Tickets endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Freshdesk Tickets', 'free', 'Freshdesk Tickets endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Intercom Conversations', 'free', 'Intercom Conversations endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Twilio Verify', 'api_key', 'Twilio Verify endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Twilio Conversations', 'api_key', 'Twilio Conversations endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Vonage Messages', 'api_key', 'Vonage Messages endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['SendGrid Marketing', 'api_key', 'SendGrid Marketing endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Mailchimp Marketing', 'api_key', 'Mailchimp Marketing endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Brevo Contacts', 'api_key', 'Brevo Contacts endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Klaviyo Profiles', 'api_key', 'Klaviyo Profiles endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Segment Track', 'api_key', 'Segment Track endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Mixpanel Events', 'api_key', 'Mixpanel Events endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Amplitude HTTP API', 'api_key', 'Amplitude HTTP API endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['PostHog Capture', 'free', 'PostHog Capture endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
  ['Cloudflare Workers API', 'api_key', 'Cloudflare Workers API endpoint-driven integration with provider-specific route and payload expectations.', [{ name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'See provider docs' }, { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/create/update/delete' }, { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"example":true}' }]],
];



export const AUTOMATION_INTEGRATION_REGISTRY: AutomationRegistryCategory[] = [
  {
    id: 'comm',
    title: 'Communication & Messaging',
    subcategories: [
      withBlocks('email', 'Email Providers', [
        ['Resend', 'api_key', undefined, resendParams, resendCredentials],
        ['SendGrid', 'api_key', undefined, sendgridParams, sendgridCredentials],
        ['Mailgun', 'api_key', undefined, mailgunParams, mailgunCredentials],
        ['Postmark', 'api_key', undefined, postmarkParams, postmarkCredentials],
        ['Gmail', 'free', undefined, gmailParams],
        ['Outlook', 'free', undefined, outlookParams],
        ['Amazon SES', 'api_key', undefined, amazonsesParams, amazonsesCredentials],
        ['SparkPost', 'api_key', undefined, sparkpostParams, sparkpostCredentials],
        ['Brevo', 'free', undefined, brevoParams, brevoCredentials],
        ['Mailjet', 'free', undefined, mailjetParams, mailjetCredentials],
        ['ProtonMail API', 'api_key', undefined, protonmailParams, protonmailCredentials],
        ['Zoho Mail', 'free', undefined, zohoMailParams],
        ['iCloud Mail', 'free', undefined, iCloudMailParams],
        ['Yahoo Business', 'api_key', undefined, yahooBusinessParams],
        ['FastMail', 'api_key', undefined, fastmailParams, fastmailCredentials],
        ['Mailchimp Transactional', 'api_key', undefined, mailchimpTransactionalParams, mailchimpTransactionalCredentials],
      ]),
      withBlocks('team-chat', 'Team Chat & Collaboration', [
        ['Slack', 'free', undefined, slackParams, slackCredentials],
        ['Microsoft Teams', 'free', undefined, teamsParams, teamsCredentials],
        ['Discord', 'free', undefined, discordParams],
        ['Telegram', 'free', undefined, telegramParams, telegramCredentials],
        ['WhatsApp Business', 'api_key', undefined, whatsappParams, whatsappCredentials],
        ['Line', 'free', undefined, lineParams],
        ['WeChat', 'api_key', undefined, wechatParams],
        ['Zulip', 'free', undefined, zulipParams],
        ['Mattermost', 'free', undefined, mattermostParams],
        ['Rocket.Chat', 'free', undefined, rocketchatParams],
        ['Google Chat', 'free', undefined, googleChatParams],
        ['Twist', 'free', undefined, twistParams],
      ]),
      withBlocks('sms-voice', 'SMS, Voice & Mobile Push', [
        ['Twilio', 'api_key', undefined, twilioParams, twilioCredentials],
        ['MessageBird', 'api_key', undefined, messagebirdParams, messagebirdCredentials],
        ['Vonage', 'api_key', undefined, vonageParams, vonageCredentials],
        ['Infobip', 'api_key', undefined, infobipParams, infobipCredentials],
        ['Plivo', 'api_key', undefined, plivoParams],
        ['Sinch', 'api_key', undefined, sinchParams],
        ['Telnyx', 'api_key', undefined, telnyxParams],
        ['Firebase Cloud Messaging', 'free', undefined, fcmParams],
        ['OneSignal', 'free', undefined, oneSignalParams],
        ['Pusher', 'api_key', undefined, pusherParams],
        ['SimpleTexting', 'api_key', undefined, simpleTextingParams],
        ['ClickSend', 'api_key', undefined, clickSendParams],
        ['Bandwidth', 'api_key', undefined, bandwidthParams],
        ['RingCentral', 'api_key', undefined, ringCentralParams],
      ]),
      withBlocks('video-conferencing', 'Video Conferencing & Webinars', [
        ['Zoom', 'free', undefined, zoomParams, zoomCredentials],
        ['Google Meet', 'free', undefined, googleMeetParams],
        ['Microsoft Teams Video', 'free', undefined, teamsVideoParams],
        ['Webex', 'api_key', undefined, webexParams, webexCredentials],
        ['Around', 'api_key', undefined, aroundParams],
        ['Jitsi', 'free', undefined, jitsiParams],
        ['Demio', 'api_key', undefined, demioParams],
        ['Livestorm', 'api_key', undefined, livestormParams],
        ['Riverside.fm', 'api_key', undefined, riversideParams],
        ['Whereby', 'free', undefined, wherebyParams],
      ]),
    ],
  },
  {
    id: 'ai-ml',
    title: 'Artificial Intelligence & Machine Learning',
    subcategories: [
      withBlocks('ai-providers', 'AI Intelligence Providers', [
        ['OpenAI', 'api_key', undefined, openaiParams, openaiCredentials],
        ['Anthropic', 'api_key', undefined, anthropicParams, anthropicCredentials],
        ['Google Gemini', 'free', undefined, googlegeminiParams, googlegeminiCredentials],
        ['OpenRouter', 'api_key', undefined, openRouterParams],
        ['Mistral AI', 'api_key', undefined, mistralParams, mistralCredentials],
        ['Groq', 'api_key', undefined, groqParams, groqCredentials],
        ['Perplexity AI', 'api_key', undefined, perplexityParams],
        ['Cohere', 'api_key', undefined, cohereParams, cohereCredentials],
        ['Together AI', 'api_key', undefined, togetherAIParams],
        ['Hugging Face', 'api_key', undefined, huggingFaceParams, huggingFaceCredentials],
        ['Replicate', 'api_key', undefined, replicateParams, replicateCredentials],
        ['DeepSeek', 'api_key', undefined, deepSeekParams],
        ['Ollama', 'local', undefined, ollamaParams],
      ]),
      withBlocks('image-video-3d', 'Image, Video & 3D Generation', [
        ['DALL-E', 'api_key', undefined, dalleParams],
        ['Midjourney', 'api_key', undefined, midjourneyParams],
        ['Leonardo.ai', 'api_key', undefined, leonardoParams],
        ['Stable Diffusion', 'api_key', undefined, stableParams],
        ['HeyGen', 'api_key', undefined, heygenParams, heygenCredentials],
        ['RunwayML', 'api_key', undefined, runwayParams],
        ['Pika Labs', 'api_key', undefined, pikaParams],
        ['Adobe Firefly', 'api_key', undefined, fireflyParams],
        ['Luma AI', 'api_key', undefined, lumaParams],
        ['Spline 3D', 'api_key', undefined, splineParams],
      ]),
      withBlocks('audio-voice-music', 'Audio, Voice & Music AI', [
        ['ElevenLabs', 'api_key', undefined, elevenLabsParams, elevenLabsCredentials],
        ['AssemblyAI', 'api_key', undefined, assemblyaiParams, assemblyaiCredentials],
        ['Deepgram', 'api_key', undefined, deepgramParams],
        ['Rev.ai', 'api_key', undefined, revAiParams],
        ['Murf.ai', 'api_key', undefined, murfParams],
        ['Play.ht', 'api_key', undefined, playhtParams],
        ['OpenAI Whisper', 'api_key', undefined, whisperParams],
        ['Suno AI', 'api_key', undefined, sunoParams],
        ['Udio', 'api_key', undefined, udioParams],
        ['Voicemod', 'api_key', undefined, voicemodParams],
      ]),
    ],
  },
  {
    id: 'db-store',
    title: 'Data, Storage & Database',
    subcategories: [
      withBlocks('databases', 'Relational & NoSQL Databases', [
        ['Supabase', 'free', undefined, supabaseParams, supabaseCredentials],
        ['MongoDB Atlas', 'free', undefined, mongoParams, mongoCredentials],
        ['PlanetScale', 'api_key', undefined, sqlDatabaseParams],
        ['Redis', 'free', undefined, redisParams, redisCredentials],
        ['Firebase', 'free', undefined, firebaseParams, firebaseCredentials],
        ['CockroachDB', 'free', undefined, sqlDatabaseParams],
        ['FaunaDB', 'free', undefined, faunaDBParams],
        ['MariaDB', 'free', undefined, sqlDatabaseParams],
        ['MySQL', 'free', undefined, sqlDatabaseParams],
        ['Neo4j', 'api_key', undefined, graphDatabaseParams],
        ['SurrealDB', 'free', undefined, surrealDBParams],
        ['Turso', 'free', undefined, tursoParams],
      ]),
      withBlocks('cloud-storage-cdn', 'Cloud File Storage & CDN', [
        ['Google Drive', 'free', undefined, googledriveParams],
        ['Dropbox', 'free', undefined, dropboxParams],
        ['Box', 'free', undefined, boxParams],
        ['OneDrive', 'free', undefined, oneDriveParams],
        ['AWS S3', 'api_key', undefined, s3Params, s3Credentials],
        ['Google Cloud Storage', 'api_key', undefined, googleCloudStorageParams],
        ['Azure Blob', 'api_key', undefined, azureBlobParams],
        ['Backblaze B2', 'api_key', undefined, backblazeB2Params],
        ['pCloud', 'api_key', undefined, pCloudParams],
        ['Cloudinary', 'free', undefined, cloudinaryParams, cloudinaryCredentials],
        ['ImageKit', 'free', undefined, imageKitParams],
        ['Fastly', 'api_key', undefined, cdnControlParams],
        ['Akamai', 'api_key', undefined, cdnControlParams],
      ]),
      withBlocks('spreadsheets', 'Spreadsheets & Productive Databases', [
        ['Airtable', 'free', undefined, airtableParams, airtableCredentials],
        ['Google Sheets', 'free', undefined, googlesheetParams],
        ['Excel Online', 'free', undefined, spreadsheetParams],
        ['Smartsheet', 'api_key', undefined, spreadsheetParams],
        ['Coda', 'free', undefined, spreadsheetParams],
        ['Notion', 'free', undefined, notionParams, notionCredentials],
        ['Baserow', 'free', undefined, spreadsheetParams],
        ['SeaTable', 'free', undefined, spreadsheetParams],
        ['Grist', 'free', undefined, spreadsheetParams],
      ]),
    ],
  },
  {
    id: 'dev-ops',
    title: 'Developer Tools & DevOps',
    subcategories: [
      withBlocks('code-cicd', 'Code & CI/CD', [
        ['GitHub', 'free', undefined, githubParams],
        ['GitLab', 'free', undefined, gitlabParams, gitlabCredentials],
        ['Bitbucket', 'free', undefined, bitbucketParams, bitbucketCredentials],
        ['Azure DevOps', 'api_key', undefined, devOpsParams],
        ['Gitea', 'free', undefined, devOpsParams],
        ['CircleCI', 'api_key', undefined, circleciParams, circleciCredentials],
        ['Travis CI', 'api_key', undefined, devOpsParams],
        ['Jenkins', 'free', undefined, jenkinsParams, jenkinsCredentials],
        ['SonarQube', 'free', undefined, devOpsParams],
      ]),
      withBlocks('monitoring', 'Monitoring & Infrastructure', [
        ['Sentry', 'free', undefined, sentryParams, sentryCredentials],
        ['Datadog', 'api_key', undefined, datadogParams, datadogCredentials],
        ['New Relic', 'api_key', undefined, monitoringParams],
        ['LogRocket', 'api_key', undefined, monitoringParams],
        ['Honeycomb', 'free'],
        ['BetterStack', 'free'],
        ['Pingdom', 'api_key', undefined, monitoringParams],
        ['UptimeRobot', 'free', undefined, uptimeRobotParams],
        ['Vercel', 'free', undefined, vercelParams],
        ['Netlify', 'free', undefined, netlifyParams],
        ['Docker Hub', 'free', undefined, dockerhubParams],
      ]),
    ],
  },
  {
    id: 'fin-eco',
    title: 'Finance & E-Commerce',
    subcategories: [
      withBlocks('payments', 'Payment Gateways', [
        ['Stripe', 'api_key', undefined, stripeParams, stripeCredentials],
        ['PayPal', 'free', undefined, paypalParams, paypalCredentials],
        ['Square', 'api_key', undefined, squareParams, squareCredentials],
        ['Adyen', 'api_key', undefined, paymentGatewayParams],
        ['Braintree', 'api_key', undefined, paymentGatewayParams],
        ['Lemon Squeezy', 'api_key', undefined, paymentGatewayParams],
        ['Paddle', 'api_key', undefined, paymentGatewayParams],
        ['Mollie', 'api_key', undefined, paymentGatewayParams],
        ['Razorpay', 'api_key', undefined, paymentGatewayParams],
        ['Authorize.net', 'api_key', undefined, paymentGatewayParams],
      ]),
      withBlocks('storefronts', 'E-commerce & Storefronts', [
        ['Shopify', 'api_key', undefined, shopifyParams, shopifyCredentials],
        ['WooCommerce', 'free', undefined, woocommerceParams, woocommerceCredentials],
        ['Magento', 'free', undefined, storefrontParams],
        ['BigCommerce', 'api_key', undefined, storefrontParams],
        ['Gumroad', 'free', undefined, storefrontParams],
        ['Etsy', 'api_key', undefined, storefrontParams],
        ['Amazon Seller', 'api_key', undefined, storefrontParams],
        ['Wix Stores', 'api_key', undefined, storefrontParams],
        ['Squarespace', 'api_key', undefined, storefrontParams],
        ['Printful', 'api_key', undefined, storefrontParams],
      ]),
    ],
  },
  {
    id: 'support',
    title: 'Customer Support & Feedback',
    subcategories: [
      withBlocks('help-desk', 'Help Desk & Ticketing', [
        ['Zendesk', 'api_key', undefined, zendeskParams, zendeskCredentials],
        ['Freshdesk', 'free', undefined, supportParams],
        ['Gorgias', 'api_key', undefined, supportParams],
        ['Help Scout', 'api_key', undefined, helpScoutParams, helpScoutCredentials],
        ['Front', 'api_key', undefined, frontParams, frontCredentials],
        ['Intercom', 'api_key', undefined, intercomParams, intercomCredentials],
        ['Kustomer', 'api_key', undefined, kustomerParams, kustomerCredentials],
        ['Gladly', 'api_key', undefined, gladlyParams, gladlyCredentials],
      ]),
      withBlocks('live-chat', 'Live Chat & Chatbots', [
        ['Crisp', 'free', undefined, crispParams, crispCredentials], ['Tawk.to', 'free', undefined, tawkToParams, tawkToCredentials], ['Drift', 'api_key', undefined, driftParams, driftCredentials], ['ManyChat', 'free', undefined, manyChatParams, manyChatCredentials], ['Chatbase', 'api_key', undefined, chatbaseParams, chatbaseCredentials],
        ['Landbot', 'free', undefined, landbotParams, landbotCredentials], ['LiveChat', 'api_key', undefined, liveChatParams, liveChatCredentials],
      ]),
      withBlocks('surveys', 'Surveys & User Feedback', [
        ['Typeform', 'free', undefined, typeformParams, typeformCredentials], ['Jotform', 'free', undefined, jotformParams, jotformCredentials], ['Tally.so', 'free', undefined, tallyParams, tallyCredentials], ['SurveyMonkey', 'api_key', undefined, surveyMonkeyParams, surveyMonkeyCredentials], ['Hotjar', 'free'],
        ['UserTesting', 'api_key', undefined, userTestingParams, userTestingCredentials], ['Qualtrics', 'api_key', undefined, qualtricsParams, qualtricsCredentials],
      ]),
    ],
  },
  {
    id: 'mkt-sales',
    title: 'Marketing & Sales',
    subcategories: [
      withBlocks('crm', 'CRM & Pipeline', [
        ['Salesforce', 'api_key', undefined, salesforceParams, salesforceCredentials],
        ['HubSpot', 'free', undefined, hubspotParams, hubspotCredentials],
        ['Pipedrive', 'api_key', undefined, pipedriveParams, pipedriveCredentials],
        ['Zoho CRM', 'free', undefined, zohoCRMParams, zohoCRMCredentials],
        ['Copper', 'api_key', undefined, copperParams, copperCredentials],
        ['Keap', 'api_key', undefined, keapParams, keapCredentials],
        ['Close.com', 'api_key', undefined, closeParams, closeCredentials],
        ['Attio', 'free', undefined, attioParams, attioCredentials],
        ['Folk', 'free', undefined, folkParams, folkCredentials],
        ['Apollo.io', 'api_key', undefined, apolloParams, apolloCredentials],
      ]),
      withBlocks('ads-growth', 'Ads & Growth', [
        ['Google Ads', 'api_key', undefined, googleadsParams, googleadsCredentials], ['Meta Ads', 'api_key', undefined, metaadsParams, metaadsCredentials], ['LinkedIn Ads', 'api_key', undefined, linkedInAdsParams, linkedInAdsCredentials], ['TikTok Ads', 'api_key', undefined, tiktokAdsParams, tiktokAdsCredentials],
        ['Mixpanel', 'free', undefined, mixpanelParams, mixpanelCredentials], ['Amplitude', 'free', undefined, amplitudeParams, amplitudeCredentials], ['Segment', 'free', undefined, segmentParams, segmentCredentials], ['Clearbit', 'api_key', undefined, clearbitParams, clearbitCredentials],
      ]),
    ],
  },
  {
    id: 'pm-km',
    title: 'Project & Knowledge Management',
    subcategories: [
      withBlocks('tasks', 'Task Management', [
        ['Asana', 'free'], ['Trello', 'free'], ['ClickUp', 'free'], ['Linear', 'free'], ['Monday.com', 'api_key', undefined, mondayComParams, mondayComCredentials],
        ['Jira', 'api_key', undefined, jiraParams, jiraCredentials], ['Basecamp', 'api_key', undefined, basecampParams, basecampCredentials], ['Todoist', 'free', undefined, todoistParams, todoistCredentials], ['TickTick', 'api_key', undefined, ticktickParams, ticktickCredentials],
      ]),
      withBlocks('notes-wiki', 'Notes & Wiki', [
        ['Notion', 'free', undefined, notionParams, notionCredentials], ['Obsidian Sync', 'api_key'], ['Confluence', 'api_key', undefined, confluenceParams, confluenceCredentials], ['Slite', 'free', undefined, sliteParams, sliteCredentials], ['GitBook', 'free', undefined, gitbookParams, gitbookCredentials],
        ['Guru', 'api_key', undefined, guruParams, guruCredentials], ['Slab', 'api_key', undefined, slabParams, slabCredentials], ['Evernote', 'api_key', undefined, evernoteParams, evernoteCredentials],
      ]),
    ],
  },
  {
    id: 'web3',
    title: 'Web3 & Blockchain',
    subcategories: [
      withBlocks('chains-wallets', 'Chains & Wallets', [
        ['Ethereum/Alchemy', 'free', undefined, web3Params], ['Solana/Helius', 'free', undefined, web3Params], ['Polygon', 'free', undefined, web3Params], ['WalletConnect', 'free', undefined, web3Params],
        ['Coinbase Cloud', 'api_key', undefined, web3Params], ['Infura', 'free', undefined, web3Params], ['Moralis', 'free', undefined, web3Params],
      ]),
      withBlocks('markets-nft', 'Market Data & NFTs', [
        ['CoinGecko', 'free', undefined, marketDataParams], ['CoinMarketCap', 'api_key', undefined, marketDataParams], ['OpenSea', 'api_key', undefined, marketDataParams], ['Magic Eden', 'api_key', undefined, marketDataParams],
        ['Etherscan', 'free', undefined, marketDataParams], ['Rarible', 'api_key', undefined, marketDataParams],
      ]),
    ],
  },
  {
    id: 'security',
    title: 'Cybersecurity & IT',
    subcategories: [
      withBlocks('identity', 'Identity & Access', [
        ['Okta', 'api_key'], ['Auth0', 'free', undefined, identityParams], ['Clerk', 'free', undefined, identityParams], ['Stytch', 'api_key', undefined, identityParams], ['Kinde', 'free', undefined, identityParams],
        ['1Password', 'api_key', undefined, identityParams], ['Dashlane', 'api_key', undefined, identityParams],
      ]),
      withBlocks('threat-intel', 'Threat Intel & Security', [
        ['VirusTotal', 'free', undefined, securityParams], ['HaveIBeenPwned', 'api_key', undefined, securityParams], ['Shodan', 'api_key', undefined, securityParams], ['Cloudflare Security', 'free', undefined, securityParams],
        ['CrowdStrike', 'api_key', undefined, securityParams], ['Splunk', 'api_key', undefined, securityParams],
      ]),
    ],
  },
  {
    id: 'util-iot',
    title: 'Utilities & IoT',
    subcategories: [
      withBlocks('environment', 'Environment', [
        ['OpenWeatherMap', 'free', undefined, weatherParams], ['Tomorrow.io', 'free', undefined, weatherParams], ['AccuWeather', 'api_key', undefined, weatherParams], ['Google Maps', 'api_key'],
        ['Mapbox', 'free', undefined, weatherParams], ['AirVisual', 'api_key', undefined, weatherParams],
      ]),
      withBlocks('smart-home', 'Smart Home', [
        ['Philips Hue', 'api_key', undefined, iotParams], ['Nest', 'api_key', undefined, iotParams], ['IFTTT', 'free', undefined, iotParams], ['Home Assistant', 'free', undefined, iotParams], ['Shelly', 'free', undefined, iotParams], ['Tuya', 'api_key', undefined, iotParams],
      ]),
    ],
  },
  {
    id: 'internal',
    title: 'System & Logic Blocks',
    subcategories: [
      withBlocks('triggers', 'Triggers', [
        ['Schedule (Cron)', 'internal', undefined, cronParams, undefined, undefined, true],
        ['Webhook (Catch)', 'internal', undefined, webhookParams, undefined, undefined, true],
        ['RSS Monitor', 'internal', undefined, rssMonitorParams, undefined, undefined, true],
        ['New Email', 'internal', undefined, newEmailParams, undefined, undefined, true],
        ['FTP Monitor', 'internal', undefined, ftpMonitorParams, undefined, undefined, true],
        ['File Watcher', 'internal', undefined, fileWatcherParams, undefined, undefined, true],
        ['Database Change', 'internal', undefined, dbChangeParams, undefined, undefined, true],
        ['Queue Consumer', 'internal', undefined, queueConsumerParams, undefined, undefined, true],
        ['Manual Trigger', 'internal', undefined, manualTriggerParams, undefined, undefined, true],
        ['Event Bus Listener', 'internal', undefined, undefined, undefined, undefined, true],
      ]),
      withBlocks('logic', 'Logic', [
        ['Filter', 'internal'], ['Router', 'internal'], ['Loop', 'internal'], ['Delay', 'internal'], ['Wait for Approval', 'internal'], ['Error Handler', 'internal'],
        ['Switch/Case', 'internal'], ['Merge', 'internal'], ['Parallel Split', 'internal'], ['Debounce', 'internal'], ['Rate Limiter', 'internal'],
        ['Retry', 'internal'], ['Circuit Breaker', 'internal'], ['Sub-Workflow', 'internal'],
      ]),
      withBlocks('data', 'Data', [
        ['Text Formatter', 'internal'], ['Date Formatter', 'internal'], ['Math', 'internal'], ['JSON Parser', 'internal'],
        ['JS/Python Code', 'internal'], ['CSV Generator', 'internal'], ['PDF Creator', 'internal'],
        ['XML Parser', 'internal'], ['YAML Parser', 'internal'], ['Base64 Encode/Decode', 'internal'],
        ['Hash Generator', 'internal'], ['UUID Generator', 'internal'], ['Regex Extractor', 'internal'],
        ['HTML Parser', 'internal'], ['Markdown to HTML', 'internal'], ['Image Resizer', 'internal'],
        ['QR Code Generator', 'internal'], ['Barcode Generator', 'internal'],
      ]),
    ],
  },
  {
    id: 'social',
    title: 'Social Media & Content',
    subcategories: [
      withBlocks('social-platforms', 'Social Platforms', [
        ['Twitter/X', 'api_key', undefined, twitterParams, twitterCredentials],
        ['Instagram', 'api_key', undefined, socialPostParams], ['Facebook Pages', 'api_key', undefined, socialPostParams], ['LinkedIn', 'api_key', undefined, socialPostParams],
        ['TikTok', 'api_key', undefined, socialPostParams], ['Pinterest', 'api_key', undefined, socialPostParams], ['Reddit', 'api_key', undefined, socialPostParams],
        ['YouTube', 'api_key', undefined, socialPostParams], ['Mastodon', 'free', undefined, socialPostParams], ['Bluesky', 'free', undefined, socialPostParams],
        ['Threads', 'api_key', undefined, socialPostParams], ['Tumblr', 'api_key', undefined, socialPostParams],
      ]),
      withBlocks('social-management', 'Social Management & Scheduling', [
        ['Buffer', 'api_key', undefined, socialManagementParams], ['Hootsuite', 'api_key', undefined, socialManagementParams], ['Later', 'api_key', undefined, socialManagementParams],
        ['Sprout Social', 'api_key', undefined, socialManagementParams], ['SocialBee', 'api_key', undefined, socialManagementParams], ['Publer', 'api_key', undefined, socialManagementParams],
      ]),
      withBlocks('content-cms', 'Content & CMS', [
        ['WordPress', 'api_key', undefined, cmsParams], ['Ghost', 'api_key', undefined, cmsParams], ['Strapi', 'free', undefined, cmsParams],
        ['Contentful', 'api_key', undefined, cmsParams], ['Sanity', 'free', undefined, cmsParams], ['Prismic', 'api_key', undefined, cmsParams],
        ['Webflow', 'api_key', undefined, cmsParams], ['Medium', 'free', undefined, cmsParams], ['Hashnode', 'free', undefined, cmsParams],
        ['Dev.to', 'free', undefined, cmsParams], ['Substack', 'api_key', undefined, cmsParams],
      ]),
      withBlocks('news-media', 'News & Media APIs', [
        ['NewsAPI', 'api_key', undefined, newsapiParams],
        ['GNews', 'api_key', undefined, gnewsParams],
      ]),
      withBlocks('audio-video-editing', 'Audio & Video Editing APIs', [
        ['Descript', 'api_key', undefined, descriptParams],
      ]),
    ],
  },
  {
    id: 'verticals',
    title: 'Specialized Verticals',
    subcategories: [
      withBlocks('hr', 'HR & Recruiting', [
        ['Workday', 'api_key', undefined, hrParams], ['BambooHR', 'api_key', undefined, hrParams], ['Greenhouse', 'api_key', undefined, hrParams], ['Lever', 'api_key', undefined, hrParams], ['Ashby', 'api_key', undefined, hrParams],
        ['HiBob', 'api_key', undefined, hrParams], ['Gusto', 'api_key', undefined, hrParams], ['Rippling', 'api_key', undefined, hrParams], ['Deel', 'api_key', undefined, hrParams], ['Remote.com', 'api_key', undefined, hrParams],
      ]),
      withBlocks('edtech', 'Education (EdTech)', [
        ['Canvas', 'free', undefined, trainingParams], ['Moodle', 'free', undefined, trainingParams], ['Teachable', 'api_key', undefined, trainingParams], ['Kajabi', 'api_key', undefined, trainingParams], ['Coursera', 'api_key', undefined, trainingParams], ['Duolingo', 'api_key', undefined, trainingParams],
        ['Udemy', 'api_key', undefined, trainingParams], ['Thinkific', 'api_key', undefined, trainingParams], ['Podia', 'api_key', undefined, trainingParams],
      ]),
      withBlocks('legal', 'Legal & E-Signature', [
        ['DocuSign', 'api_key', undefined, eSignParams], ['Dropbox Sign', 'api_key', undefined, eSignParams], ['Ironclad', 'api_key', undefined, eSignParams], ['Clio', 'api_key', undefined, eSignParams], ['PandaDoc', 'api_key', undefined, eSignParams],
        ['SignNow', 'api_key', undefined, eSignParams], ['Juro', 'api_key', undefined, eSignParams],
      ]),
      withBlocks('healthcare', 'Healthcare', [
        ['Epic', 'api_key', undefined, healthParams], ['Cerner', 'api_key', undefined, healthParams], ['Healthie', 'api_key', undefined, healthParams], ['Redox', 'api_key', undefined, healthParams], ['Fitbit', 'free', undefined, healthParams], ['Strava', 'free', undefined, healthParams],
        ['Withings', 'api_key', undefined, healthParams], ['Apple Health', 'free', undefined, healthParams], ['Google Fit', 'free', undefined, healthParams],
      ]),
      withBlocks('logistics-real-estate', 'Logistics & Real Estate', [
        ['AfterShip', 'api_key', undefined, logisticsParams], ['Shippo', 'api_key', undefined, logisticsParams], ['EasyPost', 'api_key', undefined, logisticsParams], ['Zillow', 'api_key', undefined, logisticsParams], ['Airbnb', 'api_key', undefined, logisticsParams], ['Uber', 'api_key', undefined, logisticsParams],
        ['DoorDash', 'api_key', undefined, logisticsParams], ['FedEx', 'api_key', undefined, logisticsParams], ['UPS', 'api_key', undefined, logisticsParams], ['USPS', 'free', undefined, logisticsParams],
      ]),
      withBlocks('accounting', 'Accounting & Finance', [
        ['QuickBooks', 'api_key', undefined, financeParams], ['Xero', 'api_key', undefined, financeParams], ['FreshBooks', 'api_key', undefined, financeParams], ['Wave', 'free', undefined, financeParams],
        ['Plaid', 'api_key', undefined, financeParams], ['Wise', 'api_key', undefined, financeParams], ['Mercury', 'api_key', undefined, financeParams],
      ]),
      withBlocks('design', 'Design & Creative', [
        ['Figma', 'api_key', undefined, designParams], ['Canva', 'api_key', undefined, designParams], ['Adobe Creative Cloud', 'api_key', undefined, designParams],
        ['InVision', 'api_key', undefined, designParams], ['Sketch', 'api_key', undefined, designParams], ['Framer', 'free', undefined, designParams],
      ]),
    ],
  },
  {
    id: 'notification',
    title: 'Notifications & Alerts',
    subcategories: [
      withBlocks('push-notify', 'Push Notifications', [
        ['Firebase Cloud Messaging', 'free', undefined, notificationParams], ['OneSignal', 'free', undefined, notificationParams], ['Pusher Beams', 'api_key', undefined, notificationParams],
        ['Novu', 'free', undefined, notificationParams], ['Knock', 'api_key', undefined, notificationParams], ['MagicBell', 'api_key', undefined, notificationParams],
        ['Courier', 'api_key', undefined, notificationParams], ['Engagespot', 'free', undefined, notificationParams],
      ]),
      withBlocks('alerts', 'Alerting & Incident', [
        ['PagerDuty', 'api_key', undefined, alertParams], ['OpsGenie', 'api_key', undefined, alertParams], ['VictorOps', 'api_key', undefined, alertParams],
        ['StatusPage', 'api_key', undefined, alertParams], ['Instatus', 'free', undefined, alertParams], ['Cachet', 'free', undefined, alertParams],
      ]),
    ],
  },
  {
    id: 'search-analytics',
    title: 'Search & Analytics',
    subcategories: [
      withBlocks('search-engines', 'Search Engines', [
        ['Algolia', 'api_key', undefined, searchParams], ['Elasticsearch', 'free', undefined, searchParams], ['Meilisearch', 'free', undefined, searchParams],
        ['Typesense', 'free', undefined, searchParams], ['Pinecone', 'api_key', undefined, searchParams], ['Weaviate', 'free', undefined, searchParams],
        ['Qdrant', 'free', undefined, searchParams], ['ChromaDB', 'free', undefined, searchParams],
      ]),
      withBlocks('analytics-bi', 'Analytics & BI', [
        ['Google Analytics', 'api_key', undefined, analyticsParams], ['Plausible', 'free', undefined, analyticsParams], ['PostHog', 'free', undefined, analyticsParams],
        ['Metabase', 'free', undefined, analyticsParams], ['Looker', 'api_key', undefined, analyticsParams], ['Tableau', 'api_key', undefined, analyticsParams],
        ['Apache Superset', 'free', undefined, analyticsParams], ['Grafana', 'free', undefined, analyticsParams],
      ]),
      withBlocks('expanded-api-catalog', 'Expanded API Catalog (100)', expandedApiCatalog),
    ],
  },
];

export const ALL_AUTOMATION_BLOCKS = AUTOMATION_INTEGRATION_REGISTRY.flatMap((category) =>
  category.subcategories.flatMap((subcategory) =>
    subcategory.blocks.map((entry) => ({
      ...entry,
      categoryId: category.id,
      categoryTitle: category.title,
      subcategoryId: subcategory.id,
      subcategoryTitle: subcategory.title,
      type: `${category.id}.${subcategory.id}.${entry.id}`,
    })),
  ),
);

export const AUTOMATION_BLOCK_COUNT = ALL_AUTOMATION_BLOCKS.length;
