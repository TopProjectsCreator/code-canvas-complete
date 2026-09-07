/**
 * Chat-role canonicalization for the main thread.
 *
 * Strict chat templates (notably Gemma's) raise
 * "Conversation roles must alternate user/assistant/user/assistant/..."
 * unless turns strictly alternate starting with 'user'. Histories assembled
 * from UI state can transiently violate this (aborted generations leave
 * empty assistant turns, error paths replace content, retries append tool
 * turns), so histories are sanitized here AND re-canonicalized inside the
 * workers on the exact template-bound arrays.
 *
 * NOTE: keep behavior identical to public/workers/chat-roles.js (the worker
 * copy). src/test/chatRoles.test.ts fuzzes both implementations and fails
 * on any drift.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

const coerceRole = (role: unknown): 'user' | 'assistant' =>
  role === 'assistant' ? 'assistant' : 'user';

export const normalizeChatTurns = (turns: unknown): ChatTurn[] => {
  const out: ChatTurn[] = [];
  for (const t of Array.isArray(turns) ? turns : []) {
    const turn = t as { role?: unknown; content?: unknown };
    const role = coerceRole(turn?.role);
    const content = String(turn?.content ?? '').trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += '\n\n' + content;
    else out.push({ role, content });
  }
  while (out.length && out[0].role === 'assistant') out.shift();
  return out;
};

export const canonicalizeChatMessages = (messages: unknown, appendUserText: unknown = ''): ChatTurn[] => {
  const turns = normalizeChatTurns(messages);
  const text = appendUserText === undefined || appendUserText === null ? '' : String(appendUserText);
  if (text.trim()) {
    const last = turns[turns.length - 1];
    if (last && last.role === 'user') last.content += `\n\n${text}`;
    else turns.push({ role: 'user', content: text });
  }
  return turns;
};

export const assertAlternatingChatMessages = (messages: unknown): true => {
  const roles = (Array.isArray(messages) ? messages : []).map(m => (m as { role?: unknown })?.role);
  for (let i = 0; i < roles.length; i++) {
    const expected = i % 2 === 0 ? 'user' : 'assistant';
    if (roles[i] !== expected) {
      throw new Error(
        `Non-alternating chat roles [${roles.join(', ')}] at index ${i} (expected '${expected}'). ` +
        `This is an app bug — histories must be canonicalized before inference.`
      );
    }
  }
  return true;
};
