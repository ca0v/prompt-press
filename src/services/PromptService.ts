import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PromptServiceCore } from './PromptServiceCore.js';

export class PromptService {
    /**
     * Executes a prompt by loading it and sending it to the VS Code chat interface.
     * @param promptName The name of the prompt file without extension
     */
    // PromptPress/IMP-1051
    async executePrompt(promptName: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const userPromptsDir = path.join(workspaceFolder.uri.fsPath, '.github', 'prompts');
        await fs.mkdir(userPromptsDir, { recursive: true });

        const userPromptPath = path.join(userPromptsDir, `${promptName}.prompt.md`);
        try {
            await fs.access(userPromptPath);
        } catch {
            // Copy the prompt file to the user's .github/prompts folder if it doesn't exist
            const extPromptPath = path.join(PromptServiceCore.PROMPTS_DIR, `${promptName}.prompt.md`);
            await fs.copyFile(extPromptPath, userPromptPath);
        }

        const promptContent = await PromptServiceCore.loadPrompt(promptName);
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: promptContent });
    }
}