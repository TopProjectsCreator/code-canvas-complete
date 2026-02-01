import { useState, useEffect, useCallback } from 'react';
import { X, ChevronUp, ChevronDown, Replace, ReplaceAll } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FindReplaceProps {
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onReplace: (newContent: string) => void;
  onHighlightChange: (matches: { start: number; end: number }[], currentIndex: number) => void;
}

export const FindReplace = ({ 
  content, 
  isOpen, 
  onClose, 
  onReplace,
  onHighlightChange 
}: FindReplaceProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matches, setMatches] = useState<{ start: number; end: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const findMatches = useCallback(() => {
    if (!searchTerm) {
      setMatches([]);
      onHighlightChange([], -1);
      return;
    }

    try {
      let pattern: RegExp;
      
      if (useRegex) {
        pattern = new RegExp(searchTerm, caseSensitive ? 'g' : 'gi');
      } else {
        let escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (wholeWord) {
          escaped = `\\b${escaped}\\b`;
        }
        pattern = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
      }

      const foundMatches: { start: number; end: number }[] = [];
      let match;
      
      while ((match = pattern.exec(content)) !== null) {
        foundMatches.push({
          start: match.index,
          end: match.index + match[0].length
        });
        if (match[0].length === 0) break; // Prevent infinite loop for zero-length matches
      }

      setMatches(foundMatches);
      if (foundMatches.length > 0 && currentMatchIndex >= foundMatches.length) {
        setCurrentMatchIndex(0);
      }
      onHighlightChange(foundMatches, foundMatches.length > 0 ? currentMatchIndex : -1);
    } catch (e) {
      // Invalid regex, ignore
      setMatches([]);
      onHighlightChange([], -1);
    }
  }, [searchTerm, content, caseSensitive, useRegex, wholeWord, currentMatchIndex, onHighlightChange]);

  useEffect(() => {
    findMatches();
  }, [findMatches]);

  const goToNext = () => {
    if (matches.length === 0) return;
    const newIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(newIndex);
    onHighlightChange(matches, newIndex);
  };

  const goToPrevious = () => {
    if (matches.length === 0) return;
    const newIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(newIndex);
    onHighlightChange(matches, newIndex);
  };

  const replaceOne = () => {
    if (matches.length === 0) return;
    const match = matches[currentMatchIndex];
    const newContent = 
      content.substring(0, match.start) + 
      replaceTerm + 
      content.substring(match.end);
    onReplace(newContent);
  };

  const replaceAll = () => {
    if (matches.length === 0) return;
    
    let newContent = content;
    // Replace from end to start to preserve indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      newContent = 
        newContent.substring(0, match.start) + 
        replaceTerm + 
        newContent.substring(match.end);
    }
    onReplace(newContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevious();
      } else {
        goToNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-4 z-20 bg-background border border-border rounded-b-lg shadow-lg p-2 min-w-80">
      <div className="flex flex-col gap-2">
        {/* Search row */}
        <div className="flex items-center gap-1">
          <Input
            type="text"
            placeholder="Find"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 text-sm flex-1"
            autoFocus
          />
          <span className="text-xs text-muted-foreground min-w-12 text-center">
            {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : 'No results'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={goToPrevious}
            disabled={matches.length === 0}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={goToNext}
            disabled={matches.length === 0}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-1">
          <Button
            variant={caseSensitive ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setCaseSensitive(!caseSensitive)}
            title="Case Sensitive"
          >
            Aa
          </Button>
          <Button
            variant={wholeWord ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setWholeWord(!wholeWord)}
            title="Whole Word"
          >
            ab
          </Button>
          <Button
            variant={useRegex ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs font-mono"
            onClick={() => setUseRegex(!useRegex)}
            title="Use Regular Expression"
          >
            .*
          </Button>
          <Button
            variant={showReplace ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs ml-auto"
            onClick={() => setShowReplace(!showReplace)}
          >
            Replace
          </Button>
        </div>

        {/* Replace row */}
        {showReplace && (
          <div className="flex items-center gap-1">
            <Input
              type="text"
              placeholder="Replace"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-sm flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={replaceOne}
              disabled={matches.length === 0}
              title="Replace"
            >
              <Replace className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={replaceAll}
              disabled={matches.length === 0}
              title="Replace All"
            >
              <ReplaceAll className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
