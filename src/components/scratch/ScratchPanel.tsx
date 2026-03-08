import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  StopCircle,
  Maximize2,
  Plus,
  Flag,
  Volume2,
  Brush,
  Code2,
  Search,
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
import { ScratchArchive, exportSb3, importSb3 } from '@/services/scratchSb3';

// These packages may fail to import in some environments — load them dynamically
let RenderWebGL: (new (canvas: HTMLCanvasElement) => { draw(): void; destroy(): void }) | null = null;
let ScratchStorageCtor: (new () => { AssetType: Record<string, string>; addWebStore: (...args: unknown[]) => void }) | null = null;
let AudioEngineCtor: (new () => { dispose(): void }) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RenderWebGL = require('scratch-render');
  if (RenderWebGL && typeof RenderWebGL === 'object' && 'default' in (RenderWebGL as Record<string, unknown>)) {
    RenderWebGL = (RenderWebGL as unknown as { default: typeof RenderWebGL }).default;
  }
} catch (e) { console.warn('scratch-render not available:', e); }

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ScratchStorageCtor = require('scratch-storage');
  if (ScratchStorageCtor && typeof ScratchStorageCtor === 'object' && 'default' in (ScratchStorageCtor as Record<string, unknown>)) {
    ScratchStorageCtor = (ScratchStorageCtor as unknown as { default: typeof ScratchStorageCtor }).default;
  }
} catch (e) { console.warn('scratch-storage not available:', e); }

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AudioEngineCtor = require('scratch-audio');
  if (AudioEngineCtor && typeof AudioEngineCtor === 'object' && 'default' in (AudioEngineCtor as Record<string, unknown>)) {
    AudioEngineCtor = (AudioEngineCtor as unknown as { default: typeof AudioEngineCtor }).default;
  }
} catch (e) { console.warn('scratch-audio not available:', e); }

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
  loadProject: (projectData: ArrayBuffer) => Promise<void>;
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

