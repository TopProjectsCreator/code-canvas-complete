import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { randomUUID } from 'crypto';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createRequire } from 'module';

// node-pty ships as CJS; use createRequire for ESM compatibility
const require = createRequire(import.meta.url);
const pty = require('node-pty');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.REPLIT_SERVER_PORT || '3001', 10);

app.use(express.json({ limit: '8mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

app.get('/api/replit/me', (req, res) => {
  const userId = req.headers['x-replit-user-id'];
  const userName = req.headers['x-replit-user-name'];
  const userRoles = req.headers['x-replit-user-roles'];
  if (!userId) return res.json({ user: null });
  res.json({
    user: {
      id: String(userId),
      name: String(userName || ''),
      roles: String(userRoles || '').split(',').filter(Boolean),
    },
  });
});

app.get('/api/replit/auth', (req, res) => {
  // Always use the public Replit dev domain so the auth callback comes back
  // to a URL the browser can actually reach (not localhost:3001).
  const domain =
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.REPLIT_DOMAINS ||
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    '';
  res.redirect(`https://replit.com/auth_with_repl_site?domain=${domain}`);
});

app.get('/api/replit/signout', (req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// AI proxy — self-contained, calls AI provider APIs directly from the server
// so no Supabase session is needed. BYOK keys are stored per-user in memory
// and on disk (aikeys.json) so they survive server restarts.
// ---------------------------------------------------------------------------

const AI_KEYS_FILE = path.join(__dirname, 'aikeys.json');

// { [userId]: { [provider]: apiKey } }
let _aiKeys = {};
try {
  if (fs.existsSync(AI_KEYS_FILE)) {
    _aiKeys = JSON.parse(fs.readFileSync(AI_KEYS_FILE, 'utf8'));
  }
} catch { _aiKeys = {}; }

function saveAiKeys() {
  try { fs.writeFileSync(AI_KEYS_FILE, JSON.stringify(_aiKeys)); } catch {}
}

// MCP server local storage — mirrors aikeys approach so no Supabase needed.
// { [userId]: MCPServer[] }
const MCP_FILE = path.join(__dirname, 'mcpservers.json');
let _mcpServers = {};
try {
  if (fs.existsSync(MCP_FILE)) _mcpServers = JSON.parse(fs.readFileSync(MCP_FILE, 'utf8'));
} catch { _mcpServers = {}; }

function saveMcpServers() {
  try { fs.writeFileSync(MCP_FILE, JSON.stringify(_mcpServers)); } catch {}
}

function getReplitUserId(req) {
  return req.headers['x-replit-user-id'] || null;
}

// Provider endpoint configs (mirrors the edge function)
const BYOK_PROVIDERS = {
  openai:      { url: 'https://api.openai.com/v1/chat/completions',                          authHeader: 'Bearer' },
  anthropic:   { url: 'https://api.anthropic.com/v1/messages',                               authHeader: 'x-api-key' },
  gemini:      { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', authHeader: 'Bearer' },
  perplexity:  { url: 'https://api.perplexity.ai/chat/completions',                          authHeader: 'Bearer' },
  deepseek:    { url: 'https://api.deepseek.com/v1/chat/completions',                        authHeader: 'Bearer' },
  xai:         { url: 'https://api.x.ai/v1/chat/completions',                                authHeader: 'Bearer' },
  cohere:      { url: 'https://api.cohere.com/v2/chat',                                      authHeader: 'Bearer' },
  openrouter:  { url: 'https://openrouter.ai/api/v1/chat/completions',                       authHeader: 'Bearer' },
  github:      { url: 'https://models.inference.ai.azure.com/chat/completions',              authHeader: 'Bearer' },
};

const BYOK_DEFAULT_MODELS = {
  openai: 'gpt-4o', anthropic: 'claude-3-5-sonnet-latest', gemini: 'gemini-2.5-flash',
  perplexity: 'sonar', deepseek: 'deepseek-chat', xai: 'grok-3-fast',
  cohere: 'command-r-plus', openrouter: 'openai/gpt-4o', github: 'gpt-4o',
};

// BYOK key management endpoints
app.get('/api/replit/ai/keys', (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });
  const userKeys = _aiKeys[uid] || {};
  const sanitized = Object.keys(userKeys).map(provider => ({
    id: `${uid}-${provider}`, provider, api_key: userKeys[provider],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), user_id: uid,
  }));
  res.json(sanitized);
});

app.put('/api/replit/ai/keys', (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });
  const { provider, api_key } = req.body || {};
  if (!provider || !api_key) return res.status(400).json({ error: 'provider and api_key required' });
  if (!_aiKeys[uid]) _aiKeys[uid] = {};
  _aiKeys[uid][provider] = api_key;
  saveAiKeys();
  res.json({ ok: true });
});

app.delete('/api/replit/ai/keys', (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });
  const { provider } = req.query;
  if (!provider) return res.status(400).json({ error: 'provider required' });
  if (_aiKeys[uid]) { delete _aiKeys[uid][provider]; saveAiKeys(); }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// MCP server CRUD endpoints
// ---------------------------------------------------------------------------

app.get('/api/replit/ai/mcp-servers', (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });
  res.json(_mcpServers[uid] || []);
});

app.post('/api/replit/ai/mcp-servers', (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });
  const { name, url, description, api_key } = req.body || {};
  if (!name || !url) return res.status(400).json({ error: 'name and url required' });
  if (!_mcpServers[uid]) _mcpServers[uid] = [];
  const now = new Date().toISOString();
  const server = { id: randomUUID(), name, url, description: description || null, api_key: api_key || null, is_enabled: true, created_at: now, updated_at: now };
  _mcpServers[uid].unshift(server);
  saveMcpServers();
  res.json(server);
});

