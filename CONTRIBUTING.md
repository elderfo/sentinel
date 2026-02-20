# Contributing to Sentinel

Thank you for your interest in contributing to Sentinel, an open-source, AI-first autonomous QA automation platform! We appreciate your time and effort to help improve the project.

## Getting Started

### Prerequisites

- Node.js 20.0 or higher
- pnpm 10.0.0 or higher

### Setting Up Your Development Environment

1. **Clone the repository:**

   ```bash
   git clone https://github.com/elderfo/sentinel.git
   cd sentinel
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Verify your setup:**

   ```bash
   pnpm typecheck
   ```

## Branching Strategy

We follow a feature-branch workflow based on the `main` branch:

- **Main branch**: Always deployable, represents the latest stable release
- **Feature branches**: Created from `main` for new features, bug fixes, or documentation updates

### Branch Naming Conventions

Use conventional branch names that describe the type and scope of work:

- `feat/<feature-name>` - New features
- `fix/<bug-name>` - Bug fixes
- `docs/<doc-name>` - Documentation changes
- `chore/<task-name>` - Maintenance, dependencies, configuration
- `refactor/<component-name>` - Code refactoring without functionality changes
- `test/<test-name>` - Test-related changes
- `ci/<change-name>` - CI/CD pipeline changes

Example: `feat/async-test-execution` or `fix/race-condition-in-scheduler`

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This format provides clear semantic meaning and enables automated changelog generation.

### Commit Message Structure

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation-only changes
- **chore**: Changes to build tools, dependencies, or project setup
- **refactor**: Code changes that neither fix bugs nor add features
- **test**: Adding or updating tests
- **ci**: Changes to CI/CD configuration or scripts

### Examples

```
feat(api): add websocket support for real-time test results

Implement WebSocket server for streaming test execution updates
to clients. Includes reconnection logic and message queuing.

Closes #42
```

```
fix(scheduler): prevent duplicate test executions on retry

The scheduler was not properly tracking completed tasks,
causing duplicate executions when retrying failed tests.
```

```
docs: add troubleshooting guide

Add new troubleshooting section to help users diagnose
common configuration issues.
```

### Commit Best Practices

- Write commits in imperative mood ("add feature" not "added feature")
- Keep commit messages concise and descriptive
- Sign all commits with your GPG key using the `-S` flag
- Make atomic commits that represent a single logical change
- Reference related issues in the commit footer using `Closes #<number>` or `Relates to #<number>`

## Pull Request Process

### Creating a Pull Request

1. **Create your feature branch:**

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes:**
   - Implement your feature or fix
   - Write or update tests as needed
   - Update documentation
   - Ensure code style is consistent

3. **Run checks before pushing:**

   ```bash
   pnpm typecheck
   pnpm test
   pnpm lint
   ```

4. **Commit your changes:**

   ```bash
   git commit -S -m "feat: your feature description"
   ```

5. **Push to your fork:**

   ```bash
   git push origin feat/your-feature-name
   ```

6. **Open a Pull Request:**
   - Use the provided PR template
   - Link related issues using `Closes #<number>`
   - Provide clear description of changes
   - List testing steps
   - Mark as draft if work in progress

### PR Review Requirements

- All CI checks must pass
- Code review approval from at least one maintainer
- Tests must be added for new functionality
- Documentation must be updated to reflect changes
- Code must follow the project's style guidelines

## Code Style

### TypeScript

- **Strict Mode**: All TypeScript files must use strict mode (`"strict": true`)
- **No `any`**: Avoid using `any` type. Use explicit types or generics instead
- **Explicit Return Types**: Functions must have explicit return type annotations
- **Naming Convention**: Use camelCase for variables/functions, PascalCase for classes/interfaces

### Formatting and Linting

Sentinel uses automated tools to enforce code style:

- **ESLint**: Enforces code quality rules
- **Prettier**: Ensures consistent code formatting

These tools are run automatically via pre-commit hooks (using Husky and lint-staged) before each commit. Violations will prevent commits from being completed.

### Running Checks Manually

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Formatting (auto-fix)
pnpm format
```

## Testing

### Test Requirements

- Unit tests are **required** for all new features
- Bug fixes should include a test that demonstrates the bug before the fix
- Aim for meaningful test coverage without pursuing 100% coverage everywhere
- Keep tests focused and fast; mock external dependencies

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests for a specific file
pnpm test <filename>
```

### Test Structure

- **Unit tests**: Test individual functions and classes in isolation
- **Integration tests**: Test component interactions and workflows
- Keep unit and integration tests clearly separated
- Use descriptive test names that explain what is being tested

## Documentation

When adding new features or making significant changes:

- Update the relevant documentation files
- Add or update code examples
- Document new environment variables
- Update API documentation if applicable
- Include migration guides for breaking changes

## Code of Conduct

Please note that this project is released with a [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Reporting Issues

If you encounter bugs or have feature requests:

1. Check if the issue already exists
2. Use the appropriate issue template
3. Provide clear reproduction steps for bugs
4. Include your environment information
5. Be respectful and constructive

## Questions or Need Help?

- Check the existing documentation and issues
- Open a discussion on GitHub
- Contact the maintainers through GitHub issues

Thank you for contributing to Sentinel!
