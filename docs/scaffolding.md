# PromptPress Scaffolding Guide

## Overview

Scaffolding commands use AI to automatically generate initial specification files, saving you time and ensuring consistency.

## Commands

### 1. Scaffold New Project

**Command**: `PromptPress: Scaffold New Project`

**What it does**:
- Creates complete PromptPress folder structure
- Sets up specs/, artifacts/, templates/, tools/, docs/ directories
- Copies template files
- Prepares workspace for first artifact

**When to use**: Starting a new PromptPress project from scratch

**Example**:
```
my-project/              # Empty or existing project
  ↓
  (Run: Scaffold New Project)
  ↓
my-project/
├── specs/
│   ├── requirements/
│   ├── design/
│   └── implementation/
├── artifacts/
├── templates/
├── tools/
└── docs/
```

### 2. Scaffold New Artifact

**Command**: `PromptPress: Scaffold New Artifact`

**What it does**:
1. Prompts for artifact name (kebab-case)
2. Prompts for high-level description
3. Uses AI to generate:
   - Complete requirement specification
   - Complete design specification
4. Creates files in specs/requirements/ and specs/design/
5. Opens requirement file for review

**When to use**: Starting a new feature or component

## Using the Scaffold Command

### Basic Example

1. **Run command**: `PromptPress: Scaffold New Artifact`

2. **Enter artifact name**: 
   ```
   user-authentication
   ```
   (Must be kebab-case: lowercase, hyphens only)

3. **Enter description**:
   ```
   A secure user authentication system supporting email/password login 
   and OAuth2 integration with Google and GitHub. Should include session 
   management and password reset functionality.
   ```

4. **AI generates**:
   - `specs/requirements/user-authentication.req.md`
   - `specs/design/user-authentication.design.md`

5. **Review**: Requirement file opens automatically for review

### Using Project README

If your project has a README.md with context about what you're building:

1. **Run command**: `PromptPress: Scaffold New Artifact`

2. **Enter artifact name**: 
   ```
   data-sync-service
   ```

3. **Enter description**:
   ```
   see README.md
   ```
   or
   ```
   see readme - a service to sync data between databases
   ```

4. **AI reads README.md** and uses it as context along with your description

5. **Generates specs** with better understanding of your project

## What Gets Generated

### Requirement Specification

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
[AI-generated overview based on your description]

## Functional Requirements
- FR-1: [Specific requirement]
- FR-2: [Another requirement]
...

## Non-Functional Requirements
- NFR-1: [Performance, security, etc.]
...

## Questions & Clarifications
[AI-CLARIFY: Questions AI identified]

## Cross-References
[Any dependencies]

## AI Interaction Log
<!-- Auto-maintained -->
```

### Design Specification

```markdown
---
artifact: user-authentication
phase: design
depends-on: []
references: [@ref:user-authentication.req]
version: 1.0.0
last-updated: 2025-12-15
---

# User Authentication - Design

## Overview
[AI-generated design approach]

## Architecture
[Components, modules, layers]

## API Contracts
[Interfaces, functions, endpoints]

## Data Model
[Database schema, data structures]

## Algorithms & Logic
[Key algorithms and flows]

## Dependencies
[Third-party libraries, services]

## Questions & Clarifications
[AI-CLARIFY: Design questions]

## Cross-References
- @ref:user-authentication.req - Requirements

## AI Interaction Log
<!-- Auto-maintained -->
```

## Best Practices

### 1. Be Descriptive in Your Input

❌ Bad:
```
"A login system"
```

✅ Good:
```
"A secure user authentication system with email/password login, 
OAuth2 (Google, GitHub), session management with 24-hour timeout, 
password reset via email, and rate limiting on login attempts."
```

### 2. Leverage Project Context

If you have a detailed README:
```
"see README.md - need authentication for the user management system"
```

This gives AI full project context.

### 3. Review and Refine

AI-generated specs are starting points:
1. ✅ Review for accuracy
2. ✅ Add missing details
3. ✅ Clarify ambiguities
4. ✅ Use chat panel to discuss improvements
5. ✅ Iterate until precise

### 4. Use Chat After Scaffolding

After scaffolding:
1. File watcher detects the new files
2. Click "Yes" to discuss with AI
3. Ask for clarifications: "What about multi-factor auth?"
4. Refine the specs through conversation

## Example Workflows

### Quick Feature Addition

```bash
# You need to add a new feature to existing project
Command: Scaffold New Artifact
Name: export-to-pdf
Description: Export report data to PDF with custom formatting and logo

# AI generates req + design specs
# Review, refine, create implementation
```

### Microservice Project

```bash
# New microservice in your architecture
Command: Scaffold New Artifact
Name: notification-service
Description: see README.md - microservice to handle email and SMS notifications

# AI reads your README for architecture context
# Generates specs aligned with your system
```

### Complex System

```bash
# Break down into multiple artifacts
Command: Scaffold New Artifact (repeat for each)

1. Name: api-gateway
   Desc: API gateway handling routing, auth, rate limiting

2. Name: user-service
   Desc: User management microservice with CRUD operations

3. Name: order-service
   Desc: Order processing service with payment integration

# Each gets req + design specs
# All can reference each other via @ref:
```

## Editing After Scaffold

### Add Clarifications

```markdown
## Questions & Clarifications
[AI-CLARIFY: Should we support biometric authentication?]
[AI-CLARIFY: What's the maximum session timeout allowed?]
```

### Add Cross-References

```markdown
## Cross-References
- @ref:session-manager.design - Session handling
- @ref:email-service.impl - For password reset emails
```

### Link Dependencies

```yaml
---
artifact: user-authentication
phase: requirement
depends-on: [session-manager, email-service]
references: [@ref:session-manager.design]
version: 1.0.0
last-updated: 2025-12-15
---
```

## Troubleshooting

### "No workspace folder open"
**Fix**: Open a folder in VS Code before running scaffold commands

### AI response seems generic
**Fix**: Provide more detailed description with specific requirements

### "Could not read README.md"
**Fix**: Ensure README.md exists in workspace root, or provide full description

### Specs don't match your needs
**Fix**: Scaffolding is a starting point - edit the files and use chat to refine

## Tips

1. **Start broad, refine iteratively**: Use scaffold for the initial structure, then refine through chat

2. **Save time on boilerplate**: Scaffold handles YAML frontmatter, structure, sections automatically

3. **Consistency**: AI follows the same template format every time

4. **Learn by example**: See how AI structures requirements and design specs

5. **Use as a template**: Even if you don't like AI's content, the structure is correct

## What's Next?

After scaffolding:
1. ✅ Review generated specs
2. ✅ Use chat panel to refine
3. ✅ Add clarifications with [AI-CLARIFY:]
4. ✅ Create implementation spec
5. ✅ Generate code

Remember: **Scaffolding jumpstarts your work, conversation perfects it!**
