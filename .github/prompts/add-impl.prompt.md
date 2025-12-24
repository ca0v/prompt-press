---
name: Add Implementation Element to an Implementation Specification
agent: agent
description: This prompt instructs the AI to add a new implementation element (IMP-XXXX) to an existing implementation specification document, based on a design element ID and user-provided context, following the structure defined in code-to-impl-spec.prompt.md.
---

## Task Overview

Given a design element ID (DES-XXXX) and user-provided context describing the implementation element, the AI must:

1. Verify the target document is an implementation specification by checking the frontmatter for `phase: implementation`.
2. If verified, analyze the existing implementation document to determine the next available IMP-XXXX identifier.
3. Create a new implementation element entry using the specified format, placed in the appropriate section (typically Methods for new methods, or Classes/Interfaces for new types).
4. Update the document's Design Requirements section to link the provided DES-XXXX to the new IMP-XXXX.
5. Update the corresponding source code file with the IMP-XXXX comment if applicable.

## Verification

- Check the document's frontmatter for `phase: implementation`.
- If the phase is not "implementation", respond with an error message and do not proceed.

## IMP-XXXX Assignment

- Find the highest existing IMP-XXXX identifier in the document.
- Assign the next sequential ID (e.g., if IMP-1080 exists, assign IMP-1081).

## New Implementation Element Format

Add the new implementation element in the appropriate section using the format from code-to-impl-spec.prompt.md. For methods:

### <MethodSignature> (IMP-XXXX)
- **Belongs to**: Class/Interface name.
- **Description**: What it does.
- **Parameters**: List with types and descriptions.
- **Return Type**: Type and description.
- **Algorithm**: Step-by-step logic.
- **Exceptions**: Potential exceptions thrown.

For classes/interfaces, use the respective section formats.

## Document Updates

1. **Design Requirements Section**: Add or update the mapping for the provided DES-XXXX to include the new IMP-XXXX (e.g., `DES-XXXX: IMP-XXXX`).
2. **Methods/Classes/Interfaces Section**: Append the new IMP-XXXX entry to the appropriate section.
3. **Files Summary/Files Section**: Update if a new file or element is added.
4. **Other Sections**: No changes needed unless the new element impacts Dependencies, etc.

## Source Code Updates

- If the new element corresponds to a source code method/class, ensure the source file has the `// <module_name>/IMP-XXXX` comment added above the declaration.
- Do not modify code logic; only add comments.

## Success Criteria

- The document remains valid Markdown.
- The new IMP follows the exact format specified.
- All identifiers are unique and sequential.
- The Design Requirements section includes the DES-IMP mapping.
- Source code comments are updated if applicable.