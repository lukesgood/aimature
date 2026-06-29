import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { CollectorContext } from './types.js';

const IGNORE = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'coverage', '.superpowers']);

function walk(root: string, current: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(current, { withFileTypes: true });
  } catch {
    return; // skip unreadable directories
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE.has(entry.name)) continue;
      walk(root, join(current, entry.name), out);
    } else if (entry.isFile()) {
      out.push(relative(root, join(current, entry.name)).split(sep).join('/'));
    }
  }
}

export function buildContext(rootDir: string): CollectorContext {
  const files: string[] = [];
  walk(rootDir, rootDir, files);
  return {
    rootDir,
    files,
    readText(rel: string): string {
      try {
        const buf = readFileSync(join(rootDir, rel));
        if (buf.includes(0)) return '';   // crude binary guard
        return buf.toString('utf8');
      } catch {
        return '';
      }
    },
  };
}
