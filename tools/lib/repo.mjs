import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const dataPath = (...parts) => path.join(repoRoot, 'data', ...parts);
export const schemaPath = (...parts) => path.join(repoRoot, 'schemas', ...parts);
