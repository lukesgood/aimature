import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { analyze } from '../src/core/analyze.js';
import type { Report } from '../src/core/types.js';

function secretScore(report: Report): number | undefined {
  const sec = report.pillars.find((p) => p.id === 'security');
  return sec?.criteria.find((c) => c.criterionId === 'sec.secrets')?.score;
}

describe('e2e fixtures', () => {
  it('scores the safe repo higher than the vulnerable one', async () => {
    const safe = await analyze({ rootDir: resolve('tests/fixtures/safe'), useTools: false });
    const vuln = await analyze({ rootDir: resolve('tests/fixtures/vulnerable'), useTools: false });
    expect(safe.overallScore).toBeGreaterThan(vuln.overallScore);
  });

  it('detects the hardcoded secret in the vulnerable repo but not the safe one', async () => {
    const safe = await analyze({ rootDir: resolve('tests/fixtures/safe'), useTools: false });
    const vuln = await analyze({ rootDir: resolve('tests/fixtures/vulnerable'), useTools: false });
    expect(secretScore(vuln)).toBe(5);
    expect(secretScore(safe)).toBe(90);
    expect(vuln.level).toBe('L0');
  });
});
