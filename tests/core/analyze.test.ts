import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze } from '../../src/core/analyze.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'aim-e2e-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'config.ts'), 'const k = "AKIAABCDEFGHIJKLMNOP";');
  writeFileSync(join(dir, 'package.json'), '{"name":"x"}');
});

describe('analyze', () => {
  it('produces a report capped by the secret gate and lists recommendations', async () => {
    const r = await analyze({ rootDir: dir });
    expect(r.level).toBe('L1');           // secret gate caps it
    expect(r.cappedBy).toBe('gate.live-secret');
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.pillars).toHaveLength(4);
  });

  it('runs without tools or llm and still scores', async () => {
    const r = await analyze({ rootDir: dir, useTools: false, llmClient: null });
    expect(typeof r.overallScore).toBe('number');
  });
});
