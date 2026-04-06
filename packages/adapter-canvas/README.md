# @fluidui/adapter-canvas

Canvas adapter primitives for `@fluidui/core`.

Current scaffold includes:
- `toCanvasRectCommands(boxes, style)` to convert layout boxes into canvas drawing commands
- `hitTestLayoutBox(boxes, x, y)` for pointer hit testing in canvas coordinates

The package is DOM-free by design and can be used in browser canvas, OffscreenCanvas workers, or custom renderers.
