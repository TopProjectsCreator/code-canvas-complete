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

// ===== Additional Trigger Param Schemas =====
const httpPollingTriggerParams: APIParameter[] = [
  { name: 'url', displayName: 'Endpoint URL', type: 'url', required: true, placeholder: 'https://api.example.com/status' },
  { name: 'method', displayName: 'Method', type: 'select', default: 'GET', options: [{label:'GET',value:'GET'},{label:'POST',value:'POST'}] },
  { name: 'interval_seconds', displayName: 'Poll Interval (seconds)', type: 'number', default: 60, required: true },
  { name: 'change_field', displayName: 'Change Detection Field', type: 'string', placeholder: 'data.updated_at', help: 'JSON path to field; trigger fires when value changes' },
  { name: 'headers', displayName: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization":"Bearer ..."}' },
];

const githubEventTriggerParams: APIParameter[] = [
  { name: 'repo', displayName: 'Repository (owner/name)', type: 'string', required: true, placeholder: 'octocat/hello-world' },
  { name: 'event', displayName: 'Event Type', type: 'select', required: true, default: 'push', options: [
    {label:'Push',value:'push'},{label:'Pull Request',value:'pull_request'},{label:'Issue',value:'issues'},
    {label:'Release',value:'release'},{label:'Workflow Run',value:'workflow_run'},{label:'Star',value:'star'},
  ] },
  { name: 'branch', displayName: 'Branch Filter', type: 'string', placeholder: 'main' },
  { name: 'secret', displayName: 'Webhook Secret', type: 'password', help: 'Validates incoming GitHub webhook signature' },
];

const stripeEventTriggerParams: APIParameter[] = [
  { name: 'event', displayName: 'Stripe Event', type: 'select', required: true, default: 'payment_intent.succeeded', options: [
    {label:'Payment Succeeded',value:'payment_intent.succeeded'},
    {label:'Payment Failed',value:'payment_intent.payment_failed'},
    {label:'Subscription Created',value:'customer.subscription.created'},
    {label:'Subscription Cancelled',value:'customer.subscription.deleted'},
    {label:'Invoice Paid',value:'invoice.paid'},
    {label:'Charge Refunded',value:'charge.refunded'},
  ] },
  { name: 'webhook_secret', displayName: 'Webhook Signing Secret', type: 'password', required: true, placeholder: 'whsec_...' },
  { name: 'livemode', displayName: 'Live Mode Only', type: 'boolean', default: false },
];

const slackEventTriggerParams: APIParameter[] = [
  { name: 'event_type', displayName: 'Event Type', type: 'select', required: true, default: 'message', options: [
    {label:'Message',value:'message'},{label:'Mention',value:'app_mention'},
    {label:'Reaction Added',value:'reaction_added'},{label:'File Shared',value:'file_shared'},
    {label:'Channel Created',value:'channel_created'},
  ] },
  { name: 'channel', displayName: 'Channel Filter', type: 'string', placeholder: '#general' },
  { name: 'signing_secret', displayName: 'Signing Secret', type: 'password', required: true },
];

const formSubmissionTriggerParams: APIParameter[] = [
  { name: 'form_id', displayName: 'Form ID', type: 'string', required: true, placeholder: 'contact-form' },
  { name: 'provider', displayName: 'Form Provider', type: 'select', default: 'typeform', options: [
    {label:'Typeform',value:'typeform'},{label:'Google Forms',value:'google_forms'},
    {label:'Tally',value:'tally'},{label:'Jotform',value:'jotform'},{label:'Custom Webhook',value:'custom'},
  ] },
  { name: 'secret', displayName: 'Verification Secret', type: 'password' },
];

const calendarEventTriggerParams: APIParameter[] = [
  { name: 'calendar_id', displayName: 'Calendar ID', type: 'string', required: true, placeholder: 'primary' },
  { name: 'event_type', displayName: 'Event Type', type: 'select', default: 'created', options: [
    {label:'Event Created',value:'created'},{label:'Event Updated',value:'updated'},
    {label:'Event Cancelled',value:'cancelled'},{label:'Event Starting Soon',value:'starting_soon'},
  ] },
  { name: 'lead_minutes', displayName: 'Lead Minutes (for "starting soon")', type: 'number', default: 15 },
];

const sensorTriggerParams: APIParameter[] = [
  { name: 'sensor_id', displayName: 'Sensor / Device ID', type: 'string', required: true },
  { name: 'condition', displayName: 'Condition', type: 'select', default: 'gt', options: [
    {label:'Greater Than',value:'gt'},{label:'Less Than',value:'lt'},
    {label:'Equals',value:'eq'},{label:'Changes',value:'changes'},
  ] },
  { name: 'threshold', displayName: 'Threshold', type: 'number', placeholder: '25' },
  { name: 'cooldown_seconds', displayName: 'Cooldown (seconds)', type: 'number', default: 300 },
];

const mqttTriggerParams: APIParameter[] = [
  { name: 'broker_url', displayName: 'Broker URL', type: 'url', required: true, placeholder: 'mqtt://broker.hivemq.com:1883' },
  { name: 'topic', displayName: 'Topic Pattern', type: 'string', required: true, placeholder: 'sensors/+/temperature' },
  { name: 'qos', displayName: 'QoS', type: 'select', default: '0', options: [{label:'0 - At most once',value:'0'},{label:'1 - At least once',value:'1'},{label:'2 - Exactly once',value:'2'}] },
  { name: 'username', displayName: 'Username', type: 'string' },
  { name: 'password', displayName: 'Password', type: 'password' },
];

const kafkaTriggerParams: APIParameter[] = [
  { name: 'bootstrap_servers', displayName: 'Bootstrap Servers', type: 'string', required: true, placeholder: 'kafka1:9092,kafka2:9092' },
  { name: 'topic', displayName: 'Topic', type: 'string', required: true },
  { name: 'consumer_group', displayName: 'Consumer Group', type: 'string', required: true },
  { name: 'auto_offset_reset', displayName: 'Auto Offset Reset', type: 'select', default: 'latest', options: [{label:'Latest',value:'latest'},{label:'Earliest',value:'earliest'}] },
];

const s3EventTriggerParams: APIParameter[] = [
  { name: 'bucket', displayName: 'Bucket Name', type: 'string', required: true },
  { name: 'prefix', displayName: 'Key Prefix', type: 'string', placeholder: 'uploads/' },
  { name: 'event', displayName: 'Event', type: 'select', default: 's3:ObjectCreated:*', options: [
    {label:'Object Created',value:'s3:ObjectCreated:*'},
    {label:'Object Removed',value:'s3:ObjectRemoved:*'},
    {label:'Object Restore',value:'s3:ObjectRestore:*'},
  ] },
];

const errorTriggerParams: APIParameter[] = [
  { name: 'source_pipeline', displayName: 'Watch Pipeline', type: 'string', placeholder: '* = all pipelines' },
  { name: 'min_severity', displayName: 'Min Severity', type: 'select', default: 'error', options: [
    {label:'Warning',value:'warning'},{label:'Error',value:'error'},{label:'Critical',value:'critical'},
  ] },
];

const chatCommandTriggerParams: APIParameter[] = [
  { name: 'command', displayName: 'Command Phrase', type: 'string', required: true, placeholder: 'run weekly report' },
  { name: 'fuzzy_match', displayName: 'Fuzzy Match', type: 'boolean', default: true },
  { name: 'require_confirmation', displayName: 'Require Confirmation', type: 'boolean', default: true },
];

const sseTriggerParams: APIParameter[] = [
  { name: 'url', displayName: 'SSE Endpoint URL', type: 'url', required: true },
  { name: 'event_filter', displayName: 'Event Name Filter', type: 'string', placeholder: 'message' },
  { name: 'reconnect_seconds', displayName: 'Reconnect Delay (s)', type: 'number', default: 5 },
];

const websocketTriggerParams: APIParameter[] = [
  { name: 'url', displayName: 'WebSocket URL', type: 'url', required: true, placeholder: 'wss://example.com/ws' },
  { name: 'subscribe_message', displayName: 'Subscribe Message (JSON)', type: 'textarea' },
  { name: 'message_filter', displayName: 'Message Filter (JSON path)', type: 'string' },
];

const geofenceTriggerParams: APIParameter[] = [
  { name: 'device_id', displayName: 'Device / Tracker ID', type: 'string', required: true },
  { name: 'latitude', displayName: 'Center Latitude', type: 'number', required: true },
  { name: 'longitude', displayName: 'Center Longitude', type: 'number', required: true },
  { name: 'radius_meters', displayName: 'Radius (meters)', type: 'number', default: 100 },
  { name: 'trigger_on', displayName: 'Trigger On', type: 'select', default: 'enter', options: [{label:'Enter',value:'enter'},{label:'Exit',value:'exit'},{label:'Both',value:'both'}] },
];

const priceAlertTriggerParams: APIParameter[] = [
  { name: 'symbol', displayName: 'Symbol/Ticker', type: 'string', required: true, placeholder: 'AAPL or BTC-USD' },
  { name: 'condition', displayName: 'Condition', type: 'select', default: 'above', options: [{label:'Above',value:'above'},{label:'Below',value:'below'},{label:'% Change',value:'pct_change'}] },
  { name: 'threshold', displayName: 'Threshold', type: 'number', required: true },
  { name: 'check_interval_seconds', displayName: 'Check Interval (s)', type: 'number', default: 60 },
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

const wediscordBotApiParams: APIParameter[] = [
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

const rocketdiscordBotApiParams: APIParameter[] = [
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

// ============ Shared Cloud / Platform API Params (for unique expanded catalog entries) ============

const cloudApiParams: APIParameter[] = [
  { name: 'resource', displayName: 'Resource Path', type: 'string', required: true, placeholder: 'projects/my-project/locations/us-central1' },
  { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/get/create/update/delete' },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"key": "value"}' },
];

const awsApiParams: APIParameter[] = [
  { name: 'region', displayName: 'AWS Region', type: 'string', default: 'us-east-1' },
  { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'ListFunctions/Invoke/CreateFunction' },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea', placeholder: '{"FunctionName":"my-func"}' },
];

const azureApiParams: APIParameter[] = [
  { name: 'resource_group', displayName: 'Resource Group', type: 'string', required: true },
  { name: 'operation', displayName: 'Operation', type: 'string', required: true },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea' },
];

const msGraphApiParams: APIParameter[] = [
  { name: 'tenant_id', displayName: 'Tenant ID', type: 'string', required: true, placeholder: 'common' },
  { name: 'resource', displayName: 'Resource', type: 'string', required: true, placeholder: 'users/user-id/messages' },
  { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/get/create/update' },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea' },
];

const databaseQueryParams: APIParameter[] = [
  { name: 'connection_string', displayName: 'Connection String', type: 'password', required: true },
  { name: 'query', displayName: 'SQL / Query', type: 'textarea', required: true },
  { name: 'params', displayName: 'Parameters (JSON)', type: 'textarea', placeholder: '{"param1":"value1"}' },
];

const calendarApiParams: APIParameter[] = [
  { name: 'calendar_id', displayName: 'Calendar ID', type: 'string', default: 'primary' },
  { name: 'operation', displayName: 'Operation', type: 'select', default: 'list_events', options: [
    { label: 'List Events', value: 'list_events' },
    { label: 'Create Event', value: 'create_event' },
    { label: 'Update Event', value: 'update_event' },
    { label: 'Delete Event', value: 'delete_event' },
  ]},
  { name: 'time_min', displayName: 'Time Min (RFC3339)', type: 'string', placeholder: '2026-01-01T00:00:00Z' },
  { name: 'time_max', displayName: 'Time Max (RFC3339)', type: 'string', placeholder: '2026-12-31T23:59:59Z' },
];

const googleServiceParams: APIParameter[] = [
  { name: 'project_id', displayName: 'Project ID', type: 'string', required: true },
  { name: 'operation', displayName: 'Operation', type: 'string', required: true, placeholder: 'list/get/create' },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea' },
];

const mailchimpMarketingParams: APIParameter[] = [
  { name: 'audience_id', displayName: 'Audience ID', type: 'string', required: true },
  { name: 'operation', displayName: 'Operation', type: 'select', default: 'add_member', options: [
    { label: 'Add Member', value: 'add_member' },
    { label: 'Create Campaign', value: 'create_campaign' },
    { label: 'Send Campaign', value: 'send_campaign' },
    { label: 'Get Reports', value: 'get_reports' },
  ]},
  { name: 'email', displayName: 'Email Address', type: 'email' },
  { name: 'payload', displayName: 'Payload (JSON)', type: 'textarea' },
];

const klaviyoParams: APIParameter[] = [
  { name: 'operation', displayName: 'Operation', type: 'select', default: 'track_event', options: [
    { label: 'Track Event', value: 'track_event' },
    { label: 'Identify Profile', value: 'identify_profile' },
    { label: 'Get Profiles', value: 'get_profiles' },
    { label: 'Create List', value: 'create_list' },
  ]},
  { name: 'event_name', displayName: 'Event Name', type: 'string', placeholder: 'Placed Order' },
  { name: 'customer_properties', displayName: 'Customer Properties (JSON)', type: 'textarea', placeholder: '{"$email":"user@example.com"}' },
  { name: 'properties', displayName: 'Event Properties (JSON)', type: 'textarea', placeholder: '{"value":29.99}' },
];

const stripeRadarApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const plaidTransactionsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const hubspotMarketingApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const salesforceBulkApi2Params: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const zendeskTicketsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const intercomContactsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const notionBlocksApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const airtableWebApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];

const adyenTransfersApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const braintreeVaultApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const fedexRatesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const upsTrackingApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const uspsAddressApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const shippoShipmentsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const easypostTrackerApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const openweatherGeocodingApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const mapboxGeocodingApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const googleMapsRoutesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const tomtomSearchApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const hereGeocodingApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const algoliaRecommendApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const elasticsearchSqlApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const meilisearchTasksApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const typesenseDocumentsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const pineconeInferenceApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const weaviateBatchApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const qdrantCollectionsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const googleAnalyticsAdminApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const posthogFeatureFlagsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const plausibleSitesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const datadogLogsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const newRelicLogsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const sentryReleasesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const grafanaAlertingApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const cloudflareWorkersApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const githubChecksApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const gitlabMergeRequestsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const bitbucketPipelinesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const circleciInsightsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const jenkinsCrumbApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const dockerHubReposApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const openaiFilesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const anthropicBatchesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const mistralOcrApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const cohereEmbedApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const perplexitySearchApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const replicatePredictionsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const runwayTasksApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const stabilityImageApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const elevenlabsVoicesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const assemblyaiTranscriptApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const deepgramListenApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const zoomRecordingsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const googleMeetSpacesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const microsoftGraphUsersApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const outlookMailApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const dropboxFilesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const googleDrivePermissionsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const oneDriveItemsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const boxFoldersApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const airtableMetadataApiV3Params: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const smartsheetSheetsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const codaRowsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const quickbooksInvoicesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const xeroContactsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const wiseTransfersApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const docusignEnvelopesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const dropboxSignRequestsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const pandadocDocumentsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const auth0UsersApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const oktaGroupsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const clerkUsersApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const stytchMagicLinksApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const kindeOauthApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const virustotalUrlsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const shodanHostApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const haveibeenpwnedBreachApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const crowdstrikeAlertsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const splunkSearchApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const pagerdutyIncidentsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const opsgenieAlertsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const statuspageComponentsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const novuEventsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const courierSendApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const knockWorkflowsApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];

const shipstationApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'ShipStation shipments/orders API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const delhiveryApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Delhivery waybill and tracking API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const dhlParcelApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'DHL parcel create/track endpoints.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const aftershipApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'AfterShip trackers and notifications API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const easyshipApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'EasyShip rates and shipments API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const bringgApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Bringg tasks and driver dispatch API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const onfleetApiParams: APIParameter[] = [
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, default: 'create_task', options: [
    { label: 'Create Task', value: 'create_task' },
    { label: 'List Tasks', value: 'list_tasks' },
    { label: 'Get Task', value: 'get_task' },
    { label: 'Create Destination', value: 'create_destination' },
    { label: 'List Teams', value: 'list_teams' },
    { label: 'List Workers', value: 'list_workers' },
  ]},
  { name: 'task_id', displayName: 'Task ID', type: 'string', description: 'The unique task ID for get/update operations.' },
  { name: 'destination_address', displayName: 'Destination Address', type: 'textarea', description: 'Full address string (e.g. "1 Warriors Way, San Francisco, CA").' },
  { name: 'recipient_name', displayName: 'Recipient Name', type: 'string', description: 'Name of the delivery recipient.' },
  { name: 'recipient_phone', displayName: 'Recipient Phone', type: 'string', description: 'Phone number of the recipient.' },
  { name: 'notes', displayName: 'Notes', type: 'textarea', description: 'Delivery/pickup notes for the task.' },
  { name: 'complete_after', displayName: 'Complete After (Unix ms)', type: 'string', description: 'Earliest completion time in milliseconds.' },
  { name: 'complete_before', displayName: 'Complete Before (Unix ms)', type: 'string', description: 'Latest completion time in milliseconds.' },
  { name: 'quantity', displayName: 'Quantity', type: 'number', description: 'Number of items for this task.' },
];
const project44ApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'project44 shipment visibility API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const fourkitesApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'FourKites tracking and milestones API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const weatherapiComApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'WeatherAPI forecast/current/history endpoints.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const openMeteoApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Open-Meteo weather and geocoding API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const tomorrowIoApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Tomorrow.io timelines and realtime API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const visualCrossingApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Visual Crossing weather timelines API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const aviationstackApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'AviationStack flights/airports API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const amadeusTravelApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Amadeus flights/hotels/travel APIs.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const skyscannerApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Skyscanner flight search API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const rome2rioApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Rome2Rio routes and transport API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const openChargeMapApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'OpenChargeMap charging locations API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const nrelAltFuelApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'NREL alternative fueling station API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const cloudinaryAdminApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Cloudinary assets and transformations API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const imgixManagementApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Imgix sources and rendering API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];
const muxVideoApiParams: APIParameter[] = [
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, default: 'create_asset', options: [
    { label: 'Create Asset', value: 'create_asset' },
    { label: 'Get Asset', value: 'get_asset' },
    { label: 'Create Playback ID', value: 'create_playback_id' },
    { label: 'List Assets', value: 'list_assets' },
    { label: 'Create Upload URL', value: 'create_upload_url' },
  ]},
  { name: 'asset_id', displayName: 'Asset ID', type: 'string', description: 'The unique Mux asset ID.' },
  { name: 'input_url', displayName: 'Input Video URL', type: 'url', description: 'Public URL of the video to ingest.' },
  { name: 'playback_policy', displayName: 'Playback Policy', type: 'select', default: 'public', options: [
    { label: 'Public', value: 'public' },
    { label: 'Signed', value: 'signed' },
    { label: 'DRM', value: 'drm' },
  ]},
  { name: 'video_quality', displayName: 'Video Quality', type: 'select', default: 'basic', options: [
    { label: 'Basic', value: 'basic' },
    { label: 'Plus', value: 'plus' },
    { label: 'Premium', value: 'premium' },
  ]},
];
const vimeoApiParams: APIParameter[] = [{ name: 'operation', displayName: 'Operation', type: 'string', required: true, description: 'Vimeo videos/showcases API.' }, { name: 'resource_id', displayName: 'Resource ID', type: 'string' }, { name: 'payload_json', displayName: 'Payload (JSON)', type: 'textarea' }];

