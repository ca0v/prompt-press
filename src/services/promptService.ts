import * as vscode from 'vscode';
import { PromptServiceCore } from './promptServiceCore.js';

export class PromptService {
    /**
     * Executes a prompt by loading it and sending it to the VS Code chat interface.
     * @param promptName The name of the prompt file without extension
     */
    async executePrompt(promptName: string): Promise<void> {
        const promptContent = await PromptServiceCore.loadPrompt(promptName);
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: promptContent });
    }
}