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

  it('uses the Claude Code CLI provider when --llm is set (via injected runner)', async () => {
    let out = '';
    const cliRunner = (_cmd: string, args: string[]) => {
      if (args[0] === '--version') return { stdout: '2.1.0', status: 0 };
      // headless analysis call → return JSON scores for the scalability pillar
      return {
        stdout: JSON.stringify({
          result: '{"scores":{"scal.architecture":{"score":70,"note":"ok"}}}',
        }),
        status: 0,
      };
    };
    const code = await runScan(
      ['scan', dir, '--llm', '--format', 'json'],
      { write: (s) => { out += s; }, env: {}, cliRunner },
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    const scal = parsed.pillars.find((p: any) => p.id === 'scalability');
    expect(scal.measured).toBe(true); // the CLI-provided LLM finding covered it
  });

  it('errors with exit 2 when the CLI provider is requested but claude is absent', async () => {
    let out = '';
    const cliRunner = () => ({ stdout: '', status: 127 });
    const code = await runScan(
      ['scan', dir, '--llm', '--format', 'json'],
      { write: (s) => { out += s; }, env: {}, cliRunner },
    );
    expect(code).toBe(2);
    expect(out).toContain('not found on PATH');
  });
});