type ScratchBlockDef = {
  label: string;
  opcode: string;
  inputs?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  action?: 'create_variable' | 'create_list';
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
    { label: 'move 10 steps', opcode: 'motion_movesteps', inputs: { STEPS: [1, [4, '10']] } },
    { label: 'turn ⟳ 15 degrees', opcode: 'motion_turnright', inputs: { DEGREES: [1, [4, '15']] } },
    { label: 'turn ⟲ 15 degrees', opcode: 'motion_turnleft', inputs: { DEGREES: [1, [4, '15']] } },
    { label: 'go to random position', opcode: 'motion_goto', fields: { TO: ['_random_', null] } },
    { label: 'go to x: 0  y: 0', opcode: 'motion_gotoxy', inputs: { X: [1, [4, '0']], Y: [1, [4, '0']] } },
    { label: 'glide 1 secs to random position', opcode: 'motion_glideto', inputs: { SECS: [1, [4, '1']] }, fields: { TO: ['_random_', null] } },
    { label: 'glide 1 secs to x: 0  y: 0', opcode: 'motion_glidesecstoxy', inputs: { SECS: [1, [4, '1']], X: [1, [4, '0']], Y: [1, [4, '0']] } },
    { label: 'point in direction 90', opcode: 'motion_pointindirection', inputs: { DIRECTION: [1, [4, '90']] } },
    { label: 'point towards mouse-pointer', opcode: 'motion_pointtowards', fields: { TOWARDS: ['_mouse_', null] } },
    { label: 'change x by 10', opcode: 'motion_changexby', inputs: { DX: [1, [4, '10']] } },
    { label: 'set x to 0', opcode: 'motion_setx', inputs: { X: [1, [4, '0']] } },
    { label: 'change y by 10', opcode: 'motion_changeyby', inputs: { DY: [1, [4, '10']] } },
    { label: 'set y to 0', opcode: 'motion_sety', inputs: { Y: [1, [4, '0']] } },
    { label: 'if on edge, bounce', opcode: 'motion_ifonedgebounce' },
  ],
  Looks: [
    { label: 'say Hello! for 2 seconds', opcode: 'looks_sayforsecs', inputs: { MESSAGE: [1, [10, 'Hello!']], SECS: [1, [4, '2']] } },
    { label: 'say Hello!', opcode: 'looks_say', inputs: { MESSAGE: [1, [10, 'Hello!']] } },
    { label: 'think Hmm... for 2 seconds', opcode: 'looks_thinkforsecs', inputs: { MESSAGE: [1, [10, 'Hmm...']], SECS: [1, [4, '2']] } },
    { label: 'think Hmm...', opcode: 'looks_think', inputs: { MESSAGE: [1, [10, 'Hmm...']] } },
    { label: 'switch costume to', opcode: 'looks_switchcostumeto' },
    { label: 'next costume', opcode: 'looks_nextcostume' },
    { label: 'switch backdrop to', opcode: 'looks_switchbackdropto' },
    { label: 'next backdrop', opcode: 'looks_nextbackdrop' },
    { label: 'change size by 10', opcode: 'looks_changesizeby', inputs: { CHANGE: [1, [4, '10']] } },
    { label: 'set size to 100%', opcode: 'looks_setsizeto', inputs: { SIZE: [1, [4, '100']] } },
    { label: 'change color effect by 25', opcode: 'looks_changeeffectby', inputs: { CHANGE: [1, [4, '25']] }, fields: { EFFECT: ['COLOR', null] } },
    { label: 'set color effect to 0', opcode: 'looks_seteffectto', inputs: { VALUE: [1, [4, '0']] }, fields: { EFFECT: ['COLOR', null] } },
    { label: 'clear graphic effects', opcode: 'looks_cleargraphiceffects' },
    { label: 'show', opcode: 'looks_show' },
    { label: 'hide', opcode: 'looks_hide' },
    { label: 'go to front layer', opcode: 'looks_gotofrontback', fields: { FRONT_BACK: ['front', null] } },
    { label: 'go back 1 layers', opcode: 'looks_goforwardbackwardlayers', inputs: { NUM: [1, [4, '1']] }, fields: { FORWARD_BACKWARD: ['backward', null] } },
  ],
  Sound: [
    { label: 'play sound until done', opcode: 'sound_playuntildone' },
    { label: 'start sound', opcode: 'sound_play' },
    { label: 'stop all sounds', opcode: 'sound_stopallsounds' },
    { label: 'change pitch effect by 10', opcode: 'sound_changeeffectby', inputs: { VALUE: [1, [4, '10']] }, fields: { EFFECT: ['PITCH', null] } },
    { label: 'set pitch effect to 100', opcode: 'sound_seteffectto', inputs: { VALUE: [1, [4, '100']] }, fields: { EFFECT: ['PITCH', null] } },
    { label: 'clear sound effects', opcode: 'sound_cleareffects' },
    { label: 'change volume by -10', opcode: 'sound_changevolumeby', inputs: { VOLUME: [1, [4, '-10']] } },
    { label: 'set volume to 100%', opcode: 'sound_setvolumeto', inputs: { VOLUME: [1, [4, '100']] } },
  ],
  Events: [
    { label: 'when 🏴 clicked', opcode: 'event_whenflagclicked' },
    { label: 'when space key pressed', opcode: 'event_whenkeypressed', fields: { KEY_OPTION: ['space', null] } },
    { label: 'when this sprite clicked', opcode: 'event_whenthisspriteclicked' },
    { label: 'when backdrop switches to', opcode: 'event_whenbackdropswitchesto' },
    { label: 'when loudness > 10', opcode: 'event_whengreaterthan', inputs: { VALUE: [1, [4, '10']] }, fields: { WHENGREATERTHANMENU: ['LOUDNESS', null] } },
    { label: 'when I receive message1', opcode: 'event_whenbroadcastreceived', fields: { BROADCAST_OPTION: ['message1', null] } },
    { label: 'broadcast message1', opcode: 'event_broadcast', inputs: { BROADCAST_INPUT: [1, [11, 'message1', 'message1']] } },
    { label: 'broadcast message1 and wait', opcode: 'event_broadcastandwait', inputs: { BROADCAST_INPUT: [1, [11, 'message1', 'message1']] } },
  ],
  Control: [
    { label: 'wait 1 seconds', opcode: 'control_wait', inputs: { DURATION: [1, [4, '1']] } },
    { label: 'repeat 10', opcode: 'control_repeat', inputs: { TIMES: [1, [4, '10']] } },
    { label: 'forever', opcode: 'control_forever' },
    { label: 'if < > then', opcode: 'control_if' },
    { label: 'if < > then else', opcode: 'control_if_else' },
    { label: 'wait until < >', opcode: 'control_wait_until' },
    { label: 'repeat until < >', opcode: 'control_repeat_until' },
    { label: 'stop all', opcode: 'control_stop', fields: { STOP_OPTION: ['all', null] } },
    { label: 'when I start as a clone', opcode: 'control_start_as_clone' },
    { label: 'create clone of myself', opcode: 'control_create_clone_of', fields: { CLONE_OPTION: ['_myself_', null] } },
    { label: 'delete this clone', opcode: 'control_delete_this_clone' },
  ],
  Sensing: [
    { label: 'touching mouse-pointer?', opcode: 'sensing_touchingobject', fields: { TOUCHINGOBJECTMENU: ['_mouse_', null] } },
    { label: 'touching color?', opcode: 'sensing_touchingcolor' },
    { label: 'color is touching?', opcode: 'sensing_coloristouchingcolor' },
    { label: 'distance to mouse-pointer', opcode: 'sensing_distanceto', fields: { DISTANCETOMENU: ['_mouse_', null] } },
    { label: 'ask What is your name? and wait', opcode: 'sensing_askandwait', inputs: { QUESTION: [1, [10, 'What is your name?']] } },
    { label: 'answer', opcode: 'sensing_answer' },
    { label: 'key space pressed?', opcode: 'sensing_keypressed', fields: { KEY_OPTION: ['space', null] } },
    { label: 'mouse down?', opcode: 'sensing_mousedown' },
    { label: 'mouse x', opcode: 'sensing_mousex' },
    { label: 'mouse y', opcode: 'sensing_mousey' },
    { label: 'loudness', opcode: 'sensing_loudness' },
    { label: 'timer', opcode: 'sensing_timer' },
    { label: 'reset timer', opcode: 'sensing_resettimer' },
    { label: 'current year', opcode: 'sensing_current', fields: { CURRENTMENU: ['YEAR', null] } },
    { label: 'days since 2000', opcode: 'sensing_dayssince2000' },
  ],
  Operators: [
    { label: '( ) + ( )', opcode: 'operator_add', inputs: { NUM1: [1, [4, '']], NUM2: [1, [4, '']] } },
    { label: '( ) - ( )', opcode: 'operator_subtract', inputs: { NUM1: [1, [4, '']], NUM2: [1, [4, '']] } },
    { label: '( ) * ( )', opcode: 'operator_multiply', inputs: { NUM1: [1, [4, '']], NUM2: [1, [4, '']] } },
    { label: '( ) / ( )', opcode: 'operator_divide', inputs: { NUM1: [1, [4, '']], NUM2: [1, [4, '']] } },
    { label: 'pick random 1 to 10', opcode: 'operator_random', inputs: { FROM: [1, [4, '1']], TO: [1, [4, '10']] } },
    { label: '( ) > ( )', opcode: 'operator_gt', inputs: { OPERAND1: [1, [10, '']], OPERAND2: [1, [10, '']] } },
    { label: '( ) < ( )', opcode: 'operator_lt', inputs: { OPERAND1: [1, [10, '']], OPERAND2: [1, [10, '']] } },
    { label: '( ) = ( )', opcode: 'operator_equals', inputs: { OPERAND1: [1, [10, '']], OPERAND2: [1, [10, '']] } },
    { label: '( ) and ( )', opcode: 'operator_and' },
    { label: '( ) or ( )', opcode: 'operator_or' },
    { label: 'not ( )', opcode: 'operator_not' },
    { label: 'join apple banana', opcode: 'operator_join', inputs: { STRING1: [1, [10, 'apple']], STRING2: [1, [10, 'banana']] } },
    { label: 'letter 1 of apple', opcode: 'operator_letter_of', inputs: { LETTER: [1, [4, '1']], STRING: [1, [10, 'apple']] } },
    { label: 'length of apple', opcode: 'operator_length', inputs: { STRING: [1, [10, 'apple']] } },
    { label: 'apple contains a?', opcode: 'operator_contains', inputs: { STRING1: [1, [10, 'apple']], STRING2: [1, [10, 'a']] } },
    { label: '( ) mod ( )', opcode: 'operator_mod', inputs: { NUM1: [1, [4, '']], NUM2: [1, [4, '']] } },
    { label: 'round ( )', opcode: 'operator_round', inputs: { NUM: [1, [4, '']] } },
    { label: 'abs of ( )', opcode: 'operator_mathop', inputs: { NUM: [1, [4, '']] }, fields: { OPERATOR: ['abs', null] } },
  ],
  Variables: [
    { label: 'Make a Variable', opcode: 'data_setvariableto', inputs: { VALUE: [1, [10, '0']] }, action: 'create_variable' },
    { label: 'Make a List', opcode: 'data_addtolist', inputs: { ITEM: [1, [10, 'thing']] }, action: 'create_list' },
    { label: 'set my variable to 0', opcode: 'data_setvariableto', inputs: { VALUE: [1, [10, '0']] } },
    { label: 'change my variable by 1', opcode: 'data_changevariableby', inputs: { VALUE: [1, [4, '1']] } },
    { label: 'show variable', opcode: 'data_showvariable' },
    { label: 'hide variable', opcode: 'data_hidevariable' },
    { label: 'add thing to list', opcode: 'data_addtolist', inputs: { ITEM: [1, [10, 'thing']] } },
    { label: 'delete 1 of list', opcode: 'data_deleteoflist', inputs: { INDEX: [1, [4, '1']] } },
    { label: 'delete all of list', opcode: 'data_deletealloflist' },
    { label: 'insert thing at 1 of list', opcode: 'data_insertatlist', inputs: { ITEM: [1, [10, 'thing']], INDEX: [1, [4, '1']] } },
    { label: 'replace item 1 of list with thing', opcode: 'data_replaceitemoflist', inputs: { INDEX: [1, [4, '1']], ITEM: [1, [10, 'thing']] } },
    { label: 'item 1 of list', opcode: 'data_itemoflist', inputs: { INDEX: [1, [4, '1']] } },
    { label: 'length of list', opcode: 'data_lengthoflist' },
    { label: 'list contains thing?', opcode: 'data_listcontainsitem', inputs: { ITEM: [1, [10, 'thing']] } },
    { label: 'show list', opcode: 'data_showlist' },
    { label: 'hide list', opcode: 'data_hidelist' },
  ],
  'My Blocks': [
    { label: 'Make a Block', opcode: 'procedures_definition' },
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
];