const s3StorageParams: APIParameter[] = [
  { name: 'bucket', displayName: 'Bucket Name', type: 'string', required: true, description: 'The S3-compatible bucket name.' },
  { name: 'region', displayName: 'Region', type: 'string', description: 'Storage region endpoint.' },
  { name: 'object_key', displayName: 'Object Key', type: 'string', description: 'Path/key of the object within the bucket.' },
  { name: 'operation', displayName: 'Operation', type: 'select', default: 'list_buckets', options: [
    { label: 'List Buckets', value: 'list_buckets' },
    { label: 'List Objects', value: 'list_objects' },
    { label: 'Upload Object', value: 'upload_object' },
    { label: 'Download Object', value: 'download_object' },
    { label: 'Delete Object', value: 'delete_object' },
  ]},
];
const s3StorageCredentials: APIParameter[] = [
  { name: 'access_key', displayName: 'Access Key ID', type: 'password', required: true },
  { name: 'secret_key', displayName: 'Secret Access Key', type: 'password', required: true },
];

const cdnPullZoneParams: APIParameter[] = [
  { name: 'pull_zone_id', displayName: 'Pull Zone ID', type: 'string', description: 'The numeric ID of the pull zone.' },
  { name: 'name', displayName: 'Zone Name', type: 'string', required: true, description: 'Name of the CDN pull zone.' },
  { name: 'origin_url', displayName: 'Origin URL', type: 'url', description: 'Origin server URL for the pull zone.' },
  { name: 'operation', displayName: 'Operation', type: 'select', default: 'list_pull_zones', options: [
    { label: 'List Pull Zones', value: 'list_pull_zones' },
    { label: 'Add Pull Zone', value: 'add_pull_zone' },
    { label: 'Purge Cache', value: 'purge_cache' },
    { label: 'Get Statistics', value: 'get_statistics' },
  ]},
];

