---
artifact: game-of-life
phase: implementation
depends-on: [game-of-life.req, game-of-life.design]
references: []
version: 1.0.0
last-updated: 2025-12-16
---

# Game of Life - Implementation

## File Structure
The project will use a flat file structure for simplicity, with all files at the root level except for a `patterns/` directory containing JSON files for predefined patterns. Use vanilla JavaScript to implement the core logic, with optional React.js integration for component management (as per design). The application will consist of the following files:

- `index.html`: Main HTML file defining the page structure, including a `<div id="app"></div>` container for the React app (if using React) or direct DOM manipulation.
- `styles.css`: CSS file for styling the grid canvas, controls panel, and overall layout. Use flexbox for responsive design.
- `main.js`: Entry point JavaScript file that initializes the application, sets up event listeners, and orchestrates the MVC components.
- `GridModel.js`: Module for the Model layer, handling the grid data structure and simulation rules.
- `SimulationEngine.js`: Module for running the Game of Life simulation logic, including state updates and optimizations for large grids.
- `CanvasRenderer.js`: Module for the View layer, responsible for rendering the grid using HTML5 Canvas. Implement viewport-based rendering to limit drawing to visible cells (e.g., 100x100 visible area on a 10,000x10,000 grid).
- `ControlsController.js`: Module for the Controller layer, managing user interactions such as play/pause, reset, pattern loading, and grid interactions (e.g., click to toggle cells).
- `patterns/`: Directory containing JSON files for predefined patterns, each with a structure like `{ "name": "Glider", "grid": [[0,1,0],[0,0,1],[1,1,1]] }` for a 3x3 grid.
- `package.json`: (Optional, if using npm for dependencies like React) Defines dependencies and scripts for building/serving the app.

Ensure all JavaScript modules use ES6 module syntax (e.g., `export` and `import`) and are loaded via `<script type="module">` in `index.html`.

## Module Implementation
Each module must be implemented as a separate ES6 module file, with precise class or function definitions. Use strict mode (`"use strict";`) at the top of each file. Implement error handling for invalid inputs (e.g., non-integer grid sizes) by throwing descriptive Error objects.

### GridModel.js
- **Purpose**: Represents the data model for the Game of Life grid.
- **Implementation**:
  - Define a `GridModel` class with a constructor taking `width` and `height` (integers, default to 100x100 if not provided, max 10,000x10,000).
  - Properties: `this.width`, `this.height`, `this.grid` (a 2D array of booleans, initialized to false).
  - Methods:
    - `setCell(x, y, alive)`: Sets the state of cell at (x, y) to `alive` (boolean). Throw Error if x or y is out of bounds.
    - `getCell(x, y)`: Returns the state (boolean) of cell at (x, y). Return false if out of bounds.
    - `clear()`: Sets all cells to false.
    - `loadPattern(pattern)`: Accepts a pattern object (from JSON) and sets cells accordingly, centered at the grid's origin (0,0). Ignore out-of-bounds cells.
    - `getNeighbors(x, y)`: Returns an array of 8 neighbor states [top-left, top, top-right, left, right, bottom-left, bottom, bottom-right]. Use modular arithmetic for toroidal (wrap-around) boundaries.
  - Ensure the grid is sparse-friendly: Use a Map or Set for storing only live cells to optimize memory for large grids.

### SimulationEngine.js
- **Purpose**: Handles the logic for evolving the grid according to Conway's rules.
- **Implementation**:
  - Define a `SimulationEngine` class with a constructor taking a `GridModel` instance.
  - Properties: `this.model` (reference to GridModel).
  - Methods:
    - `step()`: Advances the simulation by one generation. For each cell, count live neighbors using `this.model.getNeighbors()`. Apply rules: live cell survives if 2-3 neighbors, dies otherwise; dead cell becomes live if exactly 3 neighbors. Update the grid in-place. To avoid artifacts, compute new states in a temporary grid before assigning.
    - `getGeneration()`: Returns the current generation count (incremented each step, starting at 0).
    - `resetGeneration()`: Resets the generation count to 0.
  - For performance on large grids, implement batch updates or use Web Workers (optional) for computation off the main thread. Limit updates to a viewport area if defined.

