---
agent: agent
---

## Errors and Warnings

This vscode extension should monitor all file changes with the specs folder and report as IDE warnings the following conditions:

- A depends-on element that references a non-existent file.
- A depends-on element that creates a circular dependency.
- A references element that references a non-existent file.
- A mention reference (e.g. @foo.req) that references a non-existent file.
- Any references (depends-on, references, mention) that over-specify the target (e.g. @foo.req[extra]).

The specs folder includes the following file types:

- .req files in the specs/requirements folder: can depend on .req files, can reference .req files.
- .design files in the specs/designs folder: can depend on .req and .design files, can reference .req and .design files.
- .impl files in the specs/implementations folder: can depend on .req, .design, and .impl files, can reference .req, .design, and .impl files.
- the ConOps.md file has no dependencies but can reference .req files.

## Auto Completion

In addition to error and warning reporting, the extension should provide auto-completion suggestions when editing depends-on and references arrays, as well as when typing "@" mentions in the file content.  The suggestions should include all valid files in the workspace that match the expected file types (.req, .design, .impl) as well as the ConOps.md file.

Rules include:

- do not show the current document in suggestions
- do not show files that would create circular dependencies in depends-on suggestions
- do not show *.impl files
- do not show *.design files when editing a .req file
- in ConOps.md, only show .req files

## Unit Testing

You should ensure unit tests remain in place that verify these conditions are correctly reported as IDE warnings.  This includes adding new unit tests if necessary.  All such tests should be invoked using `test:ide` npm script.

Tests should exist to ensure the Auto Completion rules are followed.

For detecting mentions, the core logic can be unit-tested in isolation: parse the file content to identify explicit "@" mentions, and check depends-on/references arrays for implicit mentions, validating against a mocked file system to confirm existence and detect circular dependencies or over-specification. For integration tests it may be necessary to mock the VSCode API to simulate file changes and IDE warning reporting, ensuring the extension behaves as expected in a controlled environment.