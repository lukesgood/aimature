# AIMature

AIMature is a CLI tool that scores a repository's production maturity across four pillars, producing a level (L0–L4) and actionable recommendations for improvement.

## What AIMature Is

AIMature analyzes source code, configuration, and tooling signals to produce an objective maturity score. It runs up to three layers of analysis — fast heuristics, external tools, and LLM review — and degrades gracefully when a layer is unavailable. The result is a confidence-weighted score per criterion, aggregated into pillar scores and an overall level.

## Four Pillars and Maturity Levels

### Pillars

| Pillar | Weight | What It Measures |
|--------|--------|------------------|
| **Security** | 30% | Hardcoded secrets, dependency vulnerabilities, authentication and authorization, input validation |
| **Reliability** | 25% | Error handling, test coverage, logging and monitoring |
| **Scalability** | 20% | Architecture layering, statelessness, DB/query efficiency |
| **Maintainability & Operations** | 25% | Code structure, convention consistency, documentation, CI/CD config |

### Maturity Levels

| Level | Score Range | Label |
|-------|-------------|-------|
| L0 | 0–39 | Prototype |
| L1 | 40–59 | MVP |
| L2 | 60–74 | Beta |
| L3 | 75–89 | Production-Ready |
| L4 | 90–100 | Scale-Ready |

Security gates can cap the final level (e.g., a live secret detected caps maturity at L1 regardless of other scores).

## Installation

```bash
npm install
```

## Usage

```bash
aim scan <path> [--llm] [--no-tools] [--format json|markdown] [--out file] [--config file]
```

**Options:**

| Flag | Description |
|------|-------------|
| `--llm` | Enable the LLM layer (requires `ANTHROPIC_API_KEY`) |
| `--no-tools` | Skip external tool adapters (e.g., `npm audit`) |
| `--format json\|markdown` | Output format (default: terminal table) |
| `--out <file>` | Write report to a file instead of stdout |
| `--config <file>` | Path to a custom `framework.yaml` configuration |

**Examples:**

```bash
# Quick heuristic scan (fastest, no external calls):
aim scan ./my-service --no-tools

# Full scan with LLM review:
ANTHROPIC_API_KEY=sk-... aim scan ./my-service --llm

# JSON output for CI integration:
aim scan ./my-service --format json --out report.json
```

## How the Three Layers Work (Graceful Degradation)

AIMature runs analysis in three layers. Each layer is independent and absorbs its own errors — a failure in one layer never aborts the others.

1. **Layer 1 — Heuristics** (always runs): Fast, zero-dependency static analysis. Scans files for secrets patterns, test files, CI configuration, lockfiles, README length, TODO markers, and indentation consistency. Produces findings with 0.5–0.8 confidence.

2. **Layer 2 — External Tools** (skipped if `--no-tools` or no exec context): Runs `npm audit` and similar adapters when applicable. Provides higher-precision vulnerability data. Skipped gracefully if the tool is not installed.

3. **Layer 3 — LLM Review** (requires `--llm` and `ANTHROPIC_API_KEY`): Sends summarized code context to Claude for semantic scoring of criteria that heuristics cannot assess (architecture layering, error handling patterns, input validation logic). Produces findings with 0.9 confidence. Set `ANTHROPIC_API_KEY` in your environment to enable this layer.

## How Scoring Works

Each layer emits `Finding` objects (criterionId, score 0–100, confidence 0–1, evidence). When multiple findings exist for the same criterion (e.g., heuristic + LLM), they are merged by confidence-weighted average: higher-confidence sources dominate. Criterion scores are weighted within each pillar; pillar scores are weighted (Security 30%, Reliability 25%, Scalability 20%, Maintainability 25%) to produce the overall score. The score is mapped to a level band (L0–L4). Security gate rules are then applied as caps: if a gate criterion (e.g., `sec.secrets`) scores below a threshold and the natural level would be higher than the cap, the level is lowered and `cappedBy` is set in the report. Criteria with no findings from any layer are reported as "uncovered" rather than silently scored as zero.
