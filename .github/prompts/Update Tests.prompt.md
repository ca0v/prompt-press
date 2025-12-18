---
agent: agent
description: This prompt is used to define a task with specific requirements, constraints, and success criteria
model: Grok Code Fast 1 (copilot)
tools: [execute, read, edit, search, web, agent, todo]
---

Please follow these explicit steps to update the unit tests:

1. Review the recent changes in the codebase by examining the git commit history.
2. Identify any modifications that require updates to the existing unit tests.
3. Update the unit tests to reflect these changes. Preserve the existing tests as much as possible, modifying them only as necessary to accommodate the code changes.
4. After updating the tests, locate the last git commit hash you used to identify the changes.
5. Add this commit hash as a comment at the top of the file ./prompt-press/src/test/runner.ts in the following format:

	```
	// Last commit hash for test updates: {commit_hash}
	```

6. Use that commit hash as a starting point when observing the git history for future test updates.
7. Ensure that all updated tests pass successfully.

Package.json has several test modules already defined:

- "test:unit": "node ./out/test/runner.js",
- "test:scaffold": "node ./out/test/runner.js scaffold",
- "test:cascade": "node ./out/test/runner.js cascade",
- "test:all": "node ./out/test/runner.js all",
- "test:parser": "node ./out/test/runner.js parser",

If a new test does not fall under any of these categories, create a new test module in package.json with an appropriate name.