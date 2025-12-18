---
agent: agent
---
This vscode extension should monitor file changes and report as IDE warnings the following conditions:

- A depends-on element that references a non-existent file.
- A depends-on element that creates a circular dependency.
- A references element that references a non-existent file.
- A mention reference (e.g. @foo.req) that references a non-existent file.
- Any references (depends-on, references, mention) that over-specify the target (e.g. @foo.req[extra]).

You should ensure unit tests remain in place that verify these conditions are correctly reported as IDE warnings.  This includes adding new unit tests if necessary.  All such tests should be invoked using `test:ide` npm script.

For detecting mentions, the core logic can be unit-tested in isolation: parse the file content to identify explicit "@" mentions, and check depends-on/references arrays for implicit mentions, validating against a mocked file system to confirm existence and detect circular dependencies or over-specification. For integration tests it may be necessary to mock the VSCode API to simulate file changes and IDE warning reporting, ensuring the extension behaves as expected in a controlled environment.