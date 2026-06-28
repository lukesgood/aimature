import type { Adapter, ExecFn } from './types.js';
import type { CollectorContext } from '../collectors/types.js';
import { makeFinding, type Finding } from '../core/types.js';

export const npmAuditAdapter: Adapter = {
  name: 'npm-audit',
  isApplicable(ctx: CollectorContext): boolean {
    return ctx.files.includes('package.json');
  },
  async run(ctx: CollectorContext, exec: ExecFn): Promise<Finding[]> {
    const res = exec('npm', ['audit', '--json'], ctx.rootDir);
    let data: any;
    try {
      data = JSON.parse(res.stdout);
    } catch {
      return [];
    }
    const v = data?.metadata?.vulnerabilities;
    if (!v) return [];
    const score = Math.max(0, 100 - (v.critical ?? 0) * 40 - (v.high ?? 0) * 15 - (v.moderate ?? 0) * 5);
    return [makeFinding({
      criterionId: 'sec.deps',
      score,
      confidence: 0.9,
      source: 'tool',
      evidence: [{ file: 'package.json', note: `npm audit: ${v.critical ?? 0} critical, ${v.high ?? 0} high, ${v.moderate ?? 0} moderate` }],
    })];
  },
};
