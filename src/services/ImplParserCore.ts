import * as fs from 'fs/promises';
import * as path from 'path';
import { MarkdownParser } from '../parsers/markdownParser.js';
import { XAIClient } from '../ai/xaiClient.js';
import { FileStructureParser } from './FileStructureParser.js';
import { Logger } from './FileStructureParserCore.js';

export interface FileInfo {
    path: string;
    description: string;
}

export class ImplParserCore {
    constructor(private parser: MarkdownParser, private xaiClient: XAIClient, private logger: Logger, private fileStructureParser: FileStructureParser) {}

    // promptpress/IMP-1050
    async parseAndGenerate(implPath: string): Promise<void> {
        this.logger.log(`[ImplParser] Starting code generation for ${implPath}`);
        
        const parsed = await this.parser.parseFile(implPath);
        this.logger.log(`[ImplParser] Parsed metadata: artifact=${parsed.metadata.artifact}, phase=${parsed.metadata.phase}`);
        
        const fileStructureSection = parsed.sections.get('File Structure');
        if (!fileStructureSection) {
            throw new Error('File Structure section not found in impl.md');
        }
        this.logger.log(`[ImplParser] Found File Structure section (${fileStructureSection.length} chars)`);
        
        const codeGenSection = parsed.sections.get('Code Generation Instructions') || '';
        this.logger.log(`[ImplParser] Found Code Generation Instructions section (${codeGenSection.length} chars)`);
        
        const fileDescriptions = this.fileStructureParser.parseFileDescriptions(fileStructureSection);
        this.logger.log(`[ImplParser] Parsed ${fileDescriptions.size} file descriptions`);
        
        let instructions = this.parseCodeInstructions(codeGenSection);
        this.logger.log(`[ImplParser] Parsed ${instructions.size} code generation instructions`);
        
        // If no code generation instructions, generate basic ones for all files
        if (instructions.size === 0 && fileDescriptions.size > 0) {
            this.logger.log(`[ImplParser] No code generation instructions found, generating basic instructions for all ${fileDescriptions.size} files`);
            instructions = this.generateBasicInstructions(fileDescriptions);
            this.logger.log(`[ImplParser] Generated ${instructions.size} basic instructions`);
        }

        const base = path.dirname(implPath);
        const artifact = parsed.metadata.artifact;
        this.logger.log(`[ImplParser] Base directory: ${base}, Artifact: ${artifact}`);
        
        // Assuming specs structure: specs/{phase}/{artifact}.{phase}.md
        const specsRoot = path.dirname(base); // Go up from implementation/ to specs/
        const designPath = path.join(specsRoot, 'design', artifact + '.design.md');
        const reqPath = path.join(specsRoot, 'requirements', artifact + '.req.md');

        let designContent = '';
        let reqContent = '';
        try {
            designContent = await fs.readFile(designPath, 'utf8');
            this.logger.log(`[ImplParser] Loaded design file: ${designPath}`);
        } catch (e) {
            this.logger.log(`[ImplParser] Design file not found: ${designPath}`);
        }
        try {
            reqContent = await fs.readFile(reqPath, 'utf8');
            this.logger.log(`[ImplParser] Loaded requirements file: ${reqPath}`);
        } catch (e) {
            this.logger.log(`[ImplParser] Requirements file not found: ${reqPath}`);
        }

        // Create output directory, perhaps artifact name
        const outputDir = path.join(base, artifact + '-generated');
        this.logger.log(`[ImplParser] Creating output directory: ${outputDir}`);
        await fs.mkdir(outputDir, { recursive: true });

        const clarifications: string[] = [];

        this.logger.log(`[ImplParser] Starting code generation for ${instructions.size} files...`);
        for (const [filePath, instr] of instructions) {
            this.logger.log(`[ImplParser] Processing file: ${filePath}`);
            
            const fileName = path.basename(filePath);
            const description = fileDescriptions.get(filePath) || fileDescriptions.get(fileName) || 'No description available';
            const fullFilePath = path.join(outputDir, filePath);
            this.logger.log(`[ImplParser] Full output path: ${fullFilePath}`);
            
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
                this.logger.log(`[ImplParser] Calling AI for ${filePath}...`);
                const response = await this.xaiClient.chat([{ role: 'user', content: prompt }], { maxTokens: 8000 });
                this.logger.log(`[ImplParser] AI response received for ${filePath} (${response.length} chars): ${response.substring(0, 200)}${response.length > 200 ? '...' : ''}`);
                
                // Process response: extract clarifications
                const parsedResponse = this.parser.parse(response);
                if (parsedResponse.clarifications.length > 0) {
                    this.logger.log(`[ImplParser] Found ${parsedResponse.clarifications.length} clarifications for ${filePath}`);
                    clarifications.push(...parsedResponse.clarifications);
                }
                
                // The content is the code
                const code = response.replace(/\[AI-CLARIFY:[^\]]+\]/g, '').trim();
                this.logger.log(`[ImplParser] Writing generated code to ${fullFilePath}`);
                
                // Write the code to the file
                await fs.writeFile(fullFilePath, code);
            } catch (error) {
                this.logger.log(`[ERROR] [ImplParser] Failed to generate code for ${filePath}: ${error}`);
                // Keep the prompt as is
            }
        }

        // If there are clarifications, append to impl.md
        if (clarifications.length > 0) {
            this.logger.log(`[ImplParser] Appending ${clarifications.length} clarifications to ${implPath}`);
            const clarificationText = clarifications.map(c => `[AI-CLARIFY: ${c}]`).join('\n');
            const implContent = await fs.readFile(implPath, 'utf8');
            const updatedContent = implContent + '\n\n' + clarificationText;
            await fs.writeFile(implPath, updatedContent);
        } else {
            this.logger.log(`[ImplParser] No clarifications to append`);
        }
        
        this.logger.log(`[ImplParser] Code generation completed for ${artifact}`);
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