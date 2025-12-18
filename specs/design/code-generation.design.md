```
---
artifact: code-generation
phase: design
depends-on: []
references: ["code-generation.req"]
version: 1.0.0
last-updated: 2025-12-18
---

# Code Generation - Design

## Overview
The design for PromptPress adopts a modular, event-driven architecture centered around a VS Code extension that orchestrates prompt-driven development. It separates concerns into user interaction (via commands and optional chat), AI-assisted refinement (with stateless context management), specification management (Markdown-based with formal schemas), and code generation (deterministic from implementation specs). The system emphasizes traceability through consistent file naming and metadata, reproducibility via schema validation and token limit handling, and maintainability with a scalable folder structure. Changes in requirements specs trigger cascading updates to design and implementation specs using AI, followed by code regeneration. This approach shifts technical debt to reusable Markdown artifacts, enabling easy regeneration over manual refactoring. The design supports extensibility for multiple languages and AI providers through plugin-like interfaces and abstraction layers.

## Architecture
The system is structured as a VS Code extension with layered components for modularity and scalability. Key layers include:

- **Presentation Layer**: VS Code UI integration, including command palette, file explorer context menus, status bar, and an optional chat interface for conversational AI interactions. This layer handles user inputs, displays progress/error feedback, and manages settings for auto-monitoring and chat toggles.

- **Application Layer**: Core business logic orchestrating the SDLC workflow. Includes a Spec Manager for CRUD operations on Markdown files, a Workflow Engine for cascading updates (e.g., requirement changes propagate to design and implementation), and a Code Generator for deterministic artifact creation. The AI Service Adapter abstracts AI provider interactions, supporting xAI as primary with fallbacks.

- **Domain Layer**: Defines core entities like Artifacts (Requirements, Design, Implementation specs), Metadata (version, references, timestamps), and Validation Rules (Markdown schema enforcement). Handles traceability via embedded references and naming conventions.

- **Infrastructure Layer**: File system watcher for the `specs/` directory, Git integration for versioning, caching for AI responses to respect rate limits, and secure storage for API keys via VS Code secrets.

Modules include:
- **Extension Host**: Entrypoint registering commands (e.g., "Scaffold New Artifact", "Apply Changes") and event listeners.
- **File Monitor**: Watches `specs/` directory for changes, debouncing events to trigger refinement workflows.
- **AI Interaction Handler**: Manages context windows, token prioritization (e.g., summarize irrelevant sections), and clarification requests via [AI-CLARIFY] markers.
- **Code Generation Engine**: Parses implementation Markdown to generate code in supported languages (initially JavaScript/Node.js, extensible via plugins for Rust, Go, Python).
- **Spec Parser/Validator**: Ensures formal Markdown structure, validates against schemas, and provides auto-corrections for errors.

The architecture is event-driven, with file changes or commands initiating workflows. Separation ensures generated code remains distinct from specs (e.g., in `generated/` directory). Scalability is achieved through asynchronous processing and incremental updates.

## API Contracts
Interfaces are defined using TypeScript for type safety within the VS Code extension. Key contracts include:

- **VS Code Extension APIs**:
  - `vscode.commands.registerCommand(commandId: string, handler: Function)`: Registers commands like `promptpress.scaffoldArtifact` (params: { name: string, description: string }) and `promptpress.applyChanges` (params: { artifactPath: string }).
  - `vscode.workspace.onDidChangeTextDocument(listener: Function)`: For file monitoring, passing change events with file path, type (create/modify/delete), and content diffs.
  - `vscode.window.createChatParticipant(id: string, handler: Function)`: For optional chat interface, handling messages with context (e.g., { message: string, artifactRefs: string[] }).

- **AI Service Interface**:
  - `interface AIProvider { refineSpec(content: string, context: Map<string, string>, options: { model: string, maxTokens: number }): Promise<{ refinedContent: string, clarifications: string[] }>; generateCode(spec: ImplementationSpec): Promise<{ code: string, language: string }>; }`
  - Implementations: `XAIProvider` (primary, with rate limit handling via exponential backoff), extensible `OpenAIProvider`, `AnthropicProvider` via factory pattern.

- **Spec Management Interface**:
  - `interface SpecManager { createSpec(type: 'requirement'|'design'|'implementation', name: string, content: string): Promise<string>; updateSpec(path: string, newContent: string): Promise<void>; getSpecChain(artifactName: string): Promise<SpecChain>; validateSpec(content: string, schema: Schema): ValidationResult; }`
  - `SpecChain` data structure: `{ requirement: Spec, design: Spec, implementation: Spec }` where `Spec` is `{ path: string, content: string, metadata: { version: string, references: string[], lastUpdated: Date } }`.

- **Code Generator Interface**:
  - `interface CodeGenerator { generate(spec: ImplementationSpec, language: string): Promise<{ files: Map<string, string>, errors: string[] }>; }`
  - Supports languages via extensible plugin system, e.g., `JavaScriptGenerator` implementing AST-based code emission.

Data structures:
- `ArtifactMetadata`: `{ artifactId: string, phase: 'requirement'|'design'|'implementation', name: string, references: string[], version: string, lastUpdated: string }`.
- `ChangeEvent`: `{ type: 'create'|'modify'|'delete', path: string, diff: object }`.

All APIs include error handling with custom exceptions (e.g., `AIServiceError`, `SpecValidationError`).

## Data Model
The data model is file-based, with Markdown as the primary storage format. No traditional database; instead, in-memory representations for runtime efficiency. Relationships are maintained via embedded references and folder hierarchies.

- **Markdown Schema for Specs**:
  - Frontmatter: YAML header with metadata (e.g., `artifact: code-generation, phase: design, depends-on: [], references: ["code-generation.req"], version: 1.0.0, last-updated: 2025-12-18`).
  - Sections: Standardized (e.g., ## Overview, ## API Contracts) with [AI-CLARIFY] markers for clarifications.
  - Implementation specs include code generation hints (e.g., language-specific templates).

- **Folder Structure**:
  - `specs/requirements/`: Markdown files like `requirement-code-generation.md`.
  - `specs/design/`: `design-code-generation.md`.
  - `specs/implementation/`: `implementation-code-generation.md`.
  - `generated/`: Output code directories (e.g., `generated/code-generation/js/` with files like `index.js`).

- **In-Memory Models**:
  - `Spec`: Class with properties `content: string`, `metadata: ArtifactMetadata`, methods `validate(): boolean`, `getReferences(): string[]`.
  - Relationships: Specs linked by `references` arrays; cascading updates traverse the chain (requirement -> design -> implementation -> code).

- **Versioning**: Handled via Git; the system reads commit history for historical access, ensuring no data loss.

No persistent database; caching uses VS Code's global state for AI responses (keyed by spec hash to ensure reproducibility).

## Algorithms & Logic
Key algorithms focus on workflow orchestration, AI context management, and deterministic generation.

- **Cascading Update Workflow** (Algorithm: CascadeSpecUpdates):
  1. On spec change (e.g., requirement modified), parse and validate the changed spec.
  2. Identify affected downstream specs via references (e.g., design references requirement).
  3. For each downstream spec, invoke AI refinement: Prioritize context (include changed content, summarize unchanged sections to fit token limits), prompt AI to update while preserving intent.
  4. If [AI-CLARIFY] markers are added, pause and notify user; else, apply updates.
  5. Recurse to implementation, then trigger code generation if all validations pass.
  6. Log progress and errors; rollback on failures via Git.

- **AI Context Management** (Algorithm: OptimizeContext):
  1. Calculate token usage for spec content.
  2. If over limit, truncate least relevant sections (e.g., prioritize current phase, summarize historical versions).
  3. Use summarization prompts for large chains; cache summaries for reuse.

- **Code Generation Logic** (Algorithm: GenerateCodeFromSpec):
  1. Parse implementation Markdown for code hints (e.g., function signatures, data structures).
  2. Map to language-specific AST builders (e.g., for JS, use recast library to emit code).
  3. Ensure determinism: Hash spec content to seed random elements if any; validate output against schema.
  4. Output to `generated/` with error handling (e.g., syntax checks).

- **File Monitoring Decision Flow**:
  - Debounce changes (100ms window); ignore non-spec files.
  - If auto-monitoring enabled, auto-trigger cascade; else, wait for "Apply Changes" command.

Business logic enforces SDLC phases: Requirements are user-editable only; Design/Implementation are AI-assisted, with human approval for changes.

## Dependencies
- **Third-Party Libraries**:
  - `vscode`: Core VS Code Extension API for UI and file operations.
  - `gray-matter`: For parsing Markdown frontmatter.
  - `marked` or `remark`: For Markdown parsing and validation.
  - `axios`: For HTTP requests to AI APIs (with retry logic).
  - `recast` or `babel`: For AST manipulation in code generation (JavaScript).
  - `simple-git`: For Git integration (versioning, commits).
  - `chokidar`: For efficient file watching (alternative to VS Code's basic watchers).

- **External Services**:
  - xAI API: Primary AI provider for refinement and generation (SDK assumed; handle authentication via API keys).
  - Extensible: OpenAI API, Anthropic API as fallbacks, with unified SDK abstraction.
  - Git: Assumed installed; system uses CLI commands for versioning.

Dependencies are managed via npm; versions pinned for stability. No heavy frameworks to maintain lightweight extension footprint.

## Questions & Clarifications
[AI-CLARIFY: Based on requirements clarifications, confirm prioritization of fallback AI providers (e.g., OpenAI as default secondary). For initial languages, include JavaScript/Node.js and Python in v1.0, with plugin architecture for extensibility. Specify metadata fields: include artifactId (UUID), version (semver), references (array of artifact IDs), and lastUpdated (ISO timestamp). For spec constraints, limit implementation specs to 50KB to fit AI context; use chunking for larger specs. Also, how should code generation handle dependencies in generated code (e.g., auto-include package.json for Node.js)?]

## Cross-References
[Leave empty - references are documented in the metadata header above]

## AI Interaction Log
<!-- Auto-maintained by PromptPress extension -->
```