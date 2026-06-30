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
    max_tokens: body.max_tokens ?? body.maxTokens ?? body.max_completion_tokens,
  };
  if (system) out.system = system;
  if (body.temperature != null) out.temperature = body.temperature;
  if (body.stream) out.stream = body.stream;
  if (body.top_p != null) out.top_p = body.top_p;
  if (body.stop_sequences) out.stop_sequences = body.stop_sequences;
  else if (body.stop != null) {
    out.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  }
  if (body.metadata != null) out.metadata = body.metadata;
  if (body.tools) {
    const tools = body.tools as Array<Record<string, unknown>>;
    out.tools = tools.map((t) => {
      const fn = t.function as Record<string, unknown> | undefined;
      return {
        name: fn?.name ?? "",
        description: fn?.description ?? "",
        input_schema: fn?.parameters ?? {},
      };
    });
  }
  if (body.tool_choice) {
    const tc = body.tool_choice;
    if (typeof tc === "object" && tc !== null) {
      const fn = (tc as Record<string, unknown>).function as Record<string, unknown> | undefined;
      if (fn?.name) out.tool_choice = { type: "tool", name: fn.name as string };
    }
    // "auto" and "none" left unmapped: Anthropic has no "none", and auto is the default
  }
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
  else if (body.max_completion_tokens != null) genConfig.maxOutputTokens = body.max_completion_tokens;
  if (body.top_p != null) genConfig.topP = body.top_p;
  // stream is NOT mapped to generationConfig — Gemini uses endpoint URL for streaming
  if (body.stop_sequences) genConfig.stopSequences = body.stop_sequences;
  else if (body.stop != null) genConfig.stopSequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  if (body.frequency_penalty != null) genConfig.frequencyPenalty = body.frequency_penalty;
  if (body.presence_penalty != null) genConfig.presencePenalty = body.presence_penalty;
  if (body.seed != null) genConfig.seed = body.seed;
  if (body.n != null) genConfig.candidateCount = body.n;
  if (body.response_format) {
    const rf = body.response_format as Record<string, unknown>;
    if (rf.type === "json_object") genConfig.responseMimeType = "application/json";
    else if (rf.type === "json_schema") {
      genConfig.responseMimeType = "application/json";
      const schema = (rf.json_schema as Record<string, unknown> | undefined)?.schema;
      if (schema) genConfig.responseSchema = schema;
    }
  }
  if (Object.keys(genConfig).length > 0) out.generationConfig = genConfig;

  if (body.tools) {
    const tools = body.tools as Array<Record<string, unknown>>;
    out.tools = [{
      functionDeclarations: tools.map((t) => {
        const fn = t.function as Record<string, unknown> | undefined;
        return {
          name: fn?.name ?? "",
          description: fn?.description ?? "",
          parameters: fn?.parameters ?? {},
        };
      }),
    }];
  }
  if (body.tool_choice) {
    const tc = body.tool_choice;
    const fcc: Record<string, unknown> = {};
    if (tc === "auto") fcc.mode = "AUTO";
    else if (tc === "none") fcc.mode = "NONE";
    else if (tc === "required") fcc.mode = "ANY";
    else if (typeof tc === "object" && tc !== null) {
      const fn = (tc as Record<string, unknown>).function as Record<string, unknown> | undefined;
      if (fn?.name) {
        fcc.mode = "ANY";
        fcc.allowedFunctionNames = [fn.name as string];
      }
    }
    if (Object.keys(fcc).length > 0) out.toolConfig = { functionCallingConfig: fcc };
  }
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

// ---------- Gemini → OpenAI request ----------

