/**
 * SVG-based Scratch block shapes matching the official Scratch editor.
 * Block types: stack, hat (top-hat), cap, c-block, reporter (oval), boolean (hexagon).
 * Supports inline input slots: [value] for reporter inputs, <value> for boolean inputs.
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
const CHAR_W = 7;
const INPUT_H = 20;
const INPUT_PAD = 6;
const BOOL_H = 20;

// Darker shade for bottom border effect
const darken = (hex: string, amount = 0.15) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * (1 - amount))},${Math.round(g * (1 - amount))},${Math.round(b * (1 - amount))})`;
};

/** Parse label into segments: text parts and input slots */
type LabelSegment =
  | { type: 'text'; value: string }
  | { type: 'reporter'; value: string }
  | { type: 'boolean'; value: string }
  | { type: 'dropdown'; value: string };

const parseLabel = (label: string): LabelSegment[] => {
  const segments: LabelSegment[] = [];
  let i = 0;
  let current = '';

  while (i < label.length) {
    if (label[i] === '[') {
      if (current) { segments.push({ type: 'text', value: current }); current = ''; }
      const end = label.indexOf(']', i + 1);
      if (end === -1) { current += label[i]; i++; continue; }
      segments.push({ type: 'reporter', value: label.slice(i + 1, end) });
      i = end + 1;
    } else if (label[i] === '<') {
      if (current) { segments.push({ type: 'text', value: current }); current = ''; }
      const end = label.indexOf('>', i + 1);
      if (end === -1) { current += label[i]; i++; continue; }
      segments.push({ type: 'boolean', value: label.slice(i + 1, end) });
      i = end + 1;
    } else if (label[i] === '{') {
      if (current) { segments.push({ type: 'text', value: current }); current = ''; }
      const end = label.indexOf('}', i + 1);
      if (end === -1) { current += label[i]; i++; continue; }
      segments.push({ type: 'dropdown', value: label.slice(i + 1, end) });
      i = end + 1;
    } else {
      current += label[i];
      i++;
    }
  }
  if (current) segments.push({ type: 'text', value: current });
  return segments;
};

const DROPDOWN_PAD = 6;
const DROPDOWN_ARROW = 8;

/** Measure total width needed for parsed segments */
const measureSegments = (segments: LabelSegment[]): number => {
  let w = 10; // left padding
  for (const seg of segments) {
    if (seg.type === 'text') {
      w += seg.value.length * CHAR_W;
    } else if (seg.type === 'reporter') {
      w += Math.max(seg.value.length * CHAR_W + INPUT_PAD * 2 + 4, 28) + 4;
    } else if (seg.type === 'boolean') {
      w += Math.max(seg.value.length * CHAR_W + BOOL_H + 4, 32) + 4;
    } else if (seg.type === 'dropdown') {
      w += seg.value.length * CHAR_W + DROPDOWN_PAD * 2 + DROPDOWN_ARROW + 8;
    }
  }
  w += 10; // right padding
  return w;
};

const notchRight = () =>
  `l ${NOTCH_W * 0.2},${NOTCH_H} l ${NOTCH_W * 0.6},0 l ${NOTCH_W * 0.2},-${NOTCH_H}`;

/** Standard stack block with top notch + bottom notch */
const stackPath = (w: number, h: number) => {
  const r = CORNER;
  return [
    `M 0,${r}`, `A ${r},${r} 0 0 1 ${r},0`,
    `L ${NOTCH_OFFSET},0`, notchRight(), `L ${w - r},0`,
    `A ${r},${r} 0 0 1 ${w},${r}`, `L ${w},${h - r}`,
    `A ${r},${r} 0 0 1 ${w - r},${h}`,
    `L ${NOTCH_OFFSET + NOTCH_W},${h}`,
    `l -${NOTCH_W * 0.2},${NOTCH_H} l -${NOTCH_W * 0.6},0 l -${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${r},${h}`, `A ${r},${r} 0 0 1 0,${h - r}`, 'Z',
  ].join(' ');
};

/** Hat block: rounded top (no top notch), bottom notch */
const hatPath = (w: number, h: number) => {
  return [
    `M 0,${HAT_CURVE}`,
    `C 0,${HAT_CURVE * 0.2} ${w * 0.15},0 ${w * 0.4},0`,
    `C ${w * 0.65},0 ${w},${HAT_CURVE * 0.2} ${w},${HAT_CURVE}`,
    `L ${w},${h - CORNER}`, `A ${CORNER},${CORNER} 0 0 1 ${w - CORNER},${h}`,
    `L ${NOTCH_OFFSET + NOTCH_W},${h}`,
    `l -${NOTCH_W * 0.2},${NOTCH_H} l -${NOTCH_W * 0.6},0 l -${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${CORNER},${h}`, `A ${CORNER},${CORNER} 0 0 1 0,${h - CORNER}`, 'Z',
  ].join(' ');
};

