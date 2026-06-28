# AIMature Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `aim`, a CLI that scans a repository and scores its production maturity (Security / Reliability / Scalability / Maintainability-Ops) using a declarative rubric, three measurement layers, and an evidence-based report.

**Architecture:** A declarative framework (`config/framework.yaml`) is the single source of truth for pillars, criteria, weights, level bands, and gate rules. A scoring engine consumes normalized `Finding[]` produced by three layers — static heuristic collectors (always), external-tool adapters (run if present), and an optional LLM reviewer — and produces a `Report`. Layers degrade gracefully: a missing layer lowers confidence and may mark criteria uncovered, never crashes the run.

**Tech Stack:** TypeScript, Node.js (≥18), Vitest (test runner), commander (CLI), js-yaml (config), zod (config validation), @anthropic-ai/sdk (LLM layer).

## Global Constraints

- Node.js ≥ 18 (uses built-in `fs`, `node:test`-free; ESM modules `"type": "module"`).
- Language: TypeScript, strict mode on. All source under `src/`, tests colocated under `tests/`.
- CLI command name is `aim`; package/framework name is `AIMature`.
- Pillar weights sum to 1.0. Default weights: Security 0.30, Reliability 0.25, Scalability 0.20, Maintainability/Ops 0.25.
- `Finding.score` is 0–100; `Finding.confidence` is 0–1.
- Level bands: L0 0–40, L1 40–60, L2 60–75, L3 75–90, L4 90–100 (lower-inclusive, upper-exclusive; 100 falls in L4).
- Gate rule: any criterion scoring below its gate threshold caps the overall level at the gate's `capLevel` (most restrictive cap wins).
- No layer failure aborts the run; failures become "uncovered" criteria reported honestly.
- Default LLM model id: `claude-opus-4-8` (overridable). LLM layer is skipped when no API key.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a buildable TS/ESM project where `npm test` runs Vitest.

