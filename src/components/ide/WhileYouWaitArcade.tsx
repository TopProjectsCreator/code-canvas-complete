import { useEffect, useMemo, useState } from 'react';
import { Gamepad2, Rocket, Trophy, Box, Swords, Zap, BrainCircuit, MoveHorizontal } from 'lucide-react';
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
    name: 'Tap Sprint',
    dimension: '2D',
    genre: 'Reflex',
    vibe: 'Hit the glowing tile before it moves',
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
    id: 'lane-dodge',
    name: 'Lane Dodge',
    dimension: '3D',
    genre: 'Arcade Runner',
    vibe: 'Swap lanes and avoid incoming blocks',
    players: '1',
    status: 'Playable now',
  },
];

function TapSprint() {
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState(() => Math.floor(Math.random() * 9));

  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      setRunning(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((current) => current - 1);
    }, 1000);

    const targetTimer = setInterval(() => {
      setTarget(Math.floor(Math.random() * 9));
    }, 650);

    return () => {
      clearInterval(timer);
      clearInterval(targetTimer);
    };
  }, [running, timeLeft]);

  const startGame = () => {
    setScore(0);
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
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }, (_, index) => (
          <button
            key={index}
            disabled={!running}
            onClick={() => {
              if (!running) return;
              if (index === target) {
                setScore((prev) => prev + 1);
                setTarget(Math.floor(Math.random() * 9));
              }
            }}
            className={cn(
              'h-9 rounded-md border border-border transition-colors',
              running && index === target
                ? 'bg-primary text-primary-foreground border-primary'
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

  const reset = () => {
    setCards(shuffleCards());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
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

function LaneDodge() {
  const [running, setRunning] = useState(false);
  const [lane, setLane] = useState(1);
  const [obstacles, setObstacles] = useState<{ lane: number; row: number }[]>([]);
  const [score, setScore] = useState(0);
  const [crashed, setCrashed] = useState(false);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setObstacles((current) => {
        const moved = current
          .map((obstacle) => ({ ...obstacle, row: obstacle.row + 1 }))
          .filter((obstacle) => obstacle.row <= 5);

        if (Math.random() > 0.45) {
          moved.push({ lane: Math.floor(Math.random() * 3), row: 0 });
        }

        const hit = moved.some((obstacle) => obstacle.row === 5 && obstacle.lane === lane);
        if (hit) {
          setRunning(false);
          setCrashed(true);
        } else {
          setScore((prev) => prev + 1);
        }

        return moved;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [running, lane]);

  const start = () => {
    setLane(1);
    setObstacles([]);
    setScore(0);
    setCrashed(false);
    setRunning(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span>Score: {score}</span>
        <span>{running ? 'Alive' : crashed ? 'Crashed' : 'Ready'}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 h-36 rounded-md border border-border p-1 bg-background">
        {Array.from({ length: 18 }).map((_, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          const hasObstacle = obstacles.some((obstacle) => obstacle.row === row && obstacle.lane === col);
          const isPlayer = row === 5 && lane === col;

          return (
            <div
              key={index}
              className={cn(
                'rounded-sm border border-border/60',
                hasObstacle ? 'bg-destructive/80' : 'bg-background',
                isPlayer ? 'bg-primary border-primary' : undefined,
              )}
            />
          );
        })}
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
          onClick={() => setLane((current) => Math.min(2, current + 1))}
          disabled={!running}
          className="rounded-md border border-border py-1 text-[11px] disabled:opacity-40"
        >
          Right
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
            Real mini-games you can play while AI generates your project.
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
          <span className="text-muted-foreground">{activeGame.genre}</span>
        </div>

        {activeGameId === 'tap-sprint' ? <TapSprint /> : null}
        {activeGameId === 'pair-pulse' ? <PairPulse /> : null}
        {activeGameId === 'lane-dodge' ? <LaneDodge /> : null}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Rocket className="w-3 h-3 text-primary" /> Instant play, no loading screens</span>
        <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {shownGames.length} games ready</span>
      </div>
    </div>
  );
}