const generateId = () => Math.random().toString(36).slice(2, 10);
const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const DEFAULT_STAGE_COSTUME_FILE = 'cdx-stage-default.svg';
const DEFAULT_SPRITE_COSTUME_FILE = 'cdx-sprite-default.svg';
const DEFAULT_STAGE_COSTUME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360"><defs><linearGradient id="bg" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#87ceeb"/><stop offset="1" stop-color="#dff3ff"/></linearGradient></defs><rect width="480" height="360" fill="url(#bg)"/><circle cx="410" cy="70" r="40" fill="#ffd35a"/><rect y="260" width="480" height="100" fill="#95d08f"/></svg>`;
const DEFAULT_SPRITE_COSTUME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><ellipse cx="48" cy="76" rx="28" ry="14" fill="#d18f3b"/><circle cx="36" cy="40" r="20" fill="#f8a64a"/><circle cx="60" cy="40" r="20" fill="#f8a64a"/><circle cx="48" cy="58" r="20" fill="#f8a64a"/><circle cx="42" cy="56" r="3" fill="#222"/><circle cx="54" cy="56" r="3" fill="#222"/></svg>`;

const utf8ToBase64 = (value: string) => btoa(unescape(encodeURIComponent(value)));

const getDefaultCostumeForTarget = (target: ScratchTarget) => (target.isStage
  ? {
      name: 'backdrop1',
      assetId: 'cdx-stage-default',
      md5ext: DEFAULT_STAGE_COSTUME_FILE,
      dataFormat: 'svg',
      rotationCenterX: 240,
      rotationCenterY: 180,
    }
  : {
      name: 'costume1',
      assetId: 'cdx-sprite-default',
      md5ext: DEFAULT_SPRITE_COSTUME_FILE,
      dataFormat: 'svg',
      rotationCenterX: 48,
      rotationCenterY: 48,
    });

