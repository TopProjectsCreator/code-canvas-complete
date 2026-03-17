import { useState, useCallback, useEffect } from 'react';

export type AutonomyPreset = 'safe' | 'balanced' | 'fast' | 'custom';

export interface AutonomyConfig {
  codeChanges: boolean;   // auto-apply file changes
  shell: boolean;         // auto-execute shell commands
  theme: boolean;         // auto-apply theme changes
  git: boolean;           // auto-apply git actions
  share: boolean;         // auto-apply share/project actions
  packages: boolean;      // auto-install packages
  workflows: boolean;     // auto-create/run workflows
  blockDestructiveShell: boolean; // block risky shell commands when auto-running
}

const FAST_CONFIG: AutonomyConfig = {
  codeChanges: true,
  shell: true,
  theme: true,
  git: true,
  share: true,
  packages: true,
  workflows: true,
  blockDestructiveShell: false,
};

const SAFE_CONFIG: AutonomyConfig = {
  codeChanges: false,
  shell: false,
  theme: true,
  git: false,
  share: false,
  packages: false,
  workflows: false,
  blockDestructiveShell: true,
};

const BALANCED_CONFIG: AutonomyConfig = {
  codeChanges: true,
  shell: true,
  theme: true,
  git: false,
  share: false,
  packages: false,
  workflows: true,
  blockDestructiveShell: true,
};

const STORAGE_KEY = 'canvas-autonomy-mode';
const CUSTOM_KEY = 'canvas-autonomy-custom';

function loadPreset(): AutonomyPreset {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'safe' || v === 'balanced' || v === 'fast' || v === 'custom') return v;
    // Backward-compat migration from old preset names.
    if (v === 'human') return 'safe';
    if (v === 'full') return 'fast';
  } catch {}
  return 'safe';
}

function loadCustomConfig(): AutonomyConfig {
  try {
    const v = localStorage.getItem(CUSTOM_KEY);
    if (v) return { ...BALANCED_CONFIG, ...JSON.parse(v) };
  } catch {}
  return { ...BALANCED_CONFIG };
}

export function configForPreset(preset: AutonomyPreset, custom: AutonomyConfig): AutonomyConfig {
  if (preset === 'fast') return FAST_CONFIG;
  if (preset === 'safe') return SAFE_CONFIG;
  if (preset === 'balanced') return BALANCED_CONFIG;
  return custom;
}

export const useAutonomyMode = () => {
  const [preset, setPresetState] = useState<AutonomyPreset>(loadPreset);
  const [customConfig, setCustomConfigState] = useState<AutonomyConfig>(loadCustomConfig);

  const config = configForPreset(preset, customConfig);

  const setPreset = useCallback((p: AutonomyPreset) => {
    setPresetState(p);
    try { localStorage.setItem(STORAGE_KEY, p); } catch {}
  }, []);

  const setCustomConfig = useCallback((c: AutonomyConfig) => {
    setCustomConfigState(c);
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(c)); } catch {}
  }, []);

  const updateCustomField = useCallback((field: keyof AutonomyConfig, value: boolean) => {
    setCustomConfigState(prev => {
      const next = { ...prev, [field]: value };
      try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { preset, setPreset, config, customConfig, setCustomConfig, updateCustomField };
};