function geminiToOpenaiReq(body: Record<string, unknown>): Record<string, unknown> {
  const contents = body.contents as Array<Record<string, unknown>> | undefined;
  const systemInstruction = body.system_instruction as Record<string, unknown> | undefined;
  const genConfig = body.generationConfig as Record<string, unknown> | undefined;

  const messages: Record<string, unknown>[] = [];

  if (systemInstruction) {
    const parts = systemInstruction.parts as Array<Record<string, unknown>> | undefined;
    const text = parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
    if (text) messages.push({ role: "system", content: text });
  }

  if (contents) {
    for (const c of contents) {
      const parts = c.parts as Array<Record<string, unknown>> | undefined;
      const text = parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
      const role = c.role === "model" ? "assistant" : ((c.role as string) ?? "user");
      messages.push({ role, content: text });
    }
  }

  const out: Record<string, unknown> = { messages };
  if (body.model) out.model = body.model;
  if (genConfig) {
    if (genConfig.temperature != null) out.temperature = genConfig.temperature;
    if (genConfig.maxOutputTokens != null) out.max_tokens = genConfig.maxOutputTokens;
    if (genConfig.topP != null) out.top_p = genConfig.topP;
    if (genConfig.stream) out.stream = genConfig.stream;
    if (genConfig.stopSequences) out.stop = genConfig.stopSequences;
    if (genConfig.frequencyPenalty != null) out.frequency_penalty = genConfig.frequencyPenalty;
    if (genConfig.presencePenalty != null) out.presence_penalty = genConfig.presencePenalty;
    if (genConfig.seed != null) out.seed = genConfig.seed;
    if (genConfig.candidateCount != null) out.n = genConfig.candidateCount;
    if (genConfig.responseMimeType) {
      out.response_format = { type: genConfig.responseMimeType === "application/json" ? "json_object" : "text" };
    }
  }
  if (body.tools) {
    const geminiTools = body.tools as Array<Record<string, unknown>>;
    const fds = geminiTools.flatMap((t) => {
      const decls = t.functionDeclarations as Array<Record<string, unknown>> | undefined;
      return decls ?? [];
    });
    out.tools = fds.map((fd) => ({
      type: "function",
      function: {
        name: fd.name ?? "",
        description: fd.description ?? "",
        parameters: fd.parameters ?? {},
      },
    }));
  }
  if (body.toolConfig) {
    const tc = body.toolConfig as Record<string, unknown>;
    const fcc = tc.functionCallingConfig as Record<string, unknown> | undefined;
    if (fcc) {
      const mode = fcc.mode as string;
      if (mode === "NONE") out.tool_choice = "none";
      else if (mode === "AUTO") out.tool_choice = "auto";
      else if (mode === "ANY") {
        const names = fcc.allowedFunctionNames as string[] | undefined;
        if (names && names.length === 1) out.tool_choice = { type: "function", function: { name: names[0] } };
        else out.tool_choice = "required";
      }
    }
  }
  return out;
}

// ---------- Anthropic → OpenAI request ----------

function anthropicToOpenaiReq(body: Record<string, unknown>): Record<string, unknown> {
  const messages = body.messages as Array<Record<string, unknown>> | undefined;
  const system = body.system;

  const msgs: Record<string, unknown>[] = [];
  if (system) {
    msgs.push({ role: "system", content: typeof system === "string" ? system : JSON.stringify(system) });
  }
  if (messages) {
    for (const m of messages) {
      msgs.push({
        role: (m.role as string) ?? "user",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      });
    }
  }

  const out: Record<string, unknown> = { messages: msgs };
  if (body.model) out.model = body.model;
  if (body.max_tokens != null) out.max_tokens = body.max_tokens;
  if (body.temperature != null) out.temperature = body.temperature;
  if (body.top_p != null) out.top_p = body.top_p;
  if (body.stream) out.stream = body.stream;
  if (body.stop_sequences) out.stop = body.stop_sequences;
  if (body.metadata != null) out.metadata = body.metadata;
  if (body.tools) {
    const tools = body.tools as Array<Record<string, unknown>>;
    out.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name ?? "",
        description: t.description ?? "",
        parameters: t.input_schema ?? {},
      },
    }));
  }
  if (body.tool_choice) {
    const tc = body.tool_choice as Record<string, unknown>;
    const type = tc.type as string;
    if (type === "auto") out.tool_choice = "auto";
    else if (type === "any") out.tool_choice = "required";
    else if (type === "tool" && tc.name) out.tool_choice = { type: "function", function: { name: tc.name } };
  }
  return out;
}

// ---------- OpenAI → Gemini response ----------

