import { useState, useEffect, useCallback, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { 
  Palette, Coins, Dices, Calculator as CalcIcon, Loader2, 
  TrendingUp, TrendingDown, RotateCw, FileCode, ArrowRight
} from 'lucide-react';
import type { ChatWidget } from '@/types/agent';

// ─── Color Picker Widget ───
const ColorPickerWidget = ({ widget }: { widget: ChatWidget }) => {
  const [color, setColor] = useState(String(widget.config?.default || '#6366f1'));
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30 my-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <Palette className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">Color Picker</span>
      </div>
      <div className="p-3 flex items-center gap-3">
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border border-border bg-transparent"
        />
        <div className="flex-1 space-y-1">
          <div className="text-sm font-mono text-foreground">{color.toUpperCase()}</div>
          <div className="text-[10px] text-muted-foreground">
            RGB: {parseInt(color.slice(1, 3), 16)}, {parseInt(color.slice(3, 5), 16)}, {parseInt(color.slice(5, 7), 16)}
          </div>
        </div>
        <div className="w-12 h-12 rounded-lg border border-border" style={{ backgroundColor: color }} />
      </div>
    </div>
  );
};

// ─── Coin Flip Widget ───
const CoinFlipWidget = ({ widget }: { widget: ChatWidget }) => {
  const rigged = widget.config?.result as 'heads' | 'tails' | undefined;
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [flipping, setFlipping] = useState(false);

  const flip = () => {
    setFlipping(true);
    setResult(null);
    setTimeout(() => {
      const outcome = rigged || (Math.random() > 0.5 ? 'heads' : 'tails');
      setResult(outcome);
      setFlipping(false);
    }, 800);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30 my-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <Coins className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">Coin Flip</span>
      </div>
      <div className="p-4 flex flex-col items-center gap-3">
        <div className={cn(
          'w-16 h-16 rounded-full border-2 flex items-center justify-center text-lg font-bold transition-all duration-300',
          flipping && 'animate-spin',
          result === 'heads' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' :
          result === 'tails' ? 'bg-blue-500/20 border-blue-500 text-blue-400' :
          'bg-muted border-border text-muted-foreground'
        )}>
          {flipping ? '?' : result ? (result === 'heads' ? 'H' : 'T') : '🪙'}
        </div>
        {result && !flipping && (
          <span className="text-sm font-semibold text-foreground capitalize">{result}!</span>
        )}
        <button
          onClick={flip}
          disabled={flipping}
          className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-1.5"
        >
          <RotateCw className={cn('w-3 h-3', flipping && 'animate-spin')} />
          {result ? 'Flip Again' : 'Flip Coin'}
        </button>
      </div>
    </div>
  );
};

// ─── Dice Roll Widget ───
const DiceRollWidget = ({ widget }: { widget: ChatWidget }) => {
  const sides = Number(widget.config?.sides) || 6;
  const [result, setResult] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);

  const roll = () => {
    setRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      setResult(Math.floor(Math.random() * sides) + 1);
      count++;
      if (count >= 10) {
        clearInterval(interval);
        setResult(Math.floor(Math.random() * sides) + 1);
        setRolling(false);
      }
    }, 80);
  };

  const diceFaces: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30 my-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <Dices className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">Dice Roll (d{sides})</span>
      </div>
      <div className="p-4 flex flex-col items-center gap-3">
        <div className={cn(
          'w-16 h-16 rounded-xl border-2 flex items-center justify-center transition-all',
          rolling ? 'border-primary animate-bounce' : 'border-border',
          result ? 'bg-primary/10' : 'bg-muted'
        )}>
          {sides <= 6 && result ? (
            <span className="text-3xl">{diceFaces[result] || result}</span>
          ) : (
            <span className="text-2xl font-bold text-foreground">{result ?? '?'}</span>
          )}
        </div>
        <button
          onClick={roll}
          disabled={rolling}
          className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-1.5"
        >
          <Dices className="w-3 h-3" />
          {result ? 'Roll Again' : 'Roll Dice'}
        </button>
      </div>
    </div>
  );
};

