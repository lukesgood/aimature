# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Claude Code CLI as the default LLM provider (`--llm-provider cli`), reusing
  the CLI's own authentication including AWS Bedrock; `--llm-model` flag.
- Structured levelled logging on stderr with `-v/--verbose` and `-q/--quiet`.
- GitHub Actions CI (build + test on Node 18/20/22).
- Open-source project files: LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT,
  SECURITY, issue/PR templates, and package metadata.

### Changed
- Overall score now excludes fully-unmeasured pillars (renormalized) and marks
  them `not measured` instead of scoring them 0.

### Fixed
- Secret detection no longer flags dummy keys in test fixtures, test/spec files,
  mocks, or dev artifacts (diffs/patches).
- Test detection recognizes root `test.js`, `test/`/`spec/` dirs, and
  Python/Go/Ruby conventions.
- The `aim` binary entry now fires on Windows (`pathToFileURL`).

## [0.1.0] - 2026-06-26

### Added
- Initial release: `aim scan` CLI scoring repos across four pillars
  (Security, Reliability, Scalability, Maintainability/Ops) via a declarative
  rubric and three measurement layers (heuristics, external tools, LLM review),
  with cap-only security gates and terminal/JSON/Markdown reports.
