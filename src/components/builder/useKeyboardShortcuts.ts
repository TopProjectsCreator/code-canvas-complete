import { useEffect } from "react";

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const key = [
        e.metaKey ? "Cmd" : e.ctrlKey ? "Ctrl" : "",
        e.shiftKey ? "Shift" : "",
        e.key === " " ? "Space" : e.key,
      ]
        .filter(Boolean)
        .join("+");

      if (shortcuts[key]) {
        e.preventDefault();
        e.stopPropagation();
        shortcuts[key]();
        return;
      }

      if (!e.metaKey && !e.ctrlKey && shortcuts[e.key]) {
        e.preventDefault();
        shortcuts[e.key]();
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