- [ ] **Step 1: Write the failing test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('scaffold', () => {
  it('exposes a version string', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Create project files**

`package.json`:
```json
{
  "name": "aimature",
  "version": "0.1.0",
  "type": "module",
  "bin": { "aim": "./dist/cli.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "commander": "^12.0.0",
    "js-yaml": "^4.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

`src/index.ts`:
```ts
export const VERSION = '0.1.0';
```

- [ ] **Step 3: Install and run the test**

Run: `npm install && npm test`
Expected: PASS (1 test, `scaffold > exposes a version string`).

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/index.ts tests/smoke.test.ts
git commit -m "chore: scaffold AIMature TypeScript project"
```

---

### Task 2: Core types

**Files:**
- Create: `src/core/types.ts`
- Test: `tests/core/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: shared types used by every later task — `Source`, `Evidence`, `Finding`, `Criterion`, `Pillar`, `GateRule`, `LevelBand`, `Framework`, `CriterionResult`, `PillarResult`, `Report`. Exact field names below are relied on by Tasks 3–12.

- [ ] **Step 1: Write the failing test**

`tests/core/types.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/types.test.ts`
Expected: FAIL — cannot find module `../../src/core/types.js`.

- [ ] **Step 3: Write the implementation**

`src/core/types.ts`:
```ts
export type Source = 'heuristic' | 'tool' | 'llm';

export interface Evidence {
  file: string;
  line?: number;
  note: string;
}

export interface Finding {
  criterionId: string;
  score: number;        // 0-100
  evidence: Evidence[];
  confidence: number;   // 0-1
  source: Source;
}

export interface Criterion {
  id: string;
  title: string;
  pillarId: string;
  weight: number;       // relative weight within its pillar
}

export interface Pillar {
  id: string;
  title: string;
  weight: number;       // 0-1, pillars sum to 1
  criteria: Criterion[];
}

export interface GateRule {
  id: string;
  criterionId: string;
  whenScoreBelow: number;
  capLevel: string;     // e.g. 'L1'
  description: string;
}

export interface LevelBand {
  level: string;        // 'L0'..'L4'
  min: number;
  max: number;
  label: string;
}

export interface Framework {
  pillars: Pillar[];
  levels: LevelBand[];
  gates: GateRule[];
}

export interface CriterionResult {
  criterionId: string;
  title: string;
  score: number;
  confidence: number;
  evidence: Evidence[];
}

export interface PillarResult {
  id: string;
  title: string;
  score: number;
  criteria: CriterionResult[];
}

export interface Report {
  overallScore: number;
  level: string;
  levelLabel: string;
  pillars: PillarResult[];
  uncovered: string[];
  recommendations: string[];
  cappedBy?: string;
}

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

export function makeFinding(input: {
  criterionId: string;
  score: number;
  confidence: number;
  source: Source;
  evidence?: Evidence[];
}): Finding {
  return {
    criterionId: input.criterionId,
    score: clamp(input.score, 0, 100),
    confidence: clamp(input.confidence, 0, 1),
    source: input.source,
    evidence: input.evidence ?? [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts tests/core/types.test.ts
git commit -m "feat: add core types and makeFinding helper"
```

---

### Task 3: Framework config loader + default rubric

**Files:**
- Create: `config/framework.yaml`
- Create: `src/core/framework.ts`
- Test: `tests/core/framework.test.ts`

**Interfaces:**
- Consumes: `Framework`, `Pillar`, `Criterion`, `LevelBand`, `GateRule` from `src/core/types.ts`.
- Produces: `loadFramework(path: string): Framework` (parses + validates YAML, throws on invalid) and `defaultFrameworkPath(): string` returning the bundled `config/framework.yaml` absolute path. Criterion ids referenced by later tasks: `sec.secrets`, `sec.deps`, `sec.authz`, `sec.input`, `rel.errors`, `rel.tests`, `rel.logging`, `scal.architecture`, `scal.state`, `scal.db`, `maint.structure`, `maint.conventions`, `maint.docs`, `maint.cicd`.

- [ ] **Step 1: Write the failing test**

`tests/core/framework.test.ts`:
```ts
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
```

- [ ] **Step 2: Create the bad fixture and run test to verify it fails**

`tests/fixtures/bad-framework.yaml`:
```yaml
pillars:
  - id: security
    title: Security
    weight: 0.5
    criteria:
      - { id: sec.secrets, title: Secrets, weight: 1 }
levels:
  - { level: L0, min: 0, max: 40, label: Prototype }
gates: []
```

Run: `npx vitest run tests/core/framework.test.ts`
Expected: FAIL — cannot find module `../../src/core/framework.js`.

- [ ] **Step 3: Create the default framework rubric**

`config/framework.yaml`:
```yaml
pillars:
  - id: security
    title: Security
    weight: 0.30
    criteria:
      - { id: sec.secrets, title: Hardcoded secrets/keys, weight: 0.35 }
      - { id: sec.deps,    title: Dependency vulnerabilities, weight: 0.25 }
      - { id: sec.authz,   title: Authentication & authorization, weight: 0.25 }
      - { id: sec.input,   title: Input validation & injection defense, weight: 0.15 }
  - id: reliability
    title: Reliability
    weight: 0.25
    criteria:
      - { id: rel.errors,  title: Error handling, weight: 0.4 }
      - { id: rel.tests,   title: Test coverage, weight: 0.4 }
      - { id: rel.logging, title: Logging & monitoring, weight: 0.2 }
  - id: scalability
    title: Scalability
    weight: 0.20
    criteria:
      - { id: scal.architecture, title: Architecture layering, weight: 0.4 }
      - { id: scal.state,        title: Statelessness, weight: 0.3 }
      - { id: scal.db,           title: DB/query efficiency, weight: 0.3 }
  - id: maintainability
    title: Maintainability & Operations
    weight: 0.25
    criteria:
      - { id: maint.structure,   title: Code structure & complexity, weight: 0.3 }
      - { id: maint.conventions, title: Convention consistency, weight: 0.2 }
      - { id: maint.docs,        title: Documentation, weight: 0.2 }
      - { id: maint.cicd,        title: CI/CD & deployment config, weight: 0.3 }
levels:
  - { level: L0, min: 0,  max: 40,  label: Prototype }
  - { level: L1, min: 40, max: 60,  label: MVP }
  - { level: L2, min: 60, max: 75,  label: Beta }
  - { level: L3, min: 75, max: 90,  label: Production-Ready }
  - { level: L4, min: 90, max: 100, label: Scale-Ready }
gates:
  - id: gate.live-secret
    criterionId: sec.secrets
    whenScoreBelow: 30
    capLevel: L1
    description: Exposed/live secret detected — caps maturity at L1 regardless of score.
```

- [ ] **Step 4: Write the loader**

`src/core/framework.ts`:
```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { Framework } from './types.js';

const criterionSchema = z.object({
  id: z.string(),
  title: z.string(),
  weight: z.number().positive(),
});

const pillarSchema = z.object({
  id: z.string(),
  title: z.string(),
  weight: z.number().positive(),
  criteria: z.array(criterionSchema).min(1),
});

const frameworkSchema = z.object({
  pillars: z.array(pillarSchema).min(1),
  levels: z.array(z.object({
    level: z.string(), min: z.number(), max: z.number(), label: z.string(),
  })).min(1),
  gates: z.array(z.object({
    id: z.string(),
    criterionId: z.string(),
    whenScoreBelow: z.number(),
    capLevel: z.string(),
    description: z.string(),
  })),
});

export function loadFramework(path: string): Framework {
  const raw = yaml.load(readFileSync(path, 'utf8'));
  const parsed = frameworkSchema.parse(raw);
  const sum = parsed.pillars.reduce((a, p) => a + p.weight, 0);
  if (Math.abs(sum - 1) > 1e-6) {
    throw new Error(`Pillar weights must sum to 1.0, got ${sum}`);
  }
  return {
    pillars: parsed.pillars.map((p) => ({
      id: p.id,
      title: p.title,
      weight: p.weight,
      criteria: p.criteria.map((c) => ({ ...c, pillarId: p.id })),
    })),
    levels: parsed.levels,
    gates: parsed.gates,
  };
}

export function defaultFrameworkPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '../../config/framework.yaml');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/core/framework.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add config/framework.yaml src/core/framework.ts tests/core/framework.test.ts tests/fixtures/bad-framework.yaml
git commit -m "feat: declarative framework rubric and validated loader"
```

---

### Task 4: Scoring engine

**Files:**
- Create: `src/core/scoring.ts`
- Test: `tests/core/scoring.test.ts`

**Interfaces:**
- Consumes: `Framework`, `Finding`, `Report` from `types.ts`.
- Produces: `score(framework: Framework, findings: Finding[]): Report`.
  - Merges findings per criterion via confidence-weighted average score; merged confidence = max of contributing confidences; merged evidence = concatenation.
  - A criterion with zero findings is excluded from its pillar average and added to `report.uncovered`; remaining criteria in that pillar are re-normalized by weight.
  - A pillar with zero covered criteria contributes 0 with the pillar still counted in the overall weighted sum.
  - Overall = weighted sum of pillar scores by pillar weight. Level = band whose `[min, max)` contains the score (score 100 → top band).
  - Gates: for each gate whose criterion score is below `whenScoreBelow`, cap the level; the most restrictive (lowest-index band) cap wins; set `report.cappedBy` to that gate id.

- [ ] **Step 1: Write the failing test**

`tests/core/scoring.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/scoring.test.ts`
Expected: FAIL — cannot find module `../../src/core/scoring.js`.

- [ ] **Step 3: Write the implementation**

`src/core/scoring.ts`:
```ts
import type {
  Framework, Finding, Report, PillarResult, CriterionResult, Evidence,
} from './types.js';

function mergeCriterion(findings: Finding[]): { score: number; confidence: number; evidence: Evidence[] } {
  const totalConf = findings.reduce((a, f) => a + f.confidence, 0);
  const weighted = totalConf > 0
    ? findings.reduce((a, f) => a + f.score * f.confidence, 0) / totalConf
    : 0;
  return {
    score: weighted,
    confidence: Math.max(...findings.map((f) => f.confidence)),
    evidence: findings.flatMap((f) => f.evidence),
  };
}

function levelForScore(framework: Framework, s: number): { level: string; label: string } {
  for (const band of framework.levels) {
    if (s >= band.min && (s < band.max || (band.max >= 100 && s <= 100))) {
      return { level: band.level, label: band.label };
    }
  }
  const last = framework.levels[framework.levels.length - 1];
  return { level: last.level, label: last.label };
}

export function score(framework: Framework, findings: Finding[]): Report {
  const byCriterion = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byCriterion.get(f.criterionId) ?? [];
    list.push(f);
    byCriterion.set(f.criterionId, list);
  }

  const uncovered: string[] = [];
  const criterionScores = new Map<string, number>();
  const pillars: PillarResult[] = [];

  for (const pillar of framework.pillars) {
    const covered: { c: CriterionResult; weight: number }[] = [];
    const criteriaResults: CriterionResult[] = [];

    for (const crit of pillar.criteria) {
      const fs = byCriterion.get(crit.id);
      if (!fs || fs.length === 0) {
        uncovered.push(crit.id);
        continue;
      }
      const merged = mergeCriterion(fs);
      criterionScores.set(crit.id, merged.score);
      const cr: CriterionResult = {
        criterionId: crit.id,
        title: crit.title,
        score: merged.score,
        confidence: merged.confidence,
        evidence: merged.evidence,
      };
      criteriaResults.push(cr);
      covered.push({ c: cr, weight: crit.weight });
    }

    const wsum = covered.reduce((a, x) => a + x.weight, 0);
    const pillarScore = wsum > 0
      ? covered.reduce((a, x) => a + x.c.score * x.weight, 0) / wsum
      : 0;

    pillars.push({ id: pillar.id, title: pillar.title, score: pillarScore, criteria: criteriaResults });
  }

  const overallScore = framework.pillars.reduce((a, p) => {
    const pr = pillars.find((x) => x.id === p.id)!;
    return a + pr.score * p.weight;
  }, 0);

  let { level, label } = levelForScore(framework, overallScore);
  let cappedBy: string | undefined;
  const levelIndex = (lvl: string) => framework.levels.findIndex((b) => b.level === lvl);

  for (const gate of framework.gates) {
    const cs = criterionScores.get(gate.criterionId);
    if (cs !== undefined && cs < gate.whenScoreBelow) {
      if (levelIndex(gate.capLevel) < levelIndex(level)) {
        level = gate.capLevel;
        label = framework.levels[levelIndex(gate.capLevel)].label;
        cappedBy = gate.id;
      }
    }
  }

  return {
    overallScore,
    level,
    levelLabel: label,
    pillars,
    uncovered,
    recommendations: [],
    cappedBy,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/scoring.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/scoring.ts tests/core/scoring.test.ts
git commit -m "feat: scoring engine with merge, levels, and gate caps"
```

---

### Task 5: Collector interface + repo scanner

**Files:**
- Create: `src/collectors/types.ts`
- Create: `src/collectors/scan.ts`
- Test: `tests/collectors/scan.test.ts`

**Interfaces:**
- Consumes: `Finding` from `types.ts`.
- Produces:
  - `interface CollectorContext { rootDir: string; files: string[]; readText(rel: string): string; }`
  - `interface Collector { name: string; collect(ctx: CollectorContext): Promise<Finding[]>; }`
  - `buildContext(rootDir: string): CollectorContext` — walks the tree, returns POSIX-style relative paths, skips `node_modules`, `.git`, `dist`. `readText` returns `''` for unreadable/binary files.

- [ ] **Step 1: Write the failing test**

`tests/collectors/scan.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../../src/collectors/scan.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'aim-'));
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1;');
  writeFileSync(join(dir, 'node_modules', 'junk.js'), 'noise');
});

describe('buildContext', () => {
  it('lists files with posix relative paths and ignores node_modules', () => {
    const ctx = buildContext(dir);
    expect(ctx.files).toContain('src/a.ts');
    expect(ctx.files.some((f) => f.includes('node_modules'))).toBe(false);
  });
  it('reads file text by relative path', () => {
    const ctx = buildContext(dir);
    expect(ctx.readText('src/a.ts')).toContain('export const a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/collectors/scan.test.ts`
Expected: FAIL — cannot find module `../../src/collectors/scan.js`.

- [ ] **Step 3: Write the implementation**

`src/collectors/types.ts`:
```ts
import type { Finding } from '../core/types.js';

export interface CollectorContext {
  rootDir: string;
  files: string[];                 // posix-style relative paths
  readText(rel: string): string;   // '' if unreadable
}

export interface Collector {
  name: string;
  collect(ctx: CollectorContext): Promise<Finding[]>;
}
```

`src/collectors/scan.ts`:
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { CollectorContext } from './types.js';

const IGNORE = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'coverage']);

function walk(root: string, current: string, out: string[]): void {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE.has(entry.name)) continue;
      walk(root, join(current, entry.name), out);
    } else if (entry.isFile()) {
      out.push(relative(root, join(current, entry.name)).split(sep).join('/'));
    }
  }
}

export function buildContext(rootDir: string): CollectorContext {
  const files: string[] = [];
  walk(rootDir, rootDir, files);
  return {
    rootDir,
    files,
    readText(rel: string): string {
      try {
        const buf = readFileSync(join(rootDir, rel));
        if (buf.includes(0)) return '';   // crude binary guard
        return buf.toString('utf8');
      } catch {
        return '';
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/collectors/scan.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/collectors/types.ts src/collectors/scan.ts tests/collectors/scan.test.ts
git commit -m "feat: collector interface and repo scanner context"
```

---

### Task 6: Metadata collector (tests, CI, docs, deps presence)

**Files:**
- Create: `src/collectors/metadata.ts`
- Test: `tests/collectors/metadata.test.ts`

**Interfaces:**
- Consumes: `Collector`, `CollectorContext` from `collectors/types.ts`; `makeFinding` from `core/types.ts`.
- Produces: `metadataCollector: Collector`. Emits heuristic findings (confidence 0.6) for `rel.tests`, `maint.cicd`, `maint.docs`, `sec.deps`:
  - `rel.tests`: 80 if any path matches `/\.(test|spec)\.[jt]sx?$/` or a `tests/`/`__tests__/` dir exists, else 10.
  - `maint.cicd`: 80 if `.github/workflows/` file or `.gitlab-ci.yml` or `Dockerfile` present, else 20.
  - `maint.docs`: 70 if a `README` file (any case/extension) exists and is >200 chars, 40 if exists but short, else 10.
  - `sec.deps`: 60 if a lockfile (`package-lock.json`/`pnpm-lock.yaml`/`yarn.lock`/`poetry.lock`/`requirements.txt`) exists, else 30 (no pin → weaker baseline). (Real vuln scan added in Task 9 adapter.)

- [ ] **Step 1: Write the failing test**

`tests/collectors/metadata.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/collectors/metadata.test.ts`
Expected: FAIL — cannot find module `../../src/collectors/metadata.js`.

- [ ] **Step 3: Write the implementation**

`src/collectors/metadata.ts`:
```ts
import type { Collector, CollectorContext } from './types.js';
import { makeFinding, type Finding } from '../core/types.js';

const CONF = 0.6;

function hasTests(files: string[]): boolean {
  return files.some((f) => /\.(test|spec)\.[jt]sx?$/.test(f))
    || files.some((f) => /(^|\/)(tests|__tests__)\//.test(f));
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/collectors/metadata.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/collectors/metadata.ts tests/collectors/metadata.test.ts
git commit -m "feat: metadata collector for tests/CI/docs/deps presence"
```

---

### Task 7: Secret-detection collector

**Files:**
- Create: `src/collectors/secrets.ts`
- Test: `tests/collectors/secrets.test.ts`

**Interfaces:**
- Consumes: `Collector`, `CollectorContext`; `makeFinding`.
- Produces: `secretsCollector: Collector`. Scans text files for high-signal secret patterns and emits one `sec.secrets` finding (confidence 0.8):
  - Patterns: AWS access key `AKIA[0-9A-Z]{16}`, generic `(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]`, private key header `-----BEGIN (RSA |EC )?PRIVATE KEY-----`.
  - Ignores files matching `\.(example|sample|md)$` or named `.env.example`.
  - Score: 5 if any match (with `file:line` evidence), else 90 (absence ⇒ high but not perfect since heuristic).

- [ ] **Step 1: Write the failing test**

`tests/collectors/secrets.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/collectors/secrets.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

`src/collectors/secrets.ts`:
```ts
import type { Collector, CollectorContext } from './types.js';
import { makeFinding, type Finding, type Evidence } from '../core/types.js';

const PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/,
  /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
];

function ignored(path: string): boolean {
  return /\.(example|sample|md)$/i.test(path) || /(^|\/)\.env\.example$/.test(path);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/collectors/secrets.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/collectors/secrets.ts tests/collectors/secrets.test.ts
git commit -m "feat: secret-detection collector with file:line evidence"
```

---

### Task 8: Vibe-signal collector

**Files:**
- Create: `src/collectors/vibe.ts`
- Test: `tests/collectors/vibe.test.ts`

**Interfaces:**
- Consumes: `Collector`, `CollectorContext`; `makeFinding`.
- Produces: `vibeCollector: Collector`. Detects AI-generation artifacts and emits findings for `maint.conventions` and `maint.structure` (confidence 0.5):
  - Placeholder/TODO density: count lines matching `/\b(TODO|FIXME|XXX)\b/` or placeholder values (`example.com`, `your-api-key`, `changeme`) across code files. `maint.conventions` score = `max(20, 90 - density*10)` where density = markers per 10 files (rounded).
  - Indentation inconsistency: fraction of `.ts/.js` files starting body lines with tabs vs spaces mixed within the repo. `maint.structure` score = 80 if a single dominant indent style (>80% one kind), else 50.
  - Emits evidence with example file locations for each marker (cap 5).

- [ ] **Step 1: Write the failing test**

`tests/collectors/vibe.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/collectors/vibe.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

`src/collectors/vibe.ts`:
```ts
import type { Collector, CollectorContext } from './types.js';
import { makeFinding, type Finding, type Evidence } from '../core/types.js';

const CODE = /\.[jt]sx?$|\.py$/;
const MARKER = /\b(TODO|FIXME|XXX)\b|example\.com|your-api-key|changeme/i;
const INDENT = /^([ \t])/;

export const vibeCollector: Collector = {
  name: 'vibe',
  async collect(ctx: CollectorContext): Promise<Finding[]> {
    const codeFiles = ctx.files.filter((f) => CODE.test(f));
    const evidence: Evidence[] = [];
    let markers = 0;
    let tabFiles = 0;
    let spaceFiles = 0;

    for (const file of codeFiles) {
      const lines = ctx.readText(file).split('\n');
      let tabs = 0, spaces = 0;
      lines.forEach((line, i) => {
        if (MARKER.test(line)) {
          markers++;
          if (evidence.length < 5) evidence.push({ file, line: i + 1, note: 'Placeholder/TODO marker' });
        }
        const m = INDENT.exec(line);
        if (m) { if (m[1] === '\t') tabs++; else spaces++; }
      });
      if (tabs > spaces) tabFiles++; else if (spaces > tabs) spaceFiles++;
    }

    const density = codeFiles.length > 0 ? Math.round((markers / codeFiles.length) * 10) : 0;
    const convScore = Math.max(20, 90 - density * 10);

    const totalIndent = tabFiles + spaceFiles;
    const dominant = totalIndent === 0 ? 1 : Math.max(tabFiles, spaceFiles) / totalIndent;
    const structScore = dominant > 0.8 ? 80 : 50;

    const out: Finding[] = [];
    out.push(makeFinding({
      criterionId: 'maint.conventions',
      score: convScore,
      confidence: 0.5,
      source: 'heuristic',
      evidence: evidence.length ? evidence : [{ file: '(repo)', note: 'No placeholder markers found' }],
    }));
    out.push(makeFinding({
      criterionId: 'maint.structure',
      score: structScore,
      confidence: 0.5,
      source: 'heuristic',
      evidence: [{ file: '(repo)', note: `Indent consistency ${(dominant * 100).toFixed(0)}%` }],
    }));
    return out;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/collectors/vibe.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/collectors/vibe.ts tests/collectors/vibe.test.ts
git commit -m "feat: vibe-signal collector for AI-generation artifacts"
```

---

### Task 9: External-tool adapter (npm audit) with graceful skip

**Files:**
- Create: `src/adapters/types.ts`
- Create: `src/adapters/npmAudit.ts`
- Test: `tests/adapters/npmAudit.test.ts`

**Interfaces:**
- Consumes: `Finding`, `makeFinding`; `CollectorContext`.
- Produces:
  - `interface Adapter { name: string; isApplicable(ctx: CollectorContext): boolean; run(ctx: CollectorContext, exec: ExecFn): Promise<Finding[]>; }`
  - `type ExecFn = (cmd: string, args: string[], cwd: string) => { stdout: string; status: number | null }`
  - `npmAuditAdapter: Adapter`. `isApplicable` = repo has `package.json`. `run` calls `exec('npm', ['audit', '--json'], rootDir)`, parses `metadata.vulnerabilities`, maps to a `sec.deps` finding (confidence 0.9): score = `max(0, 100 - critical*40 - high*15 - moderate*5)`. On non-JSON/exec failure returns `[]` (uncovered).
  - The real `ExecFn` (spawning a child process) is provided by the orchestrator in Task 12; tests inject a fake.

- [ ] **Step 1: Write the failing test**

`tests/adapters/npmAudit.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/adapters/npmAudit.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

`src/adapters/types.ts`:
```ts
import type { Finding } from '../core/types.js';
import type { CollectorContext } from '../collectors/types.js';

export type ExecFn = (cmd: string, args: string[], cwd: string) => { stdout: string; status: number | null };

export interface Adapter {
  name: string;
  isApplicable(ctx: CollectorContext): boolean;
  run(ctx: CollectorContext, exec: ExecFn): Promise<Finding[]>;
}
```

`src/adapters/npmAudit.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/adapters/npmAudit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/types.ts src/adapters/npmAudit.ts tests/adapters/npmAudit.test.ts
git commit -m "feat: adapter interface and npm audit adapter with graceful skip"
```

---

### Task 10: LLM reviewer layer (injectable client, graceful skip)

**Files:**
- Create: `src/llm/reviewer.ts`
- Test: `tests/llm/reviewer.test.ts`

**Interfaces:**
- Consumes: `Finding`, `makeFinding`; `CollectorContext`.
- Produces:
  - `type LlmClient = (prompt: string) => Promise<string>` — returns raw model text.
  - `llmReview(ctx: CollectorContext, client: LlmClient | null): Promise<Finding[]>`. If `client` is null returns `[]` (layer skipped). Otherwise builds a prompt from a code sample (first 20 code files, capped 12k chars) asking for JSON `{ "scores": { "<criterionId>": { "score": n, "note": "..." } } }` over criteria `scal.architecture`, `scal.state`, `scal.db`, `sec.authz`, `sec.input`, `rel.errors`, `rel.logging`. Parses the JSON (tolerating ```json fences), emits one finding per returned criterion (confidence 0.7, source 'llm'). Malformed JSON ⇒ `[]`.
  - `createAnthropicClient(model: string, apiKey: string | undefined): LlmClient | null` — returns null if no key; otherwise a client using `@anthropic-ai/sdk`.

- [ ] **Step 1: Write the failing test**

`tests/llm/reviewer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { llmReview, createAnthropicClient } from '../../src/llm/reviewer.js';
import type { CollectorContext } from '../../src/collectors/types.js';

const ctx: CollectorContext = {
  rootDir: '/x',
  files: ['src/app.ts'],
  readText: () => 'export function handler() { return 1; }',
};

describe('llmReview', () => {
  it('skips (returns []) when client is null', async () => {
    expect(await llmReview(ctx, null)).toEqual([]);
    expect(createAnthropicClient('claude-opus-4-8', undefined)).toBeNull();
  });

  it('parses JSON scores from the model into findings', async () => {
    const client = async () => '```json\n{"scores":{"sec.authz":{"score":40,"note":"no auth"}}}\n```';
    const fs = await llmReview(ctx, client);
    expect(fs).toHaveLength(1);
    expect(fs[0].criterionId).toBe('sec.authz');
    expect(fs[0].score).toBe(40);
    expect(fs[0].source).toBe('llm');
  });

  it('returns [] on malformed model output', async () => {
    const client = async () => 'I cannot help with that.';
    expect(await llmReview(ctx, client)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/llm/reviewer.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

`src/llm/reviewer.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk';
import type { CollectorContext } from '../collectors/types.js';
import { makeFinding, type Finding } from '../core/types.js';

export type LlmClient = (prompt: string) => Promise<string>;

const CRITERIA = ['scal.architecture', 'scal.state', 'scal.db', 'sec.authz', 'sec.input', 'rel.errors', 'rel.logging'];
const CODE = /\.[jt]sx?$|\.py$/;

function buildPrompt(ctx: CollectorContext): string {
  const sample = ctx.files.filter((f) => CODE.test(f)).slice(0, 20)
    .map((f) => `--- ${f} ---\n${ctx.readText(f)}`)
    .join('\n\n')
    .slice(0, 12000);
  return [
    'You are a senior engineer assessing production maturity of a (likely AI-generated) codebase.',
    `Score each of these criteria 0-100 (higher = more production-ready): ${CRITERIA.join(', ')}.`,
    'Reply ONLY with JSON: {"scores":{"<criterionId>":{"score":<0-100>,"note":"<short reason>"}}}.',
    '',
    'CODE SAMPLE:',
    sample,
  ].join('\n');
}

function extractJson(text: string): any | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function llmReview(ctx: CollectorContext, client: LlmClient | null): Promise<Finding[]> {
  if (!client) return [];
  let text: string;
  try {
    text = await client(buildPrompt(ctx));
  } catch {
    return [];
  }
  const parsed = extractJson(text);
  const scores = parsed?.scores;
  if (!scores || typeof scores !== 'object') return [];

  const out: Finding[] = [];
  for (const [criterionId, val] of Object.entries(scores as Record<string, any>)) {
    if (!CRITERIA.includes(criterionId) || typeof val?.score !== 'number') continue;
    out.push(makeFinding({
      criterionId,
      score: val.score,
      confidence: 0.7,
      source: 'llm',
      evidence: [{ file: '(llm)', note: String(val.note ?? 'LLM assessment') }],
    }));
  }
  return out;
}

export function createAnthropicClient(model: string, apiKey: string | undefined): LlmClient | null {
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });
  return async (prompt: string): Promise<string> => {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/llm/reviewer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/reviewer.ts tests/llm/reviewer.test.ts
git commit -m "feat: LLM reviewer layer with injectable client and graceful skip"
```

---

### Task 11: Reporters (terminal, JSON, Markdown)

**Files:**
- Create: `src/report/render.ts`
- Test: `tests/report/render.test.ts`

**Interfaces:**
- Consumes: `Report` from `core/types.ts`.
- Produces: `renderJson(r: Report): string`, `renderMarkdown(r: Report): string`, `renderTerminal(r: Report): string`. All deterministic (no colors in the string output). Markdown includes overall level, score, per-pillar table, uncovered list, and a recommendations section.

- [ ] **Step 1: Write the failing test**

`tests/report/render.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderJson, renderMarkdown, renderTerminal } from '../../src/report/render.js';
import type { Report } from '../../src/core/types.js';

const report: Report = {
  overallScore: 62.5,
  level: 'L2',
  levelLabel: 'Beta',
  pillars: [
    { id: 'security', title: 'Security', score: 50, criteria: [
      { criterionId: 'sec.secrets', title: 'Secrets', score: 5, confidence: 0.8, evidence: [{ file: 'a.ts', line: 3, note: 'secret' }] },
    ] },
  ],
  uncovered: ['scal.db'],
  recommendations: ['Remove hardcoded secret in a.ts:3'],
  cappedBy: 'gate.live-secret',
};

describe('renderers', () => {
  it('renderJson round-trips the report', () => {
    expect(JSON.parse(renderJson(report)).level).toBe('L2');
  });
  it('renderMarkdown includes level, score, pillar, uncovered', () => {
    const md = renderMarkdown(report);
    expect(md).toContain('L2');
    expect(md).toContain('Beta');
    expect(md).toContain('Security');
    expect(md).toContain('scal.db');
    expect(md).toContain('gate.live-secret');
  });
  it('renderTerminal produces a non-empty summary', () => {
    expect(renderTerminal(report).length).toBeGreaterThan(0);
    expect(renderTerminal(report)).toContain('62.5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/report/render.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

`src/report/render.ts`:
```ts
import type { Report } from '../core/types.js';

export function renderJson(r: Report): string {
  return JSON.stringify(r, null, 2);
}

export function renderMarkdown(r: Report): string {
  const lines: string[] = [];
  lines.push(`# AIMature Report`);
  lines.push('');
  lines.push(`**Maturity Level:** ${r.level} — ${r.levelLabel}`);
  lines.push(`**Overall Score:** ${r.overallScore.toFixed(1)} / 100`);
  if (r.cappedBy) lines.push(`> ⚠️ Level capped by gate \`${r.cappedBy}\`.`);
  lines.push('');
  lines.push('## Pillars');
  lines.push('');
  lines.push('| Pillar | Score |');
  lines.push('|---|---|');
  for (const p of r.pillars) lines.push(`| ${p.title} | ${p.score.toFixed(1)} |`);
  lines.push('');
  for (const p of r.pillars) {
    lines.push(`### ${p.title}`);
    for (const c of p.criteria) {
      lines.push(`- **${c.title}** (${c.criterionId}): ${c.score.toFixed(1)} _(confidence ${c.confidence.toFixed(2)})_`);
      for (const e of c.evidence) {
        lines.push(`  - ${e.file}${e.line ? ':' + e.line : ''} — ${e.note}`);
      }
    }
    lines.push('');
  }
  if (r.uncovered.length) {
    lines.push('## Uncovered (not measured)');
    for (const u of r.uncovered) lines.push(`- ${u}`);
    lines.push('');
  }
  if (r.recommendations.length) {
    lines.push('## Recommendations');
    for (const rec of r.recommendations) lines.push(`- ${rec}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderTerminal(r: Report): string {
  const lines: string[] = [];
  lines.push(`AIMature: ${r.level} (${r.levelLabel})  score ${r.overallScore.toFixed(1)}/100`);
  if (r.cappedBy) lines.push(`  [capped by ${r.cappedBy}]`);
  for (const p of r.pillars) lines.push(`  ${p.title.padEnd(28)} ${p.score.toFixed(1)}`);
  if (r.uncovered.length) lines.push(`  uncovered: ${r.uncovered.join(', ')}`);
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/report/render.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/report/render.ts tests/report/render.test.ts
git commit -m "feat: JSON/Markdown/terminal report renderers"
```

---

### Task 12: Orchestrator pipeline + recommendations

**Files:**
- Create: `src/core/analyze.ts`
- Test: `tests/core/analyze.test.ts`

**Interfaces:**
- Consumes: everything above — `buildContext`, all collectors, `npmAuditAdapter`, `llmReview`, `score`, `loadFramework`, `Report`.
- Produces:
  - `interface AnalyzeOptions { rootDir: string; frameworkPath?: string; exec?: ExecFn; llmClient?: LlmClient | null; useTools?: boolean; }`
  - `analyze(opts: AnalyzeOptions): Promise<Report>` — builds context, runs all collectors, runs applicable adapters (if `useTools !== false` and `exec` provided), runs `llmReview` (if `llmClient`), aggregates via `score`, then fills `recommendations` from the lowest-scoring covered criteria (bottom 3, each as `"Improve <title> (<id>): <first evidence note>"`).
  - Each layer is wrapped so a thrown error becomes zero findings for that layer (honest degradation), never aborts.

- [ ] **Step 1: Write the failing test**

`tests/core/analyze.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze } from '../../src/core/analyze.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'aim-e2e-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'config.ts'), 'const k = "AKIAABCDEFGHIJKLMNOP";');
  writeFileSync(join(dir, 'package.json'), '{"name":"x"}');
});

describe('analyze', () => {
  it('produces a report capped by the secret gate and lists recommendations', async () => {
    const r = await analyze({ rootDir: dir });
    expect(r.level).toBe('L1');           // secret gate caps it
    expect(r.cappedBy).toBe('gate.live-secret');
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.pillars).toHaveLength(4);
  });

  it('runs without tools or llm and still scores', async () => {
    const r = await analyze({ rootDir: dir, useTools: false, llmClient: null });
    expect(typeof r.overallScore).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/analyze.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

`src/core/analyze.ts`:
```ts
import { buildContext } from '../collectors/scan.js';
import type { Collector } from '../collectors/types.js';
import { metadataCollector } from '../collectors/metadata.js';
import { secretsCollector } from '../collectors/secrets.js';
import { vibeCollector } from '../collectors/vibe.js';
import { npmAuditAdapter } from '../adapters/npmAudit.js';
import type { Adapter, ExecFn } from '../adapters/types.js';
import { llmReview, type LlmClient } from '../llm/reviewer.js';
import { loadFramework, defaultFrameworkPath } from './framework.js';
import { score } from './scoring.js';
import type { Finding, Report } from './types.js';

const COLLECTORS: Collector[] = [metadataCollector, secretsCollector, vibeCollector];
const ADAPTERS: Adapter[] = [npmAuditAdapter];

export interface AnalyzeOptions {
  rootDir: string;
  frameworkPath?: string;
  exec?: ExecFn;
  llmClient?: LlmClient | null;
  useTools?: boolean;
}

async function safe(label: string, fn: () => Promise<Finding[]>): Promise<Finding[]> {
  try {
    return await fn();
  } catch (err) {
    process.stderr.write(`[aim] layer "${label}" failed: ${(err as Error).message}\n`);
    return [];
  }
}

export async function analyze(opts: AnalyzeOptions): Promise<Report> {
  const ctx = buildContext(opts.rootDir);
  const framework = loadFramework(opts.frameworkPath ?? defaultFrameworkPath());
  const findings: Finding[] = [];

  for (const c of COLLECTORS) {
    findings.push(...await safe(c.name, () => c.collect(ctx)));
  }

  if (opts.useTools !== false && opts.exec) {
    for (const a of ADAPTERS) {
      if (a.isApplicable(ctx)) {
        findings.push(...await safe(a.name, () => a.run(ctx, opts.exec!)));
      }
    }
  }

  if (opts.llmClient) {
    findings.push(...await safe('llm', () => llmReview(ctx, opts.llmClient!)));
  }

  const report = score(framework, findings);

  const ranked = report.pillars
    .flatMap((p) => p.criteria)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  report.recommendations = ranked.map(
    (c) => `Improve ${c.title} (${c.criterionId}): ${c.evidence[0]?.note ?? 'low score'}`,
  );

  return report;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/analyze.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/analyze.ts tests/core/analyze.test.ts
git commit -m "feat: orchestrator pipeline with graceful degradation and recommendations"
```

---

### Task 13: CLI entry point

**Files:**
- Create: `src/cli.ts`
- Test: `tests/cli.test.ts`

**Interfaces:**
- Consumes: `analyze`, the renderers, `createAnthropicClient`.
- Produces: an executable `aim scan <path>` command. Provides the real `ExecFn` via `node:child_process` `spawnSync`. Reads `ANTHROPIC_API_KEY` from env; `--llm` forces the LLM layer (errors if no key), default uses LLM only if key present. Writes report to stdout in the chosen `--format`, or to `--out <file>`. Exit code 0 always on successful analysis (scoring is advisory). The command logic lives in an exported `runScan(argv, deps)` for testability; the shebang entry calls it.

- [ ] **Step 1: Write the failing test**

`tests/cli.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runScan } from '../src/cli.js';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'aim-cli-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'app.ts'), 'export const x = 1;');
  writeFileSync(join(dir, 'README.md'), 'x'.repeat(300));
});

describe('runScan', () => {
  it('prints a JSON report for `scan <dir> --format json`', async () => {
    let out = '';
    const code = await runScan(
      ['scan', dir, '--format', 'json'],
      { write: (s) => { out += s; }, env: {} },
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.pillars).toHaveLength(4);
    expect(typeof parsed.level).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cli.test.ts`
Expected: FAIL — cannot find module `../src/cli.js`.

- [ ] **Step 3: Write the implementation**

`src/cli.ts`:
```ts
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { analyze } from './core/analyze.js';
import { renderJson, renderMarkdown, renderTerminal } from './report/render.js';
import { createAnthropicClient, type LlmClient } from './llm/reviewer.js';
import type { ExecFn } from './adapters/types.js';

export interface CliDeps {
  write: (s: string) => void;
  env: Record<string, string | undefined>;
}

const realExec: ExecFn = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { stdout: r.stdout ?? '', status: r.status };
};

export async function runScan(argv: string[], deps: CliDeps): Promise<number> {
  const program = new Command();
  let exitCode = 0;

  program
    .name('aim')
    .command('scan <path>')
    .option('--llm', 'force LLM-assisted analysis (requires ANTHROPIC_API_KEY)')
    .option('--no-tools', 'skip external tool adapters')
    .option('--format <type>', 'terminal | json | markdown', 'terminal')
    .option('--out <file>', 'write report to a file')
    .option('--config <file>', 'custom framework.yaml path')
    .action(async (path: string, opts: any) => {
      const key = deps.env.ANTHROPIC_API_KEY;
      let llmClient: LlmClient | null = null;
      if (opts.llm) {
        llmClient = createAnthropicClient('claude-opus-4-8', key);
        if (!llmClient) {
          deps.write('Error: --llm requires ANTHROPIC_API_KEY\n');
          exitCode = 2;
          return;
        }
      } else if (key) {
        llmClient = createAnthropicClient('claude-opus-4-8', key);
      }

      const report = await analyze({
        rootDir: path,
        frameworkPath: opts.config,
        exec: realExec,
        useTools: opts.tools !== false,
        llmClient,
      });

      const rendered =
        opts.format === 'json' ? renderJson(report)
        : opts.format === 'markdown' ? renderMarkdown(report)
        : renderTerminal(report);

      if (opts.out) {
        writeFileSync(opts.out, rendered);
        deps.write(`Report written to ${opts.out}\n`);
      } else {
        deps.write(rendered + '\n');
      }
    });

  await program.parseAsync(argv, { from: 'user' });
  return exitCode;
}

// Entry point when run as a binary.
if (import.meta.url === `file://${process.argv[1]}`) {
  runScan(process.argv.slice(2), { write: (s) => process.stdout.write(s), env: process.env })
    .then((code) => process.exit(code));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/cli.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS; `tsc` compiles with no errors; `dist/cli.js` exists.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts tests/cli.test.ts
git commit -m "feat: aim CLI entry point wiring all layers"
```

---

### Task 14: End-to-end fixtures + README

**Files:**
- Create: `tests/fixtures/safe/` (clean sample), `tests/fixtures/vulnerable/` (secret + no tests)
- Create: `tests/e2e.test.ts`
- Create: `README.md`

**Interfaces:**
- Consumes: `analyze`.
- Produces: regression coverage proving a clean repo scores meaningfully higher than a vulnerable one, and user-facing docs.

- [ ] **Step 1: Write the failing test and fixtures**

`tests/fixtures/safe/README.md`: any text ≥ 300 chars describing a service.
`tests/fixtures/safe/package.json`: `{"name":"safe"}`
`tests/fixtures/safe/package-lock.json`: `{}`
`tests/fixtures/safe/src/app.ts`:
```ts
export function handler(input: string): string {
  if (!input) throw new Error('input required');
  return input.trim();
}
```
`tests/fixtures/safe/src/app.test.ts`:
```ts
import { handler } from './app';
test('trims', () => { expect(handler(' x ')).toBe('x'); });
```
`tests/fixtures/safe/.github/workflows/ci.yml`: `name: ci\non: [push]`

`tests/fixtures/vulnerable/src/config.ts`:
```ts
export const apiKey = "AKIAABCDEFGHIJKLMNOP";
export const password = "supersecret123";
```

`tests/e2e.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { analyze } from '../src/core/analyze.js';

describe('e2e fixtures', () => {
  it('scores the safe repo higher than the vulnerable one', async () => {
    const safe = await analyze({ rootDir: resolve('tests/fixtures/safe'), useTools: false });
    const vuln = await analyze({ rootDir: resolve('tests/fixtures/vulnerable'), useTools: false });
    expect(safe.overallScore).toBeGreaterThan(vuln.overallScore);
    expect(vuln.cappedBy).toBe('gate.live-secret');
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes meaningfully**

Run: `npx vitest run tests/e2e.test.ts`
Expected: PASS — safe scores higher; vulnerable capped. (If it fails, the assertion reveals a scoring imbalance to fix before shipping.)

- [ ] **Step 3: Write the README**

`README.md` must document: what AIMature is, the 4 pillars and maturity levels, install (`npm install`), usage (`aim scan <path> [--llm] [--no-tools] [--format json|markdown] [--out file] [--config file]`), how the three layers degrade gracefully, and that `ANTHROPIC_API_KEY` enables the LLM layer. Include a one-paragraph "How scoring works" summary (confidence-weighted merge → pillar weighted sum → level bands → gate caps).

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures README.md tests/e2e.test.ts
git commit -m "test: end-to-end fixtures and user documentation"
```

---

## Self-Review

**1. Spec coverage:**
- Pillars/weights/criteria → Task 3 (`framework.yaml`). ✓
- Score→level mapping + gate cap → Task 4. ✓
- Vibe-coding signals → Task 8. ✓
- Layer 1 heuristics → Tasks 5–8. ✓
- Layer 2 external tools (graceful skip) → Task 9. ✓
- Layer 3 LLM (graceful skip, Claude default) → Task 10. ✓
- Common `Finding` schema + confidence-weighted merge → Tasks 2, 4. ✓
- Honest "uncovered" reporting → Tasks 4, 11, 12. ✓
- Reporters (terminal/json/markdown) → Task 11. ✓
- CLI `aim scan` with documented options → Task 13. ✓
- Error handling = absorb per-layer, never abort → Task 12 `safe()`. ✓
- Test strategy: fixtures safe/vulnerable/mixed + golden/regression → Tasks 4, 14. (Note: "mixed" fixture folded into vibe unit tests in Task 8 rather than a third folder — acceptable; the safe/vulnerable contrast covers the integration regression.)

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N" remain; every code step shows full code.

**3. Type consistency:** `Finding`, `Collector`, `CollectorContext`, `Adapter`, `ExecFn`, `LlmClient`, `Report`, `analyze`/`AnalyzeOptions`, `runScan`/`CliDeps` names match across consuming tasks. Criterion ids used by collectors/adapters/LLM all exist in `framework.yaml`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-26-aimature-analyzer.md`.
