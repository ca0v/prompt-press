---
artifact: cascadeService-test
phase: test
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-23
---

# CascadeService Test Specifications

## Overview

Tests for CascadeService change detection and cascading functionality, covering requirement to design cascading, requirement to design and implementation cascading, change detection, baseline management, error handling, and tersify operations.

## Test Specifications

### Test 1: should detect changes between baseline and current content

- **Inputs**: Requirement file with baseline content, updated content with new feature added, design file existing
- **Expected Outputs**: Refactor result success true, output includes 'Changes detected'
- **Description**: Verifies change detection by comparing baseline to current content and triggering cascade.

### Test 2: should cascade from requirement to design

- **Inputs**: Requirement file with new feature, existing design file with old content
- **Expected Outputs**: Result success true, updatedFiles includes design file, AI called, design content updated with artifact and phase
- **Description**: Tests cascading changes from requirement to design phase, updating design file.

### Test 3: should cascade from requirement to design and implementation

- **Inputs**: Requirement file with core and advanced features, existing design and implementation files
- **Expected Outputs**: Result success true, updatedFiles includes design and impl files, AI called at least twice, both files updated
- **Description**: Verifies full cascade from requirement through design to implementation.

### Test 4: should not cascade if no changes detected

- **Inputs**: Requirement file with content matching baseline
- **Expected Outputs**: Result success true, updatedFiles empty, AI not called
- **Description**: Ensures no cascade occurs when content matches baseline.

### Test 5: should update baseline cache after successful cascade

- **Inputs**: Requirement file with new content, existing design file
- **Expected Outputs**: Baseline file exists, baseline content matches current file
- **Description**: Tests that baseline cache is updated after successful refactoring.

### Test 6: should handle missing design file gracefully

- **Inputs**: Requirement file without corresponding design file
- **Expected Outputs**: Result success true, updatedFiles length <=1, output includes 'No design file found'
- **Description**: Verifies graceful handling when design file is missing.

### Test 7: should fail when cascading from design without requirement

- **Inputs**: Design file without requirement dependency
- **Expected Outputs**: Result success false, errors include 'Cannot cascade from design without requirement'
- **Description**: Ensures cascading only starts from requirement phase.

### Test 8: should include change summary in AI prompts

- **Inputs**: Requirement file with baseline and updated content, existing design file
- **Expected Outputs**: AI called, last messages include requirement content with 'specific feature mention'
- **Description**: Verifies that requirement content is passed to AI for design updates.

### Test 9: should tersify spec documents

- **Inputs**: Requirement file with references to design file, design file content
- **Expected Outputs**: AI called, user message includes 'Tersify Spec Documents', includes source and referenced content
- **Description**: Tests tersify operation that processes spec documents and their references.