export type OfflineModality = 'text' | 'image' | 'audio' | 'video';

/** Inference runtime: transformers.js pipeline (default) or llama.cpp GGUF via wllama. */
export type OfflineRuntime = 'transformers' | 'gguf';

export interface OfflineModel {
  id: string;
  name: string;
  description: string;
  size: string;
  provider: string;
  modalities: OfflineModality[];
  runtime?: OfflineRuntime;
}

export const isGgufCatalogModel = (m?: OfflineModel) => m?.runtime === 'gguf';

export const modelSupportsImage = (m?: OfflineModel) => !!m?.modalities.includes('image');
export const modelSupportsAudio = (m?: OfflineModel) => !!m?.modalities.includes('audio');
export const modelSupportsVideo = (m?: OfflineModel) => !!m?.modalities.includes('video');
/** Only models loaded through the multimodal (AutoProcessor) path can think. */
export const modelSupportsThinking = (m?: OfflineModel) =>
  !!m && (m.modalities.some(mod => mod !== 'text') || m.runtime === 'gguf');

export const RECOMMENDED_MODELS: OfflineModel[] = [
  {
    id: 'onnx-community/gemma-3-270m-it-ONNX',
    name: 'Gemma 3 270M',
    description: 'Google\'s ultra-lightweight Gemma 3. Loads almost instantly and handles basic chat and quick tasks.',
    size: '~0.6 GB',
    provider: 'Google',
    modalities: ['text'],
  },
  {
    id: 'onnx-community/gemma-4-E2B-it-ONNX',
    name: 'Gemma 4 E2B',
    description: 'Google\'s latest multimodal Gemma 4. Understands images, audio, and video frames with exceptional instruction following.',
    size: '~3.4 GB',
    provider: 'Google',
    modalities: ['text', 'image', 'audio', 'video'],
  },
  {
    id: 'onnx-community/Qwen3.5-0.8B-ONNX',
    name: 'Qwen 3.5 0.8B VL',
    description: 'Alibaba\'s compact vision-language model. Fast responses with image understanding. Default local model.',
    size: '~0.65 GB',
    provider: 'Alibaba',
    modalities: ['text', 'image'],
  },
  {
    id: 'onnx-community/Qwen3.5-2B-ONNX',
    name: 'Qwen 3.5 2B VL',
    description: 'Mid-size Qwen 3.5 with vision. A strong balance of quality and speed for local chat.',
    size: '~1.6 GB',
    provider: 'Alibaba',
    modalities: ['text', 'image'],
  },
  {
    id: 'onnx-community/Qwen3.5-4B-ONNX',
    name: 'Qwen 3.5 4B VL',
    description: 'The largest browser-ready Qwen 3.5. Highest quality local responses with vision support.',
    size: '~3.0 GB',
    provider: 'Alibaba',
    modalities: ['text', 'image'],
  },
  {
    id: 'deepgrove/maple-preview-GGUF',
    name: 'Maple Preview 20B',
    description: "DeepGrove's official 20B-A1B ternary reasoning GGUF. Extremely fast on capable desktop GPUs; needs 8GB+ memory and a Maple-capable runtime build.",
    size: '~5.0 GB',
    provider: 'DeepGrove',
    modalities: ['text'],
    runtime: 'gguf',
  },
  {
    id: 'inclusionAI/Ling-3.0-tiny-GGUF',
    name: 'Ling 3.0 Tiny',
    description: "InclusionAI's official 7.9B hybrid reasoning MoE GGUF (1.3B active). Strong agents + coding at low cost; needs 8GB+ memory.",
    size: '~4.8 GB',
    provider: 'InclusionAI',
    modalities: ['text'],
    runtime: 'gguf',
  },
];

export const DEFAULT_OFFLINE_MODEL_ID = 'onnx-community/Qwen3.5-0.8B-ONNX';

export const getOfflineModelById = (id: string): OfflineModel | undefined =>
  RECOMMENDED_MODELS.find(m => m.id === id);

// Tiny system prompt for local models. Keep it short - 270M/0.8B degrade with long prompts.
// Teaches the minimal tag protocol so tags like <ask_prompt> actually fire offline.
// Also teaches the indirection tag <search_for_tool="ask"> that you requested - model
// can emit that first, we will reply with the tool definition as "tool output".
export const OFFLINE_SYSTEM_PROMPT = `You are Canvas Agent (local) in CodeCanvas IDE. Use tags to act:

- Ask user: <ask_prompt type="text" question="What should the file be named?" />
  types: text, multiple_choice, yes_no, number, slider. For multiple_choice add options="A,B,C".
- Create file: <create_file name="path/to/file.ts">content</create_file>
- Search automations: <search_automation query="..." />

If unsure of tag syntax, first output <search_for_tool="ask"> and you will receive the tool definition.
Keep replies short.`;

export const OFFLINE_TOOL_DEFINITIONS: Record<string, string> = {
  ask: `Tool "ask": <ask_prompt type="text|multiple_choice|yes_no|number|slider|ranking|date|time|email" question="..." options="A,B" placeholder="..." min="0" max="10" step="1" /> Example: <ask_prompt type="text" question="What should the file be named?" />`,
};
