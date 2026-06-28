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
