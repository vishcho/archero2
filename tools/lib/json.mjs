import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { throw new Error(`${file}: 無法讀取 UTF-8 JSON：${error.message}`, { cause: error }); }
}

export const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function atomicWriteJson(file, value, { validate } = {}) {
  if (validate) await validate(value, file);
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(temp, stableJson(value), { encoding: 'utf8', flag: 'wx' });
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}
