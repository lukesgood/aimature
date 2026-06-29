# Security Policy

## Supported Versions

AIMature is pre-1.0; the latest `master` is the only supported version.

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via either:

- GitHub's **"Report a vulnerability"** (Security → Advisories), or
- email **inyong.ham@gmail.com**

Include a description, reproduction steps, and the affected version/commit. We
aim to acknowledge reports within a few days and will coordinate a fix and
disclosure timeline with you.

## Scope notes

AIMature executes external tools (e.g. `npm audit`) and can shell out to the
Claude Code CLI. It does **not** transmit your source code anywhere except, when
you explicitly enable the LLM layer (`--llm`), a summarized code sample sent to
the configured Claude provider. No credentials are handled by AIMature itself —
the LLM layer reuses the Claude Code CLI's own authentication.
