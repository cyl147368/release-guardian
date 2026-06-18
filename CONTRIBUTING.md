# Contributing to Release Guardian

Thank you for considering contributing to Release Guardian. This document explains how to get started.

## Development Setup

```bash
git clone https://github.com/cyl147368/release-guardian.git
cd release-guardian
npm install
npm test
```

## Project Structure

- `src/` — Application source code
- `tests/` — Test files (auto-discovered by `node:test`)
- `openapi/` — OpenAPI 3.1 contract
- `docs/` — Multilingual and operational documentation
- `scripts/` — Utility scripts
- `k8s/` — Kubernetes manifests
- `helm/` — Helm chart

## Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run lint: `npm run lint`
6. Check coverage: `npm run test:coverage`
7. Commit with a descriptive message
8. Push and create a pull request

## Code Style

- ES modules (`import`/`export`)
- No third-party runtime dependencies
- Pure functions where possible
- Descriptive variable names
- Tests for all new features

## Testing

All tests use Node.js built-in `node:test` and `node:assert/strict`.

```bash
npm test               # Run all tests
npm run test:coverage  # Run with coverage report
npm run test:bootstrap # Test bootstrap configuration
```

### Writing Tests

- Place tests in `tests/` directory
- Name test files `*.test.js`
- Use `describe` and `it` for test organization
- Use `beforeEach` for test isolation
- Assert with `assert/strict`

## API Contract

When adding or modifying API endpoints:

1. Update `openapi/openapi.yaml` with the new paths and schemas
2. Add contract tests in `tests/openapi.test.js`
3. Update the README and multilingual translations

## Commit Messages

Follow the conventional commit style:

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation change
- `test:` — Test addition or modification
- `refactor:` — Code refactoring
- `chore:` — Maintenance tasks

Examples:
- `feat: add pagination cursor support`
- `fix: correct risk score calculation for emergency changes`
- `docs: update Japanese README with webhook API`

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include tests for new functionality
- Update documentation as needed
- Ensure all tests pass
- Ensure lint passes

## Security

Please report security vulnerabilities responsibly. See `docs/SECURITY.md` for details.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