const normalizeProjectForVm = (project: ScratchProject): ScratchProject => ({
  ...project,
  targets: project.targets.map((target) => {
    const costumes = target.costumes && target.costumes.length > 0
      ? target.costumes
      : [getDefaultCostumeForTarget(target)];
    return {
      ...target,
      costumes,
      currentCostume: typeof target.currentCostume === 'number'
        ? Math.min(Math.max(0, target.currentCostume), Math.max(0, costumes.length - 1))
        : 0,
    };
  }),
});

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
const isEventBlock = (opcode: string) => opcode.startsWith('event_');
const getBlockColor = (opcode: string) => (opcode.startsWith('motion_') ? '#4c97ff'
  : opcode.startsWith('looks_') ? '#9966ff'
    : opcode.startsWith('sound_') ? '#cf63cf'
      : opcode.startsWith('event_') ? '#ffbf00'
        : opcode.startsWith('control_') ? '#ffab19'
          : opcode.startsWith('sensing_') ? '#5cb1d6'
            : opcode.startsWith('operator_') ? '#59c059'
              : opcode.startsWith('data_') ? '#ff8c1a'
                : opcode.startsWith('procedures_') ? '#ff6680'
                  : '#4c97ff');

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

const createVmCompatibleBlockShape = (
  blockId: string,
  blockDef: ScratchBlockDef,
) => {
  const nextInputs = { ...(blockDef.inputs || {}) };
  const nextFields = { ...(blockDef.fields || {}) };
  const extraBlocks: Record<string, ScratchBlockNode> = {};

  if (blockDef.opcode === 'motion_goto' || blockDef.opcode === 'motion_glideto') {
    const menuId = generateId();
    const toValue = getFieldOption(blockDef.fields, 'TO', '_random_');
    extraBlocks[menuId] = {
      id: menuId,
      opcode: 'motion_goto_menu',
      parent: blockId,
      topLevel: false,
      shadow: true,
      fields: { TO: [toValue, null] },
      inputs: {},
      next: null,
    };
    nextInputs.TO = [1, menuId];
    delete nextFields.TO;
  }

  if (blockDef.opcode === 'motion_pointtowards') {
    const menuId = generateId();
    const towardValue = getFieldOption(blockDef.fields, 'TOWARDS', '_mouse_');
    extraBlocks[menuId] = {
      id: menuId,
      opcode: 'motion_pointtowards_menu',
      parent: blockId,
      topLevel: false,
      shadow: true,
      fields: { TOWARDS: [towardValue, null] },
      inputs: {},
      next: null,
    };
    nextInputs.TOWARDS = [1, menuId];
    delete nextFields.TOWARDS;
  }

  return {
    inputs: nextInputs,
    fields: nextFields,
    extraBlocks,
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
  const [vmError, setVmError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const costumeInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const vmRef = useRef<ScratchVmLike | null>(null);
  const rendererRef = useRef<{ draw(): void; destroy(): void } | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const archiveRef = useRef<ScratchArchive | null>(archive);

  // Keep archiveRef in sync for the storage adapter closure
  useEffect(() => {
    archiveRef.current = archive;
  }, [archive]);

  const project = useMemo(() => safeParseProject(archive), [archive]);
  const selectedTarget = project.targets[Math.max(0, Math.min(project.targets.length - 1, selectedTargetIndex))];
  const selectedBlocks = Object.values(selectedTarget?.blocks || {});
  const spriteTargets = project.targets.filter((target) => !target.isStage);
  const blockLabels = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(categoryBlocks).forEach((defs) => defs.forEach((d) => { map[d.opcode] = d.label; }));
    return map;
  }, []);

  const selectedCostumes = selectedTarget?.costumes || [];
  const selectedSounds = selectedTarget?.sounds || [];
  const currentCostumeIndex = Number(selectedTarget?.currentCostume || 0);
  const activeCostume = selectedCostumes[currentCostumeIndex] || selectedCostumes[0];
  const stageCostumeSrc = activeCostume && archive?.files?.[activeCostume.md5ext]
    ? `data:image/${activeCostume.dataFormat || 'png'};base64,${archive.files[activeCostume.md5ext]}`
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
    const visible = Boolean(runtimeTarget.visible);

    setStagePreview({
      x,
      y,
      direction,
      visible,
      size: 100,
    });
    setSpriteVisible(visible);
  }, [selectedTarget?.name]);

  const loadVmFromArchive = useCallback(async (nextArchive: ScratchArchive) => {
    if (!vmRef.current) return;
    try {
      const normalizedArchive = ensureArchive(nextArchive);
      const data = await exportSb3(normalizedArchive);
      const ab = data.buffer instanceof ArrayBuffer
        ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        : data.slice().buffer;
      await vmRef.current.loadProject(ab);
      setVmError(null);
      syncFromVm();
    } catch (error) {
      console.warn('scratch-vm loadProject warning:', error);
      setVmError(null);
    }
  }, [syncFromVm]);

  // Initialize VM with renderer, storage, and audio engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const VmCtor = VirtualMachine as unknown as { new (): ScratchVmLike };
      const vm = new VmCtor();

      // Attach renderer
      try {
        if (RenderWebGL) {
          const renderer = new RenderWebGL(canvas);
          vm.attachRenderer(renderer);
          rendererRef.current = renderer;
        }
      } catch (e) {
        console.warn('Failed to attach scratch-render:', e);
      }

      // Attach storage with custom web source that resolves from archive
      try {
        if (ScratchStorageCtor) {
          const storage = new ScratchStorageCtor();
          const AssetType = storage.AssetType;

          storage.addWebStore(
            [AssetType.ImageVector, AssetType.ImageBitmap, AssetType.Sound],
            (asset: { assetId: string; dataFormat: string }) => {
              const key = `${asset.assetId}.${asset.dataFormat}`;
              const b64 = archiveRef.current?.files?.[key];
              if (b64) return `data:application/octet-stream;base64,${b64}`;
              return '';
            }
          );
          vm.attachStorage(storage);
        }
      } catch (e) {
        console.warn('Failed to attach scratch-storage:', e);
      }

      // Attach audio engine
      try {
        const audioEngine = new AudioEngine();
        vm.attachAudioEngine(audioEngine);
      } catch (e) {
        console.warn('Failed to attach scratch-audio:', e);
      }

      vm.start();
      vmRef.current = vm;
      setVmReady(true);
      setVmError(null);

      // Start draw loop
      const drawStep = () => {
        if (rendererRef.current) {
          rendererRef.current.draw();
        }
        syncFromVm();
        rafRef.current = requestAnimationFrame(drawStep);
      };
      rafRef.current = requestAnimationFrame(drawStep);
    } catch (error) {
      setVmError(error instanceof Error ? error.message : 'Failed to initialize scratch-vm.');
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      try {
        vmRef.current?.stopAll();
      } catch { /* noop */ }
      try {
        rendererRef.current?.destroy();
      } catch { /* noop */ }
      rendererRef.current = null;
      vmRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!archive || !vmReady) return;
    loadVmFromArchive(archive);
  }, [archive, vmReady, loadVmFromArchive]);

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

  const SNAP_DISTANCE = 40;
  const BLOCK_HEIGHT = 42;

  const findSnapTarget = (blocks: Record<string, ScratchBlockNode>, dropX: number, dropY: number, excludeId?: string): string | null => {
    for (const [id, block] of Object.entries(blocks)) {
      if (id === excludeId) continue;
      if (block.next) continue; // already has a next block
      const bx = block.x ?? 0;
      const by = block.y ?? 0;
      // Check if drop is near the bottom of this block
      if (Math.abs(dropX - bx) < 80 && Math.abs(dropY - (by + BLOCK_HEIGHT)) < SNAP_DISTANCE) {
        return id;
      }
    }
    return null;
  };

  const getStackBottom = (blocks: Record<string, ScratchBlockNode>, startId: string): { x: number; y: number; count: number } => {
    let current = blocks[startId];
    let count = 0;
    while (current?.next && blocks[current.next]) {
      current = blocks[current.next];
      count++;
    }
    return { x: current?.x ?? 0, y: (current?.y ?? 0), count };
  };

  const addBlock = (blockDef: ScratchBlockDef, dropX?: number, dropY?: number) => {
    if (!selectedTarget || selectedTarget.isStage || activeEditorTab !== 'code') return;
    const blockId = generateId();
    const blockCount = Object.keys(selectedTarget.blocks || {}).length;
    const finalX = dropX ?? 40;
    const finalY = dropY ?? (30 + blockCount * 55);

    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        if (blockDef.action === 'create_variable') {
          const vars = { ...(target.variables || {}) };
          const id = generateId();
          const name = getUniqueDataName(Object.values(vars).map(([n]) => n), 'my variable');
          vars[id] = [name, 0];
          return { ...target, variables: vars };
        }
        if (blockDef.action === 'create_list') {
          const lists = { ...(target.lists || {}) };
          const id = generateId();
          const name = getUniqueDataName(Object.values(lists).map(([n]) => n), 'my list');
          lists[id] = [name, []];
          return { ...target, lists };
        }

        const blocks = { ...(target.blocks || {}) };
        const dataResolved = ensureDataRefForTarget(target, blockDef);
        const resolvedBlockDef: ScratchBlockDef = {
          ...blockDef,
          fields: dataResolved.fields,
        };
        const snapParentId = findSnapTarget(blocks, finalX, finalY);

        if (snapParentId && blocks[snapParentId]) {
          const parent = blocks[snapParentId];
          const snapX = parent.x ?? 0;
          const snapY = (parent.y ?? 0) + BLOCK_HEIGHT;
          const vmCompatible = createVmCompatibleBlockShape(blockId, resolvedBlockDef);
          blocks[snapParentId] = { ...parent, next: blockId };
          blocks[blockId] = {
            id: blockId,
            opcode: blockDef.opcode,
            next: null,
            parent: snapParentId,
            topLevel: false,
            x: snapX,
            y: snapY,
            inputs: vmCompatible.inputs,
            fields: vmCompatible.fields,
          };
          Object.assign(blocks, vmCompatible.extraBlocks);
        } else {
          if (isEventBlock(blockDef.opcode)) {
            blocks[blockId] = {
              id: blockId,
              opcode: blockDef.opcode,
              next: null,
              parent: null,
              topLevel: true,
              x: finalX,
              y: finalY,
              inputs: blockDef.inputs || {},
              fields: resolvedBlockDef.fields || {},
            };
          } else {
            const vmCompatible = createVmCompatibleBlockShape(blockId, resolvedBlockDef);
            const eventId = generateId();
            blocks[eventId] = {
              id: eventId,
              opcode: 'event_whenflagclicked',
              next: blockId,
              parent: null,
              topLevel: true,
              x: finalX,
              y: Math.max(24, finalY - BLOCK_HEIGHT),
              inputs: {},
              fields: {},
            };
            blocks[blockId] = {
              id: blockId,
              opcode: blockDef.opcode,
              next: null,
              parent: eventId,
              topLevel: false,
              x: finalX,
              y: finalY,
              inputs: vmCompatible.inputs,
              fields: vmCompatible.fields,
            };
            Object.assign(blocks, vmCompatible.extraBlocks);
          }
        }

        return { ...dataResolved.target, blocks };
      }),
    }));
  };

  const handleWorkspaceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/scratch-block'));
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / workspaceZoom;
      const y = (e.clientY - rect.top) / workspaceZoom;
      addBlock(data, x, y);
    } catch { /* ignore */ }
  };

  const handleBlockDragInWorkspace = (blockId: string, e: React.DragEvent) => {
    const rect = e.currentTarget.closest('.scratch-workspace')?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / workspaceZoom;
    const y = (e.clientY - rect.top) / workspaceZoom;
    updateProject((current) => ({
      ...current,
      targets: current.targets.map((target, idx) => {
        if (idx !== selectedTargetIndex) return target;
        const blocks = { ...(target.blocks || {}) };
        const block = blocks[blockId];
        if (!block) return target;

        // Detach from old parent
        if (block.parent && blocks[block.parent]) {
          blocks[block.parent] = { ...blocks[block.parent], next: null };
        }

        // Try snapping to a new parent
        const snapParentId = findSnapTarget(blocks, x, y, blockId);
        if (snapParentId && blocks[snapParentId]) {
          const parent = blocks[snapParentId];
          const snapX = parent.x ?? 0;
          const snapY = (parent.y ?? 0) + BLOCK_HEIGHT;
          blocks[snapParentId] = { ...parent, next: blockId };
          blocks[blockId] = { ...block, x: snapX, y: snapY, parent: snapParentId, topLevel: false };
        } else {
          blocks[blockId] = { ...block, x, y, parent: null, topLevel: true };
        }

        return { ...target, blocks };
      }),
    }));
  };

  const runPreview = async () => {
    try {
      if (!vmRef.current) return;
      onRun();
      vmRef.current.greenFlag();
      setTimeout(() => {
        syncFromVm();
      }, 120);
    } catch (error) {
      setVmError(error instanceof Error ? error.message : 'VM runtime error.');
      onStop();
    }
  };

  const handleVmStop = () => {
    try {
      vmRef.current?.stopAll();
      syncFromVm();
    } catch {
      // noop
    }
    onStop();
  };

  const handleImport = async (file: File) => {
    const data = await file.arrayBuffer();
    const parsed = await importSb3(data);
    onArchiveChange(parsed.archive);
    onProjectJsonUpdate(parsed.archive.projectJson);
    setProjectJsonDraft(parsed.archive.projectJson);
    setJsonError(null);
    setSelectedTargetIndex(1);
    await loadVmFromArchive(parsed.archive);
  };

  const handleExport = async () => {
    const data = await exportSb3(ensureArchive(archive));
    const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type: 'application/x.scratch.sb3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.sb3';
    a.click();
    URL.revokeObjectURL(url);
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

  return (
    <div className="h-full bg-[#f1f4fa] flex flex-col text-[#4d4d4d]">
      <div className="h-9 border-b border-[#c8d0dd] bg-[#d9e3f2] px-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveEditorTab('code')}
            className={`px-4 h-7 rounded-t-xl text-sm flex items-center gap-1 ${activeEditorTab === 'code' ? 'bg-white text-[#6b5ce7] font-semibold' : 'bg-[#c9d3e4]'}`}
          >
            <Code2 className="w-4 h-4" /> Code
          </button>
          <button
            onClick={() => setActiveEditorTab('costumes')}
            className={`px-4 h-7 rounded-t-xl text-sm flex items-center gap-1 ${activeEditorTab === 'costumes' ? 'bg-white text-[#5a6b8a] font-semibold' : 'bg-[#c9d3e4]'}`}
          >
            <Brush className="w-4 h-4" /> Costumes
          </button>
          <button
            onClick={() => setActiveEditorTab('sounds')}
            className={`px-4 h-7 rounded-t-xl text-sm flex items-center gap-1 ${activeEditorTab === 'sounds' ? 'bg-white text-[#5a6b8a] font-semibold' : 'bg-[#c9d3e4]'}`}
          >
            <Volume2 className="w-4 h-4" /> Sounds
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${vmReady ? 'border-green-400 text-green-700 bg-green-50' : 'border-amber-400 text-amber-700 bg-amber-50'}`}>
            {vmReady ? 'VM Ready' : 'VM Starting'}
          </span>
          <button onClick={runPreview} className="text-green-600" title="Green Flag" disabled={isRunning || !vmReady}>
            <Flag className="w-5 h-5 fill-green-500" />
          </button>
          <button onClick={handleVmStop} className="text-red-500" title="Stop">
            <StopCircle className="w-5 h-5 fill-red-300" />
          </button>
          <button onClick={handleExport} className="px-2 py-1 text-xs rounded bg-white border border-[#c8d0dd]">Export .sb3</button>
          <button onClick={() => importInputRef.current?.click()} className="px-2 py-1 text-xs rounded bg-white border border-[#c8d0dd]">Import .sb3</button>
          <input
            ref={importInputRef}
            className="hidden"
            type="file"
            accept=".sb3"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[340px_1fr_520px]">
        <div className="border-r border-[#c8d0dd] bg-[#f3f5fb] flex min-h-0">
          <div className="w-[74px] border-r border-[#d6ddea] p-2 space-y-2 overflow-y-auto">
            {categoryRail.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`w-full flex flex-col items-center text-[12px] gap-0.5 ${activeCategory === cat.name ? 'text-[#3373cc] font-semibold' : 'text-[#5e6a83]'}`}
              >
                <span className={`w-7 h-7 rounded-full border ${activeCategory === cat.name ? 'border-[#3373cc] ring-2 ring-[#4c97ff]/30' : 'border-[#aeb8cc]'}`} style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex-1 p-2 overflow-y-auto">
            <div className="text-[28px] leading-none mb-1" style={{ color: categoryColors[activeCategory] || '#4c97ff' }}>{activeCategory}</div>
            {activeEditorTab === 'code' ? (
              <div className="space-y-2 pr-2">
                {(categoryBlocks[activeCategory] || []).map((blockDef) => (
                  <button
                    key={blockDef.label}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/scratch-block', JSON.stringify(blockDef));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => addBlock(blockDef)}
                    className="w-full text-left rounded-2xl text-white text-[15px] px-4 py-2 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)] hover:brightness-110 cursor-grab active:cursor-grabbing"
                    style={{ backgroundColor: categoryColors[activeCategory] || '#4c97ff' }}
                  >
                    {blockDef.label}
                  </button>
                ))}
              </div>
            ) : activeEditorTab === 'costumes' ? (
              <div className="h-full rounded-lg border border-[#cfdbef] bg-white p-3 text-sm text-[#5a6682] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Costumes ({selectedCostumes.length})</div>
                  <button className="px-3 py-1.5 rounded-full border border-[#c6d3ea] flex items-center gap-1" onClick={() => costumeInputRef.current?.click()}>
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                  <input ref={costumeInputRef} className="hidden" type="file" accept="image/*,.svg" onChange={(e) => e.target.files?.[0] && addCostume(e.target.files[0])} />
                </div>
                <div className="grid grid-cols-2 gap-2 overflow-auto">
                  {selectedCostumes.map((costume, idx) => {
                    const src = archive?.files?.[costume.md5ext] ? `data:image/${costume.dataFormat || 'png'};base64,${archive.files[costume.md5ext]}` : undefined;
                    return (
                      <button key={costume.assetId} className={`rounded-lg border p-2 text-left ${idx === currentCostumeIndex ? 'border-[#7a5cff] bg-[#f2efff]' : 'border-[#d7deec]'}`} onClick={() => setCurrentCostume(idx)}>
                        <div className="h-16 rounded bg-[#f4f7ff] border border-[#e3e9f5] flex items-center justify-center overflow-hidden">
                          {src ? <img src={src} alt={costume.name} className="max-h-full max-w-full" /> : <span>🎭</span>}
                        </div>
                        <div className="mt-1 text-xs truncate">{costume.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full rounded-lg border border-[#cfdbef] bg-white p-3 text-sm text-[#5a6682] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Sounds ({selectedSounds.length})</div>
                  <button className="px-3 py-1.5 rounded-full border border-[#c6d3ea] flex items-center gap-1" onClick={() => soundInputRef.current?.click()}>
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                  <input ref={soundInputRef} className="hidden" type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && addSound(e.target.files[0])} />
                </div>
                <div className="space-y-2 overflow-auto">
                  {selectedSounds.map((sound) => {
                    const src = archive?.files?.[sound.md5ext] ? `data:audio/${sound.dataFormat || 'wav'};base64,${archive.files[sound.md5ext]}` : '';
                    return (
                      <div key={sound.assetId} className="rounded-lg border border-[#d7deec] p-2 flex items-center justify-between gap-2">
                        <div className="truncate">{sound.name}</div>
                        <button
                          className="w-7 h-7 rounded-full border border-[#c4cee2] flex items-center justify-center"
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
          className="relative bg-[#f9fafc] overflow-hidden scratch-workspace"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={handleWorkspaceDrop}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `scale(${workspaceZoom})`,
              transformOrigin: 'top left',
              backgroundImage: 'radial-gradient(#d8deea 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          >
            {selectedBlocks.map((block) => {
              const blockColor = getBlockColor(block.opcode);
              return (
                <div
                  key={block.id}
                  draggable
                  onDragEnd={(e) => handleBlockDragInWorkspace(block.id, e)}
                  className="absolute rounded-2xl text-white px-3 py-2 text-[13px] min-w-[200px] shadow cursor-grab active:cursor-grabbing select-none border-b-2 border-black/20"
                  style={{ left: block.x ?? 40, top: block.y ?? 40, backgroundColor: blockColor }}
                >
                  <div className="font-medium">{blockLabels[block.opcode] || block.opcode.replace(/_/g, ' ')}</div>
                </div>
              );
            })}
          </div>
          <div className="absolute right-3 bottom-3 flex flex-col gap-2">
            <button className="w-9 h-9 rounded-full bg-white border border-[#c8d0dd] flex items-center justify-center" onClick={() => setWorkspaceZoom((z) => Math.min(1.4, z + 0.1))}><ZoomIn className="w-4 h-4" /></button>
            <button className="w-9 h-9 rounded-full bg-white border border-[#c8d0dd] flex items-center justify-center" onClick={() => setWorkspaceZoom((z) => Math.max(0.7, z - 0.1))}><ZoomOut className="w-4 h-4" /></button>
            <button className="w-9 h-9 rounded-full bg-white border border-[#c8d0dd] flex items-center justify-center" onClick={() => setWorkspaceZoom(1)}><CircleMinus className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="border-l border-[#c8d0dd] bg-[#e5edf9] grid grid-rows-[430px_1fr] min-h-0">
          <div className="p-2">
              <div className="rounded-xl bg-white border border-[#c8d0dd] h-full relative overflow-hidden flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={480}
                height={360}
                className="w-full h-full"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>

          <div className="border-t border-[#c8d0dd] min-h-0 grid grid-rows-[120px_1fr]">
            <div className="p-2 bg-white border-b border-[#d7deeb]">
              <div className="grid grid-cols-[68px_1fr] items-center gap-2 text-sm text-[#4f5f80]">
                <div className="font-semibold">Sprite</div>
                <input
                  value={selectedTarget?.name || 'Sprite1'}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    updateProject((current) => ({
                      ...current,
                      targets: current.targets.map((target, idx) => idx === selectedTargetIndex ? { ...target, name: nextName } : target),
                    }));
                  }}
                  className="h-8 rounded-full border border-[#c8d0dd] px-3"
                />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                <div className="rounded-full border border-[#c8d0dd] h-8 flex items-center justify-center gap-1">x <input className="w-8 bg-transparent text-center" value={Math.round(stagePreview.x)} readOnly /></div>
                <div className="rounded-full border border-[#c8d0dd] h-8 flex items-center justify-center gap-1">y <input className="w-8 bg-transparent text-center" value={Math.round(stagePreview.y)} readOnly /></div>
                <div className="rounded-full border border-[#c8d0dd] h-8 flex items-center justify-center gap-1">size <input className="w-10 bg-transparent text-center" value={Math.round(stagePreview.size || 100)} readOnly /></div>
                <div className="rounded-full border border-[#c8d0dd] h-8 flex items-center justify-center gap-1">dir <input className="w-8 bg-transparent text-center" value={Math.round(stagePreview.direction || 90)} readOnly /></div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span>Show</span>
                <button className="w-8 h-8 rounded border border-[#c8d0dd] flex items-center justify-center" onClick={() => setSpriteVisible(true)}><Eye className="w-4 h-4 text-[#6b5ce7]" /></button>
                <button className="w-8 h-8 rounded border border-[#c8d0dd] flex items-center justify-center" onClick={() => setSpriteVisible(false)}><EyeOff className="w-4 h-4 text-[#6b5ce7]" /></button>
                <button className="w-8 h-8 rounded border border-[#c8d0dd] flex items-center justify-center" onClick={() => setStagePreview((p) => ({ ...p, direction: p.direction - 15 }))}><RotateCcw className="w-4 h-4" /></button>
                <button className="w-8 h-8 rounded border border-[#c8d0dd] flex items-center justify-center" onClick={() => setStagePreview((p) => ({ ...p, direction: p.direction + 15 }))}><RotateCw className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="p-2 overflow-y-auto bg-[#dfe7f7] flex gap-2">
              {spriteTargets.map((target, index) => {
                const mappedIndex = project.targets.findIndex((t) => t.name === target.name && !t.isStage);
                const selected = mappedIndex === selectedTargetIndex;
                return (
                  <button
                    key={target.name + index}
                    onClick={() => setSelectedTargetIndex(mappedIndex)}
                    className={`w-[95px] h-[92px] rounded-xl border-2 flex flex-col items-center justify-center ${selected ? 'border-[#7b61ff] bg-[#ede7ff]' : 'border-[#b9c5dc] bg-white'}`}
                  >
                    <div className="text-3xl">{target.costumes?.length ? '🎭' : '🐱'}</div>
                    <div className="text-xs mt-1">{target.name}</div>
                  </button>
                );
              })}
              <button onClick={addSprite} className="w-[95px] h-[92px] rounded-xl border border-dashed border-[#9db0d3] bg-white/70 flex items-center justify-center">
                <Plus className="w-5 h-5 text-[#6b7ea8]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[180px] border-t border-[#c8d0dd] bg-white p-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-[#6a7b9a]">Raw project.json (compatibility view)</div>
          <div className="flex items-center gap-2">
            {vmError && <span className="text-[11px] text-red-500 max-w-[480px] truncate">VM error: {vmError}</span>}
            <button onClick={applyJsonDraft} className="text-xs px-2 py-1 rounded border border-[#c8d0dd]">Apply</button>
          </div>
        </div>
        <div className="relative h-[136px]">
          <textarea
            className="w-full h-full border border-[#d4ddec] rounded bg-[#f9fbff] p-2 text-[11px] font-mono"
            value={projectJsonDraft || archive?.projectJson || formatJson(project)}
            onChange={(e) => setProjectJsonDraft(e.target.value)}
            spellCheck={false}
          />
          <Search className="absolute right-2 top-2 w-3 h-3 text-[#8b95a8]" />
        </div>
        {jsonError && <div className="text-[11px] text-red-500 mt-1">{jsonError}</div>}
      </div>
    </div>
  );
};
