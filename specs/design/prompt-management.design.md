---
artifact: prompt-management
phase: design
depends-on: []
references: ["prompt-management.req"]
version: 1.0.0
last-updated: 2025-12-18
---

# Prompt Management - Design

## Overview
The design for Prompt Management adopts a modular, event-driven architecture centered around a VS Code extension that treats prompt specifications as first-class, file-based artifacts. Prompts are stored as versioned Markdown files in a structured `specs/` directory, adhering to a formal schema for consistency and AI interpretability. The system leverages VS Code's file system APIs for monitoring and manipulation, integrates with Git for versioning, and uses stateless API calls to xAI for refinement. Key design principles include separation of concerns (e.g., file I/O, AI logic, UI commands), event-driven updates to cascade changes across SDLC phases, and a focus on reproducibility through formal Markdown structures. The extension provides core commands for scaffolding, refinement, and retrieval, with an optional chat interface for interactive workflows. Error handling prioritizes user feedback, and performance optimizations include caching and context summarization to manage AI API constraints.

## Architecture
The architecture follows a layered approach within the VS Code extension framework, comprising four primary layers: User Interface (UI), Business Logic, Data Access, and External Integrations. Components are implemented as TypeScript modules for maintainability.

### System Components and Modules
- **PromptManager**: Core module handling prompt lifecycle operations (create, read, update, delete) via VS Code commands. It enforces Markdown schema validation and triggers cascading updates.
- **FileMonitor**: Event-driven module using VS Code's file watcher API to detect changes in the `specs/` directory, emitting events for AI refinement or version increments.
- **AIManager**: Stateless integration with xAI API for prompt refinement, managing context windows, token limits, and clarification markers (e.g., [AI-CLARIFY]).
- **VersionController**: Git integration module for versioning, including commit creation, branching, and merge conflict resolution using VS Code's Git API.
- **ChatInterface (Optional)**: Conversational module extending VS Code's chat API for interactive prompt modifications, bridging file-based and chat-based workflows.
- **SchemaValidator**: Utility module for validating Markdown files against the formal schema (e.g., mandatory sections like Overview, Functional Requirements).
- **EventBus**: Central event dispatcher for inter-module communication, enabling cascading updates (e.g., prompt change → design spec regeneration).

### Layers
- **UI Layer**: VS Code commands (e.g., "Scaffold New Prompt", "Apply Changes"), status bar indicators, and the optional chat interface. Handles user inputs and displays progress/error notifications.
- **Business Logic Layer**: Orchestrates operations like refinement logic, change detection algorithms, and SDLC cascading. Includes decision flows for when to increment versions or trigger AI calls.
- **Data Access Layer**: Abstraction for file system operations (read/write Markdown files) and Git interactions, ensuring atomicity and error recovery.
- **External Integrations Layer**: Wrappers for xAI API (RESTful calls), VS Code Extension API, and optional integrations like external version control hooks.

The architecture supports extensibility for multi-language code generation and additional AI providers via plugin interfaces.

## API Contracts
APIs are defined as TypeScript interfaces and function signatures, leveraging VS Code's Extension API for commands and events. Data structures use plain objects for serialization.

### Key Interfaces
- **IPromptSpec**: Represents a prompt Markdown file structure.
  ```typescript
  interface IPromptSpec {
    metadata: {
      artifact: string;
      phase: 'requirement' | 'design' | 'implementation';
      version: string;
      lastUpdated: string;
      dependsOn: string[];
      references: string[];
    };
    sections: {
      overview: string;
      functionalRequirements: string[];
      nonFunctionalRequirements: string[];
      questionsClarifications: string;
      crossReferences: string;
      aiInteractionLog: string;
    };
  }
  ```
- **IAIManager**: Handles AI interactions.
  ```typescript
  interface IAIManager {
    refinePrompt(spec: IPromptSpec, userInput: string): Promise<IPromptSpec>;
    requestDocument(spec: IPromptSpec, docType: string): Promise<string>;
  }
  ```
- **IVersionController**: Manages versioning.
  ```typescript
  interface IVersionController {
    commitChanges(filePath: string, message: string): Promise<void>;
    incrementVersion(currentVersion: string, changeType: 'patch' | 'minor' | 'major'): string;
    resolveConflict(filePath: string, ours: string, theirs: string): Promise<string>;
  }
  ```

