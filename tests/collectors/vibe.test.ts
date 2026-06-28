import { describe, it, expect } from 'vitest';
import { vibeCollector } from '../../src/collectors/vibe.js';
import type { CollectorContext } from '../../src/collectors/types.js';

function ctx(texts: Record<string, string>): CollectorContext {
  return { rootDir: '/x', files: Object.keys(texts), readText: (r) => texts[r] ?? '' };
}

describe('vibeCollector', () => {
  it('penalizes conventions when TODOs/placeholders are dense', async () => {
    const texts: Record<string, string> = {};
    texts['a.ts'] = '// TODO fix\nconst u = "your-api-key";\n// FIXME\n';
    const fs = await vibeCollector.collect(ctx(texts));
    const conv = fs.find((f) => f.criterionId === 'maint.conventions')!;
    expect(conv.score).toBeLessThan(90);
    expect(conv.evidence.length).toBeGreaterThan(0);
  });

  it('rewards a clean, consistent codebase', async () => {
    const texts: Record<string, string> = {
      'a.ts': '  const x = 1;\n',
      'b.ts': '  const y = 2;\n',
    };
    const fs = await vibeCollector.collect(ctx(texts));
    const conv = fs.find((f) => f.criterionId === 'maint.conventions')!;
    const struct = fs.find((f) => f.criterionId === 'maint.structure')!;
    expect(conv.score).toBe(90);
    expect(struct.score).toBe(80);
  });
});
