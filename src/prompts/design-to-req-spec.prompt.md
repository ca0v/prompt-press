---
name: Design to Requirements Specification
agent: agent
description: This prompt instructs the AI to convert a provided design specification into a detailed requirements specification, generalizing the content into a higher-level summary while remaining precise and terse, and update the design specification to reference the requirements it satisfies.
---

## Task Overview

Given a design specification document (e.g., `design/<module_name>.design.md` generated from the impl-to-design-spec prompt), the AI must:

1. Analyze the design spec to extract and generalize key requirements.
2. Create or update the requirements specification folder structure.
3. Generate a detailed requirements specification in Markdown format.
4. Assign FR-XXXX identifiers to functional requirements and NFR-XXXX to non-functional requirements.
5. Update the design specification document to include a "Requirements" section linking each FR-XXXX to the DES-XXXX elements that satisfy it.

## Special Cases

- If the client prompt is "refresh", infer the module name from the existing `requirements/<module_name>.req.md` file and process the corresponding `design/<module_name>.design.md`. Only process elements that are already mentioned in the requirements document; do not include any new elements not previously specified.

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
- Generate the `requirements/<module_name>.req.md` file and update the `design/<module_name>.design.md` file as per this prompt. The implementation file is out of scope.

## FR-XXXX and NFR-XXXX Identifier Assignment

- Assign a unique FR-XXXX identifier to every functional requirement.
- Assign a unique NFR-XXXX identifier to every non-functional requirement.
- Identifiers start at FR-1000 and NFR-1000, incrementing by 1 for each new requirement (e.g., FR-1000, FR-1001, NFR-1000, NFR-1001, ...).
- Assign IDs sequentially across the requirements, in the order they appear in the specification (top-to-bottom).

## Requirements Specification Format

Generate `<module_name>.req.md` with the following exact structure. Include sections only if they contain relevant content. The specification must be generalized from the design spec, providing a higher-level summary that captures the intent and allows an AI to recreate the design spec's purpose.

### Markdown Structure

```
# Requirements Specification for <module_name>

## Overview
- Provide a high-level summary of the module's purpose and key requirements.
- List functional and non-functional requirements with FR-XXXX and NFR-XXXX IDs.

## Functional Requirements
For each functional requirement:
### FR-XXXX
- **Description**: High-level description of the required functionality.
- **Priority**: High/Medium/Low (infer from design criticality).
- **Dependencies**: Related components or data models.

## Non-Functional Requirements
For each non-functional requirement:
### NFR-XXXX
- **Description**: High-level description of the quality attribute.
- **Category**: Performance, Security, Usability, etc.
- **Metrics**: Measurable criteria where applicable.

## Use Cases
- Describe primary use cases, referencing FR-XXXX IDs.
- Each use case should outline actors, preconditions, main flow, postconditions.

## Assumptions
- Any assumptions made in deriving requirements from the design.

## Constraints
- Limitations or constraints identified from the design.

## Notes
- Any additional requirements notes not covered above.
```

- Use bullet points and subheadings consistently.
- Ensure all FR-XXXX and NFR-XXXX references link back to the identifiers assigned.
- The specification should be terse, precise, and focused on intent, enabling recreation of the design spec's purpose.

## Design Specification Update

Update `<module_name>.design.md` by adding a "Requirements" section after the Overview section. The section must list each functional requirement from the generated req.md and the DES-XXXX elements that satisfy it.

### Requirements Section Format

```
## Requirements
- <module_name>.req.md/FR-XXXX: DES-XXXX, DES-XXXX, ...
```

- For each FR-XXXX, list the comma-separated DES-XXXX identifiers of the design elements (data models, components) that implement or satisfy the requirement.
- Only include functional requirements (FR-XXXX); non-functional are not linked here.
- Ensure the list is accurate based on the design elements' roles in fulfilling the requirements.
