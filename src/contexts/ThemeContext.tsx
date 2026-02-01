import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type IDETheme = 'replit-dark' | 'github-dark' | 'monokai' | 'dracula' | 'nord' | 'solarized-dark' | 'one-dark';

interface ThemeContextType {
  theme: IDETheme;
  setTheme: (theme: IDETheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const themeInfo: Record<IDETheme, { name: string; description: string }> = {
  'replit-dark': { name: 'Replit Dark', description: 'Default dark theme' },
  'github-dark': { name: 'GitHub Dark', description: 'GitHub inspired' },
  'monokai': { name: 'Monokai', description: 'Classic Sublime theme' },
  'dracula': { name: 'Dracula', description: 'Dark purple theme' },
  'nord': { name: 'Nord', description: 'Arctic blue theme' },
  'solarized-dark': { name: 'Solarized Dark', description: 'Low contrast dark' },
  'one-dark': { name: 'One Dark', description: 'Atom inspired' },
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<IDETheme>(() => {
    const saved = localStorage.getItem('ide-theme');
    return (saved as IDETheme) || 'replit-dark';
  });

  useEffect(() => {
    localStorage.setItem('ide-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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
