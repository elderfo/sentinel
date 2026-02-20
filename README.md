# Sentinel

An open-source, AI-first autonomous QA automation platform.

## Prerequisites

- Node.js >= 20
- pnpm >= 10

## Setup

Install dependencies from the repository root:

```sh
pnpm install
```

## Scripts

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `pnpm run build`     | Compile all packages in dependency order       |
| `pnpm run clean`     | Remove all compiled output                     |
| `pnpm run typecheck` | Type-check all packages without emitting files |

## Workspace Structure

```
sentinel/
├── packages/
│   ├── shared/   # Shared types and utilities — no internal dependencies
│   ├── core/     # Core domain logic; depends on @sentinel/shared
│   ├── cli/      # Command-line interface; depends on @sentinel/core and @sentinel/shared
│   └── web/      # Web interface; depends on @sentinel/core and @sentinel/shared
├── tsconfig.json         # Base TypeScript configuration extended by each package
├── tsconfig.build.json   # Project references for ordered composite builds
└── pnpm-workspace.yaml   # Workspace package locations
```

## Package Dependency Graph

```
@sentinel/shared
       ↑
@sentinel/core
       ↑
@sentinel/cli   @sentinel/web
```
