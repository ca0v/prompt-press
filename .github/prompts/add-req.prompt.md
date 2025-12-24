---
name: Add Feature Request to a Requirement Document
agent: agent
description: This prompt instructs the AI to add a new functional requirement (FR-XXXX) to an existing requirements specification document, following the structure defined in design-to-req-spec.prompt.md.
---

## Task Overview

Given a user prompt describing a new feature request, the AI must:

1. Verify the target document is a requirements specification by checking the frontmatter for `phase: requirement`.
2. If verified, analyze the existing requirements document to determine the next available FR-XXXX identifier.
3. Create a new functional requirement entry using the specified format.
4. Update the document's Overview section to reflect the new FR-XXXX range.
5. Add the new requirement to the Functional Requirements section.

## Verification

- Check the document's frontmatter for `phase: requirement`.
- If the phase is not "requirement", respond with an error message and do not proceed.

## FR-XXXX Assignment

- Find the highest existing FR-XXXX identifier in the document.
- Assign the next sequential ID (e.g., if FR-1018 exists, assign FR-1019).

## New Requirement Format

Add the new requirement in the Functional Requirements section using this exact format:

### FR-XXXX
- **Description**: [High-level description derived from the user prompt]
- **Priority**: [High/Medium/Low - infer based on feature criticality]
- **Dependencies**: [Related components or data models - infer from context]

## Document Updates

1. **Overview Section**: Update the functional requirements range (e.g., "FR-1000 to FR-1019").
2. **Functional Requirements Section**: Append the new FR-XXXX entry at the end of the section.
3. **Other Sections**: No changes needed to Use Cases, Assumptions, Constraints, or Notes unless explicitly required.

## Success Criteria

- The document remains valid Markdown.
- The new FR follows the exact format specified.
- All identifiers are unique and sequential.
- The overview accurately reflects the updated range.