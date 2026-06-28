import { describe, it, expect } from 'vitest';
import { secretsCollector } from '../../src/collectors/secrets.js';
import type { CollectorContext } from '../../src/collectors/types.js';

function ctx(texts: Record<string, string>): CollectorContext {
  return { rootDir: '/x', files: Object.keys(texts), readText: (r) => texts[r] ?? '' };
}

describe('secretsCollector', () => {
  it('flags a hardcoded AWS key with file:line evidence', async () => {
    const fs = await secretsCollector.collect(ctx({
      'src/config.ts': 'const k = "AKIAABCDEFGHIJKLMNOP";',
    }));
    const f = fs[0];
    expect(f.criterionId).toBe('sec.secrets');
    expect(f.score).toBe(5);
    expect(f.evidence[0].file).toBe('src/config.ts');
    expect(f.evidence[0].line).toBe(1);
  });

  it('ignores .env.example and scores high when clean', async () => {
    const fs = await secretsCollector.collect(ctx({
      '.env.example': 'API_KEY="AKIAABCDEFGHIJKLMNOP"',
      'src/app.ts': 'export const x = 1;',
    }));
    expect(fs[0].score).toBe(90);
  });
});
