---
artifact: <artifact-name>
phase: implementation
depends-on: []
references: [@ref:<artifact-name>.req, @ref:<artifact-name>.design]
version: 1.0.0
last-updated: YYYY-MM-DD
---

# [Artifact Name] - Implementation

## Overview
Precise, unambiguous implementation specifications.

## File Structure
```
artifact-name/
├── src/
│   └── index.ts
└── tests/
    └── index.test.ts
```

## Module: [ModuleName]

### Functions

#### functionName(param1: Type1, param2: Type2): ReturnType
**Purpose**: Exact description of what this function does

**Parameters**:
- `param1`: Description and constraints
- `param2`: Description and constraints

**Returns**: Description of return value

**Algorithm**:
1. Step-by-step logic
2. Handle edge cases
3. Return result

**Error Handling**:
- Throws `ErrorType` when condition X
- Returns null when condition Y

**Test Cases**:
- Input: X, Expected: Y
- Input: Edge case, Expected: Behavior

## Dependencies
Exact imports and versions needed.

## Configuration
Any configuration constants or environment variables.

## Questions & Clarifications
[AI-CLARIFY: Implementation questions?]

## Cross-References
- @ref:<artifact-name>.req - Requirements
- @ref:<artifact-name>.design - Design

## AI Interaction Log
<!-- Auto-maintained by PromptPress extension -->
