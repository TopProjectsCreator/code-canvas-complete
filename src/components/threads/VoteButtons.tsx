import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoteButtonsProps {
  score: number;
  userVote: number | null | undefined;
  onVote: (value: number) => void;
  size?: 'sm' | 'md';
}

export function VoteButtons({ score, userVote, onVote, size = 'md' }: VoteButtonsProps) {
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className={cn(btnSize, 'rounded-full', userVote === 1 && 'text-orange-500 bg-orange-500/10')}
        onClick={() => onVote(1)}
      >
        <ArrowUp className={cn(iconSize, userVote === 1 && 'fill-current')} />
      </Button>
      <span className={cn(
        'text-xs font-semibold tabular-nums leading-none',
        userVote === 1 && 'text-orange-500',
        userVote === -1 && 'text-blue-500',
        !userVote && 'text-muted-foreground',
      )}>
        {score}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className={cn(btnSize, 'rounded-full', userVote === -1 && 'text-blue-500 bg-blue-500/10')}
        onClick={() => onVote(-1)}
      >
        <ArrowDown className={cn(iconSize, userVote === -1 && 'fill-current')} />
      </Button>
    </div>
  );
}
