# PromptPress

Prompt-Driven Development Tool - A VS Code Extension

## Vision

Track AI prompts as persistent, versioned specs. Turn vague English into rigid, reusable Markdown. Future AI reruns for upgrades or language swaps.

PromptPress shifts technical debt from source code to parsable markdown documents. When requirements change or technology evolves, regenerate code from refined specs rather than refactoring legacy code.

## Core Principles

- Prompts are source of truth
- One .md file per artifact
- The prompt itself is iterated on until it precisely articulates the desired outcome
- Follows a standard SDLC, with requirements, design and implementation level documentation. The "requirements" are written by the developer, the "design" is a collaborative space, and the "implementation" is markdown written by the AI.
- Code is generated from the "implementation" markdown, which is similar to "assembly", where the source code is analogous to "binary".
- VS Code extension monitors markdown changes and facilitates AI collaboration through conversational interface
- Technical debt accumulates in markdown specs, not source code - when specs improve, code is regenerated

## Functional Requirements

### FR-1: Prompt Management
- System SHALL maintain prompts as persistent, versioned specifications
- System SHALL store each artifact specification in a single .md file
- System SHALL support iterative refinement of prompts until precise articulation is achieved
- Each artifact SHALL have exactly one prompt file that serves as its source of truth

### FR-2: SDLC Workflow Support
- System SHALL support three documentation levels: requirements, design, and implementation
- System SHALL designate requirements level as developer-authored content
- System SHALL designate design level as collaborative space (human-AI interaction)
- System SHALL designate implementation level as AI-generated markdown specifications
- System SHALL maintain clear separation and traceability between SDLC phases

### FR-3: Code Generation
- System SHALL generate code artifacts from implementation-level markdown
- System SHALL treat implementation markdown as source and generated code as derived output
- System SHALL support regeneration of code for upgrades or language changes
- System SHALL maintain the relationship between markdown specs and generated code

### FR-4: Version Control Integration
- All prompt specifications SHALL be compatible with standard version control systems
- Changes to prompts SHALL be trackable through version control history
- System SHALL support branching and merging of prompt specifications

### FR-5: File Monitoring and Change Detection
- Extension SHALL monitor file system changes in `specs/` directory
- Extension SHALL detect creation, modification, and deletion of `.req.md`, `.design.md`, and `.impl.md` files
- Extension SHALL identify which specific sections or prompts have changed within a markdown file
- Extension SHALL trigger AI interaction workflow when relevant changes are detected
- Extension SHALL provide user control to enable/disable auto-monitoring

### FR-6: AI API Integration
- Extension SHALL communicate with a stateless AI API
- Extension SHALL construct context payloads containing relevant markdown content
- Extension SHALL format requests in a structured way that AI can parse
- Extension SHALL handle API responses and present them to the user
- Extension SHALL support configurable API endpoints and authentication

### FR-7: Context Management for Stateless AI
- Extension SHALL determine appropriate context scope for each API request based on:
  - The changed file's SDLC phase (requirement/design/implementation)
  - Related files in the artifact's lineage (e.g., include `.req.md` when `.design.md` changes)
  - Cross-references explicitly mentioned in the markdown
- Extension SHALL construct context by aggregating relevant markdown files into a single payload
- Extension SHALL use a formal markdown structure that enables AI to request additional documents
- Extension SHALL maintain a request-response history within the current session for reference

### FR-8: Formal Markdown Structure for AI Interaction
- All spec markdown files SHALL follow a standardized schema with:
  - Required metadata header (artifact name, phase, dependencies, version)
  - Structured sections with clear delimiters
  - Explicit reference syntax for linking to other artifacts (e.g., `@ref:artifact-name.req`)
  - Question/clarification markers for AI to address (e.g., `[AI-CLARIFY: question]`)
