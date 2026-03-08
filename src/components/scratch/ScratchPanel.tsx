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
import { ScratchArchive, exportSb3, importSb3 } from '@/services/scratchSb3';
import { ScratchBlockShape, getBlockShape } from './ScratchBlockShape';
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
    // These are the block templates — "Make a Variable"/"Make a List" buttons are rendered separately in the flyout
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
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; type: 'variable' | 'list'; id: string; name: string;
    allNames: string[];
  } | null>(null);

  const varBlocks = blocks.filter((b) => !b.opcode.includes('list') && !b.opcode.includes('List'));
  const listBlocks = blocks.filter((b) => b.opcode.includes('list') || b.opcode.includes('List'));

  const varNames = variables.map(([, [name]]) => name);
  const listNames = lists.map(([, [name]]) => name);

  // Replace "my variable" in block labels with the first variable name
  const resolveVarLabel = (label: string) => {
    if (varNames.length > 0) return label.replace('my variable', varNames[0]);
    return label;
  };
  const resolveListLabel = (label: string) => {
    if (listNames.length > 0) return label.replace('my list', listNames[0]);
    return label;
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
          {variables.map(([id, [name]]) => (
            <div key={id} className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-[#ff8c1a]" />
              <div
                className="cursor-pointer"
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
          ))}
        </div>
      )}

      {/* Variable blocks */}
      {variables.length > 0 && (
        <div className="space-y-1.5">
          {varBlocks.map((blockDef) => {
            const shape = getBlockShape(blockDef.opcode);
            return (
              <div
                key={blockDef.label}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/scratch-block', JSON.stringify(blockDef));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onAddBlock(blockDef)}
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
          {lists.map(([id, [name]]) => (
            <div key={id} className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-[#e6832a]" />
              <div
                className="cursor-pointer"
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
          ))}
        </div>
      )}

      {/* List blocks */}
      {lists.length > 0 && (
        <div className="space-y-1.5">
          {listBlocks.map((blockDef) => {
            const shape = getBlockShape(blockDef.opcode);
            return (
              <div
                key={blockDef.label}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/scratch-block', JSON.stringify(blockDef));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onAddBlock(blockDef)}
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
  const [vmError, setVmError] = useState<string | null>(null);
  const [dataPrompt, setDataPrompt] = useState<{ type: 'variable' | 'list'; name: string } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState<LibraryMode | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const costumeInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const backdropInputRef = useRef<HTMLInputElement>(null);
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
  const stageTarget = project.targets.find((t) => t.isStage);
  const stageBackdrops = stageTarget?.costumes || [];
  const stageCurrentBackdrop = Number(stageTarget?.currentCostume || 0);
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

  // Initialize VM with renderer, storage, and audio engine (dynamic imports)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const initVm = async () => {
      try {
        const VmCtor = VirtualMachine as unknown as { new (): ScratchVmLike };
        const vm = new VmCtor();

        // Dynamically import and attach renderer
        try {
          const renderMod = await import('scratch-render');
          const RenderCtor = renderMod.default || renderMod;
          if (typeof RenderCtor === 'function') {
            const renderer = new RenderCtor(canvas);
            vm.attachRenderer(renderer);
            rendererRef.current = renderer;
          }
        } catch (e) {
          console.warn('scratch-render not available:', e);
        }

        // Dynamically import and attach storage
        try {
          const storageMod = await import('scratch-storage');
          const StorageCtor = storageMod.default || storageMod;
          if (typeof StorageCtor === 'function') {
            const storage = new StorageCtor();
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
          console.warn('scratch-storage not available:', e);
        }

        // Dynamically import and attach audio engine
        try {
          const audioMod = await import('scratch-audio');
          const AudioCtor = audioMod.default || audioMod;
          if (typeof AudioCtor === 'function') {
            const audioEngine = new AudioCtor();
            vm.attachAudioEngine(audioEngine);
          }
        } catch (e) {
          console.warn('scratch-audio not available:', e);
        }

        if (cancelled) return;

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

  const handleDataPromptSubmit = () => {
    if (!dataPrompt || !dataPrompt.name.trim()) return;
    if (dataPrompt.type === 'variable') createVariable(dataPrompt.name.trim());
    else createList(dataPrompt.name.trim());
    setDataPrompt(null);
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

  const [showJson, setShowJson] = useState(false);

  return (
    <div className="h-full flex flex-col" style={{ background: '#855cd6' }}>
      {/* ===== TOP MENU BAR (Scratch purple) ===== */}
      <div className="h-12 flex items-center px-3 gap-4 shrink-0" style={{ background: '#855cd6' }}>
        {/* Logo / brand */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
        </div>

        {/* File actions */}
        <div className="flex items-center gap-1">
          <button onClick={() => importInputRef.current?.click()} className="px-3 py-1.5 text-white/90 text-[13px] rounded hover:bg-white/10 flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> File
          </button>
          <input ref={importInputRef} className="hidden" type="file" accept=".sb3" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImport(file); }} />
          <button onClick={handleExport} className="px-3 py-1.5 text-white/90 text-[13px] rounded hover:bg-white/10">Save</button>
          <button onClick={() => setShowJson(!showJson)} className="px-3 py-1.5 text-white/90 text-[13px] rounded hover:bg-white/10">Debug</button>
        </div>

        <div className="flex-1" />

        {/* VM status */}
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${vmReady ? 'bg-white/20 text-white' : 'bg-yellow-400/30 text-yellow-100'}`}>
          {vmReady ? '● Ready' : '○ Starting'}
        </span>
      </div>

      {/* ===== TABS BAR (Code / Costumes / Sounds) ===== */}
      <div className="h-11 flex items-end px-2 shrink-0" style={{ background: '#855cd6' }}>
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
                ? 'bg-white text-[#855cd6]'
                : 'bg-[#7953c7] text-white/80 hover:bg-[#7248bf]'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 min-h-0 flex bg-white">
        {/* --- LEFT: Category rail + Block flyout --- */}
        <div className="flex min-h-0 shrink-0" style={{ width: 340 }}>
          {/* Category rail */}
          <div className="w-[64px] bg-[#f9f9f9] border-r border-[#e0e0e0] py-2 flex flex-col items-center gap-1 overflow-y-auto shrink-0">
            {categoryRail.map((cat) => {
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
          <div className="flex-1 overflow-y-auto py-3 px-3" style={{ background: '#f9f9f9' }}>
            <div className="text-[18px] font-bold mb-3" style={{ color: categoryColors[activeCategory] || '#4c97ff' }}>
              {activeCategory}
            </div>
            {activeEditorTab === 'code' ? (
              activeCategory === 'Variables' ? (
                <VariablesFlyout
                  variables={Object.entries(selectedTarget?.variables || {})}
                  lists={Object.entries(selectedTarget?.lists || {})}
                  blocks={categoryBlocks['Variables'] || []}
                  color={categoryColors['Variables'] || '#ff8c1a'}
                  onMakeVariable={() => setDataPrompt({ type: 'variable', name: 'my variable' })}
                  onMakeList={() => setDataPrompt({ type: 'list', name: 'my list' })}
                  onAddBlock={addBlock}
                />
              ) : (
              <div className="space-y-1.5">
                {(categoryBlocks[activeCategory] || []).map((blockDef) => {
                  const color = categoryColors[activeCategory] || '#4c97ff';
                  const shape = getBlockShape(blockDef.opcode);
                  return (
                    <div
                      key={blockDef.label}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/scratch-block', JSON.stringify(blockDef));
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => addBlock(blockDef)}
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
                    const src = archive?.files?.[costume.md5ext] ? `data:image/${costume.dataFormat || 'png'};base64,${archive.files[costume.md5ext]}` : undefined;
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

        {/* --- CENTER: Workspace --- */}
        <div className="flex-1 min-w-0 relative overflow-hidden scratch-workspace" style={{ background: '#fff' }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={handleWorkspaceDrop}
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
            {selectedBlocks.filter((block) => block.opcode).map((block) => {
              const blockColor = getBlockColor(block.opcode);
              const shape = getBlockShape(block.opcode);
              const label = blockLabels[block.opcode] || block.opcode.replace(/_/g, ' ');
              return (
                <div
                  key={block.id}
                  draggable
                  onDragEnd={(e) => handleBlockDragInWorkspace(block.id, e)}
                  className="absolute cursor-grab active:cursor-grabbing select-none"
                  style={{ left: block.x ?? 40, top: block.y ?? 40 }}
                >
                  <ScratchBlockShape label={label} color={blockColor} shape={shape} />
                </div>
              );
            })}
          </div>
          {/* Zoom controls */}
          <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
            <button className="w-8 h-8 rounded-full bg-[#855cd6] text-white flex items-center justify-center shadow-md hover:bg-[#7248bf]" onClick={() => setWorkspaceZoom((z) => Math.min(1.4, z + 0.1))}><ZoomIn className="w-4 h-4" /></button>
            <button className="w-8 h-8 rounded-full bg-[#855cd6] text-white flex items-center justify-center shadow-md hover:bg-[#7248bf]" onClick={() => setWorkspaceZoom((z) => Math.max(0.7, z - 0.1))}><ZoomOut className="w-4 h-4" /></button>
            <button className="w-8 h-8 rounded-full bg-white border border-[#d0d0d0] text-[#575e75] flex items-center justify-center shadow-md" onClick={() => setWorkspaceZoom(1)}><CircleMinus className="w-4 h-4" /></button>
          </div>
        </div>

        {/* --- RIGHT: Stage + Sprite info + Sprite list --- */}
        <div className="shrink-0 flex flex-col min-h-0 border-l border-[#e0e0e0]" style={{ width: 480 }}>
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
              <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/60" title="Fullscreen">
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
                value={selectedTarget?.name || 'Sprite1'}
                onChange={(e) => {
                  const nextName = e.target.value;
                  updateProject((current) => ({
                    ...current,
                    targets: current.targets.map((target, idx) => idx === selectedTargetIndex ? { ...target, name: nextName } : target),
                  }));
                }}
                className="h-7 rounded border border-[#d0d0d0] px-2 flex-1 text-[13px] min-w-0"
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
                    ? `data:image/${target.costumes[0].dataFormat || 'png'};base64,${archive.files[target.costumes[0].md5ext]}`
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
                    ? `data:image/${backdrop.dataFormat || 'png'};base64,${archive.files[backdrop.md5ext]}`
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
              {vmError && <span className="text-[11px] text-red-500 max-w-[300px] truncate">⚠ {vmError}</span>}
              <button onClick={applyJsonDraft} className="text-[11px] px-2 py-0.5 rounded bg-[#855cd6] text-white">Apply</button>
            </div>
          </div>
          <textarea
            className="w-full h-[120px] border border-[#d0d0d0] rounded bg-white p-2 text-[11px] font-mono resize-none"
            value={projectJsonDraft || archive?.projectJson || formatJson(project)}
            onChange={(e) => setProjectJsonDraft(e.target.value)}
            spellCheck={false}
          />
          {jsonError && <div className="text-[11px] text-red-500 mt-0.5">{jsonError}</div>}
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
      {/* Asset Library Dialog */}
      {libraryOpen && (
        <ScratchLibraryDialog
          mode={libraryOpen}
          open={true}
          onClose={() => setLibraryOpen(null)}
          onSelect={addLibraryAsset}
        />
      )}
    </div>
  );
};
