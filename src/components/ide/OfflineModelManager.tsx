import { useState } from 'react';
import {
  Download, CheckCircle2, Info,
  Search, ExternalLink, Cpu, HardDrive, Zap, Sparkles,
  Image as ImageIcon, Mic, Video, Trash2, FolderDown,
  MonitorSmartphone, ShieldCheck,
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
import { RECOMMENDED_MODELS, type OfflineModel } from './offlineModelCatalog';
import { checkGgufDeviceCap, type GgufDeviceVerdict } from '@/services/ggufLLM';

export interface OfflineDownloadState {
  model: string;
  status: string;
  progress: number;
}

interface OfflineModelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentModelId: string;
  onSelectModel: (id: string) => void;
  downloadedModels: string[];
  onDownload: (id: string) => void;
  onDeleteModel: (id: string) => void;
  downloadStates: Record<string, OfflineDownloadState>;
}

const prettyModelName = (id: string) => {
  const base = id.split('@')[0].split('/').pop() || id;
  return base.replace(/-ONNX$/i, '').replace(/-/g, ' ');
};

const ModalityBadges = ({ modalities }: { modalities: OfflineModel['modalities'] }) => (
  <span className="flex gap-1">
    {modalities.includes('image') && <ImageIcon className="w-3 h-3 text-sky-400" />}
    {modalities.includes('audio') && <Mic className="w-3 h-3 text-fuchsia-400" />}
    {modalities.includes('video') && <Video className="w-3 h-3 text-orange-400" />}
  </span>
);

