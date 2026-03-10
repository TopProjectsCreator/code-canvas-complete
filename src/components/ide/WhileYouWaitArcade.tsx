import { useMemo, useState } from 'react';
import { Gamepad2, Box, Sword, Car, Users, Rocket, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArcadeGame {
  name: string;
  dimension: '2D' | '3D';
  genre: string;
  vibe: string;
  players: string;
  status: 'Playable now' | 'Prototype' | 'Designing';
}

const arcadeGames: ArcadeGame[] = [
  { name: 'Neon Drift MMO', dimension: '3D', genre: 'Racing MMO', vibe: 'Street leagues + world events', players: 'Massive', status: 'Prototype' },
  { name: 'Skyline Rally Worlds', dimension: '3D', genre: 'Racing', vibe: 'Arcade checkpoints in mega-cities', players: '1-12', status: 'Designing' },
  { name: 'Kart Kingdom Clash', dimension: '3D', genre: 'Battle Racing', vibe: 'Powerups, team objectives, chaos', players: '1-16', status: 'Designing' },
  { name: 'Drift Circuit 2049', dimension: '2D', genre: 'Top-Down Racing', vibe: 'Tight drift controls + speedruns', players: '1-4', status: 'Playable now' },
  { name: 'Dungeon Pixel Raiders', dimension: '2D', genre: 'Action RPG', vibe: 'Loot runs and boss rushes', players: '1-4', status: 'Playable now' },
  { name: 'Voxel Frontier', dimension: '3D', genre: 'Survival Craft', vibe: 'Build, farm, defend your base', players: '1-24', status: 'Prototype' },
  { name: 'Mech Arena Uplink', dimension: '3D', genre: 'Arena Shooter', vibe: 'Ability-based mech duels', players: '6v6', status: 'Prototype' },
  { name: 'Chrono Heist', dimension: '2D', genre: 'Stealth Puzzle', vibe: 'Time-loop infiltration missions', players: '1', status: 'Playable now' },
  { name: 'Island Tycoon Online', dimension: '2D', genre: 'Management Sim', vibe: 'Economy + tourism strategy', players: 'Shared world', status: 'Designing' },
  { name: 'Gravity Parkour', dimension: '3D', genre: 'Platformer', vibe: 'Wall-runs and gravity flips', players: '1-8', status: 'Prototype' },
  { name: 'Galaxy Freight Co-op', dimension: '3D', genre: 'Space Co-op', vibe: 'Pilot, trade, and defend cargo', players: '1-6', status: 'Designing' },
  { name: 'Pixel Tactics Arena', dimension: '2D', genre: 'Auto-Battler', vibe: 'Draft squads and outplay', players: '8', status: 'Playable now' },
];

export function WhileYouWaitArcade() {
  const [filter, setFilter] = useState<'All' | '2D' | '3D'>('All');

  const shownGames = useMemo(
    () => arcadeGames.filter((game) => filter === 'All' || game.dimension === filter),
    [filter],
  );

  return (
    <div className="mt-2 rounded-xl border border-primary/20 bg-gradient-to-b from-primary/10 via-background to-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <Gamepad2 className="w-3.5 h-3.5" />
            While you wait • AI Arcade
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Fresh 2D/3D ideas to play while the AI cooks your project.
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

      <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
        {shownGames.map((game) => (
          <div key={game.name} className="rounded-lg border border-border/70 bg-card/60 p-2.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-xs font-medium text-foreground">{game.name}</p>
              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{game.dimension}</span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Car className="w-3 h-3" /> {game.genre}</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {game.players}</span>
              <span className="flex items-center gap-1"><Sword className="w-3 h-3" /> {game.vibe}</span>
              <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> {game.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Rocket className="w-3 h-3 text-primary" /> New daily concepts queued</span>
        <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {shownGames.length} games loaded</span>
      </div>
    </div>
  );
}