- AI responses SHALL be formatted with:
  - Document reference when requesting clarification (e.g., `REQUEST-DOC: artifact-name.design`)
  - Section identifiers when providing feedback
  - Structured output markers (e.g., `[RESPONSE]`, `[QUESTION]`, `[VALIDATION]`)

### FR-9: Conversational Workflow
- Extension SHALL present a chat/conversation interface within VS Code
- Extension SHALL show the AI's response in context of the current artifact
- Extension SHALL allow user to approve, reject, or iterate on AI responses
- Extension SHALL update markdown files with AI-generated content upon user approval
- Extension SHALL maintain conversation history per artifact

### FR-10: AI-Driven Spec Refinement
- When AI identifies ambiguities, it SHALL request specific documents using formal syntax
- Extension SHALL recognize document request syntax and load requested files
- Extension SHALL present clarification questions to the user in the UI
- User responses SHALL be submitted back to AI with expanded context
- Extension SHALL facilitate iterative refinement until spec is complete

### FR-11: Code Generation Trigger
- Extension SHALL provide command to trigger code generation from implementation specs
- Extension SHALL invoke generator tools with appropriate parameters
- Extension SHALL display generation progress and results
- Extension SHALL handle generation errors and present them to user

## Non-Functional Requirements

### NFR-1: Traceability
- Each artifact SHALL be traceable from requirement → design → implementation → code
- System SHALL maintain clear naming conventions to enable traceability
- Documentation SHALL explicitly link related artifacts across SDLC phases

### NFR-2: Versioning
- All prompt specifications SHALL be version-controllable via Git or similar systems
- System SHALL support concurrent development of multiple artifact versions
- Historical versions SHALL remain accessible and reproducible

### NFR-3: Reproducibility
- AI SHALL be able to regenerate artifacts from prompts deterministically
- Implementation markdown SHALL contain sufficient detail for consistent code generation
- System SHALL minimize ambiguity in prompt specifications

### NFR-4: Maintainability
- Folder structure SHALL be intuitive and self-documenting
- Naming conventions SHALL be consistent and predictable
- System SHALL scale to support projects with dozens or hundreds of artifacts

## Technical Requirements

### TR-1: VS Code Extension Architecture
- Extension SHALL be developed using VS Code Extension API
- Extension SHALL use File System Watcher API for monitoring markdown files
- Extension SHALL implement a webview panel for chat interface
- Extension SHALL store configuration in workspace settings
- Extension SHALL register commands for manual triggering of AI interactions

### TR-2: Markdown Parsing and Validation
- Extension SHALL parse markdown files to extract structure and metadata
- Extension SHALL identify cross-references and dependencies using `@ref:` syntax
- Extension SHALL validate markdown against defined schemas
- Extension SHALL detect `[AI-CLARIFY:]` markers and other structured annotations

### TR-3: Context Window Management
- Extension SHALL calculate token/character count of context payload before API submission
- Extension SHALL respect AI API token limits
- Extension SHALL prioritize context inclusion based on relevance (changed file > dependencies > references)
- Extension SHALL summarize or truncate less-critical context when needed
- Extension SHALL warn user when context exceeds recommended limits

### TR-4: State and History Management
- Extension SHALL maintain session state (current artifact, conversation history, pending changes)
- Extension SHALL persist conversation history to `.promptpress/history/` directory
- Extension SHALL support resuming conversations across VS Code restarts
- Extension SHALL store conversation logs in structured format for future analysis

## Folder Structure