export function OfflineModelManager({
  isOpen,
  onClose,
  currentModelId,
  onSelectModel,
  downloadedModels,
  onDownload,
  onDeleteModel,
  downloadStates,
}: OfflineModelManagerProps) {
  const [customModelId, setCustomModelId] = useState('');
  const [selectedQuant, setSelectedQuant] = useState('q4f16');
  const [deviceVerdict, setDeviceVerdict] = useState<GgufDeviceVerdict | null>(null);
  const [checkingDevice, setCheckingDevice] = useState(false);

  const baseId = currentModelId.includes('@') ? currentModelId.split('@')[0] : currentModelId;

  /** GGUF releases are single-file official builds — no quantization suffix. */
  const modelIdFor = (model: OfflineModel) =>
    model.runtime === 'gguf' ? model.id : `${model.id}@${selectedQuant}`;

  const handleDownload = (id: string) => {
    const runtime = RECOMMENDED_MODELS.find(m => m.id === id)?.runtime;
    onDownload(runtime === 'gguf' ? id : `${id}@${selectedQuant}`);
  };

  const runDeviceCheck = async () => {
    setCheckingDevice(true);
    try {
      setDeviceVerdict(await checkGgufDeviceCap());
    } finally {
      setCheckingDevice(false);
    }
  };

  const otherDownloaded = downloadedModels.filter(
    id => !RECOMMENDED_MODELS.some(m => id.startsWith(m.id))
  );

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
            Small models download once (~200MB to 3.5GB) and the large GGUF reasoning
            models (~5GB, official releases) download once, then all run offline from
            browser cache — you can download several at the same time. Ensure you have
            a stable internet connection (Wi-Fi recommended) for the initial download.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
              {RECOMMENDED_MODELS.map((model) => {
                const modelId = modelIdFor(model);
                const isDownloaded = downloadedModels.includes(modelId);
                const dlState = downloadStates[modelId];
                const isModelDownloading = !!dlState;
                const isActive = baseId === model.id && (currentModelId === modelId || (model.runtime === 'gguf' && baseId === model.id));
                const isGguf = model.runtime === 'gguf';
                return (
                  <div
                    key={model.id}
                    className={cn(
                      "group p-3 rounded-lg border transition-all hover:border-primary/50",
                      isActive ? "bg-primary/5 border-primary/40" : "bg-card border-border"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          {model.name}
                          <ModalityBadges modalities={model.modalities} />
                          {isGguf && (
                            <span className="text-[9px] font-mono bg-violet-500/15 text-violet-300 px-1.5 py-0.5 rounded" title="Official GGUF release, runs via the llama.cpp browser runtime">
                              GGUF
                            </span>
                          )}
                          {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{model.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{model.size}</span>
                      </div>
                    </div>

                    {isModelDownloading ? (
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-amber-400 flex items-center gap-1 font-medium uppercase tracking-tight">
                            <Zap className="w-3 h-3 animate-pulse" />
                            {dlState.status}
                          </span>
                          <span className="text-emerald-500/70">{Math.round(dlState.progress * 100)}%</span>
                        </div>
                        <Progress value={dlState.progress * 100} className="h-1.5 bg-emerald-500/20" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-3">
                        <span className={cn(
                          "text-[10px] font-medium uppercase tracking-tight",
                          isDownloaded ? "text-emerald-400" : "text-muted-foreground"
                        )}>
                          {isDownloaded ? "Downloaded" : "Not downloaded"}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={isActive ? "secondary" : "outline"}
                            className="h-7 text-xs"
                            disabled={!isDownloaded}
                            onClick={() => onSelectModel(modelId)}
                          >
                            {isActive ? 'Active' : 'Select'}
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                            disabled={isDownloaded}
                            onClick={() => handleDownload(model.id)}
                          >
                            {isDownloaded ? <CheckCircle2 className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                            {isDownloaded ? 'Downloaded' : 'Download'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Device readiness for the large GGUF models */}
          <div className="p-3 rounded-lg border border-border bg-card space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4 text-sky-400" />
              Large-model device check
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Maple Preview 20B and Ling 3.0 Tiny are ~5GB official releases. They need a
              WebGPU-capable browser and 8GB+ memory (12GB recommended). Phones and tablets
              are often killed mid-load — check first, or load anyway at your own risk.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={runDeviceCheck} disabled={checkingDevice}>
                <ShieldCheck className="w-3 h-3" />
                {checkingDevice ? 'Checking…' : 'Check my device'}
              </Button>
              {deviceVerdict && (
                <span className={cn(
                  "text-[10px] font-medium uppercase tracking-tight",
                  deviceVerdict.tier === 'full' ? "text-emerald-400" : "text-amber-400"
                )}>
                  {deviceVerdict.tier === 'full' ? 'Ready' : 'Limited — load anyway allowed'}
                </span>
              )}
            </div>
            {deviceVerdict && deviceVerdict.warnings.length > 0 && (
              <ul className="text-[11px] text-amber-300/90 leading-relaxed list-disc pl-4 space-y-1">
                {deviceVerdict.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            {deviceVerdict && deviceVerdict.warnings.length === 0 && (
              <p className="text-[11px] text-emerald-400">WebGPU available with plenty of memory. Good to go.</p>
            )}
          </div>

          {/* Your Downloads */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FolderDown className="w-4 h-4 text-violet-400" />
              Your Downloads
            </h3>
            {otherDownloaded.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-1">
                Models you download that aren't in the list above — like older models or custom HuggingFace pulls — will appear here.
              </p>
            ) : (
              <div className="grid gap-2">
                {otherDownloaded.map((id) => {
                  const isActive = currentModelId === id || currentModelId.split('@')[0] === id.split('@')[0];
                  const isDeletingTarget = !!downloadStates[id];
                  return (
                    <div key={id} className={cn(
                      "flex items-center justify-between p-2.5 rounded-lg border",
                      isActive ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                    )}>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium capitalize truncate">{prettyModelName(id)}</h4>
                        <p className="text-[10px] text-muted-foreground truncate font-mono">{id}</p>
                      </div>
                      <div className="flex gap-2 shrink-0 ml-3">
                        <Button
                          size="sm"
                          variant={isActive ? "secondary" : "outline"}
                          className="h-7 text-xs"
                          disabled={isActive}
                          onClick={() => onSelectModel(id)}
                        >
                          {isActive ? 'Active' : 'Select'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-red-400 hover:text-red-300 hover:border-red-400/40"
                          disabled={isDeletingTarget}
                          onClick={() => onDeleteModel(id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                disabled={!customModelId || isDownloadingOffline(customModelId, downloadStates)}
                onClick={() => handleDownload(customModelId)}
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Must be a transformers.js compatible model on HuggingFace. Custom downloads also show up under Your Downloads.
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

const isDownloadingOffline = (
  id: string,
  states: Record<string, OfflineDownloadState>,
) => Object.keys(states).some(key => key.startsWith(id));

