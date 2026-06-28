import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../../src/collectors/scan.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'aim-'));
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1;');
  writeFileSync(join(dir, 'node_modules', 'junk.js'), 'noise');
});

describe('buildContext', () => {
  it('lists files with posix relative paths and ignores node_modules', () => {
    const ctx = buildContext(dir);
    expect(ctx.files).toContain('src/a.ts');
    expect(ctx.files.some((f) => f.includes('node_modules'))).toBe(false);
  });
  it('reads file text by relative path', () => {
    const ctx = buildContext(dir);
    expect(ctx.readText('src/a.ts')).toContain('export const a');
  });
});
