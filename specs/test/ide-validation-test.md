---
artifact: ide-validation-test
phase: test
depends-on: []
references: []
version: 1.0.0
last-updated: 2025-12-23
---

# IDE Validation Test Specifications

## Overview

Tests for IDE validation logic, covering mention extraction from content, over-specification detection, file existence validation, circular dependency detection, auto-completion suggestions, and SpecFileProcessor metadata and reference updates.

## Test Specifications

### Test 1: should extract simple mentions from content

- **Inputs**: Markdown content with @foo.req and @bar.design mentions
- **Expected Outputs**: Parsed references equal ['foo.req', 'bar.design']
- **Description**: Verifies extraction of simple @artifact.phase mentions.

### Test 2: should extract mentions with over-specification

- **Inputs**: Content with @foo.req[extra] and @@bar.design mentions
- **Expected Outputs**: Parsed references equal ['foo.req', '@bar.design']
- **Description**: Tests extraction of mentions with additional specifiers.

### Test 3: should detect over-specified depends-on

- **Inputs**: Dependency 'foo.req[extra]'
- **Expected Outputs**: isOverSpecified returns true
- **Description**: Validates detection of over-specified dependencies.

### Test 4: should not detect over-specified for valid depends-on

- **Inputs**: Dependency 'foo.req'
- **Expected Outputs**: isOverSpecified returns false
- **Description**: Ensures valid dependencies are not flagged.

### Test 5: should detect non-existent file

- **Inputs**: Reference 'nonexistent.req'
- **Expected Outputs**: File path does not exist
- **Description**: Tests validation of non-existent spec files.

### Test 6: should detect existing file

- **Inputs**: Created spec file 'specs/requirements/@foo.req'
- **Expected Outputs**: File path exists
- **Description**: Verifies detection of existing spec files.

### Test 7: should detect circular dependency

- **Inputs**: Mock dependencies where a.req depends on b.req and b.req depends on a.req
- **Expected Outputs**: getAllDependencies returns set including starting specRef
- **Description**: Tests circular dependency detection in dependency graph.

### Test 8: should not detect circular for non-circular

- **Inputs**: Spec 'c.req' with no dependencies
- **Expected Outputs**: getAllDependencies does not include specRef
- **Description**: Ensures non-circular dependencies are not flagged.

### Test 9: should not suggest current document in @ mentions

- **Inputs**: Current ref 'foo.req', all refs ['foo.req', 'bar.req', 'baz.design']
- **Expected Outputs**: Filtered refs ['bar.req', 'baz.design']
- **Description**: Tests auto-completion filtering for @ mentions.

### Test 10: should not suggest .impl files in @ mentions

- **Inputs**: All refs ['foo.req', 'bar.design', 'baz.impl']
- **Expected Outputs**: Filtered refs ['foo.req', 'bar.design']
- **Description**: Ensures .impl files are excluded from @ mention suggestions.

### Test 11: should filter design files for req phase in @ mentions

- **Inputs**: Current phase 'req', all refs ['foo.req', 'bar.req', 'baz.design']
- **Expected Outputs**: Filtered refs ['foo.req', 'bar.req']
- **Description**: Filters design files when in requirement phase.

### Test 12: should allow all phases for design in @ mentions

- **Inputs**: Current phase 'design', all refs ['foo.req', 'bar.design', 'baz.impl']
- **Expected Outputs**: Filtered refs ['foo.req', 'bar.design']
- **Description**: Allows all phases except impl when in design phase.

### Test 13: should not suggest current document in frontmatter lists

- **Inputs**: Current ref 'foo.req', all refs ['foo.req', 'bar.req']
- **Expected Outputs**: Filtered refs ['bar.req']
- **Description**: Tests filtering in frontmatter depends-on/references.

### Test 14: should avoid circular dependencies in depends-on

- **Inputs**: Current ref 'a.req', all refs ['a.req', 'b.req', 'c.req'], mock cycle with b.req
- **Expected Outputs**: Filtered refs ['c.req']
- **Description**: Prevents suggesting dependencies that would create cycles.

### Test 15: should filter design files for req phase in frontmatter

- **Inputs**: Current phase 'req', all refs ['foo.req', 'bar.design']
- **Expected Outputs**: Filtered refs ['foo.req']
- **Description**: Filters design files in frontmatter for req phase.

### Test 16: should update metadata correctly

- **Inputs**: Spec file with wrong phase and old last-updated
- **Expected Outputs**: Parsed metadata phase 'requirement', lastUpdated updated
- **Description**: Tests SpecFileProcessor metadata update on save.

### Test 17: should convert overspecified references to mentions

- **Inputs**: Content with @foo.req and @bar.design
- **Expected Outputs**: Content includes @foo.req and @bar.design, excludes .md versions
- **Description**: Converts over-specified references to proper @ mentions.

### Test 18: should validate references and return errors

- **Inputs**: Spec file with non-existent depends-on and invalid references
- **Expected Outputs**: Errors array length > 0, includes 'not found' messages
- **Description**: Tests reference validation returning appropriate errors.

### Test 19: should detect self-references as errors

- **Inputs**: Spec file with self in depends-on and references
- **Expected Outputs**: Errors length >= 3, includes 'Cannot depend on itself' and 'Cannot reference itself'
- **Description**: Ensures self-references are detected as validation errors.