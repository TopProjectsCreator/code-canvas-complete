export interface OfflineModel {
  id: string;
  name: string;
  description: string;
  size: string;
  provider: string;
}

export const RECOMMENDED_MODELS: OfflineModel[] = [
  {
    id: 'onnx-community/gemma-4-E2B-it-ONNX',
    name: 'Gemma 4 E2B',
    description: 'Google\'s latest Gemma 4 ONNX model. Optimized for WebGPU with exceptional instruction following.',
    size: '~800 MB',
    provider: 'Google'
  },
  {
    id: 'onnx-community/Llama-3.2-1B-Instruct',
    name: 'Llama 3.2 1B',
    description: 'Meta\'s compact Llama 3.2 model, great for fast local responses.',
    size: '~1.3 GB',
    provider: 'Meta'
  },
  {
    id: 'onnx-community/Phi-3-mini-4k-instruct',
    name: 'Phi-3 Mini',
    description: 'Microsoft\'s powerful 3.8B model, optimized for efficiency and high performance.',
    size: '~2.2 GB',
    provider: 'Microsoft'
  },
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    name: 'Qwen 2.5 0.5B',
    description: 'Alibaba\'s ultra-lightweight model. Very fast, suitable for basic tasks.',
    size: '~450 MB',
    provider: 'Alibaba'
  },
  {
    id: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
    name: 'TinyLlama 1.1B',
    description: 'A tiny but capable model for simple chat interactions.',
    size: '~650 MB',
    provider: 'Llama.cpp'
  }
];