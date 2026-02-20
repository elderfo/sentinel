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
├── tsconfig.json         # Base config: strict, ES2022, NodeNext, path aliases
├── tsconfig.build.json   # Composite build references in dependency order
├── pnpm-workspace.yaml   # Declares packages/* as workspace members
├── package.json          # Root: scripts (build/clean/typecheck), typescript devDep
├── README.md             # Setup and usage documentation
└── CLAUDE.md             # This file
```

## Key Conventions

- All packages are private and scoped under `@sentinel/`
- TypeScript strict mode is enforced across all packages
- Cross-package imports use the `@sentinel/*` path aliases defined in the root `tsconfig.json`
- Build order is enforced via TypeScript project references in `tsconfig.build.json`
- Only `typescript` and `@types/node` are permitted as dependencies at this stage
