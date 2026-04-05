export type AutomationAuthType = 'api_key' | 'free' | 'internal' | 'local';

export interface AutomationRegistryBlock {
  id: string;
  label: string;
  auth: AutomationAuthType;
  description?: string;
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

const block = (label: string, auth: AutomationAuthType, description?: string): AutomationRegistryBlock => ({
  id: slugify(label),
  label,
  auth,
  description,
});

const withBlocks = (id: string, title: string, blocks: Array<[string, AutomationAuthType]>): AutomationRegistrySubcategory => ({
  id,
  title,
  blocks: blocks.map(([label, auth]) => block(label, auth)),
});

export const AUTOMATION_INTEGRATION_REGISTRY: AutomationRegistryCategory[] = [
  {
    id: 'comm',
    title: 'Communication & Messaging',
    subcategories: [
      withBlocks('email', 'Email Providers', [
        ['Resend', 'api_key'], ['SendGrid', 'api_key'], ['Mailgun', 'api_key'], ['Postmark', 'api_key'], ['Gmail', 'free'],
        ['Outlook', 'free'], ['Amazon SES', 'api_key'], ['SparkPost', 'api_key'], ['Brevo', 'free'], ['Mailjet', 'free'],
        ['ProtonMail API', 'api_key'], ['Zoho Mail', 'free'], ['iCloud Mail', 'free'], ['Yahoo Business', 'api_key'],
      ]),
      withBlocks('team-chat', 'Team Chat & Collaboration', [
        ['Slack', 'free'], ['Microsoft Teams', 'free'], ['Discord', 'free'], ['Telegram', 'free'], ['WhatsApp Business', 'api_key'],
        ['Line', 'free'], ['WeChat', 'api_key'], ['Zulip', 'free'], ['Mattermost', 'free'], ['Rocket.Chat', 'free'],
        ['Google Chat', 'free'], ['Twist', 'free'],
      ]),
      withBlocks('sms-voice', 'SMS, Voice & Mobile Push', [
        ['Twilio', 'api_key'], ['MessageBird', 'api_key'], ['Vonage', 'api_key'], ['Plivo', 'api_key'], ['Sinch', 'api_key'],
        ['Telnyx', 'api_key'], ['Firebase Cloud Messaging', 'free'], ['OneSignal', 'free'], ['Pusher', 'api_key'],
        ['SimpleTexting', 'api_key'], ['ClickSend', 'api_key'], ['Bandwidth', 'api_key'], ['RingCentral', 'api_key'],
      ]),
      withBlocks('video-conferencing', 'Video Conferencing & Webinars', [
        ['Zoom', 'free'], ['Google Meet', 'free'], ['Microsoft Teams Video', 'free'], ['Webex', 'api_key'], ['Around', 'api_key'],
        ['Jitsi', 'free'], ['Demio', 'api_key'], ['Livestorm', 'api_key'], ['Riverside.fm', 'api_key'], ['Whereby', 'free'],
      ]),
    ],
  },
  {
    id: 'ai-ml',
    title: 'Artificial Intelligence & Machine Learning',
    subcategories: [
      withBlocks('ai-providers', 'AI Intelligence Providers', [
        ['OpenAI', 'api_key'], ['Anthropic', 'api_key'], ['Google Gemini', 'free'], ['OpenRouter', 'api_key'], ['Mistral AI', 'api_key'],
        ['Groq', 'api_key'], ['Perplexity AI', 'api_key'], ['Cohere', 'api_key'], ['Together AI', 'api_key'], ['DeepSeek', 'api_key'],
        ['Ollama', 'local'],
      ]),
      withBlocks('image-video-3d', 'Image, Video & 3D Generation', [
        ['DALL-E', 'api_key'], ['Midjourney', 'api_key'], ['Leonardo.ai', 'api_key'], ['Stable Diffusion', 'api_key'],
        ['HeyGen', 'api_key'], ['RunwayML', 'api_key'], ['Pika Labs', 'api_key'], ['Adobe Firefly', 'api_key'],
        ['Luma AI', 'api_key'], ['Spline 3D', 'api_key'],
      ]),
      withBlocks('audio-voice-music', 'Audio, Voice & Music AI', [
        ['ElevenLabs', 'api_key'], ['AssemblyAI', 'api_key'], ['Deepgram', 'api_key'], ['Rev.ai', 'api_key'], ['Murf.ai', 'api_key'],
        ['Play.ht', 'api_key'], ['OpenAI Whisper', 'api_key'], ['Suno AI', 'api_key'], ['Udio', 'api_key'], ['Voicemod', 'api_key'],
      ]),
    ],
  },
  {
    id: 'db-store',
    title: 'Data, Storage & Database',
    subcategories: [
      withBlocks('databases', 'Relational & NoSQL Databases', [
        ['Supabase', 'free'], ['MongoDB Atlas', 'free'], ['PlanetScale', 'api_key'], ['Redis', 'free'], ['Firebase', 'free'],
        ['CockroachDB', 'free'], ['FaunaDB', 'free'], ['MariaDB', 'free'], ['MySQL', 'free'], ['Neo4j', 'api_key'],
        ['SurrealDB', 'free'], ['Turso', 'free'],
      ]),
      withBlocks('cloud-storage-cdn', 'Cloud File Storage & CDN', [
        ['Google Drive', 'free'], ['Dropbox', 'free'], ['Box', 'free'], ['OneDrive', 'free'], ['AWS S3', 'api_key'],
        ['Google Cloud Storage', 'api_key'], ['Azure Blob', 'api_key'], ['Backblaze B2', 'api_key'], ['pCloud', 'api_key'],
        ['Cloudinary', 'free'], ['ImageKit', 'free'], ['Fastly', 'api_key'], ['Akamai', 'api_key'],
      ]),
      withBlocks('spreadsheets', 'Spreadsheets & Productive Databases', [
        ['Airtable', 'free'], ['Google Sheets', 'free'], ['Excel Online', 'free'], ['Smartsheet', 'api_key'], ['Coda', 'free'],
        ['Notion', 'free'], ['Baserow', 'free'], ['SeaTable', 'free'], ['Grist', 'free'],
      ]),
    ],
  },
  {
    id: 'dev-ops',
    title: 'Developer Tools & DevOps',
    subcategories: [
      withBlocks('code-cicd', 'Code & CI/CD', [
        ['GitHub', 'free'], ['GitLab', 'free'], ['Bitbucket', 'free'], ['Azure DevOps', 'api_key'], ['Gitea', 'free'],
        ['CircleCI', 'api_key'], ['Travis CI', 'api_key'], ['Jenkins', 'free'], ['SonarQube', 'free'],
      ]),
      withBlocks('monitoring', 'Monitoring & Infrastructure', [
        ['Sentry', 'free'], ['Datadog', 'api_key'], ['New Relic', 'api_key'], ['LogRocket', 'api_key'], ['Honeycomb', 'free'],
        ['BetterStack', 'free'], ['Pingdom', 'api_key'], ['UptimeRobot', 'free'], ['Vercel', 'free'], ['Netlify', 'free'], ['Docker Hub', 'free'],
      ]),
    ],
  },
  {
    id: 'fin-eco',
    title: 'Finance & E-Commerce',
    subcategories: [
      withBlocks('payments', 'Payment Gateways', [
        ['Stripe', 'api_key'], ['PayPal', 'free'], ['Square', 'api_key'], ['Adyen', 'api_key'], ['Braintree', 'api_key'],
        ['Lemon Squeezy', 'api_key'], ['Paddle', 'api_key'], ['Mollie', 'api_key'], ['Razorpay', 'api_key'], ['Authorize.net', 'api_key'],
      ]),
      withBlocks('storefronts', 'E-commerce & Storefronts', [
        ['Shopify', 'api_key'], ['WooCommerce', 'free'], ['Magento', 'free'], ['BigCommerce', 'api_key'], ['Gumroad', 'free'],
        ['Etsy', 'api_key'], ['Amazon Seller', 'api_key'], ['Wix Stores', 'api_key'], ['Squarespace', 'api_key'], ['Printful', 'api_key'],
      ]),
    ],
  },
  {
    id: 'support',
    title: 'Customer Support & Feedback',
    subcategories: [
      withBlocks('help-desk', 'Help Desk & Ticketing', [
        ['Zendesk', 'api_key'], ['Freshdesk', 'free'], ['Gorgias', 'api_key'], ['Help Scout', 'api_key'], ['Front', 'api_key'],
        ['Intercom', 'api_key'], ['Kustomer', 'api_key'], ['Gladly', 'api_key'],
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
        ['Salesforce', 'api_key'], ['HubSpot', 'free'], ['Pipedrive', 'api_key'], ['Zoho CRM', 'free'], ['Copper', 'api_key'],
        ['Keap', 'api_key'], ['Close.com', 'api_key'], ['Attio', 'free'], ['Folk', 'free'], ['Apollo.io', 'api_key'],
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
        ['Schedule (Cron)', 'internal'], ['Webhook (Catch)', 'internal'], ['RSS Monitor', 'internal'], ['New Email', 'internal'], ['FTP Monitor', 'internal'],
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
