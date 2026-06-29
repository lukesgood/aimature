import { describe, it, expect } from 'vitest';
import { score } from '../../src/core/scoring.js';
import { loadFramework, defaultFrameworkPath } from '../../src/core/framework.js';
import { makeFinding } from '../../src/core/types.js';

const fw = loadFramework(defaultFrameworkPath());

describe('score', () => {
  it('merges findings by confidence-weighted average', () => {
    const findings = [
      makeFinding({ criterionId: 'sec.secrets', score: 80, confidence: 0.5, source: 'heuristic' }),
      makeFinding({ criterionId: 'sec.secrets', score: 40, confidence: 0.5, source: 'llm' }),
    ];
    const r = score(fw, findings);
    const sec = r.pillars.find((p) => p.id === 'security')!;
    const secrets = sec.criteria.find((c) => c.criterionId === 'sec.secrets')!;
    expect(secrets.score).toBeCloseTo(60, 5);
  });

  it('lists criteria with no findings as uncovered', () => {
    const r = score(fw, []);
    expect(r.uncovered.length).toBeGreaterThan(0);
    expect(r.uncovered).toContain('rel.tests');
  });

  it('excludes a fully-unmeasured pillar from the overall and flags it', () => {
    // Cover only security, reliability, maintainability criteria; leave all scalability criteria uncovered.
    const findings = fw.pillars
      .filter((p) => p.id !== 'scalability')
      .flatMap((p) => p.criteria.map((c) =>
        makeFinding({ criterionId: c.id, score: 80, confidence: 1, source: 'heuristic' })));
    const r = score(fw, findings);
    const scal = r.pillars.find((p) => p.id === 'scalability')!;
    expect(scal.measured).toBe(false);
    // Every measured pillar scored 80, so the renormalized overall is 80 (scalability's 0 is NOT dragging it down).
    expect(r.overallScore).toBeCloseTo(80, 5);
  });

  it('caps level at L1 when a security gate trips', () => {
    // High scores everywhere except sec.secrets which trips the gate.
    const findings = fw.pillars.flatMap((p) =>
      p.criteria.map((c) =>
        makeFinding({
          criterionId: c.id,
          score: c.id === 'sec.secrets' ? 10 : 95,
          confidence: 1,
          source: 'heuristic',
        }),
      ),
    );
    const r = score(fw, findings);
    expect(r.cappedBy).toBe('gate.live-secret');
    expect(r.level).toBe('L1');
  });
});
