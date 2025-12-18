---
artifact: example-parser
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-18
---

# Example Parser - Requirements

## Overview

## Overview  
  The example-parser.req.md requirement specifies a simple parser artifact within PromptPress that extracts structured data from text files, demonstrating prompt-driven development in practice. This artifact supports the SDLC workflow by allowing developers to define parser requirements in Markdown, refine them iteratively with AI (e.g., specifying input formats and extraction rules), generate design specs for data structures, and produce implementation code (e.g., in Python or JavaScript). Operations include developer-authored specs in the `specs/` directory, AI-assisted refinement for clarity (e.g., handling edge cases like malformed text), cascading updates to design and implementation phases, and code regeneration upon changes. User roles involve developers monitoring files and triggering commands; interfaces include VS Code for editing, Git for versioning, and AI APIs for refinement. Constraints include AI token limits for complex specs and assumptions of reliable text file access. Success is measured by accurate data extraction rates (>95%) and reproducibility across regenerations. This aligns with PromptPress's goal of shifting technical debt to maintainable specs, enabling easy adaptation for new data formats or languages.
## Overview  
  The example-parser.req.md requirement specifies a simple parser artifact within PromptPress that extracts structured data from text files, demonstrating prompt-driven development in practice. This artifact supports the SDLC workflow by allowing developers to define parser requirements in Markdown, refine them iteratively with AI (e.g., specifying input formats and extraction rules), generate design specs for data structures, and produce implementation code (e.g., in Python or JavaScript). Operations include developer-authored specs in the `specs/` directory, AI-assisted refinement for clarity (e.g., handling edge cases like malformed text), cascading updates to design and implementation phases, and code regeneration upon changes. User roles involve developers monitoring files and triggering commands; interfaces include VS Code for editing, Git for versioning, and AI APIs for refinement. Constraints include AI token limits for complex specs and assumptions of reliable text file access. Success is measured by accurate data extraction rates (>95%) and reproducibility across regenerations. This aligns with PromptPress's goal of shifting technical debt to maintainable specs, enabling easy adaptation for new data formats or languages.
## Functional Requirements
- FR-1: Parse text files line by line
- FR-2: Extract key-value pairs in format "key: value"
- FR-3: Return parsed data as JSON object
- FR-4: Handle malformed lines gracefully

## Non-Functional Requirements
- NFR-1: Should process files up to 10MB efficiently
- NFR-2: Must validate input before processing

## Questions & Clarifications
[AI-CLARIFY: Should we support nested key-value structures?]
[AI-CLARIFY: What should happen with duplicate keys?]

## Cross-References
None (initial requirement)

## AI Interaction Log
<!-- This section will be populated by the PromptPress extension -->
