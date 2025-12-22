---
name: Convert Prompts to Commands
agent: agent
description: This prompt automates the process of creating VS Code commands from prompt files in the .github/prompts directory. For each prompt file that lacks a corresponding command, it adds the command to package.json, registers it in extension.ts, and implements the necessary service methods to load and execute the prompt in the VS Code chat interface.
---
This prompt performs the following tasks to ensure that every prompt file in the .github/prompts directory has a corresponding VS Code command in the PromptPress extension:

- **Scan the .github/prompts directory**: Identify all files ending with .prompt.md.

- **Check for existing commands**: For each prompt file, verify if a matching command already exists in package.json under contributes/commands. The command name should match the lowerCamelCase version of the prompt's name (from the YAML front matter).

- **Create new commands if needed**: If no matching command exists, add a new command entry to package.json with the following properties derived from the prompt's YAML front matter:
   - `command`: The lowerCamelCase version of the `name` field.
   - `title`: The value of the `name` field.
   - `description`: The value of the `description` field.

- **Copy to ./prompts**: copy the file from .github/prompts to src/prompts to enable proper loading.  Overwrite if it already exists.

- **Register the command in extension.ts**: Modify extension.ts to register the new command if it is not already registered.

- **Implement prompt loading in promptServiceCore.ts**: Add or modify a method in promptServiceCore.ts that loads the content of the corresponding prompt file from the src/prompts directory (where it was copied to enable proper loading in the deployed extension).

- **Implement command execution in promptService.ts**: Add or modify promptService.ts to implement the command execution logic:
   - It calls the loading method from promptServiceCore.ts to get the prompt content.
   - It copies the prompt file to the user's .github/prompts folder if it does not already exist there, allowing the user to modify it and run it from the chat interface.
   - It opens the VS Code chat interface ('workbench.action.chat.open') with the loaded prompt.

This process ensures that each prompt can be invoked as a VS Code command, providing a seamless way to run prompts within the extension.



