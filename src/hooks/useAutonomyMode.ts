import { useState, useCallback, useEffect } from 'react';

export type AutonomyPreset = 'full' | 'human' | 'custom';

export interface AutonomyConfig {
  codeChanges: boolean;   // auto-apply file changes
  shell: boolean;         // auto-execute shell commands
  theme: boolean;         // auto-apply theme changes
  git: boolean;           // auto-apply git actions
  share: boolean;         // auto-apply share/project actions
  packages: boolean;      // auto-install packages
  workflows: boolean;     // auto-create/run workflows
}

const FULL_CONFIG: AutonomyConfig = {
  codeChanges: true,
  shell: true,
  theme: true,
  git: true,
  share: true,
  packages: true,
  workflows: true,
};

const HUMAN_CONFIG: AutonomyConfig = {
  codeChanges: false,
  shell: false,
  theme: false,
  git: false,
  share: false,
  packages: false,
  workflows: false,
};

const STORAGE_KEY = 'canvas-autonomy-mode';
const CUSTOM_KEY = 'canvas-autonomy-custom';

function loadPreset(): AutonomyPreset {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'full' || v === 'human' || v === 'custom') return v;
  } catch {}
  return 'human';
}

function loadCustomConfig(): AutonomyConfig {
  try {
    const v = localStorage.getItem(CUSTOM_KEY);
    if (v) return { ...HUMAN_CONFIG, ...JSON.parse(v) };
  } catch {}
  return { ...HUMAN_CONFIG, codeChanges: true };
}

export function configForPreset(preset: AutonomyPreset, custom: AutonomyConfig): AutonomyConfig {
  if (preset === 'full') return FULL_CONFIG;
  if (preset === 'human') return HUMAN_CONFIG;
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
