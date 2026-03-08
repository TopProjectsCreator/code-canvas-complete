/**
 * SVG-based Scratch block shapes matching the official Scratch editor.
 * Block types: stack, hat (top-hat), cap, c-block, reporter (oval), boolean (hexagon).
 */

interface ScratchBlockShapeProps {
  label: string;
  color: string;
  shape: 'stack' | 'hat' | 'cap' | 'c-block' | 'reporter' | 'boolean';
  width?: number;
  height?: number;
  /** For c-blocks: height of the mouth/inner area */
  mouthHeight?: number;
  className?: string;
  style?: React.CSSProperties;
}

const NOTCH_W = 15;
const NOTCH_H = 4;
const NOTCH_OFFSET = 18;
const CORNER = 4;
const MIN_W = 120;
const STACK_H = 32;
const HAT_CURVE = 20;
const C_ARM = 14;

// Darker shade for bottom border effect
const darken = (hex: string, amount = 0.15) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * (1 - amount))},${Math.round(g * (1 - amount))},${Math.round(b * (1 - amount))})`;
};

const notchRight = (x: number, y: number) =>
  `l ${NOTCH_W * 0.2},${NOTCH_H} l ${NOTCH_W * 0.6},0 l ${NOTCH_W * 0.2},-${NOTCH_H}`;

const notchDown = (x: number) =>
  `L ${x + NOTCH_OFFSET},${0} ${notchRight(x + NOTCH_OFFSET, 0)}`;

const notchDownAt = (y: number, startX: number) =>
  `L ${startX + NOTCH_OFFSET},${y} l ${NOTCH_W * 0.2},${NOTCH_H} l ${NOTCH_W * 0.6},0 l ${NOTCH_W * 0.2},-${NOTCH_H}`;

/** Standard stack block with top notch + bottom notch */
const stackPath = (w: number, h: number) => {
  const r = CORNER;
  return [
    `M 0,${r}`,
    `A ${r},${r} 0 0 1 ${r},0`,
    // top notch
    `L ${NOTCH_OFFSET},0`,
    `l ${NOTCH_W * 0.2},${NOTCH_H}`,
    `l ${NOTCH_W * 0.6},0`,
    `l ${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${w - r},0`,
    `A ${r},${r} 0 0 1 ${w},${r}`,
    `L ${w},${h - r}`,
    `A ${r},${r} 0 0 1 ${w - r},${h}`,
    // bottom notch
    `L ${NOTCH_OFFSET + NOTCH_W},${h}`,
    `l -${NOTCH_W * 0.2},${NOTCH_H}`,
    `l -${NOTCH_W * 0.6},0`,
    `l -${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${r},${h}`,
    `A ${r},${r} 0 0 1 0,${h - r}`,
    'Z',
  ].join(' ');
};

/** Hat block: rounded top (no top notch), bottom notch */
const hatPath = (w: number, h: number) => {
  return [
    `M 0,${HAT_CURVE}`,
    `C 0,${HAT_CURVE * 0.2} ${w * 0.15},0 ${w * 0.4},0`,
    `C ${w * 0.65},0 ${w},${HAT_CURVE * 0.2} ${w},${HAT_CURVE}`,
    `L ${w},${h - CORNER}`,
    `A ${CORNER},${CORNER} 0 0 1 ${w - CORNER},${h}`,
    // bottom notch
    `L ${NOTCH_OFFSET + NOTCH_W},${h}`,
    `l -${NOTCH_W * 0.2},${NOTCH_H}`,
    `l -${NOTCH_W * 0.6},0`,
    `l -${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${CORNER},${h}`,
    `A ${CORNER},${CORNER} 0 0 1 0,${h - CORNER}`,
    'Z',
  ].join(' ');
};

/** Cap block: top notch, flat bottom (no bottom notch) */
const capPath = (w: number, h: number) => {
  const r = CORNER;
  return [
    `M 0,${r}`,
    `A ${r},${r} 0 0 1 ${r},0`,
    `L ${NOTCH_OFFSET},0`,
    `l ${NOTCH_W * 0.2},${NOTCH_H}`,
    `l ${NOTCH_W * 0.6},0`,
    `l ${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${w - r},0`,
    `A ${r},${r} 0 0 1 ${w},${r}`,
    `L ${w},${h - r}`,
    `A ${r},${r} 0 0 1 ${w - r},${h}`,
    `L ${r},${h}`,
    `A ${r},${r} 0 0 1 0,${h - r}`,
    'Z',
  ].join(' ');
};

/** C-block: top notch, open mouth, bottom notch */
const cBlockPath = (w: number, h: number, mouth: number) => {
  const r = CORNER;
  const topH = STACK_H;
  const armW = C_ARM;
  const mouthTop = topH;
  const mouthBottom = mouthTop + mouth;
  const totalH = mouthBottom + STACK_H;

  return [
    // Top-left
    `M 0,${r}`,
    `A ${r},${r} 0 0 1 ${r},0`,
    // Top notch
    `L ${NOTCH_OFFSET},0`,
    `l ${NOTCH_W * 0.2},${NOTCH_H}`,
    `l ${NOTCH_W * 0.6},0`,
    `l ${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${w - r},0`,
    `A ${r},${r} 0 0 1 ${w},${r}`,
    // Right side down to mouth
    `L ${w},${mouthTop - r}`,
    `A ${r},${r} 0 0 1 ${w - r},${mouthTop}`,
    // Inner notch (mouth top)
    `L ${armW + NOTCH_OFFSET + NOTCH_W},${mouthTop}`,
    `l -${NOTCH_W * 0.2},${NOTCH_H}`,
    `l -${NOTCH_W * 0.6},0`,
    `l -${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${armW + r},${mouthTop}`,
    `A ${r},${r} 0 0 0 ${armW},${mouthTop + r}`,
    // Inner left side down
    `L ${armW},${mouthBottom - r}`,
    `A ${r},${r} 0 0 0 ${armW + r},${mouthBottom}`,
    // Inner bottom notch
    `L ${armW + NOTCH_OFFSET},${mouthBottom}`,
    `l ${NOTCH_W * 0.2},${NOTCH_H}`,
    `l ${NOTCH_W * 0.6},0`,
    `l ${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${w - r},${mouthBottom}`,
    `A ${r},${r} 0 0 1 ${w},${mouthBottom + r}`,
    // Right side down to bottom
    `L ${w},${totalH - r}`,
    `A ${r},${r} 0 0 1 ${w - r},${totalH}`,
    // Bottom notch
    `L ${NOTCH_OFFSET + NOTCH_W},${totalH}`,
    `l -${NOTCH_W * 0.2},${NOTCH_H}`,
    `l -${NOTCH_W * 0.6},0`,
    `l -${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${r},${totalH}`,
    `A ${r},${r} 0 0 1 0,${totalH - r}`,
    'Z',
  ].join(' ');
};

/** Reporter block: oval / pill shape */
const reporterPath = (w: number, h: number) => {
  const rad = h / 2;
  return [
    `M ${rad},0`,
    `L ${w - rad},0`,
    `A ${rad},${rad} 0 0 1 ${w - rad},${h}`,
    `L ${rad},${h}`,
    `A ${rad},${rad} 0 0 1 ${rad},0`,
    'Z',
  ].join(' ');
};

/** Boolean block: hexagon / pointed shape */
const booleanPath = (w: number, h: number) => {
  const point = h / 2;
  return [
    `M ${point},0`,
    `L ${w - point},0`,
    `L ${w},${h / 2}`,
    `L ${w - point},${h}`,
    `L ${point},${h}`,
    `L 0,${h / 2}`,
    'Z',
  ].join(' ');
};

export const getBlockShape = (opcode: string): ScratchBlockShapeProps['shape'] => {
  // Hat blocks (event listeners, clone start)
  if (opcode.startsWith('event_when') || opcode === 'control_start_as_clone') return 'hat';
  // Cap blocks (stop, delete clone)
  if (opcode === 'control_stop' || opcode === 'control_delete_this_clone') return 'cap';
  // C-blocks (loops, conditionals)
  if (['control_repeat', 'control_forever', 'control_if', 'control_if_else', 'control_repeat_until', 'control_wait_until'].includes(opcode)) return 'c-block';
  // Reporter blocks (values)
  if (['sensing_answer', 'sensing_mousex', 'sensing_mousey', 'sensing_loudness', 'sensing_timer', 'sensing_dayssince2000', 'sensing_current',
    'operator_add', 'operator_subtract', 'operator_multiply', 'operator_divide', 'operator_random',
    'operator_join', 'operator_letter_of', 'operator_length', 'operator_mod', 'operator_round', 'operator_mathop',
    'data_itemoflist', 'data_lengthoflist',
    'motion_xposition', 'motion_yposition', 'motion_direction',
    'looks_costumenumbername', 'looks_backdropnumbername', 'looks_size',
    'sound_volume',
  ].includes(opcode)) return 'reporter';
  // Boolean blocks
  if (['sensing_touchingobject', 'sensing_touchingcolor', 'sensing_coloristouchingcolor', 'sensing_keypressed', 'sensing_mousedown',
    'operator_gt', 'operator_lt', 'operator_equals', 'operator_and', 'operator_or', 'operator_not',
    'operator_contains', 'data_listcontainsitem',
  ].includes(opcode)) return 'boolean';
  // Default: stack
  return 'stack';
};

export const ScratchBlockShape = ({
  label,
  color,
  shape,
  width,
  height,
  mouthHeight = 24,
  className = '',
  style = {},
}: ScratchBlockShapeProps) => {
  // Compute dimensions based on label length
  const textLen = label.length;
  const baseW = Math.max(MIN_W, textLen * 7.5 + 24);
  const w = width ?? baseW;
  const h = height ?? (shape === 'hat' ? STACK_H + HAT_CURVE : shape === 'reporter' || shape === 'boolean' ? 28 : STACK_H);
  const totalH = shape === 'c-block' ? STACK_H + mouthHeight + STACK_H + NOTCH_H : h + NOTCH_H;
  const darker = darken(color);

  let pathD: string;
  switch (shape) {
    case 'hat':
      pathD = hatPath(w, h);
      break;
    case 'cap':
      pathD = capPath(w, h);
      break;
    case 'c-block':
      pathD = cBlockPath(w, h, mouthHeight);
      break;
    case 'reporter':
      pathD = reporterPath(w, h);
      break;
    case 'boolean':
      pathD = booleanPath(w, h);
      break;
    default:
      pathD = stackPath(w, h);
  }

  // Text positioning
  const textY = shape === 'hat' ? HAT_CURVE + (STACK_H - HAT_CURVE) / 2 + 5
    : shape === 'c-block' ? STACK_H / 2 + 4
    : h / 2 + 4.5;
  const textX = shape === 'boolean' ? h / 2 + 4 : shape === 'reporter' ? h / 2 : 10;

  return (
    <svg
      width={w}
      height={totalH + 1}
      viewBox={`0 0 ${w} ${totalH + 1}`}
      className={className}
      style={{ display: 'block', overflow: 'visible', ...style }}
    >
      {/* Shadow / darker bottom */}
      <path d={pathD} fill={darker} transform="translate(0,1)" />
      {/* Main block */}
      <path d={pathD} fill={color} />
      {/* Label */}
      <text
        x={textX}
        y={textY}
        fill="white"
        fontSize="12"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontWeight="500"
      >
        {label}
      </text>
    </svg>
  );
};
