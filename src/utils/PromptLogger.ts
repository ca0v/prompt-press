import * as fs from 'fs/promises';
import * as path from 'path';

export class PromptLogger {
    constructor(private log: (msg: string) => void) {}

    // promptpress/IMP-1070
    async logRequest(workspaceRoot: string, operation: string, systemPrompt: string, userPrompt: string): Promise<string> {
        if (!systemPrompt.trim() || !userPrompt.trim()) {
            return '';
        }

        try {
            const logsDir = path.join(workspaceRoot, 'logs');
            const requestDir = path.join(logsDir, 'request');
            await fs.mkdir(requestDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const requestFile = path.join(requestDir, `${operation}-${timestamp}.md`);

            const requestContent = `# System Prompt\n\n${systemPrompt}\n\n---\n\n# User Prompt\n\n${userPrompt}`;
            await fs.writeFile(requestFile, requestContent, 'utf-8');

            this.log(`[AI] Logged ${operation} request to ${requestFile}`);
            return timestamp;
        } catch (error: any) {
            this.log(`[AI] Warning: Failed to log ${operation} request: ${error.message}`);
            return '';
        }
    }

    // promptpress/IMP-1071
    async logResponse(workspaceRoot: string, id: string, operation: string, response: string): Promise<void> {
        if (!id || !response.trim()) {
            return;
        }

        try {
            const logsDir = path.join(workspaceRoot, 'logs');
            const responseDir = path.join(logsDir, 'response');
            await fs.mkdir(responseDir, { recursive: true });

            const responseFile = path.join(responseDir, `${operation}-${id}.md`);
            await fs.writeFile(responseFile, response, 'utf-8');

            this.log(`[AI] Logged ${operation} response to ${responseFile}`);
        } catch (error: any) {
            this.log(`[AI] Warning: Failed to log ${operation} response: ${error.message}`);
        }
    }
}