### CanvasRenderer.js
- **Purpose**: Renders the grid on an HTML5 Canvas element.
- **Implementation**:
  - Define a `CanvasRenderer` class with a constructor taking a `GridModel` instance and a canvas element (e.g., `document.getElementById('grid-canvas')`).
  - Properties: `this.model`, `this.canvas`, `this.ctx` (canvas 2D context), `this.cellSize` (default 5 pixels), `this.viewportX` and `this.viewportY` (offsets for scrolling, default 0).
  - Methods:
    - `render()`: Clears the canvas and draws only visible cells (e.g., cells where x >= this.viewportX and x < this.viewportX + canvas.width / this.cellSize). Draw live cells as filled rectangles (e.g., black color) and dead as empty.
    - `setViewport(x, y)`: Updates `this.viewportX` and `this.viewportY` to scroll the view.
    - `resize(cellSize)`: Updates `this.cellSize` and adjusts canvas size accordingly.
  - Use `requestAnimationFrame` for smooth rendering during animation. For WebGL optimization (optional), switch to a WebGL context and use shaders for drawing.

### ControlsController.js
- **Purpose**: Manages user interface controls and interactions.
- **Implementation**:
  - Define a `ControlsController` class with a constructor taking `GridModel`, `SimulationEngine`, `CanvasRenderer` instances, and DOM elements for controls (e.g., play button: `document.getElementById('play-btn')`).
  - Properties: `this.model`, `this.engine`, `this.renderer`, `this.isPlaying` (boolean, default false), `this.intervalId` (for setInterval).
  - Methods:
    - `init()`: Sets up event listeners: play/pause button toggles `this.isPlaying`, calls `this.startSimulation()` or `this.stopSimulation()`; reset button calls `this.model.clear()` and `this.engine.resetGeneration()`; pattern select dropdown loads from `patterns/` via fetch and calls `this.model.loadPattern()`; canvas click toggles cell state via `this.model.setCell()` after calculating coordinates from mouse event.
    - `startSimulation()`: Sets `this.isPlaying = true`, starts a `setInterval` calling `this.engine.step()` and `this.renderer.render()` every 100ms.
    - `stopSimulation()`: Sets `this.isPlaying = false`, clears the interval.
    - `updateControls()`: Updates UI elements (e.g., generation counter) after each step.
  - Handle canvas mouse events for grid interaction: Convert mouse coordinates to grid coordinates using `this.renderer.cellSize` and viewport offsets.

### main.js
- **Purpose**: Initializes the application and ties modules together.
- **Implementation**:
  - Import all modules: `import GridModel from './GridModel.js';` etc.
  - In the main function (or immediately invoked): Create instances of `GridModel`, `SimulationEngine`, `CanvasRenderer`, and `ControlsController`. Call `ControlsController.init()` to start.
  - If using React (optional): Wrap components in React (e.g., use `ReactDOM.render()` in `index.html`).

## Code Generation Instructions
- Use a code generator tool (e.g., a script or AI) to produce the exact code files based on this specification. For each module, generate code that strictly matches the class/method definitions, properties, and behaviors described. Include comments for clarity (e.g., `// Applies Conway's rules`).
- Ensure all code is valid ES6 JavaScript, compatible with modern browsers (e.g., Chrome 70+). Test for performance: Simulate 10,000x10,000 grid with viewport rendering; aim for 60 FPS during animation.
- For optional React integration: Generate a `App.js` component that uses hooks (e.g., `useState` for grid state) and renders the canvas and controls.
- Validate generated code by running in a browser: Load `index.html`, verify grid rendering, simulation stepping, and control interactions. Fix any syntax or logical errors immediately.