import Ajv2020 from 'ajv/dist/2020.js';
import { readJson } from './json.mjs';
import { schemaPath } from './repo.mjs';

const names = ['cups', 'season', 'roster', 'players'];
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validators = new Map();
for (const name of names) validators.set(name, ajv.compile(await readJson(schemaPath(`${name}.schema.json`))));

export function validateSchema(name, value, file = '<value>') {
  const validate = validators.get(name);
  if (!validate) throw new Error(`未知 schema：${name}`);
  if (validate(value)) return [];
  return validate.errors.map((e) => ({ severity: 'error', file, location: e.instancePath || '/', message: `${e.keyword}: ${e.message}` }));
}

export function assertSchema(name, value, file) {
  const errors = validateSchema(name, value, file);
  if (errors.length) throw new Error(errors.map((e) => `${e.file}${e.location}: ${e.message}`).join('\n'));
}
