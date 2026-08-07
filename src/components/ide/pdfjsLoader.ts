// pdfjs-dist touches browser-only globals (DOMMatrix) at module scope, so it must
// never be imported statically from an SSR-reachable module. Load it on demand.
type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

export function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [mod, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      if (!mod.GlobalWorkerOptions.workerSrc) {
        mod.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
      }
      return mod;
    })();
  }
  return pdfjsPromise;
}
