import { CustomTheme } from '@/contexts/ThemeContext';

export function encodeThemeData(theme: CustomTheme): string {
  return btoa(JSON.stringify({ name: theme.name, colors: theme.colors }));
}

export function getThemeShareUrl(theme: CustomTheme): string {
  const encoded = encodeThemeData(theme);
  return `${window.location.origin}${window.location.pathname}?theme=${encoded}`;
}