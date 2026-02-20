# Sentinel — CLAUDE.md

## Project Overview

Sentinel is an open-source, AI-first autonomous QA automation platform structured as a pnpm monorepo.

## Annotated Directory Structure

```
sentinel/
├── .github/
│   ├── workflows/
│   │   └── ci.yml        # CI pipeline: lint, typecheck, test, build (fan-in to build)
│   └── ISSUE_TEMPLATE/   # GitHub issue templates
├── packages/
│   ├── shared/           # @sentinel/shared — shared types and utilities (no internal deps)
│   │   └── src/
│   │       ├── index.ts          # Public API: version constants, CheckResult, auth types/config/errors
│   │       ├── auth/
│   │       │   ├── types.ts      # AuthConfig, AuthUser, TokenPayload, AuthResult, AuthError interfaces
│   │       │   ├── config.ts     # loadAuthConfig() — reads Auth0 env vars, throws on missing
│   │       │   ├── errors.ts     # unauthorizedError, forbiddenError, authConfigError factories
│   │       │   └── index.ts      # Barrel re-export for auth/
│   │       └── __tests__/
│   │           ├── index.test.ts # Unit tests for shared exports
│   │           └── auth.test.ts  # Unit tests for auth config loading and error factories
│   ├── core/             # @sentinel/core — domain models and core business logic
│   │   └── src/
│   │       ├── index.ts          # Public API: Scenario interface, auth modules, re-exports from shared
│   │       ├── auth/
│   │       │   ├── jwt.ts        # verifyAccessToken(), createAuth0JwksGetter(), JwksGetter type
│   │       │   ├── middleware.ts  # createAuthMiddleware(), requirePermissions() — framework-agnostic
│   │       │   ├── user.ts       # tokenPayloadToUser() — maps TokenPayload to AuthUser
│   │       │   └── index.ts      # Barrel re-export for auth/
│   │       └── __tests__/
│   │           ├── index.test.ts # Unit tests for core exports
│   │           └── auth.test.ts  # Unit tests for JWT verification and auth middleware
│   ├── cli/              # @sentinel/cli — command-line interface entry point
│   │   └── src/
│   │       ├── index.ts          # Public API: CLI_NAME, re-exports from core/shared
│   │       └── __tests__/
│   │           └── index.test.ts # Unit tests for CLI exports
│   └── web/              # @sentinel/web — web application entry point
│       └── src/
│           ├── index.ts          # Public API: APP_TITLE, re-exports from core/shared
│           └── __tests__/
│               └── index.test.ts # Unit tests for web exports
├── Dockerfile            # Multi-stage build: base → deps → build → api → web
├── docker-compose.yml    # Full local stack: api, web, browser-worker, redis, postgres
├── .dockerignore         # Excludes node_modules, dist, .git, .env, .claude, coverage
├── .env.example          # All required environment variables with defaults and docs
├── DEVELOPMENT.md        # Local dev guide: quick start, architecture, commands, troubleshooting
├── .husky/
│   └── pre-commit        # Runs lint-staged and tsc --noEmit before each commit
├── vitest.config.ts      # Root Vitest config: projects, reporters, coverage thresholds, path aliases
├── tsconfig.json         # Base config: strict, ES2022, NodeNext, path aliases
├── tsconfig.build.json   # Composite build references in dependency order
├── eslint.config.mjs     # ESLint v9 flat config: @typescript-eslint strict-type-checked rules
├── .prettierrc           # Prettier config: singleQuote, semi, tabWidth 2, trailingComma all
├── .prettierignore       # Prettier exclusions: dist, node_modules, coverage, pnpm-lock.yaml
├── pnpm-workspace.yaml   # Declares packages/* as workspace members
├── package.json          # Root: scripts (build/clean/typecheck/lint/format/test), lint-staged config
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

## Test Infrastructure

- Vitest 4 is the test runner; the root `vitest.config.ts` defines all four packages as projects
- Vitest path aliases in `vitest.config.ts` resolve `@sentinel/*` imports to source files at test time (no build required)
- Each package also has its own `vitest.config.ts` for running tests in isolation via `pnpm test` within that package
- Tests live in `src/__tests__/` directories following the `*.test.ts` naming convention
- Coverage is collected with v8 provider; minimum 80% threshold enforced across statements, branches, functions, and lines
- JUnit XML output is written to `test-results/junit.xml` (root) and `packages/*/test-results/junit.xml` (per-package)
