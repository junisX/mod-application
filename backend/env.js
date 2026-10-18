import { readFileSync } from 'node:fs';

const ENV_FILE = new URL('../.env', import.meta.url);

export function loadEnv(file = ENV_FILE) {
  let content;

  try {
    content = readFileSync(file, 'utf8');
  } catch {
    return;
  }

  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)$/.exec(line);

    if (!match || line.trimStart().startsWith('#')) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}
