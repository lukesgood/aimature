import { describe, it, expect } from 'vitest';
import { renderJson, renderMarkdown, renderTerminal } from '../../src/report/render.js';
import type { Report } from '../../src/core/types.js';

const report: Report = {
  overallScore: 62.5,
  level: 'L2',
  levelLabel: 'Beta',
  pillars: [
    { id: 'security', title: 'Security', score: 50, criteria: [
      { criterionId: 'sec.secrets', title: 'Secrets', score: 5, confidence: 0.8, evidence: [{ file: 'a.ts', line: 3, note: 'secret' }] },
    ] },
  ],
  uncovered: ['scal.db'],
  recommendations: ['Remove hardcoded secret in a.ts:3'],
  cappedBy: 'gate.live-secret',
};

describe('renderers', () => {
  it('renderJson round-trips the report', () => {
    expect(JSON.parse(renderJson(report)).level).toBe('L2');
  });
  it('renderMarkdown includes level, score, pillar, uncovered', () => {
    const md = renderMarkdown(report);
    expect(md).toContain('L2');
    expect(md).toContain('Beta');
    expect(md).toContain('Security');
    expect(md).toContain('scal.db');
    expect(md).toContain('gate.live-secret');
    expect(md).toContain('62.5');
    expect(md).toContain('a.ts:3');
  });
  it('renderTerminal produces a non-empty summary', () => {
    expect(renderTerminal(report)).toContain('62.5');
    expect(renderTerminal(report)).toContain('L2');
    expect(renderTerminal(report)).toContain('Beta');
  });
});
