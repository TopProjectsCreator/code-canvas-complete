import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  StopCircle,
  Maximize2,
  Plus,
  Flag,
  Volume2,
  Brush,
  Code2,
  // Search removed - unused
  ZoomIn,
  ZoomOut,
  CircleMinus,
  RotateCw,
  RotateCcw,
  Eye,
  EyeOff,
  Upload,
  Play,
} from 'lucide-react';
import VirtualMachine from 'scratch-vm';
import { ScratchArchive, exportScratchArchive, importScratchArchive } from '@/services/scratchSb3';
import { ScratchBlockShape, getBlockShape } from './ScratchBlockShape';
import { ShadowInput } from './ShadowInput';
import { ScratchLibraryDialog, type LibraryMode } from './ScratchLibraryDialog';
import { type ScratchLibraryAsset, assetUrl } from '@/data/scratchLibrary';

type ScratchInputPrimitive = string | number | boolean;

interface ScratchBlockNode {
  id: string;
  opcode: string;
  next?: string | null;
  parent?: string | null;
  inputs?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  shadow?: boolean;
  topLevel?: boolean;
  x?: number;
  y?: number;
  mutation?: Record<string, unknown>;
}

interface ScratchTarget {
  isStage: boolean;
  name: string;
  variables?: Record<string, [string, ScratchInputPrimitive]>;
  lists?: Record<string, [string, ScratchInputPrimitive[]]>;
  blocks?: Record<string, ScratchBlockNode>;
  costumes?: Array<{ name: string; assetId: string; md5ext: string; dataFormat: string; rotationCenterX?: number; rotationCenterY?: number }>;
  sounds?: Array<{ name: string; assetId: string; md5ext: string; dataFormat: string; rate?: number; sampleCount?: number }>;
  currentCostume?: number;
  visible?: boolean;
  x?: number;
  y?: number;
  size?: number;
  direction?: number;
  [key: string]: unknown;
}

interface ScratchProject {
  targets: ScratchTarget[];
  monitors?: unknown[];
  extensions?: string[];
  meta?: Record<string, unknown>;
  projectVersion?: number;
}

interface ScratchVmTarget {
  isStage?: boolean;
  sprite?: { name?: string };
  x?: number;
  y?: number;
  direction?: number;
  visible?: boolean;
}

interface ScratchVmLike {
  runtime?: { targets?: ScratchVmTarget[] };
  start: () => void;
  stopAll: () => void;
  greenFlag: () => void;
  loadProject: (projectData: ArrayBuffer | string | object) => Promise<void>;
  attachRenderer: (renderer: unknown) => void;
  attachStorage: (storage: unknown) => void;
  attachAudioEngine: (audioEngine: unknown) => void;
}

interface ScratchPanelProps {
  archive: ScratchArchive | null;
  onArchiveChange: (archive: ScratchArchive | null) => void;
  onProjectJsonUpdate: (json: string) => void;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
}

type ScratchCompatibilityVersion = 'scratch3' | 'scratch2' | 'scratch14';

const SCRATCH_VERSION_OPTIONS: Array<{ value: ScratchCompatibilityVersion; label: string; semver: string }> = [
  { value: 'scratch3', label: 'Scratch 3', semver: '3.0.0' },
  { value: 'scratch2', label: 'Scratch 2', semver: '2.0.0' },
  { value: 'scratch14', label: 'Scratch 1.4', semver: '1.4.0' },
];

const semverToScratchVersion = (semver: unknown): ScratchCompatibilityVersion => {
  const semverString = typeof semver === 'string' ? semver : '';
  if (semverString.startsWith('1.4')) return 'scratch14';
  if (semverString.startsWith('2')) return 'scratch2';
  return 'scratch3';
};

const versionRank: Record<ScratchCompatibilityVersion, number> = {
  scratch14: 0,
  scratch2: 1,
  scratch3: 2,
};

const isOpcodeSupportedInVersion = (opcode: string, version: ScratchCompatibilityVersion) => {
  if (!opcode || opcode === 'compat_foreverif') return false;
  if (version === 'scratch3') return true;

  if (opcode.startsWith('pen_') || opcode.startsWith('music_')) return false;
  if (['control_start_as_clone', 'control_create_clone_of', 'control_delete_this_clone'].includes(opcode)) return false;

  if (version === 'scratch14') {
    if (opcode.startsWith('procedures_')) return false;
    if (opcode === 'event_whengreaterthan') return false;
  }

  return true;
};

type ProcArgType = 'string_number' | 'boolean' | 'label';
type ProcArg = { type: ProcArgType; name: string; id?: string };

type ScratchBlockDef = {
  label: string;
  opcode: string;
  inputs?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  action?: 'create_variable' | 'create_list' | 'make_procedure';
  minVersion?: ScratchCompatibilityVersion;
  maxVersion?: ScratchCompatibilityVersion;
  proccode?: string;
  procArgs?: ProcArg[];
  procWarp?: boolean;
};
// Fallback 2D canvas renderer when scratch-render (WebGL) doesn't produce output
const fallbackImageCache = new Map<string, HTMLImageElement>();

const drawFallbackStage = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  archive: ScratchArchive | null,
  vm: ScratchVmLike | null,
) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  if (!archive) return;

  let project: ScratchProject | null = null;
  try {
    project = JSON.parse(archive.projectJson) as ScratchProject;
  } catch { return; }
  if (!project?.targets) return;

  const imgMime = (fmt: string | undefined) => {
    const f = fmt || 'png';
    return f === 'svg' ? 'image/svg+xml' : `image/${f}`;
  };

  const loadImg = (md5ext: string, dataFormat?: string): HTMLImageElement | null => {
    const cached = fallbackImageCache.get(md5ext);
    if (cached?.complete && cached.naturalWidth > 0) return cached;
    if (cached) return null; // still loading
    const b64 = archive.files?.[md5ext];
    if (!b64) return null;
    const img = new Image();
    img.src = `data:${imgMime(dataFormat)};base64,${b64}`;
    fallbackImageCache.set(md5ext, img);
    return null; // will render next frame
  };

  // Draw stage backdrop
  const stage = project.targets.find((t) => t.isStage);
  if (stage?.costumes?.length) {
    const idx = Number(stage.currentCostume || 0);
    const costume = stage.costumes[idx] || stage.costumes[0];
    if (costume) {
      const img = loadImg(costume.md5ext, costume.dataFormat);
      if (img) {
        ctx.drawImage(img, 0, 0, w, h);
      }
    }
  }

  // Draw sprites
  const runtimeTargets = vm?.runtime?.targets;
  for (const target of project.targets) {
    if (target.isStage) continue;
    // Use runtime position if available
    const rt = runtimeTargets?.find((t) => t.sprite?.name === target.name);
    const visible = rt ? rt.visible !== false : true;
    if (!visible) continue;

    const costumes = target.costumes || [];
    const costumeIdx = Number(target.currentCostume || 0);
    const costume = costumes[costumeIdx] || costumes[0];
    if (!costume) continue;

    const img = loadImg(costume.md5ext, costume.dataFormat);
    if (!img) continue;

    const x = (rt?.x ?? 0) + w / 2;
    const y = h / 2 - (rt?.y ?? 0);
    const bitmapRes = (costume as Record<string, unknown>).bitmapResolution as number || (costume.dataFormat === 'svg' ? 1 : 2);
    const cx = (costume.rotationCenterX || 0) / bitmapRes;
    const cy = (costume.rotationCenterY || 0) / bitmapRes;
    const drawW = img.naturalWidth / bitmapRes;
    const drawH = img.naturalHeight / bitmapRes;

    ctx.save();
    ctx.translate(x, y);
    const dir = (rt?.direction ?? 90) - 90;
    if (Math.abs(dir) > 0.1) ctx.rotate((dir * Math.PI) / 180);
    ctx.drawImage(img, -cx, -cy, drawW, drawH);
    ctx.restore();
  }
};


const DEFAULT_PROJECT: ScratchProject = {
  targets: [
    {
      isStage: true,
      name: 'Stage',
      variables: {},
      lists: {},
      blocks: {},
      costumes: [],
      sounds: [],
    },
    {
      isStage: false,
      name: 'Sprite1',
      variables: {},
      lists: {},
      blocks: {},
      costumes: [],
      sounds: [],
      visible: true,
      x: 0,
      y: 0,
      size: 100,
      direction: 90,
    },
  ],
  monitors: [],
  extensions: [],
  meta: {
    semver: '3.0.0',
    vm: '0.2.0',
    agent: 'code-canvas',
  },
};

const categoryBlocks: Record<string, ScratchBlockDef[]> = {
  Motion: [
    { label: 'move [10] steps', opcode: 'motion_movesteps', inputs: { STEPS: [1, [4, '10']] } },
    { label: 'turn ⟳ [15] degrees', opcode: 'motion_turnright', inputs: { DEGREES: [1, [4, '15']] } },
    { label: 'turn ⟲ [15] degrees', opcode: 'motion_turnleft', inputs: { DEGREES: [1, [4, '15']] } },
    { label: 'go to {random position}', opcode: 'motion_goto', fields: { TO: ['_random_', null] } },
    { label: 'go to x: [0]  y: [0]', opcode: 'motion_gotoxy', inputs: { X: [1, [4, '0']], Y: [1, [4, '0']] } },
    { label: 'glide [1] secs to {random position}', opcode: 'motion_glideto', inputs: { SECS: [1, [4, '1']] }, fields: { TO: ['_random_', null] } },
    { label: 'glide [1] secs to x: [0]  y: [0]', opcode: 'motion_glidesecstoxy', inputs: { SECS: [1, [4, '1']], X: [1, [4, '0']], Y: [1, [4, '0']] } },
    { label: 'point in direction [90]', opcode: 'motion_pointindirection', inputs: { DIRECTION: [1, [4, '90']] } },
    { label: 'point towards {mouse-pointer}', opcode: 'motion_pointtowards', fields: { TOWARDS: ['_mouse_', null] } },
    { label: 'change x by [10]', opcode: 'motion_changexby', inputs: { DX: [1, [4, '10']] } },
    { label: 'set x to [0]', opcode: 'motion_setx', inputs: { X: [1, [4, '0']] } },
    { label: 'change y by [10]', opcode: 'motion_changeyby', inputs: { DY: [1, [4, '10']] } },
    { label: 'set y to [0]', opcode: 'motion_sety', inputs: { Y: [1, [4, '0']] } },
    { label: 'if on edge, bounce', opcode: 'motion_ifonedgebounce' },
    { label: 'set rotation style {left-right}', opcode: 'motion_setrotationstyle', fields: { STYLE: ['left-right', null] } },
    { label: 'x position', opcode: 'motion_xposition' },
    { label: 'y position', opcode: 'motion_yposition' },
    { label: 'direction', opcode: 'motion_direction' },
  ],
  Looks: [
    { label: 'say [Hello!] for [2] seconds', opcode: 'looks_sayforsecs', inputs: { MESSAGE: [1, [10, 'Hello!']], SECS: [1, [4, '2']] } },
    { label: 'say [Hello!]', opcode: 'looks_say', inputs: { MESSAGE: [1, [10, 'Hello!']] } },
    { label: 'think [Hmm...] for [2] seconds', opcode: 'looks_thinkforsecs', inputs: { MESSAGE: [1, [10, 'Hmm...']], SECS: [1, [4, '2']] } },
    { label: 'think [Hmm...]', opcode: 'looks_think', inputs: { MESSAGE: [1, [10, 'Hmm...']] } },
    { label: 'switch costume to {costume1}', opcode: 'looks_switchcostumeto', fields: { COSTUME: ['costume1', null] } },
    { label: 'next costume', opcode: 'looks_nextcostume' },
    { label: 'switch backdrop to {backdrop1}', opcode: 'looks_switchbackdropto', fields: { BACKDROP: ['backdrop1', null] } },
    { label: 'next backdrop', opcode: 'looks_nextbackdrop' },
    { label: 'change size by [10]', opcode: 'looks_changesizeby', inputs: { CHANGE: [1, [4, '10']] } },
    { label: 'set size to [100] %', opcode: 'looks_setsizeto', inputs: { SIZE: [1, [4, '100']] } },
    { label: 'change {color} effect by [25]', opcode: 'looks_changeeffectby', inputs: { CHANGE: [1, [4, '25']] }, fields: { EFFECT: ['COLOR', null] } },
    { label: 'set {color} effect to [0]', opcode: 'looks_seteffectto', inputs: { VALUE: [1, [4, '0']] }, fields: { EFFECT: ['COLOR', null] } },
    { label: 'clear graphic effects', opcode: 'looks_cleargraphiceffects' },
    { label: 'show', opcode: 'looks_show' },
    { label: 'hide', opcode: 'looks_hide' },
    { label: 'go to {front} layer', opcode: 'looks_gotofrontback', fields: { FRONT_BACK: ['front', null] } },
    { label: 'go {backward} [1] layers', opcode: 'looks_goforwardbackwardlayers', inputs: { NUM: [1, [4, '1']] }, fields: { FORWARD_BACKWARD: ['backward', null] } },
    { label: 'costume #', opcode: 'looks_costumenumbername', fields: { NUMBER_NAME: ['number', null] } },
    { label: 'backdrop #', opcode: 'looks_backdropnumbername', fields: { NUMBER_NAME: ['number', null] } },
    { label: 'size', opcode: 'looks_size' },
  ],
  Sound: [
    { label: 'play sound {Meow} until done', opcode: 'sound_playuntildone', fields: { SOUND_MENU: ['pop', null] } },
    { label: 'start sound {Meow}', opcode: 'sound_play', fields: { SOUND_MENU: ['pop', null] } },
    { label: 'stop all sounds', opcode: 'sound_stopallsounds' },
    { label: 'change {pitch} effect by [10]', opcode: 'sound_changeeffectby', inputs: { VALUE: [1, [4, '10']] }, fields: { EFFECT: ['PITCH', null] } },
    { label: 'set {pitch} effect to [100]', opcode: 'sound_seteffectto', inputs: { VALUE: [1, [4, '100']] }, fields: { EFFECT: ['PITCH', null] } },
    { label: 'clear sound effects', opcode: 'sound_cleareffects' },
    { label: 'change volume by [-10]', opcode: 'sound_changevolumeby', inputs: { VOLUME: [1, [4, '-10']] } },
    { label: 'set volume to [100] %', opcode: 'sound_setvolumeto', inputs: { VOLUME: [1, [4, '100']] } },
    { label: 'volume', opcode: 'sound_volume' },
  ],
  Events: [
    { label: 'when 🏴 clicked', opcode: 'event_whenflagclicked' },
    { label: 'when {space} key pressed', opcode: 'event_whenkeypressed', fields: { KEY_OPTION: ['space', null] } },
    { label: 'when this sprite clicked', opcode: 'event_whenthisspriteclicked' },
    { label: 'when backdrop switches to {backdrop1}', opcode: 'event_whenbackdropswitchesto', fields: { BACKDROP: ['backdrop1', null] } },
    { label: 'when {loudness} > [10]', opcode: 'event_whengreaterthan', inputs: { VALUE: [1, [4, '10']] }, fields: { WHENGREATERTHANMENU: ['LOUDNESS', null] } },
    { label: 'when I receive {message1}', opcode: 'event_whenbroadcastreceived', fields: { BROADCAST_OPTION: ['message1', null] } },
    { label: 'broadcast {message1}', opcode: 'event_broadcast', inputs: { BROADCAST_INPUT: [1, [11, 'message1', 'message1']] } },
    { label: 'broadcast {message1} and wait', opcode: 'event_broadcastandwait', inputs: { BROADCAST_INPUT: [1, [11, 'message1', 'message1']] } },
  ],
  Control: [
    { label: 'wait [1] seconds', opcode: 'control_wait', inputs: { DURATION: [1, [4, '1']] } },
    { label: 'repeat [10]', opcode: 'control_repeat', inputs: { TIMES: [1, [4, '10']] } },
    { label: 'forever', opcode: 'control_forever' },
    { label: 'if <> then', opcode: 'control_if' },
    { label: 'if <> then else', opcode: 'control_if_else' },
    { label: 'wait until <>', opcode: 'control_wait_until' },
    { label: 'repeat until <>', opcode: 'control_repeat_until' },
    { label: 'forever if <>', opcode: 'compat_foreverif', maxVersion: 'scratch14' },
    { label: 'stop {all}', opcode: 'control_stop', fields: { STOP_OPTION: ['all', null] } },
    { label: 'when I start as a clone', opcode: 'control_start_as_clone', minVersion: 'scratch3' },
    { label: 'create clone of {myself}', opcode: 'control_create_clone_of', fields: { CLONE_OPTION: ['_myself_', null] }, minVersion: 'scratch3' },
    { label: 'delete this clone', opcode: 'control_delete_this_clone', minVersion: 'scratch3' },
  ],
  Sensing: [
    { label: 'touching {mouse-pointer} ?', opcode: 'sensing_touchingobject', fields: { TOUCHINGOBJECTMENU: ['_mouse_', null] } },
    { label: 'touching color [#0000ff] ?', opcode: 'sensing_touchingcolor', inputs: { COLOR: [1, [9, '#0000ff']] } },
    { label: 'color [#0000ff] is touching [#ff0000] ?', opcode: 'sensing_coloristouchingcolor', inputs: { COLOR: [1, [9, '#0000ff']], COLOR2: [1, [9, '#ff0000']] } },
    { label: 'distance to {mouse-pointer}', opcode: 'sensing_distanceto', fields: { DISTANCETOMENU: ['_mouse_', null] } },
    { label: 'ask [What is your name?] and wait', opcode: 'sensing_askandwait', inputs: { QUESTION: [1, [10, 'What is your name?']] } },
    { label: 'answer', opcode: 'sensing_answer' },
    { label: 'key {space} pressed?', opcode: 'sensing_keypressed', fields: { KEY_OPTION: ['space', null] } },
    { label: 'mouse down?', opcode: 'sensing_mousedown' },
    { label: 'mouse x', opcode: 'sensing_mousex' },
    { label: 'mouse y', opcode: 'sensing_mousey' },
    { label: '{backdrop #} of {Stage}', opcode: 'sensing_of', inputs: { PROPERTY: [1, [10, 'backdrop #']] }, fields: { OBJECT: ['_stage_', null] } },
    { label: 'loudness', opcode: 'sensing_loudness' },
    { label: 'timer', opcode: 'sensing_timer' },
    { label: 'reset timer', opcode: 'sensing_resettimer' },
    { label: 'current {year}', opcode: 'sensing_current', fields: { CURRENTMENU: ['YEAR', null] } },
    { label: 'days since 2000', opcode: 'sensing_dayssince2000' },
    { label: 'username', opcode: 'sensing_username' },
  ],
  Operators: [
    { label: '[  ] + [  ]', opcode: 'operator_add', inputs: { NUM1: [1, [4, '']], NUM2: [1, [4, '']] } },
    { label: '[  ] - [  ]', opcode: 'operator_subtract', inputs: { NUM1: [1, [4, '']], NUM2: [1, [4, '']] } },
    { label: '[  ] * [  ]', opcode: 'operator_multiply', inputs: { NUM1: [1, [4, '']], NUM2: [1, [4, '']] } },
    { label: '[  ] / [  ]', opcode: 'operator_divide', inputs: { NUM1: [1, [4, '']], NUM2: [1, [4, '']] } },
    { label: 'pick random [1] to [10]', opcode: 'operator_random', inputs: { FROM: [1, [4, '1']], TO: [1, [4, '10']] } },
    { label: '[  ] > [  ]', opcode: 'operator_gt', inputs: { OPERAND1: [1, [10, '']], OPERAND2: [1, [10, '']] } },
    { label: '[  ] < [  ]', opcode: 'operator_lt', inputs: { OPERAND1: [1, [10, '']], OPERAND2: [1, [10, '']] } },
    { label: '[  ] = [  ]', opcode: 'operator_equals', inputs: { OPERAND1: [1, [10, '']], OPERAND2: [1, [10, '']] } },
    { label: '<> and <>', opcode: 'operator_and' },
    { label: '<> or <>', opcode: 'operator_or' },
    { label: 'not <>', opcode: 'operator_not' },
    { label: 'join [apple] [banana]', opcode: 'operator_join', inputs: { STRING1: [1, [10, 'apple']], STRING2: [1, [10, 'banana']] } },
    { label: 'letter [1] of [apple]', opcode: 'operator_letter_of', inputs: { LETTER: [1, [4, '1']], STRING: [1, [10, 'apple']] } },
    { label: 'length of [apple]', opcode: 'operator_length', inputs: { STRING: [1, [10, 'apple']] } },
    { label: '[apple] contains [a] ?', opcode: 'operator_contains', inputs: { STRING1: [1, [10, 'apple']], STRING2: [1, [10, 'a']] } },
    { label: '[  ] mod [  ]', opcode: 'operator_mod', inputs: { NUM1: [1, [4, '']], NUM2: [1, [4, '']] } },
    { label: 'round [  ]', opcode: 'operator_round', inputs: { NUM: [1, [4, '']] } },
    { label: '{abs} of [  ]', opcode: 'operator_mathop', inputs: { NUM: [1, [4, '']] }, fields: { OPERATOR: ['abs', null] } },
  ],
  Variables: [
    { label: 'set my variable to [0]', opcode: 'data_setvariableto', inputs: { VALUE: [1, [10, '0']] } },
    { label: 'change my variable by [1]', opcode: 'data_changevariableby', inputs: { VALUE: [1, [4, '1']] } },
    { label: 'show variable', opcode: 'data_showvariable' },
    { label: 'hide variable', opcode: 'data_hidevariable' },
    { label: 'add [thing] to my list', opcode: 'data_addtolist', inputs: { ITEM: [1, [10, 'thing']] } },
    { label: 'delete [1] of my list', opcode: 'data_deleteoflist', inputs: { INDEX: [1, [4, '1']] } },
    { label: 'delete all of my list', opcode: 'data_deletealloflist' },
    { label: 'insert [thing] at [1] of my list', opcode: 'data_insertatlist', inputs: { ITEM: [1, [10, 'thing']], INDEX: [1, [4, '1']] } },
    { label: 'replace item [1] of my list with [thing]', opcode: 'data_replaceitemoflist', inputs: { INDEX: [1, [4, '1']], ITEM: [1, [10, 'thing']] } },
    { label: 'item [1] of my list', opcode: 'data_itemoflist', inputs: { INDEX: [1, [4, '1']] } },
    { label: 'item # of [thing] in my list', opcode: 'data_itemnumoflist', inputs: { ITEM: [1, [10, 'thing']] } },
    { label: 'length of my list', opcode: 'data_lengthoflist' },
    { label: 'my list contains [thing] ?', opcode: 'data_listcontainsitem', inputs: { ITEM: [1, [10, 'thing']] } },
    { label: 'show my list', opcode: 'data_showlist' },
    { label: 'hide my list', opcode: 'data_hidelist' },
  ],
  'My Blocks': [],
  Pen: [
    { label: 'erase all', opcode: 'pen_clear' },
    { label: 'stamp', opcode: 'pen_stamp' },
    { label: 'pen down', opcode: 'pen_penDown' },
    { label: 'pen up', opcode: 'pen_penUp' },
    { label: 'set pen color to [#0000ff]', opcode: 'pen_setPenColorToColor', inputs: { COLOR: [1, [9, '#0000ff']] } },
    { label: 'change pen {color} by [10]', opcode: 'pen_changePenColorParamBy', inputs: { VALUE: [1, [4, '10']] }, fields: { COLOR_PARAM: ['color', null] } },
    { label: 'set pen {color} to [50]', opcode: 'pen_setPenColorParamTo', inputs: { VALUE: [1, [4, '50']] }, fields: { COLOR_PARAM: ['color', null] } },
    { label: 'change pen size by [1]', opcode: 'pen_changePenSizeBy', inputs: { SIZE: [1, [4, '1']] } },
    { label: 'set pen size to [1]', opcode: 'pen_setPenSizeTo', inputs: { SIZE: [1, [4, '1']] } },
  ],
  Music: [
    { label: 'play drum {1} for [0.25] beats', opcode: 'music_playDrumForBeats', inputs: { BEATS: [1, [4, '0.25']] }, fields: { DRUM: ['1', null] } },
    { label: 'rest for [0.25] beats', opcode: 'music_restForBeats', inputs: { BEATS: [1, [4, '0.25']] } },
    { label: 'play note [60] for [0.25] beats', opcode: 'music_playNoteForBeats', inputs: { NOTE: [1, [4, '60']], BEATS: [1, [4, '0.25']] } },
    { label: 'set instrument to {1}', opcode: 'music_setInstrument', fields: { INSTRUMENT: ['1', null] } },
    { label: 'set tempo to [60]', opcode: 'music_setTempo', inputs: { TEMPO: [1, [4, '60']] } },
    { label: 'change tempo by [20]', opcode: 'music_changeTempo', inputs: { TEMPO: [1, [4, '20']] } },
    { label: 'tempo', opcode: 'music_getTempo' },
  ],
};

