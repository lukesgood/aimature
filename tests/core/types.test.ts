import { describe, it, expect } from 'vitest';
import { makeFinding } from '../../src/core/types.js';

describe('makeFinding', () => {
  it('clamps score to 0-100 and confidence to 0-1', () => {
    const f = makeFinding({ criterionId: 'sec.secrets', score: 150, confidence: 2, source: 'heuristic' });
    expect(f.score).toBe(100);
    expect(f.confidence).toBe(1);
    expect(f.evidence).toEqual([]);
  });
});
