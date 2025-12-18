---
agent: agent
description: This prompt is used to define a task with specific requirements, constraints, and success criteria.
model: Grok Code Fast 1 (copilot)
tools: [execute, read, edit, search, web, agent, todo]
---

This prompt is for a VSCode extension called PromptPress. It helps build requirement, design, and implementation documentation for software projects.

Every time this prompt is run, follow these explicit steps:

1. Check the git history to identify what has changed in the project since the last time this prompt was run.
2. Update the README.md file to reflect all changes found in the git history.
3. At the very top of README.md, always include the following meta header:

	```
  # PromptPress

	Last Updated: <current date in YYYY-MM-DD format>
	Last Commit: <short git commit hash of the latest commit>
	```

4. Use the meta header to track:
	- The date when README.md was last updated
	- The commit hash that the README.md reflects

5. Ensure the README.md is always accurate and up-to-date with the latest project changes.
