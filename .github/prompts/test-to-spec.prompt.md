---
name: Test to Spec Converter
agent: agent
description: Convert implemented tests in the codebase to detailed test specification documents.
---

Convert implemented tests in src/test/ to test specification documents in specs/test/.

Purpose: Ensure generated code quality by providing test specs that can be used to verify implementations.

For each test spec:
- List expected inputs and outputs.
- Provide detailed description of the test logic.
- Enable future AI to regenerate the test in any language.

Use precise, terse language.