### Function Signatures
- **PromptManager.createPrompt(artifactName: string, initialContent: string): Promise<string>**: Creates a new Markdown file in `specs/` with scaffolded structure, returns file path.
- **FileMonitor.onFileChange(filePath: string, event: 'create' | 'update' | 'delete'): void**: Emits events to PromptManager for processing.
- **AIManager.callXAI(prompt: string, context: object): Promise<string>**: Makes stateless API call to xAI, handling token limits by summarizing context if needed.
- **VersionController.detectSignificantChange(oldSpec: IPromptSpec, newSpec: IPromptSpec): boolean**: Compares specs to determine if version increment is required (e.g., via semantic diff on requirements).

Data structures prioritize JSON-serializable formats for persistence and AI API compatibility.

## Data Model
No traditional database; data is file-based with Markdown as the primary storage format. Relationships are maintained through file paths, metadata references, and naming conventions.

### Markdown File Schema
Each prompt file follows a strict structure for determinism:
- Header: YAML frontmatter with metadata (artifact, phase, version, etc.).
- Body: Sections like Overview, Functional Requirements (bulleted FR- items), Non-Functional Requirements, Questions & Clarifications, etc.
- Relationships: Cross-references via artifact names (e.g., "design.spec" links to "implementation.spec"); versioning via Git history.

### Data Structures
- **PromptGraph**: In-memory graph of specs for cascading updates, represented as a Map<string, IPromptSpec> where keys are artifact names and values include dependencies.
- **ChangeLog**: Array of change objects for version tracking: `{ timestamp: Date, changeType: string, details: string }`, stored in AI Interaction Log section.

### Relationships
- One-to-many: A requirement spec can depend on multiple design specs (via depends-on array).
- Hierarchical: Specs in `specs/` directory with subdirs like `specs/prompts/`, `specs/designs/` for organization.
- Traceability: Embedded links (e.g., [artifact:design]) for navigation; Git provides historical relationships.

## Algorithms & Logic
Key algorithms focus on efficiency, determinism, and AI integration.

### Change Detection Algorithm
1. On file save/commit, compute diff using VS Code's text diff API.
2. If changes affect FR/NFR sections, flag for refinement.
3. Cascade: Update dependent specs by triggering AIManager.refinePrompt() with propagated changes.

### AI Refinement Logic
1. Parse Markdown to extract sections.
2. Build context: Summarize related specs if context window exceeds 80% of xAI limit (e.g., 4096 tokens).
3. Call xAI with prompt: "Refine this spec based on [userInput], addressing [clarifications]."
4. Parse response, validate against schema, and merge updates.
5. If [AI-CLARIFY] markers found, prompt user for input via UI.

### Versioning Logic
- Increment based on semantic versioning: Patch for clarifications, minor for new FRs, major for structural changes.
- Automatic: If significant change detected (e.g., >10% content diff), increment and commit.
- Manual override via command for user control.

### Cascading Update Flow
- Event: Prompt file changed.
- Decision: If phase is 'requirement', notify dependents (design, implementation).
- Action: Queue AI refinements for each dependent, with progress UI.
- Fallback: On API failure, revert to last version and log error.

Business logic ensures prompts drive SDLC: Requirements → Design → Implementation, with AI enabling iterative refinement.

## Dependencies
- **VS Code Extension API**: Core for commands, file watching, Git integration (e.g., @types/vscode).
- **xAI API**: For AI calls (RESTful, requires API key management via VS Code secrets).
- **Markdown Parsing**: Library like 'remark' or 'marked' for schema validation and manipulation.
- **Git Integration**: VS Code's built-in Git API or 'simple-git' for advanced operations.
- **External Services**: None mandatory, but optional for CI/CD (e.g., GitHub API for pull requests).

All dependencies are open-source and compatible with VS Code's extension hosting.

## Questions & Clarifications
[AI-CLARIFY: Should the Markdown schema support custom sections beyond the standard ones? How to handle prompt file sizes exceeding AI context limits (e.g., chunking strategy)? What specific Git merge strategies should be implemented for conflicts (e.g., always favor newer, or user-prompt)? Are there predefined prompt templates for different artifact types (e.g., code vs. design), and how should they be stored/configured? How to integrate with multiple AI providers if xAI is unavailable?]

## Cross-References
[Leave empty - references are documented in the metadata header above]

## AI Interaction Log
<!-- Auto-maintained by PromptPress extension -->