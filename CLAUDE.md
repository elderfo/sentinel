# Sentinel — CLAUDE.md

## Project Overview

Sentinel is an open-source, AI-first autonomous QA automation platform structured as a pnpm monorepo.

## Annotated Directory Structure

```
sentinel/
├── packages/
│   ├── shared/           # @sentinel/shared — shared types and utilities (no internal deps)
│   │   └── src/
│   │       └── index.ts  # Public API: version constants, CheckResult discriminated union
│   ├── core/             # @sentinel/core — domain models and core business logic
│   │   └── src/
│   │       └── index.ts  # Public API: Scenario interface, re-exports from shared
│   ├── cli/              # @sentinel/cli — command-line interface entry point
│   │   └── src/
│   │       └── index.ts  # Public API: CLI_NAME, re-exports from core/shared
│   └── web/              # @sentinel/web — web application entry point
│       └── src/
│           └── index.ts  # Public API: APP_TITLE, re-exports from core/shared
├── Dockerfile            # Multi-stage build: base → deps → build → api → web
├── docker-compose.yml    # Full local stack: api, web, browser-worker, redis, postgres
├── .dockerignore         # Excludes node_modules, dist, .git, .env, .claude, coverage
├── .env.example          # All required environment variables with defaults and docs
├── DEVELOPMENT.md        # Local dev guide: quick start, architecture, commands, troubleshooting
├── .husky/
│   └── pre-commit        # Runs lint-staged and tsc --noEmit before each commit
├── tsconfig.json         # Base config: strict, ES2022, NodeNext, path aliases
├── tsconfig.build.json   # Composite build references in dependency order
├── eslint.config.mjs     # ESLint v9 flat config: @typescript-eslint strict-type-checked rules
├── .prettierrc           # Prettier config: singleQuote, semi, tabWidth 2, trailingComma all
├── .prettierignore       # Prettier exclusions: dist, node_modules, coverage, pnpm-lock.yaml
├── pnpm-workspace.yaml   # Declares packages/* as workspace members
├── package.json          # Root: scripts (build/clean/typecheck/lint/format), lint-staged config
├── README.md             # Setup and usage documentation
└── CLAUDE.md             # This file
```

## Key Conventions

- All packages are private and scoped under `@sentinel/`
- TypeScript strict mode is enforced across all packages
- Cross-package imports use the `@sentinel/*` path aliases defined in the root `tsconfig.json`
- Build order is enforced via TypeScript project references in `tsconfig.build.json`

## Pre-commit Hooks

Pre-commit hooks run automatically on `git commit` via Husky and lint-staged:

- **Staged `.ts`/`.tsx` files**: ESLint (with `--fix`) then Prettier (`--write`)
- **Staged `.json`/`.md`/`.yml`/`.yaml` files**: Prettier (`--write`)
- **Always**: `tsc --noEmit` type-checking across the full workspace

Auto-fixable formatting issues are corrected in place and re-staged before the commit proceeds.
Lint errors that cannot be auto-fixed will block the commit and display the error output.

### Bypassing hooks in emergencies

To skip the pre-commit hook in an emergency (e.g., a hotfix where you intend to fix lint immediately after):

```sh
git commit --no-verify -m "your message"
```

Use `--no-verify` sparingly. Any bypass should be followed immediately by a lint/format fix commit.
