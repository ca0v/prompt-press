import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import {__dirname} from '../utils/dirname.js';

export class PromptService {
    public static readonly PROMPTS_DIR = path.join(__dirname, '../prompts');

    /**
     * Executes a prompt by loading it and sending it to the VS Code chat interface.
     * @param promptName The name of the prompt file without extension
     */
    // promptpress/IMP-1051
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
            const extPromptPath = path.join(PromptService.PROMPTS_DIR, `${promptName}.prompt.md`);
            await fs.copyFile(extPromptPath, userPromptPath);
        }

        const promptContent = await PromptService.loadPrompt(promptName);
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: promptContent });
    }

    /**
     * Loads the content of a prompt file by name.
     * @param promptName The name of the prompt file without extension (e.g., 'code-to-impl-spec')
     * @returns The full content of the prompt file
     */
    // promptpress/IMP-1052
    static async loadPrompt(promptName: string): Promise<string> {
        const promptPath = path.join(PromptService.PROMPTS_DIR, `${promptName}.prompt.md`);
        try {
            await fs.access(promptPath);
        } catch {
            throw new Error(`Prompt file not found: ${promptPath}`);
        }
        return fs.readFile(promptPath, 'utf-8');
    }
}