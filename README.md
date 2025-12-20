Last Updated: 2025-12-18
Last Commit: 7398ff9

# PromptPress

Prompt-Driven Development Tool - A VS Code Extension

## Vision

Track AI prompts as persistent, versioned specs. Turn vague English into rigid, reusable Markdown. Future AI reruns for upgrades or language swaps.

PromptPress shifts technical debt from source code to parsable markdown documents. When requirements change or technology evolves, regenerate code from refined specs rather than refactoring legacy code.

## Core Principles

- Prompts are source of truth
- The prompt itself is iterated on until it precisely articulates the desired outcome
- Follows a standard SDLC with requirements, design, and implementation documentation. Both "requirements" and "design" are collaborative spaces (human + AI); "implementation" is AI-generated markdown specifications.
- Code is generated from the "implementation" markdown, which is similar to "assembly", where the source code is analogous to "binary".
- A single markdown file may describe one or many artifacts. Artifacts can be grouped logically within a file.
- VS Code extension monitors markdown changes and prioritizes the Apply Changes workflow; the chat interface is optional and not auto-prompted.
- Technical debt accumulates in markdown specs, not source code - when specs improve, code is regenerated

## Development Phases

PromptPress follows three iterative phases that operate as a continuous cycle:

- Requirements: Gather and document what the system must do (functional and non-functional needs).
- Design: Plan system architecture, components, interfaces, and data models.
- Implementation: Code and build the system based on design specifications.

## Terminology

- Artifact: A concise, clear description of a specific requirement, design, or implementation. Multiple artifacts may exist in a single markdown file.

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
- System SHALL parse file structure descriptions using tree format (directories ending in `/`, `├──` for branches, `│` for indentation, `#` for comments)
- System SHALL generate complete project structures with proper directory hierarchies
- System SHALL support multiple programming languages (JavaScript, TypeScript, HTML, JSON, etc.)

### FR-4: Version Control Integration
- All prompt specifications SHALL be compatible with standard version control systems
- Changes to prompts SHALL be trackable through version control history
- System SHALL support branching and merging of prompt specifications

### FR-5: File Monitoring and Change Detection
- Extension SHALL monitor file system changes in `specs/` directory
- Extension SHALL detect creation, modification, and deletion of `.req.md`, `.design.md`, and `.impl.md` files
- Extension SHALL identify which specific sections or prompts have changed within a markdown file
- Extension SHALL update the `last-updated` metadata field on save or during Apply Changes
- Extension SHALL validate `depends-on` and `references` entries (targets exist, phases valid)
- Extension SHALL surface non-blocking status/warnings; it SHALL NOT auto-prompt chat sessions
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
- Users SHALL provide clarification feedback by:
  - Editing the markdown file directly below `[AI-CLARIFY:]` markers with their answers
  - Using the optional chat interface to respond to AI questions interactively
  - Running Apply Changes command after updating clarifications to cascade responses
- AI responses SHALL be formatted with:
  - Document reference when requesting clarification (e.g., `REQUEST-DOC: artifact-name.design`)
  - Section identifiers when providing feedback
  - Structured output markers (e.g., `[RESPONSE]`, `[QUESTION]`, `[VALIDATION]`)

### FR-9: Conversational Workflow
- Extension SHALL provide an optional chat/conversation interface within VS Code (disabled by default)
- Extension SHALL NOT automatically prompt users to start chat sessions; Apply Changes is the primary workflow
- Extension SHALL show the AI's response in context of the current artifact when chat is used
- Extension SHALL allow user to approve, reject, or iterate on AI responses
- Extension SHALL update markdown files with AI-generated content upon user approval
- Extension SHALL maintain conversation history per artifact (when chat is used)

### FR-10: AI-Driven Spec Refinement
- When AI identifies ambiguities, it SHALL request specific documents using formal syntax
- Extension SHALL recognize document request syntax and load requested files
- Extension SHALL present clarification questions to the user in the UI (via chat interface or inline in markdown)
- User responses SHALL be submitted back to AI with expanded context either:
  - Directly via chat interface as conversational replies, OR
  - By editing the markdown file (adding answers below `[AI-CLARIFY:]` markers) and running Apply Changes
- Extension SHALL facilitate iterative refinement until spec is complete

### FR-11: Code Generation Trigger
- Extension SHALL provide command to trigger code generation from implementation specs
- Extension SHALL invoke ImplParser with appropriate AI client and file structure parser
- Extension SHALL display generation progress and results
- Extension SHALL handle generation errors and present them to user
- Extension SHALL create output directories automatically based on parsed file structures

