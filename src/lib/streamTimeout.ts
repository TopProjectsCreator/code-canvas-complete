const DEFAULT_STREAM_TIMEOUT_MS = 30_000;

class StreamTimeoutError extends Error {
  constructor() {
    super('Stream timed out: no data received within the timeout period');
    this.name = 'StreamTimeoutError';
  }
}

export function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number = DEFAULT_STREAM_TIMEOUT_MS,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reader.cancel(new StreamTimeoutError()).catch(() => {});
      reject(new StreamTimeoutError());
    }, timeoutMs);

    reader.read().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
