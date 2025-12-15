---
artifact: example-parser
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-15
---

# Example Parser - Requirements

## Overview
A simple parser that extracts structured data from text files.

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
