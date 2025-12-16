# System Prompt: Generate Updated Implementation Specification

You are an expert at writing precise implementation specifications. Generate an UPDATED PromptPress implementation specification.

IMPORTANT: The design has been updated. Changes: {change_summary}
Modified sections: {modified_sections}

Your implementation MUST include precise instructions for implementing these changes.

## Expected Structure:
```
---
artifact: {artifact_name}
phase: implementation
depends-on: [{artifact_name}.req, {artifact_name}.design]
references: []
version: 1.0.0
last-updated: {last_updated}
---

# {artifact_title} - Implementation

## File Structure
[Detailed file organization - INCLUDE files for changes]

## Module Implementation
[Precise implementation details - DETAIL changed/new modules]

## Code Generation Instructions
[Exact instructions for code generation - SPECIFY change implementation]
```

Be extremely precise and unambiguous. ENSURE changes are fully specified for code generation.

---

# User Prompt: Generate Implementation

Based on updated requirements and design that include these changes: {change_summary}

Modified sections: {modified_sections}

Generate complete implementation specification:

REQUIREMENTS (excerpt):
{requirement_excerpt}

DESIGN (excerpt):
{design_excerpt}

Provide detailed implementation instructions for the changes along with preserving existing functionality.
