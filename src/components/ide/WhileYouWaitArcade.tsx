import { useEffect, useMemo, useState } from 'react';
import {
  Gamepad2,
  Rocket,
  Trophy,
  Box,
  Swords,
  Zap,
  BrainCircuit,
  MoveHorizontal,
  Cuboid,
  Timer,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Dimension = '2D' | '3D';

interface ArcadeGame {
  id: string;
  name: string;
  dimension: Dimension;
  genre: string;
  vibe: string;
  players: string;
  status: 'Playable now';
}

const arcadeGames: ArcadeGame[] = [
  {
    id: 'tap-sprint',
    name: 'Tap Sprint+',
    dimension: '2D',
    genre: 'Reflex',
    vibe: 'Chain accurate taps to build combo multipliers',
    players: '1',
    status: 'Playable now',
  },
  {
    id: 'pair-pulse',
    name: 'Pair Pulse',
    dimension: '2D',
    genre: 'Memory Match',
    vibe: 'Find all matching pairs with fewer moves',
    players: '1',
    status: 'Playable now',
  },
  {
    id: 'code-sequence',
    name: 'Code Sequence',
    dimension: '2D',
    genre: 'Pattern Memory',
    vibe: 'Watch the pattern, then repeat without mistakes',
    players: '1',
    status: 'Playable now',
  },
  {
    id: 'orbit-escape',
    name: 'Orbit Escape 3D',
    dimension: '3D',
    genre: 'Depth Runner',
    vibe: 'Move lanes while obstacles rush toward the camera',
    players: '1',
    status: 'Playable now',
  },
  {
    id: 'depth-pulse',
    name: 'Depth Pulse 3D',
    dimension: '3D',
    genre: 'Timing',
    vibe: 'Fire only when a pulse crosses the 3D hit zone',
    players: '1',
    status: 'Playable now',
  },
];

function TapSprint() {
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [target, setTarget] = useState(() => Math.floor(Math.random() * 9));
  const [best, setBest] = useState(0);

  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      setRunning(false);
      setBest((prev) => Math.max(prev, score));
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((current) => current - 1);
    }, 1000);

    const targetTimer = setInterval(() => {
      setTarget(Math.floor(Math.random() * 9));
      setCombo((prev) => Math.max(0, prev - 1));
    }, 620);

    return () => {
      clearInterval(timer);
      clearInterval(targetTimer);
    };
  }, [running, timeLeft, score]);

  const startGame = () => {
    setScore(0);
    setCombo(0);
    setTimeLeft(20);
    setTarget(Math.floor(Math.random() * 9));
    setRunning(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span>Time: {timeLeft}s</span>
        <span>Score: {score}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Combo x{Math.max(1, combo)}</span>
        <span>Best: {best}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }, (_, index) => (
          <button
            key={index}
            disabled={!running}
            onClick={() => {
              if (!running) return;
              if (index === target) {
                const nextCombo = combo + 1;
                setCombo(nextCombo);
                setScore((prev) => prev + Math.max(1, nextCombo));
                setTarget(Math.floor(Math.random() * 9));
              } else {
                setCombo(0);
              }
            }}
            className={cn(
              'h-9 rounded-md border border-border transition-colors',
              running && index === target
                ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_16px_hsl(var(--primary)/0.55)]'
                : 'bg-background hover:bg-accent',
            )}
          >
            {running && index === target ? <Zap className="w-3 h-3 mx-auto" /> : null}
          </button>
        ))}
      </div>
      <button onClick={startGame} className="w-full rounded-md bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground">
        {running ? 'Restart round' : 'Start 20s round'}
      </button>
    </div>
  );
}

function shuffleCards() {
  const symbols = ['A', 'B', 'C', 'D', 'E', 'F'];
  const cards = [...symbols, ...symbols]
    .map((value) => ({ id: crypto.randomUUID(), value }))
    .sort(() => Math.random() - 0.5);
  return cards;
}

