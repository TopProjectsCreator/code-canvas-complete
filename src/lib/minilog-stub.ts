// Stub for the `minilog` package.
//
// scratch-vm / scratch-render / scratch-storage pull in minilog, whose Node
// formatters use legacy octal escape sequences that the production bundler
// refuses to parse. None of the logging is needed at runtime, so every entry
// point resolves to this no-op implementation instead.

type LogFn = (...args: unknown[]) => Logger;

interface Logger {
  debug: LogFn;
  info: LogFn;
  log: LogFn;
  warn: LogFn;
  error: LogFn;
  suggest: Record<string, unknown>;
}

function createLogger(): Logger {
  const logger: Logger = {
    debug: () => logger,
    info: () => logger,
    log: () => logger,
    warn: () => logger,
    error: () => logger,
    suggest: {},
  };
  return logger;
}

function minilog(): Logger {
  return createLogger();
}

const noop = () => minilog;

Object.assign(minilog, {
  enable: noop,
  disable: noop,
  pipe: () => ({ filter: noop, format: noop, pipe: noop }),
  suggest: { defaultResult: true, clear: noop, allow: noop, deny: noop },
  backends: {},
  Filter: class {},
  Transform: class {},
  defaultBackend: {},
  defaultFormatter: {},
});

export default minilog as typeof minilog & Record<string, unknown>;