const mailerSendParams: APIParameter[] = [
  { name: 'from_email', displayName: 'From Email', type: 'email', required: true, description: 'Verified sender email address.' },
  { name: 'from_name', displayName: 'From Name', type: 'string', description: 'Display name of the sender.' },
  { name: 'to_email', displayName: 'To Email', type: 'email', required: true, description: 'Recipient email address.' },
  { name: 'to_name', displayName: 'To Name', type: 'string', description: 'Display name of the recipient.' },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true, description: 'Email subject line.' },
  { name: 'html', displayName: 'HTML Body', type: 'textarea', description: 'HTML version of the email (required if no text or template_id).' },
  { name: 'text', displayName: 'Text Body', type: 'textarea', description: 'Plain text version of the email (required if no html or template_id).' },
  { name: 'template_id', displayName: 'Template ID', type: 'string', description: 'Pre-built template ID for the email.' },
];

const imageTransformParams: APIParameter[] = [
  { name: 'source_id', displayName: 'Source ID', type: 'string', description: 'Imgix source ID.' },
  { name: 'source_path', displayName: 'Image Path', type: 'string', required: true, description: 'Path to the image in the source.' },
  { name: 'width', displayName: 'Width (px)', type: 'number', description: 'Output image width.' },
  { name: 'height', displayName: 'Height (px)', type: 'number', description: 'Output image height.' },
  { name: 'fit', displayName: 'Fit Mode', type: 'select', default: 'clip', options: [
    { label: 'Clip', value: 'clip' },
    { label: 'Crop', value: 'crop' },
    { label: 'Scale', value: 'scale' },
    { label: 'Fill', value: 'fill' },
    { label: 'Fill Max', value: 'fillmax' },
  ]},
  { name: 'format', displayName: 'Output Format', type: 'select', default: 'auto', options: [
    { label: 'Auto', value: 'auto' },
    { label: 'WebP', value: 'webp' },
    { label: 'JPEG', value: 'jpeg' },
    { label: 'PNG', value: 'png' },
    { label: 'AVIF', value: 'avif' },
  ]},
  { name: 'quality', displayName: 'Quality', type: 'number', default: 75, description: 'Compression quality (1-100).' },
  { name: 'operation', displayName: 'Operation', type: 'select', default: 'render_image', options: [
    { label: 'Render Image', value: 'render_image' },
    { label: 'List Sources', value: 'list_sources' },
    { label: 'Purge Cache', value: 'purge_cache' },
  ]},
];

