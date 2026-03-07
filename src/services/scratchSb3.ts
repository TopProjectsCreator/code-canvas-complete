import JSZip from 'jszip';

export interface ScratchArchive {
  projectJson: string;
  files: Record<string, string>; // base64 encoded raw archive entries
  fileNames: string[];
}

export interface ScratchImportResult {
  archive: ScratchArchive;
  project: Record<string, unknown> | null;
}

const uint8ToBase64 = (bytes: Uint8Array): string => {
  const nodeBuffer = (globalThis as { Buffer?: { from: (input: Uint8Array | string, encoding?: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToUint8 = (base64: string): Uint8Array => {
  const nodeBuffer = (globalThis as { Buffer?: { from: (input: Uint8Array | string, encoding?: string) => Uint8Array } }).Buffer;
  if (nodeBuffer) {
    return new Uint8Array(nodeBuffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const importSb3 = async (arrayBuffer: ArrayBuffer): Promise<ScratchImportResult> => {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const files: Record<string, string> = {};
  const fileNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir);

  for (const name of fileNames) {
    const bytes = await zip.files[name].async('uint8array');
    files[name] = uint8ToBase64(bytes);
  }

  const projectJson = zip.file('project.json')
    ? await zip.file('project.json')!.async('string')
    : '{"targets":[],"monitors":[],"extensions":[],"meta":{"semver":"3.0.0"}}';

  let project: Record<string, unknown> | null = null;
  try {
    project = JSON.parse(projectJson) as Record<string, unknown>;
  } catch {
    project = null;
  }

  return {
    archive: { projectJson, files, fileNames },
    project,
  };
};

export const exportSb3 = async (archive: ScratchArchive): Promise<Uint8Array> => {
  const zip = new JSZip();
  const fileNames = archive.fileNames.length > 0 ? archive.fileNames : Object.keys(archive.files);

  for (const name of fileNames) {
    if (name === 'project.json') continue;
    const base64 = archive.files[name];
    if (!base64) continue;
    zip.file(name, base64ToUint8(base64));
  }

  zip.file('project.json', archive.projectJson);

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
};
