import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { exportSb3, importSb3 } from '@/services/scratchSb3';

describe('scratch sb3 import/export', () => {
  it('round-trips project json and assets', async () => {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify({ targets: [{ name: 'Stage', isStage: true }], meta: { semver: '3.0.0' } }));
    zip.file('a.txt', 'asset-data');

    const input = await zip.generateAsync({ type: 'arraybuffer' });
    const imported = await importSb3(input);

    expect(imported.archive.projectJson).toContain('"targets"');
    expect(imported.archive.files['a.txt']).toBeTruthy();

    imported.archive.projectJson = JSON.stringify({ targets: [{ name: 'Sprite1' }], meta: { semver: '3.0.0' } });

    const outData = await exportSb3(imported.archive);
    const out = outData.buffer.slice(outData.byteOffset, outData.byteOffset + outData.byteLength) as ArrayBuffer;
    const outImported = await importSb3(out);

    expect(outImported.archive.projectJson).toContain('Sprite1');
    expect(outImported.archive.files['a.txt']).toBeTruthy();
  });
});