// ─── Calculator Widget ───
const CalculatorWidget = () => {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  const input = (val: string) => {
    if (fresh) { setDisplay(val); setFresh(false); }
    else setDisplay(d => d === '0' ? val : d + val);
  };

  const doOp = (nextOp: string) => {
    const curr = parseFloat(display);
    if (prev !== null && op) {
      const result = op === '+' ? prev + curr : op === '-' ? prev - curr : op === '×' ? prev * curr : op === '÷' && curr !== 0 ? prev / curr : curr;
      setPrev(result);
      setDisplay(String(parseFloat(result.toFixed(10))));
    } else {
      setPrev(curr);
    }
    setOp(nextOp);
    setFresh(true);
  };

  const equals = () => {
    if (prev !== null && op) {
      const curr = parseFloat(display);
      const result = op === '+' ? prev + curr : op === '-' ? prev - curr : op === '×' ? prev * curr : op === '÷' && curr !== 0 ? prev / curr : curr;
      setDisplay(String(parseFloat(result.toFixed(10))));
      setPrev(null);
      setOp(null);
      setFresh(true);
    }
  };

  const clear = () => { setDisplay('0'); setPrev(null); setOp(null); setFresh(true); };

  const btn = (label: string, onClick: () => void, variant: 'num' | 'op' | 'eq' | 'clear' = 'num') => (
    <button onClick={onClick} className={cn(
      'rounded-md text-xs font-medium h-8 transition-all',
      variant === 'num' && 'bg-background hover:bg-accent text-foreground',
      variant === 'op' && 'bg-primary/20 hover:bg-primary/30 text-primary',
      variant === 'eq' && 'bg-primary hover:bg-primary/90 text-primary-foreground',
      variant === 'clear' && 'bg-destructive/20 hover:bg-destructive/30 text-destructive',
    )}>{label}</button>
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30 my-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <CalcIcon className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">Calculator</span>
      </div>
      <div className="p-3 space-y-2" style={{ maxWidth: 220 }}>
        <div className="bg-background border border-border rounded-md px-3 py-2 text-right text-lg font-mono text-foreground truncate">
          {display}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {btn('C', clear, 'clear')}
          {btn('±', () => setDisplay(d => String(-parseFloat(d))), 'op')}
          {btn('%', () => setDisplay(d => String(parseFloat(d) / 100)), 'op')}
          {btn('÷', () => doOp('÷'), 'op')}
          {['7','8','9'].map(n => btn(n, () => input(n)))}
          {btn('×', () => doOp('×'), 'op')}
          {['4','5','6'].map(n => btn(n, () => input(n)))}
          {btn('-', () => doOp('-'), 'op')}
          {['1','2','3'].map(n => btn(n, () => input(n)))}
          {btn('+', () => doOp('+'), 'op')}
          {btn('0', () => input('0'))}
          {btn('.', () => { if (!display.includes('.')) input('.'); })}
          {btn('', () => {}, 'num')}
          {btn('=', equals, 'eq')}
        </div>
      </div>
    </div>
  );
};