app.patch('/api/replit/ai/mcp-servers/:id', (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });
  const { id } = req.params;
  const updates = req.body || {};
  if (!_mcpServers[uid]) return res.status(404).json({ error: 'Not found' });
  _mcpServers[uid] = _mcpServers[uid].map(s =>
    s.id === id ? { ...s, ...updates, id, updated_at: new Date().toISOString() } : s
  );
  saveMcpServers();
  res.json({ ok: true });
});

app.delete('/api/replit/ai/mcp-servers/:id', (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated' });
  const { id } = req.params;
  if (_mcpServers[uid]) _mcpServers[uid] = _mcpServers[uid].filter(s => s.id !== id);
  saveMcpServers();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// MCP tool helpers + agentic tool-calling loop
// ---------------------------------------------------------------------------

function buildMCPTool(servers) {
  const list = servers.map(s => s.name).join(', ');
  return {
    type: 'function',
    function: {
      name: 'mcp_call',
      description: `Call a configured MCP (Model Context Protocol) server. Available servers: ${list}. Start with tools/list to discover capabilities, then tools/call to invoke them.`,
      parameters: {
        type: 'object',
        properties: {
          server_name: { type: 'string', description: `Name of the MCP server. One of: ${list}` },
          method: { type: 'string', description: "JSON-RPC method, e.g. 'tools/list', 'tools/call', 'resources/list', 'resources/read'" },
          params: { type: 'object', description: 'Parameters for the method call' },
        },
        required: ['server_name', 'method'],
      },
    },
  };
}

async function executeMCPCall(serverName, method, params, servers) {
  const server = servers.find(s => s.name.toLowerCase() === serverName.toLowerCase());
  if (!server) {
    return JSON.stringify({ error: `MCP server "${serverName}" not found. Available: ${servers.map(s => s.name).join(', ')}` });
  }
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (server.api_key) headers['Authorization'] = `Bearer ${server.api_key}`;
    const body = { jsonrpc: '2.0', id: randomUUID(), method, params: params || {} };
    const resp = await fetch(server.url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!resp.ok) {
      const txt = await resp.text();
      return JSON.stringify({ error: `MCP server returned ${resp.status}: ${txt.slice(0, 300)}` });
    }
    const data = await resp.json();
    return JSON.stringify(data);
  } catch (err) {
    return JSON.stringify({ error: `Failed to call MCP server "${serverName}": ${err.message}` });
  }
}

// Agentic loop: keeps calling the provider until no more tool calls are needed.
// Handles both OpenAI-compatible and Anthropic formats.
async function runChatWithTools(provider, cfg, apiKey, model, messages, tools, mcpServers) {
  const MAX_LOOPS = 8;
  let msgs = [...messages];

  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    if (provider === 'anthropic') {
      const sysMsg = msgs.find(m => m.role === 'system');
      const chatMsgs = msgs.filter(m => m.role !== 'system');
      const body = {
        model, max_tokens: 8192,
        messages: chatMsgs,
        ...(sysMsg ? { system: sysMsg.content } : {}),
      };
      if (tools.length > 0) {
        body.tools = tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters,
        }));
      }
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.text(); throw new Error(`Anthropic ${res.status}: ${e.slice(0, 300)}`); }
      const data = await res.json();
      const toolUseBlocks = (data.content || []).filter(b => b.type === 'tool_use');
      const textBlock = (data.content || []).find(b => b.type === 'text');
      if (!toolUseBlocks.length || data.stop_reason !== 'tool_use') return textBlock?.text || '';
      // Execute tool calls
      msgs.push({ role: 'assistant', content: data.content });
      const results = await Promise.all(toolUseBlocks.map(async block => {
        const result = block.name === 'mcp_call'
          ? await executeMCPCall(block.input.server_name, block.input.method, block.input.params, mcpServers)
          : `Unknown tool: ${block.name}`;
        return { type: 'tool_result', tool_use_id: block.id, content: result };
      }));
      msgs.push({ role: 'user', content: results });

    } else {
      // OpenAI-compatible
      const body = { model, messages: msgs };
      if (tools.length > 0) { body.tools = tools; body.tool_choice = 'auto'; }
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.text(); throw new Error(`${provider} ${res.status}: ${e.slice(0, 300)}`); }
      const data = await res.json();
      const choice = data.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;
      if (!toolCalls || !toolCalls.length) return choice?.message?.content || '';
      // Execute tool calls
      msgs.push(choice.message);
      const results = await Promise.all(toolCalls.map(async call => {
        let args = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch {}
        const result = call.function.name === 'mcp_call'
          ? await executeMCPCall(args.server_name, args.method, args.params, mcpServers)
          : `Unknown tool: ${call.function.name}`;
        return { role: 'tool', tool_call_id: call.id, name: call.function.name, content: result };
      }));
      msgs.push(...results);
    }
  }
  return 'Reached the maximum number of tool calls without a final answer.';
}

// Build a simple system prompt for the AI
function buildSimpleSystemPrompt(currentFile, consoleErrors, workflows, mcpServers = []) {
  let ctx = 'You are a helpful AI coding assistant in Code Canvas IDE.\n\n';
  if (currentFile) {
    ctx += `### Active File: \`${currentFile.name}\`\n**Language**: ${currentFile.language || 'unknown'}\n\n\`\`\`${currentFile.language || ''}\n${currentFile.content || ''}\n\`\`\`\n`;
  } else {
    ctx += '📂 No file is currently open.\n';
  }
  if (consoleErrors) ctx += `\n### Console Errors\n\`\`\`\n${consoleErrors}\n\`\`\`\n`;
  if (workflows && workflows.length > 0) {
    ctx += `\n### Workflows\n${workflows.map(w => `- **${w.name}**: \`${w.command}\``).join('\n')}\n`;
  }
  if (mcpServers.length > 0) {
    ctx += `\n### Connected MCP Servers\nUse the mcp_call tool to interact with these servers. Start with tools/list to discover available tools.\n${mcpServers.map(s => `- **${s.name}**: ${s.url}${s.description ? ` — ${s.description}` : ''}`).join('\n')}\n`;
  }
  return ctx;
}

