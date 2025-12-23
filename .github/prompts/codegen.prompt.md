---
agent: agent
---

# Code Generation Policy

This prompt will generate code. Follow this policy for consistent outcomes:

1. Run generated code through "npm run lint". Retry on errors or warnings.

2. Generate helper commands for testing if needed.

3. After lint passes and all tests pass, create a test for the new functionality.

4. Classify the test as:
   - parser: markup/code processing
   - core: low-level utilities (strings, math, filesystem)

5. Output full console to output window.