### FR-12: Artifact Scaffolding
- Extension SHALL provide command to scaffold new PromptPress projects
- Extension SHALL provide command to scaffold individual artifacts
- Extension SHALL provide command to generate implementation specs from existing requirement/design pairs
- Extension SHALL use AI to generate initial requirement and design specifications
- Extension SHALL accept high-level description or reference to project README
- Extension SHALL create properly structured markdown files with correct metadata
- Scaffolding SHALL follow the same formal markdown schema as manual specs
- Scaffolding MAY reference existing artifacts using @artifact-name mentions; referenced artifacts are added to `references` metadata and their specs are supplied as AI context (requirements only when generating requirements; requirements+design when generating design; implementation is not shared)

### FR-13: Change Detection and Cascading
- Extension SHALL provide command to detect changes in requirement or design specs
- Extension SHALL check git status and warn if uncommitted changes exist before proceeding
- Extension SHALL allow user to commit changes before cascade operation
- Extension SHALL compare current content with cached baseline or git history
- Extension SHALL identify modified sections at markdown heading level
- Extension SHALL generate human-readable change summaries
- Extension SHALL update the source document itself if changes reveal extractable requirements, design elements, or implementation details
- Extension SHALL cascade changes from requirement → design → implementation
- Extension SHALL cascade changes from design → implementation
- Extension SHALL use AI to regenerate affected specifications with change context
- Extension SHALL update baseline cache after successful cascade operations
- Extension SHALL handle missing dependent files gracefully

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
- Extension SHALL separate platform-agnostic logic (CascadeCore) from VS Code-specific UI (CascadeServiceCommands)
- Extension SHALL support dependency injection for logging and UI interactions to enable testability

### TR-2: Markdown Parsing and Validation
- Extension SHALL parse markdown files to extract structure and metadata
- Extension SHALL identify cross-references and dependencies using `@ref:` syntax
- Extension SHALL validate markdown against defined schemas
- Extension SHALL detect `[AI-CLARIFY:]` markers and other structured annotations
- Extension SHALL parse file structure sections using tree format with proper path resolution
- Extension SHALL extract code generation instructions from implementation markdown
- Extension SHALL validate file structure descriptions for consistency and completeness

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

Note: A single markdown file may document multiple artifacts; separate files per artifact are also supported.

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
Files may contain one or many artifacts. When splitting artifacts into separate files, common names are:
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
1. **Developer** creates new project or runs `Scaffold New Project` command
2. **Developer** runs `Scaffold New Artifact` command with high-level description
3. **AI** generates initial `<artifact>.req.md` and `<artifact>.design.md` specifications
4. **Extension** detects new files, notifies user, optionally triggers AI review
5. **Developer + AI** refine requirements and design via chat interface
   - AI may request clarifications using `[QUESTION:]` markers
   - AI may request related documents using `REQUEST-DOC:` syntax
   - Extension automatically loads and submits requested context
6. **AI** generates `<artifact>.impl.md` with precise, unambiguous specifications
7. **Developer** reviews and approves implementation spec
8. **Developer** runs `Generate Code from Implementation` command to create code in `artifacts/<artifact>/` from implementation spec
9. **Iterate**: If code doesn't meet requirements, refine the specs (not the code directly)
10. **Regenerate**: To upgrade or change languages, rerun generation from existing specs

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

### Apply Changes Workflow (Cascade)

The **Apply Changes** command automates propagation of specification changes through the SDLC phases, including refinement of the source document itself.

**When to use:**
- After modifying a requirement spec (`.req.md`) that has dependent design/implementation files
- After modifying a design spec (`.design.md`) that has dependent implementation files
- After making substantial edits to any spec that could benefit from AI refinement
- When you want AI to regenerate downstream specs based on upstream changes

**How it works:**

1. **Git Status Check**
   - Checks for uncommitted changes in the workspace
   - If uncommitted changes exist:
     - Warns user: "You have uncommitted changes. Commit before cascading?"
     - Presents options: "Commit & Continue", "Continue Anyway", "Cancel"
     - "Commit & Continue" opens source control view for user to commit
   - This prevents loss of work if cascade produces unexpected results

2. **Change Detection**
   - Compares current file content with baseline (cached or git HEAD)
   - Identifies modified sections at markdown heading level (`##`)
   - Generates human-readable change summary (sections modified, lines added/removed)

3. **Self-Document Refinement**
   - AI analyzes modified content for extractable information
   - Examples:
     - Overview changes in `.req.md` may reveal new functional requirements
     - Architecture discussions in `.design.md` may clarify component responsibilities
     - Implementation notes may suggest better API contracts
   - If refinements found, AI updates the source document with:
     - Extracted requirements/design elements in appropriate sections
     - Clarified ambiguities
     - Improved structure and completeness

4. **Cascade from Requirement** (`.req.md`)
   - If `artifact-name.design.md` exists:
     - AI regenerates design with change context
     - Updates design file with new content
   - If `artifact-name.impl.md` exists:
     - AI regenerates implementation from updated design
     - Updates implementation file with new content

