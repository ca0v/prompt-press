---
name: Implementation to Design Specification
agent: agent
description: This prompt instructs the AI to convert a provided implementation specification into a detailed design specification, generalizing the content into a higher-level summary while remaining precise and terse, and update the implementation specification to reference the design elements it satisfies.
---

## Task Overview

Given an implementation specification document (e.g., `implementation/<module_name>.impl.md` generated from the code-to-impl-spec prompt), the AI must:

1. Analyze the implementation spec to extract and generalize key design elements.
2. Create or update the design specification folder structure.
3. Generate a detailed design specification in Markdown format.
4. Assign DES-XXXX identifiers to each major design element.
5. Update the implementation specification document to include a "Design Requirements" section linking each DES-XXXX to the IMP-XXXX elements that satisfy it.

## Special Cases

- If the client prompt is "refresh", infer the module name from the existing `design/<module_name>.design.md` file and process the corresponding `implementation/<module_name>.impl.md`. Only process elements that are already mentioned in the design document; do not include any new elements not previously specified.

## Specification Folder Structure

Ensure the following folder structure exists under the project root:

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
- Generate the `design/<module_name>.design.md` file and update the `implementation/<module_name>.impl.md` file as per this prompt. The requirements file is out of scope.

## DES-XXXX Identifier Assignment

- Assign a unique DES-XXXX identifier to every major design element (e.g., data models, components, dependencies).
- Identifiers start at DES-1000 and increment by 1 for each new element (e.g., DES-1000, DES-1001, DES-1002, ...).
- Assign IDs sequentially across the design elements, in the order they appear in the specification (top-to-bottom).

## Design Specification Format

Generate `<module_name>.design.md` with the following exact structure. Include sections only if they contain relevant content. The specification must be generalized from the implementation spec, providing a higher-level summary that captures the intent and allows an AI to recreate the implementation spec's purpose.

### Markdown Structure

```
# Design Specification for <module_name>

## Overview
- Provide a high-level summary of the module's purpose and architecture.
- List key design elements with DES-XXXX IDs.

## Data Models
For each key data structure or model:
### <ModelName> (DES-XXXX)
- **Description**: High-level purpose and structure.
- **Fields/Properties**: Generalized list of key attributes (types optional, focus on purpose).
- **Relationships**: How it relates to other models or components.

## Components
For each major class, interface, or component:
### <ComponentName> (DES-XXXX)
- **Description**: High-level responsibilities and role.
- **Type**: Class, Interface, etc.
- **Key Methods**: Generalized list of public methods (signatures optional, focus on functionality).
- **Dependencies**: Internal and external dependencies.

## Dependencies
- **External Libraries**: Frameworks, npm packages used, with purposes.
- **Internal Dependencies**: Other modules or components referenced.
- **System Requirements**: Node.js version, OS, etc.

## Architecture
- High-level system architecture, including how components interact.
- Reference DES-XXXX IDs.

## Algorithms
- Generalized description of key algorithms implemented.
- Reference DES-XXXX IDs for related components.

## Error Handling
- High-level error handling patterns.
- Reference DES-XXXX IDs.

## Performance Considerations
- Key performance aspects.
- Reference DES-XXXX IDs.

## Security Considerations
- Security measures at a design level.
- Reference DES-XXXX IDs.

## Notes
- Any additional design notes not covered above.
```

- Use bullet points and subheadings consistently.
- Ensure all DES-XXXX references link back to the identifiers assigned.
- The specification should be terse, precise, and focused on intent, enabling recreation of the implementation spec's purpose.

## Implementation Specification Update

Update `<module_name>.impl.md` by adding a "Design Requirements" section after the Overview section. The section must list each design element from the generated design.md and the IMP-XXXX elements that satisfy it.

### Design Requirements Section Format

```
## Design Requirements
- <module_name>.design.md/DES-XXXX: IMP-XXXX, IMP-XXXX, ...
```

- For each DES-XXXX, list the comma-separated IMP-XXXX identifiers of the implementation elements (methods, classes) that implement or satisfy the design element.
- Ensure the list is accurate based on the implementation elements' roles in fulfilling the design.
