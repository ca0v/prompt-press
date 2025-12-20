---
artifact: prompt-management
phase: design
depends-on: ["prompt-management.req"]
references: []
version: 1.0.0
last-updated: 2025-12-20
---

# Prompt Management - Design

## Architecture Overview
The Prompt Management system is designed as a modular, prompt-driven workflow component within PromptPress, emphasizing prompts as first-class, persistent artifacts stored in a structured `specs/` directory as versioned Markdown files. This architecture integrates seamlessly with version control systems like Git for traceability, supports iterative refinement via AI-driven interactions, and ensures formal Markdown structures to minimize ambiguity and enable deterministic outcomes in SDLC phases.

Key updates from requirements changes include:
- **Enhanced Focus on Prompts as Artifacts**: Prompts are now treated as core specifications with strict structure, including metadata headers (e.g., artifact, version, last-updated) and sections for overview, requirements, etc. This aligns with the source-of-truth principle by discarding redundant summary information and enforcing bullet-form details in subsequent sections for unambiguous context building.
- **Context Management Tools**: New tools like `Refactor Spec` (for applying overview enhancements to functional/non-functional sections), `Sync TOC` (to maintain Table of Contents), and `Sync ConOps` (to synchronize Concept of Operations with requirements) are integrated to ensure spec integrity and cross-document consistency.
- **Operational Integration**: Supports developer workflows via VS Code commands for AI refinement (e.g., clarifications or refactoring), cascading updates across phases, and historical version retrieval. Constraints like context window limits are addressed through stateless AI API interactions.
- **User Roles and Interfaces**: Developers handle spec management, administrators configure Git. Interfaces include VS Code for editing, Git for versioning, and AI APIs for stateless refinement, ensuring <10% refinement failure rates and 100% traceability.

The architecture follows a layered approach: a Core Layer for spec handling, an Integration Layer for Git and AI, and a Presentation Layer for VS Code interfaces. It uses event-driven updates for cascading changes and prioritizes Git-based persistence to support rollback and collaboration.

## Component Design
The system comprises the following components, updated to incorporate new tools and strict spec structures:

- **Spec Manager**: Core component responsible for creating, modifying, and retrieving prompt specifications. It enforces the formal Markdown schema (e.g., metadata headers, structured sections) and integrates with Git for versioning. New functionality includes automatic scaffolding for new specs (FR-1) and persistence as versioned files (FR-2). It triggers cascading updates to dependent phases upon changes.

- **Context Builder**: Handles single-source-of-truth context selection by parsing related specs, discarding redundant summaries, and enforcing bullet-form details in overview sections. It ensures only the most accurate assertions from companion documents are included.

- **Refinement Engine**: Interfaces with AI APIs for stateless prompt refinement (e.g., clarifications via VS Code commands). It monitors context window limits to prevent failures and supports iterative enhancements, integrating with the Spec Manager for updates.

- **Sync Tools Suite**: A new suite including:
  - `Refactor Spec`: Applies overview enhancements to functional and non-functional sections, ensuring structural consistency.
  - `Sync TOC`: Dynamically updates the Table of Contents based on spec changes.
  - `Sync ConOps`: Maintains synchronization between Concept of Operations and requirements documents, triggering events for cascading updates.

- **Version Control Integrator**: Manages Git interactions for committing changes, retrieving historical versions, and rollback. It assumes user Git knowledge and provides admin interfaces for setup.

- **VS Code Extension Interface**: Provides commands for spec editing, AI refinement requests, and sync tool execution. It handles user roles (developers for editing, admins for Git config) and ensures UI-driven workflows.

Components communicate via an event bus for real-time updates (e.g., spec changes triggering Sync ConOps), with all data persisted in the `specs/` directory.

## Data Structures
Key data structures have been updated to support the new strict schema and tools:

- **PromptSpec (Object)**:
  - Fields: `artifact` (string), `phase` (string, e.g., "requirement"), `depends-on` (array of strings), `references` (array of strings), `version` (string, e.g., "1.0.0"), `last-updated` (ISO date string), `content` (object with sections: `overview` (array of bullet strings), `requirements` (array of FR objects), etc.).
  - Purpose: Represents a full spec in Markdown format, enforcing structure for context building and tool integration (e.g., `Refactor Spec` modifies `content` sections based on `overview`).

- **ContextSnapshot (Object)**:
  - Fields: `sourceSpecId` (string), `relatedSpecs` (array of PromptSpec IDs), `filteredAssertions` (array of bullet strings), `discardedSummaries` (set of strings).
  - Purpose: Captures the single-source-of-truth context, ensuring only unique, unambiguous details are retained from companion docs.

- **RefinementRequest (Object)**:
  - Fields: `specId` (string), `requestType` (enum: "clarify", "refactor"), `aiPrompt` (string, constrained to context window), `response` (string), `successRate` (float, tracked for <10% failure metric).
  - Purpose: Manages AI-driven refinement, integrating with the Refinement Engine to update specs.

- **SyncEvent (Object)**:
  - Fields: `tool` (enum: "Refactor Spec", "Sync TOC", "Sync ConOps"), `affectedSpec` (PromptSpec), `changesApplied` (array of diffs).
  - Purpose: Tracks sync tool executions for auditing and cascading updates.

These structures use JSON for serialization in memory and Markdown for file storage, with validation against schemas to enforce structure.

## API Design
APIs have been updated to expose new tools and refinement capabilities:

- **SpecManagerAPI**:
  - `createSpec(metadata: object, template: string) -> PromptSpec`: Creates a new spec with scaffolding (metadata headers, predefined sections) in `specs/` directory.
  - `updateSpec(id: string, changes: object) -> void`: Modifies spec content, triggers Git commit and sync events.
  - `getSpec(id: string, version?: string) -> PromptSpec`: Retrieves current or historical versions via Git.

- **ContextBuilderAPI**:
  - `buildContext(specId: string) -> ContextSnapshot`: Selects and filters context from related specs, discarding summaries.

- **RefinementEngineAPI**:
  - `refinePrompt(specId: string, request: RefinementRequest) -> string`: Sends stateless AI request, applies response to spec, logs success rate.

- **SyncToolsAPI**:
  - `refactorSpec(specId: string, enhancements: array) -> void`: Updates functional/non-functional sections from overview.
  - `syncTOC(specId: string) -> void`: Regenerates Table of Contents.
  - `syncConOps(reqSpecId: string, conopsId: string) -> void`: Synchronizes documents and cascades updates.

All APIs are RESTful over HTTPS, with authentication for role-based access (developers vs. admins), and include error handling for constraints like context windows.

## Performance Considerations
To address updates like AI refinement and sync tools, optimizations focus on efficiency:
- **Caching**: Cache ContextSnapshots and PromptSpecs in memory to reduce file I/O for frequent access, minimizing latency in VS Code interactions.
- **Asynchronous Processing**: Run refinement and sync operations async via the event bus to avoid blocking UI, ensuring <10% failure rates through retry logic and AI API throttling.
- **Git Optimization**: Use shallow clones and delta commits for versioning to handle large spec histories without excessive storage.
- **Context Window Management**: Pre-filter and truncate inputs to AI APIs, logging metrics to maintain deterministic outcomes under limits.
- **Scalability**: Event-driven architecture supports horizontal scaling for concurrent spec updates, with database-backed metadata for traceability queries. Monitor for bottlenecks in cascading updates via profiling tools.