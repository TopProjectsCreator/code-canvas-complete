import { useState, useMemo } from 'react';
import { Search, X, Volume2 } from 'lucide-react';
import {
  type ScratchLibraryAsset,
  costumeLibrary,
  backdropLibrary,
  soundLibrary,
  assetUrl,
  getUniqueTags,
} from '@/data/scratchLibrary';

export type LibraryMode = 'costumes' | 'backdrops' | 'sounds';

interface ScratchLibraryDialogProps {
  mode: LibraryMode;
  open: boolean;
  onClose: () => void;
  onSelect: (asset: ScratchLibraryAsset) => void;
}

const modeConfig: Record<LibraryMode, { title: string; library: ScratchLibraryAsset[]; accent: string }> = {
  costumes: { title: 'Choose a Costume', library: costumeLibrary, accent: '#855cd6' },
  backdrops: { title: 'Choose a Backdrop', library: backdropLibrary, accent: '#4c97ff' },
  sounds: { title: 'Choose a Sound', library: soundLibrary, accent: '#cf63cf' },
};

export function ScratchLibraryDialog({ mode, open, onClose, onSelect }: ScratchLibraryDialogProps) {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { title, library, accent } = modeConfig[mode];

  const tags = useMemo(() => getUniqueTags(library), [library]);

  const filtered = useMemo(() => {
    let items = library;
    if (activeTag) items = items.filter((a) => a.tags.includes(activeTag));
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (a) => a.name.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q)),
      );
    }
    return items;
  }, [library, activeTag, search]);

  const playSound = (asset: ScratchLibraryAsset) => {
    if (playingId === asset.assetId) {
      setPlayingId(null);
      return;
    }
    setPlayingId(asset.assetId);
    const audio = new Audio(assetUrl(asset.md5ext));
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative flex flex-col w-[680px] max-w-[95vw] h-[520px] max-h-[85vh] rounded-xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ background: accent }}>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Search + tags */}
        <div className="px-4 py-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ '--tw-ring-color': accent } as React.CSSProperties}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveTag(null)}
              className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: activeTag === null ? accent : '#e9eef2',
                color: activeTag === null ? '#fff' : '#575e75',
              }}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium capitalize transition-colors"
                style={{
                  background: activeTag === tag ? accent : '#e9eef2',
                  color: activeTag === tag ? '#fff' : '#575e75',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-400 mt-10 text-sm">No results found</div>
          ) : mode === 'sounds' ? (
            <div className="space-y-1">
              {filtered.map((asset) => (
                <div
                  key={asset.md5ext}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors group"
                  onClick={() => onSelect(asset)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); playSound(asset); }}
                    className="flex-none w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: playingId === asset.assetId ? accent : '#e9eef2' }}
                  >
                    <Volume2 className="w-4 h-4" style={{ color: playingId === asset.assetId ? '#fff' : '#575e75' }} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">{asset.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {asset.sampleCount && asset.rate
                      ? `${(asset.sampleCount / asset.rate).toFixed(1)}s`
                      : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {filtered.map((asset) => (
                <button
                  key={asset.md5ext}
                  onClick={() => onSelect(asset)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border-2 border-transparent hover:border-current transition-colors group"
                  style={{ color: accent }}
                >
                  <div className="w-full aspect-square rounded-md bg-gray-50 overflow-hidden flex items-center justify-center">
                    <img
                      src={assetUrl(asset.md5ext)}
                      alt={asset.name}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 truncate w-full text-center leading-tight">{asset.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