```
prompt-press/
├── README.md                          # This file - project overview and requirements
├── .promptpress/                      # Extension state and history (gitignored)
│   ├── history/                       # Conversation logs per artifact
│   ├── cache/                         # Cached API responses
│   └── config.json                    # Local extension configuration
│
├── docs/                              # Project-level documentation
│   ├── architecture.md                # System architecture decisions
│   ├── workflow.md                    # Development workflow guide
│   ├── conventions.md                 # Naming and structure conventions
│   └── markdown-schema.md             # Formal markdown specification
│
├── specs/                             # Artifact specifications (SDLC layers)
│   ├── requirements/                  # Developer-authored requirements
│   │   └── <artifact-name>.req.md     # Format: what needs to be built
│   ├── design/                        # Collaborative design space
│   │   └── <artifact-name>.design.md  # Format: how it will be built
│   └── implementation/                # AI-generated implementation specs
│       └── <artifact-name>.impl.md    # Format: precise build instructions
│
├── artifacts/                         # Generated code (derived from specs)
│   └── <artifact-name>/               # One folder per artifact
│       ├── src/                       # Source code
│       └── tests/                     # Test code
│
├── templates/                         # Reusable prompt templates
│   ├── requirement.template.md        # Template for requirements phase
│   ├── design.template.md             # Template for design phase
│   └── implementation.template.md     # Template for implementation phase
│
└── tools/                             # PromptPress tooling
    ├── generators/                    # Code generation scripts
    ├── validators/                    # Spec validation tools
    └── utilities/                     # Helper utilities
```

### Directory Purpose and Rationale

#### specs/
The heart of PromptPress. Contains all prompt-based specifications organized by SDLC phase.