/** Cap block: top notch, flat bottom (no bottom notch) */
const capPath = (w: number, h: number) => {
  const r = CORNER;
  return [
    `M 0,${r}`, `A ${r},${r} 0 0 1 ${r},0`,
    `L ${NOTCH_OFFSET},0`, notchRight(), `L ${w - r},0`,
    `A ${r},${r} 0 0 1 ${w},${r}`, `L ${w},${h - r}`,
    `A ${r},${r} 0 0 1 ${w - r},${h}`,
    `L ${r},${h}`, `A ${r},${r} 0 0 1 0,${h - r}`, 'Z',
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
    `M 0,${r}`, `A ${r},${r} 0 0 1 ${r},0`,
    `L ${NOTCH_OFFSET},0`, notchRight(), `L ${w - r},0`,
    `A ${r},${r} 0 0 1 ${w},${r}`,
    `L ${w},${mouthTop - r}`, `A ${r},${r} 0 0 1 ${w - r},${mouthTop}`,
    `L ${armW + NOTCH_OFFSET + NOTCH_W},${mouthTop}`,
    `l -${NOTCH_W * 0.2},${NOTCH_H} l -${NOTCH_W * 0.6},0 l -${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${armW + r},${mouthTop}`, `A ${r},${r} 0 0 0 ${armW},${mouthTop + r}`,
    `L ${armW},${mouthBottom - r}`, `A ${r},${r} 0 0 0 ${armW + r},${mouthBottom}`,
    `L ${armW + NOTCH_OFFSET},${mouthBottom}`, notchRight(),
    `L ${w - r},${mouthBottom}`, `A ${r},${r} 0 0 1 ${w},${mouthBottom + r}`,
    `L ${w},${totalH - r}`, `A ${r},${r} 0 0 1 ${w - r},${totalH}`,
    `L ${NOTCH_OFFSET + NOTCH_W},${totalH}`,
    `l -${NOTCH_W * 0.2},${NOTCH_H} l -${NOTCH_W * 0.6},0 l -${NOTCH_W * 0.2},-${NOTCH_H}`,
    `L ${r},${totalH}`, `A ${r},${r} 0 0 1 0,${totalH - r}`, 'Z',
  ].join(' ');
};

/** Reporter block: oval / pill shape */
const reporterPath = (w: number, h: number) => {
  const rad = h / 2;
  return [
    `M ${rad},0`, `L ${w - rad},0`,
    `A ${rad},${rad} 0 0 1 ${w - rad},${h}`,
    `L ${rad},${h}`, `A ${rad},${rad} 0 0 1 ${rad},0`, 'Z',
  ].join(' ');
};

/** Boolean block: hexagon / pointed shape */
const booleanPath = (w: number, h: number) => {
  const point = h / 2;
  return [
    `M ${point},0`, `L ${w - point},0`, `L ${w},${h / 2}`,
    `L ${w - point},${h}`, `L ${point},${h}`, `L 0,${h / 2}`, 'Z',
  ].join(' ');
};

