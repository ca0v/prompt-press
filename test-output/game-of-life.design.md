---
artifact: game-of-life
phase: design
depends-on: [game-of-life.req]
references: []
version: 1.0.0
last-updated: 2025-12-16
---

# Game of Life - Design

## Architecture Overview
The Game of Life application will be implemented as a single-page web application (SPA) using HTML5, CSS3, and vanilla JavaScript, with optional integration of a lightweight framework like React.js for component-based state management to enhance maintainability and reusability. The architecture follows a Model-View-Controller (MVC) pattern, adapted for web contexts: the Model handles the simulation logic and data structures; the View manages rendering via HTML5 Canvas (or WebGL for GPU-accelerated rendering on large grids); and the Controller mediates user interactions, controls, and updates. The grid will be rendered in a viewport-based manner to handle large universes (up to 10,000x10,000 cells) efficiently, with only visible portions drawn to avoid memory overload. The application will run entirely client-side, with no server dependencies, ensuring portability. Key technologies include:
- **Rendering Engine**: HTML5 Canvas for 2D rendering (primary), with WebGL as an optional fallback for performance on high-resolution displays or GPU-enabled devices.
- **State Management**: In-memory data structures for the grid state, with optional React Context API or Zustand for global state if React is used.
- **Simulation Engine**: A core loop using `requestAnimationFrame` for smooth animations, supporting toroidal (wrapping) boundaries as per standard Conway's rules.
- **Scalability**: Viewport culling, level-of-detail (LOD) rendering, and sparse data structures to manage large grids without exceeding browser memory limits (e.g., targeting <1GB RAM usage for 10kx10k grids).

## Component Design
The application will be decomposed into modular components, each responsible for a specific aspect of functionality. If using React, these will be functional components with hooks for state and effects; otherwise, vanilla JS with custom event-driven modules.

- **Grid Component**: Core rendering and interaction module. Uses Canvas/WebGL to draw the grid as a collection of square cells. Implements zoom (via transform scaling, with min/max zoom levels of 0.1x to 10x), panning (mouse drag or touch gestures), and cell toggling (click/drag events). Supports toroidal wrapping for edge cells. Internally, it queries a viewport from the Model to render only visible cells, reducing draw calls for large grids.
- **SimulationController Component**: Handles playback controls (play/pause via a boolean flag, step via manual trigger, reset via state reversion). Manages simulation speed with a configurable FPS slider (range: 1-60, default 10), using `setInterval` or throttled `requestAnimationFrame`. Integrates with the Model to advance generations based on Conway's rules: live cells survive with 2-3 neighbors, die otherwise; dead cells birth with exactly 3 neighbors.
- **PatternLibrary Component**: A dropdown or modal UI for selecting predefined patterns (e.g., Glider: [[0,1,0],[0,0,1],[1,1,1]]; Blinker: [[1],[1],[1]]; Pulsar: 13x13 grid with specific live cells; Gosper Glider Gun: 36x9 grid). On selection, overlays the pattern onto the grid at user-specified coordinates, preserving existing cells unless overwritten. Patterns stored as JSON objects for easy serialization.
- **GridConfig Component**: Input fields for width/height (range: 10-10,000, default 100x100), with validation and auto-resizing. On resize, preserves existing cell states by copying to a new grid, clipping or padding as needed (e.g., if shrinking, truncate; if expanding, fill with dead cells).
- **UI Wrapper Component**: Root component that orchestrates sub-components, handles global events (e.g., keyboard shortcuts: Space for play/pause, R for reset), and renders the overall layout (e.g., sidebar for controls, main canvas area).

Each component will expose event emitters for inter-component communication, ensuring loose coupling. For vanilla JS, use a pub/sub pattern with CustomEvent; for React, use props and callbacks.

## Data Structures
To handle large grids efficiently, data structures are optimized for memory and computation speed:

- **Grid State**: A sparse 2D structure represented as a Map of Maps (row -> column -> boolean) for live/dead cells, avoiding dense arrays for grids >1,000x1,000 to reduce memory usage (e.g., 10kx10k dense array would require ~100MB for booleans, but sparse Map uses ~O(n) for n live cells, typically <10% density). For toroidal calculations, use modular arithmetic on indices (e.g., x = (x + width) % width).
- **Generation Buffer**: Two alternating Maps (current and next) to compute generations without in-place mutation, ensuring thread-safety and easy reversion. For performance, use a BitSet (via libraries like bit-set) if density is high, but default to Map for simplicity.
- **Patterns**: An array of objects: `{name: string, width: number, height: number, cells: boolean[][]}`, loaded from a static JSON file or hardcoded. Supports rotation/reflection via matrix transformations.
- **Viewport**: An object `{x: number, y: number, width: number, height: number, zoom: number}` defining the visible area, used for culling during rendering.
- **Simulation State**: An object `{isPlaying: boolean, fps: number, generation: number, history: Array<Map>}` for undo/redo functionality (limited to last 10 states to bound memory).

All data structures are immutable where possible, using shallow copies for updates to enable potential future optimizations like Web Workers for parallel computation.

## API Design
The application is client-side, so APIs are internal interfaces for modularity. Defined as JavaScript classes or modules with public methods:

- **GridModel Class**:
  - `constructor(width, height)`: Initializes sparse grid.
  - `getCell(x, y)`: Returns boolean state, handling toroidal bounds.
  - `setCell(x, y, state)`: Toggles or sets cell, with bounds checking.
  - `nextGeneration()`: Computes and returns new grid state based on rules, using neighbor counting (optimized via precomputed offsets: [[-1,-1],[-1,0],...,[1,1]]).
  - `resize(newWidth, newHeight)`: Creates new grid, copies overlapping cells.
  - `loadPattern(pattern, offsetX, offsetY)`: Applies pattern cells to grid.

- **Renderer Class**:
  - `constructor(canvas, model)`: Binds to Canvas element.
  - `render(viewport)`: Clears canvas, iterates visible cells, draws squares (live: black fill, dead: white; optional colors for states).
  - `handleZoom(delta)` and `handlePan(deltaX, deltaY)`: Updates viewport transform.

- **Controller Class**:
  - `startSimulation()`: Sets isPlaying=true, schedules nextGeneration every 1000/fps ms.
  - `pauseSimulation()`: Sets isPlaying=false.
  - `step()`: Calls nextGeneration once.
  - `reset()`: Reverts to initial grid state.

If external APIs are needed (e.g., for sharing patterns), integrate a simple REST endpoint (not defined here), but focus is internal.

## Performance Considerations
To ensure smooth operation on large grids (up to 10kx10k) without degrading on modern browsers:

- **Rendering Optimization**: Use Canvas's `drawImage` for batching or WebGL shaders for GPU acceleration. Implement viewport rendering: only draw cells within visible bounds, scaled by zoom. For zoom-out, use LOD by aggregating cell blocks (e.g., render 10x10 blocks as single pixels).
- **Simulation Speed**: Precompute neighbor counts in a single pass per generation. For FPS >30, use Web Workers to offload computation to a background thread, posting results back to the main thread for rendering. Target <100ms per generation on 10kx10k grids via profiling (e.g., use Chrome DevTools).
- **Memory Management**: Sparse grids prevent allocation of 100M+ elements. Garbage collect unused history states. Monitor heap usage with Performance API, capping at 80% of available RAM.
- **Interaction Handling**: Debounce drag events and throttle zoom/pan to avoid excessive redraws. Use `pointerevents` for cross-device support.
- **Scalability Testing**: Benchmark on devices with varying GPU/CPU (e.g., Chrome on desktop vs. mobile). If React is used, minimize re-renders with memoization. For edge cases like full-density grids, switch to dense arrays if memory allows.