function openaiToGeminiRes(body: Record<string, unknown>): Record<string, unknown> {
  const choices = body.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  const message = choice?.message as Record<string, unknown> | undefined;
  const text = (message?.content as string) ?? "";
  const finishReason = choice?.finish_reason as string | undefined;
  const usage = body.usage as Record<string, unknown> | undefined;

  const candidates: Array<Record<string, unknown>> = [{
    content: {
      parts: text ? [{ text }] : [],
      role: "model",
    },
  }];
  if (finishReason) {
    candidates[0].finishReason = finishReason === "stop" ? "STOP" : finishReason.toUpperCase();
  }

  const out: Record<string, unknown> = { candidates, model: body.model ?? "" };
  if (usage) {
    out.usageMetadata = {
      promptTokenCount: usage.prompt_tokens,
      candidatesTokenCount: usage.completion_tokens,
    };
  }
  return out;
}

// ---------- OpenAI → Anthropic response ----------

function openaiToAnthropicRes(body: Record<string, unknown>): Record<string, unknown> {
  const choices = body.choices as Array<Record<string, unknown>> | undefined;
  const choice = choices?.[0];
  const message = choice?.message as Record<string, unknown> | undefined;
  const text = (message?.content as string) ?? "";
  const finishReason = choice?.finish_reason as string | undefined;
  const usage = body.usage as Record<string, unknown> | undefined;

  return {
    id: body.id ?? `msg-${Date.now()}`,
    type: "message",
    role: "assistant",
    content: text ? [{ type: "text", text }] : [],
    model: body.model,
    stop_reason: finishReason === "stop" ? "end_turn" : finishReason ?? "end_turn",
    usage: usage
      ? {
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
        }
      : undefined,
  };
}

// ---------- OpenAI → Gemini SSE ----------

function openaiToGeminiSSE(line: string): string | null {
  if (!line.startsWith("data: ")) return null;
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") return "data: [DONE]\n\n";

  const json = tryParse(payload);
  if (!json) return null;

  const choices = (json as Record<string, unknown>).choices as Array<Record<string, unknown>> | undefined;
  if (!choices || choices.length === 0) return null;

  const choice = choices[0];
  const delta = choice.delta as Record<string, unknown> | undefined;
  const content = (delta?.content as string) ?? "";
  const finishReason = choice.finish_reason as string | undefined;
  const usage = (json as Record<string, unknown>).usage as Record<string, unknown> | undefined;

  const model = (json as Record<string, unknown>).model as string | undefined;
  const candidates: Array<Record<string, unknown>> = [{
    content: { parts: content ? [{ text: content }] : [], role: "model" },
  }];
  if (finishReason) {
    candidates[0].finishReason = finishReason === "stop" ? "STOP" : finishReason.toUpperCase();
  }

  const out: Record<string, unknown> = { candidates };
  if (model) out.model = model;
  if (usage) {
    out.usageMetadata = {
      promptTokenCount: usage.prompt_tokens,
      candidatesTokenCount: usage.completion_tokens,
    };
  }

  return `data: ${JSON.stringify(out)}\n\n`;
}

// ---------- OpenAI → Anthropic SSE ----------

function openaiToAnthropicSSE(line: string, state: { started: boolean; contentBlockStarted: boolean; done: boolean }): string[] {
  const results: string[] = [];

  if (!line.startsWith("data: ")) return results;
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") {
    if (state.done) return results;
    if (state.contentBlockStarted) {
      results.push(`data: ${JSON.stringify({ type: "content_block_stop" })}\n\n`);
    }
    results.push(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`);
    state.done = true;
    return results;
  }

  const json = tryParse(payload);
  if (!json) return results;

  const choices = (json as Record<string, unknown>).choices as Array<Record<string, unknown>> | undefined;
  if (!choices || choices.length === 0) return results;

  const choice = choices[0];
  const delta = choice.delta as Record<string, unknown> | undefined;
  const content = (delta?.content as string) ?? "";
  const role = delta?.role as string | undefined;
  const finishReason = choice.finish_reason as string | undefined;
  const usage = (json as Record<string, unknown>).usage as Record<string, unknown> | undefined;
  const model = (json as Record<string, unknown>).model as string | undefined;

  if (role === "assistant" && !state.started) {
    state.started = true;
    results.push(`data: ${JSON.stringify({
      type: "message_start",
      message: {
        id: `msg_${Date.now()}`,
        type: "message",
        role: "assistant",
        content: [],
        model: model ?? "",
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    })}\n\n`);
  }

  if (!state.contentBlockStarted) {
    state.contentBlockStarted = true;
    results.push(`data: ${JSON.stringify({ type: "content_block_start", content_block: { type: "text", text: "" } })}\n\n`);
  }

  if (content) {
    results.push(`data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: content } })}\n\n`);
  }

  if (finishReason) {
    state.done = true;
    results.push(`data: ${JSON.stringify({ type: "content_block_stop" })}\n\n`);
    const anthropicUsage = usage
      ? { input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens }
      : undefined;
    results.push(`data: ${JSON.stringify({
      type: "message_delta",
      delta: { stop_reason: finishReason === "stop" ? "end_turn" : finishReason, stop_sequence: null },
      usage: anthropicUsage,
    })}\n\n`);
    results.push(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`);
  }

  return results;
}