const categoryColors: Record<string, string> = {
  Motion: '#4c97ff',
  Looks: '#9966ff',
  Sound: '#cf63cf',
  Events: '#ffbf00',
  Control: '#ffab19',
  Sensing: '#5cb1d6',
  Operators: '#59c059',
  Variables: '#ff8c1a',
  'My Blocks': '#ff6680',
  Pen: '#0fbd8c',
  Music: '#d65cd6',
};

const categoryColorsScratch2: Record<string, string> = {
  Motion: '#0066cc',
  Looks: '#7f34a8',
  Sound: '#bc3a7b',
  Events: '#cc5c2e',
  Control: '#be7d0f',
  Sensing: '#3d7eb8',
  Operators: '#339966',
  Data: '#e67e22',
  Variables: '#e67e22',
  'More Blocks': '#cc5c2e',
  'My Blocks': '#cc5c2e',
  Pen: '#0b8235',
};

const getCategoryColors = (version: ScratchCompatibilityVersion) => {
  if (version === 'scratch2' || version === 'scratch14') {
    return categoryColorsScratch2;
  }
  return categoryColors;
};

const getGUIColors = (version: ScratchCompatibilityVersion) => {
  if (version === 'scratch2' || version === 'scratch14') {
    return {
      headerBg: '#e9eef2',
      tabBg: '#e9eef2',
      categoryRailBg: '#f0f0f0',
      flyoutBg: '#f0f0f0',
      blocksBg: '#f0f0f0',
      stageBg: '#ffffff',
      headerText: '#4d4d4d',
      tabText: '#4d4d4d',
    };
  }
  return {
    headerBg: '#855cd6',
    tabBg: '#855cd6',
    categoryRailBg: '#f9f9f9',
    flyoutBg: '#f9f9f9',
    blocksBg: '#f9f9f9',
    stageBg: '#ffffff',
    headerText: '#ffffff',
    tabText: '#ffffff',
  };
};

const categoryRail = [
  { name: 'Motion', color: '#4c97ff' },
  { name: 'Looks', color: '#9966ff' },
  { name: 'Sound', color: '#cf63cf' },
  { name: 'Events', color: '#ffbf00' },
  { name: 'Control', color: '#ffab19' },
  { name: 'Sensing', color: '#5cb1d6' },
  { name: 'Operators', color: '#59c059' },
  { name: 'Variables', color: '#ff8c1a' },
  { name: 'My Blocks', color: '#ff6680' },
  { name: 'Pen', color: '#0fbd8c' },
  { name: 'Music', color: '#d65cd6' },
];

const categoryRailScratch2 = [
  { name: 'Motion', color: '#0066cc' },
  { name: 'Looks', color: '#7f34a8' },
  { name: 'Sound', color: '#bc3a7b' },
  { name: 'Events', color: '#cc5c2e' },
  { name: 'Control', color: '#be7d0f' },
  { name: 'Sensing', color: '#3d7eb8' },
  { name: 'Operators', color: '#339966' },
  { name: 'Variables', color: '#e67e22' },
  { name: 'My Blocks', color: '#cc5c2e' },
  { name: 'Pen', color: '#0b8235' },
];

const getCategoryRail = (version: ScratchCompatibilityVersion) => {
  if (version === 'scratch2' || version === 'scratch14') {
    return categoryRailScratch2;
  }
  return categoryRail;
};

const SCRATCH2_CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  Variables: 'Data',
  'My Blocks': 'More Blocks',
};

const categoryDisplayName = (name: string, version: ScratchCompatibilityVersion) => {
  if (version === 'scratch2' || version === 'scratch14') {
    return SCRATCH2_CATEGORY_LABEL_OVERRIDES[name] || name;
  }
  return name;
};

const generateId = () => Math.random().toString(36).slice(2, 10);
const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const DEFAULT_STAGE_ASSET_ID = 'cd21514d0531fdffb22204e0ec5ed84a';
const DEFAULT_SPRITE_ASSET_ID = 'bcf454acf82e4504149f7ffe07081dbc';
const DEFAULT_STAGE_COSTUME_FILE = `${DEFAULT_STAGE_ASSET_ID}.svg`;
const DEFAULT_SPRITE_COSTUME_FILE = `${DEFAULT_SPRITE_ASSET_ID}.svg`;
const DEFAULT_STAGE_COSTUME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360"><defs><linearGradient id="bg" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#87ceeb"/><stop offset="1" stop-color="#dff3ff"/></linearGradient></defs><rect width="480" height="360" fill="url(#bg)"/><circle cx="410" cy="70" r="40" fill="#ffd35a"/><rect y="260" width="480" height="100" fill="#95d08f"/></svg>`;
const DEFAULT_SPRITE_COSTUME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><ellipse cx="48" cy="76" rx="28" ry="14" fill="#d18f3b"/><circle cx="36" cy="40" r="20" fill="#f8a64a"/><circle cx="60" cy="40" r="20" fill="#f8a64a"/><circle cx="48" cy="58" r="20" fill="#f8a64a"/><circle cx="42" cy="56" r="3" fill="#222"/><circle cx="54" cy="56" r="3" fill="#222"/></svg>`;

const utf8ToBase64 = (value: string) => btoa(unescape(encodeURIComponent(value)));

const getDefaultCostumeForTarget = (target: ScratchTarget) => (target.isStage
  ? {
      name: 'backdrop1',
      assetId: DEFAULT_STAGE_ASSET_ID,
      md5ext: DEFAULT_STAGE_COSTUME_FILE,
      dataFormat: 'svg',
      rotationCenterX: 240,
      rotationCenterY: 180,
    }
  : {
      name: 'costume1',
      assetId: DEFAULT_SPRITE_ASSET_ID,
      md5ext: DEFAULT_SPRITE_COSTUME_FILE,
      dataFormat: 'svg',
      rotationCenterX: 48,
      rotationCenterY: 48,
    });

const normalizeProjectForVm = (project: ScratchProject): ScratchProject => {
  const sourceTargets = Array.isArray(project.targets) ? project.targets : [];
  const normalizedTargets = sourceTargets.map((target, index) => {
    const isStage = Boolean(target.isStage) || index === 0;
    const costumes = target.costumes && target.costumes.length > 0
      ? target.costumes
      : [getDefaultCostumeForTarget({ ...target, isStage } as ScratchTarget)];

    // Ensure every block has an `id` property matching its dictionary key.
    // Real .sb3 files store blocks as { [id]: { opcode, ... } } without `id` inside.
    const blocks: Record<string, ScratchBlockNode> = {};
    if (target.blocks) {
      for (const [key, block] of Object.entries(target.blocks)) {
        blocks[key] = { ...block, id: block.id || key };
      }
    }

    // Compute positions for blocks that lack x/y by walking `next` chains
    // from top-level blocks. In .sb3 files only top-level blocks have x/y.
    const BLOCK_STEP = 48;
    for (const [, block] of Object.entries(blocks)) {
      if (!block.topLevel || block.shadow) continue;
      let cursor = block.next;
      let depth = 1;
      while (cursor && blocks[cursor]) {
        const child = blocks[cursor];
        if (child.x === undefined || child.y === undefined) {
          blocks[cursor] = {
            ...child,
            x: block.x ?? 40,
            y: (block.y ?? 30) + depth * BLOCK_STEP,
          };
        }
        cursor = child.next ?? null;
        depth++;
        if (depth > 200) break; // safety
      }
    }

    return {
      ...target,
      isStage,
      name: isStage ? 'Stage' : (typeof target.name === 'string' && target.name.trim() ? target.name : `Sprite${index}`),
      blocks,
      costumes,
      currentCostume: typeof target.currentCostume === 'number'
        ? Math.min(Math.max(0, target.currentCostume), Math.max(0, costumes.length - 1))
        : 0,
      visible: isStage ? undefined : target.visible !== false,
      x: isStage ? undefined : Number(target.x || 0),
      y: isStage ? undefined : Number(target.y || 0),
      size: isStage ? undefined : Number(target.size || 100),
      direction: isStage ? undefined : Number(target.direction || 90),
    };
  });

  const stageIndex = normalizedTargets.findIndex((target) => target.isStage);
  const orderedTargets = stageIndex <= 0
    ? normalizedTargets
    : [normalizedTargets[stageIndex], ...normalizedTargets.filter((_, index) => index !== stageIndex)];

  if (orderedTargets.length === 0) {
    return DEFAULT_PROJECT;
  }

  return {
    ...project,
    projectVersion: typeof project.projectVersion === 'number' ? project.projectVersion : 3,
    targets: orderedTargets,
  };
};

const ensureArchiveAssetsForVm = (archive: ScratchArchive): ScratchArchive => {
  const files = {
    ...archive.files,
    [DEFAULT_STAGE_COSTUME_FILE]: archive.files[DEFAULT_STAGE_COSTUME_FILE] || utf8ToBase64(DEFAULT_STAGE_COSTUME_SVG),
    [DEFAULT_SPRITE_COSTUME_FILE]: archive.files[DEFAULT_SPRITE_COSTUME_FILE] || utf8ToBase64(DEFAULT_SPRITE_COSTUME_SVG),
  };
  const fileNames = [...archive.fileNames];
  if (!fileNames.includes(DEFAULT_STAGE_COSTUME_FILE)) fileNames.push(DEFAULT_STAGE_COSTUME_FILE);
  if (!fileNames.includes(DEFAULT_SPRITE_COSTUME_FILE)) fileNames.push(DEFAULT_SPRITE_COSTUME_FILE);
  return { ...archive, files, fileNames };
};

const safeParseProject = (archive: ScratchArchive | null): ScratchProject => {
  if (!archive?.projectJson) return normalizeProjectForVm(DEFAULT_PROJECT);
  try {
    const parsed = JSON.parse(archive.projectJson) as ScratchProject;
    if (!Array.isArray(parsed.targets)) return DEFAULT_PROJECT;
    return normalizeProjectForVm(parsed);
  } catch {
    return DEFAULT_PROJECT;
  }
};

const ensureArchive = (archive: ScratchArchive | null): ScratchArchive => {
  if (archive) {
    const parsed = safeParseProject(archive);
    const withProject = {
      ...archive,
      projectJson: formatJson(parsed),
      fileNames: archive.fileNames.includes('project.json') ? archive.fileNames : [...archive.fileNames, 'project.json'],
    };
    return ensureArchiveAssetsForVm(withProject);
  }
  return ensureArchiveAssetsForVm({
    projectJson: formatJson(DEFAULT_PROJECT),
    files: {},
    fileNames: ['project.json'],
  });
};

const makeNumberInput = (value: string) => [1, [4, value]];
const isEventBlock = (opcode: string) => opcode?.startsWith('event_');
const getBlockColor = (opcode: string) => (!opcode ? '#4c97ff' : opcode.startsWith('motion_') ? '#4c97ff'
  : opcode.startsWith('looks_') ? '#9966ff'
    : opcode.startsWith('sound_') ? '#cf63cf'
      : opcode.startsWith('event_') ? '#ffbf00'
        : opcode.startsWith('control_') ? '#ffab19'
          : opcode.startsWith('sensing_') ? '#5cb1d6'
            : opcode.startsWith('operator_') ? '#59c059'
              : opcode.startsWith('data_') ? '#ff8c1a'
                : opcode.startsWith('procedures_') ? '#ff6680'
                  : opcode.startsWith('pen_') ? '#0fbd8c'
                    : opcode.startsWith('music_') ? '#d65cd6'
                      : '#4c97ff');

const getExtensionId = (opcode: string): string | null => {
  if (opcode.startsWith('pen_')) return 'pen';
  if (opcode.startsWith('music_')) return 'music';
  return null;
};

const isBlockDefAvailable = (blockDef: ScratchBlockDef, version: ScratchCompatibilityVersion) => {
  const minVersion = blockDef.minVersion || 'scratch14';
  const maxVersion = blockDef.maxVersion || 'scratch3';
  if (versionRank[version] < versionRank[minVersion]) return false;
  if (versionRank[version] > versionRank[maxVersion]) return false;
  return isOpcodeSupportedInVersion(blockDef.opcode, version) || blockDef.opcode === 'compat_foreverif';
};

