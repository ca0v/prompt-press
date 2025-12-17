import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { MarkdownParser } from '../parsers/markdownParser';
import { XAIClient } from '../ai/xaiClient';

export interface FileInfo {
    path: string;
    description: string;
}

export class ImplParser {
    constructor(private parser: MarkdownParser, private xaiClient: XAIClient, private outputChannel: vscode.OutputChannel) {}

    async parseAndGenerate(implPath: string): Promise<void> {
        this.outputChannel.appendLine(`[ImplParser] Starting code generation for ${implPath}`);
        
        const parsed = await this.parser.parseFile(implPath);
        this.outputChannel.appendLine(`[ImplParser] Parsed metadata: artifact=${parsed.metadata.artifact}, phase=${parsed.metadata.phase}`);
        
        const fileStructureSection = parsed.sections.get('File Structure');
        if (!fileStructureSection) {
            throw new Error('File Structure section not found in impl.md');
        }
        this.outputChannel.appendLine(`[ImplParser] Found File Structure section (${fileStructureSection.length} chars)`);
        
        const codeGenSection = parsed.sections.get('Code Generation Instructions') || '';
        this.outputChannel.appendLine(`[ImplParser] Found Code Generation Instructions section (${codeGenSection.length} chars)`);
        
        const fileDescriptions = this.parseFileDescriptions(fileStructureSection);
        this.outputChannel.appendLine(`[ImplParser] Parsed ${fileDescriptions.size} file descriptions`);
        
        let instructions = this.parseCodeInstructions(codeGenSection);
        this.outputChannel.appendLine(`[ImplParser] Parsed ${instructions.size} code generation instructions`);
        
        // If no code generation instructions, generate basic ones for all files
        if (instructions.size === 0 && fileDescriptions.size > 0) {
            this.outputChannel.appendLine(`[ImplParser] No code generation instructions found, generating basic instructions for all ${fileDescriptions.size} files`);
            instructions = this.generateBasicInstructions(fileDescriptions);
            this.outputChannel.appendLine(`[ImplParser] Generated ${instructions.size} basic instructions`);
        }

        const base = path.dirname(implPath);
        const artifact = parsed.metadata.artifact;
        this.outputChannel.appendLine(`[ImplParser] Base directory: ${base}, Artifact: ${artifact}`);
        
        // Assuming specs structure: specs/{phase}/{artifact}.{phase}.md
        const specsRoot = path.dirname(base); // Go up from implementation/ to specs/
        const designPath = path.join(specsRoot, 'design', artifact + '.design.md');
        const reqPath = path.join(specsRoot, 'requirements', artifact + '.req.md');

        let designContent = '';
        let reqContent = '';
        try {
            designContent = await fs.readFile(designPath, 'utf8');
            this.outputChannel.appendLine(`[ImplParser] Loaded design file: ${designPath}`);
        } catch (e) {
            this.outputChannel.appendLine(`[ImplParser] Design file not found: ${designPath}`);
        }
        try {
            reqContent = await fs.readFile(reqPath, 'utf8');
            this.outputChannel.appendLine(`[ImplParser] Loaded requirements file: ${reqPath}`);
        } catch (e) {
            this.outputChannel.appendLine(`[ImplParser] Requirements file not found: ${reqPath}`);
        }

        // Create output directory, perhaps artifact name
        const outputDir = path.join(base, artifact + '-generated');
        this.outputChannel.appendLine(`[ImplParser] Creating output directory: ${outputDir}`);
        await fs.mkdir(outputDir, { recursive: true });

        const clarifications: string[] = [];

        this.outputChannel.appendLine(`[ImplParser] Starting code generation for ${instructions.size} files...`);
        for (const [filePath, instr] of instructions) {
            this.outputChannel.appendLine(`[ImplParser] Processing file: ${filePath}`);
            
            const fileName = path.basename(filePath);
            const description = fileDescriptions.get(filePath) || fileDescriptions.get(fileName) || 'No description available';
            const fullFilePath = path.join(outputDir, filePath);
            this.outputChannel.appendLine(`[ImplParser] Full output path: ${fullFilePath}`);
            
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
                this.outputChannel.appendLine(`[ImplParser] Calling AI for ${filePath}...`);
                const response = await this.xaiClient.chat([{ role: 'user', content: prompt }], { maxTokens: 8000 });
                this.outputChannel.appendLine(`[ImplParser] AI response received for ${filePath} (${response.length} chars): ${response.substring(0, 200)}${response.length > 200 ? '...' : ''}`);
                
                // Process response: extract clarifications
                const parsedResponse = this.parser.parse(response);
                if (parsedResponse.clarifications.length > 0) {
                    this.outputChannel.appendLine(`[ImplParser] Found ${parsedResponse.clarifications.length} clarifications for ${filePath}`);
                    clarifications.push(...parsedResponse.clarifications);
                }
                
                // The content is the code
                const code = response.replace(/\[AI-CLARIFY:[^\]]+\]/g, '').trim();
                this.outputChannel.appendLine(`[ImplParser] Writing generated code to ${fullFilePath}`);
                
                // Write the code to the file
                await fs.writeFile(fullFilePath, code);
            } catch (error) {
                this.outputChannel.appendLine(`[ERROR] [ImplParser] Failed to generate code for ${filePath}: ${error}`);
                // Keep the prompt as is
            }
        }

        // If there are clarifications, append to impl.md
        if (clarifications.length > 0) {
            this.outputChannel.appendLine(`[ImplParser] Appending ${clarifications.length} clarifications to ${implPath}`);
            const clarificationText = clarifications.map(c => `[AI-CLARIFY: ${c}]`).join('\n');
            const implContent = await fs.readFile(implPath, 'utf8');
            const updatedContent = implContent + '\n\n' + clarificationText;
            await fs.writeFile(implPath, updatedContent);
        } else {
            this.outputChannel.appendLine(`[ImplParser] No clarifications to append`);
        }
        
        this.outputChannel.appendLine(`[ImplParser] Code generation completed for ${artifact}`);
    }

    private parseFileDescriptions(section: string): Map<string, string> {
        const descriptions = new Map<string, string>();
        
        // First, try the original format: - `file`: desc
        const originalRegex = /- `([^`]+)`: ([^\n]+)/g;
        let match;
        let foundOriginal = false;
        while ((match = originalRegex.exec(section)) !== null) {
            const filePath = match[1];
            const description = match[2];
            if (!filePath.endsWith('/')) {
                descriptions.set(filePath, description);
                foundOriginal = true;
            }
        }
        
        if (foundOriginal) {
            return descriptions;
        }
        
        // If no original format, try tree format
        this.outputChannel.appendLine(`[ImplParser] No original format found, trying tree format parsing`);
        const lines = section.split('\n');
        const pathStack: string[] = [];
        
        for (const line of lines) {
            if (!line.trim()) continue;
            
            // Count indentation (spaces before ├── or └── or directory)
            const indentMatch = line.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1].length : 0;
            
            // Adjust stack to current indent level (assuming 4 spaces per level)
            const level = Math.floor(indent / 4);
            while (pathStack.length > level) {
                pathStack.pop();
            }
            
            const trimmed = line.trim();
            
            if (trimmed.endsWith('/') && !trimmed.includes('├──') && !trimmed.includes('└──')) {
                // Directory line like "src/"
                const dirName = trimmed.replace('/', '');
                pathStack.push(dirName);
            } else if (trimmed.includes('├──') || trimmed.includes('└──')) {
                const parts = trimmed.split('          # ');
                if (parts.length === 2) {
                    const filePart = parts[0].replace(/├──|└──/, '').trim();
                    const description = parts[1].trim();
                    
                    if (filePart.endsWith('/')) {
                        // Directory
                        const dirName = filePart.replace('/', '');
                        pathStack.push(dirName);
                    } else {
                        // File
                        const fullPath = [...pathStack, filePart].join('/');
                        descriptions.set(fullPath, description);
                    }
                }
            }
        }
        
        this.outputChannel.appendLine(`[ImplParser] Parsed ${descriptions.size} file descriptions from tree format`);
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

    private generateBasicInstructions(fileDescriptions: Map<string, string>): Map<string, string> {
        const instructions = new Map<string, string>();
        for (const [filePath, description] of fileDescriptions) {
            instructions.set(filePath, `Implement the ${description}`);
        }
        return instructions;
    }
}