import { useState } from 'react';
import { 
  Download, CheckCircle2, Info, 
  Search, ExternalLink, Cpu, HardDrive, Zap, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OfflineModel {
  id: string;
  name: string;
  description: string;
  size: string;
  provider: string;
}

const RECOMMENDED_MODELS: OfflineModel[] = [
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

interface OfflineModelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentModelId: string;
  onSelectModel: (id: string) => void;
  downloadProgress: number;
  downloadStatus: string;
  isDownloading: boolean;
  onDownload: (id: string) => void;
}

export function OfflineModelManager({
  isOpen,
  onClose,
  currentModelId,
  onSelectModel,
  downloadProgress,
  downloadStatus,
  isDownloading,
  onDownload
}: OfflineModelManagerProps) {
  const [customModelId, setCustomModelId] = useState('');
  const [selectedQuant, setSelectedQuant] = useState('q4f16');

  const baseId = currentModelId.includes('@') ? currentModelId.split('@')[0] : currentModelId;

  const handleDownload = (id: string) => {
    onDownload(`${id}@${selectedQuant}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-500" />
            Local LLM Manager
          </DialogTitle>
          <DialogDescription>
            Download and manage language models that run entirely in your browser.
            Models are downloaded once (~500MB to 2.5GB) and then cached for offline use.
            Ensure you have a stable internet connection for the initial download.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Active Download Progress */}
          {isDownloading && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-emerald-400 flex items-center gap-2">
                  <Zap className="w-4 h-4 animate-pulse" />
                  Downloading Model...
                </span>
                <span className="text-emerald-500/70">{Math.round(downloadProgress * 100)}%</span>
              </div>
              <Progress value={downloadProgress * 100} className="h-2 bg-emerald-500/20" />
              <p className="text-xs text-emerald-500/60 truncate">{downloadStatus}</p>
            </div>
          )}

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantization</label>
              <Select value={selectedQuant} onValueChange={setSelectedQuant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="q4f16">Q4 (Smallest, Fastest)</SelectItem>
                  <SelectItem value="q8f16">Q8 (Medium Quality)</SelectItem>
                  <SelectItem value="fp16">FP16 (Highest Quality, Large)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground italic">Lower quantization uses less RAM but may be less accurate.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Storage Info</label>
              <div className="h-10 px-3 rounded-md border border-input bg-background flex items-center gap-2 text-sm text-muted-foreground">
                <HardDrive className="w-4 h-4" />
                <span>Models are saved in browser cache</span>
              </div>
            </div>
          </div>

          {/* Recommended Models */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Recommended Models
            </h3>
            <div className="grid gap-3">
              {RECOMMENDED_MODELS.map((model) => (
                <div 
                  key={model.id}
                  className={cn(
                    "group p-3 rounded-lg border transition-all hover:border-primary/50",
                    baseId === model.id ? "bg-primary/5 border-primary/40" : "bg-card border-border"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        {model.name}
                        {baseId === model.id && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{model.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{model.size}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">by {model.provider}</span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={baseId === model.id ? "secondary" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => onSelectModel(`${model.id}@${selectedQuant}`)}
                      >
                        {baseId === model.id ? 'Active' : 'Select'}
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        disabled={isDownloading}
                        onClick={() => handleDownload(model.id)}
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Model */}
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-500" />
              Custom HuggingFace Model
            </h3>
            <div className="flex gap-2">
              <Input 
                placeholder="e.g. onnx-community/gemma-4-E2B-it-ONNX" 
                value={customModelId}
                onChange={(e) => setCustomModelId(e.target.value)}
                className="text-sm"
              />
              <Button 
                variant="outline" 
                className="gap-2"
                disabled={!customModelId || isDownloading}
                onClick={() => handleDownload(customModelId)}
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Must be a transformers.js compatible model on HuggingFace.
              <a href="https://huggingface.co/models?other=transformers.js" target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5 ml-1">
                Browse compatible models <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
