import { useCallback, useEffect, useState } from 'react';
import { WebContainer } from '@webcontainer/api';

type WebContainerStatus = 'idle' | 'booting' | 'ready' | 'error';

interface WebContainerState {
  status: WebContainerStatus;
  error: string | null;
}

interface SpawnResult {
  stdout: string[];
  stderr: string[];
  exitCode: number;
}

const listeners = new Set<(state: WebContainerState) => void>();
let subscriberCount = 0;
let container: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let state: WebContainerState = { status: 'idle', error: null };

const notify = () => {
  listeners.forEach((listener) => listener(state));
};

const setState = (next: WebContainerState) => {
  state = next;
  notify();
};

const toLines = (value: string) => value.split(/\r?\n/).filter((line) => line.length > 0);

const ensureDirectory = async (targetPath: string) => {
  if (!container) return;

  const segments = targetPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length <= 1) return;

  let currentPath = '';
  for (const segment of segments.slice(0, -1)) {
    currentPath += `/${segment}`;
    try {
      await container.fs.mkdir(currentPath);
    } catch {
      // Directory already exists.
    }
  }
};

const bootInternal = async () => {
  if (container) {
    if (state.status !== 'ready') {
      setState({ status: 'ready', error: null });
    }
    return container;
  }

  if (bootPromise) return bootPromise;

  setState({ status: 'booting', error: null });
  bootPromise = WebContainer.boot()
    .then((instance) => {
      container = instance;
      setState({ status: 'ready', error: null });
      return instance;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to boot WebContainer.';
      setState({ status: 'error', error: message });
      throw error;
    })
    .finally(() => {
      bootPromise = null;
    });

  return bootPromise;
};

export const useWebContainer = () => {
  const [webContainerState, setWebContainerState] = useState<WebContainerState>(state);

  useEffect(() => {
    const handleStateChange = (nextState: WebContainerState) => setWebContainerState(nextState);
    listeners.add(handleStateChange);
    subscriberCount += 1;

    return () => {
      listeners.delete(handleStateChange);
      subscriberCount = Math.max(0, subscriberCount - 1);
      if (subscriberCount === 0 && container) {
        container.teardown();
        container = null;
        setState({ status: 'idle', error: null });
      }
    };
  }, []);

  const boot = useCallback(async () => {
    await bootInternal();
  }, []);

  const spawn = useCallback(async (command: string, args: string[] = []): Promise<SpawnResult> => {
    const instance = await bootInternal();

    const process = await instance.spawn(command, args);
    let outputBuffer = '';

    const writer = new WritableStream<string>({
      write(chunk) {
        outputBuffer += chunk;
      },
    });

    const pipePromise = process.output.pipeTo(writer);
    const exitCode = await process.exit;
    await pipePromise;

    const stdout = toLines(outputBuffer);
    return {
      stdout,
      stderr: [],
      exitCode,
    };
  }, []);

  const writeFile = useCallback(async (path: string, content: string) => {
    await bootInternal();
    await ensureDirectory(path);
    await container!.fs.writeFile(path, content);
  }, []);

  const readFile = useCallback(async (path: string) => {
    await bootInternal();
    const file = await container!.fs.readFile(path, 'utf-8');
    return file;
  }, []);

  const teardown = useCallback(() => {
    if (container) {
      container.teardown();
      container = null;
    }
    setState({ status: 'idle', error: null });
  }, []);

  return {
    status: webContainerState.status,
    error: webContainerState.error,
    boot,
    spawn,
    writeFile,
    readFile,
    teardown,
  };
};
