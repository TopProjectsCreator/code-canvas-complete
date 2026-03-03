import { useState } from 'react';
import { arduinoLibraries } from '@/data/arduinoTemplates';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LibraryManagerProps {
  selectedLibraries: string[];
  onLibrariesChange: (libraries: string[]) => void;
}

export function LibraryManager({ selectedLibraries, onLibrariesChange }: LibraryManagerProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleLibrary = (libId: string) => {
    if (selectedLibraries.includes(libId)) {
      onLibrariesChange(selectedLibraries.filter((l) => l !== libId));
    } else {
      onLibrariesChange([...selectedLibraries, libId]);
    }
  };

  const getLibraryIncludes = (): string => {
    return selectedLibraries
      .map((libId) => arduinoLibraries[libId]?.include || '')
      .filter(Boolean)
      .join('\n');
  };

  return (
    <Card className="p-4 bg-slate-900 border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full font-semibold text-white hover:text-gray-200"
      >
        <span>Libraries ({selectedLibraries.length})</span>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {Object.entries(arduinoLibraries).map(([id, lib]) => (
            <div key={id} className="flex items-start gap-3">
              <Checkbox
                id={id}
                checked={selectedLibraries.includes(id)}
                onCheckedChange={() => toggleLibrary(id)}
              />
              <label htmlFor={id} className="flex-1 cursor-pointer">
                <div className="font-medium text-white">{lib.name}</div>
                <div className="text-xs text-gray-400">{lib.description}</div>
              </label>
            </div>
          ))}

          {selectedLibraries.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="text-sm text-gray-300 mb-2">Include statements:</div>
              <pre className="bg-slate-950 p-2 rounded text-xs text-gray-300 overflow-auto">
                {getLibraryIncludes()}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
