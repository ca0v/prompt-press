---
agent: agent
description: Imports requirements into a design document, ensuring they are clearly defined, organized, and unambiguous.
---

This prompt is designed for design specification documents.  They must contain a YAML frontmatter header with the key `phase: design`. If this key is missing or incorrect, the process will halt with an error message.

From the YAML, look for the `satisfies:` key, which lists requirement spec documents that the design addresses. If this key is missing or empty, the process will halt with an error message.

For each requirement spec document listed in `satisfies:`, perform the following steps:

- Load the requirement spec document and verify it contains `phase: requirement` in its YAML frontmatter. If not, output `ERROR: Not a requirement specification` and stop processing.
- Extract all functional and non-functional requirements from the requirement spec document.
- For each requirement:
   - Ensure it is atomic (addresses one thing), testable (can be verified), and unambiguous (clear meaning).
   - If a requirement does not meet these criteria, this is an error condition. Output `ERROR: Requirement {requirement_id} is not well-defined` and stop processing.
   - In the Satisfies section of the design document, reference each requirement using the format `{artifact_name} {requirement_id}` (e.g., `foo.req.md FR-01`).
- Update the various sections of the design document to explicitly address how each requirement is satisfied.  Reference the requirement using the same format as above.
- Ensure the design document's Overview section summarizes how the design meets the requirements without including specific requirement details.

POST-PROCESSING:
- Re-evaluate the design document for clarity and conciseness. Ensure all requirements are properly integrated and referenced, and that the document adheres to the expected structure for design specifications.
- If any requirements are found to be missing or inadequately addressed, output `ERROR: Requirement {requirement_id} not addressed in design` and stop processing.