const nylasEmailParams: APIParameter[] = [
  { name: 'grant_id', displayName: 'Grant ID', type: 'string', required: true, description: 'Nylas grant ID or /me/ for token-scoped access.' },
  { name: 'to_email', displayName: 'To Email', type: 'email', required: true, description: 'Recipient email address.' },
  { name: 'to_name', displayName: 'To Name', type: 'string', description: 'Display name of the recipient.' },
  { name: 'subject', displayName: 'Subject', type: 'string', required: true, description: 'Email subject line.' },
  { name: 'body', displayName: 'Body', type: 'textarea', description: 'Message body (HTML supported unless is_plaintext).' },
  { name: 'is_plaintext', displayName: 'Is Plain Text', type: 'boolean', description: 'When true, body is sent as plain text.' },
  { name: 'cc_email', displayName: 'CC Email', type: 'email', description: 'CC recipient email address.' },
  { name: 'bcc_email', displayName: 'BCC Email', type: 'email', description: 'BCC recipient email address.' },
  { name: 'send_at', displayName: 'Send At (Unix timestamp)', type: 'string', description: 'Schedule delivery at a future Unix timestamp.' },
  { name: 'operation', displayName: 'Operation', type: 'select', default: 'send_message', options: [
    { label: 'Send Message', value: 'send_message' },
    { label: 'List Messages', value: 'list_messages' },
    { label: 'List Calendars', value: 'list_calendars' },
    { label: 'List Contacts', value: 'list_contacts' },
  ]},
];

const freshsalesParams: APIParameter[] = [
  { name: 'operation', displayName: 'Operation', type: 'select', required: true, default: 'create_contact', options: [
    { label: 'Create Contact', value: 'create_contact' },
    { label: 'List Contacts', value: 'list_contacts' },
    { label: 'Get Contact', value: 'get_contact' },
    { label: 'Create Deal', value: 'create_deal' },
    { label: 'List Deals', value: 'list_deals' },
  ]},
  { name: 'contact_id', displayName: 'Contact ID', type: 'number', description: 'The unique contact ID for get/update operations.' },
  { name: 'first_name', displayName: 'First Name', type: 'string', description: 'Contact first name.' },
  { name: 'last_name', displayName: 'Last Name', type: 'string', description: 'Contact last name.' },
  { name: 'email', displayName: 'Email', type: 'email', description: 'Contact email address.' },
  { name: 'mobile_number', displayName: 'Mobile Number', type: 'string', description: 'Contact mobile phone number.' },
  { name: 'deal_name', displayName: 'Deal Name', type: 'string', description: 'Name of the deal.' },
  { name: 'deal_amount', displayName: 'Deal Amount', type: 'string', description: 'Monetary value of the deal.' },
];

