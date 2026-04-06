# Monorepo Package Structure (core + react + canvas)

This document defines the package boundaries for fluidUI and a safe migration path from the current single-package layout.

## Package Tree

```text
packages/
  core/
    src/
      ...engine source (prepare, computeLayout, measurement, types)
    package.json
    tsconfig.json
  adapter-react/
    src/
      index.ts
    package.json
    tsconfig.json
  adapter-canvas/
    src/
      index.ts
    package.json
    tsconfig.json
```

## Responsibility Split

### `@fluidui/core`
- Owns all layout and measurement logic.
- Must stay DOM-independent and framework-independent.
- Exports stable contracts (`Node`, `PreparedNode`, `LayoutBox`, layout options).

### `@fluidui/adapter-react`
- Converts `LayoutBox` geometry into React-friendly rendering primitives.
- No business logic and no layout algorithms.
- Should remain thin and composable.

### `@fluidui/adapter-canvas`
- Converts `LayoutBox` geometry into canvas draw commands.
- Provides hit-testing and renderer helpers.
- Keeps canvas-specific concerns separate from the core engine.

## Migration Plan

1. Scaffold package directories and contracts.
2. Mirror current engine code into `packages/core`.
3. Keep current root package operational during transition.
4. Introduce workspaces and internal package links.
5. Switch example app imports from `@engine` to `@fluidui/core`.
6. Gradually move renderer-specific helpers into adapters.
7. Convert root package to compatibility wrapper or deprecate.

## Done in this scaffold

- `packages/core` created and populated from current `src`.
- `packages/adapter-react` created with absolute-style and binding utilities.
- `packages/adapter-canvas` created with draw-command mapping and hit-testing.

## Suggested next commits

1. `chore(monorepo): enable npm workspaces and package-level builds`
2. `refactor(example): consume @fluidui/core from react dashboard`
3. `refactor(core): move remaining root-engine source of truth into packages/core`