// ─── Spinner Widget ───
const SpinnerWidget = ({ widget }: { widget: ChatWidget }) => {
  const sections = ((widget.config?.sections as string) || 'Red,Blue,Green,Yellow').split(',').map(s => s.trim());
  const colors = ((widget.config?.colors as string) || '#ef4444,#3b82f6,#22c55e,#eab308').split(',').map(s => s.trim());
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);

  const spin = () => {
    setSpinning(true);
    setWinner(null);
    const extra = 1440 + Math.random() * 720; // 4-6 full rotations
    const newRotation = rotation + extra;
    setRotation(newRotation);
    setTimeout(() => {
      const normalizedAngle = newRotation % 360;
      const sectionAngle = 360 / sections.length;
      // The pointer is at top (0°), wheel rotates clockwise
      const winIndex = Math.floor(((360 - normalizedAngle % 360) % 360) / sectionAngle) % sections.length;
      setWinner(sections[winIndex]);
      setSpinning(false);
    }, 3000);
  };

  const sectionAngle = 360 / sections.length;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30 my-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <RotateCw className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">Spinner</span>
      </div>
      <div className="p-4 flex flex-col items-center gap-3">
        <div className="relative w-36 h-36">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-primary" />
          {/* Wheel */}
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : undefined,
            }}
          >
            {sections.map((section, i) => {
              const startAngle = (i * sectionAngle - 90) * (Math.PI / 180);
              const endAngle = ((i + 1) * sectionAngle - 90) * (Math.PI / 180);
              const x1 = 50 + 48 * Math.cos(startAngle);
              const y1 = 50 + 48 * Math.sin(startAngle);
              const x2 = 50 + 48 * Math.cos(endAngle);
              const y2 = 50 + 48 * Math.sin(endAngle);
              const largeArc = sectionAngle > 180 ? 1 : 0;
              const midAngle = ((i + 0.5) * sectionAngle - 90) * (Math.PI / 180);
              const tx = 50 + 30 * Math.cos(midAngle);
              const ty = 50 + 30 * Math.sin(midAngle);

              return (
                <g key={i}>
                  <path
                    d={`M50,50 L${x1},${y1} A48,48 0 ${largeArc},1 ${x2},${y2} Z`}
                    fill={colors[i % colors.length]}
                    stroke="rgba(0,0,0,0.2)"
                    strokeWidth="0.5"
                  />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={sections.length > 6 ? '4' : '5'}
                    fontWeight="bold"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                  >
                    {section.length > 8 ? section.slice(0, 7) + '…' : section}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        {winner && !spinning && (
          <span className="text-sm font-semibold text-foreground">🎉 {winner}!</span>
        )}
        <button
          onClick={spin}
          disabled={spinning}
          className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-1.5"
        >
          <RotateCw className={cn('w-3 h-3', spinning && 'animate-spin')} />
          {winner ? 'Spin Again' : 'Spin!'}
        </button>
      </div>
    </div>
  );
};

// ─── Stock Ticker Widget ───
const StockWidget = ({ widget }: { widget: ChatWidget }) => {
  const symbol = (widget.config?.symbol as string) || 'AAPL';
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState(symbol);

  useEffect(() => {
    // Use a free API to get stock data
    const fetchStock = async () => {
      setLoading(true);
      try {
        // Simulated realistic stock data since we don't have a real API key
        const basePrice: Record<string, [string, number]> = {
          AAPL: ['Apple Inc.', 198.50],
          GOOGL: ['Alphabet Inc.', 176.30],
          MSFT: ['Microsoft Corp.', 428.70],
          AMZN: ['Amazon.com Inc.', 197.80],
          TSLA: ['Tesla Inc.', 248.40],
          META: ['Meta Platforms', 522.10],
          NVDA: ['NVIDIA Corp.', 875.30],
          NFLX: ['Netflix Inc.', 640.20],
        };
        const [name, base] = basePrice[symbol.toUpperCase()] || [symbol, 100 + Math.random() * 200];
        const fluctuation = (Math.random() - 0.5) * base * 0.04;
        setCompanyName(name);
        setPrice(parseFloat((base + fluctuation).toFixed(2)));
        setChange(parseFloat((fluctuation / base * 100).toFixed(2)));
      } catch {
        setPrice(null);
      }
      setLoading(false);
    };
    fetchStock();
  }, [symbol]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30 my-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <TrendingUp className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">Stock: {symbol.toUpperCase()}</span>
      </div>
      <div className="p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading stock data...
          </div>
        ) : price !== null ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{companyName}</div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground">${price.toFixed(2)}</span>
              <span className={cn(
                'flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded',
                change >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              )}>
                {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {change >= 0 ? '+' : ''}{change}%
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">Simulated data · {new Date().toLocaleTimeString()}</div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Unable to load stock data</div>
        )}
      </div>
    </div>
  );
};