- **requirements/** - Developer writes "what" in plain language. This is the initial request, the problem statement, or the feature description. Think of this as the user story or product requirement.

- **design/** - Collaborative space where developer and AI discuss "how". This includes architectural decisions, API contracts, data structures, algorithms, and trade-offs. May go through multiple iterations as clarity emerges.

- **implementation/** - AI-generated detailed specifications. This is analogous to assembly language - very precise, unambiguous instructions that can be mechanically translated to code. Contains exact function signatures, logic flows, edge cases, and test scenarios.

#### artifacts/
Generated code output, clearly separated from the source-of-truth specs. Each artifact gets its own directory with standard `src/` and `tests/` subdirectories. This code is disposable and regenerable - the specs are what matter.

#### templates/
Standardized formats for each SDLC phase to ensure consistency across artifacts. Templates guide prompt structure, required sections, and expected level of detail.

#### tools/
Automation and utilities to support the PromptPress workflow:
- **generators/** - Scripts that read implementation markdown and generate code
- **validators/** - Tools to check spec completeness and consistency
- **utilities/** - Helper scripts for common tasks (renaming, refactoring, etc.)

#### docs/
Meta-documentation about PromptPress itself - how to use it, architectural decisions, and conventions. This is about the system, not the artifacts being built.

**markdown-schema.md** defines the formal structure that all spec files must follow for AI parsing.

#### .promptpress/
Extension runtime data (should be in `.gitignore`). Contains conversation history, cached responses, and local configuration. This allows the extension to maintain context across sessions and provide faster responses.

## Naming Conventions

### Specification Files
- Requirements: `<artifact-name>.req.md`
- Design: `<artifact-name>.design.md`
- Implementation: `<artifact-name>.impl.md`

### Artifact Names
- Use kebab-case: `user-authentication`, `data-parser`, `api-client`
- Be descriptive but concise
- Avoid version numbers in names (use git for versioning)

### Examples
```
specs/requirements/user-authentication.req.md
specs/design/user-authentication.design.md
specs/implementation/user-authentication.impl.md
artifacts/user-authentication/src/auth.ts
```

## Context Scope Strategy

When the extension submits content to the stateless AI API, it determines context based on:

**Phase-Based Context:**
1. **Requirements phase** - Send only the `.req.md` file (minimal context needed)
2. **Design phase** - Send `.req.md` + `.design.md` (AI needs to understand requirements)
3. **Implementation phase** - Send `.req.md` + `.design.md` + `.impl.md` (full lineage)

**Reference-Based Context:**
4. **On explicit `@ref:`** - Include any documents mentioned via `@ref:artifact-name.phase` syntax
5. **On AI `REQUEST-DOC:`** - Fetch and append specifically requested documents in follow-up

**Token Management:**
- Extension calculates total context size before submission
- Prioritizes changed file > direct dependencies > references
- Truncates or summarizes older conversation history if context exceeds API limits

## Formal Markdown Schema

All spec markdown files follow this structure for AI parsing:

```markdown
---
artifact: user-authentication
phase: design | requirement | implementation
depends-on: [session-manager, crypto-utils]
references: [@ref:session-manager.design, @ref:crypto-utils.impl]
version: 1.0.0
last-updated: 2025-12-15
---

# [Artifact Name] - [Phase]

## Overview
[High-level summary]

## [Phase-Specific Sections]
[Content varies by phase]

## Questions & Clarifications
[AI-CLARIFY: Specific question for AI to address?]
[AI-CLARIFY: Another question?]

## Cross-References
- @ref:related-artifact.req - Brief description of relationship
- @ref:another-artifact.design - Why this is relevant

## AI Interaction Log
<!-- Auto-maintained by extension -->
- [2025-12-15 14:30] User: Initial design request
- [2025-12-15 14:31] AI: Suggested OAuth2 with PKCE flow
- [2025-12-15 14:32] User: Approved, requested JWT format details
```

**AI Response Format:**
```markdown
[RESPONSE]
[Content addressing the user's request or question]

[QUESTION: section-name]
Clarifying question about specific section?

[REQUEST-DOC: artifact-name.design]
Need to review design document to provide complete answer.

[VALIDATION: passed | failed]
Validation result if checking spec completeness.
```

## Workflow

### Development Flow
1. **Developer** creates `<artifact>.req.md` describing what needs to be built
2. **Extension** detects new file, notifies user, optionally triggers AI review
3. **Developer + AI** collaborate on `<artifact>.design.md` via chat interface
   - AI may request clarifications using `[QUESTION:]` markers
   - AI may request related documents using `REQUEST-DOC:` syntax
   - Extension automatically loads and submits requested context
4. **AI** generates `<artifact>.impl.md` with precise, unambiguous specifications
5. **Developer** reviews and approves implementation spec
6. **Extension or tooling** generates code in `artifacts/<artifact>/` from implementation spec
7. **Iterate**: If code doesn't meet requirements, refine the specs (not the code directly)
8. **Regenerate**: To upgrade or change languages, rerun generation from existing specs

### Extension Interaction Flow
1. User edits markdown file in `specs/` directory
2. Extension detects change via File System Watcher
3. Extension determines context scope based on phase and references
4. Extension aggregates relevant markdown files into context payload
5. Extension submits to AI API with structured request
6. AI responds with structured output (answer, questions, or document requests)
7. Extension presents response in chat panel
8. User provides additional input if needed
9. Repeat steps 4-8 until spec is refined
10. Extension updates markdown with final AI-generated content upon approval

## Key Insights

- **Code is ephemeral, specs are permanent** - The markdown specifications are the true source. Code can always be regenerated. Technical debt accumulates in markdown (which is parsable and refactorable), not in sprawling codebases.
  
- **Iteration happens at the spec level** - When something doesn't work, improve the prompt/spec, don't patch the generated code. The extension facilitates this by making AI collaboration seamless.

- **Language agnostic** - The same implementation spec can generate TypeScript, Python, Rust, or any language. Switch languages by changing generator configuration, not by rewriting code.

- **Upgrade path** - When dependencies update or better patterns emerge, regenerate from specs with new instructions. No refactoring, just regeneration.

- **AI consistency** - Future AI models can regenerate the same artifact from the same spec, enabling long-term maintainability. As AI improves, so does your generated code.

- **Stateless AI, stateful extension** - API is stateless, but VS Code extension maintains conversation context and history, providing the best of both worlds.

- **Formal markdown enables automation** - Structured metadata and markers allow the extension to intelligently determine context, detect ambiguities, and automate spec refinement.
