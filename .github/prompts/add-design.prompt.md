---
name: Add Design Element to a Design Specification
agent: agent
description: This prompt instructs the AI to add a new design element (DES-XXXX) to an existing design specification document, based on a requirements feature request ID and user-provided context, following the structure defined in impl-to-design-spec.prompt.md.
---

## Task Overview

Given a requirements feature request ID (FR-XXXX) and user-provided context describing the design element, the AI must:

1. Verify the target document is a design specification by checking the frontmatter for `phase: design`.
2. If verified, analyze the existing design document to determine the next available DES-XXXX identifier.
3. Create a new design element entry using the specified format, placed in the appropriate section (typically Components).
4. Update the document's Overview section to include the new DES-XXXX in the list of key design elements.
5. Update the Requirements section to link the provided FR-XXXX to the new DES-XXXX.

## Verification

- Check the document's frontmatter for `phase: design`.
- If the phase is not "design", respond with an error message and do not proceed.

## DES-XXXX Assignment

- Find the highest existing DES-XXXX identifier in the document.
- Assign the next sequential ID (e.g., if DES-1038 exists, assign DES-1039).

## New Design Element Format

Add the new design element in the Components section using this format (adjust section as appropriate):

### <ComponentName> (DES-XXXX)
- **Description**: [High-level responsibilities and role, derived from FR and user context]
- **Type**: [Class, Interface, etc. - infer from context]
- **Key Methods**: [Generalized list of public methods - infer from context]
- **Dependencies**: [Internal and external dependencies - infer from context]

## Document Updates

1. **Overview Section**: Add the new DES-XXXX to the list of key design elements.
2. **Components Section**: Append the new DES-XXXX entry at the end of the section.
3. **Requirements Section**: Add or update the mapping for the provided FR-XXXX to include the new DES-XXXX (e.g., `@promptpress.req/FR-XXXX: DES-XXXX`).
4. **Other Sections**: No changes needed unless the new element impacts Architecture, Algorithms, etc.

## Success Criteria

- The document remains valid Markdown.
- The new DES follows the exact format specified.
- All identifiers are unique and sequential.
- The overview accurately reflects the new element.
- The Requirements section includes the FR-DES mapping.
