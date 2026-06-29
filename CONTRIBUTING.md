# Contributing to AIMature

Thanks for your interest in improving AIMature! This guide covers how to set up,
develop, and submit changes.

## Development setup

Requires **Node.js ≥ 18**.

```bash
git clone https://github.com/lukesgood/aimature
cd aimature
npm install
npm run build      # compile TypeScript to dist/
npm test           # run the full test suite
```

Run the CLI locally without installing:

```bash
node dist/cli.js scan <path>
# or link it globally:
npm link && aim scan <path>
```

## Project layout

| Path | Responsibility |
|------|----------------|
| `config/framework.yaml` | The declarative rubric (pillars, criteria, weights, levels, gates) |
| `src/core/` | Types, framework loader, scoring engine, logger, orchestrator |
| `src/collectors/` | Layer 1 — static heuristic collectors |
| `src/adapters/` | Layer 2 — external-tool adapters (e.g. `npm audit`) |
| `src/llm/` | Layer 3 — LLM review (Claude Code CLI or Anthropic API) |
| `src/report/` | Terminal / JSON / Markdown renderers |
| `src/cli.ts` | The `aim` CLI entry point |
| `tests/` | Vitest tests, colocated by module, plus `tests/fixtures/` |

## Workflow

1. **Branch** from `master`.
2. **Write a test first.** Every collector, adapter, and engine change is
   test-driven — add or update a test in `tests/` before the implementation.
3. **Keep layers honest.** A layer must never abort the run; absorb failures and
   let the criterion be reported as uncovered (see `src/core/analyze.ts`).
4. **Run `npm test` and `npm run build`** — both must pass. CI runs them on
   Node 18/20/22.
5. **Open a pull request** using the template. Describe what changed and why.

## Adding a new criterion or collector

1. Add the criterion id under the right pillar in `config/framework.yaml`.
2. Emit a `Finding` for it from a collector/adapter/LLM (via `makeFinding`).
3. Add a test proving the new behavior, with fixture input.

Criterion ids are a contract across layers — keep them consistent with the rubric.

## Coding conventions

- TypeScript strict mode, ESM imports with the `.js` extension.
- Small, single-responsibility modules that communicate through the shared
  `Finding` type.
- Match the style of the surrounding code.

## Reporting bugs / requesting features

Use the issue templates under **Issues**. For security-sensitive reports, see
[SECURITY.md](SECURITY.md).

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
