import * as fs from 'fs/promises';
import * as path from 'path';
import {__dirname} from '../utils/dirname.js';

export class PromptServiceCore {
    public static readonly PROMPTS_DIR = path.join(__dirname, '../prompts');

    /**
     * Loads the content of a prompt file by name.
     * @param promptName The name of the prompt file without extension (e.g., 'code-to-impl-spec')
     * @returns The full content of the prompt file
     */
    static async loadPrompt(promptName: string): Promise<string> {
        const promptPath = path.join(this.PROMPTS_DIR, `${promptName}.prompt.md`);
        try {
            await fs.access(promptPath);
        } catch {
            throw new Error(`Prompt file not found: ${promptPath}`);
        }
        return fs.readFile(promptPath, 'utf-8');
    }
}