// Send a streaming SSE response with a single text chunk
function sseResponse(res, content) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  const chunk = JSON.stringify({ choices: [{ delta: { content } }] });
  res.write(`data: ${chunk}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

function sseError(res, status, message) {
  res.status(status).json({ error: message });
}

// Main chat handler — supports MCP tool calling
app.post('/api/replit/ai/chat', async (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return sseError(res, 401, 'Not authenticated with Replit');

  const { messages, currentFile, consoleErrors, workflows, model, byokProvider, byokModel, enableMCP } = req.body || {};

  // Determine which API key and provider to use
  const userKeys = _aiKeys[uid] || {};
  let provider = byokProvider || null;
  let apiKey = provider ? userKeys[provider] : null;

  // If no explicit provider, find the first saved key
  if (!provider || !apiKey) {
    for (const p of Object.keys(BYOK_PROVIDERS)) {
      if (userKeys[p]) { provider = p; apiKey = userKeys[p]; break; }
    }
  }

  if (!provider || !apiKey) {
    return sseError(res, 503,
      'No API key configured. Please add your own API key (OpenAI, Anthropic, Gemini, etc.) in the API Keys settings to use the AI assistant on Replit.'
    );
  }

  const cfg = BYOK_PROVIDERS[provider];
  if (!cfg) return sseError(res, 400, `Unsupported provider: ${provider}`);

  const effectiveModel = byokModel || BYOK_DEFAULT_MODELS[provider] || 'gpt-4o';

  // Load user's enabled MCP servers for tool calling
  const enabledMCPServers = enableMCP !== false
    ? ((_mcpServers[uid] || []).filter(s => s.is_enabled))
    : [];

  const tools = enabledMCPServers.length > 0 ? [buildMCPTool(enabledMCPServers)] : [];
  const systemPrompt = buildSimpleSystemPrompt(currentFile, consoleErrors, workflows, enabledMCPServers);
  const aiMessages = [{ role: 'system', content: systemPrompt }, ...(messages || [])];

  try {
    const content = await runChatWithTools(provider, cfg, apiKey, effectiveModel, aiMessages, tools, enabledMCPServers);
    return sseResponse(res, content);
  } catch (err) {
    return sseError(res, 500, `AI request failed: ${err.message}`);
  }
});

// Image generation — requires a key from a supported image provider
app.post('/api/replit/ai/image', async (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated with Replit' });
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const userKeys = _aiKeys[uid] || {};
  const openaiKey = userKeys['openai'];
  if (!openaiKey) {
    return res.status(503).json({ error: 'Image generation requires an OpenAI API key. Add one in API Keys settings.' });
  }

  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', response_format: 'url' }),
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(502).json({ error: `OpenAI image error: ${err.slice(0, 300)}` });
    }
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Music generation — placeholder (no free provider without Lovable key)
app.post('/api/replit/ai/music', (req, res) => {
  res.status(503).json({ error: 'Music generation is not available on Replit.' });
});

// ---------------------------------------------------------------------------
// Media generation proxy (image + video) — all BYOK providers
// ---------------------------------------------------------------------------

function bufferToDataUrl(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
}

function extractMediaUrl(payload) {
  return (
    payload?.mediaUrl ||
    payload?.output?.[0] ||
    payload?.data?.[0]?.url ||
    payload?.data?.[0]?.image_url ||
    payload?.data?.[0]?.video_url ||
    payload?.result?.url ||
    payload?.result?.video?.url ||
    payload?.output?.video ||
    payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url ||
    payload?.choices?.[0]?.message?.videos?.[0]?.video_url?.url ||
    null
  );
}

async function mediaCallOpenRouter(apiKey, mode, prompt, model) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: `${mode === 'video' ? 'Generate a short video' : 'Generate an image'}: ${prompt}` }],
      modalities: [mode, 'text'],
    }),
  });
  const data = await r.json();
  const mediaUrl = extractMediaUrl(data);
  if (!r.ok || !mediaUrl) throw new Error(data?.error?.message || 'OpenRouter generation failed');
  return mediaUrl;
}

async function mediaCallOpenAI(apiKey, prompt, model) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: '1024x1024' }),
  });
  const data = await r.json();
  const mediaUrl = extractMediaUrl(data);
  if (!r.ok || !mediaUrl) throw new Error(data?.error?.message || 'OpenAI image generation failed');
  return mediaUrl;
}

async function mediaCallGemini(apiKey, prompt, model) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
  const data = await r.json();
  const part = data?.candidates?.[0]?.content?.parts?.find(p => p?.inlineData?.data);
  if (!r.ok || !part?.inlineData?.data) throw new Error(data?.error?.message || 'Gemini image generation failed');
  return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
}

async function mediaCallStability(apiKey, prompt, model) {
  const endpoint = model === 'stable-image-ultra' ? 'ultra' : 'core';
  const r = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, output_format: 'png' }),
  });
  if (!r.ok) { const txt = await r.text(); throw new Error(txt || 'Stability generation failed'); }
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await r.json();
    if (data?.image) return `data:image/png;base64,${data.image}`;
    const url = extractMediaUrl(data);
    if (!url) throw new Error('Stability returned no image');
    return url;
  }
  const buf = await r.arrayBuffer();
  return bufferToDataUrl(buf, 'image/png');
}

async function mediaCallIdeogram(apiKey, prompt, model) {
  const r = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_request: { prompt, model, aspect_ratio: '1:1' } }),
  });
  const data = await r.json();
  const mediaUrl = data?.data?.[0]?.url || extractMediaUrl(data);
  if (!r.ok || !mediaUrl) throw new Error(data?.error?.message || 'Ideogram generation failed');
  return mediaUrl;
}

async function mediaCallReplicate(apiKey, prompt, model) {
  const create = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: { prompt } }),
  });
  const createData = await create.json();
  if (!create.ok) throw new Error(createData?.detail || 'Replicate request failed');
  const predictionUrl = createData?.urls?.get;
  let status = createData;
  for (let i = 0; i < 30 && predictionUrl; i++) {
    if (['succeeded', 'failed', 'canceled'].includes(status?.status)) break;
    await new Promise(resolve => setTimeout(resolve, 1500));
    const poll = await fetch(predictionUrl, { headers: { Authorization: `Token ${apiKey}` } });
    status = await poll.json();
  }
  const output = status?.output;
  const mediaUrl = Array.isArray(output) ? output[0] : output || extractMediaUrl(status);
  if (!mediaUrl) throw new Error(status?.error || 'Replicate returned no media');
  return mediaUrl;
}

async function mediaCallRunway(apiKey, prompt, model) {
  const create = await fetch('https://api.dev.runwayml.com/v1/text_to_video', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Runway-Version': '2024-11-06' },
    body: JSON.stringify({ model, promptText: prompt }),
  });
  const createData = await create.json();
  if (!create.ok) throw new Error(createData?.error || 'Runway request failed');
  const taskId = createData?.id;
  if (!taskId) throw new Error('Runway task id missing');
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const poll = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'X-Runway-Version': '2024-11-06' },
    });
    const data = await poll.json();
    const mediaUrl = extractMediaUrl(data);
    if (mediaUrl) return mediaUrl;
    if (data?.status === 'FAILED' || data?.status === 'CANCELLED') throw new Error(data?.error || 'Runway generation failed');
  }
  throw new Error('Runway generation timed out');
}

async function mediaCallFalVideo(apiKey, prompt, endpoint) {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await r.json();
  const mediaUrl = extractMediaUrl(data);
  if (!r.ok || !mediaUrl) throw new Error(data?.detail || data?.error || 'Video generation failed');
  return mediaUrl;
}

app.post('/api/replit/ai/media', async (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated with Replit' });
  const { mode, prompt, provider, model } = req.body || {};
  if (!mode || !prompt || !provider || !model) return res.status(400).json({ error: 'Missing required fields' });

  const userKeys = _aiKeys[uid] || {};
  const apiKey = userKeys[provider];
  if (!apiKey) return res.status(400).json({ error: `No ${provider} API key configured. Add one in the API Keys settings.` });

  try {
    let mediaUrl;
    if (provider === 'openrouter') {
      mediaUrl = await mediaCallOpenRouter(apiKey, mode, prompt, model);
    } else if (provider === 'openai') {
      if (mode !== 'image') return res.status(400).json({ error: 'OpenAI direct provider supports image mode only' });
      mediaUrl = await mediaCallOpenAI(apiKey, prompt, model);
    } else if (provider === 'gemini') {
      if (mode !== 'image') return res.status(400).json({ error: 'Gemini direct provider supports image mode only' });
      mediaUrl = await mediaCallGemini(apiKey, prompt, model);
    } else if (provider === 'stability') {
      if (mode !== 'image') return res.status(400).json({ error: 'Stability supports image generation only' });
      mediaUrl = await mediaCallStability(apiKey, prompt, model);
    } else if (provider === 'ideogram') {
      if (mode !== 'image') return res.status(400).json({ error: 'Ideogram supports image generation only' });
      mediaUrl = await mediaCallIdeogram(apiKey, prompt, model);
    } else if (provider === 'replicate') {
      mediaUrl = await mediaCallReplicate(apiKey, prompt, model);
    } else if (provider === 'runway') {
      if (mode !== 'video') return res.status(400).json({ error: 'Runway supports video generation only' });
      mediaUrl = await mediaCallRunway(apiKey, prompt, model);
    } else if (provider === 'kling') {
      if (mode !== 'video') return res.status(400).json({ error: 'Kling supports video generation only' });
      mediaUrl = await mediaCallFalVideo(apiKey, prompt, 'https://fal.run/fal-ai/kling-video/v2.1/master/text-to-video');
    } else if (provider === 'higgsfield') {
      if (mode !== 'video') return res.status(400).json({ error: 'Higgsfield supports video generation only' });
      mediaUrl = await mediaCallFalVideo(apiKey, prompt, 'https://fal.run/fal-ai/higgsfield/text-to-video');
    } else if (provider === 'luma') {
      if (mode !== 'video') return res.status(400).json({ error: 'Luma supports video generation only' });
      mediaUrl = await mediaCallFalVideo(apiKey, prompt, 'https://fal.run/fal-ai/luma-dream-machine');
    } else if (provider === 'pika') {
      if (mode !== 'video') return res.status(400).json({ error: 'Pika supports video generation only' });
      mediaUrl = await mediaCallFalVideo(apiKey, prompt, 'https://fal.run/fal-ai/pika/v2.2/text-to-video');
    } else {
      return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }
    res.json({ mediaUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 3D generation proxy — all BYOK providers (Meshy, Sloyd, Tripo, ModelsLab, Fal.ai, Neural4D)
// ---------------------------------------------------------------------------

async function gen3DMeshy(apiKey, prompt, taskId) {
  if (taskId) {
    const r = await fetch(`https://api.meshy.ai/openapi/v1/text-to-3d/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const d = await r.json();
    if (d.status === 'SUCCEEDED') return { status: 'SUCCEEDED', glbUrl: d.model_urls?.glb || d.model_url };
    if (d.status === 'FAILED') return { status: 'FAILED', error: d.message || 'Generation failed' };
    return { status: d.status || 'PENDING' };
  }
  const r = await fetch('https://api.meshy.ai/openapi/v1/text-to-3d', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'preview', prompt, art_style: 'realistic', negative_prompt: 'low quality, blurry, distorted' }),
  });
  const d = await r.json();
  if (!r.ok) return { error: d.message || 'Failed to start generation' };
  return { status: 'polling', taskId: d.result || d.id };
}

