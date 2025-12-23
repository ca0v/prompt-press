# Generalized Refactoring Plan for VS Code Extension Services

## Objective
Refactor the services in the `src/services` folder (or equivalent) to achieve consistent naming conventions and create testable components free from VS Code dependencies. Align changes with any existing implementation specification document (e.g., `*.impl.md`). Update file names, class names, and structures in both code and spec.

## Goals
1. **Consistency**: Use PascalCase for files and classes (e.g., `MyService.ts` with class `MyService`).
2. **Testability**: Extract pure business logic into "Core" modules without VS Code dependencies.
3. **Separation of Concerns**: Isolate VS Code-specific code (logging, UI, context) in "Adapter/Service" layers.
4. **Spec Alignment**: Reflect all renames and structural changes in the implementation spec.
5. **Minimal Breaking Changes**: Preserve functionality and identifiers.

## Refactoring Plan

### Step 1: Audit Services
- List all files in `src/services`.
- For each file:
  - Identify VS Code imports (`vscode.*`).
  - Mark methods using VS Code APIs.
  - Separate pure logic from VS Code-dependent code.

### Step 2: Naming Conventions
- Files and classes: PascalCase.
  - **When renaming files from lowerCamelCase to UpperCamelCase, use `git mv` to preserve file history and ensure proper tracking in version control.**
- Core classes: Append "Core" if needed (e.g., `ConversationManagerCore`).
- Adapter classes: Use "Service" or keep existing if already appropriate.
- Methods/properties: camelCase.

### Step 3: Extract Core Modules
- For services with VS Code dependencies:
  - Create new `*Core.ts` file with pure logic.
  - Move VS Code code to `*Service.ts` (rename file if needed).
  - Use dependency injection: pass interfaces (e.g., `Logger`, `Storage`) instead of `vscode` types.

### Step 4: Update Adapters
- Adapter files import and instantiate cores, injecting VS Code-based implementations.
- Define and use abstractions (e.g., `interface Logger { log(message: string): void }`).

### Step 5: Proposed Structure
- Pure utilities: Rename to PascalCase (e.g., `diffHelper.ts` → `DiffHelper.ts`).
- Mixed services: Split into `XxxCore.ts` and `XxxService.ts`.
- Optional: Move all `*Core.ts` to `src/services/core/` subfolder.

### Step 6: Update Imports and Activation
- Fix all imports after renames.
- In `extension.ts` (or activation file), update service instantiations to use adapters.

### Step 7: Update Implementation Spec
- Revise file list, class names, descriptions, and identifiers in the spec document.

### Step 8: Testing and Validation
- Add unit tests for core modules (Jest or Vitest).
- Run build and existing tests after each change.
- Verify extension functionality in VS Code.

### Step 9: Documentation
- Update README/docs with new names.
- Add code comments explaining core/adapter separation.

## Risks
- Import breakage from renames — use IDE refactor tools.
- Commit incrementally.
- Start with simplest, low-dependency services.

Execute incrementally, testing after each service refactor.