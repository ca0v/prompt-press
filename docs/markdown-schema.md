# PromptPress Markdown Schema

This document defines the formal structure for PromptPress specification files.

## File Naming Convention

- Requirements: `<artifact-name>.req.md`
- Design: `<artifact-name>.design.md`
- Implementation: `<artifact-name>.impl.md`

Use kebab-case for artifact names (e.g., `user-authentication`, `data-parser`).

## YAML Frontmatter (Required)

Every spec file must begin with YAML frontmatter enclosed in `---`:

```yaml
---
artifact: string              # Required: artifact name (kebab-case)
phase: requirement | design | implementation  # Required
depends-on: string[]         # Optional: array of artifact dependencies
references: string[]         # Optional: array of @ref: references
version: string              # Optional: semantic version (default: 1.0.0)
last-updated: string         # Optional: ISO date (YYYY-MM-DD)
---
```

### Example

```yaml
---
artifact: user-authentication
phase: design
depends-on: [session-manager, crypto-utils]
references: [@ref:session-manager.design, @ref:crypto-utils.impl]
version: 1.0.0
last-updated: 2025-12-15
---
```

## Document Structure

### Title (Required)
```markdown
# [Artifact Name] - [Phase]
```

Example: `# User Authentication - Design`

### Sections
Use `##` (level 2) headers for main sections. Common sections vary by phase:

**Requirements Phase:**
- Overview
- Functional Requirements
- Non-Functional Requirements
- Questions & Clarifications

**Design Phase:**
- Overview
- Architecture
- API Contracts
- Data Model
- Algorithms & Logic
- Dependencies
- Questions & Clarifications

**Implementation Phase:**
- Overview
- File Structure
- Modules/Classes/Functions (detailed specs)
- Dependencies
- Configuration
- Error Handling
- Test Cases
- Questions & Clarifications

## Special Markers

### AI Clarification Requests
Use `[AI-CLARIFY: question]` to mark questions for AI to address:

```markdown
## Architecture
We'll use a microservices approach.

[AI-CLARIFY: Should we use REST or gRPC for service communication?]
```

### Cross-References
Use `@ref:artifact-name.phase` to reference other specs:

```markdown
## Dependencies
This depends on @ref:session-manager.design for session handling.
```

Valid phases: `req`, `design`, `impl`

### AI Response Markers
AI responses should use these structured markers:

```markdown
[RESPONSE]
Main content of the response...

[QUESTION: section-name]
Clarifying question about a specific section?

REQUEST-DOC: artifact-name.phase
Request to load additional document for context.

[VALIDATION: passed | failed]
Validation result if checking spec completeness.
```

## Validation Rules

The PromptPress extension validates:

1. **Frontmatter exists** and contains required fields
2. **Artifact name** matches filename
3. **Phase** is valid (requirement, design, or implementation)
4. **At least one section** (##) exists
5. **References** use correct `@ref:` syntax
6. **Cross-reference targets** exist in workspace

## Best Practices

1. **Be specific**: Implementation specs should be executable by AI without ambiguity
2. **Link liberally**: Use `@ref:` to connect related specs
3. **Question early**: Use `[AI-CLARIFY:]` to surface ambiguities
4. **Version consistently**: Update version when making significant changes
5. **Update dates**: Keep `last-updated` current for tracking freshness

## Example: Complete Requirement Spec

```markdown
---
artifact: user-authentication
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-15
---

# User Authentication - Requirements

## Overview
Secure user authentication system supporting email/password and OAuth2 providers.

## Functional Requirements
- FR-1: Users SHALL register with email and password
- FR-2: System SHALL support OAuth2 login (Google, GitHub)
- FR-3: Password reset via email link SHALL be provided
- FR-4: Session management with configurable timeout

## Non-Functional Requirements
- NFR-1: Passwords SHALL be hashed with bcrypt (cost factor 12)
- NFR-2: Sessions SHALL expire after 24 hours of inactivity
- NFR-3: Login attempts SHALL be rate-limited (5 per minute)

## Questions & Clarifications
[AI-CLARIFY: Should we support multi-factor authentication?]
[AI-CLARIFY: What OAuth2 flow is preferred - authorization code or PKCE?]

```

## Extension Behavior

When you create or modify a spec file:

1. Extension detects the change via file watcher
2. Parses YAML frontmatter and content
3. Identifies phase (requirement/design/implementation)
4. Loads related specs based on phase:
   - **Requirement**: Just the req file
   - **Design**: Req + design files
   - **Implementation**: Req + design + impl files
5. Includes any `@ref:` referenced files
6. Aggregates into context payload
7. Submits to AI with system prompt
8. Presents response in chat panel
9. On user approval, updates spec with AI content

This schema ensures consistency, enables automation, and makes specs parsable by both humans and AI.
