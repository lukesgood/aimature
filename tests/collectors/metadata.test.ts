import { describe, it, expect } from 'vitest';
import { metadataCollector } from '../../src/collectors/metadata.js';
import type { CollectorContext } from '../../src/collectors/types.js';

function ctx(files: string[], texts: Record<string, string> = {}): CollectorContext {
  return { rootDir: '/x', files, readText: (r) => texts[r] ?? '' };
}

describe('metadataCollector', () => {
  it('rewards presence of tests, CI, README, lockfile', async () => {
    const fs = await metadataCollector.collect(ctx(
      ['src/app.ts', 'src/app.test.ts', '.github/workflows/ci.yml', 'README.md', 'package-lock.json'],
      { 'README.md': 'x'.repeat(300) },
    ));
    const byId = Object.fromEntries(fs.map((f) => [f.criterionId, f.score]));
    expect(byId['rel.tests']).toBe(80);
    expect(byId['maint.cicd']).toBe(80);
    expect(byId['maint.docs']).toBe(70);
    expect(byId['sec.deps']).toBe(60);
  });

  it('penalizes absence', async () => {
    const fs = await metadataCollector.collect(ctx(['src/app.ts']));
    const byId = Object.fromEntries(fs.map((f) => [f.criterionId, f.score]));
    expect(byId['rel.tests']).toBe(10);
    expect(byId['maint.cicd']).toBe(20);
    expect(byId['maint.docs']).toBe(10);
  });
});
