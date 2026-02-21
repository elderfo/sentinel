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
│   │       ├── index.ts          # Public API: version constants, CheckResult, auth types/config/errors/session/mfa/rbac, vault types, browser types
│   │       ├── auth/
│   │       │   ├── types.ts      # AuthConfig, AuthUser, TokenPayload (incl. amr), AuthResult, AuthError
│   │       │   ├── config.ts     # loadAuthConfig() — reads Auth0 env vars, throws on missing
│   │       │   ├── errors.ts     # unauthorizedError, forbiddenError, authConfigError factories
│   │       │   ├── session.ts    # SessionConfig, TokenSet, TokenRefreshResult, WorkerTokenRequest, WorkerToken
│   │       │   ├── mfa.ts        # MFA_ERROR_CODES, MfaErrorCode, MfaError, MfaChallengeResult, isMfaError, createMfaError
│   │       │   ├── rbac.ts       # ROLES, PERMISSIONS, ROLE_PERMISSIONS constants; hasPermission/hasRole helpers
│   │       │   └── index.ts      # Barrel re-export for auth/
│   │       ├── vault/
│   │       │   ├── types.ts      # StoredCredential, CredentialInput, PlaintextCredential, MaskedCredential, VaultConfig
│   │       │   └── index.ts      # Barrel re-export for vault/
│   │       ├── browser/
│   │       │   ├── types.ts      # BrowserType, BrowserConfig, ArtifactConfig, DeviceProfile
│   │       │   └── index.ts      # Barrel re-export for browser/
│   │       └── __tests__/
│   │           ├── index.test.ts   # Unit tests for shared exports
│   │           ├── auth.test.ts    # Unit tests for auth config loading and error factories
│   │           ├── mfa.test.ts     # Unit tests for MFA error types and helpers
│   │           ├── rbac.test.ts    # Unit tests for RBAC constants and helper functions
│   │           ├── vault.test.ts   # Unit tests for vault type shapes and re-export accessibility
│   │           └── browser.test.ts # Unit tests for browser type shapes and re-export accessibility
│   ├── core/             # @sentinel/core — domain models and core business logic
│   │   └── src/
│   │       ├── index.ts          # Public API: Scenario interface, auth modules, vault modules, re-exports from shared
│   │       ├── auth/
│   │       │   ├── jwt.ts        # verifyAccessToken() (extracts amr claim), createAuth0JwksGetter(), JwksGetter type
│   │       │   ├── middleware.ts  # createAuthMiddleware(), requirePermissions() — framework-agnostic
│   │       │   ├── mfa.ts        # createMfaEnforcementMiddleware(), parseMfaErrorResponse()
│   │       │   ├── rbac.ts       # requireRole(), requirePermission(), createRbacMiddleware()
│   │       │   ├── user.ts       # tokenPayloadToUser() — maps TokenPayload to AuthUser
│   │       │   ├── session.ts    # SessionManager class, createAuth0TokenExchanger(), TokenExchanger type
│   │       │   └── index.ts      # Barrel re-export for auth/
│   │       ├── vault/
│   │       │   ├── vault.ts      # CredentialVault class — AES-256-GCM encrypt/decrypt, CRUD, permission enforcement
│   │       │   ├── store.ts      # CredentialStore interface and InMemoryCredentialStore implementation
│   │       │   ├── config.ts     # loadVaultConfig() — reads SENTINEL_VAULT_KEY, validates 64-char hex
│   │       │   └── index.ts      # Barrel re-export for vault/
│   │       └── __tests__/
│   │           ├── index.test.ts  # Unit tests for core exports
│   │           ├── auth.test.ts   # Unit tests for JWT verification and auth middleware
│   │           ├── session.test.ts # Unit tests for SessionManager (createTokenSet, refresh, needsRefresh, etc.)
│   │           ├── mfa.test.ts   # Unit tests for MFA enforcement middleware and response parsing
│   │           ├── rbac.test.ts  # Unit tests for RBAC middleware functions
│   │           └── vault.test.ts  # Unit tests for CredentialVault (encryption, CRUD, permission checks)
│   ├── browser/          # @sentinel/browser — browser engine abstraction and Playwright implementation
│   │   └── src/
│   │       ├── index.ts          # Public API: config, devices, types, engine, artifacts, network
│   │       ├── config.ts         # loadBrowserConfig() — reads BROWSER_* env vars with defaults/validation
│   │       ├── devices.ts        # Built-in device profiles (10 devices), getDeviceProfile(), listDeviceProfiles()
│   │       ├── types.ts          # BrowserEngine interface, branded handles, option/network/HAR types
│   │       ├── artifacts.ts      # ArtifactManager — screenshot capture, filename generation, retention enforcement
│   │       ├── playwright/
│   │       │   ├── index.ts      # Barrel for PlaywrightBrowserEngine and NetworkLog
│   │       │   ├── engine.ts     # PlaywrightBrowserEngine — full BrowserEngine implementation
│   │       │   └── network.ts    # NetworkLog — request/response tracking with HAR 1.2 export
│   │       └── __tests__/
│   │           ├── config.test.ts    # Unit tests for browser config loading
│   │           ├── devices.test.ts   # Unit tests for device profile registry
│   │           ├── types.test.ts     # Type-level tests for BrowserEngine interface
│   │           ├── engine.test.ts    # Unit tests for PlaywrightBrowserEngine (mocked)
│   │           ├── artifacts.test.ts # Unit tests for ArtifactManager
│   │           └── network.test.ts   # Unit tests for NetworkLog
│   ├── analysis/         # @sentinel/analysis — DOM analysis engine (depends on shared + browser)
│   │   └── src/
│   │       ├── index.ts          # Public API: types, parser, classifier, diff, state, a11y, forms, visual, stability, extract adapters
│   │       ├── types.ts          # All analysis domain types: DomNode, InteractiveElement, FormModel, PageState, DomDiff, etc.
│   │       ├── parser/
│   │       │   ├── dom-parser.ts # parseDom() — pure: RawDomData → DomNode tree with xpath/css selectors
│   │       │   ├── extract.ts    # extractDom() — BrowserEngine adapter: evaluate() → parseDom()
│   │       │   └── index.ts      # Barrel re-export for parser/
│   │       ├── classifier/
│   │       │   ├── element-classifier.ts  # classifyInteractiveElements() — pure: DomNode → InteractiveElement[]
│   │       │   ├── rules.ts               # categorizeByRole(), categorizeByTag() — classification rule maps
│   │       │   └── index.ts               # Barrel re-export for classifier/
│   │       ├── accessibility/
│   │       │   ├── accessibility-analyzer.ts  # parseAccessibilityTree(), findAccessibilityIssues()
│   │       │   ├── merge.ts                   # mergeAccessibility() — attaches a11y info to InteractiveElements
│   │       │   ├── extract.ts                 # extractAccessibilityTree() — BrowserEngine adapter
│   │       │   └── index.ts                   # Barrel re-export for accessibility/
│   │       ├── forms/
│   │       │   ├── form-detector.ts   # detectForms() — pure: DomNode → FormModel[]
│   │       │   ├── constraints.ts     # extractConstraints() — validation attribute extraction
│   │       │   └── index.ts           # Barrel re-export for forms/
│   │       ├── diff/
│   │       │   ├── dom-differ.ts      # diffDom() — pure: two DomNode trees → DomDiff
│   │       │   └── index.ts           # Barrel re-export for diff/
│   │       ├── state/
│   │       │   ├── state-tracker.ts   # StateTracker class — accumulates state transitions
│   │       │   ├── state-hasher.ts    # hashDomContent() — SHA-256 hash of visible DOM structure
│   │       │   ├── transition-graph.ts # exportGraphJson() — JSON serialization of state graph
│   │       │   └── index.ts           # Barrel re-export for state/
│   │       ├── visual/
│   │       │   ├── visual-detector.ts     # detectVisualElements() — pure: DOM → VisualDetectionResult
│   │       │   ├── visual-recognizer.ts   # VisualRecognizer interface + NoOpVisualRecognizer
│   │       │   ├── extract.ts             # extractVisualElements() — BrowserEngine adapter
│   │       │   └── index.ts               # Barrel re-export for visual/
│   │       ├── stability/
│   │       │   ├── dynamic-id-detector.ts  # isDynamicId() — pattern matching for framework-generated IDs
│   │       │   ├── stability-analyzer.ts   # analyzeStability() — scores selectors, recommends best locator strategy
│   │       │   └── index.ts               # Barrel re-export for stability/
│   │       └── __tests__/
│   │           ├── types.test.ts                  # Type structural tests
│   │           ├── dom-parser.test.ts             # DOM parser unit tests
│   │           ├── element-classifier.test.ts     # Element classifier unit tests
│   │           ├── accessibility-analyzer.test.ts # Accessibility analyzer unit tests
│   │           ├── form-detector.test.ts          # Form detector unit tests
│   │           ├── dom-differ.test.ts             # DOM differ unit tests
│   │           ├── state-tracker.test.ts          # State tracker unit tests
│   │           ├── visual-detector.test.ts        # Visual detector unit tests
│   │           ├── visual-recognizer.test.ts      # Visual recognizer unit tests
│   │           ├── dynamic-id-detector.test.ts    # Dynamic ID detector unit tests
│   │           ├── stability-analyzer.test.ts     # Stability analyzer unit tests
│   │           └── extract.test.ts                # Browser extract adapter unit tests
│   ├── discovery/        # @sentinel/discovery — autonomous web exploration engine (depends on shared + browser + analysis)
│   │   └── src/
│   │       ├── index.ts          # Public API: types, graph, cycle, scope, coverage, spa, journey, crawler
│   │       ├── types.ts          # All discovery domain types: AppGraph, ExplorationConfig, CoverageMetrics, etc.
│   │       ├── graph/
│   │       │   ├── graph.ts      # createGraph, addNode, addEdge, findPaths, serialize/deserialize
│   │       │   └── index.ts      # Barrel re-export for graph/
│   │       ├── cycle/
│   │       │   ├── url-normalizer.ts  # normalizeUrl() — strip tracking params, sort query, lowercase
│   │       │   ├── cycle-detector.ts  # computeFingerprint, detectCycle, createCycleReport
│   │       │   └── index.ts           # Barrel re-export for cycle/
│   │       ├── scope/
│   │       │   ├── scope-filter.ts    # isUrlAllowed, validateScopeConfig — URL boundary enforcement
│   │       │   └── index.ts           # Barrel re-export for scope/
│   │       ├── coverage/
│   │       │   ├── coverage-calculator.ts  # calculateCoverage, checkThresholds
│   │       │   └── index.ts               # Barrel re-export for coverage/
│   │       ├── spa/
│   │       │   ├── page-readiness.ts  # waitForPageReady, detectSpaNavigation — DOM stability polling
│   │       │   └── index.ts           # Barrel re-export for spa/
│   │       ├── journey/
│   │       │   ├── journey-detector.ts  # identifyJourneys, classifyJourneyType, generateJourneyName
│   │       │   └── index.ts             # Barrel re-export for journey/
│   │       ├── crawler/
│   │       │   ├── explorer.ts    # explore() — main orchestrator, serializeExplorationState, deserialize
│   │       │   └── index.ts       # Barrel re-export for crawler/
│   │       └── __tests__/
│   │           ├── graph.test.ts      # Graph module unit tests
│   │           ├── cycle.test.ts      # Cycle detection unit tests
│   │           ├── scope.test.ts      # Scope enforcement unit tests
│   │           ├── coverage.test.ts   # Coverage tracking unit tests
│   │           ├── spa.test.ts        # SPA readiness unit tests (mocked BrowserEngine)
│   │           ├── journey.test.ts    # Journey identification unit tests
│   │           └── crawler.test.ts    # Crawler orchestrator unit tests (mocked BrowserEngine + analysis)
│   ├── generator/        # @sentinel/generator — test generation engine (depends on shared + analysis + discovery)
│   │   └── src/
│   │       ├── index.ts          # Public API: all domain types re-exported from types.ts, plus config functions
│   │       ├── types.ts          # All generator domain types: TestCase, TestSuite, GeneratorConfig, AiProvider, etc.
│   │       ├── config/
│   │       │   ├── config.ts     # loadGeneratorConfig(), validateConfig() — config loading with defaults and validation
│   │       │   └── index.ts      # Barrel re-export for config/
│   │       └── __tests__/
│   │           ├── types.test.ts  # Type structural tests for all generator types
│   │           └── config.test.ts # Unit tests for loadGeneratorConfig and validateConfig
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
├── docs/
│   ├── auth0-mfa-setup.md  # Auth0 MFA configuration guide and Sentinel error-handling reference
│   └── auth0-rbac-setup.md  # Auth0 RBAC configuration guide: roles, permissions, token settings
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

- Vitest 4 is the test runner; the root `vitest.config.ts` defines all workspace packages as projects
- Vitest path aliases in `vitest.config.ts` resolve `@sentinel/*` imports to source files at test time (no build required)
- Each package also has its own `vitest.config.ts` for running tests in isolation via `pnpm test` within that package
- Tests live in `src/__tests__/` directories following the `*.test.ts` naming convention
- Coverage is collected with v8 provider; minimum 80% threshold enforced across statements, branches, functions, and lines
- JUnit XML output is written to `test-results/junit.xml` (root) and `packages/*/test-results/junit.xml` (per-package)
