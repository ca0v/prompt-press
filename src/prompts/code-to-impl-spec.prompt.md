---
name: Code to Implementation Specification
agent: agent
description: This prompt instructs the AI to convert provided source code files into a detailed implementation specification, following a precise structure and formatting rules.
---

## Task Overview

Given one or more source code files (e.g., TypeScript .ts files), the AI must:

1. Analyze the source files to extract implementation details.
2. Create or update the specification folder structure.
3. Generate a detailed implementation specification in Markdown format.
4. Update the source code files with reference comments to IMP-XXXX identifiers.

## Special Cases

- If the client prompt is "refresh", infer the module name and intended source files from the existing `implementation/<module_name>.impl.md` file. Only process source files that are already mentioned in the spec document; do not include any new source files not previously specified.

## Specification Folder Structure

Create the following folder structure under the project root if it does not exist:

```
specs/
  ├── requirements/
  │   ├── <module_name>.req.md
  ├── design/
  │   ├── <module_name>.design.md
  ├── implementation/
  │   ├── <module_name>.impl.md
```

- `<module_name>`: Derive from the project name or primary namespace (e.g., "WorkflowEngine.TenPrint").
- Only generate the `implementation/<module_name>.impl.md` file as per this prompt. The requirements and design files are out of scope for this prompt.

## IMP-XXXX Identifier Assignment

- Assign a unique IMP-XXXX identifier to every public method in the implementation.
- Identifiers start at IMP-1000 and increment by 1 for each new public method (e.g., IMP-1000, IMP-1001, IMP-1002, ...).
- Assign IDs sequentially across all provided source files, in the order the files are processed (alphabetical by filename).
- Within each file, assign IDs in the order public methods appear in the code (top-to-bottom).

## Source Code Updates

- For each public method, add a comment immediately above its declaration in the source code.
- Comment format: `// <module_name>/IMP-XXXX`.
- Do not modify the code logic; only add comments.
- If a comment already exists, prepend the IMP-XXXX to it.

## Implementation Specification Format

Generate `<module_name>.impl.md` with the following exact structure. Include sections only if they contain relevant content. The specification must be comprehensive enough to allow regeneration of the source code from scratch.

### Markdown Structure

```
# Implementation Specification for <module_name>

## Overview
- Provide a high-level summary of the module's purpose and functionality.
- List all source files included in this specification, with brief purposes, in the following bullet list format:
  - **filename** - purpose

## Files Summary
For each source file:
### File: <filename.ts>
- **Purpose**: One-sentence description of the file's role.
- **Classes**: List of classes defined.
- **Interfaces**: List of interfaces defined.
- **Other Elements**: Any other top-level elements (e.g., enums).

## Classes
For each class:
### <ClassName>
- **Description**: Purpose and responsibilities.
- **Inheritance**: Base class and implemented interfaces.
- **Properties**: List with types, and descriptions.
- **Methods**: List with signatures, IMP-XXXX IDs for public methods, and descriptions.
- **Fields**: List with types, and descriptions.
- **Constructors**: List with signatures, and descriptions.
- **Events**: If any, list with descriptions.
- **Nested Types**: Any nested classes/interfaces/enums.

## Interfaces
For each interface:
### <InterfaceName>
- **Description**: Purpose.
- **Methods**: List with signatures, IMP-XXXX IDs for public methods, and descriptions.
- **Properties**: List with types, and descriptions.
- **Events**: If any, list with descriptions.

## Other Types
For enums, structs, etc.:
### <TypeName>
- **Description**: Purpose.
- **Members**: List with values/types, IMP-XXXX IDs, and descriptions.

## Methods
Group methods by class/interface if needed, but list all public methods with full context.
### <MethodSignature> (IMP-XXXX)
- **Belongs to**: Class/Interface name.
- **Description**: What it does.
- **Parameters**: List with types and descriptions.
- **Return Type**: Type and description.
- **Algorithm**: Step-by-step logic if complex.
- **Exceptions**: Potential exceptions thrown.

## Data Structures
- Describe any custom data structures, collections, or key data models used.
- Reference IMP-XXXX IDs where applicable.

## Algorithms
- Detail any algorithms implemented, with pseudocode or steps.
- Reference IMP-XXXX IDs.

## Dependencies
- **External Libraries**: npm packages, frameworks used.
- **Internal Dependencies**: Other modules or files referenced.
- **System Requirements**: Node.js version, OS, etc.

## Error Handling
- Describe exception handling patterns, custom exceptions.
- Reference IMP-XXXX IDs for relevant methods/classes.

## Performance Considerations
- Any optimizations, bottlenecks, or performance-related code.
- Reference IMP-XXXX IDs.

## Security Considerations
- Security measures, input validation, etc.
- Reference IMP-XXXX IDs.

## Notes
- Any additional implementation notes not covered above.
```

- Use bullet points and subheadings consistently.
- Ensure all IMP-XXXX references link back to the identifiers assigned.
- The specification should be self-contained and detailed, enabling code regeneration.
