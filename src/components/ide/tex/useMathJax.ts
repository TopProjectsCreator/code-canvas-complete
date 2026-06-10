import { useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      typesetClear?: (elements?: HTMLElement[]) => void;
      texReset?: () => void;
      startup?: {
        document: {
          clearMathItemsWithin: (elements: HTMLElement[]) => void;
        };
      };
      loader?: { load: string[] };
      tex?: {
        inlineMath: [string, string][];
        packages: { [key: string]: string[] };
      };
    };
  }
}

let mathjaxReady: Promise<void> | null = null;

function loadMathJax(): Promise<void> {
  if (window.MathJax) return Promise.resolve();
  if (mathjaxReady) return mathjaxReady;

  mathjaxReady = new Promise<void>((resolve) => {
    // Configure MathJax before loading
    window.MathJax = {
      loader: { load: ['[tex]/begingroup'] },
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        packages: { '[+]': ['begingroup'] },
      },
      startup: {
        pageReady() {
          return (window.MathJax!.startup!.pageReady as any).call(this).then(() => {
            resolve();
          });
        },
      },
    } as any;

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@4/tex-chtml.js';
    script.async = true;
    script.onload = () => {
      // MathJax auto-initializes; the startup.pageReady resolves when ready
    };
    script.onerror = () => {
      console.warn('Failed to load MathJax from CDN');
      resolve(); // resolve anyway so the app doesn't hang
    };
    document.head.appendChild(script);
  });

  return mathjaxReady;
}

export function useMathJax() {
  const readyRef = useRef(false);
  const runningRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    loadMathJax().then(() => {
      readyRef.current = true;
    });
  }, []);

  const typeset = useCallback(async (element: HTMLElement) => {
    if (!window.MathJax?.typesetPromise) return;
    if (runningRef.current) {
      pendingRef.current = true;
      return;
    }

    runningRef.current = true;
    pendingRef.current = false;

    try {
      // Clear old math items
      window.MathJax.typesetClear?.([element]);
      window.MathJax.texReset?.();

      // Typeset new content
      await window.MathJax.typesetPromise([element]);
    } catch (err) {
      console.warn('MathJax typeset error:', err);
    } finally {
      runningRef.current = false;
      if (pendingRef.current && element.isConnected) {
        typeset(element);
      }
    }
  }, []);

  const clear = useCallback((element: HTMLElement) => {
    window.MathJax?.typesetClear?.([element]);
  }, []);

  return { typeset, clear };
}
