import * as fs from 'fs/promises';
import * as path from 'path';
import { MarkdownParser } from '../parsers/markdownParser';
import { XAIClient } from '../ai/xaiClient';

export interface FileInfo {
    path: string;
    description: string;
}

export class ImplParser {
    constructor(private parser: MarkdownParser, private xaiClient: XAIClient) {}

    async parseAndGenerate(implPath: string): Promise<void> {
        const parsed = await this.parser.parseFile(implPath);
        const fileStructureSection = parsed.sections.get('File Structure');
        if (!fileStructureSection) {
            throw new Error('File Structure section not found in impl.md');
        }
        const codeGenSection = parsed.sections.get('Code Generation Instructions') || '';
        const fileDescriptions = this.parseFileDescriptions(fileStructureSection);
        const instructions = this.parseCodeInstructions(codeGenSection);

        const base = path.dirname(implPath);
        const artifact = parsed.metadata.artifact;
        const designPath = path.join(base, artifact + '.design.md');
        const reqPath = path.join(base, artifact + '.req.md');

        let designContent = '';
        let reqContent = '';
        try {
            designContent = await fs.readFile(designPath, 'utf8');
        } catch (e) {
            // ignore if not found
        }
        try {
            reqContent = await fs.readFile(reqPath, 'utf8');
        } catch (e) {
            // ignore
        }

        // Create output directory, perhaps artifact name
        const outputDir = path.join(base, artifact + '-generated');
        await fs.mkdir(outputDir, { recursive: true });

        const clarifications: string[] = [];

        for (const [filePath, instr] of instructions) {
            const fileName = path.basename(filePath);
            const description = fileDescriptions.get(fileName) || 'No description available';
            const fullFilePath = path.join(outputDir, filePath);
            await fs.mkdir(path.dirname(fullFilePath), { recursive: true });

            const prompt = `Purpose: ${description}

${instr}

Implementation Requirements:
${parsed.content}

Design:
${designContent}

Requirements:
${reqContent}

Instructions: Implement the code for ${filePath} according to the above specifications. If you have any questions or need clarification, include [AI-CLARIFY: your question] in your response.`;

            // First, write the prompt (temporarily)
            await fs.writeFile(fullFilePath, prompt);

            // Now call AI
            try {
                const response = await this.xaiClient.chat([{ role: 'user', content: prompt }], { maxTokens: 8000 });
                
                // Process response: extract clarifications
                const parsedResponse = this.parser.parse(response);
                clarifications.push(...parsedResponse.clarifications);
                
                // The content is the code
                const code = response.replace(/\[AI-CLARIFY:[^\]]+\]/g, '').trim();
                
                // Write the code to the file
                await fs.writeFile(fullFilePath, code);
            } catch (error) {
                console.error(`Failed to generate code for ${filePath}:`, error);
                // Keep the prompt as is
            }
        }

        // If there are clarifications, append to impl.md
        if (clarifications.length > 0) {
            const clarificationText = clarifications.map(c => `[AI-CLARIFY: ${c}]`).join('\n');
            const implContent = await fs.readFile(implPath, 'utf8');
            const updatedContent = implContent + '\n\n' + clarificationText;
            await fs.writeFile(implPath, updatedContent);
        }
    }

    private parseFileDescriptions(section: string): Map<string, string> {
        const descriptions = new Map<string, string>();
        const regex = /- `([^`]+)`: ([^\n]+)/g;
        let match;
        while ((match = regex.exec(section)) !== null) {
            const filePath = match[1];
            const description = match[2];
            // Skip directories (end with /)
            if (!filePath.endsWith('/')) {
                const fileName = path.basename(filePath);
                descriptions.set(fileName, description);
            }
        }
        return descriptions;
    }

    private parseCodeInstructions(section: string): Map<string, string> {
        const instructions = new Map<string, string>();
        const lines = section.split('\n');
        let currentFile = '';
        let currentText = '';
        for (const line of lines) {
            const match = line.match(/^\d+\. In `([^`]+)`: (.+)/);
            if (match) {
                if (currentFile) {
                    instructions.set(currentFile, currentText.trim());
                }
                currentFile = match[1];
                currentText = match[2];
            } else if (currentFile) {
                currentText += '\n' + line;
            }
        }
        if (currentFile) {
            instructions.set(currentFile, currentText.trim());
        }
        return instructions;
    }
}