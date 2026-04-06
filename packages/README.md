# fluidUI Monorepo Package Scaffold

This directory introduces a package-first layout for incremental migration.

## Target package boundaries

- `@fluidui/core`:
  engine-only package (`prepare`, `computeLayout`, measurement strategy, types)
- `@fluidui/adapter-react`:
  React mapping utilities from `LayoutBox[]` to absolute-position rendering primitives
- `@fluidui/adapter-canvas`:
  canvas mapping utilities and hit-testing primitives

## Current status

- `@fluidui/core` mirrors the existing root `src/` implementation.
- adapters are thin utility scaffolds and ready to be expanded.

## Next migration step

1. enable npm workspaces at repository root
2. point example app imports to `@fluidui/core`
3. migrate root package to compatibility wrapper over `@fluidui/core`
