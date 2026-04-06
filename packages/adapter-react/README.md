# @fluidui/adapter-react

React adapter primitives for `@fluidui/core`.

Current scaffold includes:
- `layoutBoxToAbsoluteStyle(box)` to convert `LayoutBox` into absolute style objects
- `bindNodesToLayout(nodes, boxes)` to bind nodes with computed boxes by id
- `buildContainerStyle(width, height)` for absolute layout containers

This package intentionally stays lightweight: no rendering opinion, only mapping utilities.