function PairPulse() {
  const [cards, setCards] = useState(shuffleCards);
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (matched.length === cards.length) return;
    const interval = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [cards.length, matched.length]);

  const reset = () => {
    setCards(shuffleCards());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setSeconds(0);
  };

  const onCardClick = (id: string) => {
    if (flipped.length === 2 || flipped.includes(id) || matched.includes(id)) return;

    const nextFlipped = [...flipped, id];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves((prev) => prev + 1);
      const [first, second] = nextFlipped.map((cardId) => cards.find((card) => card.id === cardId));
      if (first && second && first.value === second.value) {
        setMatched((prev) => [...prev, first.id, second.id]);
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 700);
      }
    }
  };

  const won = matched.length === cards.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span>Moves: {moves}</span>
        <span>{won ? 'Perfect memory!' : `${matched.length / 2}/6 pairs`}</span>
      </div>
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Timer className="h-3 w-3" /> {seconds}s elapsed
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {cards.map((card) => {
          const isOpen = flipped.includes(card.id) || matched.includes(card.id);
          return (
            <button
              key={card.id}
              onClick={() => onCardClick(card.id)}
              className={cn(
                'h-8 rounded-md border text-[11px] font-semibold transition-colors',
                isOpen ? 'bg-primary/20 border-primary text-foreground' : 'bg-background border-border hover:bg-accent',
              )}
            >
              {isOpen ? card.value : '?'}
            </button>
          );
        })}
      </div>
      <button onClick={reset} className="w-full rounded-md bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground">
        {won ? 'Play again' : 'Reset board'}
      </button>
    </div>
  );
}

function CodeSequence() {
  const padCount = 4;
  const [sequence, setSequence] = useState<number[]>([]);
  const [inputIndex, setInputIndex] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'showing' | 'playing' | 'failed'>('ready');
  const [litPad, setLitPad] = useState<number | null>(null);
  const [round, setRound] = useState(0);

  const start = () => {
    const first = Math.floor(Math.random() * padCount);
    setSequence([first]);
    setInputIndex(0);
    setRound(1);
    setPhase('showing');
  };

  useEffect(() => {
    if (phase !== 'showing' || sequence.length === 0) return;

    let current = 0;
    const interval = setInterval(() => {
      const step = sequence[current];
      setLitPad(step);
      setTimeout(() => setLitPad(null), 280);

      current += 1;
      if (current >= sequence.length) {
        clearInterval(interval);
        setTimeout(() => {
          setInputIndex(0);
          setPhase('playing');
        }, 360);
      }
    }, 520);

    return () => clearInterval(interval);
  }, [phase, sequence]);

  const onPadClick = (index: number) => {
    if (phase !== 'playing') return;

    if (sequence[inputIndex] !== index) {
      setPhase('failed');
      return;
    }

    const nextInput = inputIndex + 1;
    if (nextInput === sequence.length) {
      const nextStep = Math.floor(Math.random() * padCount);
      setSequence((prev) => [...prev, nextStep]);
      setRound((prev) => prev + 1);
      setPhase('showing');
      setInputIndex(0);
      return;
    }

    setInputIndex(nextInput);
  };

  const padColors = ['bg-emerald-500/70', 'bg-sky-500/70', 'bg-violet-500/70', 'bg-amber-500/70'];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span>Round: {round}</span>
        <span>{phase === 'failed' ? 'Sequence broken' : phase === 'playing' ? 'Your turn' : 'Watch pattern'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: padCount }, (_, index) => (
          <button
            key={index}
            onClick={() => onPadClick(index)}
            className={cn(
              'h-12 rounded-md border border-border transition-all',
              padColors[index],
              litPad === index ? 'scale-[1.03] brightness-125 shadow-[0_0_20px_rgba(99,102,241,0.55)]' : 'brightness-75',
            )}
          />
        ))}
      </div>
      <button onClick={start} className="w-full rounded-md bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground">
        {phase === 'ready' ? 'Start sequence' : 'Restart sequence'}
      </button>
    </div>
  );
}

