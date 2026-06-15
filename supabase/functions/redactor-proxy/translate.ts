/**
 * Shape translation between OpenAI, Anthropic, and Gemini formats.
 *
 * Supports request body translation (OpenAI → native) and
 * response body / streaming translation (native → OpenAI).
 */

// ---------- OpenAI → Anthropic ----------

function openaiToAnthropicReq(body: Record<string, unknown>): Record<string, unknown> {
  const messages = body.messages as Array<Record<string, unknown>> | undefined;
  const system = messages?.find((m) => m.role === "system")?.content;
  const msgs = messages?.filter((m) => m.role !== "system") ?? [];

  const out: Record<string, unknown> = {
    model: body.model,
    messages: msgs.map((m) => ({
      role: m.role === "developer" ? "user" : m.role,
      content: typeof m.content === "string" ? m.content : m.content,
    })),
    max_tokens: body.max_tokens ?? body.maxTokens,
  };
  if (system) out.system = system;
  if (body.temperature != null) out.temperature = body.temperature;
  if (body.stream) out.stream = body.stream;
  if (body.top_p != null) out.top_p = body.top_p;
  if (body.stop_sequences) out.stop_sequences = body.stop_sequences;
  return out;
}

function anthropicToOpenaiRes(body: Record<string, unknown>): Record<string, unknown> {
  const content = body.content;
  const text = Array.isArray(content)
    ? content.map((c: Record<string, unknown>) => c.text).filter(Boolean).join("")
    : typeof content === "string"
      ? content
      : "";

  const usage = body.usage as Record<string, unknown> | undefined;

  return {
    id: body.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
        },
        finish_reason: body.stop_reason === "end_turn" ? "stop" : (body.stop_reason ?? "stop"),
      },
    ],
    usage: usage
      ? {
          prompt_tokens: usage.input_tokens,
          completion_tokens: usage.output_tokens,
          total_tokens: (usage.input_tokens as number) + (usage.output_tokens as number),
        }
      : undefined,
  };
}

function anthropicToOpenaiSSE(line: string): string | null {
  if (!line.startsWith("data: ")) return null;
  const json = tryParse(line.slice(6));
  if (!json) return null;

  const type = (json as Record<string, unknown>).type as string;

  if (type === "message_start") {
    const msg = (json as Record<string, unknown>).message as Record<string, unknown> | undefined;
    const usage = msg?.usage as Record<string, unknown> | undefined;
    return (
      `data: ` +
      JSON.stringify({
        id: msg?.id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: msg?.model,
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "" },
            finish_reason: null,
          },
        ],
        usage: usage
          ? {
              prompt_tokens: usage.input_tokens,
              completion_tokens: usage.output_tokens,
              total_tokens: (usage.input_tokens as number) + (usage.output_tokens as number),
            }
          : undefined,
      }) +
      "\n\n"
    );
  }

  if (type === "content_block_delta") {
    const delta = (json as Record<string, unknown>).delta as Record<string, unknown> | undefined;
    return (
      `data: ` +
      JSON.stringify({
        object: "chat.completion.chunk",
        choices: [
          {
            index: 0,
            delta: { content: delta?.text ?? "" },
            finish_reason: null,
          },
        ],
      }) +
      "\n\n"
    );
  }

  if (type === "message_delta") {
    const delta = (json as Record<string, unknown>).delta as Record<string, unknown> | undefined;
    const usage = (json as Record<string, unknown>).usage as Record<string, unknown> | undefined;
    return (
      `data: ` +
      JSON.stringify({
        object: "chat.completion.chunk",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: delta?.stop_reason === "end_turn" ? "stop" : null,
          },
        ],
        usage: usage
          ? {
              prompt_tokens: usage.input_tokens,
              completion_tokens: usage.output_tokens,
              total_tokens: (usage.input_tokens as number) + (usage.output_tokens as number),
            }
          : undefined,
      }) +
      "\n\n"
    );
  }

  if (type === "message_stop") {
    return "data: [DONE]\n\n";
  }

  return null;
}

// ---------- OpenAI → Gemini ----------