export const getBlockShape = (opcode: string): ScratchBlockShapeProps['shape'] => {
  if (opcode.startsWith('event_when') || opcode === 'control_start_as_clone') return 'hat';
  if (opcode === 'control_stop' || opcode === 'control_delete_this_clone') return 'cap';
  if (['control_repeat', 'control_forever', 'control_if', 'control_if_else', 'control_repeat_until', 'control_wait_until'].includes(opcode)) return 'c-block';
  if (['sensing_answer', 'sensing_mousex', 'sensing_mousey', 'sensing_loudness', 'sensing_timer', 'sensing_dayssince2000', 'sensing_current',
    'operator_add', 'operator_subtract', 'operator_multiply', 'operator_divide', 'operator_random',
    'operator_join', 'operator_letter_of', 'operator_length', 'operator_mod', 'operator_round', 'operator_mathop',
    'data_itemoflist', 'data_lengthoflist', 'sensing_distanceto',
    'motion_xposition', 'motion_yposition', 'motion_direction',
    'looks_costumenumbername', 'looks_backdropnumbername', 'looks_size',
    'sound_volume',
  ].includes(opcode)) return 'reporter';
  if (['sensing_touchingobject', 'sensing_touchingcolor', 'sensing_coloristouchingcolor', 'sensing_keypressed', 'sensing_mousedown',
    'operator_gt', 'operator_lt', 'operator_equals', 'operator_and', 'operator_or', 'operator_not',
    'operator_contains', 'data_listcontainsitem',
  ].includes(opcode)) return 'boolean';
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
  const segments = parseLabel(label);
  const hasInputs = segments.some((s) => s.type !== 'text');

  const measuredW = hasInputs ? measureSegments(segments) : Math.max(MIN_W, label.length * 7.5 + 24);
  const w = width ?? Math.max(MIN_W, measuredW);
  const h = height ?? (shape === 'hat' ? STACK_H + HAT_CURVE : shape === 'reporter' || shape === 'boolean' ? 28 : STACK_H);
  const totalH = shape === 'c-block' ? STACK_H + mouthHeight + STACK_H + NOTCH_H : h + NOTCH_H;
  const darker = darken(color);

  let pathD: string;
  switch (shape) {
    case 'hat': pathD = hatPath(w, h); break;
    case 'cap': pathD = capPath(w, h); break;
    case 'c-block': pathD = cBlockPath(w, h, mouthHeight); break;
    case 'reporter': pathD = reporterPath(w, h); break;
    case 'boolean': pathD = booleanPath(w, h); break;
    default: pathD = stackPath(w, h);
  }

  // Text Y positioning
  const textY = shape === 'hat' ? HAT_CURVE + (STACK_H - HAT_CURVE) / 2 + 5
    : shape === 'c-block' ? STACK_H / 2 + 4
    : h / 2 + 4.5;
  const startX = shape === 'boolean' ? h / 2 + 4 : shape === 'reporter' ? h / 2 : 10;

  // Render inline input elements
  const renderSegments = () => {
    const elements: React.ReactNode[] = [];
    let x = startX;
    const inputY = (h - INPUT_H) / 2;
    const boolY = (h - BOOL_H) / 2;

    segments.forEach((seg, i) => {
      if (seg.type === 'text') {
        elements.push(
          <text
            key={i}
            x={x}
            y={textY}
            fill="white"
            fontSize="12"
            fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
            fontWeight="500"
          >
            {seg.value}
          </text>
        );
        x += seg.value.length * CHAR_W;
      } else if (seg.type === 'reporter') {
        const inputW = Math.max(seg.value.length * CHAR_W + INPUT_PAD * 2 + 4, 28);
        const rad = INPUT_H / 2;
        elements.push(
          <g key={i}>
            <rect
              x={x}
              y={inputY}
              width={inputW}
              height={INPUT_H}
              rx={rad}
              ry={rad}
              fill="white"
              opacity="0.9"
            />
            <text
              x={x + INPUT_PAD + 2}
              y={inputY + INPUT_H / 2 + 4}
              fill="#575e75"
              fontSize="11"
              fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
              fontWeight="400"
            >
              {seg.value}
            </text>
          </g>
        );
        x += inputW + 4;
      } else if (seg.type === 'boolean') {
        const inputW = Math.max(seg.value.length * CHAR_W + BOOL_H + 4, 32);
        const point = BOOL_H / 2;
        const boolPath = [
          `M ${x + point},${boolY}`,
          `L ${x + inputW - point},${boolY}`,
          `L ${x + inputW},${boolY + BOOL_H / 2}`,
          `L ${x + inputW - point},${boolY + BOOL_H}`,
          `L ${x + point},${boolY + BOOL_H}`,
          `L ${x},${boolY + BOOL_H / 2}`,
          'Z',
        ].join(' ');
        elements.push(
          <g key={i}>
            <path d={boolPath} fill="white" opacity="0.9" />
            {seg.value && (
              <text
                x={x + point + 2}
                y={boolY + BOOL_H / 2 + 4}
                fill="#575e75"
                fontSize="11"
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                fontWeight="400"
              >
                {seg.value}
              </text>
            )}
          </g>
        );
        x += inputW + 4;
      } else if (seg.type === 'dropdown') {
        const dropW = seg.value.length * CHAR_W + DROPDOWN_PAD * 2 + DROPDOWN_ARROW + 4;
        const dropH = INPUT_H;
        const dropY = (h - dropH) / 2;
        const rad = dropH / 2;
        elements.push(
          <g key={i}>
            <rect
              x={x}
              y={dropY}
              width={dropW}
              height={dropH}
              rx={rad}
              ry={rad}
              fill="rgba(0,0,0,0.15)"
            />
            <text
              x={x + DROPDOWN_PAD + 2}
              y={dropY + dropH / 2 + 4}
              fill="white"
              fontSize="11"
              fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
              fontWeight="500"
            >
              {seg.value}
            </text>
            {/* Dropdown arrow triangle */}
            <polygon
              points={`${x + dropW - DROPDOWN_PAD - 6},${dropY + dropH / 2 - 2} ${x + dropW - DROPDOWN_PAD},${dropY + dropH / 2 - 2} ${x + dropW - DROPDOWN_PAD - 3},${dropY + dropH / 2 + 2}`}
              fill="white"
              opacity="0.8"
            />
          </g>
        );
        x += dropW + 4;
      }
    });
    return elements;
  };

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
      {/* Label with inline inputs */}
      {hasInputs ? (
        renderSegments()
      ) : (
        <text
          x={startX}
          y={textY}
          fill="white"
          fontSize="12"
          fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
          fontWeight="500"
        >
          {label}
        </text>
      )}
    </svg>
  );
};