const extensionOf = (name: string) => {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const getFieldOption = (fields: Record<string, unknown> | undefined, key: string, fallback: string) => {
  const tuple = fields?.[key];
  if (!Array.isArray(tuple) || typeof tuple[0] !== 'string') return fallback;
  return tuple[0];
};

// Ordered input keys per opcode — must match the order of [..]/<..> slots in each block's label.
const INPUT_KEYS_BY_OPCODE: Record<string, string[]> = {
  motion_movesteps: ['STEPS'],
  motion_turnright: ['DEGREES'],
  motion_turnleft: ['DEGREES'],
  motion_gotoxy: ['X', 'Y'],
  motion_glidesecstoxy: ['SECS', 'X', 'Y'],
  motion_glideto: ['SECS'],
  motion_pointindirection: ['DIRECTION'],
  motion_changexby: ['DX'],
  motion_setx: ['X'],
  motion_changeyby: ['DY'],
  motion_sety: ['Y'],
  looks_sayforsecs: ['MESSAGE', 'SECS'],
  looks_say: ['MESSAGE'],
  looks_thinkforsecs: ['MESSAGE', 'SECS'],
  looks_think: ['MESSAGE'],
  looks_changeeffectby: ['CHANGE'],
  looks_seteffectto: ['VALUE'],
  looks_changesizeby: ['CHANGE'],
  looks_setsizeto: ['SIZE'],
  looks_goforwardbackwardlayers: ['NUM'],
  sound_changeeffectby: ['VALUE'],
  sound_seteffectto: ['VALUE'],
  sound_changevolumeby: ['VOLUME'],
  sound_setvolumeto: ['VOLUME'],
  control_wait: ['DURATION'],
  control_repeat: ['TIMES'],
  control_if: ['CONDITION'],
  control_if_else: ['CONDITION'],
  control_repeat_until: ['CONDITION'],
  control_wait_until: ['CONDITION'],
  sensing_askandwait: ['QUESTION'],
  operator_add: ['NUM1', 'NUM2'],
  operator_subtract: ['NUM1', 'NUM2'],
  operator_multiply: ['NUM1', 'NUM2'],
  operator_divide: ['NUM1', 'NUM2'],
  operator_random: ['FROM', 'TO'],
  operator_gt: ['OPERAND1', 'OPERAND2'],
  operator_lt: ['OPERAND1', 'OPERAND2'],
  operator_equals: ['OPERAND1', 'OPERAND2'],
  operator_and: ['OPERAND1', 'OPERAND2'],
  operator_or: ['OPERAND1', 'OPERAND2'],
  operator_not: ['OPERAND'],
  operator_join: ['STRING1', 'STRING2'],
  operator_letter_of: ['LETTER', 'STRING'],
  operator_length: ['STRING'],
  operator_contains: ['STRING1', 'STRING2'],
  operator_mod: ['NUM1', 'NUM2'],
  operator_round: ['NUM'],
  operator_mathop: ['NUM'],
  data_setvariableto: ['VALUE'],
  data_changevariableby: ['VALUE'],
  data_addtolist: ['ITEM'],
  data_deleteoflist: ['INDEX'],
  data_insertatlist: ['ITEM', 'INDEX'],
  data_replaceitemoflist: ['INDEX', 'ITEM'],
  data_itemoflist: ['INDEX'],
  data_itemnumoflist: ['ITEM'],
  data_listcontainsitem: ['ITEM'],
  pen_changePenColorParamBy: ['VALUE'],
  pen_setPenColorParamTo: ['VALUE'],
  pen_changePenSizeBy: ['SIZE'],
  pen_setPenSizeTo: ['SIZE'],
};

const getOrderedInputKeysForBlock = (block: ScratchBlockNode): string[] => {
  const op = block.opcode;
  if (op === 'procedures_call') {
    const argIdsJson = block.mutation?.argumentids;
    if (typeof argIdsJson === 'string') {
      try {
        const ids = JSON.parse(argIdsJson) as string[];
        if (Array.isArray(ids)) return ids;
      } catch { /* ignore */ }
    }
    return [];
  }
  const registered = INPUT_KEYS_BY_OPCODE[op];
  if (registered && registered.length) return registered;
  // Fallback: derive from existing inputs (excluding stack mouths) so unregistered blocks still accept reporters.
  if (block.inputs) {
    return Object.keys(block.inputs).filter((k) => k !== 'SUBSTACK' && k !== 'SUBSTACK2' && k !== 'CUSTOM_BLOCK');
  }
  return [];
};

// Registry of dropdown options for block menus, keyed by the parent opcode.
// Each entry maps the INPUT key (on the parent block) to:
//   { menuOpcode, fieldKey, options: [{ value, label }] }
// "options" can also be a function (target) => Option[] to support dynamic lists
// (e.g. costumes/sounds/sprite names).
type DropdownOption = { value: string; label: string };
type MenuFieldDef = {
  inputKey: string;
  fieldKey: string;
  menuOpcode: string;
  options: DropdownOption[] | ((ctx: { spriteNames: string[]; costumeNames: string[]; backdropNames: string[]; soundNames: string[] }) => DropdownOption[]);
};

const DROPDOWN_REGISTRY: Record<string, MenuFieldDef[]> = {
  motion_goto: [{ inputKey: 'TO', fieldKey: 'TO', menuOpcode: 'motion_goto_menu', options: ({ spriteNames }) => [
    { value: '_random_', label: 'random position' },
    { value: '_mouse_', label: 'mouse-pointer' },
    ...spriteNames.map((n) => ({ value: n, label: n })),
  ] }],
  motion_glideto: [{ inputKey: 'TO', fieldKey: 'TO', menuOpcode: 'motion_glideto_menu', options: ({ spriteNames }) => [
    { value: '_random_', label: 'random position' },
    { value: '_mouse_', label: 'mouse-pointer' },
    ...spriteNames.map((n) => ({ value: n, label: n })),
  ] }],
  motion_pointtowards: [{ inputKey: 'TOWARDS', fieldKey: 'TOWARDS', menuOpcode: 'motion_pointtowards_menu', options: ({ spriteNames }) => [
    { value: '_mouse_', label: 'mouse-pointer' },
    ...spriteNames.map((n) => ({ value: n, label: n })),
  ] }],
  looks_switchcostumeto: [{ inputKey: 'COSTUME', fieldKey: 'COSTUME', menuOpcode: 'looks_costume', options: ({ costumeNames }) => costumeNames.map((n) => ({ value: n, label: n })) }],
  looks_switchbackdropto: [{ inputKey: 'BACKDROP', fieldKey: 'BACKDROP', menuOpcode: 'looks_backdrops', options: ({ backdropNames }) => [
    ...backdropNames.map((n) => ({ value: n, label: n })),
    { value: 'next backdrop', label: 'next backdrop' },
    { value: 'previous backdrop', label: 'previous backdrop' },
    { value: 'random backdrop', label: 'random backdrop' },
  ] }],
  sound_play: [{ inputKey: 'SOUND_MENU', fieldKey: 'SOUND_MENU', menuOpcode: 'sound_sounds_menu', options: ({ soundNames }) => soundNames.map((n) => ({ value: n, label: n })) }],
  sound_playuntildone: [{ inputKey: 'SOUND_MENU', fieldKey: 'SOUND_MENU', menuOpcode: 'sound_sounds_menu', options: ({ soundNames }) => soundNames.map((n) => ({ value: n, label: n })) }],
  control_create_clone_of: [{ inputKey: 'CLONE_OPTION', fieldKey: 'CLONE_OPTION', menuOpcode: 'control_create_clone_of_menu', options: ({ spriteNames }) => [
    { value: '_myself_', label: 'myself' },
    ...spriteNames.map((n) => ({ value: n, label: n })),
  ] }],
  sensing_touchingobject: [{ inputKey: 'TOUCHINGOBJECTMENU', fieldKey: 'TOUCHINGOBJECTMENU', menuOpcode: 'sensing_touchingobjectmenu', options: ({ spriteNames }) => [
    { value: '_mouse_', label: 'mouse-pointer' },
    { value: '_edge_', label: 'edge' },
    ...spriteNames.map((n) => ({ value: n, label: n })),
  ] }],
  sensing_distanceto: [{ inputKey: 'DISTANCETOMENU', fieldKey: 'DISTANCETOMENU', menuOpcode: 'sensing_distancetomenu', options: ({ spriteNames }) => [
    { value: '_mouse_', label: 'mouse-pointer' },
    ...spriteNames.map((n) => ({ value: n, label: n })),
  ] }],
  sensing_keypressed: [{ inputKey: 'KEY_OPTION', fieldKey: 'KEY_OPTION', menuOpcode: 'sensing_keyoptions', options: [
    'space', 'up arrow', 'down arrow', 'right arrow', 'left arrow', 'any',
    'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z',
    '0','1','2','3','4','5','6','7','8','9',
  ].map((v) => ({ value: v, label: v })) }],
};

const createVmCompatibleBlockShape = (
  blockId: string,
  blockDef: ScratchBlockDef,
) => {
  const nextInputs = { ...(blockDef.inputs || {}) };
  const nextFields = { ...(blockDef.fields || {}) };
  const extraBlocks: Record<string, ScratchBlockNode> = {};
  let mutation: Record<string, unknown> | undefined;

  const createShadow = (inputKey: string, opcode: string, fieldKey: string, defaultValue: string) => {
    const menuId = generateId();
    extraBlocks[menuId] = {
      id: menuId,
      opcode,
      parent: blockId,
      topLevel: false,
      shadow: true,
      fields: { [fieldKey]: [defaultValue, null] },
      inputs: {},
      next: null,
    };
    nextInputs[inputKey] = [1, menuId];
    delete nextFields[fieldKey];
  };

  const op = blockDef.opcode;
  const procArgs: ProcArg[] = (blockDef.procArgs || []).map((a) => ({
    ...a,
    id: a.id || generateId(),
  }));
  const buildProccodeFromName = (name: string, args: ProcArg[]) => {
    // If the saved proccode already includes %s/%b tokens, trust it; otherwise build it.
    if (name.includes('%s') || name.includes('%b')) return name;
    const parts: string[] = [name.trim()];
    args.forEach((a) => {
      if (a.type === 'label') parts.push(a.name.trim());
      else if (a.type === 'boolean') parts.push('%b');
      else parts.push('%s');
    });
    return parts.filter(Boolean).join(' ');
  };
  const makeProcedureMutation = (
    proccode: string,
    args: ProcArg[],
    warp: boolean,
  ) => {
    const valueArgs = args.filter((a) => a.type !== 'label');
    return {
      tagName: 'mutation',
      children: [],
      proccode,
      argumentids: JSON.stringify(valueArgs.map((a) => a.id)),
      argumentnames: JSON.stringify(valueArgs.map((a) => a.name)),
      argumentdefaults: JSON.stringify(valueArgs.map((a) => (a.type === 'boolean' ? 'false' : ''))),
      warp: warp ? 'true' : 'false',
    };
  };

  if (op === 'compat_foreverif') {
    const ifId = generateId();
    nextInputs.SUBSTACK = [2, ifId];
    extraBlocks[ifId] = {
      id: ifId,
      opcode: 'control_if',
      parent: blockId,
      topLevel: false,
      shadow: false,
      fields: {},
      inputs: {
        CONDITION: [1, [10, 'true']],
      },
      next: null,
    };
    return {
      inputs: nextInputs,
      fields: nextFields,
      extraBlocks,
      mutation,
      opcodeOverride: 'control_forever',
    };
  }

  if (op === 'procedures_definition') {
    const prototypeId = generateId();
    const warp = !!blockDef.procWarp;
    const proccode = buildProccodeFromName(blockDef.proccode || 'custom block', procArgs);
    const valueArgs = procArgs.filter((a) => a.type !== 'label');
    // Create one argument_reporter shadow per value arg, attached as inputs of the prototype
    const protoInputs: Record<string, unknown> = {};
    valueArgs.forEach((a) => {
      const reporterId = generateId();
      extraBlocks[reporterId] = {
        id: reporterId,
        opcode: a.type === 'boolean' ? 'argument_reporter_boolean' : 'argument_reporter_string_number',
        parent: prototypeId,
        topLevel: false,
        shadow: true,
        fields: { VALUE: [a.name, null] },
        inputs: {},
        next: null,
      };
      protoInputs[a.id!] = [1, reporterId];
    });
    extraBlocks[prototypeId] = {
      id: prototypeId,
      opcode: 'procedures_prototype',
      parent: blockId,
      topLevel: false,
      shadow: true,
      fields: {},
      inputs: protoInputs,
      next: null,
      mutation: makeProcedureMutation(proccode, procArgs, warp),
    };
    nextInputs.custom_block = [1, prototypeId];
  }

  if (op === 'procedures_call') {
    const warp = !!blockDef.procWarp;
    const proccode = buildProccodeFromName(blockDef.proccode || 'custom block', procArgs);
    const valueArgs = procArgs.filter((a) => a.type !== 'label');
    valueArgs.forEach((a) => {
      if (a.type === 'boolean') {
        // Boolean input: empty (no shadow), VM treats missing as false
      } else {
        nextInputs[a.id!] = [1, [10, '']];
      }
    });
    mutation = makeProcedureMutation(proccode, procArgs, warp);
  }

  // Motion menus
  if (op === 'motion_goto') createShadow('TO', 'motion_goto_menu', 'TO', getFieldOption(blockDef.fields, 'TO', '_random_'));
  if (op === 'motion_glideto') createShadow('TO', 'motion_glideto_menu', 'TO', getFieldOption(blockDef.fields, 'TO', '_random_'));
  if (op === 'motion_pointtowards') createShadow('TOWARDS', 'motion_pointtowards_menu', 'TOWARDS', getFieldOption(blockDef.fields, 'TOWARDS', '_mouse_'));

  // Looks menus
  if (op === 'looks_switchcostumeto') createShadow('COSTUME', 'looks_costume', 'COSTUME', getFieldOption(blockDef.fields, 'COSTUME', 'costume1'));
  if (op === 'looks_switchbackdropto') createShadow('BACKDROP', 'looks_backdrops', 'BACKDROP', getFieldOption(blockDef.fields, 'BACKDROP', 'backdrop1'));

  // Sound menus
  if (op === 'sound_playuntildone' || op === 'sound_play') createShadow('SOUND_MENU', 'sound_sounds_menu', 'SOUND_MENU', getFieldOption(blockDef.fields, 'SOUND_MENU', 'pop'));

  // Control menus
  if (op === 'control_create_clone_of') createShadow('CLONE_OPTION', 'control_create_clone_of_menu', 'CLONE_OPTION', getFieldOption(blockDef.fields, 'CLONE_OPTION', '_myself_'));

  // Sensing menus
  if (op === 'sensing_touchingobject') createShadow('TOUCHINGOBJECTMENU', 'sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', getFieldOption(blockDef.fields, 'TOUCHINGOBJECTMENU', '_mouse_'));
  if (op === 'sensing_distanceto') createShadow('DISTANCETOMENU', 'sensing_distancetomenu', 'DISTANCETOMENU', getFieldOption(blockDef.fields, 'DISTANCETOMENU', '_mouse_'));
  if (op === 'sensing_keypressed') createShadow('KEY_OPTION', 'sensing_keyoptions', 'KEY_OPTION', getFieldOption(blockDef.fields, 'KEY_OPTION', 'space'));
  if (op === 'sensing_of') createShadow('OBJECT', 'sensing_of_object_menu', 'OBJECT', getFieldOption(blockDef.fields, 'OBJECT', '_stage_'));

  // Sensing color inputs
  if (op === 'sensing_touchingcolor' && !nextInputs.COLOR) {
    nextInputs.COLOR = [1, [9, '#0000ff']];
  }
  if (op === 'sensing_coloristouchingcolor') {
    if (!nextInputs.COLOR) nextInputs.COLOR = [1, [9, '#0000ff']];
    if (!nextInputs.COLOR2) nextInputs.COLOR2 = [1, [9, '#ff0000']];
  }

  // Music extension menus
  if (op === 'music_setInstrument') createShadow('INSTRUMENT', 'music_menu_INSTRUMENT', 'INSTRUMENT', getFieldOption(blockDef.fields, 'INSTRUMENT', '1'));
  if (op === 'music_playDrumForBeats') createShadow('DRUM', 'music_menu_DRUM', 'DRUM', getFieldOption(blockDef.fields, 'DRUM', '1'));

  // Pen color param menus
  if (op === 'pen_changePenColorParamBy' || op === 'pen_setPenColorParamTo') {
    createShadow('COLOR_PARAM', 'pen_menu_colorParam', 'colorParam', getFieldOption(blockDef.fields, 'COLOR_PARAM', 'color'));
  }

  return {
    inputs: nextInputs,
    fields: nextFields,
    extraBlocks,
    mutation,
    opcodeOverride: op,
  };
};

const variableOpcodes = new Set([
  'data_setvariableto',
  'data_changevariableby',
  'data_showvariable',
  'data_hidevariable',
]);

const listOpcodes = new Set([
  'data_addtolist',
  'data_deleteoflist',
  'data_deletealloflist',
  'data_insertatlist',
  'data_replaceitemoflist',
  'data_itemoflist',
  'data_lengthoflist',
  'data_listcontainsitem',
  'data_showlist',
  'data_hidelist',
]);

const getUniqueDataName = (existingNames: string[], baseName: string) => {
  if (!existingNames.includes(baseName)) return baseName;
  let count = 2;
  while (existingNames.includes(`${baseName}${count}`)) count += 1;
  return `${baseName}${count}`;
};

const ensureDataRefForTarget = (target: ScratchTarget, blockDef: ScratchBlockDef): { target: ScratchTarget; fields: Record<string, unknown> } => {
  const nextTarget: ScratchTarget = {
    ...target,
    variables: { ...(target.variables || {}) },
    lists: { ...(target.lists || {}) },
  };
  const nextFields: Record<string, unknown> = { ...(blockDef.fields || {}) };

  if (variableOpcodes.has(blockDef.opcode)) {
    const vars = nextTarget.variables || {};
    let selectedId = Object.keys(vars)[0];
    if (!selectedId) {
      selectedId = generateId();
      const varName = getUniqueDataName(Object.values(vars).map(([name]) => name), 'my variable');
      vars[selectedId] = [varName, 0];
      nextTarget.variables = vars;
    }
    nextFields.VARIABLE = [vars[selectedId][0], selectedId];
  }

  if (listOpcodes.has(blockDef.opcode)) {
    const lists = nextTarget.lists || {};
    let selectedId = Object.keys(lists)[0];
    if (!selectedId) {
      selectedId = generateId();
      const listName = getUniqueDataName(Object.values(lists).map(([name]) => name), 'my list');
      lists[selectedId] = [listName, []];
      nextTarget.lists = lists;
    }
    nextFields.LIST = [lists[selectedId][0], selectedId];
  }

  return { target: nextTarget, fields: nextFields };
};

const normalizeBlocksForVersion = (
  blocks: Record<string, ScratchBlockNode> | undefined,
  version: ScratchCompatibilityVersion,
): Record<string, ScratchBlockNode> => {
  if (!blocks) return {};
  const nextBlocks: Record<string, ScratchBlockNode> = { ...blocks };
  const unsupportedIds = new Set(
    Object.entries(nextBlocks)
      .filter(([, block]) => !isOpcodeSupportedInVersion(block.opcode, version))
      .map(([id]) => id),
  );
  if (!unsupportedIds.size) return nextBlocks;

  for (const removeId of unsupportedIds) {
    const removed = nextBlocks[removeId];
    if (!removed) continue;
    const parentId = removed.parent || null;
    const nextId = removed.next || null;
    if (parentId && nextBlocks[parentId]) {
      const parent = { ...nextBlocks[parentId] };
      if (parent.next === removeId) parent.next = nextId && !unsupportedIds.has(nextId) ? nextId : null;
      if (parent.inputs) {
        const patchedInputs = { ...parent.inputs };
        Object.entries(patchedInputs).forEach(([key, value]) => {
          if (Array.isArray(value) && value[1] === removeId) patchedInputs[key] = [2, null];
        });
        parent.inputs = patchedInputs;
      }
      nextBlocks[parentId] = parent;
    }
    if (nextId && nextBlocks[nextId] && !unsupportedIds.has(nextId)) {
      nextBlocks[nextId] = { ...nextBlocks[nextId], parent: parentId, topLevel: parentId ? false : true };
    }
    delete nextBlocks[removeId];
  }

  for (const [id, block] of Object.entries(nextBlocks)) {
    const patched: ScratchBlockNode = { ...block };
    if (patched.parent && !nextBlocks[patched.parent]) {
      patched.parent = null;
      patched.topLevel = true;
    }
    if (patched.next && !nextBlocks[patched.next]) patched.next = null;
    if (patched.inputs) {
      const cleanedInputs = { ...patched.inputs };
      Object.entries(cleanedInputs).forEach(([key, value]) => {
        if (Array.isArray(value) && typeof value[1] === 'string' && !nextBlocks[value[1]]) {
          delete cleanedInputs[key];
        }
      });
      patched.inputs = cleanedInputs;
    }
    nextBlocks[id] = patched;
  }

  return nextBlocks;
};

/** Variables category flyout — matches real Scratch editor layout */
const VariablesFlyout = ({
  variables,
  lists,
  blocks,
  color,
  onMakeVariable,
  onMakeList,
  onAddBlock,
  onDeleteVariable,
  onDeleteList,
  onRenameVariable,
  onRenameList,
  onStartFlyoutDrag,
}: {
  variables: [string, [string, ScratchInputPrimitive]][];
  lists: [string, [string, ScratchInputPrimitive[]]][];
  blocks: ScratchBlockDef[];
  color: string;
  onMakeVariable: () => void;
  onMakeList: () => void;
  onAddBlock: (blockDef: ScratchBlockDef) => void;
  onDeleteVariable: (id: string) => void;
  onDeleteList: (id: string) => void;
  onRenameVariable: (id: string, oldName: string) => void;
  onRenameList: (id: string, oldName: string) => void;
  onStartFlyoutDrag: (blockDef: ScratchBlockDef, color: string, e: React.PointerEvent) => void;
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; type: 'variable' | 'list'; id: string; name: string;
    allNames: string[];
  } | null>(null);

  // Track which variable/list is selected for block insertion
  const [selectedVarId, setSelectedVarId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Auto-select first variable/list if none selected
  const activeVarId = selectedVarId && variables.some(([id]) => id === selectedVarId) ? selectedVarId : variables[0]?.[0] || null;
  const activeListId = selectedListId && lists.some(([id]) => id === selectedListId) ? selectedListId : lists[0]?.[0] || null;

  const activeVarName = variables.find(([id]) => id === activeVarId)?.[1]?.[0] || '';
  const activeListName = lists.find(([id]) => id === activeListId)?.[1]?.[0] || '';

  const varBlocks = blocks.filter((b) => !b.opcode.includes('list') && !b.opcode.includes('List'));
  const listBlocks = blocks.filter((b) => b.opcode.includes('list') || b.opcode.includes('List'));

  const varNames = variables.map(([, [name]]) => name);
  const listNames = lists.map(([, [name]]) => name);

  // Replace "my variable" in block labels with the selected variable name
  const resolveVarLabel = (label: string) => {
    if (activeVarName) return label.replace('my variable', activeVarName);
    return label;
  };
  const resolveListLabel = (label: string) => {
    if (activeListName) return label.replace('my list', activeListName);
    return label;
  };

  // Wrap onAddBlock to inject the selected variable/list into the block fields
  const handleAddVarBlock = (blockDef: ScratchBlockDef) => {
    if (activeVarId && activeVarName) {
      const patched = { ...blockDef, fields: { ...blockDef.fields, VARIABLE: [activeVarName, activeVarId] } };
      onAddBlock(patched);
    } else {
      onAddBlock(blockDef);
    }
  };
  const handleAddListBlock = (blockDef: ScratchBlockDef) => {
    if (activeListId && activeListName) {
      const patched = { ...blockDef, fields: { ...blockDef.fields, LIST: [activeListName, activeListId] } };
      onAddBlock(patched);
    } else {
      onAddBlock(blockDef);
    }
  };

  return (
    <div className="space-y-2" onClick={() => setContextMenu(null)}>
      {/* Make a Variable button */}
      <button
        onClick={onMakeVariable}
        className="w-full py-2 rounded-lg text-[14px] font-semibold text-[#575e75] border-2 border-[#d0d0d0] bg-white hover:bg-[#f8f8f8] transition-colors"
      >
        Make a Variable
      </button>

      {/* Variable reporters */}
      {variables.length > 0 && (
        <div className="space-y-1.5 py-1">
          {variables.map(([id, [name]]) => {
            const reporterDef: ScratchBlockDef = {
              label: name,
              opcode: 'data_variable',
              fields: { VARIABLE: [name, id] },
            };
            return (
            <div key={id} className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-[#ff8c1a]" />
              <div
                onPointerDown={(e) => onStartFlyoutDrag(reporterDef, color, e)}
                className="cursor-grab active:cursor-grabbing"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'variable', id, name, allNames: varNames });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu((prev) =>
                    prev?.id === id ? null : { x: e.clientX, y: e.clientY, type: 'variable', id, name, allNames: varNames }
                  );
                }}
              >
                <ScratchBlockShape label={name} color={color} shape="reporter" width={Math.max(80, name.length * 8 + 30)} />
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Variable selector + blocks */}
      {variables.length > 0 && (
        <div className="space-y-1.5">
          {variables.length > 1 && (
            <select
              value={activeVarId || ''}
              onChange={(e) => setSelectedVarId(e.target.value)}
              className="w-full rounded-lg border-2 border-[#ff8c1a] bg-white px-2 py-1.5 text-[13px] text-[#575e75] font-semibold outline-none cursor-pointer"
            >
              {variables.map(([id, [name]]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
          {varBlocks.map((blockDef) => {
            const shape = getBlockShape(blockDef.opcode);
            const patched = activeVarId && activeVarName
              ? { ...blockDef, fields: { ...blockDef.fields, VARIABLE: [activeVarName, activeVarId] } }
              : blockDef;
            return (
              <div
                key={blockDef.label}
                onPointerDown={(e) => onStartFlyoutDrag(patched, color, e)}
                onClick={() => handleAddVarBlock(blockDef)}
                className="cursor-grab active:cursor-grabbing hover:brightness-110 transition-all"
              >
                <ScratchBlockShape label={resolveVarLabel(blockDef.label)} color={color} shape={shape} />
              </div>
            );
          })}
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-[#e0e0e0] my-2" />

      {/* Make a List button */}
      <button
        onClick={onMakeList}
        className="w-full py-2 rounded-lg text-[14px] font-semibold text-[#575e75] border-2 border-[#d0d0d0] bg-white hover:bg-[#f8f8f8] transition-colors"
      >
        Make a List
      </button>

      {/* List reporters */}
      {lists.length > 0 && (
        <div className="space-y-1.5 py-1">
          {lists.map(([id, [name]]) => {
            const listReporterDef: ScratchBlockDef = {
              label: name,
              opcode: 'data_listcontents',
              fields: { LIST: [name, id] },
            };
            return (
            <div key={id} className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-[#e6832a]" />
              <div
                onPointerDown={(e) => onStartFlyoutDrag(listReporterDef, '#e6832a', e)}
                className="cursor-grab active:cursor-grabbing"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, type: 'list', id, name, allNames: listNames });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu((prev) =>
                    prev?.id === id ? null : { x: e.clientX, y: e.clientY, type: 'list', id, name, allNames: listNames }
                  );
                }}
              >
                <ScratchBlockShape label={name} color="#e6832a" shape="reporter" width={Math.max(80, name.length * 8 + 30)} />
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* List selector + blocks */}
      {lists.length > 0 && (
        <div className="space-y-1.5">
          {lists.length > 1 && (
            <select
              value={activeListId || ''}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="w-full rounded-lg border-2 border-[#e6832a] bg-white px-2 py-1.5 text-[13px] text-[#575e75] font-semibold outline-none cursor-pointer"
            >
              {lists.map(([id, [name]]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
          {listBlocks.map((blockDef) => {
            const shape = getBlockShape(blockDef.opcode);
            const patched = activeListId && activeListName
              ? { ...blockDef, fields: { ...blockDef.fields, LIST: [activeListName, activeListId] } }
              : blockDef;
            return (
              <div
                key={blockDef.label}
                onPointerDown={(e) => onStartFlyoutDrag(patched, '#e6832a', e)}
                onClick={() => handleAddListBlock(blockDef)}
                className="cursor-grab active:cursor-grabbing hover:brightness-110 transition-all"
              >
                <ScratchBlockShape label={resolveListLabel(blockDef.label)} color="#e6832a" shape={shape} />
              </div>
            );
          })}
        </div>
      )}

      {/* Context menu for variable/list reporters */}
      {contextMenu && (
        <div
          className="fixed z-[100] rounded-lg shadow-xl border border-[#d0d0d0] bg-[#ffd948] py-2 min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* List all items of this type with a checkmark on the selected one */}
          {contextMenu.allNames.map((n) => (
            <div
              key={n}
              className="px-4 py-1.5 text-[13px] font-bold text-white hover:bg-[#eec530] cursor-pointer flex items-center gap-2"
            >
              {n === contextMenu.name && <span>✓</span>}
              <span className={n === contextMenu.name ? '' : 'ml-5'}>{n}</span>
            </div>
          ))}
          <div className="border-t border-[#eec530] my-1" />
          <button
            onClick={() => {
              contextMenu.type === 'variable'
                ? onRenameVariable(contextMenu.id, contextMenu.name)
                : onRenameList(contextMenu.id, contextMenu.name);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-1.5 text-[13px] font-bold text-white hover:bg-[#eec530]"
          >
            Rename {contextMenu.type}
          </button>
          <button
            onClick={() => {
              contextMenu.type === 'variable'
                ? onDeleteVariable(contextMenu.id)
                : onDeleteList(contextMenu.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-1.5 text-[13px] font-bold text-white hover:bg-[#eec530]"
          >
            Delete the "{contextMenu.name}" {contextMenu.type}
          </button>
        </div>
      )}
    </div>
  );
};

export const ScratchPanel = ({ archive, onArchiveChange, onProjectJsonUpdate, isRunning, onRun, onStop }: ScratchPanelProps) => {
  const [activeEditorTab, setActiveEditorTab] = useState<'code' | 'costumes' | 'sounds'>('code');
  const [activeCategory, setActiveCategory] = useState('Motion');
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(1);
  const [projectJsonDraft, setProjectJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [stagePreview, setStagePreview] = useState({ x: 0, y: 0, direction: 90, visible: true, size: 100 });
  const [spriteVisible, setSpriteVisible] = useState(true);
  const [workspaceZoom, setWorkspaceZoom] = useState(1);
  const [vmReady, setVmReady] = useState(false);
  const [leftPaneWidth, setLeftPaneWidth] = useState(340);
  const [rightPaneWidth, setRightPaneWidth] = useState(480);
  const [activeResize, setActiveResize] = useState<'left' | 'right' | null>(null);

  // Pointer-based drag state for smooth block dragging
  const dragRef = useRef<{
    blockId: string;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    originalBlock: ScratchBlockNode;
    detached: boolean;
  } | null>(null);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  // Pointer-based flyout drag (replaces failed HTML5 dataTransfer approach).
  // Tracks a block definition being dragged from the flyout/palette into the workspace.
  const [flyoutDrag, setFlyoutDrag] = useState<{
    blockDef: ScratchBlockDef;
    color: string;
    ghostX: number;
    ghostY: number;
  } | null>(null);
  const flyoutDragRef = useRef<{ blockDef: ScratchBlockDef; color: string; startX: number; startY: number } | null>(null);
  const suppressFlyoutClickRef = useRef(false);
  // Used to disable shadow input pointer-events so drops land on the slot, not the input overlay.
  const isHtml5Dragging = flyoutDrag !== null;
  const [snapPreview, setSnapPreview] = useState<{ id: string; type: 'next' | 'substack'; x: number; y: number } | null>(null);
  // Per-block input slot rects (in block-local SVG coords). Populated by ScratchBlockShape onSlots.
  const slotsRegistryRef = useRef<Map<string, { type: 'reporter' | 'boolean'; index: number; x: number; y: number; width: number; height: number }[]>>(new Map());
  const [slotsTick, setSlotsTick] = useState(0);
  const [inputDropTarget, setInputDropTarget] = useState<{ blockId: string; inputKey: string; type: 'reporter' | 'boolean'; x: number; y: number; width: number; height: number } | null>(null);
  // Mirror of inputDropTarget used inside pointer-up handlers to avoid stale-closure misses.
  const inputDropTargetRef = useRef<typeof inputDropTarget>(null);
  const [editingShadow, setEditingShadow] = useState<{ blockId: string; inputKey: string } | null>(null);
  const [blockContextMenu, setBlockContextMenu] = useState<{ blockId: string; x: number; y: number } | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [vmError, setVmError] = useState<string | null>(null);
  const [scratchVersion, setScratchVersion] = useState<ScratchCompatibilityVersion>('scratch3');
  const [unsupportedVersionPrompt, setUnsupportedVersionPrompt] = useState<{
    version: ScratchCompatibilityVersion;
    source: 'toggle' | 'import';
    fileName?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [dataPrompt, setDataPrompt] = useState<{ type: 'variable' | 'list'; name: string } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState<LibraryMode | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ type: 'variable' | 'list'; id: string; oldName: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const costumeInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const backdropInputRef = useRef<HTMLInputElement>(null);
  const vmRef = useRef<ScratchVmLike | null>(null);
  const rendererRef = useRef<{ draw(): void; destroy(): void } | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const archiveRef = useRef<ScratchArchive | null>(archive);
  const storageReadyRef = useRef(false);
  const projectLoadedRef = useRef(false);
  const isRunningRef = useRef(isRunning);

  // Keep archiveRef in sync for the storage adapter closure
  useEffect(() => {
    archiveRef.current = archive;
  }, [archive]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    if (!activeResize) return;
    const handlePointerMove = (event: PointerEvent) => {
      const viewportWidth = window.innerWidth;
      if (activeResize === 'left') {
        setLeftPaneWidth(Math.max(260, Math.min(520, event.clientX)));
      } else {
        const nextWidth = viewportWidth - event.clientX;
        setRightPaneWidth(Math.max(320, Math.min(700, nextWidth)));
      }
    };
    const stopResize = () => setActiveResize(null);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
    };
  }, [activeResize]);

  const project = useMemo(() => safeParseProject(archive), [archive]);
  const selectedTarget = project.targets[Math.max(0, Math.min(project.targets.length - 1, selectedTargetIndex))];
  const selectedBlocks = Object.values(selectedTarget?.blocks || {});
  const spriteTargets = project.targets.filter((target) => !target.isStage);
  const stageTarget = project.targets.find((t) => t.isStage);
  const stageBackdrops = stageTarget?.costumes || [];
  const stageCurrentBackdrop = Number(stageTarget?.currentCostume || 0);
  const blockLabels = useMemo(() => {
   const map: Record<string, string> = {};
    Object.values(categoryBlocks).forEach((defs) => defs.forEach((d) => { map[d.opcode] = d.label; }));
    return map;
  }, []);
  const visibleCategoryNames = useMemo(
    () => Object.keys(categoryBlocks).filter(
      (name) => name === 'My Blocks' || categoryBlocks[name].some((def) => isBlockDefAvailable(def, scratchVersion)),
    ),
    [scratchVersion],
  );
  const visibleCategoryBlocks = useMemo(() => {
    const entries = Object.entries(categoryBlocks).map(([name, defs]) => [
      name,
      defs.filter((def) => isBlockDefAvailable(def, scratchVersion)),
    ]);
    return Object.fromEntries(entries) as Record<string, ScratchBlockDef[]>;
  }, [scratchVersion]);
  const allCategoryRail = useMemo(
    () => getCategoryRail(scratchVersion),
    [scratchVersion],
  );
  const visibleCategoryRail = useMemo(
    () => allCategoryRail.filter((cat) => visibleCategoryNames.includes(cat.name)),
    [allCategoryRail, visibleCategoryNames],
  );
  const currentCategoryColors = useMemo(
    () => getCategoryColors(scratchVersion),
    [scratchVersion],
  );
  const guiColors = useMemo(
    () => getGUIColors(scratchVersion),
    [scratchVersion],
  );

  // Custom procedures (My Blocks): derived from procedures_prototype mutations
  // anywhere in the project so the same custom blocks are available across sprites.
  const customProcedures = useMemo(() => {
    const seen = new Map<string, { proccode: string; args: ProcArg[]; warp: boolean }>();
    project.targets.forEach((t) => {
      Object.values(t.blocks || {}).forEach((b) => {
        const node = b as {
          opcode?: string;
          mutation?: { proccode?: string; argumentnames?: string; argumentids?: string; warp?: string };
        };
        if (node?.opcode === 'procedures_prototype' && node.mutation?.proccode) {
          const pc = node.mutation.proccode;
          if (seen.has(pc)) return;
          let names: string[] = [];
          let ids: string[] = [];
          try { names = JSON.parse(node.mutation.argumentnames || '[]'); } catch { /* noop */ }
          try { ids = JSON.parse(node.mutation.argumentids || '[]'); } catch { /* noop */ }
          // Walk proccode tokens to recover %s/%b order + label tokens
          const tokens = pc.split(/(\s+)/).filter((s) => s.trim().length > 0);
          const args: ProcArg[] = [];
          let valueIdx = 0;
          // Skip the leading name tokens until we hit first %s/%b; tokens before that form the name
          let nameOver = false;
          tokens.forEach((tok) => {
            if (tok === '%s' || tok === '%b') {
              nameOver = true;
              args.push({
                type: tok === '%b' ? 'boolean' : 'string_number',
                name: names[valueIdx] || `arg${valueIdx + 1}`,
                id: ids[valueIdx],
              });
              valueIdx++;
            } else if (nameOver) {
              args.push({ type: 'label', name: tok });
            }
          });
          seen.set(pc, { proccode: pc, args, warp: node.mutation.warp === 'true' });
        }
      });
    });
    return Array.from(seen.values());
  }, [project]);

  const [makeBlockModal, setMakeBlockModal] = useState<{
    name: string;
    runWithoutRefresh: boolean;
    args: ProcArg[];
  } | null>(null);
  const [fieldPicker, setFieldPicker] = useState<{ blockId: string; menuBlockId: string; fieldKey: string; options: DropdownOption[]; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!visibleCategoryNames.includes(activeCategory) && visibleCategoryNames.length > 0) {
      setActiveCategory(visibleCategoryNames[0]);
    }
  }, [activeCategory, visibleCategoryNames]);

  useEffect(() => {
    setScratchVersion(semverToScratchVersion(project.meta?.semver));
  }, [project.meta?.semver]);

  const imgMime = (fmt: string | undefined) => {
    const f = fmt || 'png';
    return f === 'svg' ? 'image/svg+xml' : `image/${f}`;
  };

  const selectedCostumes = selectedTarget?.costumes || [];
  const selectedSounds = selectedTarget?.sounds || [];
  const currentCostumeIndex = Number(selectedTarget?.currentCostume || 0);
  const activeCostume = selectedCostumes[currentCostumeIndex] || selectedCostumes[0];
  const stageCostumeSrc = activeCostume && archive?.files?.[activeCostume.md5ext]
    ? `data:${imgMime(activeCostume.dataFormat)};base64,${archive.files[activeCostume.md5ext]}`
    : null;

  const syncFromVm = useCallback(() => {
    const vm = vmRef.current;
    if (!vm || !vm.runtime) return;
    const preferredName = selectedTarget?.name;
    const runtimeTarget = vm.runtime.targets?.find((t) => !t.isStage && t.sprite?.name === preferredName)
      || vm.runtime.targets?.find((t) => !t.isStage);
    if (!runtimeTarget) return;

    const x = Number(runtimeTarget.x || 0);
    const y = Number(runtimeTarget.y || 0);
    const direction = Number(runtimeTarget.direction || 90);
    const visible = runtimeTarget.visible !== false;

    setStagePreview({
      x,
      y,
      direction,
      visible,
      size: 100,
    });
    setSpriteVisible(visible);
  }, [selectedTarget?.name]);

  const loadVmFromArchive = useCallback(async (nextArchive: ScratchArchive, version: ScratchCompatibilityVersion = scratchVersion) => {
    if (!vmRef.current) return;
    try {
      const normalizedArchive = ensureArchive(nextArchive);
      console.log('[Scratch] loadVmFromArchive — files:', Object.keys(normalizedArchive.files).length, 'fileNames:', normalizedArchive.fileNames, 'version:', version);

      if (version === 'scratch2') {
        const project = safeParseProject(normalizedArchive);
        const legacyProject = {
          ...project,
          projectVersion: 2,
          meta: {
            ...(project.meta || {}),
            semver: '2.0.0',
          },
        };
        console.log('[Scratch] Loading Scratch 2 project into VM from JSON');
        await vmRef.current.loadProject(legacyProject);
      } else {
        const data = await exportScratchArchive(normalizedArchive, version === 'scratch3' ? 'sb3' : 'sb2');
        const ab = data.buffer instanceof ArrayBuffer
          ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
          : data.slice().buffer;
        console.log('[Scratch] Loading project into VM, size:', ab.byteLength);
        await vmRef.current.loadProject(ab);
      }

      projectLoadedRef.current = true;
      console.log('[Scratch] Project loaded successfully, targets:', vmRef.current.runtime?.targets?.length);
      setVmError(null);
      syncFromVm();
    } catch (error) {
      projectLoadedRef.current = false;
      console.warn('scratch-vm loadProject warning:', error);
      setVmError(error instanceof Error ? error.message : 'Failed to load Scratch project');
    }
  }, [scratchVersion, syncFromVm]);

  // Initialize VM with renderer, storage, and audio engine (dynamic imports)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let useWebGLRenderer = false;

    // Create a separate offscreen canvas for 2D fallback drawing
    // (scratch-render claims the main canvas as WebGL, so getContext('2d') would return null)
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = canvas.width;
    fallbackCanvas.height = canvas.height;

    const initVm = async () => {
      try {
        const VmCtor = VirtualMachine as unknown as { new (): ScratchVmLike };
        const vm = new VmCtor();

        projectLoadedRef.current = false;

        // Attach storage first; renderer depends on successful project asset resolution
        try {
          storageReadyRef.current = false;
          const storageMod = await import('scratch-storage');
          const resolveStorageCtor = (mod: any): ((new () => any) | null) => {
            const candidates = [
              mod?.default?.default,
              mod?.default,
              mod?.ScratchStorage,
              mod?.default?.ScratchStorage,
              mod,
            ];
            for (const candidate of candidates) {
              if (typeof candidate === 'function') return candidate as new () => any;
            }
            return null;
          };

          const StorageCtor = resolveStorageCtor(storageMod);
          console.log('[Scratch] scratch-storage exports:', Object.keys(storageMod || {}));

          if (!StorageCtor) {
            throw new Error('scratch-storage constructor not found');
          }

          const storage = new StorageCtor();

          const AssetType = storage.AssetType;
          storage.addWebStore(
            [AssetType.ImageVector, AssetType.ImageBitmap, AssetType.Sound],
            (asset: { assetId: string; dataFormat: string }) => {
              const key = `${asset.assetId}.${asset.dataFormat}`;
              const b64 = archiveRef.current?.files?.[key];
              if (b64) {
                return `data:application/octet-stream;base64,${b64}`;
              }
              return `https://assets.scratch.mit.edu/internalapi/asset/${key}/get/`;
            }
          );

          vm.attachStorage(storage);
          storageReadyRef.current = true;
          console.log('[Scratch] scratch-storage attached successfully');
        } catch (e) {
          storageReadyRef.current = false;
          setVmError('Storage initialization failed');
          console.warn('scratch-storage not available:', e);
        }

        // Attach scratch-render when available so the VM can load costumes and execute
        // renderer-dependent blocks correctly. Keep the 2D fallback as a safety net.
        try {
          const renderMod = await import('scratch-render');
          const RenderCtor = renderMod.default || renderMod;
          if (typeof RenderCtor === 'function') {
            const renderer = new RenderCtor(canvas);
            vm.attachRenderer(renderer);
            rendererRef.current = renderer as { draw(): void; destroy(): void };
            useWebGLRenderer = true;
            console.log('[Scratch] scratch-render attached successfully');
          } else {
            console.warn('[Scratch] scratch-render constructor not found; using fallback renderer');
            useWebGLRenderer = false;
          }
        } catch (e) {
          console.warn('scratch-render not available:', e);
          useWebGLRenderer = false;
        }

        // Dynamically import and attach audio engine
        let audioReady = false;
        try {
          const audioMod = await import('scratch-audio');
          const AudioCtor = audioMod.default || audioMod;
          if (typeof AudioCtor === 'function') {
            try {
              const audioEngine = new AudioCtor();
              vm.attachAudioEngine(audioEngine);
              audioReady = true;
            } catch (audioError) {
              console.warn('scratch-audio initialization failed:', audioError);
            }
          }
        } catch (e) {
          console.warn('scratch-audio not available:', e);
        }

        if (cancelled) return;

        vm.start();
        vmRef.current = vm;

        // Load built-in extensions (pen, music)
        try {
          const em = (vm as any).extensionManager;
          if (em?.loadExtensionIdSync) {
            em.loadExtensionIdSync('pen');
            if (audioReady) {
              em.loadExtensionIdSync('music');
            }
          } else if (em?.loadExtensionURL) {
            em.loadExtensionURL('pen').catch(() => {});
            if (audioReady) {
              em.loadExtensionURL('music').catch(() => {});
            }
          }
          console.log('[Scratch] Extensions loaded');
        } catch (e) {
          console.warn('[Scratch] Extension loading:', e);
        }

        // Handle "ask and wait" blocks — VM emits QUESTION, waits for ANSWER
        const rt = vm.runtime as any;
        rt?.on?.('QUESTION', (question: string) => {
          if (!isRunningRef.current) return;
          const promptText = typeof question === 'string' ? question.trim() : '';
          if (!promptText) return;
          const answer = window.prompt(promptText) || '';
          rt?.emit?.('ANSWER', answer);
        });

        setVmReady(true);
        if (!storageReadyRef.current) {
          setVmError('Storage unavailable; running in 2D fallback mode.');
        }
        console.log('[Scratch] VM started, useWebGLRenderer:', useWebGLRenderer);

        // Start draw loop
        let rendererProducedOutput = false;
        let frameCount = 0;
        const drawStep = () => {
          frameCount++;
          rendererProducedOutput = false;
          if (useWebGLRenderer && rendererRef.current && projectLoadedRef.current) {
            try {
              rendererRef.current.draw();
              rendererProducedOutput = true;
            } catch (e) {
              if (frameCount < 5) console.warn('[Scratch] renderer.draw() error:', e);
              rendererProducedOutput = false;
            }
          }

          // If WebGL renderer isn't working, use 2D fallback on a separate canvas
          // then copy to the main canvas
          if (!rendererProducedOutput) {
            const ctx2d = fallbackCanvas.getContext('2d');
            if (ctx2d) {
              drawFallbackStage(ctx2d, fallbackCanvas.width, fallbackCanvas.height, archiveRef.current, vmRef.current);
              // Copy fallback to the visible canvas (which may not have a 2D context)
              const mainCtx = canvas.getContext('2d');
              if (mainCtx) {
                mainCtx.drawImage(fallbackCanvas, 0, 0);
              }
            }
          }

          syncFromVm();
          rafRef.current = requestAnimationFrame(drawStep);
        };
        rafRef.current = requestAnimationFrame(drawStep);
      } catch (error) {
        console.error('[Scratch] VM init failed:', error);
        if (!cancelled) {
          setVmError(error instanceof Error ? error.message : 'Failed to initialize scratch-vm.');
        }
      }
    };

    initVm();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      try {
        vmRef.current?.stopAll();
      } catch { /* noop */ }
      try {
        rendererRef.current?.destroy();
      } catch { /* noop */ }
      rendererRef.current = null;
      vmRef.current = null;
      projectLoadedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!archive || !vmReady) return;
    loadVmFromArchive(archive);
  }, [archive, vmReady, loadVmFromArchive]);

  // Sync with parent isRunning state (e.g. header Run/Stop button)
  const prevIsRunning = useRef(isRunning);
  useEffect(() => {
    if (!vmReady || !vmRef.current) {
      prevIsRunning.current = isRunning;
      return;
    }
    if (isRunning && !prevIsRunning.current) {
      // Parent triggered run (header button) — start VM
      try {
        if (!projectLoadedRef.current) {
          setVmError('Project not loaded yet. Please press Run again.');
          onStop();
          return;
        }
        vmRef.current.greenFlag();
        setTimeout(() => syncFromVm(), 120);
      } catch (error) {
        setVmError(error instanceof Error ? error.message : 'VM runtime error.');
        onStop();
      }
    } else if (!isRunning && prevIsRunning.current) {
      // Parent triggered stop — stop VM
      try {
        vmRef.current.stopAll();
        syncFromVm();
      } catch { /* noop */ }
    }
    prevIsRunning.current = isRunning;
  }, [isRunning, vmReady, syncFromVm, onStop]);

  const updateProject = (updater: (current: ScratchProject) => ScratchProject) => {
    const nextProject = updater(project);
    const nextJson = formatJson(nextProject);
    const currentArchive = ensureArchive(archive);

    const nextArchive: ScratchArchive = {
      ...currentArchive,
      fileNames: currentArchive.fileNames.includes('project.json')
        ? currentArchive.fileNames
        : [...currentArchive.fileNames, 'project.json'],
      projectJson: nextJson,
    };

    onArchiveChange(nextArchive);
    onProjectJsonUpdate(nextJson);
    setProjectJsonDraft(nextJson);
    setJsonError(null);
  };

  const updateArchiveWithProject = async (
    projectUpdater: (current: ScratchProject) => ScratchProject,
    archiveUpdater?: (current: ScratchArchive) => ScratchArchive,
  ) => {
    const currentArchive = ensureArchive(archive);
    const currentProject = safeParseProject(currentArchive);
    const nextProject = projectUpdater(currentProject);
    const nextJson = formatJson(nextProject);
    const withProject: ScratchArchive = {
      ...currentArchive,
      fileNames: currentArchive.fileNames.includes('project.json')
        ? currentArchive.fileNames
        : [...currentArchive.fileNames, 'project.json'],
      projectJson: nextJson,
    };
    const nextArchive = archiveUpdater ? archiveUpdater(withProject) : withProject;
    onArchiveChange(nextArchive);
    onProjectJsonUpdate(nextJson);
    setProjectJsonDraft(nextJson);
    setJsonError(null);
    await loadVmFromArchive(nextArchive);
  };

  const setCurrentCostume = (index: number) => {
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => (idx === selectedTargetIndex ? { ...target, currentCostume: index } : target)),
    }));
  };

  const addCostume = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const assetId = `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
    const dataFormat = extensionOf(file.name) || 'png';
    const md5ext = `${assetId}.${dataFormat}`;
    const base64 = bytesToBase64(bytes);

    await updateArchiveWithProject(
      (current) => ({
        ...current,
        targets: current.targets.map((target, idx) => {
          if (idx !== selectedTargetIndex) return target;
          const costumes = target.costumes || [];
          return {
            ...target,
            costumes: [...costumes, { name: file.name.replace(/\.[^/.]+$/, ''), assetId, md5ext, dataFormat, rotationCenterX: 48, rotationCenterY: 48 }],
            currentCostume: costumes.length,
          };
        }),
      }),
      (currentArchive) => ({
        ...currentArchive,
        files: { ...currentArchive.files, [md5ext]: base64 },
        fileNames: currentArchive.fileNames.includes(md5ext) ? currentArchive.fileNames : [...currentArchive.fileNames, md5ext],
      }),
    );
  };

  const addBackdrop = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const assetId = `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
    const dataFormat = extensionOf(file.name) || 'png';
    const md5ext = `${assetId}.${dataFormat}`;
    const base64 = bytesToBase64(bytes);

    await updateArchiveWithProject(
      (current) => ({
        ...current,
        targets: current.targets.map((target) => {
          if (!target.isStage) return target;
          const costumes = target.costumes || [];
          return {
            ...target,
            costumes: [...costumes, { name: file.name.replace(/\.[^/.]+$/, ''), assetId, md5ext, dataFormat, rotationCenterX: 240, rotationCenterY: 180 }],
            currentCostume: costumes.length,
          };
        }),
      }),
      (currentArchive) => ({
        ...currentArchive,
        files: { ...currentArchive.files, [md5ext]: base64 },
        fileNames: currentArchive.fileNames.includes(md5ext) ? currentArchive.fileNames : [...currentArchive.fileNames, md5ext],
      }),
    );
  };

  const setStageBackdrop = (index: number) => {
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target) => target.isStage ? { ...target, currentCostume: index } : target),
    }));
  };

  const addSound = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const assetId = `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`;
    const dataFormat = extensionOf(file.name) || 'wav';
    const md5ext = `${assetId}.${dataFormat}`;
    const base64 = bytesToBase64(bytes);

    await updateArchiveWithProject(
      (current) => ({
        ...current,
        targets: current.targets.map((target, idx) => {
          if (idx !== selectedTargetIndex) return target;
          const sounds = target.sounds || [];
          return {
            ...target,
            sounds: [...sounds, { name: file.name.replace(/\.[^/.]+$/, ''), assetId, md5ext, dataFormat, rate: 44100, sampleCount: 0 }],
          };
        }),
      }),
      (currentArchive) => ({
        ...currentArchive,
        files: { ...currentArchive.files, [md5ext]: base64 },
        fileNames: currentArchive.fileNames.includes(md5ext) ? currentArchive.fileNames : [...currentArchive.fileNames, md5ext],
      }),
    );
  };

  const addLibraryAsset = async (asset: ScratchLibraryAsset) => {
    // Fetch the asset from the Scratch CDN
    try {
      const resp = await fetch(assetUrl(asset.md5ext));
      if (!resp.ok) throw new Error('Failed to fetch asset');
      const bytes = new Uint8Array(await resp.arrayBuffer());
      const base64 = bytesToBase64(bytes);

      if (libraryOpen === 'sounds') {
        await updateArchiveWithProject(
          (current) => ({
            ...current,
            targets: current.targets.map((target, idx) => {
              if (idx !== selectedTargetIndex) return target;
              const sounds = target.sounds || [];
              return {
                ...target,
                sounds: [...sounds, {
                  name: asset.name,
                  assetId: asset.assetId,
                  md5ext: asset.md5ext,
                  dataFormat: asset.dataFormat,
                  rate: asset.rate || 44100,
                  sampleCount: asset.sampleCount || 0,
                }],
              };
            }),
          }),
          (currentArchive) => ({
            ...currentArchive,
            files: { ...currentArchive.files, [asset.md5ext]: base64 },
            fileNames: currentArchive.fileNames.includes(asset.md5ext) ? currentArchive.fileNames : [...currentArchive.fileNames, asset.md5ext],
          }),
        );
      } else if (libraryOpen === 'backdrops') {
        await updateArchiveWithProject(
          (current) => ({
            ...current,
            targets: current.targets.map((target) => {
              if (!target.isStage) return target;
              const costumes = target.costumes || [];
              return {
                ...target,
                costumes: [...costumes, {
                  name: asset.name,
                  assetId: asset.assetId,
                  md5ext: asset.md5ext,
                  dataFormat: asset.dataFormat,
                  rotationCenterX: asset.rotationCenterX || 240,
                  rotationCenterY: asset.rotationCenterY || 180,
                }],
                currentCostume: costumes.length,
              };
            }),
          }),
          (currentArchive) => ({
            ...currentArchive,
            files: { ...currentArchive.files, [asset.md5ext]: base64 },
            fileNames: currentArchive.fileNames.includes(asset.md5ext) ? currentArchive.fileNames : [...currentArchive.fileNames, asset.md5ext],
          }),
        );
      } else {
        // costumes
        await updateArchiveWithProject(
          (current) => ({
            ...current,
            targets: current.targets.map((target, idx) => {
              if (idx !== selectedTargetIndex) return target;
              const costumes = target.costumes || [];
              return {
                ...target,
                costumes: [...costumes, {
                  name: asset.name,
                  assetId: asset.assetId,
                  md5ext: asset.md5ext,
                  dataFormat: asset.dataFormat,
                  rotationCenterX: asset.rotationCenterX || 48,
                  rotationCenterY: asset.rotationCenterY || 48,
                }],
                currentCostume: costumes.length,
              };
            }),
          }),
          (currentArchive) => ({
            ...currentArchive,
            files: { ...currentArchive.files, [asset.md5ext]: base64 },
            fileNames: currentArchive.fileNames.includes(asset.md5ext) ? currentArchive.fileNames : [...currentArchive.fileNames, asset.md5ext],
          }),
        );
      }
    } catch (e) {
      console.warn('Failed to add library asset:', e);
    }
    setLibraryOpen(null);
  };

  const addSprite = () => {
    const existing = new Set(project.targets.map((t) => t.name));
    let i = 1;
    let name = `Sprite${i}`;
    while (existing.has(name)) {
      i += 1;
      name = `Sprite${i}`;
    }

    updateProject((current) => ({
      ...current,
      targets: [
        ...current.targets,
        {
          isStage: false,
          name,
          variables: {},
          lists: {},
          blocks: {},
          costumes: [],
          sounds: [],
          visible: true,
          x: 0,
          y: 0,
          size: 100,
          direction: 90,
        },
      ],
    }));

    setSelectedTargetIndex(project.targets.length);
  };

  // Visual heights MUST match ScratchBlockShape.tsx (STACK_H=32, hat = STACK_H + HAT_CURVE = 52)
  const SNAP_DISTANCE = 28;
  const STACK_BLOCK_HEIGHT = 32;
  const HAT_BLOCK_HEIGHT = 52;
  const C_BLOCK_INDENT = 16;
  const C_BLOCK_MOUTH_HEIGHT = 24;
  // Default fallback for placement spacing
  const BLOCK_HEIGHT = STACK_BLOCK_HEIGHT;

  const cBlockOpcodes = new Set([
    'control_forever', 'control_repeat', 'control_if', 'control_if_else',
    'control_repeat_until', 'control_wait_until',
  ]);

  // Returns the visual height of a single block (not including its children)
  const getBlockOwnHeight = (block: ScratchBlockNode) => {
    if (isEventBlock(block.opcode) || block.opcode === 'procedures_definition' || block.opcode === 'control_start_as_clone') {
      return HAT_BLOCK_HEIGHT;
    }
    return STACK_BLOCK_HEIGHT;
  };

  type SnapResult = { id: string; type: 'next' | 'substack' } | null;

  const getStackLength = (blocks: Record<string, ScratchBlockNode>, startId: string) => {
    let count = 1;
    let current = blocks[startId];
    while (current?.next && blocks[current.next]) {
      current = blocks[current.next];
      count += 1;
    }
    return count;
  };

  const getStackTailId = (blocks: Record<string, ScratchBlockNode>, startId: string) => {
    let tailId = startId;
    let current = blocks[startId];
    while (current?.next && blocks[current.next]) {
      tailId = current.next;
      current = blocks[current.next];
    }
    return tailId;
  };

  const getNextSnapY = (blocks: Record<string, ScratchBlockNode>, block: ScratchBlockNode) => {
    const by = block.y ?? 0;
    const ownH = getBlockOwnHeight(block);
    if (!cBlockOpcodes.has(block.opcode)) return by + ownH;
    const substackInput = block.inputs?.SUBSTACK as unknown[];
    const substackRoot = typeof substackInput?.[1] === 'string' ? substackInput[1] : null;
    const substackLen = substackRoot && blocks[substackRoot] ? getStackLength(blocks, substackRoot) : 1;
    return by + ownH + C_BLOCK_MOUTH_HEIGHT + substackLen * STACK_BLOCK_HEIGHT;
  };

  const getSnapPosition = (blocks: Record<string, ScratchBlockNode>, parent: ScratchBlockNode, type: 'next' | 'substack') => ({
    x: type === 'substack' ? (parent.x ?? 0) + C_BLOCK_INDENT : (parent.x ?? 0),
    y: type === 'substack' ? (parent.y ?? 0) + getBlockOwnHeight(parent) : getNextSnapY(blocks, parent),
  });

  const findSnapTarget = (blocks: Record<string, ScratchBlockNode>, dropX: number, dropY: number, excludeId?: string): SnapResult => {
    let best: { id: string; type: 'next' | 'substack'; score: number } | null = null;

    for (const [id, block] of Object.entries(blocks)) {
      if (id === excludeId) continue;
      const bx = block.x ?? 0;
      const by = block.y ?? 0;

      if (cBlockOpcodes.has(block.opcode)) {
        const substackInput = block.inputs?.SUBSTACK as unknown[];
        const substackRoot = typeof substackInput?.[1] === 'string' ? substackInput[1] : null;
        const mouthX = bx + C_BLOCK_INDENT;
        const mouthY = by + BLOCK_HEIGHT;
        const dx = Math.abs(dropX - mouthX);
        const dy = Math.abs(dropY - mouthY);

        // Prefer dropping INSIDE the loop when pointer is near loop mouth/body.
        if (dx < 90 && dy < SNAP_DISTANCE * 1.3) {
          if (substackRoot && blocks[substackRoot]) {
            const tailId = getStackTailId(blocks, substackRoot);
            const tail = blocks[tailId];
            const nextY = getNextSnapY(blocks, tail);
            const score = Math.abs(dropX - (tail.x ?? 0)) + Math.abs(dropY - nextY);
            if (!best || score < best.score) best = { id: tailId, type: 'next', score };
          } else {
            const score = dx + dy;
            if (!best || score < best.score) best = { id, type: 'substack', score };
          }
        }
      }

      if (!block.next) {
        const nextY = getNextSnapY(blocks, block);
        const dx = Math.abs(dropX - bx);
        const dy = Math.abs(dropY - nextY);
        if (dx < 84 && dy < SNAP_DISTANCE) {
          const score = dx + dy;
          if (!best || score < best.score) best = { id, type: 'next', score };
        }
      }
    }

    return best ? { id: best.id, type: best.type } : null;
  };

  const createVariable = (name: string) => {
    if (!selectedTarget || selectedTarget.isStage) return;
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const vars = { ...(target.variables || {}) };
        const id = generateId();
        vars[id] = [name, 0];
        return { ...target, variables: vars };
      }),
    }));
  };

  const createList = (name: string) => {
    if (!selectedTarget || selectedTarget.isStage) return;
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const lists = { ...(target.lists || {}) };
        const id = generateId();
        lists[id] = [name, []];
        return { ...target, lists };
      }),
    }));
  };

  const deleteVariable = (id: string) => {
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const vars = { ...(target.variables || {}) };
        delete vars[id];
        return { ...target, variables: vars };
      }),
    }));
  };

  const deleteList = (id: string) => {
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const l = { ...(target.lists || {}) };
        delete l[id];
        return { ...target, lists: l };
      }),
    }));
  };

  const renameVariable = (id: string, oldName: string) => {
    setDataPrompt({ type: 'variable', name: oldName });
    // After submit, we need to update the variable name in-place
    // We'll handle this by deleting + re-creating — but simpler: just update directly
    // Use a special rename flow
    setRenameTarget({ type: 'variable', id, oldName });
  };

  const renameList = (id: string, oldName: string) => {
    setDataPrompt({ type: 'list', name: oldName });
    setRenameTarget({ type: 'list', id, oldName });
  };

  // renameTarget state moved to top of component (line ~746)

  const handleDataPromptSubmit = () => {
    if (!dataPrompt || !dataPrompt.name.trim()) return;
    if (renameTarget) {
      // Rename in-place
      const newName = dataPrompt.name.trim();
      updateProject((current) => ({
        ...current,
        targets: current.targets.map((target, idx) => {
          if (idx !== selectedTargetIndex) return target;
          if (renameTarget.type === 'variable') {
            const vars = { ...(target.variables || {}) };
            if (vars[renameTarget.id]) {
              vars[renameTarget.id] = [newName, vars[renameTarget.id][1]];
            }
            return { ...target, variables: vars };
          } else {
            const l = { ...(target.lists || {}) };
            if (l[renameTarget.id]) {
              l[renameTarget.id] = [newName, l[renameTarget.id][1]];
            }
            return { ...target, lists: l };
          }
        }),
      }));
      setRenameTarget(null);
    } else {
      if (dataPrompt.type === 'variable') createVariable(dataPrompt.name.trim());
      else createList(dataPrompt.name.trim());
    }
    setDataPrompt(null);
  };

  const addBlock = (blockDef: ScratchBlockDef, dropX?: number, dropY?: number) => {
    if (!selectedTarget || selectedTarget.isStage || activeEditorTab !== 'code') return;
    if (!isBlockDefAvailable(blockDef, scratchVersion)) {
      setVmError(`"${blockDef.label}" is not available in ${SCRATCH_VERSION_OPTIONS.find((v) => v.value === scratchVersion)?.label || 'this version'}.`);
      return;
    }
    const blockId = generateId();
    const blockCount = Object.keys(selectedTarget.blocks || {}).length;
    const finalX = dropX ?? 40;
    const finalY = dropY ?? (30 + blockCount * 55);

    const extId = getExtensionId(blockDef.opcode);
    updateProject((current) => {
      const extensions = extId && !current.extensions?.includes(extId)
        ? [...(current.extensions as string[] || []), extId]
        : current.extensions;
      return {
      ...current,
      extensions,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;

        const blocks = { ...(target.blocks || {}) };
        const dataResolved = ensureDataRefForTarget(target, blockDef);
        const resolvedBlockDef: ScratchBlockDef = {
          ...blockDef,
          fields: dataResolved.fields,
        };
        const vmCompatible = createVmCompatibleBlockShape(blockId, resolvedBlockDef);
        const snapResult = findSnapTarget(blocks, finalX, finalY);

        if (snapResult && blocks[snapResult.id]) {
          const parent = blocks[snapResult.id];

          if (snapResult.type === 'substack') {
            // Insert inside C-block mouth
            const { x: snapX, y: snapY } = getSnapPosition(blocks, parent, 'substack');
            const parentInputs = { ...(parent.inputs || {}), SUBSTACK: [2, blockId] };
            blocks[snapResult.id] = { ...parent, inputs: parentInputs };
            blocks[blockId] = {
              id: blockId,
              opcode: vmCompatible.opcodeOverride,
              next: null,
              parent: snapResult.id,
              topLevel: false,
              x: snapX,
              y: snapY,
              inputs: vmCompatible.inputs,
              fields: vmCompatible.fields,
              mutation: vmCompatible.mutation,
            };
          } else {
            // Standard next-block snap
            const { x: snapX, y: snapY } = getSnapPosition(blocks, parent, 'next');
            blocks[snapResult.id] = { ...parent, next: blockId };
            blocks[blockId] = {
              id: blockId,
              opcode: vmCompatible.opcodeOverride,
              next: null,
              parent: snapResult.id,
              topLevel: false,
              x: snapX,
              y: snapY,
              inputs: vmCompatible.inputs,
              fields: vmCompatible.fields,
              mutation: vmCompatible.mutation,
            };
          }
          Object.assign(blocks, vmCompatible.extraBlocks);
        } else {
          const droppedShape = getBlockShape(blockDef.opcode);
          const isReporterLike = droppedShape === 'reporter' || droppedShape === 'boolean';
          if (isEventBlock(blockDef.opcode) || blockDef.opcode === 'procedures_definition' || isReporterLike) {
            blocks[blockId] = {
              id: blockId,
              opcode: blockDef.opcode,
              next: null,
              parent: null,
              topLevel: true,
              x: finalX,
              y: finalY,
              inputs: vmCompatible.inputs,
              fields: vmCompatible.fields,
              mutation: vmCompatible.mutation,
            };
            Object.assign(blocks, vmCompatible.extraBlocks);
          } else {
            const eventId = generateId();
            const eventY = Math.max(24, finalY - HAT_BLOCK_HEIGHT);
            blocks[eventId] = {
              id: eventId,
              opcode: 'event_whenflagclicked',
              next: blockId,
              parent: null,
              topLevel: true,
              x: finalX,
              y: eventY,
              inputs: {},
              fields: {},
            };
            blocks[blockId] = {
              id: blockId,
              opcode: vmCompatible.opcodeOverride,
              next: null,
              parent: eventId,
              topLevel: false,
              x: finalX,
              y: eventY + HAT_BLOCK_HEIGHT,
              inputs: vmCompatible.inputs,
              fields: vmCompatible.fields,
              mutation: vmCompatible.mutation,
            };
            Object.assign(blocks, vmCompatible.extraBlocks);
          }
        }

        return { ...dataResolved.target, blocks };
      }),
      };
    });
  };

  // Find a compatible empty input slot under the workspace coords (in unzoomed space).
  // sourceShape: 'reporter' | 'boolean' — strict matching.
  const findSlotDropTarget = useCallback((
    blocks: Record<string, ScratchBlockNode>,
    wsX: number,
    wsY: number,
    sourceShape: 'reporter' | 'boolean',
    excludeIds: Set<string>,
  ): { blockId: string; inputKey: string; type: 'reporter' | 'boolean'; x: number; y: number; width: number; height: number } | null => {
    let best: { blockId: string; inputKey: string; type: 'reporter' | 'boolean'; x: number; y: number; width: number; height: number; score: number } | null = null;
    slotsRegistryRef.current.forEach((slots, blockId) => {
      if (excludeIds.has(blockId)) return;
      const block = blocks[blockId];
      if (!block) return;
      const bx = block.x ?? 0;
      const by = block.y ?? 0;
      const orderedKeys = getOrderedInputKeysForBlock(block);
      slots.forEach((slot) => {
        if (slot.type !== sourceShape) return;
        const inputKey = orderedKeys[slot.index];
        if (!inputKey) return;
        // Skip if this input already holds a non-shadow block reference.
        const existing = block.inputs?.[inputKey] as unknown[] | undefined;
        if (Array.isArray(existing) && existing[0] === 3 && typeof existing[1] === 'string') return;
        const ax = bx + slot.x;
        const ay = by + slot.y;
        const cx = ax + slot.width / 2;
        const cy = ay + slot.height / 2;
        // Very generous snap zone: large bounding box pad + wide radius from slot center.
        const PAD = 80;
        const inBox = wsX >= ax - PAD && wsX <= ax + slot.width + PAD && wsY >= ay - PAD && wsY <= ay + slot.height + PAD;
        const distToCenter = Math.hypot(wsX - cx, wsY - cy);
        if (inBox || distToCenter <= 120) {
          const score = distToCenter;
          if (!best || score < best.score) {
            best = { blockId, inputKey, type: slot.type, x: ax, y: ay, width: slot.width, height: slot.height, score };
          }
        }
      });
    });
    if (!best) return null;
    const { score: _s, ...rest } = best;
    return rest;
  }, []);

  const handleWorkspaceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/scratch-block');
      if (!raw) { console.warn('[scratch-drop] no payload on dataTransfer'); return; }
      const data = JSON.parse(raw) as ScratchBlockDef;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / workspaceZoom;
      const y = (e.clientY - rect.top) / workspaceZoom;
      // If the dragged block is a reporter or boolean and is dropped over a compatible slot,
      // attach it as an input instead of placing it free in the workspace.
      const droppedShape = getBlockShape(data.opcode);
      console.log('[scratch-drop]', { opcode: data.opcode, droppedShape, x, y, slots: slotsRegistryRef.current.size });
      if (droppedShape === 'reporter' || droppedShape === 'boolean') {
        const blocks = selectedTarget?.blocks || {};
        const target = findSlotDropTarget(blocks, x, y, droppedShape, new Set());
        console.log('[scratch-drop] slot target:', target);
        if (target) {
          attachReporterToSlot(data, target.blockId, target.inputKey);
          return;
        }
      }
      addBlock(data, x, y);
    } catch (err) { console.error('[scratch-drop] error', err); }
  };

  // Create a new reporter/boolean block from a flyout def and attach it as a slot input on parentId.
  const attachReporterToSlot = (blockDef: ScratchBlockDef, parentId: string, inputKey: string) => {
    const newId = generateId();
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const blocks = { ...(target.blocks || {}) };
        const parent = blocks[parentId];
        if (!parent) return target;
        const dataResolved = ensureDataRefForTarget(target, blockDef);
        const vmCompat = createVmCompatibleBlockShape(newId, { ...blockDef, fields: dataResolved.fields });
        blocks[newId] = {
          id: newId,
          opcode: vmCompat.opcodeOverride,
          parent: parentId,
          topLevel: false,
          shadow: false,
          inputs: vmCompat.inputs,
          fields: vmCompat.fields,
          mutation: vmCompat.mutation,
          next: null,
        };
        Object.assign(blocks, vmCompat.extraBlocks);
        // Preserve original shadow if any (so removing the reporter restores the default value).
        const oldInput = parent.inputs?.[inputKey] as unknown[] | undefined;
        const shadowRef = Array.isArray(oldInput) && oldInput.length >= 2 ? oldInput[oldInput.length - 1] : null;
        const newInputs = { ...(parent.inputs || {}) };
        newInputs[inputKey] = shadowRef ? [3, newId, shadowRef] : [3, newId, [10, '']];
        blocks[parentId] = { ...parent, inputs: newInputs };
        return { ...dataResolved.target, blocks };
      }),
    }));
  };

  // Update the literal value inside a shadow input (e.g., the "10" in `repeat [10]`).
  const updateShadowValue = (parentId: string, inputKey: string, newValue: string) => {
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const blocks = { ...(target.blocks || {}) };
        const parent = blocks[parentId];
        if (!parent) return target;
        const ref = (parent.inputs || {})[inputKey] as unknown[] | undefined;
        if (!Array.isArray(ref)) return target;
        // Determine where the shadow tuple lives: ref[1] for shadow-only [1, [..]] or ref[2] for [3, id, [..]]
        const shadowIdx = ref[0] === 1 ? 1 : ref.length - 1;
        const shadowTuple = ref[shadowIdx];
        // Inline literal shadow: tuple like [4, '10']
        if (Array.isArray(shadowTuple) && typeof shadowTuple[0] === 'number') {
          const newTuple = [shadowTuple[0], newValue];
          const newRef = [...ref];
          newRef[shadowIdx] = newTuple;
          const newInputs = { ...(parent.inputs || {}), [inputKey]: newRef };
          blocks[parentId] = { ...parent, inputs: newInputs };
          return { ...target, blocks };
        }
        // Block-id shadow (separate shadow block in blocks map)
        if (typeof shadowTuple === 'string' && blocks[shadowTuple]) {
          const sb = blocks[shadowTuple];
          const fields = { ...(sb.fields || {}) };
          const firstFieldKey = Object.keys(fields)[0];
          if (firstFieldKey) {
            const cur = fields[firstFieldKey] as unknown[];
            fields[firstFieldKey] = [newValue, Array.isArray(cur) ? cur[1] : null];
            blocks[shadowTuple] = { ...sb, fields };
          }
          return { ...target, blocks };
        }
        return target;
      }),
    }));
  };

  const getWorkspaceCoords = useCallback((clientX: number, clientY: number) => {
    const ws = workspaceRef.current;
    if (!ws) return { x: 0, y: 0 };
    const rect = ws.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / workspaceZoom,
      y: (clientY - rect.top) / workspaceZoom,
    };
  }, [workspaceZoom]);

  // Pointer-based flyout drag: starts when user presses on a flyout/palette block.
  // Tracks pointer globally; on release, decides whether to attach to a slot or place free.
  const startFlyoutDrag = useCallback((blockDef: ScratchBlockDef, color: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    flyoutDragRef.current = { blockDef, color, startX: e.clientX, startY: e.clientY };
    setFlyoutDrag({ blockDef, color, ghostX: e.clientX, ghostY: e.clientY });

    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - (flyoutDragRef.current?.startX ?? ev.clientX);
      const dy = ev.clientY - (flyoutDragRef.current?.startY ?? ev.clientY);
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      suppressFlyoutClickRef.current = true;
      setFlyoutDrag((prev) => prev ? { ...prev, ghostX: ev.clientX, ghostY: ev.clientY } : prev);

      const ws = workspaceRef.current;
      if (!ws) return;
      const rect = ws.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) {
        setInputDropTarget(null);
        return;
      }
      const x = (ev.clientX - rect.left) / workspaceZoom;
      const y = (ev.clientY - rect.top) / workspaceZoom;
      const shape = getBlockShape(blockDef.opcode);
      if (shape === 'reporter' || shape === 'boolean') {
        const t = findSlotDropTarget(selectedTarget?.blocks || {}, x, y, shape, new Set());
        inputDropTargetRef.current = t;
        setInputDropTarget(t);
      } else {
        inputDropTargetRef.current = null;
        setInputDropTarget(null);
      }
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const stash = flyoutDragRef.current;
      flyoutDragRef.current = null;
      setFlyoutDrag(null);
      const lastTarget = inputDropTargetRef.current;
      inputDropTargetRef.current = null;
      setInputDropTarget(null);
      console.log('[flyout-drop] up', { moved, hasStash: !!stash, lastTarget });
      if (!stash) return;
      if (!moved) {
        window.setTimeout(() => {
          suppressFlyoutClickRef.current = false;
        }, 0);
        return;
      }

      const ws = workspaceRef.current;
      if (!ws) return;
      const rect = ws.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) {
        console.log('[flyout-drop] outside workspace');
        return;
      }
      const x = (ev.clientX - rect.left) / workspaceZoom;
      const y = (ev.clientY - rect.top) / workspaceZoom;
      const shape = getBlockShape(stash.blockDef.opcode);
      console.log('[flyout-drop] coords', { x, y, shape, opcode: stash.blockDef.opcode });
      if (shape === 'reporter' || shape === 'boolean') {
        // Prefer the live target captured during move (avoids stale-closure issues with selectedTarget).
        const t = lastTarget ?? findSlotDropTarget(selectedTarget?.blocks || {}, x, y, shape, new Set());
        console.log('[flyout-drop] slot target', t);
        if (t) {
          attachReporterToSlot(stash.blockDef, t.blockId, t.inputKey);
          return;
        }
      }
      addBlock(stash.blockDef, x, y);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [workspaceZoom, selectedTarget]);

  const getBlockStack = useCallback((blocks: Record<string, ScratchBlockNode>, startId: string): string[] => {
    const ids: string[] = [startId];
    let current = blocks[startId];
    while (current?.next && blocks[current.next]) {
      ids.push(current.next);
      current = blocks[current.next];
    }
    // Also include SUBSTACK children recursively
    for (const id of [...ids]) {
      const b = blocks[id];
      if (b?.inputs) {
        const sub = b.inputs.SUBSTACK as unknown[];
        if (sub && sub[1] && typeof sub[1] === 'string' && blocks[sub[1]]) {
          ids.push(...getBlockStack(blocks, sub[1] as string));
        }
      }
    }
    return ids;
  }, []);

  // Delete a block and its entire descendant stack (next chain + SUBSTACK + reporter inputs).
  const deleteBlockStack = useCallback((blockId: string) => {
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const blocks = { ...(target.blocks || {}) };
        if (!blocks[blockId]) return target;
        // Collect all ids to delete: stack + reporter/boolean inputs (recursively).
        const toDelete = new Set<string>();
        const collect = (id: string) => {
          if (toDelete.has(id) || !blocks[id]) return;
          toDelete.add(id);
          const b = blocks[id];
          if (b.next) collect(b.next);
          if (b.inputs) {
            for (const v of Object.values(b.inputs)) {
              if (Array.isArray(v) && typeof v[1] === 'string') collect(v[1] as string);
              if (Array.isArray(v) && typeof v[2] === 'string') collect(v[2] as string);
            }
          }
        };
        collect(blockId);
        // Detach from parent
        const root = blocks[blockId];
        if (root.parent && blocks[root.parent]) {
          const parent = { ...blocks[root.parent] };
          if (parent.next === blockId) parent.next = null;
          if (parent.inputs) {
            const newInputs = { ...parent.inputs };
            for (const [k, v] of Object.entries(newInputs)) {
              if (Array.isArray(v) && v[1] === blockId) {
                // Restore shadow if present
                const shadow = v[2];
                if (shadow) newInputs[k] = [1, shadow];
                else delete newInputs[k];
              }
            }
            parent.inputs = newInputs;
          }
          blocks[root.parent] = parent;
        }
        toDelete.forEach((id) => { delete blocks[id]; });
        return { ...target, blocks };
      }),
    }));
  }, [selectedTargetIndex, updateProject]);

  // Duplicate a block stack (next chain + SUBSTACK + reporter inputs), placed offset from original.
  const duplicateBlockStack = useCallback((blockId: string) => {
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const blocks = { ...(target.blocks || {}) };
        const root = blocks[blockId];
        if (!root) return target;
        const idMap = new Map<string, string>();
        const collect = (id: string) => {
          if (idMap.has(id) || !blocks[id]) return;
          idMap.set(id, generateId());
          const b = blocks[id];
          if (b.next) collect(b.next);
          if (b.inputs) {
            for (const v of Object.values(b.inputs)) {
              if (Array.isArray(v) && typeof v[1] === 'string' && blocks[v[1] as string]) collect(v[1] as string);
              if (Array.isArray(v) && typeof v[2] === 'string' && blocks[v[2] as string]) collect(v[2] as string);
            }
          }
        };
        collect(blockId);
        idMap.forEach((newId, oldId) => {
          const orig = blocks[oldId];
          const cloneInputs: Record<string, unknown> = {};
          if (orig.inputs) {
            for (const [k, v] of Object.entries(orig.inputs)) {
              if (Array.isArray(v)) {
                const arr = [...v];
                if (typeof arr[1] === 'string' && idMap.has(arr[1] as string)) arr[1] = idMap.get(arr[1] as string)!;
                if (typeof arr[2] === 'string' && idMap.has(arr[2] as string)) arr[2] = idMap.get(arr[2] as string)!;
                cloneInputs[k] = arr;
              } else cloneInputs[k] = v;
            }
          }
          blocks[newId] = {
            ...orig,
            id: newId,
            inputs: cloneInputs,
            next: orig.next && idMap.has(orig.next) ? idMap.get(orig.next)! : null,
            parent: orig.parent && idMap.has(orig.parent) ? idMap.get(orig.parent)! : null,
            x: oldId === blockId ? (orig.x ?? 40) + 30 : orig.x,
            y: oldId === blockId ? (orig.y ?? 40) + 30 : orig.y,
            topLevel: oldId === blockId ? true : orig.topLevel,
          };
        });
        // Root duplicate has no parent
        const newRootId = idMap.get(blockId)!;
        blocks[newRootId] = { ...blocks[newRootId], parent: null, topLevel: true };
        return { ...target, blocks };
      }),
    }));
  }, [selectedTargetIndex, updateProject]);

  // Clean Up: arrange all top-level stacks vertically along the left side.
  const cleanUpBlocks = useCallback(() => {
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const blocks = { ...(target.blocks || {}) };
        const tops = Object.values(blocks).filter((b) => b && b.opcode && !b.shadow && (b.topLevel || !b.parent) && b.x !== undefined);
        // Sort by current y then x for stable order
        tops.sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
        let cursorY = 24;
        const STACK_GAP = 24;
        const APPROX_BLOCK_H = 36;
        tops.forEach((t) => {
          const stackIds = getBlockStack(blocks, t.id);
          const dx = 24 - (t.x ?? 0);
          const dy = cursorY - (t.y ?? 0);
          stackIds.forEach((sid) => {
            const b = blocks[sid];
            if (!b) return;
            blocks[sid] = { ...b, x: (b.x ?? 0) + dx, y: (b.y ?? 0) + dy };
          });
          // Estimate height by counting chained blocks (not inputs) for spacing
          const chainCount = stackIds.filter((sid) => blocks[sid] && !blocks[sid].shadow).length;
          cursorY += chainCount * APPROX_BLOCK_H + STACK_GAP;
        });
        return { ...target, blocks };
      }),
    }));
  }, [selectedTargetIndex, updateProject, getBlockStack]);

  const handleBlockPointerDown = useCallback((blockId: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getWorkspaceCoords(e.clientX, e.clientY);
    const block = selectedTarget?.blocks?.[blockId];
    if (!block) return;

    dragRef.current = {
      blockId,
      startX: x,
      startY: y,
      offsetX: x - (block.x ?? 0),
      offsetY: y - (block.y ?? 0),
      originalBlock: { ...block },
      detached: false,
    };
    setDragBlockId(blockId);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [getWorkspaceCoords, selectedTarget]);

  const handleWorkspacePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const { x, y } = getWorkspaceCoords(e.clientX, e.clientY);
    const newX = x - drag.offsetX;
    const newY = y - drag.offsetY;

    // Detach from parent on first move
    if (!drag.detached) {
      drag.detached = true;
      updateProject((current) => ({
        ...current,
        targets: current.targets.map((target, idx) => {
          if (idx !== selectedTargetIndex) return target;
          const blocks = { ...(target.blocks || {}) };
          const block = blocks[drag.blockId];
          if (!block) return target;
          if (block.parent && blocks[block.parent]) {
            const oldParent = { ...blocks[block.parent] };
            if (oldParent.next === drag.blockId) {
              oldParent.next = null;
            }
            if (oldParent.inputs) {
              const substackVal = oldParent.inputs.SUBSTACK as unknown[];
              if (substackVal && substackVal[1] === drag.blockId) {
                oldParent.inputs = { ...oldParent.inputs, SUBSTACK: [2, null] };
              }
            }
            blocks[block.parent] = oldParent;
          }
          blocks[drag.blockId] = { ...block, x: newX, y: newY, parent: null, topLevel: true };

          // Move child stack too
          const stackIds = getBlockStack(blocks, drag.blockId).slice(1);
          const dx = newX - (drag.originalBlock.x ?? 0);
          const dy = newY - (drag.originalBlock.y ?? 0);
          stackIds.forEach(sid => {
            if (blocks[sid]) {
              blocks[sid] = { ...blocks[sid], x: (blocks[sid].x ?? 0) + dx, y: (blocks[sid].y ?? 0) + dy };
            }
          });

          return { ...target, blocks };
        }),
      }));
    } else {
      // Update position during drag
      updateProject((current) => ({
        ...current,
        targets: current.targets.map((target, idx) => {
          if (idx !== selectedTargetIndex) return target;
          const blocks = { ...(target.blocks || {}) };
          if (!blocks[drag.blockId]) return target;
          const oldX = blocks[drag.blockId].x ?? 0;
          const oldY = blocks[drag.blockId].y ?? 0;
          const dx = newX - oldX;
          const dy = newY - oldY;
          blocks[drag.blockId] = { ...blocks[drag.blockId], x: newX, y: newY };
          // Move child stack
          const stackIds = getBlockStack(blocks, drag.blockId).slice(1);
          stackIds.forEach(sid => {
            if (blocks[sid]) {
              blocks[sid] = { ...blocks[sid], x: (blocks[sid].x ?? 0) + dx, y: (blocks[sid].y ?? 0) + dy };
            }
          });
          return { ...target, blocks };
        }),
      }));
    }

    // Compute snap / slot drop preview
    const blocks = selectedTarget?.blocks || {};
    const draggedShape = getBlockShape(blocks[drag.blockId]?.opcode || '');
    const isReporterDrag = draggedShape === 'reporter' || draggedShape === 'boolean';
    if (isReporterDrag) {
      const exclude = new Set([drag.blockId]);
      const slotTarget = findSlotDropTarget(blocks, x, y, draggedShape, exclude);
      inputDropTargetRef.current = slotTarget;
      setInputDropTarget(slotTarget);
      setSnapPreview(null);
    } else {
      inputDropTargetRef.current = null;
      setInputDropTarget(null);
      const snap = findSnapTarget(blocks, newX, newY, drag.blockId);
      if (snap && blocks[snap.id]) {
        const parent = blocks[snap.id];
        const { x: snapX, y: snapY } = getSnapPosition(blocks, parent, snap.type);
        setSnapPreview({ ...snap, x: snapX, y: snapY });
      } else {
        setSnapPreview(null);
      }
    }
  }, [getWorkspaceCoords, selectedTarget, selectedTargetIndex, updateProject, getBlockStack, findSlotDropTarget]);

  const handleWorkspacePointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;

    const slotDrop = inputDropTargetRef.current ?? inputDropTarget;
    const snap = snapPreview;
    inputDropTargetRef.current = null;

    if (slotDrop) {
      // Attach this dragged reporter/boolean as an input on slotDrop.blockId/slotDrop.inputKey.
      updateProject((current) => ({
        ...current,
        targets: current.targets.map((target, idx) => {
          if (idx !== selectedTargetIndex) return target;
          const blocks = { ...(target.blocks || {}) };
          const dragged = blocks[drag.blockId];
          const parent = blocks[slotDrop.blockId];
          if (!dragged || !parent) return target;
          // Detach dragged from any prior input slot reference on its previous parent.
          if (dragged.parent && blocks[dragged.parent]) {
            const prev = { ...blocks[dragged.parent] };
            if (prev.inputs) {
              const newInputs: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(prev.inputs)) {
                if (Array.isArray(v) && v[0] === 3 && v[1] === drag.blockId) {
                  // Restore default shadow if present in tuple.
                  const shadow = v[2];
                  newInputs[k] = shadow ? [1, shadow] : [1, [10, '']];
                } else {
                  newInputs[k] = v;
                }
              }
              prev.inputs = newInputs;
              blocks[dragged.parent] = prev;
            }
          }
          const oldInput = parent.inputs?.[slotDrop.inputKey] as unknown[] | undefined;
          const shadowRef = Array.isArray(oldInput) && oldInput.length >= 2 ? oldInput[oldInput.length - 1] : null;
          const newInputs = { ...(parent.inputs || {}) };
          newInputs[slotDrop.inputKey] = shadowRef ? [3, drag.blockId, shadowRef] : [3, drag.blockId, [10, '']];
          blocks[slotDrop.blockId] = { ...parent, inputs: newInputs };
          blocks[drag.blockId] = { ...dragged, parent: slotDrop.blockId, topLevel: false };
          return { ...target, blocks };
        }),
      }));
    } else if (snap) {
      updateProject((current) => ({
        ...current,
        targets: current.targets.map((target, idx) => {
          if (idx !== selectedTargetIndex) return target;
          const blocks = { ...(target.blocks || {}) };
          const block = blocks[drag.blockId];
          if (!block || !blocks[snap.id]) return target;

          const parent = blocks[snap.id];
          if (snap.type === 'substack') {
            const { x: snapX, y: snapY } = getSnapPosition(blocks, parent, 'substack');
            const dx = snapX - (block.x ?? 0);
            const dy = snapY - (block.y ?? 0);
            blocks[snap.id] = { ...parent, inputs: { ...(parent.inputs || {}), SUBSTACK: [2, drag.blockId] } };
            blocks[drag.blockId] = { ...block, x: snapX, y: snapY, parent: snap.id, topLevel: false };
            const stackIds = getBlockStack(blocks, drag.blockId).slice(1);
            stackIds.forEach(sid => {
              if (blocks[sid]) blocks[sid] = { ...blocks[sid], x: (blocks[sid].x ?? 0) + dx, y: (blocks[sid].y ?? 0) + dy };
            });
          } else {
            const { x: snapX, y: snapY } = getSnapPosition(blocks, parent, 'next');
            const dx = snapX - (block.x ?? 0);
            const dy = snapY - (block.y ?? 0);
            blocks[snap.id] = { ...parent, next: drag.blockId };
            blocks[drag.blockId] = { ...block, x: snapX, y: snapY, parent: snap.id, topLevel: false };
            const stackIds = getBlockStack(blocks, drag.blockId).slice(1);
            stackIds.forEach(sid => {
              if (blocks[sid]) blocks[sid] = { ...blocks[sid], x: (blocks[sid].x ?? 0) + dx, y: (blocks[sid].y ?? 0) + dy };
            });
          }
          return { ...target, blocks };
        }),
      }));
    }

    dragRef.current = null;
    setDragBlockId(null);
    setSnapPreview(null);
    setInputDropTarget(null);
  }, [snapPreview, inputDropTarget, selectedTargetIndex, updateProject, getBlockStack]);

  const runPreview = async () => {
    if (!vmRef.current || !vmReady) return;
    const currentArchive = ensureArchive(archive);
    await loadVmFromArchive(currentArchive);
    onRun(); // Effect will call greenFlag() on freshly loaded project
  };

  const handleVmStop = () => {
    onStop(); // Effect will call stopAll()
  };

  const toggleStageFullscreen = async () => {
    const stageElement = stageContainerRef.current;
    if (!stageElement) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await stageElement.requestFullscreen();
  };

  const performImport = async (file: File, forcedVersion?: ScratchCompatibilityVersion) => {
    try {
      const data = await file.arrayBuffer();
      const parsed = await importScratchArchive(data);
      const importedProject = safeParseProject(parsed.archive);
      const bySemver = semverToScratchVersion(importedProject.meta?.semver);
      const name = file.name.toLowerCase();
      const inferredVersion = forcedVersion
        ?? (name.endsWith('.sb2') ? 'scratch2' : name.endsWith('.sb') ? 'scratch14' : bySemver);
      const normalizedProject: ScratchProject = {
        ...importedProject,
        projectVersion: inferredVersion === 'scratch2' || inferredVersion === 'scratch14' ? 2 : 3,
        targets: (importedProject.targets || []).map((target) => ({
          ...target,
          blocks: normalizeBlocksForVersion(target.blocks, inferredVersion),
        })),
        meta: {
          ...(importedProject.meta || {}),
          semver: SCRATCH_VERSION_OPTIONS.find((option) => option.value === inferredVersion)?.semver || '3.0.0',
        },
      };
      const normalizedArchive = ensureArchive({
        ...parsed.archive,
        projectJson: formatJson(normalizedProject),
      });
      onArchiveChange(normalizedArchive);
      onProjectJsonUpdate(normalizedArchive.projectJson);
      setProjectJsonDraft(normalizedArchive.projectJson);
      setScratchVersion(inferredVersion);
      setJsonError(null);
      setVmError(null);
      setSelectedTargetIndex(1);
      await loadVmFromArchive(normalizedArchive, inferredVersion);
    } catch (error) {
      setVmError(error instanceof Error ? error.message : 'Failed to import Scratch archive (.sb/.sb2/.sb3).');
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  const handleImport = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    const isLegacy = lowerName.endsWith('.sb2') || lowerName.endsWith('.sb');
    const legacyVersion: ScratchCompatibilityVersion = lowerName.endsWith('.sb') ? 'scratch14' : 'scratch2';
    if (isLegacy) {
      setUnsupportedVersionPrompt({
        version: legacyVersion,
        source: 'import',
        fileName: file.name,
        onConfirm: () => performImport(file, legacyVersion),
      });
      return;
    }
    await performImport(file);
  };

  const handleExport = async () => {
    try {
      const exportFormat = scratchVersion === 'scratch3' ? 'sb3' : 'sb2';
      const semver = exportFormat === 'sb3' ? '3.0.0' : '2.0.0';
      const currentProject = safeParseProject(archive);
      const normalizedProject: ScratchProject = {
        ...currentProject,
        projectVersion: exportFormat === 'sb3' ? 3 : 2,
        targets: (currentProject.targets || []).map((target) => ({
          ...target,
          blocks: normalizeBlocksForVersion(target.blocks, exportFormat === 'sb3' ? 'scratch3' : 'scratch2'),
        })),
        extensions: (currentProject.extensions || []).filter((ext) => exportFormat === 'sb3' || (ext !== 'pen' && ext !== 'music')),
        meta: {
          ...(currentProject.meta || {}),
          semver,
        },
      };
      const exportArchive = ensureArchive({
        ...ensureArchive(archive),
        projectJson: formatJson(normalizedProject),
      });
      const data = await exportScratchArchive(exportArchive, exportFormat);
      const mime = exportFormat === 'sb3' ? 'application/x.scratch.sb3' : 'application/x.scratch.sb2';
      const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setVmError(null);
    } catch (error) {
      setVmError(error instanceof Error ? error.message : 'Failed to export Scratch archive (.sb2/.sb3).');
    }
  };

  const applyJsonDraft = async () => {
    try {
      const parsed = JSON.parse(projectJsonDraft || '{}') as ScratchProject;
      if (!Array.isArray(parsed.targets)) {
        setJsonError('Invalid Scratch JSON: targets must be an array.');
        return;
      }
      const json = formatJson(parsed);
      const nextArchive = { ...ensureArchive(archive), projectJson: json };
      onArchiveChange(nextArchive);
      onProjectJsonUpdate(json);
      setProjectJsonDraft(json);
      setJsonError(null);
      await loadVmFromArchive(nextArchive);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const performVersionToggle = async (nextVersion: ScratchCompatibilityVersion) => {
    const semver = SCRATCH_VERSION_OPTIONS.find((option) => option.value === nextVersion)?.semver || '3.0.0';
    const current = safeParseProject(archive);
    const currentSemver = typeof current.meta?.semver === 'string' ? current.meta.semver : '';
    if (currentSemver === semver) return;

    setScratchVersion(nextVersion);

    const nextProject: ScratchProject = {
      ...current,
      projectVersion: nextVersion === 'scratch2' || nextVersion === 'scratch14' ? 2 : 3,
      extensions: (current.extensions || []).filter((ext) => {
        if (nextVersion === 'scratch3') return true;
        if (ext === 'pen' || ext === 'music') return false;
        return true;
      }),
      targets: (current.targets || []).map((target) => ({
        ...target,
        blocks: normalizeBlocksForVersion(target.blocks, nextVersion),
      })),
      meta: {
        ...(current.meta || {}),
        semver,
      },
    };

    const nextJson = formatJson(nextProject);
    const currentArchive = ensureArchive(archive);
    const nextArchive: ScratchArchive = {
      ...currentArchive,
      fileNames: currentArchive.fileNames.includes('project.json')
        ? currentArchive.fileNames
        : [...currentArchive.fileNames, 'project.json'],
      projectJson: nextJson,
    };

    onArchiveChange(nextArchive);
    onProjectJsonUpdate(nextJson);
    setProjectJsonDraft(nextJson);
    setJsonError(null);
    await loadVmFromArchive(nextArchive, nextVersion);
  };

  const handleVersionToggle = async (nextVersion: ScratchCompatibilityVersion) => {
    if (nextVersion === 'scratch2' || nextVersion === 'scratch14') {
      setUnsupportedVersionPrompt({
        version: nextVersion,
        source: 'toggle',
        onConfirm: () => performVersionToggle(nextVersion),
      });
      return;
    }
    await performVersionToggle(nextVersion);
  };

  const [showJson, setShowJson] = useState(false);

  return (
    <div className="h-full flex flex-col" style={{ background: guiColors.headerBg }}>
      {/* ===== TOP MENU BAR ===== */}
      <div className="h-12 flex items-center px-3 gap-4 shrink-0" style={{ background: guiColors.headerBg, color: guiColors.headerText }}>
        {/* Logo / brand */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${guiColors.headerText}20` }}>
            <span style={{ color: guiColors.headerText }} className="font-bold text-sm">S</span>
          </div>
        </div>

        {/* File actions */}
        <div className="flex items-center gap-1">
          <button onClick={() => importInputRef.current?.click()} className="px-3 py-1.5 text-[13px] rounded flex items-center gap-1.5 transition-colors" style={{ color: guiColors.headerText, opacity: 0.8 }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = `${guiColors.headerText}10`; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.background = 'transparent'; }}>
            <Upload className="w-3.5 h-3.5" /> File
          </button>
          <input ref={importInputRef} className="hidden" type="file" accept=".sb3,.sb2,.sb" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImport(file); }} />
          <button onClick={handleExport} className="px-3 py-1.5 text-[13px] rounded transition-colors" style={{ color: guiColors.headerText, opacity: 0.8 }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = `${guiColors.headerText}10`; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.background = 'transparent'; }}>Save</button>
          <button onClick={() => setShowJson(!showJson)} className="px-3 py-1.5 text-[13px] rounded transition-colors" style={{ color: guiColors.headerText, opacity: 0.8 }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = `${guiColors.headerText}10`; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.background = 'transparent'; }}>Debug</button>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
          {SCRATCH_VERSION_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => void handleVersionToggle(option.value)}
              type="button"
              className={`px-2 py-1 text-[12px] rounded transition-colors ${
                scratchVersion === option.value
                  ? 'bg-white text-[#855cd6] font-semibold'
                  : 'text-white/85 hover:bg-white/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* VM status */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: vmReady ? `${guiColors.headerText}20` : '#fbbf24', color: vmReady ? guiColors.headerText : '#78350f' }}>
            {vmReady ? '● Ready' : '○ Starting'}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${guiColors.headerText}10`, color: guiColors.headerText }}>
            VM: scratch-vm ({scratchVersion === 'scratch3' ? 'native sb3' : scratchVersion === 'scratch2' ? 'compat scratch2' : 'compat + legacy import'})
          </span>
        </div>
      </div>

      {/* ===== TABS BAR (Code / Costumes / Sounds) ===== */}
      <div className="h-11 flex items-end px-2 shrink-0" style={{ background: guiColors.tabBg }}>
        {[
          { key: 'code' as const, icon: <Code2 className="w-4 h-4" />, label: 'Code' },
          { key: 'costumes' as const, icon: <Brush className="w-4 h-4" />, label: 'Costumes' },
          { key: 'sounds' as const, icon: <Volume2 className="w-4 h-4" />, label: 'Sounds' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveEditorTab(tab.key)}
            className={`px-5 h-9 rounded-t-lg text-[13px] font-semibold flex items-center gap-1.5 transition-colors ${
              activeEditorTab === tab.key
                ? 'bg-white'
                : ''
            }`}
            style={{
              color: activeEditorTab === tab.key ? guiColors.tabBg : guiColors.headerText,
              opacity: activeEditorTab === tab.key ? 1 : 0.7,
              background: activeEditorTab === tab.key ? '#ffffff' : `${guiColors.tabBg}`,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 min-h-0 flex bg-white">
        {/* --- LEFT: Category rail + Block flyout --- */}
        <div className="flex min-h-0 shrink-0" style={{ width: leftPaneWidth }}>
          {/* Category rail */}
          <div className="w-[64px] border-r border-[#e0e0e0] py-2 flex flex-col items-center gap-1 overflow-y-auto shrink-0" style={{ background: guiColors.categoryRailBg }}>
            {visibleCategoryRail.map((cat) => {
              const isActive = activeCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  className={`w-full flex flex-col items-center gap-0.5 py-1.5 text-[10px] leading-tight transition-colors ${
                    isActive ? 'font-bold' : 'text-[#575e75]'
                  }`}
                  style={isActive ? { color: cat.color } : undefined}
                >
                  <span
                    className="w-6 h-6 rounded-full"
                    style={{
                      backgroundColor: cat.color,
                      boxShadow: isActive ? `0 0 0 2px white, 0 0 0 4px ${cat.color}` : 'none',
                    }}
                  />
                  <span className="mt-0.5">{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Block flyout */}
          <div className="flex-1 overflow-y-auto py-3 px-3" style={{ background: guiColors.flyoutBg }}>
            <div className="text-[18px] font-bold mb-3" style={{ color: currentCategoryColors[activeCategory] || '#4c97ff' }}>
              {categoryDisplayName(activeCategory, scratchVersion)}
            </div>
            {activeEditorTab === 'code' ? (
              activeCategory === 'Variables' ? (
                <VariablesFlyout
                  variables={Object.entries(selectedTarget?.variables || {})}
                  lists={Object.entries(selectedTarget?.lists || {})}
                  blocks={visibleCategoryBlocks.Variables || []}
                  color={currentCategoryColors['Variables'] || currentCategoryColors['Data'] || '#ff8c1a'}
                  onMakeVariable={() => { setRenameTarget(null); setDataPrompt({ type: 'variable', name: '' }); }}
                  onMakeList={() => { setRenameTarget(null); setDataPrompt({ type: 'list', name: '' }); }}
                  onAddBlock={addBlock}
                  onDeleteVariable={deleteVariable}
                  onDeleteList={deleteList}
                  onRenameVariable={renameVariable}
                  onRenameList={renameList}
                  onStartFlyoutDrag={startFlyoutDrag}
                />
              ) : activeCategory === 'My Blocks' ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setMakeBlockModal({ name: '', runWithoutRefresh: false, args: [] })}
                    className="w-full px-3 py-2 rounded-lg text-white text-[13px] font-semibold hover:brightness-110"
                    style={{ background: currentCategoryColors['My Blocks'] || '#ff6680' }}
                  >
                    Make a Block
                  </button>
                  {(() => {
                    // Collect distinct parameter reporters across all custom procedures.
                    const seen = new Map<string, { name: string; type: 'string_number' | 'boolean' }>();
                    customProcedures.forEach((p) => {
                      p.args.forEach((a) => {
                        if (a.type === 'label') return;
                        const key = `${a.type}::${a.name}`;
                        if (!seen.has(key)) seen.set(key, { name: a.name, type: a.type });
                      });
                    });
                    const paramList = Array.from(seen.values());
                    if (paramList.length === 0) return null;
                    const color = currentCategoryColors['My Blocks'] || '#ff6680';
                    return (
                      <div className="space-y-1.5 mt-2">
                        <div className="text-[11px] uppercase tracking-wide text-[#575e75] font-semibold">Parameters</div>
                        {paramList.map((p) => {
                          const opcode = p.type === 'boolean' ? 'argument_reporter_boolean' : 'argument_reporter_string_number';
                          const def: ScratchBlockDef = {
                            label: p.type === 'boolean' ? `<${p.name}>` : `[${p.name}]`,
                            opcode,
                            fields: { VALUE: [p.name, null] },
                            minVersion: 'scratch2',
                          };
                          return (
                            <div
                              key={`${p.type}-${p.name}`}
                              onPointerDown={(e) => startFlyoutDrag(def, color, e)}
                              onClick={() => {
                                if (suppressFlyoutClickRef.current) {
                                  suppressFlyoutClickRef.current = false;
                                  return;
                                }
                                addBlock(def);
                              }}
                              className="cursor-grab active:cursor-grabbing hover:brightness-110 transition-all inline-block mr-1"
                            >
                              <ScratchBlockShape
                                label={p.name}
                                color={color}
                                shape={p.type === 'boolean' ? 'boolean' : 'reporter'}
                                width={Math.max(60, p.name.length * 8 + 24)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {customProcedures.length === 0 ? (
                    <div className="text-[12px] text-[#575e75] italic mt-2">
                      No custom blocks yet. Click "Make a Block" to create one.
                    </div>
                  ) : (
                    <div className="space-y-1.5 mt-2">
                      {customProcedures.map((proc) => {
                        const color = currentCategoryColors['My Blocks'] || '#ff6680';
                        const tokens = proc.proccode.split(/\s+/).filter(Boolean);
                        const valueArgs = proc.args.filter((a) => a.type !== 'label');
                        const labelTokens: string[] = [];
                        const nameTokens: string[] = [];
                        let valueIdx = 0;
                        let nameOver = false;
                        tokens.forEach((tok) => {
                          if (tok === '%s' || tok === '%b') {
                            nameOver = true;
                            const a = valueArgs[valueIdx++];
                            if (a) labelTokens.push(tok === '%b' ? `<${a.name}>` : `[${a.name}]`);
                          } else if (!nameOver) {
                            nameTokens.push(tok);
                          } else {
                            labelTokens.push(tok);
                          }
                        });
                        const callLabel = [nameTokens.join(' '), ...labelTokens].filter(Boolean).join(' ');
                        const defLabel = `define ${callLabel}`;
                        const defDef: ScratchBlockDef = {
                          label: defLabel,
                          opcode: 'procedures_definition',
                          proccode: proc.proccode,
                          procArgs: proc.args,
                          procWarp: proc.warp,
                          minVersion: 'scratch2',
                        };
                        const callDef: ScratchBlockDef = {
                          label: callLabel,
                          opcode: 'procedures_call',
                          proccode: proc.proccode,
                          procArgs: proc.args,
                          procWarp: proc.warp,
                          minVersion: 'scratch2',
                        };
                        return (
                          <div key={proc.proccode} className="space-y-1">
                            <div
                              onPointerDown={(e) => startFlyoutDrag(defDef, color, e)}
                              onClick={() => {
                                if (suppressFlyoutClickRef.current) {
                                  suppressFlyoutClickRef.current = false;
                                  return;
                                }
                                addBlock(defDef);
                              }}
                              className="cursor-grab active:cursor-grabbing hover:brightness-110 transition-all"
                            >
                              <ScratchBlockShape label={defDef.label} color={color} shape={getBlockShape(defDef.opcode)} />
                            </div>
                            <div
                              onPointerDown={(e) => startFlyoutDrag(callDef, color, e)}
                              onClick={() => {
                                if (suppressFlyoutClickRef.current) {
                                  suppressFlyoutClickRef.current = false;
                                  return;
                                }
                                addBlock(callDef);
                              }}
                              className="cursor-grab active:cursor-grabbing hover:brightness-110 transition-all"
                            >
                              <ScratchBlockShape label={callDef.label} color={color} shape={getBlockShape(callDef.opcode)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
              <div className="space-y-1.5">
                {(visibleCategoryBlocks[activeCategory] || []).map((blockDef) => {
                  const color = currentCategoryColors[activeCategory] || '#4c97ff';
                  const shape = getBlockShape(blockDef.opcode);
                  return (
                    <div
                      key={blockDef.label}
                      onPointerDown={(e) => startFlyoutDrag(blockDef, color, e)}
                      onClick={() => {
                        if (suppressFlyoutClickRef.current) {
                          suppressFlyoutClickRef.current = false;
                          return;
                        }
                        addBlock(blockDef);
                      }}
                      className="cursor-grab active:cursor-grabbing hover:brightness-110 transition-all"
                    >
                      <ScratchBlockShape label={blockDef.label} color={color} shape={shape} />
                    </div>
                  );
                })}
              </div>
              )
            ) : activeEditorTab === 'costumes' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold text-[#575e75]">Costumes ({selectedCostumes.length})</span>
                  <div className="flex gap-1">
                    <button className="px-2.5 py-1 rounded-full bg-[#855cd6] text-white text-xs flex items-center gap-1" onClick={() => setLibraryOpen('costumes')}>
                      Choose
                    </button>
                    <button className="px-2.5 py-1 rounded-full bg-[#575e75] text-white text-xs flex items-center gap-1" onClick={() => costumeInputRef.current?.click()}>
                      <Upload className="w-3 h-3" /> Upload
                    </button>
                  </div>
                  <input ref={costumeInputRef} className="hidden" type="file" accept="image/*,.svg" onChange={(e) => e.target.files?.[0] && addCostume(e.target.files[0])} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selectedCostumes.map((costume, idx) => {
                    const src = archive?.files?.[costume.md5ext] ? `data:${imgMime(costume.dataFormat)};base64,${archive.files[costume.md5ext]}` : undefined;
                    return (
                      <button key={costume.assetId} className={`rounded-lg border-2 p-2 ${idx === currentCostumeIndex ? 'border-[#855cd6] bg-[#f0ebff]' : 'border-[#e0e0e0]'}`} onClick={() => setCurrentCostume(idx)}>
                        <div className="h-16 rounded bg-[#f4f7ff] flex items-center justify-center overflow-hidden">
                          {src ? <img src={src} alt={costume.name} className="max-h-full max-w-full" /> : <span className="text-2xl">🎭</span>}
                        </div>
                        <div className="mt-1 text-[11px] text-[#575e75] truncate text-center">{idx + 1}. {costume.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold text-[#575e75]">Sounds ({selectedSounds.length})</span>
                  <div className="flex gap-1">
                    <button className="px-2.5 py-1 rounded-full bg-[#cf63cf] text-white text-xs flex items-center gap-1" onClick={() => setLibraryOpen('sounds')}>
                      Choose
                    </button>
                    <button className="px-2.5 py-1 rounded-full bg-[#575e75] text-white text-xs flex items-center gap-1" onClick={() => soundInputRef.current?.click()}>
                      <Upload className="w-3 h-3" /> Upload
                    </button>
                  </div>
                  <input ref={soundInputRef} className="hidden" type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && addSound(e.target.files[0])} />
                </div>
                <div className="space-y-1.5">
                  {selectedSounds.map((sound) => {
                    const src = archive?.files?.[sound.md5ext] ? `data:audio/${sound.dataFormat || 'wav'};base64,${archive.files[sound.md5ext]}` : '';
                    return (
                      <div key={sound.assetId} className="rounded-lg border border-[#e0e0e0] bg-white p-2 flex items-center justify-between">
                        <span className="text-[13px] text-[#575e75] truncate">{sound.name}</span>
                        <button
                          className="w-7 h-7 rounded-full bg-[#855cd6] text-white flex items-center justify-center"
                          onClick={() => {
                            if (!src) return;
                            if (!audioPreviewRef.current) audioPreviewRef.current = new Audio();
                            audioPreviewRef.current.src = src;
                            void audioPreviewRef.current.play();
                          }}
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className={`w-1.5 shrink-0 cursor-col-resize transition-colors ${activeResize === 'left' ? 'bg-[#855cd6]' : 'bg-transparent hover:bg-[#d7c9f6]'}`}
          onPointerDown={() => setActiveResize('left')}
          role="separator"
          aria-label="Resize categories pane"
        />

        {/* --- CENTER: Workspace --- */}
        <div className="flex-1 min-w-0 relative overflow-hidden scratch-workspace" style={{ background: '#fff' }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            // Live highlight: peek at the dragged opcode via dataTransfer types if available.
            // Fallback: try both shapes and prefer reporter, since most palette drags are reporters.
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / workspaceZoom;
            const y = (e.clientY - rect.top) / workspaceZoom;
            const blocks = selectedTarget?.blocks || {};
            const r = findSlotDropTarget(blocks, x, y, 'reporter', new Set());
            const b = r ? null : findSlotDropTarget(blocks, x, y, 'boolean', new Set());
            setInputDropTarget(r || b);
          }}
          onDragLeave={() => setInputDropTarget(null)}
          onDrop={(e) => { setInputDropTarget(null); handleWorkspaceDrop(e); }}
          onPointerMove={handleWorkspacePointerMove}
          onPointerUp={handleWorkspacePointerUp}
          onPointerLeave={handleWorkspacePointerUp}
          ref={workspaceRef}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `scale(${workspaceZoom})`,
              transformOrigin: 'top left',
              backgroundImage: 'radial-gradient(#e0e0e0 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {selectedBlocks.filter((block) => block.opcode && !block.shadow && (block.x !== undefined || block.topLevel)).map((block) => {
              const blockColor = getBlockColor(block.opcode);
              const shape = getBlockShape(block.opcode);
              const baseLabel = blockLabels[block.opcode] || block.opcode.replace(/_/g, ' ');
              const blocksMap = selectedTarget?.blocks || {};
              const menuDefs = DROPDOWN_REGISTRY[block.opcode] || [];
              // Resolve current menu values from shadow blocks for inline display
              const menuValues: { def: MenuFieldDef; menuBlockId: string; current: string; options: DropdownOption[] }[] = [];
              menuDefs.forEach((def) => {
                const ref = (block.inputs || {})[def.inputKey];
                if (Array.isArray(ref) && typeof ref[1] === 'string') {
                  const menuBlockId = ref[1] as string;
                  const menuBlock = blocksMap[menuBlockId];
                  const tuple = menuBlock?.fields?.[def.fieldKey];
                  const current = Array.isArray(tuple) && typeof tuple[0] === 'string' ? (tuple[0] as string) : '';
                  const options = typeof def.options === 'function'
                    ? def.options({ spriteNames: spriteTargets.map((s) => s.name), costumeNames: (selectedTarget?.costumes || []).map((c) => c.name), backdropNames: stageBackdrops.map((c) => c.name), soundNames: (selectedTarget?.sounds || []).map((s) => s.name) })
                    : def.options;
                  const labelForCurrent = options.find((o) => o.value === current)?.label || current;
                  menuValues.push({ def, menuBlockId, current: labelForCurrent, options });
                }
              });
              // Substitute the first {placeholder} with current menu label, and the second one (if any), in order.
              let label = baseLabel;
              menuValues.forEach((mv) => {
                label = label.replace(/\{[^}]+\}/, `{${mv.current}}`);
              });
              const isDragging = block.id === dragBlockId;
              return (
                <div
                  key={block.id}
                  onPointerDown={(e) => handleBlockPointerDown(block.id, e)}
                  // CRITICAL: must preventDefault on dragOver so drop fires when releasing
                  // a flyout reporter ON TOP of an existing block (otherwise browser cancels drop).
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes('application/scratch-block')) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                    }
                  }}
                  onDrop={(e) => {
                    if (!e.dataTransfer.types.includes('application/scratch-block')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setInputDropTarget(null);
                    // Compute coords relative to the workspace (not this block)
                    const ws = workspaceRef.current;
                    if (!ws) return;
                    const rect = ws.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / workspaceZoom;
                    const y = (e.clientY - rect.top) / workspaceZoom;
                    try {
                      const raw = e.dataTransfer.getData('application/scratch-block');
                      if (!raw) return;
                      const data = JSON.parse(raw) as ScratchBlockDef;
                      const droppedShape = getBlockShape(data.opcode);
                      if (droppedShape === 'reporter' || droppedShape === 'boolean') {
                        const target = findSlotDropTarget(selectedTarget?.blocks || {}, x, y, droppedShape, new Set());
                        if (target) { attachReporterToSlot(data, target.blockId, target.inputKey); return; }
                      }
                      addBlock(data, x, y);
                    } catch (err) { console.error('[scratch-block-drop]', err); }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setBlockContextMenu({ blockId: block.id, x: e.clientX, y: e.clientY });
                  }}
                  onClick={(e) => {
                    if (menuValues.length === 0) return;
                    e.stopPropagation();
                    const first = menuValues[0];
                    setFieldPicker({
                      blockId: block.id,
                      menuBlockId: first.menuBlockId,
                      fieldKey: first.def.fieldKey,
                      options: first.options,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  className={`absolute select-none touch-none ${isDragging ? 'cursor-grabbing z-50 opacity-80' : 'cursor-grab'}`}
                  style={{
                    left: block.x ?? 40,
                    top: block.y ?? 40,
                    transition: isDragging ? 'none' : 'left 0.08s ease-out, top 0.08s ease-out',
                  }}
                >
                  <ScratchBlockShape
                    label={label}
                    color={blockColor}
                    shape={shape}
                    onSlots={(slots) => {
                      const filtered = slots.filter((s) => s.type === 'reporter' || s.type === 'boolean') as { type: 'reporter' | 'boolean'; index: number; x: number; y: number; width: number; height: number }[];
                      const prev = slotsRegistryRef.current.get(block.id);
                      const same = prev && prev.length === filtered.length && prev.every((p, i) => p.x === filtered[i].x && p.y === filtered[i].y && p.width === filtered[i].width && p.height === filtered[i].height);
                      slotsRegistryRef.current.set(block.id, filtered);
                      if (!same) setSlotsTick((t) => t + 1);
                    }}
                  />
                  {/* Editable shadow value overlays */}
                  {(() => {
                    void slotsTick;
                    const slots = slotsRegistryRef.current.get(block.id) || [];
                    const orderedKeys = getOrderedInputKeysForBlock(block);
                    return slots.map((slot) => {
                      if (slot.type !== 'reporter') return null;
                      const inputKey = orderedKeys[slot.index];
                      if (!inputKey) return null;
                      const ref = (block.inputs || {})[inputKey] as unknown[] | undefined;
                      if (!Array.isArray(ref)) return null;
                      // If a real reporter block is attached, don't show editable input
                      if (ref[0] === 3 && typeof ref[1] === 'string') return null;
                      const shadowTuple = (ref[0] === 1 ? ref[1] : ref[ref.length - 1]) as unknown;
                      if (!Array.isArray(shadowTuple)) return null;
                      const currentValue = String(shadowTuple[1] ?? '');
                      const anyDragging = dragBlockId !== null || isHtml5Dragging;
                      return (
                        <ShadowInput
                          key={`${block.id}-${inputKey}`}
                          value={currentValue}
                          left={slot.x}
                          top={slot.y}
                          width={slot.width}
                          height={slot.height}
                          disablePointer={anyDragging}
                          onCommit={(v) => updateShadowValue(block.id, inputKey, v)}
                        />
                      );
                    });
                  })()}
                </div>
              );
            })}
            {/* Snap preview indicator */}
            {snapPreview && (
              <div
                className="absolute pointer-events-none z-40"
                style={{ left: snapPreview.x, top: snapPreview.y }}
              >
                <div className="h-1 w-24 rounded-full bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.8)]" />
              </div>
            )}
            {/* Input slot drop highlight */}
            {inputDropTarget && (
              <div
                className="absolute pointer-events-none z-40 rounded-md"
                style={{
                  left: inputDropTarget.x - 2,
                  top: inputDropTarget.y - 2,
                  width: inputDropTarget.width + 4,
                  height: inputDropTarget.height + 4,
                  boxShadow: '0 0 0 3px #ffbf00, 0 0 8px 2px rgba(255,191,0,0.6)',
                  borderRadius: inputDropTarget.type === 'reporter' ? 12 : 4,
                }}
              />
            )}
          </div>
          {/* Zoom controls */}
          <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
            <button className="w-8 h-8 rounded-full bg-[#855cd6] text-white flex items-center justify-center shadow-md hover:bg-[#7248bf]" onClick={() => setWorkspaceZoom((z) => Math.min(1.4, z + 0.1))}><ZoomIn className="w-4 h-4" /></button>
            <button className="w-8 h-8 rounded-full bg-[#855cd6] text-white flex items-center justify-center shadow-md hover:bg-[#7248bf]" onClick={() => setWorkspaceZoom((z) => Math.max(0.7, z - 0.1))}><ZoomOut className="w-4 h-4" /></button>
            <button className="w-8 h-8 rounded-full bg-white border border-[#d0d0d0] text-[#575e75] flex items-center justify-center shadow-md" onClick={() => setWorkspaceZoom(1)}><CircleMinus className="w-4 h-4" /></button>
          </div>
          {/* Floating ghost block following cursor during flyout drag */}
          {flyoutDrag && (
            <div
              className="fixed pointer-events-none z-[9999] opacity-80"
              style={{ left: flyoutDrag.ghostX + 8, top: flyoutDrag.ghostY + 8 }}
            >
              <ScratchBlockShape
                label={flyoutDrag.blockDef.label}
                color={flyoutDrag.color}
                shape={getBlockShape(flyoutDrag.blockDef.opcode)}
              />
            </div>
          )}
        </div>

        {/* --- RIGHT: Stage + Sprite info + Sprite list --- */}
        <div
          className={`w-1.5 shrink-0 cursor-col-resize transition-colors ${activeResize === 'right' ? 'bg-[#855cd6]' : 'bg-transparent hover:bg-[#d7c9f6]'}`}
          onPointerDown={() => setActiveResize('right')}
          role="separator"
          aria-label="Resize stage pane"
        />

        <div ref={stageContainerRef} className="shrink-0 flex flex-col min-h-0 border-l border-[#e0e0e0]" style={{ width: rightPaneWidth }}>
          {/* Stage area with green flag / stop */}
          <div className="bg-[#e8edf1] p-2">
            {/* Green flag & stop controls */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <button
                onClick={runPreview}
                disabled={isRunning || !vmReady}
                className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-[#d0f0d0] transition-colors"
                title="Green Flag"
              >
                <Flag className="w-5 h-5 text-[#4caf50]" style={{ fill: '#4caf50' }} />
              </button>
              <button
                onClick={handleVmStop}
                className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-[#fdd] transition-colors"
                title="Stop"
              >
                <StopCircle className="w-5 h-5 text-[#ec5959]" style={{ fill: '#ec5959' }} />
              </button>
              <div className="flex-1" />
              <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/60" title="Fullscreen" onClick={() => void toggleStageFullscreen()}>
                <Maximize2 className="w-4 h-4 text-[#575e75]" />
              </button>
            </div>
            {/* Canvas */}
            <div className="rounded-lg bg-white border border-[#d0d0d0] overflow-hidden" style={{ aspectRatio: '480/360' }}>
              <canvas
                ref={canvasRef}
                width={480}
                height={360}
                className="w-full h-full"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>

          {/* Sprite info pane */}
          <div className="bg-white border-t border-b border-[#e0e0e0] px-3 py-2 shrink-0">
            <div className="flex items-center gap-3 text-[13px] text-[#575e75]">
              <span className="font-semibold text-[#575e75]">Sprite</span>
              <input
                value={selectedTarget?.isStage ? 'Stage' : (selectedTarget?.name || 'Sprite1')}
                disabled={selectedTarget?.isStage}
                onChange={(e) => {
                  if (selectedTarget?.isStage) return;
                  const nextName = e.target.value;
                  updateProject((current) => ({
                    ...current,
                    targets: current.targets.map((target, idx) => idx === selectedTargetIndex ? { ...target, name: nextName } : target),
                  }));
                }}
                className="h-7 rounded border border-[#d0d0d0] px-2 flex-1 text-[13px] min-w-0 disabled:bg-[#f5f5f5] disabled:text-[#999]"
              />
              <div className="flex items-center gap-1 text-[12px]">
                <span className="text-[#b5b5b5]">↔</span> x
                <input className="w-10 h-7 rounded border border-[#d0d0d0] text-center text-[12px]" value={Math.round(stagePreview.x)} readOnly />
              </div>
              <div className="flex items-center gap-1 text-[12px]">
                <span className="text-[#b5b5b5]">↕</span> y
                <input className="w-10 h-7 rounded border border-[#d0d0d0] text-center text-[12px]" value={Math.round(stagePreview.y)} readOnly />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[12px] text-[#575e75]">
              <div className="flex items-center gap-1">
                Show
                <button onClick={() => setSpriteVisible(true)} className={`w-6 h-6 rounded flex items-center justify-center ${spriteVisible ? 'bg-[#855cd6] text-white' : 'bg-[#f0f0f0]'}`}><Eye className="w-3 h-3" /></button>
                <button onClick={() => setSpriteVisible(false)} className={`w-6 h-6 rounded flex items-center justify-center ${!spriteVisible ? 'bg-[#855cd6] text-white' : 'bg-[#f0f0f0]'}`}><EyeOff className="w-3 h-3" /></button>
              </div>
              <div className="flex items-center gap-1">
                Size <input className="w-10 h-6 rounded border border-[#d0d0d0] text-center text-[11px]" value={Math.round(stagePreview.size || 100)} readOnly />
              </div>
              <div className="flex items-center gap-1">
                Direction <input className="w-10 h-6 rounded border border-[#d0d0d0] text-center text-[11px]" value={Math.round(stagePreview.direction || 90)} readOnly />
              </div>
            </div>
          </div>

          {/* Sprite list + Stage/Backdrops tabs */}
          <div className="flex-1 min-h-0 flex">
            {/* Sprite list */}
            <div className="flex-1 overflow-y-auto p-2 bg-[#f0f4f8]">
              <div className="flex flex-wrap gap-2 content-start">
                {spriteTargets.map((target, index) => {
                  const mappedIndex = project.targets.findIndex((t) => t.name === target.name && !t.isStage);
                  const selected = mappedIndex === selectedTargetIndex;
                  const costumeSrc = target.costumes?.[0]?.md5ext && archive?.files?.[target.costumes[0].md5ext]
                    ? `data:${imgMime(target.costumes[0].dataFormat)};base64,${archive.files[target.costumes[0].md5ext]}`
                    : null;
                  return (
                    <button
                      key={target.name + index}
                      onClick={() => setSelectedTargetIndex(mappedIndex)}
                      className={`w-[80px] rounded-lg border-2 p-1.5 flex flex-col items-center transition-colors ${
                        selected ? 'border-[#855cd6] bg-[#ede7ff]' : 'border-[#d0d0d0] bg-white hover:border-[#b0b0b0]'
                      }`}
                    >
                      <div className="w-14 h-14 rounded bg-[#f4f7ff] flex items-center justify-center overflow-hidden">
                        {costumeSrc ? <img src={costumeSrc} alt={target.name} className="max-w-full max-h-full" /> : <span className="text-2xl">🐱</span>}
                      </div>
                      <div className="text-[10px] mt-1 text-[#575e75] truncate w-full text-center">{target.name}</div>
                    </button>
                  );
                })}
                <button onClick={addSprite} className="w-[80px] h-[90px] rounded-lg border-2 border-dashed border-[#b0b0b0] bg-white/60 flex items-center justify-center hover:border-[#855cd6] transition-colors">
                  <Plus className="w-5 h-5 text-[#855cd6]" />
                </button>
              </div>
            </div>

            {/* Stage / Backdrops panel */}
            <div className="w-[120px] border-l border-[#e0e0e0] bg-white flex flex-col shrink-0 min-h-0">
              <div className="px-2 pt-2 pb-1 flex items-center justify-between">
                <div className="text-[11px] font-bold text-[#575e75]">Stage</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setLibraryOpen('backdrops')}
                    className="w-5 h-5 rounded-full bg-[#4c97ff] text-white flex items-center justify-center hover:bg-[#3d79cc] text-[9px] font-bold"
                    title="Choose backdrop"
                  >
                    🔍
                  </button>
                  <button
                    onClick={() => backdropInputRef.current?.click()}
                    className="w-5 h-5 rounded-full bg-[#855cd6] text-white flex items-center justify-center hover:bg-[#7248bf]"
                    title="Upload backdrop"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <input ref={backdropInputRef} className="hidden" type="file" accept="image/*,.svg" onChange={(e) => e.target.files?.[0] && addBackdrop(e.target.files[0])} />
              </div>
              <div className="text-[9px] text-[#575e75] px-2 mb-1">Backdrops</div>
              <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-1.5">
                {stageBackdrops.map((backdrop, idx) => {
                  const src = archive?.files?.[backdrop.md5ext]
                    ? `data:${imgMime(backdrop.dataFormat)};base64,${archive.files[backdrop.md5ext]}`
                    : null;
                  const selected = idx === stageCurrentBackdrop;
                  return (
                    <button
                      key={backdrop.assetId}
                      onClick={() => setStageBackdrop(idx)}
                      className={`w-full rounded border-2 p-1 transition-colors ${selected ? 'border-[#855cd6] bg-[#f0ebff]' : 'border-[#d0d0d0] hover:border-[#b0b0b0]'}`}
                    >
                      <div className="w-full aspect-[4/3] rounded bg-[#f4f7ff] flex items-center justify-center overflow-hidden">
                        {src ? <img src={src} alt={backdrop.name} className="max-w-full max-h-full" /> : <span className="text-xs text-[#b0b0b0]">🖼</span>}
                      </div>
                      <div className="text-[9px] text-[#575e75] mt-0.5 truncate text-center">{idx + 1}. {backdrop.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== JSON DEBUG (collapsible) ===== */}
      {showJson && (
        <div className="h-[160px] border-t border-[#d0d0d0] bg-[#fafafa] p-2 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-[#575e75]">project.json</span>
            <div className="flex items-center gap-2">
              {vmError && <span className="text-[11px] text-destructive max-w-[300px] truncate">⚠ {vmError}</span>}
              <button onClick={applyJsonDraft} className="text-[11px] px-2 py-0.5 rounded bg-[#855cd6] text-white">Apply</button>
            </div>
          </div>
          <textarea
            className="w-full h-[120px] border border-[#d0d0d0] rounded bg-white p-2 text-[11px] font-mono resize-none"
            value={projectJsonDraft || archive?.projectJson || formatJson(project)}
            onChange={(e) => setProjectJsonDraft(e.target.value)}
            spellCheck={false}
          />
          {jsonError && <div className="text-[11px] text-destructive mt-0.5">{jsonError}</div>}
        </div>
      )}

      {/* Variable / List creation dialog */}
      {dataPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDataPrompt(null)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-[320px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-bold text-[#575e75] mb-3">
              {dataPrompt.type === 'variable' ? 'New Variable' : 'New List'}
            </div>
            <div className="text-[13px] text-[#575e75] mb-1">
              {dataPrompt.type === 'variable' ? 'Variable' : 'List'} name:
            </div>
            <input
              autoFocus
              className="w-full h-9 rounded-lg border-2 border-[#855cd6] px-3 text-[14px] outline-none"
              value={dataPrompt.name}
              onChange={(e) => setDataPrompt({ ...dataPrompt, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDataPromptSubmit(); if (e.key === 'Escape') setDataPrompt(null); }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setDataPrompt(null)} className="px-4 py-1.5 rounded-lg text-[13px] text-[#575e75] border border-[#d0d0d0] hover:bg-[#f0f0f0]">Cancel</button>
              <button onClick={handleDataPromptSubmit} className="px-4 py-1.5 rounded-lg text-[13px] text-white bg-[#855cd6] hover:bg-[#7248bf]">OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Make a Block — full editor modal */}
      {makeBlockModal && (() => {
        const myColor = currentCategoryColors['My Blocks'] || '#ff6680';
        const previewName = makeBlockModal.name.trim() || 'block name';
        const previewArgs = makeBlockModal.args
          .map((a) => {
            if (a.type === 'label') return a.name.trim();
            if (a.type === 'boolean') return `<${a.name || 'boolean'}>`;
            return `[${a.name || 'number or text'}]`;
          })
          .filter(Boolean)
          .join(' ');
        const previewLabel = `define ${previewName}${previewArgs ? ' ' + previewArgs : ''}`;
        const updateArg = (idx: number, patch: Partial<ProcArg>) => {
          setMakeBlockModal({
            ...makeBlockModal,
            args: makeBlockModal.args.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
          });
        };
        const removeArg = (idx: number) => {
          setMakeBlockModal({
            ...makeBlockModal,
            args: makeBlockModal.args.filter((_, i) => i !== idx),
          });
        };
        const addArg = (type: ProcArgType) => {
          const defaultName =
            type === 'label'
              ? 'label text'
              : type === 'boolean'
                ? `boolean${makeBlockModal.args.filter((a) => a.type === 'boolean').length + 1}`
                : `arg${makeBlockModal.args.filter((a) => a.type === 'string_number').length + 1}`;
          setMakeBlockModal({
            ...makeBlockModal,
            args: [...makeBlockModal.args, { type, name: defaultName, id: generateId() }],
          });
        };
        const submit = () => {
          const name = makeBlockModal.name.trim();
          if (!name) return;
          // Build proccode from name + args
          const parts: string[] = [name];
          makeBlockModal.args.forEach((a) => {
            if (a.type === 'label') parts.push(a.name.trim());
            else if (a.type === 'boolean') parts.push('%b');
            else parts.push('%s');
          });
          const proccode = parts.filter(Boolean).join(' ');
          if (!customProcedures.some((p) => p.proccode === proccode)) {
            addBlock({
              label: previewLabel,
              opcode: 'procedures_definition',
              proccode,
              procArgs: makeBlockModal.args,
              procWarp: makeBlockModal.runWithoutRefresh,
              minVersion: 'scratch2',
            });
          }
          setMakeBlockModal(null);
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMakeBlockModal(null)}>
            <div
              className="bg-white rounded-2xl shadow-2xl w-[640px] max-w-[95vw] overflow-hidden border-4"
              style={{ borderColor: myColor }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: myColor }}>
                <div className="text-white text-[16px] font-bold w-full text-center">Make a Block</div>
                <button onClick={() => setMakeBlockModal(null)} className="text-white/90 hover:text-white text-xl leading-none">×</button>
              </div>

              {/* Block preview */}
              <div className="bg-[#eef2ff] px-6 py-6 flex flex-col items-center gap-3">
                <ScratchBlockShape label={previewLabel} color={myColor} shape="hat" />
                <input
                  autoFocus
                  value={makeBlockModal.name}
                  onChange={(e) => setMakeBlockModal({ ...makeBlockModal, name: e.target.value })}
                  placeholder="block name"
                  className="w-[300px] h-9 rounded-lg border-2 px-3 text-[14px] outline-none text-center"
                  style={{ borderColor: myColor }}
                  onKeyDown={(e) => { if (e.key === 'Escape') setMakeBlockModal(null); }}
                />

                {/* Args list */}
                {makeBlockModal.args.length > 0 && (
                  <div className="w-full max-w-[480px] space-y-1.5 mt-1">
                    {makeBlockModal.args.map((a, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white rounded-lg border border-[#d0d0d0] px-2 py-1.5">
                        <span
                          className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded text-white"
                          style={{ background: a.type === 'boolean' ? '#59c059' : a.type === 'label' ? '#a0a0a0' : '#5cb1d6' }}
                        >
                          {a.type === 'string_number' ? 'value' : a.type === 'boolean' ? 'bool' : 'text'}
                        </span>
                        <input
                          value={a.name}
                          onChange={(e) => updateArg(idx, { name: e.target.value })}
                          className="flex-1 h-7 rounded border border-[#d0d0d0] px-2 text-[12px] outline-none focus:border-[#855cd6]"
                        />
                        <button
                          onClick={() => removeArg(idx)}
                          className="text-[#575e75] hover:text-destructive text-[16px] leading-none px-1"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add arg buttons */}
                <div className="flex gap-2 mt-1 flex-wrap justify-center">
                  <button
                    onClick={() => addArg('string_number')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#5cb1d6] text-white text-[12px] font-semibold hover:brightness-110"
                  >
                    <span className="bg-white/30 rounded-full px-1.5 text-[10px]">+</span>
                    Add an input <span className="opacity-80">number or text</span>
                  </button>
                  <button
                    onClick={() => addArg('boolean')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#59c059] text-white text-[12px] font-semibold hover:brightness-110"
                  >
                    <span className="bg-white/30 rounded-full px-1.5 text-[10px]">+</span>
                    Add an input <span className="opacity-80">boolean</span>
                  </button>
                  <button
                    onClick={() => addArg('label')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#a0a0a0] text-white text-[12px] font-semibold hover:brightness-110"
                  >
                    <span className="bg-white/30 rounded-full px-1.5 text-[10px]">+</span>
                    Add a label
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4">
                <label className="flex items-center gap-2 text-[13px] text-[#575e75] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={makeBlockModal.runWithoutRefresh}
                    onChange={(e) => setMakeBlockModal({ ...makeBlockModal, runWithoutRefresh: e.target.checked })}
                  />
                  Run without screen refresh
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMakeBlockModal(null)}
                    className="px-4 py-1.5 rounded-lg text-[13px] text-[#575e75] border border-[#d0d0d0] hover:bg-[#f0f0f0]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    className="px-5 py-1.5 rounded-lg text-[13px] text-white hover:brightness-110"
                    style={{ background: myColor }}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Field dropdown picker (canvas blocks) */}
      {fieldPicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setFieldPicker(null)} />
          <div
            className="fixed z-50 bg-white border border-[#d0d0d0] rounded-lg shadow-xl py-1 min-w-[160px] max-h-[320px] overflow-y-auto"
            style={{ left: fieldPicker.x, top: fieldPicker.y + 6 }}
          >
            {fieldPicker.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  const { menuBlockId, fieldKey } = fieldPicker;
                  updateProject((current) => ({
                    ...current,
                    targets: current.targets.map((t, idx) => {
                      if (idx !== selectedTargetIndex) return t;
                      const blocks = { ...(t.blocks || {}) };
                      const mb = blocks[menuBlockId];
                      if (!mb) return t;
                      blocks[menuBlockId] = { ...mb, fields: { ...(mb.fields || {}), [fieldKey]: [opt.value, null] } };
                      return { ...t, blocks };
                    }),
                  }));
                  setFieldPicker(null);
                }}
                className="block w-full text-left px-3 py-1.5 text-[13px] text-[#575e75] hover:bg-[#f0ebff]"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
      {libraryOpen && (
        <ScratchLibraryDialog
          mode={libraryOpen}
          open={true}
          onClose={() => setLibraryOpen(null)}
          onSelect={addLibraryAsset}
        />
      )}
      {blockContextMenu && (
        <>
          <div
            className="fixed inset-0 z-[60]"
            onClick={() => setBlockContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setBlockContextMenu(null); }}
          />
          <div
            className="fixed z-[61] min-w-[160px] rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1 text-sm"
            style={{ left: blockContextMenu.x, top: blockContextMenu.y }}
          >
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              onClick={() => { duplicateBlockStack(blockContextMenu.blockId); setBlockContextMenu(null); }}
            >
              Duplicate
            </button>
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              onClick={() => { deleteBlockStack(blockContextMenu.blockId); setBlockContextMenu(null); }}
            >
              Delete Block
            </button>
            <div className="my-1 border-t border-border" />
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              onClick={() => { cleanUpBlocks(); setBlockContextMenu(null); }}
            >
              Clean up Blocks
            </button>
          </div>
        </>
      )}
      {unsupportedVersionPrompt && (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/60"
            onClick={() => setUnsupportedVersionPrompt(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[81] w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background text-foreground shadow-2xl"
          >
            <div className="p-5 space-y-3">
              <h2 className="text-lg font-semibold">
                {SCRATCH_VERSION_OPTIONS.find((o) => o.value === unsupportedVersionPrompt.version)?.label} is not fully supported
              </h2>
              <p className="text-sm text-muted-foreground">
                {unsupportedVersionPrompt.source === 'import'
                  ? `“${unsupportedVersionPrompt.fileName}” looks like a legacy Scratch project. `
                  : ''}
                {unsupportedVersionPrompt.version === 'scratch14'
                  ? "Scratch 1.4 projects use a binary format the in-browser VM can't fully run. Many blocks, sprites, and sounds may be missing or behave incorrectly."
                  : 'Scratch 2 support is experimental. The project will be auto-converted to the Scratch 3 VM, but some blocks, extensions, or assets may not work as expected.'}
              </p>
              <p className="text-xs text-muted-foreground">
                For best results, open the project in the official Scratch app and re-export it as <code className="font-mono">.sb3</code>.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setUnsupportedVersionPrompt(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                onClick={() => {
                  const prompt = unsupportedVersionPrompt;
                  setUnsupportedVersionPrompt(null);
                  void prompt.onConfirm();
                }}
              >
                Continue anyway
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
