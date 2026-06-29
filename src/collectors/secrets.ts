import type { Collector, CollectorContext } from './types.js';
import { makeFinding, type Finding, type Evidence } from '../core/types.js';

const PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
];

// Non-production paths where hardcoded "secrets" are normally intentional dummies
// (test fixtures, test/spec sources, mocks) or dev/VCS artifacts (diffs/patches).
// Flagging these as live secrets and capping production maturity is a false signal.
const IGNORED_PATTERNS: RegExp[] = [
  /\.(example|sample|md)$/i,
  /(^|\/)\.env\.example$/,
  /\.(diff|patch)$/i,
  /\.(test|spec)\.[jt]sx?$/i,
  /(^|\/)(tests?|specs?|__tests__|__mocks__|__fixtures__|fixtures|mocks|__snapshots__)\//,
];

function ignored(path: string): boolean {
  return IGNORED_PATTERNS.some((re) => re.test(path));
}

export const secretsCollector: Collector = {
  name: 'secrets',
  async collect(ctx: CollectorContext): Promise<Finding[]> {
    const evidence: Evidence[] = [];
    for (const file of ctx.files) {
      if (ignored(file)) continue;
      const lines = ctx.readText(file).split('\n');
      lines.forEach((line, i) => {
        if (PATTERNS.some((re) => re.test(line))) {
          evidence.push({ file, line: i + 1, note: 'Possible hardcoded secret' });
        }
      });
    }
    const hit = evidence.length > 0;
    return [makeFinding({
      criterionId: 'sec.secrets',
      score: hit ? 5 : 90,
      confidence: 0.8,
      source: 'heuristic',
      evidence: hit ? evidence : [{ file: '(repo)', note: 'No hardcoded secret patterns found' }],
    })];
  },
};
