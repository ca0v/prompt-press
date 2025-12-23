---
agent: agent
---

# Refactoring Plan for PromptPress Services

## Objective
Refactor the services in the `#file:services` folder to achieve consistent naming conventions and create testable components that are free from VS Code dependencies. The refactoring must align with the implementation specification in `promptpress.impl.md`, ensuring that any changes to file names, class names, or structures are reflected in the spec and the actual source code.

## Current State Analysis
- The services folder contains 13 TypeScript files, each implementing various functionalities for the PromptPress extension.
- Many services have direct dependencies on VS Code APIs (e.g., `vscode.OutputChannel`, `vscode.ExtensionContext`, `vscode.WorkspaceConfiguration`), which makes unit testing difficult without mocking VS Code.
- Naming is inconsistent: Some files use camelCase (e.g., `cascadeCore.ts`), others PascalCase (e.g., `TersifyActionParser.ts`), and class names vary (e.g., `CascadeCore` vs. `CascadeServiceCommands`).
- Business logic is often mixed with VS Code-specific code, such as logging, UI interactions, and file system operations.

## Goals
1. **Consistency**: Standardize file and class naming to use PascalCase for both (e.g., `CascadeCore.ts` with class `CascadeCore`).
2. **Testability**: Extract pure business logic into "core" classes or modules without VS Code dependencies. Wrap these with "adapter" or "service" layers that handle VS Code interactions.
3. **Separation of Concerns**: Ensure core logic can be tested independently, while VS Code-specific code (e.g., output channels, webviews) is isolated.
4. **Spec Alignment**: Update the implementation spec (`promptpress.impl.md`) to reflect new file names, class names, and IMP IDs where necessary.
5. **Minimal Breaking Changes**: Preserve existing functionality and IMP IDs as much as possible, only renaming for consistency.

## Refactoring Plan
Follow this step-by-step plan to refactor the services. Perform changes incrementally, running tests and builds after each major step to validate.

### Step 1: Audit Dependencies and Identify Core Logic
- For each service file, analyze dependencies:
  - List VS Code imports (e.g., `vscode.*`).
  - Identify methods/properties that directly interact with VS Code (e.g., output channels, file watchers, webviews).
  - Determine which parts are "pure" (no VS Code deps) and can be extracted into testable core modules.
- Create a mapping:
  - `cascadeCore.ts`: Core logic for cascading operations (no VS Code deps). VS Code wrapper in `cascadeService.ts`.
  - `cascadeService.ts`: Rename to `CascadeService.ts`, keep as VS Code adapter.
  - `contextBuilder.ts`: Mostly pure; extract core into `ContextBuilderCore.ts`, keep adapter.
  - `conversationManager.ts`: Depends on `vscode.ExtensionContext`; extract core logic.
  - `diffHelper.ts`: Pure static methods; rename to `DiffHelper.ts`.
  - `fileStructureParser.ts`: Depends on `vscode.OutputChannel`; extract core.
  - `gitHelper.ts`: Pure; rename to `GitHelper.ts`.
  - `implParser.ts`: Depends on VS Code; extract core.
  - `promptService.ts` and `promptServiceCore.ts`: Merge into `PromptService.ts` with core separation.
  - `scaffoldService.ts`: Depends on VS Code; extract core.
  - `specFileProcessor.ts`: Pure; rename to `SpecFileProcessor.ts`.
  - `TersifyActionParser.ts`: Pure; rename to `TersifyActionParser.ts`.

### Step 2: Establish Naming Conventions
- **Files**: Use PascalCase matching the primary class name (e.g., `CascadeCore.ts` for class `CascadeCore`).
- **Classes**: Use PascalCase, consistent with existing (e.g., `CascadeCore`, `MarkdownParser`).
- **Interfaces**: Use PascalCase (e.g., `CascadeResult`).
- **Methods/Properties**: Use camelCase.
- **New Suffixes**: For core modules, append "Core" if needed (e.g., `ContextBuilderCore.ts`). For adapters, use "Service" or "Adapter" (e.g., `CascadeService.ts`).

### Step 3: Extract Core Modules
- For each service with VS Code deps:
  - Create a new "Core" file (e.g., `CascadeCore.ts` if not already) containing only pure logic.
  - Move VS Code-dependent code to an "Adapter" or "Service" file (e.g., `CascadeService.ts`).
  - Update constructors to inject dependencies (e.g., pass logger interfaces instead of `vscode.OutputChannel`).
- Example for `conversationManager.ts`:
  - New: `ConversationManagerCore.ts` (pure logic, uses interfaces for storage).
  - Rename: `ConversationManager.ts` (adapter injecting `vscode.ExtensionContext`).

### Step 4: Update Imports and Dependencies
- In adapter files, import the core modules and instantiate them with VS Code-specific deps.
- Replace direct VS Code calls with interface abstractions (e.g., define `Logger` interface instead of using `vscode.OutputChannel` directly).
- Ensure core modules use dependency injection for any external services (e.g., parsers, clients).

### Step 5: Refactor File Structure
- Proposed new structure in services:
  - `CascadeCore.ts` (existing, rename if needed).
  - `CascadeService.ts` (adapter).
  - `ContextBuilderCore.ts` (new).
  - `ContextBuilder.ts` (adapter).
  - `ConversationManagerCore.ts` (new).
  - `ConversationManager.ts` (adapter).
  - `DiffHelper.ts` (rename).
  - `FileStructureParserCore.ts` (new).
  - `FileStructureParser.ts` (adapter).
  - `GitHelper.ts` (rename).
  - `ImplParserCore.ts` (new).
  - `ImplParser.ts` (adapter).
  - `PromptService.ts` (merge and refactor).
  - `ScaffoldServiceCore.ts` (new).
  - `ScaffoldService.ts` (adapter).
  - `SpecFileProcessor.ts` (rename).
  - `TersifyActionParser.ts` (rename).
- Move core files to a `src/core/` folder if desired for better organization, but keep adapters in `services/`.

### Step 6: Update Implementation Spec
- In `promptpress.impl.md`:
  - Update "Files Summary" and "Files" sections with new file names.
  - Adjust class descriptions to reflect core/adapter separation.
  - Ensure IMP IDs remain associated with the correct methods (e.g., if a method moves to core, note it).
  - Add new IMP IDs for any new classes/interfaces created.

### Step 7: Update Extension Activation
- In extension.ts, update imports and instantiations to use the new adapter classes.
- Ensure commands and providers reference the correct services.

### Step 8: Testing and Validation
- Write unit tests for core modules using a testing framework (e.g., Jest), mocking any injected dependencies.
- Integration tests for adapters using VS Code test utilities.
- Run `npm run compile` and existing tests after each change.
- Validate that all IMP IDs are still traceable in the code.

### Step 9: Documentation
- Update any README or docs referencing the old service names.
- Add comments in code explaining the core/adapter pattern.

## Risks and Considerations
- **Breaking Changes**: Renaming files/classes may break imports; use VS Code's refactor tools to update references.
- **Performance**: Ensure dependency injection doesn't introduce overhead.
- **Scope**: Focus only on services; other folders (e.g., `ai/`, `parsers/`) may need similar treatment later.
- **Version Control**: Commit changes in small, testable increments.

Execute this plan systematically, starting with low-dependency services like `DiffHelper.ts`. If issues arise, revert and adjust the plan.