5. **Cascade from Design** (`.design.md`)
   - If `artifact-name.impl.md` exists:
     - AI regenerates implementation with change context
     - Updates implementation file with new content
   - Requires corresponding requirement file to exist

6. **Baseline Update**
   - After successful cascade, updates `.promptpress/cache/<filename>.baseline`
   - Subsequent runs compare against this new baseline

**Architecture:**
- `CascadeCore` - Platform-agnostic change detection and cascade logic
- `CascadeServiceCommands` - VS Code adapter with UI dialogs and output channel
- Dependency injection enables testing without VS Code APIs

**Example:**
```bash
# After editing game-of-life.req.md Overview to mention multiplayer
1. Open game-of-life.req.md in VS Code
2. Edit Overview: "...should support multiplayer mode with real-time sync..."
3. Run: PromptPress: Apply Changes (Ctrl+Shift+P)
4. Extension detects uncommitted changes
   → "You have uncommitted changes. Commit before cascading?"
   → Select "Commit & Continue", commit changes
5. AI analyzes changes: "Modified 1 section(s), added 8 line(s)"
6. AI refines game-of-life.req.md:
   → Adds "FR-7: Multiplayer Support" extracted from Overview
   → Adds "FR-8: Real-time Synchronization"
   → Updates Overview to reference new requirements
7. AI regenerates game-of-life.design.md with multiplayer architecture
8. AI regenerates game-of-life.impl.md with multiplayer implementation
9. Review all updated specs (source + cascaded)
10. Commit refined specs as a logical unit
```

**Tips:**
- Commit before cascading to enable easy rollback if needed
- Write descriptive Overview/summary sections - AI extracts structure from prose
- Make meaningful changes before cascading (avoid micro-iterations)
- Review all AI-generated updates (source + cascaded docs) for accuracy
- Commit refined specs together as a logical unit
- Commit baseline cache to share change detection state with team
- Use git history to track spec evolution and understand decision points

## Key Insights

- **Code is ephemeral, specs are permanent** - The markdown specifications are the true source. Code can always be regenerated. Technical debt accumulates in markdown (which is parsable and refactorable), not in sprawling codebases.
  
- **Iteration happens at the spec level** - When something doesn't work, improve the prompt/spec, don't patch the generated code. The extension facilitates this by making AI collaboration seamless.

- **Language agnostic** - The same implementation spec can generate TypeScript, Python, Rust, or any language. Switch languages by changing generator configuration, not by rewriting code.

- **Upgrade path** - When dependencies update or better patterns emerge, regenerate from specs with new instructions. No refactoring, just regeneration.

- **AI consistency** - Future AI models can regenerate the same artifact from the same spec, enabling long-term maintainability. As AI improves, so does your generated code.

- **Stateless AI, stateful extension** - API is stateless, but VS Code extension maintains conversation context and history, providing the best of both worlds.

- **Formal markdown enables automation** - Structured metadata and markers allow the extension to intelligently determine context, detect ambiguities, and automate spec refinement.
## Development & Testing

### Running Tests

PromptPress includes a bespoke test framework with comprehensive test coverage:

```bash
# Run all tests (compiles + lints + runs tests)
npm test

# Run tests only (no compile/lint)
npm run test:unit

# Compile TypeScript
npm run compile

# Watch mode
npm run watch
```

### Test Coverage

- **API Client Tests**: OpenAI API integration via xAI, error handling, model compatibility
- **Configuration Tests**: Endpoint configuration, model selection
- **Error Handling**: Output channel logging, request/response details
- **Cascade Service Tests**: Change detection, baseline comparison, git fallback, cascade propagation
- **ImplParser Tests**: Code generation from implementation specs, file structure parsing, AI client integration
- **FileStructureParser Tests**: Tree format parsing, path resolution, multiple format support
- **Scaffold Integration Tests**: Complete artifact generation, caching, change propagation
- **Mock Objects**: Platform-agnostic testing without VS Code dependencies

**Running specific test suites:**
```bash
# Run cascade tests only
npm run test:cascade

# Run scaffold tests only
npm run test:scaffold

# Run parser tests only
npm run test:parser

# Run all test suites
npm run test:all
```

See [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for detailed testing documentation.

### Current Model Status

**xAI API Models (as of December 2025):**
- ✅ `grok-code-fast-1` - Currently available (default)
- ❌ `grok-beta` - Deprecated 2025-09-15
- ❌ `grok-2-1212` - Deprecated 2025-09-15
- ❌ `grok-vision-beta` - Deprecated 2025-09-15

See [docs/BUG_FIX_404.md](docs/BUG_FIX_404.md) for details on the model deprecation issue and fix.