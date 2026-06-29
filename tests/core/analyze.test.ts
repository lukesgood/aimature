import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze } from '../../src/core/analyze.js';
import { createLogger } from '../../src/core/logger.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'aim-e2e-'));
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(dir, 'src', 'app.ts'), 'export function handler(i: string){ if(!i) throw new Error("x"); return i; }');
  writeFileSync(join(dir, 'src', 'app.test.ts'), 'test("x", () => { expect(1).toBe(1); });');
  writeFileSync(join(dir, 'README.md'), 'x'.repeat(300));
  writeFileSync(join(dir, 'package.json'), '{"name":"x"}');
  writeFileSync(join(dir, 'package-lock.json'), '{}');
  writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'name: ci\non: [push]');
  writeFileSync(join(dir, 'src', 'config.ts'), 'const k = "AKIAABCDEFGHIJKLMNOP";');
});

const LLM_CRITERIA = ['scal.architecture', 'scal.state', 'scal.db', 'sec.authz', 'sec.input', 'rel.errors', 'rel.logging'];
const fakeLlm = async () => JSON.stringify({
  scores: Object.fromEntries(LLM_CRITERIA.map((c) => [c, { score: 95, note: 'ok' }])),
});

describe('analyze', () => {
  it('caps an otherwise-healthy repo to L1 when a live secret is present', async () => {
    const r = await analyze({ rootDir: dir, useTools: false, llmClient: fakeLlm });
    expect(r.cappedBy).toBe('gate.live-secret');
    expect(r.level).toBe('L1');
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.pillars).toHaveLength(4);
  });

  it('runs without tools or llm and still scores', async () => {
    const r = await analyze({ rootDir: dir, useTools: false, llmClient: null });
    expect(typeof r.overallScore).toBe('number');
    expect(r.pillars).toHaveLength(4);
  });

  it('emits diagnostics through an injected logger', async () => {
    const lines: string[] = [];
    const logger = createLogger({ level: 'debug', write: (s) => lines.push(s) });
    await analyze({ rootDir: dir, useTools: false, llmClient: null, logger });
    const text = lines.join('');
    expect(text).toContain('scan started');
    expect(text).toContain('scan complete');
    // per-layer debug line for a collector that ran
    expect(text).toContain('"layer":"secrets"');
    // Layer 3 skipped because no client
    expect(text).toContain('Layer 3 skipped');
  });
});
