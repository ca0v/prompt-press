---
artifact: cascadeCore-test
phase: test
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-23
---

# CascadeCore Test Specifications

## Overview

Tests for CascadeCore applyChange method, covering text removal from sections, adding content to AI-CLARIFY sections, handling primary section removals, and applying complex change sequences from tersify responses.

## Test Specifications

### Test 1: should remove text from secondary section

- **Inputs**: Markdown content with FR-8 and FR-9 sections, change object with type 'Remove from', section 'Functional Requirements FR-8', and specific content to remove
- **Expected Outputs**: Result does not include 'FR-8:', includes 'FR-9: Other requirement.'
- **Description**: Verifies that applyChange correctly removes specified text from a secondary section while preserving other content.

### Test 2: should add to AI-CLARIFY section

- **Inputs**: Markdown content with Overview section, change object with type 'Add to', section 'AI-CLARIFY section', and clarification content
- **Expected Outputs**: Result includes '## Questions & Clarifications' section and the added clarification text
- **Description**: Tests adding content to a new AI-CLARIFY section when it doesn't exist.

### Test 3: should handle remove from primary section

- **Inputs**: Markdown content with Overview section containing faction description, change object to remove the faction description
- **Expected Outputs**: Result does not include 'The base faction is called', includes 'Other overview text.'
- **Description**: Ensures removal works for primary sections like Overview.

### Test 4: should handle the provided tersify response changes

- **Inputs**: Complex faction requirement content with multiple FR sections, array of remove changes for Overview and Functional Requirements, and add change for AI-CLARIFY
- **Expected Outputs**: All specified FR sections removed, clarification added, no includes for removed content
- **Description**: Applies multiple remove changes followed by an add change, verifying comprehensive modification.

### Test 5: should handle changes from tersify response file

- **Inputs**: Tersify response file parsed into change table, grouped by document, applied to mock faction content
- **Expected Outputs**: Modified content after applying all changes (no specific assertions in test)
- **Description**: Tests parsing tersify response file and applying changes to content, for debugging purposes.