function openaiToGeminiReq(body: Record<string, unknown>): Record<string, unknown> {
  const messages = body.messages as Array<Record<string, unknown>> | undefined;
  const systemMsg = messages?.find((m) => m.role === "system");

  const contents = messages?.filter((m) => m.role !== "system")?.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
  }));

  const out: Record<string, unknown> = {
    contents,
  };

  if (systemMsg) {
    out.system_instruction = {
      parts: [{ text: typeof systemMsg.content === "string" ? systemMsg.content : JSON.stringify(systemMsg.content) }],
    };
  }

  const genConfig: Record<string, unknown> = {};
  if (body.temperature != null) genConfig.temperature = body.temperature;
  if (body.max_tokens != null) genConfig.maxOutputTokens = body.max_tokens;
  if (body.top_p != null) genConfig.topP = body.top_p;
  if (body.stream) genConfig.stream = body.stream;
  if (Object.keys(genConfig).length > 0) out.generationConfig = genConfig;

  return out;
}

function geminiToOpenaiRes(body: Record<string, unknown>): Record<string, unknown> {
  const candidates = body.candidates as Array<Record<string, unknown>> | undefined;
  const candidate = candidates?.[0];
  const content = candidate?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;
  const text = parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
  const finishReason = candidate?.finishReason as string | undefined;
  const usageMeta = body.usageMetadata as Record<string, unknown> | undefined;

  return {
    id: body.id ?? `gemini-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: finishReason === "STOP" ? "stop" : (finishReason?.toLowerCase() ?? "stop"),
      },
    ],
    usage: usageMeta
      ? {
          prompt_tokens: usageMeta.promptTokenCount,
          completion_tokens: usageMeta.candidatesTokenCount,
          total_tokens: (usageMeta.promptTokenCount as number) + (usageMeta.candidatesTokenCount as number),
        }
      : undefined,
  };
}

function geminiToOpenaiSSE(line: string): string | null {
  if (!line.startsWith("data: ")) return null;
  const json = tryParse(line.slice(6));
  if (!json) return null;

  const candidates = (json as Record<string, unknown>).candidates as Array<Record<string, unknown>> | undefined;
  const c = candidates?.[0];
  if (!c) return null;

  const content = c.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;
  const text = parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
  const finishReason = c.finishReason as string | undefined;

  const usageMeta = (json as Record<string, unknown>).usageMetadata as Record<string, unknown> | undefined;

  const chunk: Record<string, unknown> = {
    object: "chat.completion.chunk",
    choices: [
      {
        index: 0,
        delta: text ? { content: text } : {},
        finish_reason: finishReason === "STOP" ? "stop" : null,
      },
    ],
  };
  if (usageMeta) {
    chunk.usage = {
      prompt_tokens: usageMeta.promptTokenCount,
      completion_tokens: usageMeta.candidatesTokenCount,
      total_tokens: (usageMeta.promptTokenCount as number) + (usageMeta.candidatesTokenCount as number),
    };
  }

  return `data: ${JSON.stringify(chunk)}\n\n`;
}

// ---------- Helpers ----------

function tryParse(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ---------- Public API ----------

export type Shape = "openai" | "anthropic" | "gemini";

export function translateRequest(
  body: Record<string, unknown>,
  from: Shape,
  to: Shape,
): Record<string, unknown> {
  if (from === to) return body;
  if (from === "openai" && to === "anthropic") return openaiToAnthropicReq(body);
  if (from === "openai" && to === "gemini") return openaiToGeminiReq(body);
  return body;
}

export function translateResponse(
  body: Record<string, unknown>,
  from: Shape,
  to: Shape,
): Record<string, unknown> {
  if (from === to) return body;
  if (from === "anthropic" && to === "openai") return anthropicToOpenaiRes(body);
  if (from === "gemini" && to === "openai") return geminiToOpenaiRes(body);
  return body;
}

export function translateStreamChunk(
  line: string,
  from: Shape,
  to: Shape,
): string | null {
  if (from === to) return null;
  if (from === "gemini" && to === "openai") return geminiToOpenaiSSE(line);
  if (from === "anthropic" && to === "openai") return anthropicToOpenaiSSE(line);
  return null;
}

export function detectShape(body: Record<string, unknown>): Shape {
  if (body.messages) return "openai";
  if (body.contents) return "gemini";
  if (body.messages === undefined && (body.anthropic_version || body.max_tokens !== undefined)) {
    return "anthropic";
  }
  if (Array.isArray(body.contents)) return "gemini";
  return "openai";
}
