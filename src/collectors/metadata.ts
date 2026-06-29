import type { Collector, CollectorContext } from './types.js';
import { makeFinding, type Finding } from '../core/types.js';

const CONF = 0.6;

function hasTests(files: string[]): boolean {
  return files.some((f) =>
    // *.test.* / *.spec.* (js/ts) and *_spec.rb etc.
    /\.(test|spec)\.[jt]sx?$/.test(f)
    // a file named exactly test.* or spec.* (e.g. p-limit's root test.js)
    || /(^|\/)(test|spec)\.[jt]sx?$/.test(f)
    // a test/tests/spec/__tests__ directory anywhere
    || /(^|\/)(tests?|specs?|__tests__)\//.test(f)
    // python/go conventions: test_x.py, x_test.py, x_test.go, *_spec.rb
    || /(^|\/)test_[^/]+\.py$/.test(f)
    || /_(test|spec)\.(py|go|rb)$/.test(f));
}

function hasCI(files: string[]): boolean {
  return files.some((f) => f.startsWith('.github/workflows/'))
    || files.includes('.gitlab-ci.yml')
    || files.some((f) => /(^|\/)Dockerfile$/.test(f));
}

function readme(files: string[], ctx: CollectorContext): string | null {
  const f = files.find((p) => /(^|\/)readme(\.[a-z]+)?$/i.test(p));
  return f ? ctx.readText(f) : null;
}

const LOCKFILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock', 'requirements.txt'];

export const metadataCollector: Collector = {
  name: 'metadata',
  async collect(ctx: CollectorContext): Promise<Finding[]> {
    const f = ctx.files;
    const out: Finding[] = [];

    out.push(makeFinding({
      criterionId: 'rel.tests',
      score: hasTests(f) ? 80 : 10,
      confidence: CONF,
      source: 'heuristic',
      evidence: [{ file: '(repo)', note: hasTests(f) ? 'Test files detected' : 'No test files found' }],
    }));

    out.push(makeFinding({
      criterionId: 'maint.cicd',
      score: hasCI(f) ? 80 : 20,
      confidence: CONF,
      source: 'heuristic',
      evidence: [{ file: '(repo)', note: hasCI(f) ? 'CI/Docker config detected' : 'No CI/deployment config' }],
    }));

    const rm = readme(f, ctx);
    const docScore = rm === null ? 10 : rm.length > 200 ? 70 : 40;
    out.push(makeFinding({
      criterionId: 'maint.docs',
      score: docScore,
      confidence: CONF,
      source: 'heuristic',
      evidence: [{ file: '(repo)', note: rm === null ? 'No README' : `README ${rm.length} chars` }],
    }));

    const hasLock = f.some((p) => LOCKFILES.some((l) => p === l || p.endsWith('/' + l)));
    out.push(makeFinding({
      criterionId: 'sec.deps',
      score: hasLock ? 60 : 30,
      confidence: CONF,
      source: 'heuristic',
      evidence: [{ file: '(repo)', note: hasLock ? 'Lockfile present' : 'No dependency lockfile' }],
    }));

    return out;
  },
};
