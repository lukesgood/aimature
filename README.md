# AIMature

[![CI](https://github.com/lukesgood/aimature/actions/workflows/ci.yml/badge.svg)](https://github.com/lukesgood/aimature/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](https://nodejs.org)

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

Security gates can cap the final level (e.g., a live secret detected lowers the maturity level to at most L1 when it would otherwise rank higher (cap-only — it never raises a level)).

## Installation

```bash
npm install
```

## Usage

```bash
aim scan <path> [--llm] [--llm-provider cli|api] [--llm-model id] [--no-tools] [--format json|markdown] [--out file] [--config file]
```

**Options:**

| Flag | Description |
|------|-------------|
| `--llm` | Enable the LLM layer |
| `--llm-provider cli\|api` | LLM provider. Default `cli` when `--llm` is set |
| `--llm-model <id>` | Model id for the LLM layer (optional) |
| `--no-tools` | Skip external tool adapters (e.g., `npm audit`) |
| `--format json\|markdown` | Output format (default: terminal table) |
| `--out <file>` | Write report to a file instead of stdout |
| `--config <file>` | Path to a custom `framework.yaml` configuration |

**LLM providers** — the LLM layer (Layer 3) supports two providers:

- **`cli` (default)** — delegates to the **Claude Code CLI** (`claude -p`) in headless mode. AIMature handles no keys itself; it reuses whatever authentication Claude Code is configured with — your logged-in subscription session, or **AWS Bedrock** when `CLAUDE_CODE_USE_BEDROCK=1` and AWS credentials/region (or `AWS_BEARER_TOKEN_BEDROCK`) are set in the environment. Requires the `claude` CLI on your `PATH`.
- **`api`** — calls the Anthropic API directly via the SDK. Requires `ANTHROPIC_API_KEY`.

**Examples:**

```bash
# Quick heuristic scan (fastest, no external calls):
aim scan ./my-service --no-tools

# Full scan, LLM review via the Claude Code CLI (reuses Claude Code's auth):
aim scan ./my-service --llm

# Route the LLM layer through AWS Bedrock (via Claude Code):
CLAUDE_CODE_USE_BEDROCK=1 AWS_REGION=us-east-1 aim scan ./my-service --llm

# Use the direct Anthropic API instead of the CLI:
ANTHROPIC_API_KEY=sk-... aim scan ./my-service --llm --llm-provider api

# JSON output for CI integration:
aim scan ./my-service --format json --out report.json
```

## How the Three Layers Work (Graceful Degradation)

AIMature runs analysis in three layers. Each layer is independent and absorbs its own errors — a failure in one layer never aborts the others.

1. **Layer 1 — Heuristics** (always runs): Fast, zero-dependency static analysis. Scans files for secrets patterns, test files, CI configuration, lockfiles, README length, TODO markers, and indentation consistency. Produces findings with 0.5–0.8 confidence.

2. **Layer 2 — External Tools** (skipped if `--no-tools` or no exec context): Runs `npm audit` and similar adapters when applicable. Provides higher-precision vulnerability data. Skipped gracefully if the tool is not installed.

3. **Layer 3 — LLM Review** (requires `--llm`): Sends summarized code context to Claude for semantic scoring of criteria that heuristics cannot assess (architecture layering, error handling patterns, input validation logic). Produces findings with 0.7 confidence. By default it delegates to the **Claude Code CLI** (`--llm-provider cli`), reusing Claude Code's authentication (subscription or AWS Bedrock); use `--llm-provider api` with `ANTHROPIC_API_KEY` to call the Anthropic API directly. If the provider is unavailable the layer is skipped and its criteria are reported as uncovered.

## How Scoring Works

Each layer emits `Finding` objects (criterionId, score 0–100, confidence 0–1, evidence). When multiple findings exist for the same criterion (e.g., heuristic + LLM), they are merged by confidence-weighted average: higher-confidence sources dominate. Criterion scores are weighted within each pillar; pillar scores are weighted (Security 30%, Reliability 25%, Scalability 20%, Maintainability 25%) to produce the overall score. The score is mapped to a level band (L0–L4). Security gate rules are then applied as caps: if a gate criterion (e.g., `sec.secrets`) scores below a threshold and the natural level would be higher than the cap, the level is lowered and `cappedBy` is set in the report. Criteria with no findings from any layer are reported as "uncovered" rather than silently scored as zero.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup,
project layout, and the test-driven workflow. Please follow the
[Code of Conduct](CODE_OF_CONDUCT.md). For security reports, see
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © iyham
