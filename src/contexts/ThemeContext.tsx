import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type IDETheme = 'canvas-dark' | 'github-dark' | 'monokai' | 'dracula' | 'nord' | 'solarized-dark' | 'one-dark' | string;

export interface CustomThemeColors {
  background: string;
  foreground: string;
  primary: string;
  card: string;
  border: string;
  terminalBg: string;
  terminalText: string;
  syntaxKeyword: string;
  syntaxString: string;
  syntaxFunction: string;
  syntaxComment: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  colors: CustomThemeColors;
}

const BUILTIN_THEMES: IDETheme[] = [
  'canvas-dark', 'github-dark', 'monokai', 'dracula', 'nord', 'solarized-dark', 'one-dark'
];

interface ThemeContextType {
  theme: IDETheme;
  setTheme: (theme: IDETheme) => void;
  customThemes: CustomTheme[];
  addCustomTheme: (theme: CustomTheme) => void;
  deleteCustomTheme: (id: string) => void;
  updateCustomTheme: (theme: CustomTheme) => void;
  isBuiltinTheme: (id: string) => boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const themeInfo: Record<string, { name: string; description: string }> = {
  'canvas-dark': { name: 'Canvas Dark', description: 'Default dark theme' },
  'github-dark': { name: 'GitHub Dark', description: 'GitHub inspired' },
  'monokai': { name: 'Monokai', description: 'Classic Sublime theme' },
  'dracula': { name: 'Dracula', description: 'Dark purple theme' },
  'nord': { name: 'Nord', description: 'Arctic blue theme' },
  'solarized-dark': { name: 'Solarized Dark', description: 'Low contrast dark' },
  'one-dark': { name: 'One Dark', description: 'Atom inspired' },
};

// Convert hex to HSL string (e.g. "228 14% 10%")
function hexToHsl(hex: string): string {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Derive a lighter/darker shade from hex
function adjustBrightness(hex: string, amount: number): string {
  hex = hex.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.min(255, Math.max(0, r + amount));
  g = Math.min(255, Math.max(0, g + amount));
  b = Math.min(255, Math.max(0, b + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function generateCssVariables(colors: CustomThemeColors): string {
  const bg = hexToHsl(colors.background);
  const fg = hexToHsl(colors.foreground);
  const primary = hexToHsl(colors.primary);
  const card = hexToHsl(colors.card);
  const border = hexToHsl(colors.border);
  const termBg = hexToHsl(colors.terminalBg);
  const termText = hexToHsl(colors.terminalText);

  // Derived colors
  const secondaryBg = hexToHsl(adjustBrightness(colors.background, 20));
  const mutedBg = hexToHsl(adjustBrightness(colors.background, 30));
  const mutedFg = hexToHsl(adjustBrightness(colors.foreground, -80));
  const accentBg = hexToHsl(adjustBrightness(colors.background, 40));

  return `
    --background: ${bg};
    --foreground: ${fg};
    --card: ${card};
    --card-foreground: ${fg};
    --popover: ${hexToHsl(adjustBrightness(colors.card, 8))};
    --popover-foreground: ${fg};
    --primary: ${primary};
    --primary-foreground: 0 0% 100%;
    --secondary: ${secondaryBg};
    --secondary-foreground: ${fg};
    --muted: ${mutedBg};
    --muted-foreground: ${mutedFg};
    --accent: ${accentBg};
    --accent-foreground: ${fg};
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: ${border};
    --input: ${hexToHsl(adjustBrightness(colors.background, 15))};
    --ring: ${primary};
    --editor-bg: ${hexToHsl(adjustBrightness(colors.background, 4))};
    --editor-line: ${hexToHsl(adjustBrightness(colors.background, 16))};
    --editor-selection: ${hexToHsl(adjustBrightness(colors.primary, -60))};
    --editor-gutter: ${mutedFg};
    --terminal-bg: ${termBg};
    --terminal-text: ${termText};
    --sidebar-bg: ${card};
    --sidebar-hover: ${accentBg};
    --sidebar-active: ${primary};
    --sidebar-background: ${card};
    --sidebar-foreground: ${fg};
    --sidebar-primary: ${primary};
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: ${mutedBg};
    --sidebar-accent-foreground: ${fg};
    --sidebar-border: ${border};
    --sidebar-ring: ${primary};
    --syntax-keyword: ${hexToHsl(colors.syntaxKeyword)};
    --syntax-string: ${hexToHsl(colors.syntaxString)};
    --syntax-number: ${hexToHsl(colors.syntaxString)};
    --syntax-function: ${hexToHsl(colors.syntaxFunction)};
    --syntax-comment: ${hexToHsl(colors.syntaxComment)};
    --syntax-variable: ${fg};
    --syntax-operator: ${primary};
    --success: 142 71% 45%;
    --warning: 38 92% 50%;
    --info: 199 89% 48%;
  `;
}

function injectCustomThemeStyle(id: string, cssVars: string) {
  const styleId = `custom-theme-${id}`;
  let el = document.getElementById(styleId);
  if (!el) {
    el = document.createElement('style');
    el.id = styleId;
    document.head.appendChild(el);
  }
  el.textContent = `[data-theme="custom-${id}"] { ${cssVars} }`;
}

function removeCustomThemeStyle(id: string) {
  const el = document.getElementById(`custom-theme-${id}`);
  if (el) el.remove();
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<IDETheme>(() => {
    const saved = localStorage.getItem('ide-theme');
    if (saved === 'replit-dark') return 'canvas-dark';
    return saved || 'canvas-dark';
  });

  const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() => {
    try {
      const saved = localStorage.getItem('ide-custom-themes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Inject all custom theme styles on mount
  useEffect(() => {
    customThemes.forEach(ct => {
      injectCustomThemeStyle(ct.id, generateCssVariables(ct.colors));
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('ide-theme', theme);
    // For custom themes, the data-theme attribute includes "custom-" prefix
    const isCustom = !BUILTIN_THEMES.includes(theme as any);
    document.documentElement.setAttribute('data-theme', isCustom ? theme : theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ide-custom-themes', JSON.stringify(customThemes));
  }, [customThemes]);

  const setTheme = useCallback((t: IDETheme) => {
    setThemeState(t);
  }, []);

  const addCustomTheme = useCallback((ct: CustomTheme) => {
    const cssVars = generateCssVariables(ct.colors);
    injectCustomThemeStyle(ct.id, cssVars);
    setCustomThemes(prev => [...prev, ct]);
    setThemeState(`custom-${ct.id}`);
  }, []);

  const deleteCustomTheme = useCallback((id: string) => {
    removeCustomThemeStyle(id);
    setCustomThemes(prev => prev.filter(t => t.id !== id));
    // If the deleted theme was active, fall back to default
    setThemeState(prev => prev === `custom-${id}` ? 'canvas-dark' : prev);
  }, []);

  const updateCustomTheme = useCallback((ct: CustomTheme) => {
    const cssVars = generateCssVariables(ct.colors);
    injectCustomThemeStyle(ct.id, cssVars);
    setCustomThemes(prev => prev.map(t => t.id === ct.id ? ct : t));
  }, []);

  const isBuiltinTheme = useCallback((id: string) => {
    return BUILTIN_THEMES.includes(id as any);
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      customThemes,
      addCustomTheme,
      deleteCustomTheme,
      updateCustomTheme,
      isBuiltinTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
