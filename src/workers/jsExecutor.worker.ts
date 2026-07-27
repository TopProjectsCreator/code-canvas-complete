interface ExecuteMessage {
  type: 'execute';
  code: string;
}

self.onmessage = (e: MessageEvent<ExecuteMessage>) => {
  const { code } = e.data;
  const output: string[] = [];

  const capture =
    (level: 'log' | 'warn' | 'error') =>
    (...args: unknown[]) => {
      output.push(
        args
          .map((a) => {
            if (typeof a === 'string') return a;
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
          .join(' '),
      );
    };

  const sandboxConsole = {
    log: capture('log'),
    info: capture('log'),
    warn: capture('warn'),
    error: capture('error'),
  };

  try {
    const fn = new Function(
      'console',
      `return (async () => { ${code}\n})();`,
    );
    // The result may be a thenable; the main thread will await the postMessage
    // hand-off, but we need to await it here so the output is complete.
    const result = fn(sandboxConsole);
    // If the returned value is a promise, await it so async code works.
    if (
      result !== null &&
      typeof result === 'object' &&
      typeof (result as Record<string, unknown>).then === 'function'
    ) {
      (result as Promise<unknown>).then(
        (resolved: unknown) => {
          if (resolved !== undefined) output.push(String(resolved));
          self.postMessage({ output, error: null });
        },
        (err: unknown) => {
          self.postMessage({
            output,
            error: err instanceof Error ? err.message : String(err),
          });
        },
      );
    } else {
      if (result !== undefined) output.push(String(result));
      self.postMessage({ output, error: null });
    }
  } catch (err) {
    self.postMessage({
      output,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
