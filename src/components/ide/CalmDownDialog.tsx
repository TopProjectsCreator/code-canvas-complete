import { useEffect, useState } from 'react';
import { Heart, Wind, Lightbulb, RefreshCcw, Coffee } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CalmDownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPS = [
  {
    icon: <Wind className="h-4 w-4" />,
    title: 'Try the 4-7-8 breath',
    body: 'Inhale 4s · hold 7s · exhale 8s. Repeat 3 times. Slows your heart rate fast.',
  },
  {
    icon: <RefreshCcw className="h-4 w-4" />,
    title: 'Reset the conversation',
    body: 'If the AI keeps missing the mark, clear the chat and restate the goal in one sentence with the exact file and behavior you want.',
  },
  {
    icon: <Lightbulb className="h-4 w-4" />,
    title: 'Be ultra-specific',
    body: 'Paste the exact error, the file path, and what you expected vs. what happened. Vague prompts get vague fixes.',
  },
  {
    icon: <Coffee className="h-4 w-4" />,
    title: 'Take a 2-minute break',
    body: 'Stand up, look at something 20 feet away, sip water. You\'ll spot the bug faster with fresh eyes.',
  },
];

const BREATH_CYCLE = [
  { label: 'Breathe in…', seconds: 4, scale: 'scale-110' },
  { label: 'Hold…', seconds: 7, scale: 'scale-110' },
  { label: 'Breathe out…', seconds: 8, scale: 'scale-90' },
];

export function CalmDownDialog({ open, onOpenChange }: CalmDownDialogProps) {
  const [phase, setPhase] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(BREATH_CYCLE[0].seconds);

  useEffect(() => {
    if (!open) {
      setPhase(0);
      setSecondsLeft(BREATH_CYCLE[0].seconds);
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setPhase(p => {
            const next = (p + 1) % BREATH_CYCLE.length;
            setSecondsLeft(BREATH_CYCLE[next].seconds);
            return next;
          });
          return BREATH_CYCLE[(phase + 1) % BREATH_CYCLE.length].seconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [open, phase]);

  const current = BREATH_CYCLE[phase];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Hey — let's take a breath
          </DialogTitle>
          <DialogDescription>
            It looks like things are getting frustrating. That's totally normal when debugging. Let's reset together.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-4">
          <div
            className={cn(
              'h-24 w-24 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border border-primary/30 transition-transform ease-in-out flex items-center justify-center',
              current.scale,
            )}
            style={{ transitionDuration: `${current.seconds}s` }}
          >
            <span className="text-2xl font-semibold text-foreground">{secondsLeft}</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{current.label}</p>
        </div>

        <div className="space-y-2">
          {TIPS.map(tip => (
            <div key={tip.title} className="flex gap-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="mt-0.5 text-primary">{tip.icon}</div>
              <div>
                <p className="text-sm font-medium text-foreground">{tip.title}</p>
                <p className="text-xs text-muted-foreground">{tip.body}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            I'm good, keep going
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