const oracleNetworkParams: APIParameter[] = [
  { name: 'contract_address', displayName: 'Contract Address', type: 'string', description: 'On-chain oracle contract address.' },
  { name: 'job_id', displayName: 'Job ID', type: 'string', description: 'Chainlink job specification ID.' },
  { name: 'operation', displayName: 'Operation', type: 'select', default: 'query_price_feed', options: [
    { label: 'Query Price Feed', value: 'query_price_feed' },
    { label: 'Request Randomness', value: 'request_randomness' },
    { label: 'Check Oracle Status', value: 'check_oracle_status' },
  ]},
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
        ['Microsoft Graph Mail', 'api_key', 'Microsoft Graph email send/list API.', msGraphApiParams],
        ['Mailchimp Marketing', 'api_key', undefined, mailchimpMarketingParams],
        ['MailerSend', 'api_key', 'MailerSend transactional email API with personalization/templates.', mailerSendParams],
        ['Nylas', 'api_key', 'Nylas unified email/calendar/contacts API via a single integration.', nylasEmailParams],
      ]),
      withBlocks('team-chat', 'Team Chat & Collaboration', [
        ['Slack', 'free', undefined, slackParams, slackCredentials],
        ['Microsoft Teams', 'free', undefined, teamsParams, teamsCredentials],
        ['Discord', 'free', undefined, discordParams],
        ['Telegram', 'free', undefined, telegramParams, telegramCredentials],
        ['WhatsApp Business', 'api_key', undefined, whatsappParams, whatsappCredentials],
        ['Line', 'free', undefined, lineParams],
        ['WeChat', 'api_key', undefined, wediscordBotApiParams],
        ['Zulip', 'free', undefined, zulipParams],
        ['Mattermost', 'free', undefined, mattermostParams],
        ['Rocket.Chat', 'free', undefined, rocketdiscordBotApiParams],
        ['Google Chat', 'free', undefined, googleChatParams],
        ['Twist', 'free', undefined, twistParams],
        ['Flock', 'free', undefined, discordParams],
        ['Chanty', 'api_key', undefined, discordParams],
        ['Sendbird', 'api_key', 'Sendbird in-app chat/messaging API.', discordParams],
        ['Stream Chat', 'api_key', 'Stream Chat API for messaging and feeds.', discordParams],
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
        ['TextMagic', 'api_key', 'TextMagic SMS messaging API.', twilioParams],
        ['Clickatell', 'api_key', 'Clickatell SMS/chat API.', twilioParams],
        ['Alibaba Cloud SMS', 'api_key', 'Alibaba Cloud SMS notification service.', cloudApiParams],
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
        ['Google Calendar', 'free', 'Google Calendar events list/create/update API.', calendarApiParams],
        ['Microsoft Graph Calendar', 'api_key', 'Microsoft Graph Calendar events API.', calendarApiParams],
        ['BlueJeans', 'api_key', 'BlueJeans video conferencing API.', zoomParams],
        ['GoToMeeting', 'api_key', 'GoToMeeting webinar/scheduling API.', zoomParams],
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
        ['Google Translate', 'free', 'Google Cloud Translation API.', googleServiceParams],
        ['Google Natural Language', 'free', 'Google Natural Language processing API.', googleServiceParams],
        ['AWS Comprehend', 'api_key', 'AWS Comprehend NLP API.', awsApiParams],
        ['Azure OpenAI', 'api_key', 'Azure OpenAI Service chat/completions API.', azureApiParams],
        ['xAI', 'api_key', 'xAI Grok chat/completions API.', openaiParams],
        ['Amazon Bedrock', 'api_key', 'AWS Bedrock foundation model inference API.', awsApiParams],
        ['IBM watsonx', 'api_key', 'IBM watsonx.ai model inference API.', cloudApiParams],
        ['AI21 Labs', 'api_key', 'AI21 Jurassic/Jamba model API.', openaiParams],
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
        ['Google Vision', 'free', 'Google Cloud Vision AI image analysis API.', googleServiceParams],
        ['AWS Rekognition', 'api_key', 'AWS Rekognition image/video analysis API.', awsApiParams],
        ['AWS Textract', 'api_key', 'AWS Textract document text extraction API.', awsApiParams],
        ['Ideogram', 'api_key', 'Ideogram text-to-image generation API.', dalleParams],
        ['Krea', 'api_key', 'Krea AI image/video generation API.', stableParams],
        ['Recraft', 'api_key', 'Recraft AI vector/icon/image generation API.', stableParams],
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
        ['Google BigQuery', 'api_key', 'Google BigQuery data warehouse SQL query API.', databaseQueryParams],
        ['AWS DynamoDB', 'api_key', 'AWS DynamoDB NoSQL database API.', awsApiParams],
        ['Azure Cosmos DB', 'api_key', 'Azure Cosmos DB multi-model database API.', azureApiParams],
        ['Snowflake SQL API', 'api_key', 'Snowflake SQL query execution API.', databaseQueryParams],
        ['BigQuery Data Transfer', 'api_key', 'Google BigQuery Data Transfer API.', googleServiceParams],
        ['Redshift Data API', 'api_key', 'AWS Redshift Data API SQL execution.', awsApiParams],
        ['Postgres HTTP API', 'api_key', 'Generic PostgreSQL HTTP/REST API.', databaseQueryParams],
        ['Cloudflare D1', 'api_key', 'Cloudflare D1 edge SQLite database API.', sqlDatabaseParams],
        ['TimescaleDB', 'api_key', 'TimescaleDB time-series SQL database API.', sqlDatabaseParams],
        ['DuckDB', 'free', 'DuckDB in-process analytical database API.', sqlDatabaseParams],
        ['InfluxDB', 'api_key', 'InfluxDB time-series database query API.', databaseQueryParams],
        ['SingleStore', 'api_key', 'SingleStore distributed SQL database API.', sqlDatabaseParams],
        ['ClickHouse', 'free', 'ClickHouse column-oriented analytics database HTTP API.', databaseQueryParams],
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
        ['Google Photos', 'free', 'Google Photos library/media items API.', googleServiceParams],
        ['Wasabi', 'api_key', 'Wasabi S3-compatible cloud storage buckets/objects API.', s3StorageParams, s3StorageCredentials],
        ['MinIO', 'api_key', 'MinIO S3-compatible object storage for private cloud.', s3StorageParams, s3StorageCredentials],
        ['Bunny.net', 'api_key', 'Bunny.net CDN pull zones, storage zones and cache purge API.', cdnPullZoneParams],
        ['imgix', 'api_key', 'Imgix image CDN rendering pipeline and source management API.', imageTransformParams],
      ]),
      withBlocks('spreadsheets', 'Spreadsheets & Productive Databases', [
        ['Airtable', 'free', undefined, airtableParams, airtableCredentials],
        ['Google Sheets', 'free', undefined, googlesheetParams],
        ['Excel Online', 'free', undefined, spreadsheetParams],
        ['Smartsheet', 'api_key', undefined, spreadsheetParams],
        ['Coda', 'free', undefined, spreadsheetParams],
        ['Baserow', 'free', undefined, spreadsheetParams],
        ['SeaTable', 'free', undefined, spreadsheetParams],
        ['Grist', 'free', undefined, spreadsheetParams],
        ['NocoDB', 'free', 'NocoDB open source Airtable alternative API.', spreadsheetParams],
        ['Rows', 'free', 'Rows spreadsheet with API integrations.', spreadsheetParams],
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
        ['AWS Lambda', 'api_key', 'AWS Lambda serverless function invocation API.', awsApiParams],
        ['AWS Step Functions', 'api_key', 'AWS Step Functions workflow execution API.', awsApiParams],
        ['Terraform Cloud', 'api_key', 'Terraform Cloud workspaces/runs/variables API.', devOpsParams],
        ['Pulumi', 'api_key', 'Pulumi stacks/deployments/ESC API.', devOpsParams],
        ['Ansible', 'api_key', 'Ansible Automation Platform job/playbook API.', devOpsParams],
        ['Railway', 'free', 'Railway deploy platform projects/environments API.', vercelParams],
        ['Render', 'free', 'Render services/deploys/jobs HTTP API.', vercelParams],
        ['Fly.io', 'api_key', 'Fly.io apps/machines/volumes API.', vercelParams],
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
        ['Google Admin SDK', 'free', 'Google Admin SDK directory/reports API.', googleServiceParams],
        ['Google Pub/Sub', 'free', 'Google Pub/Sub messaging and eventing API.', googleServiceParams],
        ['Google Cloud Run Admin', 'free', 'Google Cloud Run services/revisions API.', googleServiceParams],
        ['AWS EventBridge', 'api_key', 'AWS EventBridge event bus/scheduler API.', awsApiParams],
        ['AWS SQS', 'api_key', 'AWS SQS message queue API.', awsApiParams],
        ['AWS CloudWatch', 'api_key', 'AWS CloudWatch metrics/logs/alarms API.', awsApiParams],
        ['Azure Service Bus', 'api_key', 'Azure Service Bus messaging API.', azureApiParams],
        ['Azure Event Grid', 'api_key', 'Azure Event Grid event routing API.', azureApiParams],
        ['Azure Monitor', 'api_key', 'Azure Monitor metrics/logs query API.', azureApiParams],
        ['Checkly', 'api_key', 'Checkly browser/API checks monitoring API.', monitoringParams],
        ['Zabbix', 'api_key', 'Zabbix monitoring platform API.', monitoringParams],
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
        ['Checkout.com', 'api_key', 'Checkout.com payments/sessions/refunds API.', paymentGatewayParams],
        ['Klarna', 'api_key', 'Klarna payments/settlements/customer tokens API.', paymentGatewayParams],
        ['GoCardless', 'api_key', 'GoCardless direct debit payment API.', paymentGatewayParams],
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
        ['Faire', 'api_key', 'Faire wholesale marketplace orders/inventory API.', storefrontParams],
        ['Trove', 'api_key', 'Trove branded goods e-commerce API.', storefrontParams],
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
        ['Zoho Desk', 'free', 'Zoho Desk tickets/contacts/articles API.', supportParams],
        ['Re:amaze', 'api_key', 'Re:amaze customer messaging API.', supportParams],
        ['Tidio', 'free', 'Tidio live chat/chatbot API.', supportParams],
      ]),
      withBlocks('live-chat', 'Live Chat & Chatbots', [
        ['Crisp', 'free', undefined, crispParams, crispCredentials], ['Tawk.to', 'free', undefined, tawkToParams, tawkToCredentials], ['Drift', 'api_key', undefined, driftParams, driftCredentials], ['ManyChat', 'free', undefined, manyChatParams, manyChatCredentials], ['Chatbase', 'api_key', undefined, chatbaseParams, chatbaseCredentials],
        ['Landbot', 'free', undefined, landbotParams, landbotCredentials], ['LiveChat', 'api_key', undefined, liveChatParams, liveChatCredentials],
      ]),
      withBlocks('surveys', 'Surveys & User Feedback', [
        ['Typeform', 'free', undefined, typeformParams, typeformCredentials], ['Jotform', 'free', undefined, jotformParams, jotformCredentials], ['Tally.so', 'free', undefined, tallyParams, tallyCredentials], ['SurveyMonkey', 'api_key', undefined, surveyMonkeyParams, surveyMonkeyCredentials], ['Hotjar', 'free'],
        ['UserTesting', 'api_key', undefined, userTestingParams, userTestingCredentials], ['Qualtrics', 'api_key', undefined, qualtricsParams, qualtricsCredentials],
        ['Google Forms', 'free', 'Google Forms responses retrieval API.', googleServiceParams],
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
        ['Freshsales', 'api_key', 'Freshworks CRM contacts/deals/accounts management API.', freshsalesParams],
        ['Google People', 'free', 'Google People API contacts management.', googleServiceParams],
        ['Google Business Profile', 'free', 'Google Business Profile locations/reviews API.', googleServiceParams],
      ]),
      withBlocks('ads-growth', 'Ads & Growth', [
        ['Google Ads', 'api_key', undefined, googleadsParams, googleadsCredentials], ['Meta Ads', 'api_key', undefined, metaadsParams, metaadsCredentials], ['LinkedIn Ads', 'api_key', undefined, linkedInAdsParams, linkedInAdsCredentials], ['TikTok Ads', 'api_key', undefined, tiktokAdsParams, tiktokAdsCredentials],
        ['Mixpanel', 'free', undefined, mixpanelParams, mixpanelCredentials], ['Amplitude', 'free', undefined, amplitudeParams, amplitudeCredentials], ['Segment', 'free', undefined, segmentParams, segmentCredentials],         ['Clearbit', 'api_key', undefined, clearbitParams, clearbitCredentials],
        ['Klaviyo', 'api_key', 'Klaviyo marketing automation profiles/events API.', klaviyoParams],
        ['ConvertKit', 'api_key', 'ConvertKit email marketing subscribers/tags API.', mailchimpMarketingParams],
        ['ActiveCampaign', 'api_key', 'ActiveCampaign marketing automation contacts/campaigns API.', mailchimpMarketingParams],
        ['MailerLite', 'api_key', 'MailerLite email marketing subscribers/campaigns API.', mailchimpMarketingParams],
        ['Customer.io', 'api_key', 'Customer.io messaging/segments API.', mailchimpMarketingParams],
      ]),
    ],
  },
  {
    id: 'pm-km',
    title: 'Project & Knowledge Management',
    subcategories: [
      withBlocks('tasks', 'Task Management', [
        ['Asana', 'free'], ['Trello', 'free'], ['ClickUp', 'free'], ['Linear', 'free'], ['Monday.com', 'api_key', undefined, mondayComParams, mondayComCredentials],
        ['Jira', 'api_key', undefined, jiraParams, jiraCredentials], ['Basecamp', 'api_key', undefined, basecampParams, basecampCredentials], ['Todoist', 'free', undefined, todoistParams, todoistCredentials],         ['TickTick', 'api_key', undefined, ticktickParams, ticktickCredentials],
        ['Google Tasks', 'free', 'Google Tasks list/create/update API.', calendarApiParams],
        ['Microsoft Planner', 'api_key', 'Microsoft Planner tasks/plans API.', msGraphApiParams],
        ['Microsoft To Do', 'api_key', 'Microsoft To Do tasks/lists API.', msGraphApiParams],
        ['Shortcut', 'api_key', 'Shortcut (Clubhouse) stories/epics API.', jiraParams],
        ['Wrike', 'api_key', 'Wrike project management tasks/workspaces API.', jiraParams],
        ['Height', 'free', 'Height project management API.', clickupParams],
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
        ['Coinbase Cloud', 'api_key', undefined, web3Params], ['Infura', 'free', undefined, web3Params],         ['Moralis', 'free', undefined, web3Params],
        ['Alchemy', 'free', 'Alchemy blockchain API node/WebSocket provider.', web3Params],
        ['Thirdweb', 'api_key', 'Thirdweb smart contract deployment SDK API.', web3Params],
        ['The Graph', 'api_key', 'The Graph subgraph query/studio API.', web3Params],
      ]),
      withBlocks('markets-nft', 'Market Data & NFTs', [
        ['CoinGecko', 'free', undefined, marketDataParams], ['CoinMarketCap', 'api_key', undefined, marketDataParams], ['OpenSea', 'api_key', undefined, marketDataParams], ['Magic Eden', 'api_key', undefined, marketDataParams],
        ['Etherscan', 'free', undefined, marketDataParams], ['Rarible', 'api_key', undefined, marketDataParams],
        ['Chainlink', 'api_key', 'Chainlink oracle network price feeds and randomness API.', oracleNetworkParams],
        ['QuickNode', 'free', 'QuickNode blockchain RPC node and API gateway.', web3Params],
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
        ['Microsoft Intune', 'api_key', 'Microsoft Intune device management API.', msGraphApiParams],
        ['Descope', 'api_key', 'Descope user authentication/flows API.', identityParams],
        ['WorkOS', 'api_key', 'WorkOS SSO/directory/audit log API.', identityParams],
      ]),
      withBlocks('threat-intel', 'Threat Intel & Security', [
        ['VirusTotal', 'free', undefined, securityParams], ['HaveIBeenPwned', 'api_key', undefined, securityParams], ['Shodan', 'api_key', undefined, securityParams], ['Cloudflare Security', 'free', undefined, securityParams],
        ['CrowdStrike', 'api_key', undefined, securityParams], ['Splunk', 'api_key', undefined, securityParams],
        ['Wazuh', 'api_key', 'Wazuh open source security monitoring/XDR agents/alerts API.', securityParams],
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
        ['Schedule (Cron)', 'internal', 'Run on a cron schedule', cronParams, undefined, undefined, true],
        ['Webhook (Catch)', 'internal', 'Receive incoming HTTP POST', webhookParams, undefined, undefined, true],
        ['RSS Monitor', 'internal', 'Poll an RSS/Atom feed', rssMonitorParams, undefined, undefined, true],
        ['New Email', 'internal', 'Watch an inbox for new mail', newEmailParams, undefined, undefined, true],
        ['FTP Monitor', 'internal', 'Watch FTP/SFTP directory', ftpMonitorParams, undefined, undefined, true],
        ['File Watcher', 'internal', 'Watch local/Git path changes', fileWatcherParams, undefined, undefined, true],
        ['Database Change', 'internal', 'Fire on row INSERT/UPDATE/DELETE', dbChangeParams, undefined, undefined, true],
        ['Queue Consumer', 'internal', 'Consume from message queue', queueConsumerParams, undefined, undefined, true],
        ['Manual Trigger', 'internal', 'Run from a button or chat', manualTriggerParams, undefined, undefined, true],
        ['Event Bus Listener', 'internal', 'Subscribe to internal event bus', undefined, undefined, undefined, true],
        ['HTTP Polling', 'internal', 'Poll an endpoint and detect changes', httpPollingTriggerParams, undefined, undefined, true],
        ['GitHub Event', 'internal', 'Push, PR, issue, release events', githubEventTriggerParams, undefined, undefined, true],
        ['Stripe Event', 'internal', 'Payments, subscriptions, refunds', stripeEventTriggerParams, undefined, undefined, true],
        ['Slack Event', 'internal', 'Mentions, messages, reactions', slackEventTriggerParams, undefined, undefined, true],
        ['Form Submission', 'internal', 'Typeform / Tally / Jotform / Google Forms', formSubmissionTriggerParams, undefined, undefined, true],
        ['Calendar Event', 'internal', 'Google/Outlook calendar changes', calendarEventTriggerParams, undefined, undefined, true],
        ['IoT Sensor', 'internal', 'Temperature, humidity, motion thresholds', sensorTriggerParams, undefined, undefined, true],
        ['MQTT Message', 'internal', 'Subscribe to MQTT broker topic', mqttTriggerParams, undefined, undefined, true],
        ['Kafka Consumer', 'internal', 'Read from Kafka topic', kafkaTriggerParams, undefined, undefined, true],
        ['S3 Object Event', 'internal', 'Object created/removed in S3', s3EventTriggerParams, undefined, undefined, true],
        ['Pipeline Error', 'internal', 'Trigger when another pipeline errors', errorTriggerParams, undefined, undefined, true],
        ['Chat Command', 'internal', 'Run from AI chat phrase', chatCommandTriggerParams, undefined, undefined, true],
        ['Server-Sent Events', 'internal', 'Subscribe to SSE stream', sseTriggerParams, undefined, undefined, true],
        ['WebSocket Message', 'internal', 'Listen on WebSocket connection', websocketTriggerParams, undefined, undefined, true],
        ['Geofence', 'internal', 'Device enters/exits a region', geofenceTriggerParams, undefined, undefined, true],
        ['Price Alert', 'internal', 'Stock or crypto threshold crossed', priceAlertTriggerParams, undefined, undefined, true],
      ]),
      withBlocks('logic', 'Logic', [
        ['Filter', 'internal'], ['Router', 'internal'], ['Loop', 'internal'], ['Delay', 'internal'], ['Wait for Approval', 'internal'], ['Error Handler', 'internal'],
        ['Switch/Case', 'internal'], ['Merge', 'internal'], ['Parallel Split', 'internal'], ['Debounce', 'internal'], ['Rate Limiter', 'internal'],
        ['Retry', 'internal'], ['Circuit Breaker', 'internal'], ['Sub-Workflow', 'internal'],
        ['Idempotency Guard', 'internal'], ['Schema Validator', 'internal'], ['Try/Catch', 'internal'],
        ['Throttle', 'internal'], ['Aggregate', 'internal'], ['Dedupe', 'internal'], ['Batch Collector', 'internal'],
        ['Conditional Wait', 'internal'], ['Timeout Guard', 'internal'], ['Fan-Out / Fan-In', 'internal'],
        ['Approval Gate', 'internal'], ['Feature Flag Branch', 'internal'], ['A/B Split', 'internal'],
      ]),
      withBlocks('data', 'Data', [
        ['Text Formatter', 'internal'], ['Date Formatter', 'internal'], ['Math', 'internal'], ['JSON Parser', 'internal'],
        ['JS/Python Code', 'internal'], ['CSV Generator', 'internal'], ['PDF Creator', 'internal'],
        ['XML Parser', 'internal'], ['YAML Parser', 'internal'], ['Base64 Encode/Decode', 'internal'],
        ['Hash Generator', 'internal'], ['UUID Generator', 'internal'], ['Regex Extractor', 'internal'],
        ['HTML Parser', 'internal'], ['Markdown to HTML', 'internal'], ['Image Resizer', 'internal'],
        ['QR Code Generator', 'internal'], ['Barcode Generator', 'internal'],
        ['JSON Path Extract', 'internal'], ['JSON Diff', 'internal'], ['JSON Merge', 'internal'],
        ['JWT Encode/Decode', 'internal'], ['HMAC Signer', 'internal'], ['AES Encrypt/Decrypt', 'internal'],
        ['URL Encode/Decode', 'internal'], ['Slugify', 'internal'], ['Number Formatter', 'internal'],
        ['Currency Converter', 'internal'], ['Timezone Converter', 'internal'], ['Geo Distance', 'internal'],
        ['Image OCR', 'internal'], ['Image Crop', 'internal'], ['Image Watermark', 'internal'],
        ['Audio Trim', 'internal'], ['Video Thumbnail', 'internal'], ['Zip / Unzip', 'internal'],
        ['Translate Text', 'internal'], ['Sentiment', 'internal'], ['Language Detect', 'internal'],
        ['Template Render (Liquid)', 'internal'], ['Template Render (Jinja)', 'internal'],
        ['Faker / Mock Data', 'internal'], ['Random Number', 'internal'], ['Lorem Ipsum', 'internal'],
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
        ['Threads', 'api_key', undefined, socialPostParams],         ['Tumblr', 'api_key', undefined, socialPostParams],
        ['Snapchat', 'api_key', 'Snapchat stories/ads/business API.', socialPostParams],
        ['Twitch', 'api_key', 'Twitch streams/channels/users API.', socialPostParams],
      ]),
      withBlocks('social-management', 'Social Management & Scheduling', [
        ['Buffer', 'api_key', undefined, socialManagementParams], ['Hootsuite', 'api_key', undefined, socialManagementParams], ['Later', 'api_key', undefined, socialManagementParams],
        ['Sprout Social', 'api_key', undefined, socialManagementParams], ['SocialBee', 'api_key', undefined, socialManagementParams], ['Publer', 'api_key', undefined, socialManagementParams],
        ['CoSchedule', 'api_key', 'CoSchedule marketing calendar/social scheduling projects API.', socialManagementParams],
      ]),
      withBlocks('content-cms', 'Content & CMS', [
        ['WordPress', 'api_key', undefined, cmsParams], ['Ghost', 'api_key', undefined, cmsParams], ['Strapi', 'free', undefined, cmsParams],
        ['Contentful', 'api_key', undefined, cmsParams], ['Sanity', 'free', undefined, cmsParams], ['Prismic', 'api_key', undefined, cmsParams],
        ['Webflow', 'api_key', undefined, cmsParams], ['Medium', 'free', undefined, cmsParams], ['Hashnode', 'free', undefined, cmsParams],
        ['Dev.to', 'free', undefined, cmsParams], ['Substack', 'api_key', undefined, cmsParams],
        ['Google Docs', 'free', 'Google Docs document creation/editing API.', googleServiceParams],
        ['Google Slides', 'free', 'Google Slides presentation creation API.', googleServiceParams],
        ['Microsoft SharePoint', 'api_key', 'Microsoft SharePoint sites/lists/files API.', msGraphApiParams],
      ]),
      withBlocks('news-media', 'News & Media APIs', [
        ['NewsAPI', 'api_key', undefined, newsapiParams],
        ['GNews', 'api_key', undefined, gnewsParams],
      ]),
      withBlocks('audio-video-editing', 'Audio & Video Editing APIs', [
        ['Descript', 'api_key', undefined, descriptParams],
        ['Mux Video', 'api_key', 'Mux video encoding/streaming assets and playback IDs API.', muxVideoApiParams],
      ]),
    ],
  },
  {
    id: 'verticals',
    title: 'Specialized Verticals',
    subcategories: [
      withBlocks('hr', 'HR & Recruiting', [
        ['Workday', 'api_key', undefined, hrParams], ['BambooHR', 'api_key', undefined, hrParams], ['Greenhouse', 'api_key', undefined, hrParams], ['Lever', 'api_key', undefined, hrParams], ['Ashby', 'api_key', undefined, hrParams],
        ['HiBob', 'api_key', undefined, hrParams], ['Gusto', 'api_key', undefined, hrParams], ['Rippling', 'api_key', undefined, hrParams], ['Deel', 'api_key', undefined, hrParams],         ['Remote.com', 'api_key', undefined, hrParams],
        ['Personio', 'api_key', 'Personio HR platform employees/absences API.', hrParams],
        ['Oyster HR', 'api_key', 'Oyster HR global employment platform API.', hrParams],
      ]),
      withBlocks('edtech', 'Education (EdTech)', [
        ['Canvas', 'free', undefined, trainingParams], ['Moodle', 'free', undefined, trainingParams], ['Teachable', 'api_key', undefined, trainingParams], ['Kajabi', 'api_key', undefined, trainingParams], ['Coursera', 'api_key', undefined, trainingParams], ['Duolingo', 'api_key', undefined, trainingParams],
        ['Udemy', 'api_key', undefined, trainingParams], ['Thinkific', 'api_key', undefined, trainingParams],         ['Podia', 'api_key', undefined, trainingParams],
        ['Google Classroom', 'free', 'Google Classroom courses/assignments API.', googleServiceParams],
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
        ['Onfleet', 'api_key', 'Onfleet last-mile delivery task/driver/destination management API.', onfleetApiParams],
      ]),
      withBlocks('accounting', 'Accounting & Finance', [
        ['QuickBooks', 'api_key', undefined, financeParams], ['Xero', 'api_key', undefined, financeParams], ['FreshBooks', 'api_key', undefined, financeParams], ['Wave', 'free', undefined, financeParams],
        ['Plaid', 'api_key', undefined, financeParams], ['Wise', 'api_key', undefined, financeParams], ['Mercury', 'api_key', undefined, financeParams],
        ['Bill.com', 'api_key', 'Bill.com B2B payments and accounts payable automation API.', financeParams],
        ['Tipalti', 'api_key', 'Tipalti global mass payables/AP automation platform API.', financeParams],
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
        ['Pusher Beams', 'api_key', undefined, notificationParams],
        ['Novu', 'free', undefined, notificationParams], ['Knock', 'api_key', undefined, notificationParams], ['MagicBell', 'api_key', undefined, notificationParams],
        ['Courier', 'api_key', undefined, notificationParams], ['Engagespot', 'free', undefined, notificationParams],
        ['AWS SNS', 'api_key', 'AWS SNS push notification/topic publish API.', awsApiParams],
      ]),
      withBlocks('alerts', 'Alerting & Incident', [
        ['PagerDuty', 'api_key', undefined, alertParams], ['OpsGenie', 'api_key', undefined, alertParams], ['VictorOps', 'api_key', undefined, alertParams],
        ['StatusPage', 'api_key', undefined, alertParams], ['Instatus', 'free', undefined, alertParams],         ['Cachet', 'free', undefined, alertParams],
        ['Incident.io', 'api_key', 'Incident.io incident management API.', alertParams],
        ['xMatters', 'api_key', 'xMatters on-call/alerting API.', alertParams],
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
        ['Google Books', 'free', 'Google Books search/volumes API.', searchParams],
        ['Azure Cognitive Search', 'api_key', 'Azure Cognitive Search indexing/query API.', azureApiParams],
      ]),
      withBlocks('analytics-bi', 'Analytics & BI', [
        ['Google Analytics', 'api_key', undefined, analyticsParams], ['Plausible', 'free', undefined, analyticsParams], ['PostHog', 'free', undefined, analyticsParams],
        ['Metabase', 'free', undefined, analyticsParams], ['Looker', 'api_key', undefined, analyticsParams], ['Tableau', 'api_key', undefined, analyticsParams],
        ['Apache Superset', 'free', undefined, analyticsParams],         ['Grafana', 'free', undefined, analyticsParams],
        ['YouTube Analytics', 'api_key', 'YouTube Analytics/channel reports API.', analyticsParams],
        ['Google Search Console', 'free', 'Google Search Console site performance API.', googleServiceParams],
        ['Domo', 'api_key', 'Domo business analytics platform API.', analyticsParams],
        ['Sigma', 'api_key', 'Sigma Computing cloud analytics API.', analyticsParams],
      ]),

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
