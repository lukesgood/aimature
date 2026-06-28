import { describe, it, expect } from 'vitest';
import { loadFramework, defaultFrameworkPath } from '../../src/core/framework.js';

describe('loadFramework', () => {
  it('loads the default framework with 4 pillars summing to 1.0', () => {
    const fw = loadFramework(defaultFrameworkPath());
    expect(fw.pillars).toHaveLength(4);
    const sum = fw.pillars.reduce((a, p) => a + p.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
    expect(fw.levels).toHaveLength(5);
    expect(fw.gates.length).toBeGreaterThan(0);
  });

  it('throws when pillar weights do not sum to 1', () => {
    expect(() => loadFramework('tests/fixtures/bad-framework.yaml')).toThrow();
  });
});
