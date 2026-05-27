import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const files = [
  join(__dirname, '..', 'node_modules', 'scratch-vm', 'dist', 'web', 'scratch-vm.js'),
  join(__dirname, '..', 'node_modules', 'scratch-storage', 'dist', 'web', 'scratch-storage.js'),
];

for (const filePath of files) {
  if (!existsSync(filePath)) {
    console.warn(`⚠ File not found: ${filePath}`);
    continue;
  }
  try {
    let code = readFileSync(filePath, 'utf-8');
    const original = code;
    code = code.replace(
      /eval\("require\('([^']+)'\)(?:\.([^(]+))?"\)/g,
      (_, mod, prop) => {
        const base = `typeof require !== 'undefined' ? require('${mod}') : null`;
        return prop ? `${base}.${prop}` : base;
      }
    );
    if (code !== original) {
      writeFileSync(filePath, code, 'utf-8');
      console.log(`✓ Patched ${filePath.split('/').slice(-3).join('/')}`);
    } else {
      console.log(`✓ ${filePath.split('/').slice(-3).join('/')} already patched`);
    }
  } catch (e) {
    console.warn(`⚠ Could not patch ${filePath}:`, e.message);
  }
}
