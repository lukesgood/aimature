import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runScan } from '../src/cli.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'aim-cli-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'app.ts'), 'export const x = 1;');
  writeFileSync(join(dir, 'README.md'), 'x'.repeat(300));
});

describe('runScan', () => {
  it('prints a JSON report for `scan <dir> --format json`', async () => {
    let out = '';
    const code = await runScan(
      ['scan', dir, '--format', 'json'],
      { write: (s) => { out += s; }, env: {} },
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.pillars).toHaveLength(4);
    expect(typeof parsed.level).toBe('string');
  });
});