async function gen3DSloyd(apiKey, prompt) {
  const r = await fetch('https://api.sloyd.ai/v1/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, output_format: 'glb' }),
  });
  const d = await r.json();
  if (!r.ok) return { error: d.error || d.message || 'Sloyd generation failed' };
  return { status: 'SUCCEEDED', glbUrl: d.model_url || d.url };
}

async function gen3DTripo(apiKey, prompt, taskId) {
  if (taskId) {
    const r = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const d = await r.json();
    const s = d.data?.status;
    if (s === 'success') return { status: 'SUCCEEDED', glbUrl: d.data?.output?.model };
    if (s === 'failed') return { status: 'FAILED', error: 'Tripo generation failed' };
    return { status: 'PENDING' };
  }
  const r = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'text_to_model', prompt }),
  });
  const d = await r.json();
  if (!r.ok) {
    const errMsg = d.message || d.error || 'Tripo generation failed';
    const isBilling = /credit|balance|payment|subscribe/i.test(String(errMsg));
    return { status: 'FAILED', error: isBilling ? 'Your Tripo account is out of credits. Top up at tripo3d.ai or switch providers.' : errMsg, billing: isBilling };
  }
  return { status: 'polling', taskId: d.data?.task_id };
}

async function gen3DModelsLab(apiKey, prompt, taskId) {
  if (taskId) {
    const r = await fetch('https://modelslab.com/api/v6/3d/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: apiKey, request_id: taskId }),
    });
    const d = await r.json();
    if (d.status === 'success') return { status: 'SUCCEEDED', glbUrl: d.output?.[0] };
    if (d.status === 'error') return { status: 'FAILED', error: d.message || 'ModelsLab failed' };
    return { status: 'PENDING' };
  }
  const r = await fetch('https://modelslab.com/api/v6/3d/text_to_3d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: apiKey, prompt, negative_prompt: 'low quality', guidance_scale: 15, num_inference_steps: 64 }),
  });
  const d = await r.json();
  if (d.status === 'error' || !r.ok) {
    const errMsg = d.message || d.messege || 'ModelsLab failed';
    const isBilling = /out of credits|subscribe|fund your wallet|exhausted/i.test(String(errMsg));
    return { status: 'FAILED', error: isBilling ? 'Your ModelsLab account is out of credits. Top up at modelslab.com or switch providers.' : errMsg, billing: isBilling };
  }
  if (d.status === 'success' && d.output?.[0]) return { status: 'SUCCEEDED', glbUrl: d.output[0] };
  return { status: 'polling', taskId: d.id || d.request_id };
}

