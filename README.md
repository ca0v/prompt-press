# PromptPress

Prompt-Driven Development Tool

## Vision

Track AI prompts as persistent, versioned specs. Turn vague English into rigid, reusable Markdown. Future AI reruns for upgrades or language swaps.

## Core Principles

- Prompts are source of truth
- One .md file per artifact
- The prompt itself is iterated on until it precisely articulates the desired outcome
- Follows a standard SDLC, with requirements, design and implementation level documentation. The "requirements" are written by the developer, the "design" is a collaborative space, and the "implementation" is markdown written by the AI.
- Code is generated from the "implementation" markdown, which is similar to "assembly", where the source code is analogous to "binary".

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

## Folder Structure

```
prompt-press/
├── README.md                          # This file - project overview and requirements
├── docs/                              # Project-level documentation
│   ├── architecture.md                # System architecture decisions
│   ├── workflow.md                    # Development workflow guide
│   └── conventions.md                 # Naming and structure conventions
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

## Workflow

1. **Developer** creates `<artifact>.req.md` describing what needs to be built
2. **Developer + AI** collaborate on `<artifact>.design.md` to determine how
3. **AI** generates `<artifact>.impl.md` with precise, unambiguous specifications
4. **AI or tooling** generates code in `artifacts/<artifact>/` from implementation spec
5. **Iterate**: If code doesn't meet requirements, refine the specs (not the code directly)
6. **Regenerate**: To upgrade or change languages, rerun generation from existing specs

## Key Insights

- **Code is ephemeral, specs are permanent** - The markdown specifications are the true source. Code can always be regenerated.
  
- **Iteration happens at the spec level** - When something doesn't work, improve the prompt/spec, don't patch the generated code.

- **Language agnostic** - The same implementation spec can generate TypeScript, Python, Rust, or any language.

- **Upgrade path** - When dependencies update or better patterns emerge, regenerate from specs with new instructions.

- **AI consistency** - Future AI models can regenerate the same artifact from the same spec, enabling long-term maintainability.
