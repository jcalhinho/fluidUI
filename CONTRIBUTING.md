# Contributing Guide

Thanks for contributing to fluidUI Layout Engine.

## Ground Rules

- Keep changes focused and reversible.
- Prefer small pull requests over large refactors.
- Do not introduce new dependencies unless clearly justified.
- Preserve API compatibility unless a breaking change is explicitly discussed.

## Setup

```bash
npm install
npm run typecheck
npm run test
```

## Development Workflow

1. Create a branch from `main`.
2. Implement your change with clear scope.
3. Add or update tests when behavior changes.
4. Run quality checks locally:

```bash
npm run typecheck
npm run test
npm run build
```

5. Open a PR with:
- clear problem statement
- implementation summary
- test evidence
- risk notes

## Coding Standards

- TypeScript strict mode must stay green.
- Avoid new warnings.
- Use explicit typing where contracts matter.
- Keep layout logic deterministic.

## Test Expectations

- New behavior must include tests (unit/integration as appropriate).
- Existing tests must keep passing.
- Performance-sensitive changes should include before/after notes.

## PR Review Checklist

- [ ] Scope is minimal and clear.
- [ ] Typecheck and tests pass.
- [ ] Public API impact reviewed.
- [ ] Docs updated where needed.
- [ ] No secrets or sensitive data introduced.

## Reporting Issues

When opening an issue, include:
- environment (Node version, OS)
- reproduction steps
- expected vs actual behavior
- minimal input sample (`Node[]`, options)