async function gen3DFal(apiKey, prompt) {
  const r = await fetch('https://fal.run/fal-ai/hyper3d/rodin', {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, geometry_file_format: 'glb' }),
  });
  const d = await r.json();
  if (!r.ok) {
    const errMsg = d.detail || d.message || d.error || 'Fal.ai generation failed';
    const isBilling = /exhausted balance|user is locked|top up/i.test(String(errMsg));
    return { status: 'FAILED', error: isBilling ? 'Your Fal.ai account is out of credits. Top up at fal.ai/dashboard/billing or switch providers.' : errMsg, billing: isBilling };
  }
  return { status: 'SUCCEEDED', glbUrl: d.model_mesh?.url || d.output?.url };
}

async function gen3DNeural4D(apiKey, prompt, taskId) {
  const BASE = 'https://alb.neural4d.com:3000/api';
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const tryFetch = async (url, body) => {
    try {
      const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      let data = {};
      try { data = await r.json(); } catch {}
      return { ok: true, data, status: r.status };
    } catch (e) {
      return { ok: false, error: `Neural4D temporarily unreachable (${e.message}). Please retry, or switch to Meshy / Tripo / Sloyd.` };
    }
  };
  if (taskId) {
    const result = await tryFetch(`${BASE}/retrieveModel`, { uuid: taskId });
    if (!result.ok) return { status: 'FAILED', error: result.error, unreachable: true };
    if (result.status >= 400) return { status: 'FAILED', error: result.data.error || result.data.message || `Neural4D status check failed (${result.status})` };
    const codeStatus = result.data.codeStatus;
    if (codeStatus === 0 && result.data.modelUrl) return { status: 'SUCCEEDED', glbUrl: result.data.modelUrl };
    if (codeStatus < 0) return { status: 'FAILED', error: result.data.message || 'Neural4D generation failed' };
    return { status: 'PENDING' };
  }
  const result = await tryFetch(`${BASE}/generateModelWithText`, { prompt, modelCount: 1, disablePbr: 0 });
  if (!result.ok) return { status: 'FAILED', error: result.error, unreachable: true };
  if (result.status >= 400) {
    const errMsg = result.data.error || result.data.message || `Neural4D returned ${result.status}`;
    const isAuth = result.status === 401 || /unauthor/i.test(String(errMsg));
    const isBilling = /credit|balance|insufficient|points|quota/i.test(String(errMsg));
    return { status: 'FAILED', error: isAuth ? 'Neural4D API key is invalid. Get one at neural4d.com/api and re-add it.' : isBilling ? 'Your Neural4D account is out of credits. Top up at neural4d.com or switch providers.' : errMsg, billing: isBilling };
  }
  const firstUuid = Array.isArray(result.data.uuids) ? result.data.uuids[0] : null;
  if (!firstUuid) return { status: 'FAILED', error: result.data.message || 'Neural4D did not return a model id' };
  return { status: 'polling', taskId: firstUuid };
}