// ---------- Gemini → Anthropic SSE ----------

interface GeminiToAnthropicState {
  started: boolean;
  prevParts: { type: string; text?: string; name?: string; id?: string }[];
  done: boolean;
}

function geminiToAnthropicSSE(line: string, state: GeminiToAnthropicState): string[] {
  const results: string[] = [];

  if (!line.startsWith("data: ")) return results;
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") {
    if (state.done) return results;
    if (state.prevParts.length > 0) {
      for (let i = 0; i < state.prevParts.length; i++) {
        results.push(`data: ${JSON.stringify({ type: "content_block_stop", index: i })}\n\n`);
      }
    }
    results.push(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`);
    state.done = true;
    return results;
  }

  const json = tryParse(payload);
  if (!json) return results;

  const candidates = (json as Record<string, unknown>).candidates as Array<Record<string, unknown>> | undefined;
  if (!candidates || candidates.length === 0) return results;
  const c = candidates[0];
  const content = c.content as Record<string, unknown> | undefined;
  const parts = (content?.parts as Array<Record<string, unknown>>) ?? [];
  const finishReason = c.finishReason as string | undefined;
  const usageMeta = (json as Record<string, unknown>).usageMetadata as Record<string, unknown> | undefined;

  if (!state.started) {
    state.started = true;
    results.push(`data: ${JSON.stringify({
      type: "message_start",
      message: {
        id: `msg_${Date.now()}`,
        type: "message",
        role: "assistant",
        content: [],
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    })}\n\n`);
  }

  // Build current parts snapshot
  const currParts: { type: string; text?: string; name?: string; id?: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.text != null) {
      currParts.push({ type: "text", text: p.text as string });
    } else if (p.functionCall) {
      const fc = p.functionCall as Record<string, unknown>;
      currParts.push({
        type: "tool_use",
        name: fc.name as string,
        id: `tu_${i}_${Date.now()}`,
      });
    }
  }

  // Emit content_block_start for new blocks and deltas for changed text
  let bi = 0;
  for (let i = 0; i < currParts.length; i++) {
    const curr = currParts[i];
    const prev = i < state.prevParts.length ? state.prevParts[i] : null;

    if (!prev || prev.type !== curr.type) {
      // New block or type changed
      if (prev && i < state.prevParts.length) {
        results.push(`data: ${JSON.stringify({ type: "content_block_stop", index: bi })}\n\n`);
      }
      if (curr.type === "text") {
        results.push(`data: ${JSON.stringify({
          type: "content_block_start", index: bi,
          content_block: { type: "text", text: "" },
        })}\n\n`);
      } else if (curr.type === "tool_use") {
        results.push(`data: ${JSON.stringify({
          type: "content_block_start", index: bi,
          content_block: { type: "tool_use", id: curr.id, name: curr.name, input: {} },
        })}\n\n`);
      }
    }

    if (curr.type === "text" && (!prev || curr.text !== prev.text)) {
      const prevText = prev?.text ?? "";
      const delta = curr.text!.startsWith(prevText) ? curr.text!.slice(prevText.length) : curr.text!;
      if (delta) {
        results.push(`data: ${JSON.stringify({
          type: "content_block_delta", index: bi,
          delta: { type: "text_delta", text: delta },
        })}\n\n`);
      }
    }

    bi++;
  }

  // Emit content_block_stop for removed blocks
  if (currParts.length < state.prevParts.length) {
    for (let i = currParts.length; i < state.prevParts.length; i++) {
      results.push(`data: ${JSON.stringify({ type: "content_block_stop", index: bi })}\n\n`);
    }
  }

  state.prevParts = currParts;

  if (finishReason) {
    state.done = true;
    for (let i = 0; i < currParts.length; i++) {
      results.push(`data: ${JSON.stringify({ type: "content_block_stop", index: i })}\n\n`);
    }
    const anthropicUsage = usageMeta
      ? { input_tokens: usageMeta.promptTokenCount, output_tokens: usageMeta.candidatesTokenCount }
      : undefined;
    results.push(`data: ${JSON.stringify({
      type: "message_delta",
      delta: {
        stop_reason: finishReason === "STOP" ? "end_turn" : finishReason.toLowerCase(),
        stop_sequence: null,
      },
      usage: anthropicUsage,
    })}\n\n`);
    results.push(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`);
  }

  return results;
}