// ─── Template Change Widget ───
const TemplateChangeWidget = ({ widget, onChangeTemplate }: { widget: ChatWidget; onChangeTemplate?: (template: string) => void }) => {
  const template = (widget.config?.template as string) || 'react';
  const [applied, setApplied] = useState(false);

  const templateNames: Record<string, string> = {
    blank: 'Blank', html: 'HTML/CSS/JS', javascript: 'JavaScript', typescript: 'TypeScript',
    python: 'Python', java: 'Java', cpp: 'C++', c: 'C', go: 'Go', rust: 'Rust',
    ruby: 'Ruby', php: 'PHP', csharp: 'C#', bash: 'Bash', react: 'React',
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30 my-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        <FileCode className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-medium text-foreground">Switch Template</span>
      </div>
      <div className="p-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-foreground">{templateNames[template] || template}</span>
          <p className="text-[10px] text-muted-foreground">Switch your project to this template</p>
        </div>
        <button
          onClick={() => {
            if (onChangeTemplate && !applied) {
              onChangeTemplate(template);
              setApplied(true);
            }
          }}
          disabled={applied}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            applied
              ? 'bg-green-500/20 text-green-400'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {applied ? '✓ Switched' : <><ArrowRight className="w-3 h-3" /> Switch</>}
        </button>
      </div>
    </div>
  );
};



const SimpleInfoWidget = ({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) => (
  <div className="border border-border rounded-lg overflow-hidden bg-muted/30 my-2">
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
      {icon}
      <span className="text-xs font-medium text-foreground">{title}</span>
    </div>
    <div className="p-3 text-xs text-muted-foreground">{children}</div>
  </div>
);

const PomodoroWidget = ({ widget }: { widget: ChatWidget }) => {
  const duration = Number(widget.config?.duration) || 25;
  const [secondsLeft, setSecondsLeft] = useState(duration * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <SimpleInfoWidget title="Pair Programming Timer" icon={<RotateCw className="w-3.5 h-3.5 text-primary" />}>
      <div className="flex items-center justify-between">
        <span className="text-xl font-mono text-foreground">{mm}:{ss}</span>
        <button onClick={() => setRunning(v => !v)} className="px-2 py-1 rounded bg-primary text-primary-foreground">{running ? 'Pause' : 'Start'}</button>
      </div>
    </SimpleInfoWidget>
  );
};

const GenericTagWidget = ({ widget }: { widget: ChatWidget }) => (
  <SimpleInfoWidget title={widget.type.replace(/_/g, ' ')} icon={<FileCode className="w-3.5 h-3.5 text-primary" />}>
    <pre className="whitespace-pre-wrap">{JSON.stringify(widget.config || {}, null, 2)}</pre>
  </SimpleInfoWidget>
);

// ─── Main renderer ───
export const ChatWidgetRenderer = ({ 
  widget, 
  onChangeTemplate 
}: { 
  widget: ChatWidget; 
  onChangeTemplate?: (template: string) => void;
}) => {
  switch (widget.type) {
    case 'color_picker': return <ColorPickerWidget widget={widget} />;
    case 'coin_flip': return <CoinFlipWidget widget={widget} />;
    case 'dice_roll': return <DiceRollWidget widget={widget} />;
    case 'calculator': return <CalculatorWidget />;
    case 'spinner': return <SpinnerWidget widget={widget} />;
    case 'stock': return <StockWidget widget={widget} />;
    case 'change_template': return <TemplateChangeWidget widget={widget} onChangeTemplate={onChangeTemplate} />;
    case 'pomodoro': return <PomodoroWidget widget={widget} />;
    case 'project_stats':
    case 'logic_visualizer':
    case 'asset_search':
    case 'viewport_preview':
    case 'a11y_audit':
    case 'todo_tracker':
    case 'dependency_visualizer':
    case 'readme_generator':
    case 'code_review':
      return <GenericTagWidget widget={widget} />;
    default: return null;
  }
};