app.post('/api/replit/ai/3d', async (req, res) => {
  const uid = getReplitUserId(req);
  if (!uid) return res.status(401).json({ error: 'Not authenticated with Replit' });
  const { prompt, taskId, provider = 'meshy' } = req.body || {};
  if (!taskId && !prompt) return res.status(400).json({ error: 'prompt required' });

  const userKeys = _aiKeys[uid] || {};
  const apiKey = userKeys[provider];
  if (!apiKey) return res.status(400).json({ error: `No ${provider} API key configured. Add one in the API Keys settings.` });

  try {
    let result;
    switch (provider) {
      case 'meshy':     result = await gen3DMeshy(apiKey, prompt, taskId || null); break;
      case 'sloyd':     result = await gen3DSloyd(apiKey, prompt); break;
      case 'tripo':     result = await gen3DTripo(apiKey, prompt, taskId || null); break;
      case 'modelslab': result = await gen3DModelsLab(apiKey, prompt, taskId || null); break;
      case 'fal':       result = await gen3DFal(apiKey, prompt); break;
      case 'neural4d':  result = await gen3DNeural4D(apiKey, prompt, taskId || null); break;
      default: return res.status(400).json({ error: `Unknown 3D provider: ${provider}` });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// One-shot code execution  (Run button — fresh process per run, stdin piped)
// ---------------------------------------------------------------------------
//
// Execution strategies:
//   interpret — write code to a file, invoke interpreter directly
//   cargo     — scaffold a Cargo project, `cargo run --quiet`
//   compile   — compile with gcc/g++, then run the resulting binary

const LANG_CONFIG = {
  // Interpreted
  python:     { type: 'interpret', cmd: 'python3', ext: 'py' },
  py:         { type: 'interpret', cmd: 'python3', ext: 'py' },
  javascript: { type: 'interpret', cmd: 'node',    ext: 'js' },
  js:         { type: 'interpret', cmd: 'node',    ext: 'js' },
  bash:       { type: 'interpret', cmd: 'bash',    ext: 'sh' },
  shell:      { type: 'interpret', cmd: 'bash',    ext: 'sh' },
  sh:         { type: 'interpret', cmd: 'bash',    ext: 'sh' },
  // Rust via Cargo
  rust:       { type: 'cargo',                              ext: 'rs' },
  rs:         { type: 'cargo',                              ext: 'rs' },
  // C / C++ via GCC
  c:          { type: 'compile', compiler: 'gcc', ext: 'c',   compileFlags: ['-lm'] },
  cpp:        { type: 'compile', compiler: 'g++', ext: 'cpp', compileFlags: ['-lm', '-std=c++17'] },
  'c++':      { type: 'compile', compiler: 'g++', ext: 'cpp', compileFlags: ['-lm', '-std=c++17'] },
};

// Shared finish-and-respond helper used by all strategies.
function finishExec(proc, tmpDir, stdin, res, timeoutMs = 30000) {
  let stdoutBuf = '';
  let stderrBuf = '';
  let timedOut  = false;

  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill('SIGTERM');
    setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
  }, timeoutMs);

  if (stdin) proc.stdin.write(stdin);
  proc.stdin.end();

  proc.stdout.on('data', (d) => { stdoutBuf += d.toString(); });
  proc.stderr.on('data', (d) => { stderrBuf += d.toString(); });

  proc.on('close', (exitCode) => {
    clearTimeout(timer);
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}

    const lines = stdoutBuf.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

    if (timedOut) {
      return res.json({ output: lines, error: '⏱️ Execution timed out.', executedAt: new Date().toISOString() });
    }
    if (exitCode !== 0) {
      const escapedTmp = tmpDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cleanErr = stderrBuf.replace(new RegExp(escapedTmp + '\\/', 'g'), '').trim();
      return res.json({ output: lines, error: cleanErr || `Process exited with code ${exitCode}`, executedAt: new Date().toISOString() });
    }
    return res.json({ output: lines.length > 0 ? lines : ['(no output)'], error: null, executedAt: new Date().toISOString() });
  });

  proc.on('error', (err) => {
    clearTimeout(timer);
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    return res.json({ output: [], error: err.message, executedAt: new Date().toISOString() });
  });
}

app.post('/api/replit/execute', (req, res) => {
  const { code, language = 'python', stdin } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'No code provided', output: [], executedAt: new Date().toISOString() });
  }

  const normalized = language.toLowerCase().trim();
  const config = LANG_CONFIG[normalized];

  if (!config) {
    return res.status(400).json({
      error: `Language '${language}' is not supported. Supported: python, javascript, bash, rust, c, cpp.`,
      output: [],
      executedAt: new Date().toISOString(),
    });
  }

  let tmpDir;
  try {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'cc-exec-'));

    // ── Cargo (Rust) ─────────────────────────────────────────────────────────
    if (config.type === 'cargo') {
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir);
      writeFileSync(path.join(tmpDir, 'Cargo.toml'), [
        '[package]',
        'name = "canvas-run"',
        'version = "0.1.0"',
        'edition = "2021"',
      ].join('\n') + '\n', 'utf8');
      writeFileSync(path.join(srcDir, 'main.rs'), code, 'utf8');

      const proc = spawn('cargo', ['run', '--quiet'], {
        cwd: tmpDir,
        env: { ...process.env, CARGO_TERM_COLOR: 'never' },
      });
      return finishExec(proc, tmpDir, stdin, res, 90000); // compile + run
    }

    // ── Compile then run (C / C++) ────────────────────────────────────────────
    if (config.type === 'compile') {
      const codeFile = path.join(tmpDir, `main.${config.ext}`);
      const binFile  = path.join(tmpDir, 'main');
      writeFileSync(codeFile, code, 'utf8');

      const compile = spawn(
        config.compiler,
        [codeFile, '-o', binFile, ...(config.compileFlags || [])],
        { cwd: tmpDir, env: process.env },
      );
      let compileErr = '';
      compile.stderr.on('data', (d) => { compileErr += d.toString(); });
      compile.stdout.on('data', () => {}); // drain

      compile.on('close', (exitCode) => {
        if (exitCode !== 0) {
          try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
          const cleanErr = compileErr.replace(new RegExp(tmpDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\/', 'g'), '').trim();
          return res.json({ output: [], error: cleanErr || `Compilation failed (exit ${exitCode})`, executedAt: new Date().toISOString() });
        }
        const proc = spawn(binFile, [], { cwd: tmpDir, env: process.env });
        finishExec(proc, tmpDir, stdin, res);
      });

      compile.on('error', (err) => {
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        return res.json({ output: [], error: `Compiler error: ${err.message}`, executedAt: new Date().toISOString() });
      });
      return;
    }

    // ── Interpret (python / node / bash) ─────────────────────────────────────
    const codeFile = path.join(tmpDir, `main.${config.ext}`);
    writeFileSync(codeFile, code, 'utf8');
    const proc = spawn(config.cmd, [codeFile], {
      cwd: tmpDir,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
    finishExec(proc, tmpDir, stdin, res);

  } catch (err) {
    if (tmpDir) try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    return res.status(500).json({ output: [], error: err.message, executedAt: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// Static file serving (production build)
// ---------------------------------------------------------------------------

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ---------------------------------------------------------------------------
// HTTP server + WebSocket server (PTY interactive terminal)
// ---------------------------------------------------------------------------

const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/api/replit/pty') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ---------------------------------------------------------------------------
// Command safety filter
// Checks a fully-typed shell line (before the user hits Enter) against a list
// of patterns that could damage the host environment or other sessions.
// ---------------------------------------------------------------------------
function isBlockedCommand(line) {
  const cmd = line.trim().replace(/\s+/g, ' ');
  if (!cmd) return false;

  const BLOCKED = [
    // kill -9 -1 / kill -KILL -1 / kill -- -1  (kill ALL processes)
    /\bkill\b\s+(?:-[-a-zA-Z0-9]+\s+)*-1(\s|$)/,
    // kill without explicit signal: just `kill -1`
    /\bkill\b\s+-1(\s|$)/,
    // rm -rf /  or  rm -fr /  or  rm --recursive --force /
    /\brm\b\s+(?:-[a-zA-Z]*[rR][a-zA-Z]*\s+|--recursive\s+|--force\s+){1,4}\s*\/[* ]*/,
    /\brm\b\s+(?:-[a-zA-Z]*[fF][a-zA-Z]*\s+|--force\s+){1,4}(?:-[a-zA-Z]*[rR][a-zA-Z]*\s+|--recursive\s+)+\s*\/[* ]*/,
    // fork bomb  :(){ :|:& };:
    /:\s*\(\s*\)\s*\{/,
    // dd writing to a block device
    /\bdd\b.*\bof=\/dev\/(sd|hd|vd|nvme|xvd)/,
    // mkfs — reformats a filesystem
    /\bmkfs\b/,
    // direct redirect to a block device
    />\s*\/dev\/(sd[a-z]|hd[a-z]|vd[a-z]|nvme|xvd)/,
  ];

  return BLOCKED.some((re) => re.test(cmd));
}

wss.on('connection', (ws) => {
  let ptyProcess = null;

  // Per-connection fallback ID — guarantees the shell never starts in the
  // workspace root even if the client sends no projectId.
  const connSessionId = `conn-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Tracks characters typed on the current line so we can inspect the full
  // command before forwarding the Enter key to bash.
  let lineBuffer = '';

  // cwd is set during init and reused for later sync-files messages.
  let cwd = '';

  ws.on('message', (msg) => {
    const str = msg.toString();

    // First message must be {type:'init'} — write project files and spawn PTY
    if (ptyProcess === null) {
      try {
        const parsed = JSON.parse(str);
        if (parsed.type !== 'init') return; // drop anything until init

        const { projectId, projectName, files = [], cols = 80, rows = 24 } = parsed;

        // Always use a temp dir — never the workspace root.
        const resolvedId = projectId || connSessionId;
        const projectDir = path.join(tmpdir(), `canvas-${resolvedId}`);

        cwd = projectDir; // default; refined below after writing files

        try {
          fs.mkdirSync(projectDir, { recursive: true });
          for (const { path: filePath, content } of files) {
            if (!filePath || typeof content !== 'string') continue;
            // Sanitise path — strip leading slashes / traversals
            const safe = filePath.replace(/^[./\\]+/, '').replace(/\.\.\//g, '');
            if (!safe) continue;
            const fullPath = path.join(projectDir, safe);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content, 'utf8');
          }

          // After writing, detect the project root by looking at the real filesystem.
          // If projectDir contains exactly ONE subdirectory (ignoring hidden files like
          // .bashrc) and no top-level files, the shell should start inside that subdir.
          // This handles the common layout where all files live under a "my-canvas/" root.
          const topEntries = fs.readdirSync(projectDir, { withFileTypes: true })
            .filter(e => !e.name.startsWith('.'));
          const topDirs  = topEntries.filter(e => e.isDirectory());
          const topFiles = topEntries.filter(e => e.isFile());
          if (topDirs.length === 1 && topFiles.length === 0) {
            cwd = path.join(projectDir, topDirs[0].name);
          }
          console.log(`[PTY] projectDir=${projectDir}  startCwd=${cwd}`);

          // Sanitise the project name for safe embedding in a bash variable.
          const safeProjectName = (projectName || 'project')
            .toString()
            .replace(/['"\\`$\x00-\x1f]/g, '_')
            .slice(0, 64) || 'project';

          // Write a .bashrc so bash picks up our prompt when it sources HOME/.bashrc.
          // PROMPT_COMMAND updates PS1 before each prompt so cd is reflected.
          // HOME is set to startDir so ${PWD/#$HOME/...} shows a friendly path.
          // Also installs runtime safety: ulimit caps + kill() override.
          const bashrc = [
            '# CodeCanvas shell',
            '[ -f /etc/bash.bashrc ] && source /etc/bash.bashrc',
            `CANVAS_PROJECT='${safeProjectName}'`,
            '__canvas_prompt() {',
            '  local p="${PWD/#$HOME/$CANVAS_PROJECT}"',
            '  PS1="\\[\\033[01;36m\\]${p}\\[\\033[00m\\]\\[\\033[01m\\]\\$\\[\\033[00m\\] "',
            '}',
            "PROMPT_COMMAND='__canvas_prompt'",
            '# Resource limits — defence against fork bombs and runaway writes',
            'ulimit -u 2048    # max 2048 user processes (fork bomb protection)',
            'ulimit -f 204800  # max 200 MB per file write',
            '# Shell-level kill guard (server-side filter is the primary block)',
            'kill() {',
            '  for _arg in "$@"; do',
            '    if [[ "$_arg" == "-1" ]]; then',
            '      echo -e "\\033[31m\u26d4  Blocked: kill -1 (kill all processes) is not permitted.\\033[0m" >&2',
            '      return 1',
            '    fi',
            '  done',
            '  command kill "$@"',
            '}',
            '# Override sudo message — replace "Replit" branding with CodeCanvas',
            'sudo() {',
            '  if [[ ! -f ~/.sudo_motd ]]; then',
            '    echo -e "\\t\\033[93mYou don\'t need sudo in CodeCanvas, all files that\\033[0m" >&2',
            '    echo -e "\\t\\033[93mcan be modified already have the correct permissions.\\033[0m" >&2',
            '    echo -e "" >&2',
            '    touch ~/.sudo_motd',
            '  fi',
            '  command sudo "$@"',
            '}',
          ].join('\n') + '\n';
          fs.writeFileSync(path.join(projectDir, '.bashrc'), bashrc, 'utf8');
        } catch (e) {
          console.error('Failed to write project files:', e.message);
        }

        ptyProcess = pty.spawn('bash', ['--rcfile', path.join(projectDir, '.bashrc')], {
          name: 'xterm-256color',
          cols: Math.max(1, cols),
          rows: Math.max(1, rows),
          cwd,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            PYTHONUNBUFFERED: '1',
            // HOME = cwd so PROMPT_COMMAND shows project-relative paths
            HOME: cwd,
          },
        });

        ptyProcess.onData((data) => {
          try { if (ws.readyState === ws.OPEN) ws.send(data); } catch {}
        });

        ptyProcess.onExit(() => {
          try { if (ws.readyState === ws.OPEN) ws.close(); } catch {}
        });

      } catch (e) {
        console.error('PTY init error:', e.message);
      }
      return;
    }

    // PTY is running — handle resize, sync-files, or forward raw input
    try {
      const parsed = JSON.parse(str);

      if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
        ptyProcess.resize(Math.max(1, parsed.cols), Math.max(1, parsed.rows));
        return;
      }

      // sync-files — write new/updated project files into the live shell dir
      // without restarting the PTY. Sent by the client whenever the IDE file
      // tree changes (e.g. after a git clone or GitHub import).
      if (parsed.type === 'sync-files' && Array.isArray(parsed.files) && cwd) {
        try {
          for (const { path: filePath, content } of parsed.files) {
            if (!filePath || typeof content !== 'string') continue;
            const safe = filePath.replace(/^[./\\]+/, '').replace(/\.\.\//g, '');
            if (!safe) continue;
            const fullPath = path.join(cwd, safe);
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content, 'utf8');
          }
          // Notify the terminal that files are ready — written directly to
          // the xterm display, not to bash stdin, so it doesn't interfere
          // with whatever the user is typing.
          if (ws.readyState === ws.OPEN) {
            ws.send(`\r\n\x1b[36m● Project files synced to shell.\x1b[0m\r\n`);
          }
        } catch (e) {
          console.error('sync-files error:', e.message);
        }
        return;
      }
    } catch {}

    // Feed each character through the safety filter.
    // We buffer the current line so that when Enter arrives we can inspect the
    // full command before deciding whether to forward the keystroke to bash.
    let toWrite = '';
    for (const ch of str) {
      if (ch === '\r' || ch === '\n') {
        if (isBlockedCommand(lineBuffer)) {
          // Flush safe chars typed so far, then cancel the line with Ctrl-C.
          if (toWrite) { try { ptyProcess.write(toWrite); } catch {} toWrite = ''; }
          try { ptyProcess.write('\x03'); } catch {} // ^C clears bash readline
          const cmdName = lineBuffer.trim().split(/\s+/)[0] || 'command';
          setTimeout(() => {
            try {
              ws.send(`\r\n\x1b[31m\u26d4  Blocked: '${cmdName}' is not permitted in this environment.\x1b[0m\r\n`);
            } catch {}
          }, 40);
          lineBuffer = '';
          continue; // do NOT forward the Enter key
        }
        lineBuffer = '';
        toWrite += ch;
      } else if (ch === '\x7f' || ch === '\x08') {
        // Backspace — keep buffer in sync
        lineBuffer = lineBuffer.slice(0, -1);
        toWrite += ch;
      } else if (ch === '\x03') {
        // Ctrl-C — user cancelled the line themselves
        lineBuffer = '';
        toWrite += ch;
      } else {
        lineBuffer += ch;
        toWrite += ch;
      }
    }
    if (toWrite) { try { ptyProcess.write(toWrite); } catch {} }
  });

  ws.on('close', () => {
    try { ptyProcess?.kill(); } catch {}
  });

  ws.on('error', () => {
    try { ptyProcess?.kill(); } catch {}
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Replit server running on port ${PORT}`);
});
