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

const block = (
  label: string,
  auth: AutomationAuthType,
  description?: string,
  parameters?: APIParameter[],
  credentialFields?: APIParameter[],
  operations?: Operation[]
): AutomationRegistryBlock => ({
  id: slugify(label),
  label,
  auth,
  description,
  parameters,
  credentialFields,
  operations,
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
  >
): AutomationRegistrySubcategory => ({
  id,
  title,
  blocks: blocks.map(([label, auth, description, parameters, credentialFields, operations]) =>
    block(label, auth, description as string | undefined, parameters as APIParameter[] | undefined, credentialFields as APIParameter[] | undefined, operations as Operation[] | undefined)
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
    description: 'Model to use for completion',
    required: true,
    default: 'gpt-4.5-mini',
    options: [
      { label: 'GPT-4o', value: 'gpt-4o' },
      { label: 'GPT-4.5-mini', value: 'gpt-4.5-mini' },
      { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
      { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
    ],
  },
  {
    name: 'prompt',
    displayName: 'System Prompt',
    type: 'textarea',
    description: 'You are a helpful assistant. How should the AI behave?',
    required: true,
    placeholder: 'You are a helpful assistant that summarizes text.',
  },
  {
    name: 'input',
    displayName: 'Input Text',
    type: 'textarea',
    description: 'The text to process',
    required: true,
    placeholder: 'Paste or map the data to process here...',
  },
  { name: 'temperature', displayName: 'Temperature', type: 'number', description: 'Creativity (0-2)', default: 0.7 },
  { name: 'max_tokens', displayName: 'Max Tokens', type: 'number', description: 'Max response length', default: 500 },
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
    name: 'cron',
    displayName: 'Cron Expression',
    type: 'string',
    required: true,
    placeholder: '0 9 * * *',
    description: 'Cron schedule (min hour day month dayOfWeek)',
    help: 'Examples: "0 9 * * *" (9am daily), "0 */4 * * *" (every 4 hours), "0 0 * * 0" (Sundays midnight)',
  },
  {
    name: 'timezone',
    displayName: 'Timezone',
    type: 'select',
    default: 'UTC',
    options: [
      { label: 'UTC', value: 'UTC' },
      { label: 'America/New_York', value: 'America/New_York' },
      { label: 'America/Chicago', value: 'America/Chicago' },
      { label: 'America/Denver', value: 'America/Denver' },
      { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
      { label: 'Europe/London', value: 'Europe/London' },
      { label: 'Europe/Paris', value: 'Europe/Paris' },
      { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
    ],
  },
];

const discordParams: APIParameter[] = [
  { name: 'webhook_url', displayName: 'Webhook URL', type: 'url', description: 'Discord Webhook URL', required: true, placeholder: 'https://discord.com/api/webhooks/...' },
  { name: 'content', displayName: 'Message', type: 'textarea', description: 'Message text (max 2000 chars)', required: true, placeholder: 'Your message...' },
  { name: 'username', displayName: 'Bot Username', type: 'string', placeholder: 'My Bot' },
  { name: 'avatar_url', displayName: 'Avatar URL', type: 'url', placeholder: 'https://...' },
  { name: 'tts', displayName: 'Text-to-Speech', type: 'boolean', placeholder: 'Enable TTS' },
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
  { name: 'html', displayName: 'HTML Body', type: 'textarea', required: true, placeholder: '<p>Email content</p>' },
  { name: 'reply_to', displayName: 'Reply To', type: 'email', placeholder: 'support@example.com' },
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
  { name: 'cc', displayName: 'CC', type: 'string' },
  { name: 'bcc', displayName: 'BCC', type: 'string' },
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
        ['Outlook', 'free', undefined, gmailParams],
        ['Amazon SES', 'api_key', undefined, amazonsesParams, amazonsesCredentials],
        ['SparkPost', 'api_key', undefined, sparkpostParams, sparkpostCredentials],
        ['Brevo', 'free'],
        ['Mailjet', 'free'],
        ['ProtonMail API', 'api_key'],
        ['Zoho Mail', 'free'],
        ['iCloud Mail', 'free'],
        ['Yahoo Business', 'api_key'],
      ]),
      withBlocks('team-chat', 'Team Chat & Collaboration', [
        ['Slack', 'free', undefined, slackParams, slackCredentials],
        ['Microsoft Teams', 'free', undefined, teamsParams, teamsCredentials],
        ['Discord', 'free', undefined, discordParams],
        ['Telegram', 'free', undefined, telegramParams, telegramCredentials],
        ['WhatsApp Business', 'api_key', undefined, whatsappParams, whatsappCredentials],
        ['Line', 'free'],
        ['WeChat', 'api_key'],
        ['Zulip', 'free'],
        ['Mattermost', 'free'],
        ['Rocket.Chat', 'free'],
        ['Google Chat', 'free'],
        ['Twist', 'free'],
      ]),
      withBlocks('sms-voice', 'SMS, Voice & Mobile Push', [
        ['Twilio', 'api_key', undefined, twilioParams, twilioCredentials],
        ['MessageBird', 'api_key', undefined, messagebirdParams, messagebirdCredentials],
        ['Vonage', 'api_key', undefined, vonageParams, vonageCredentials],
        ['Plivo', 'api_key'],
        ['Sinch', 'api_key'],
        ['Telnyx', 'api_key'],
        ['Firebase Cloud Messaging', 'free'],
        ['OneSignal', 'free'],
        ['Pusher', 'api_key'],
        ['SimpleTexting', 'api_key'],
        ['ClickSend', 'api_key'],
        ['Bandwidth', 'api_key'],
        ['RingCentral', 'api_key'],
      ]),
      withBlocks('video-conferencing', 'Video Conferencing & Webinars', [
        ['Zoom', 'free', undefined, zoomParams, zoomCredentials],
        ['Google Meet', 'free'],
        ['Microsoft Teams Video', 'free'],
        ['Webex', 'api_key', undefined, webexParams, webexCredentials],
        ['Around', 'api_key'],
        ['Jitsi', 'free'],
        ['Demio', 'api_key'],
        ['Livestorm', 'api_key'],
        ['Riverside.fm', 'api_key'],
        ['Whereby', 'free'],
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
        ['OpenRouter', 'api_key'],
        ['Mistral AI', 'api_key', undefined, mistralParams, mistralCredentials],
        ['Groq', 'api_key', undefined, groqParams, groqCredentials],
        ['Perplexity AI', 'api_key'],
        ['Cohere', 'api_key', undefined, cohereParams, cohereCredentials],
        ['Together AI', 'api_key'],
        ['DeepSeek', 'api_key'],
        ['Ollama', 'local'],
      ]),
      withBlocks('image-video-3d', 'Image, Video & 3D Generation', [
        ['DALL-E', 'api_key', undefined, dalleParams],
        ['Midjourney', 'api_key'],
        ['Leonardo.ai', 'api_key'],
        ['Stable Diffusion', 'api_key', undefined, stableParams],
        ['HeyGen', 'api_key', undefined, heygenParams, heygenCredentials],
        ['RunwayML', 'api_key'],
        ['Pika Labs', 'api_key'],
        ['Adobe Firefly', 'api_key'],
        ['Luma AI', 'api_key'],
        ['Spline 3D', 'api_key'],
      ]),
      withBlocks('audio-voice-music', 'Audio, Voice & Music AI', [
        ['ElevenLabs', 'api_key', undefined, elevenLabsParams, elevenLabsCredentials],
        ['AssemblyAI', 'api_key', undefined, assemblyaiParams, assemblyaiCredentials],
        ['Deepgram', 'api_key'],
        ['Rev.ai', 'api_key'],
        ['Murf.ai', 'api_key'],
        ['Play.ht', 'api_key'],
        ['OpenAI Whisper', 'api_key'],
        ['Suno AI', 'api_key'],
        ['Udio', 'api_key'],
        ['Voicemod', 'api_key'],
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
        ['PlanetScale', 'api_key'],
        ['Redis', 'free', undefined, redisParams, redisCredentials],
        ['Firebase', 'free', undefined, firebaseParams, firebaseCredentials],
        ['CockroachDB', 'free'],
        ['FaunaDB', 'free'],
        ['MariaDB', 'free'],
        ['MySQL', 'free'],
        ['Neo4j', 'api_key'],
        ['SurrealDB', 'free'],
        ['Turso', 'free'],
      ]),
      withBlocks('cloud-storage-cdn', 'Cloud File Storage & CDN', [
        ['Google Drive', 'free', undefined, googledriveParams],
        ['Dropbox', 'free'],
        ['Box', 'free'],
        ['OneDrive', 'free'],
        ['AWS S3', 'api_key', undefined, s3Params, s3Credentials],
        ['Google Cloud Storage', 'api_key'],
        ['Azure Blob', 'api_key'],
        ['Backblaze B2', 'api_key'],
        ['pCloud', 'api_key'],
        ['Cloudinary', 'free', undefined, cloudinaryParams, cloudinaryCredentials],
        ['ImageKit', 'free'],
        ['Fastly', 'api_key'],
        ['Akamai', 'api_key'],
      ]),
      withBlocks('spreadsheets', 'Spreadsheets & Productive Databases', [
        ['Airtable', 'free', undefined, airtableParams, airtableCredentials],
        ['Google Sheets', 'free', undefined, googlesheetParams],
        ['Excel Online', 'free'],
        ['Smartsheet', 'api_key'],
        ['Coda', 'free'],
        ['Notion', 'free', undefined, notionParams, notionCredentials],
        ['Baserow', 'free'],
        ['SeaTable', 'free'],
        ['Grist', 'free'],
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
        ['Azure DevOps', 'api_key'],
        ['Gitea', 'free'],
        ['CircleCI', 'api_key', undefined, circleciParams, circleciCredentials],
        ['Travis CI', 'api_key'],
        ['Jenkins', 'free', undefined, jenkinsParams, jenkinsCredentials],
        ['SonarQube', 'free'],
      ]),
      withBlocks('monitoring', 'Monitoring & Infrastructure', [
        ['Sentry', 'free', undefined, sentryParams, sentryCredentials],
        ['Datadog', 'api_key', undefined, datadogParams, datadogCredentials],
        ['New Relic', 'api_key'],
        ['LogRocket', 'api_key'],
        ['Honeycomb', 'free'],
        ['BetterStack', 'free'],
        ['Pingdom', 'api_key'],
        ['UptimeRobot', 'free'],
        ['Vercel', 'free'],
        ['Netlify', 'free'],
        ['Docker Hub', 'free'],
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
        ['Adyen', 'api_key'],
        ['Braintree', 'api_key'],
        ['Lemon Squeezy', 'api_key'],
        ['Paddle', 'api_key'],
        ['Mollie', 'api_key'],
        ['Razorpay', 'api_key'],
        ['Authorize.net', 'api_key'],
      ]),
      withBlocks('storefronts', 'E-commerce & Storefronts', [
        ['Shopify', 'api_key', undefined, shopifyParams, shopifyCredentials],
        ['WooCommerce', 'free', undefined, woocommerceParams, woocommerceCredentials],
        ['Magento', 'free'],
        ['BigCommerce', 'api_key'],
        ['Gumroad', 'free'],
        ['Etsy', 'api_key'],
        ['Amazon Seller', 'api_key'],
        ['Wix Stores', 'api_key'],
        ['Squarespace', 'api_key'],
        ['Printful', 'api_key'],
      ]),
    ],
  },
  {
    id: 'support',
    title: 'Customer Support & Feedback',
    subcategories: [
      withBlocks('help-desk', 'Help Desk & Ticketing', [
        ['Zendesk', 'api_key', undefined, zendeskParams, zendeskCredentials],
        ['Freshdesk', 'free'],
        ['Gorgias', 'api_key'],
        ['Help Scout', 'api_key'],
        ['Front', 'api_key'],
        ['Intercom', 'api_key', undefined, intercomParams, intercomCredentials],
        ['Kustomer', 'api_key'],
        ['Gladly', 'api_key'],
      ]),
      withBlocks('live-chat', 'Live Chat & Chatbots', [
        ['Crisp', 'free'], ['Tawk.to', 'free'], ['Drift', 'api_key'], ['ManyChat', 'free'], ['Chatbase', 'api_key'],
        ['Landbot', 'free'], ['LiveChat', 'api_key'],
      ]),
      withBlocks('surveys', 'Surveys & User Feedback', [
        ['Typeform', 'free'], ['Jotform', 'free'], ['Tally.so', 'free'], ['SurveyMonkey', 'api_key'], ['Hotjar', 'free'],
        ['UserTesting', 'api_key'], ['Qualtrics', 'api_key'],
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
        ['Zoho CRM', 'free'],
        ['Copper', 'api_key'],
        ['Keap', 'api_key'],
        ['Close.com', 'api_key'],
        ['Attio', 'free'],
        ['Folk', 'free'],
        ['Apollo.io', 'api_key'],
      ]),
      withBlocks('ads-growth', 'Ads & Growth', [
        ['Google Ads', 'api_key'], ['Meta Ads', 'api_key'], ['LinkedIn Ads', 'api_key'], ['TikTok Ads', 'api_key'],
        ['Mixpanel', 'free'], ['Amplitude', 'free'], ['Segment', 'free'], ['Clearbit', 'api_key'],
      ]),
    ],
  },
  {
    id: 'pm-km',
    title: 'Project & Knowledge Management',
    subcategories: [
      withBlocks('tasks', 'Task Management', [
        ['Asana', 'free'], ['Trello', 'free'], ['ClickUp', 'free'], ['Linear', 'free'], ['Monday.com', 'api_key'],
        ['Jira', 'api_key'], ['Basecamp', 'api_key'], ['Todoist', 'free'], ['TickTick', 'api_key'],
      ]),
      withBlocks('notes-wiki', 'Notes & Wiki', [
        ['Notion', 'free'], ['Obsidian Sync', 'api_key'], ['Confluence', 'api_key'], ['Slite', 'free'], ['GitBook', 'free'],
        ['Guru', 'api_key'], ['Slab', 'api_key'], ['Evernote', 'api_key'],
      ]),
    ],
  },
  {
    id: 'web3',
    title: 'Web3 & Blockchain',
    subcategories: [
      withBlocks('chains-wallets', 'Chains & Wallets', [
        ['Ethereum/Alchemy', 'free'], ['Solana/Helius', 'free'], ['Polygon', 'free'], ['WalletConnect', 'free'],
        ['Coinbase Cloud', 'api_key'], ['Infura', 'free'], ['Moralis', 'free'],
      ]),
      withBlocks('markets-nft', 'Market Data & NFTs', [
        ['CoinGecko', 'free'], ['CoinMarketCap', 'api_key'], ['OpenSea', 'api_key'], ['Magic Eden', 'api_key'],
        ['Etherscan', 'free'], ['Rarible', 'api_key'],
      ]),
    ],
  },
  {
    id: 'security',
    title: 'Cybersecurity & IT',
    subcategories: [
      withBlocks('identity', 'Identity & Access', [
        ['Okta', 'api_key'], ['Auth0', 'free'], ['Clerk', 'free'], ['Stytch', 'api_key'], ['Kinde', 'free'],
        ['1Password', 'api_key'], ['Dashlane', 'api_key'],
      ]),
      withBlocks('threat-intel', 'Threat Intel & Security', [
        ['VirusTotal', 'free'], ['HaveIBeenPwned', 'api_key'], ['Shodan', 'api_key'], ['Cloudflare Security', 'free'],
        ['CrowdStrike', 'api_key'], ['Splunk', 'api_key'],
      ]),
    ],
  },
  {
    id: 'util-iot',
    title: 'Utilities & IoT',
    subcategories: [
      withBlocks('environment', 'Environment', [
        ['OpenWeatherMap', 'free'], ['Tomorrow.io', 'free'], ['AccuWeather', 'api_key'], ['Google Maps', 'api_key'],
        ['Mapbox', 'free'], ['AirVisual', 'api_key'],
      ]),
      withBlocks('smart-home', 'Smart Home', [
        ['Philips Hue', 'api_key'], ['Nest', 'api_key'], ['IFTTT', 'free'], ['Home Assistant', 'free'], ['Shelly', 'free'], ['Tuya', 'api_key'],
      ]),
    ],
  },
  {
    id: 'internal',
    title: 'System & Logic Blocks',
    subcategories: [
      withBlocks('triggers', 'Triggers', [
        ['Schedule (Cron)', 'internal', undefined, cronParams],
        ['Webhook (Catch)', 'internal', undefined, webhookParams],
        ['RSS Monitor', 'internal'],
        ['New Email', 'internal'],
        ['FTP Monitor', 'internal'],
      ]),
      withBlocks('logic', 'Logic', [
        ['Filter', 'internal'], ['Router', 'internal'], ['Loop', 'internal'], ['Delay', 'internal'], ['Wait for Approval', 'internal'], ['Error Handler', 'internal'],
      ]),
      withBlocks('data', 'Data', [
        ['Text Formatter', 'internal'], ['Date Formatter', 'internal'], ['Math', 'internal'], ['JSON Parser', 'internal'],
        ['JS/Python Code', 'internal'], ['CSV Generator', 'internal'], ['PDF Creator', 'internal'],
      ]),
    ],
  },
  {
    id: 'verticals',
    title: 'Specialized Verticals',
    subcategories: [
      withBlocks('hr', 'HR & Recruiting', [
        ['Workday', 'api_key'], ['BambooHR', 'api_key'], ['Greenhouse', 'api_key'], ['Lever', 'api_key'], ['Ashby', 'api_key'],
        ['HiBob', 'api_key'], ['Gusto', 'api_key'],
      ]),
      withBlocks('edtech', 'Education (EdTech)', [
        ['Canvas', 'free'], ['Moodle', 'free'], ['Teachable', 'api_key'], ['Kajabi', 'api_key'], ['Coursera', 'api_key'], ['Duolingo', 'api_key'],
      ]),
      withBlocks('legal', 'Legal & E-Signature', [
        ['DocuSign', 'api_key'], ['Dropbox Sign', 'api_key'], ['Ironclad', 'api_key'], ['Clio', 'api_key'], ['PandaDoc', 'api_key'],
      ]),
      withBlocks('healthcare', 'Healthcare', [
        ['Epic', 'api_key'], ['Cerner', 'api_key'], ['Healthie', 'api_key'], ['Redox', 'api_key'], ['Fitbit', 'free'], ['Strava', 'free'],
      ]),
      withBlocks('logistics-real-estate', 'Logistics & Real Estate', [
        ['AfterShip', 'api_key'], ['Shippo', 'api_key'], ['EasyPost', 'api_key'], ['Zillow', 'api_key'], ['Airbnb', 'api_key'], ['Uber', 'api_key'],
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
