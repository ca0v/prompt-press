---
artifact: markdown-parser-test
phase: test
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-23
---

# Markdown Parser Test Specifications

## Overview
Test specifications for MarkdownParser functionality, ensuring correct parsing of references, tables, and change tables.

## Test Specifications

### Test 1: Extract References Without Trailing Punctuation
- **Inputs**:
  - content: "The base @faction.req consists of five distinct geode types: @geode-pyrite.req, @geode-calcite.req, @geode-amethyst.req, and @geode-quartz.req."
- **Expected Outputs**:
  - parsed.references: ['faction.req', 'geode-pyrite.req', 'geode-calcite.req', 'geode-amethyst.req', 'geode-quartz.req']
- **Description**: Parse markdown content to extract references, ignoring trailing punctuation like commas and periods.

### Test 2: Parse General Markdown Table
- **Inputs**:
  - tableContent: Markdown table string with columns Name, Age, City and rows for John and Jane.
- **Expected Outputs**:
  - result: [{ Name: 'John', Age: '25', City: 'NY' }, { Name: 'Jane', Age: '30', City: 'LA' }]
- **Description**: Extract table data from markdown into array of objects, skipping non-table text.

### Test 3: Parse Change Table for Tersify
- **Inputs**:
  - tableContent: Markdown table with Target Document, Action, Details, Reason columns.
- **Expected Outputs**:
  - result: Array of objects with document, action, details, reason.
- **Description**: Parse change table into structured data for tersify operations.

### Test 4: Parse Tersify Response Table with Formatted Separator
- **Inputs**:
  - content: File content from tersify-response.md
- **Expected Outputs**:
  - result.length: 20
  - Specific assertions on first and last rows.
- **Description**: Parse large markdown table from file, verify row count and specific values.