export function createGeminiToAnthropicTransformer(): (line: string) => string[] {
  const state: GeminiToAnthropicState = { started: false, prevParts: [], done: false };
  return (line: string) => geminiToAnthropicSSE(line, state);
}

// ---------- Anthropic → Gemini SSE ----------

interface AnthropicToGeminiState {
  messageId: string;
  model: string;
  parts: ({ text?: string; functionCall?: { name: string; args: unknown } } | undefined)[];
  currentBlock: { type: string; index: number; text?: string; toolName?: string; toolId?: string; input?: string } | null;
  done: boolean;
}

function anthropicToGeminiSSE(line: string, state: AnthropicToGeminiState): string[] {
  const results: string[] = [];

  if (!line.startsWith("data: ")) return results;
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") {
    if (state.done) return results;
    state.done = true;
    return results;
  }

  const json = tryParse(payload);
  if (!json) return results;

  const ev = json as Record<string, unknown>;
  const type = ev.type as string;

  if (type === "message_start") {
    const msg = ev.message as Record<string, unknown> | undefined;
    state.messageId = (msg?.id as string) ?? "";
    state.model = (msg?.model as string) ?? "";
    state.parts = [];
    state.currentBlock = null;
    return results;
  }

  if (type === "content_block_start") {
    const block = ev.content_block as Record<string, unknown> | undefined;
    const index = ev.index as number ?? 0;
    if (block?.type === "text") {
      state.currentBlock = { type: "text", index, text: "" };
    } else if (block?.type === "tool_use") {
      state.currentBlock = {
        type: "tool_use", index,
        toolName: block.name as string,
        toolId: block.id as string,
        input: JSON.stringify(block.input ?? ""),
      };
    }
    return results;
  }

  if (type === "content_block_delta") {
    const delta = ev.delta as Record<string, unknown> | undefined;
    const index = ev.index as number ?? 0;
    if (delta?.type === "text_delta") {
      if (state.currentBlock && state.currentBlock.index === index && state.currentBlock.type === "text") {
        state.currentBlock.text = (state.currentBlock.text ?? "") + (delta.text as string ?? "");
      }
    } else if (delta?.type === "input_json_delta") {
      if (state.currentBlock && state.currentBlock.index === index && state.currentBlock.type === "tool_use") {
        state.currentBlock.input = (state.currentBlock.input ?? "") + (delta.partial_json as string ?? "");
      }
    }
    return results;
  }

  if (type === "content_block_stop") {
    const index = ev.index as number ?? 0;
    if (state.currentBlock && state.currentBlock.index === index) {
      if (state.currentBlock.type === "text" && state.currentBlock.text != null) {
        state.parts[index] = { text: state.currentBlock.text };
      } else if (state.currentBlock.type === "tool_use" && state.currentBlock.toolName) {
        let parsedInput: unknown = {};
        try { parsedInput = JSON.parse(state.currentBlock.input ?? "{}"); } catch { parsedInput = state.currentBlock.input; }
        state.parts[index] = {
          functionCall: { name: state.currentBlock.toolName, args: parsedInput },
        };
      }
    }
    state.currentBlock = null;
    return results;
  }

  if (type === "message_delta") {
    const delta = ev.delta as Record<string, unknown> | undefined;
    const usage = ev.usage as Record<string, unknown> | undefined;
    const stopReason = delta?.stop_reason as string | undefined;

    const parts: Record<string, unknown>[] = [];
    for (const p of state.parts) {
      if (p) parts.push(p);
    }

    const candidates: Array<Record<string, unknown>> = [{
      content: { parts, role: "model" },
    }];
    if (stopReason) {
      const fr = stopReason === "end_turn" ? "STOP" : stopReason.toUpperCase();
      candidates[0].finishReason = fr;
    }

    const out: Record<string, unknown> = { candidates, model: state.model };
    if (usage) {
      out.usageMetadata = {
        promptTokenCount: usage.input_tokens,
        candidatesTokenCount: usage.output_tokens,
      };
    }

    results.push(`data: ${JSON.stringify(out)}\n\n`);

    if (candidates[0].finishReason) {
      state.done = true;
    }
    return results;
  }

  if (type === "message_stop") {
    if (!state.done) {
      const parts: Record<string, unknown>[] = [];
      for (const p of state.parts) {
        if (p) parts.push(p);
      }
      if (parts.length > 0) {
        results.push(`data: ${JSON.stringify({
          candidates: [{ content: { parts, role: "model" }, finishReason: "STOP" }],
          model: state.model,
        })}\n\n`);
      }
    }
    results.push("data: [DONE]\n\n");
    state.done = true;
    return results;
  }

  return results;
}

