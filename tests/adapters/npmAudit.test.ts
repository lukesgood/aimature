import { describe, it, expect } from 'vitest';
import { npmAuditAdapter } from '../../src/adapters/npmAudit.js';
import type { CollectorContext } from '../../src/collectors/types.js';

const ctx: CollectorContext = { rootDir: '/x', files: ['package.json'], readText: () => '{}' };

describe('npmAuditAdapter', () => {
  it('is applicable when package.json exists', () => {
    expect(npmAuditAdapter.isApplicable(ctx)).toBe(true);
    expect(npmAuditAdapter.isApplicable({ ...ctx, files: [] })).toBe(false);
  });

  it('maps vulnerability counts to a sec.deps score', async () => {
    const exec = () => ({
      stdout: JSON.stringify({ metadata: { vulnerabilities: { critical: 1, high: 2, moderate: 0, low: 0 } } }),
      status: 1,
    });
    const fs = await npmAuditAdapter.run(ctx, exec);
    expect(fs[0].criterionId).toBe('sec.deps');
    expect(fs[0].score).toBe(30); // 100 - 40 - 30
    expect(fs[0].source).toBe('tool');
  });

  it('returns [] when output is not JSON', async () => {
    const exec = () => ({ stdout: 'npm not found', status: 127 });
    const fs = await npmAuditAdapter.run(ctx, exec);
    expect(fs).toEqual([]);
  });
});