function OrbitEscape3D() {
  const lanes = 5;
  const [running, setRunning] = useState(false);
  const [lane, setLane] = useState(2);
  const [obstacles, setObstacles] = useState<{ id: string; lane: number; z: number }[]>([]);
  const [score, setScore] = useState(0);
  const [crashed, setCrashed] = useState(false);
  const [best, setBest] = useState(0);
  const [speed, setSpeed] = useState(7.4);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setObstacles((current) => {
        const moved = current
          .map((obstacle) => ({ ...obstacle, z: obstacle.z + speed }))
          .filter((obstacle) => obstacle.z <= 110);

        if (Math.random() > 0.54) {
          moved.push({ id: crypto.randomUUID(), lane: Math.floor(Math.random() * lanes), z: 0 });
        }

        const hit = moved.some((obstacle) => obstacle.lane === lane && obstacle.z >= 95);
        if (hit) {
          setRunning(false);
          setCrashed(true);
          setBest((prev) => Math.max(prev, score));
        } else {
          const nearMiss = moved.some((obstacle) => obstacle.lane !== lane && obstacle.z >= 90 && obstacle.z <= 99);
          setScore((prev) => prev + (nearMiss ? 2 : 1));
          setSpeed((prev) => Math.min(12, prev + 0.02));
        }

        return moved;
      });
    }, 140);

    return () => clearInterval(interval);
  }, [lane, running, score, speed]);

  useEffect(() => {
    if (!running) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        setLane((current) => Math.max(0, current - 1));
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        setLane((current) => Math.min(lanes - 1, current + 1));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lanes, running]);

  const start = () => {
    setLane(2);
    setObstacles([]);
    setScore(0);
    setCrashed(false);
    setSpeed(7.4);
    setRunning(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span>Score: {score}</span>
        <span>{running ? 'Boosting' : crashed ? 'Collision' : 'Ready'}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Speed: {speed.toFixed(1)}x</span>
        <span>Best: {best}</span>
      </div>
      <div
        className="relative h-40 overflow-hidden rounded-md border border-border bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800"
        style={{ perspective: '460px' }}
      >
        <div
          className="absolute inset-4 rounded-md border border-primary/20"
          style={{ transform: 'rotateX(64deg) translateZ(-12px)', transformStyle: 'preserve-3d' }}
        />

        {Array.from({ length: lanes }).map((_, laneIndex) => (
          <div
            key={laneIndex}
            className="absolute left-1/2 top-0 h-full w-[1px] bg-primary/25"
            style={{
              transform: `translateX(${(laneIndex - 2) * 30}px) rotateX(62deg)`,
              transformOrigin: 'top',
            }}
          />
        ))}

        {obstacles.map((obstacle) => {
          const x = (obstacle.lane - 2) * 30;
          const y = 20 + obstacle.z * 1.15;
          const scale = 0.35 + obstacle.z / 140;
          return (
            <div
              key={obstacle.id}
              className="absolute left-1/2 top-0 h-5 w-5 rounded-sm bg-destructive/90 border border-destructive-foreground/60"
              style={{
                transform: `translateX(${x}px) translateY(${y}px) scale(${scale})`,
                boxShadow: '0 0 12px rgba(248,113,113,0.55)',
              }}
            />
          );
        })}

        <div
          className="absolute bottom-2 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border border-primary bg-primary shadow-[0_0_16px_hsl(var(--primary)/0.65)]"
          style={{ transform: `translateX(${(lane - 2) * 30}px)` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => setLane((current) => Math.max(0, current - 1))}
          disabled={!running}
          className="rounded-md border border-border py-1 text-[11px] disabled:opacity-40"
        >
          Left
        </button>
        <button onClick={start} className="rounded-md bg-primary py-1 text-[11px] font-medium text-primary-foreground">
          {running ? 'Restart' : 'Start'}
        </button>
        <button
          onClick={() => setLane((current) => Math.min(lanes - 1, current + 1))}
          disabled={!running}
          className="rounded-md border border-border py-1 text-[11px] disabled:opacity-40"
        >
          Right
        </button>
      </div>
    </div>
  );
}

function DepthPulse3D() {
  const [running, setRunning] = useState(false);
  const [depth, setDepth] = useState(0);
  const [velocity, setVelocity] = useState(4);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [windowCenter, setWindowCenter] = useState(50);
  const [message, setMessage] = useState('Line up the pulse and fire.');

  useEffect(() => {
    if (!running || lives <= 0) return;

    const interval = setInterval(() => {
      setDepth((prev) => {
        const next = prev + velocity;
        if (next >= 100 || next <= 0) {
          setVelocity((speed) => speed * -1);
        }
        return Math.min(100, Math.max(0, next));
      });
    }, 70);

    return () => clearInterval(interval);
  }, [lives, running, velocity]);

  useEffect(() => {
    if (!running || lives <= 0) return;
    const drift = setInterval(() => {
      setWindowCenter((prev) => {
        const variance = (Math.random() - 0.5) * 8;
        return Math.max(35, Math.min(65, prev + variance));
      });
    }, 900);
    return () => clearInterval(drift);
  }, [lives, running]);

  const start = () => {
    setRunning(true);
    setDepth(0);
    setVelocity(4);
    setScore(0);
    setLives(3);
    setCombo(0);
    setWindowCenter(50);
    setMessage('Line up the pulse and fire.');
  };

  const fire = () => {
    if (!running || lives <= 0) return;

    const lower = windowCenter - 7;
    const upper = windowCenter + 7;
    const hit = depth >= lower && depth <= upper;
    if (hit) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setScore((prev) => prev + Math.max(1, nextCombo));
      setMessage(nextCombo > 1 ? `Combo x${nextCombo}!` : 'Direct hit!');
      setVelocity((prev) => (prev > 0 ? prev + 0.55 : prev - 0.55));
    } else {
      const remaining = lives - 1;
      setLives(remaining);
      setCombo(0);
      setMessage(remaining <= 0 ? 'Out of lives. Relaunch!' : 'Missed window. Try again.');
      if (remaining <= 0) {
        setRunning(false);
      }
    }
  };

  const scale = 0.25 + depth / 120;
  const glow = 0.2 + depth / 130;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span>Hits: {score}</span>
        <span>Lives: {lives}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Combo: x{Math.max(1, combo)}</span>
        <span>Window: {Math.round(windowCenter)}%</span>
      </div>
      <div className="text-[10px] text-muted-foreground">{message}</div>
      <div className="relative h-36 rounded-md border border-border bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-700 overflow-hidden">
        <div
          className="absolute inset-x-6 h-6 -translate-y-1/2 rounded-md border border-emerald-400/70 bg-emerald-400/10 transition-all duration-300"
          style={{ top: `${windowCenter}%` }}
        />
        <div className="absolute inset-x-4 top-[25%] h-px bg-primary/25" />
        <div
          className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/90 bg-primary/80"
          style={{
            transform: `translate(-50%, -50%) scale(${scale})`,
            boxShadow: `0 0 30px rgba(99,102,241,${glow})`,
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={start} className="rounded-md bg-primary py-1 text-[11px] font-medium text-primary-foreground">
          {running ? 'Reset' : 'Launch'}
        </button>
        <button onClick={fire} disabled={!running} className="rounded-md border border-border py-1 text-[11px] disabled:opacity-40">
          Fire
        </button>
      </div>
    </div>
  );
}

export function WhileYouWaitArcade() {
  const [filter, setFilter] = useState<'All' | Dimension>('All');
  const [activeGameId, setActiveGameId] = useState(arcadeGames[0].id);

  const shownGames = useMemo(
    () => arcadeGames.filter((game) => filter === 'All' || game.dimension === filter),
    [filter],
  );

  useEffect(() => {
    if (!shownGames.some((game) => game.id === activeGameId) && shownGames.length > 0) {
      setActiveGameId(shownGames[0].id);
    }
  }, [activeGameId, shownGames]);

  const activeGame = arcadeGames.find((game) => game.id === activeGameId) ?? arcadeGames[0];

  return (
    <div className="mt-2 rounded-xl border border-primary/20 bg-gradient-to-b from-primary/10 via-background to-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <Gamepad2 className="w-3.5 h-3.5" />
            While you wait • AI Arcade
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Upgraded mini-arcade with true depth-based 3D games while AI builds your project.
          </p>
        </div>
        <div className="flex gap-1">
          {(['All', '2D', '3D'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] border transition-colors',
                filter === mode
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background/70 border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
        {shownGames.map((game) => (
          <button
            key={game.id}
            onClick={() => setActiveGameId(game.id)}
            className={cn(
              'rounded-lg border p-2.5 text-left transition-colors',
              activeGameId === game.id ? 'border-primary bg-primary/10' : 'border-border/70 bg-card/60 hover:bg-accent/50',
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-xs font-medium text-foreground">{game.name}</p>
              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{game.dimension}</span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><MoveHorizontal className="w-3 h-3" /> {game.genre}</span>
              <span className="flex items-center gap-1"><Swords className="w-3 h-3" /> {game.players}</span>
              <span className="flex items-center gap-1"><BrainCircuit className="w-3 h-3" /> {game.vibe}</span>
              <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> {game.status}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border/70 bg-card/50 p-2.5 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-foreground">Now playing: {activeGame.name}</span>
          <span className="text-muted-foreground flex items-center gap-1">
            {activeGame.dimension === '3D' ? <Cuboid className="h-3 w-3" /> : <Target className="h-3 w-3" />}
            {activeGame.genre}
          </span>
        </div>

        {activeGameId === 'tap-sprint' ? <TapSprint /> : null}
        {activeGameId === 'pair-pulse' ? <PairPulse /> : null}
        {activeGameId === 'code-sequence' ? <CodeSequence /> : null}
        {activeGameId === 'orbit-escape' ? <OrbitEscape3D /> : null}
        {activeGameId === 'depth-pulse' ? <DepthPulse3D /> : null}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Rocket className="w-3 h-3 text-primary" /> Instant play, zero loading</span>
        <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {shownGames.length} games ready</span>
      </div>
    </div>
  );
}