export function createAnthropicToGeminiTransformer(): (line: string) => string[] {
  const state: AnthropicToGeminiState = {
    messageId: "", model: "",
    parts: [],
    currentBlock: null, done: false,
  };
  return (line: string) => anthropicToGeminiSSE(line, state);
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
  if (from === "gemini" && to === "openai") return geminiToOpenaiReq(body);
  if (from === "anthropic" && to === "openai") return anthropicToOpenaiReq(body);
  // Cross compose for gemini ↔ anthropic
  if (from === "gemini" && to === "anthropic") return openaiToAnthropicReq(geminiToOpenaiReq(body));
  if (from === "anthropic" && to === "gemini") return openaiToGeminiReq(anthropicToOpenaiReq(body));
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
  if (from === "openai" && to === "gemini") return openaiToGeminiRes(body);
  if (from === "openai" && to === "anthropic") return openaiToAnthropicRes(body);
  // Cross compose for gemini ↔ anthropic
  if (from === "gemini" && to === "anthropic") return openaiToAnthropicRes(geminiToOpenaiRes(body));
  if (from === "anthropic" && to === "gemini") return openaiToGeminiRes(anthropicToOpenaiRes(body));
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

/**
 * Translate a stream chunk where the result may be multiple lines (e.g. SSE → Anthropic).
 * Returns an array of lines to emit, or null if no output.
 */
export function translateStreamChunks(
  line: string,
  from: Shape,
  to: Shape,
): string[] | null {
  if (from === to) return null;
  if (from === "gemini" && to === "openai") {
    const r = geminiToOpenaiSSE(line);
    return r ? [r] : null;
  }
  if (from === "anthropic" && to === "openai") {
    const r = anthropicToOpenaiSSE(line);
    return r ? [r] : null;
  }
  if (from === "openai" && to === "gemini") {
    const r = openaiToGeminiSSE(line);
    return r ? [r] : null;
  }
  // openai → anthropic requires stateful transformer; use createOpenaiToAnthropicTransformer()
  return null;
}

/**
 * Create a stateful stream transformer for OpenAI → Anthropic SSE.
 * Returns a function that takes a line and returns translated lines.
 * State is tracked across calls via closure.
 */
export function createOpenaiToAnthropicTransformer(): (line: string) => string[] {
  const state = { started: false, contentBlockStarted: false, done: false };
  return (line: string) => openaiToAnthropicSSE(line, state);
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
