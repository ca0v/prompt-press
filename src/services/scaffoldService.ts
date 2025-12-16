import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { XAIClient, ChatMessage } from '../ai/xaiClient';

export class ScaffoldService {
    constructor(
        private aiClient: XAIClient,
        private outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Scaffold a new PromptPress artifact
     */
    public async scaffoldArtifact(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Step 1: Get artifact name
        const artifactName = await vscode.window.showInputBox({
            prompt: 'Artifact name (kebab-case)',
            placeHolder: 'my-feature',
            validateInput: (value) => {
                if (!value) {
                    return 'Artifact name is required';
                }
                if (!/^[a-z0-9-]+$/.test(value)) {
                    return 'Use kebab-case (lowercase letters, numbers, hyphens only)';
                }
                return null;
            }
        });

        if (!artifactName) {
            return;
        }

        // Step 2: Get description
        const description = await vscode.window.showInputBox({
            prompt: 'High-level description (or "see README.md" to use workspace README)',
            placeHolder: 'A feature that does X, Y, and Z...',
            validateInput: (value) => {
                if (!value) {
                    return 'Description is required';
                }
                return null;
            }
        });

        if (!description) {
            return;
        }

        // Step 3: Check if we need to read README
        let contextDescription = description;
        if (description.toLowerCase().includes('readme')) {
            const readmePath = path.join(workspaceRoot, 'README.md');
            try {
                const readmeContent = await fs.readFile(readmePath, 'utf-8');
                contextDescription = `Project Context from README:\n\n${readmeContent}\n\nArtifact: ${artifactName}`;
            } catch (error) {
                vscode.window.showWarningMessage('Could not read README.md, using description as-is');
            }
        }

        // Step 4: Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Scaffolding ${artifactName}...`,
            cancellable: false
        }, async (progress) => {
            try {
                // Generate requirement spec
                progress.report({ message: 'Generating requirements...', increment: 25 });
                this.outputChannel.appendLine(`[Scaffold] Generating requirement spec for: ${artifactName}`);
                const requirementSpec = await this.generateRequirement(artifactName, contextDescription);
                this.outputChannel.appendLine(`[Scaffold] Requirement spec generated (${requirementSpec.length} chars)`);

                // Generate design spec
                progress.report({ message: 'Generating design...', increment: 25 });
                this.outputChannel.appendLine(`[Scaffold] Generating design spec for: ${artifactName}`);
                const designSpec = await this.generateDesign(artifactName, contextDescription, requirementSpec);
                this.outputChannel.appendLine(`[Scaffold] Design spec generated (${designSpec.length} chars)`);

                // Create files
                progress.report({ message: 'Creating files...', increment: 25 });
                this.outputChannel.appendLine(`[Scaffold] Creating spec files in workspace`);
                await this.createSpecFiles(workspaceRoot, artifactName, requirementSpec, designSpec);

                progress.report({ message: 'Complete!', increment: 25 });

                // Open the requirement file
                const reqPath = path.join(workspaceRoot, 'specs', 'requirements', `${artifactName}.req.md`);
                const doc = await vscode.workspace.openTextDocument(reqPath);
                await vscode.window.showTextDocument(doc);

                vscode.window.showInformationMessage(
                    `✅ Scaffolded ${artifactName}! Review and refine the specs.`
                );

            } catch (error: any) {
                this.outputChannel.appendLine(`[ERROR] Failed to scaffold artifact: ${artifactName}`);
                this.outputChannel.appendLine(`[ERROR] Error message: ${error.message}`);
                this.outputChannel.appendLine(`[ERROR] Stack trace: ${error.stack}`);
                this.outputChannel.show(); // Show the output panel
                
                vscode.window.showErrorMessage(
                    `Failed to scaffold: ${error.message}\n\nCheck Output panel (View → Output → PromptPress) for details.`,
                    'Show Output'
                ).then(selection => {
                    if (selection === 'Show Output') {
                        this.outputChannel.show();
                    }
                });
            }
        });
    }

    /**
     * Generate requirement specification using AI
     */
    private async generateRequirement(artifactName: string, description: string): Promise<string> {
        this.outputChannel.appendLine(`[Scaffold] Generating requirement for artifact: ${artifactName}`);
        this.outputChannel.appendLine(`[Scaffold] Description length: ${description.length} chars`);
        
        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: `You are an expert at writing formal software requirements. Generate a PromptPress requirement specification following this exact structure:

---
artifact: ${artifactName}
phase: requirement
depends-on: []
references: []
version: 1.0.0
last-updated: ${new Date().toISOString().split('T')[0]}
---

# [Title] - Requirements

## Overview
[High-level description]

## Functional Requirements
- FR-1: [Requirement]
- FR-2: [Requirement]
...

## Non-Functional Requirements
- NFR-1: [Performance, security, scalability, etc.]
...

## Questions & Clarifications
[AI-CLARIFY: Any ambiguities that need clarification?]

## Cross-References
[Any dependencies or related artifacts]

## AI Interaction Log
<!-- Auto-maintained by PromptPress extension -->

Generate a complete, well-structured requirement specification. Be specific and thorough.`
            },
            {
                role: 'user',
                content: `Generate a requirement specification for:\n\n${description}`
            }
        ];

        this.outputChannel.appendLine(`[Scaffold] Sending ${messages.length} messages to AI for requirement generation`);
        
        try {
            const result = await this.aiClient.chat(messages);
            this.outputChannel.appendLine(`[Scaffold] Requirement generation successful`);
            return result;
        } catch (error: any) {
            this.outputChannel.appendLine(`[ERROR] Requirement generation failed: ${error.message}`);
            this.outputChannel.show();
            throw error;
        }
    }

    /**
     * Generate design specification using AI
     */
    private async generateDesign(
        artifactName: string,
        description: string,
        requirementSpec: string
    ): Promise<string> {
        this.outputChannel.appendLine(`[Scaffold] Generating design for artifact: ${artifactName}`);
        this.outputChannel.appendLine(`[Scaffold] Requirement spec length: ${requirementSpec.length} chars`);
        
        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: `You are an expert software architect. Generate a PromptPress design specification following this exact structure:

---
artifact: ${artifactName}
phase: design
depends-on: []
references: [@ref:${artifactName}.req]
version: 1.0.0
last-updated: ${new Date().toISOString().split('T')[0]}
---

# [Title] - Design

## Overview
[High-level design approach]

## Architecture
[System components, modules, layers]

## API Contracts
[Interfaces, function signatures, data structures]

## Data Model
[Database schema, data structures, relationships]

## Algorithms & Logic
[Key algorithms, decision flows, business logic]

## Dependencies
[Third-party libraries, external services]

## Questions & Clarifications
[AI-CLARIFY: Design decisions that need input?]

## Cross-References
- @ref:${artifactName}.req - Requirements

## AI Interaction Log
<!-- Auto-maintained by PromptPress extension -->

Generate a complete, detailed design specification. Be precise about architecture and APIs.`
            },
            {
                role: 'user',
                content: `Generate a design specification for:\n\n${description}\n\nBased on these requirements:\n\n${requirementSpec}`
            }
        ];

        this.outputChannel.appendLine(`[Scaffold] Sending ${messages.length} messages to AI for design generation`);
        
        try {
            const result = await this.aiClient.chat(messages);
            this.outputChannel.appendLine(`[Scaffold] Design generation successful`);
            return result;
        } catch (error: any) {
            this.outputChannel.appendLine(`[ERROR] Design generation failed: ${error.message}`);
            this.outputChannel.show();
            throw error;
        }
    }

    /**
     * Create spec files in workspace
     */
    private async createSpecFiles(
        workspaceRoot: string,
        artifactName: string,
        requirementSpec: string,
        designSpec: string
    ): Promise<void> {
        // Ensure directories exist
        const reqDir = path.join(workspaceRoot, 'specs', 'requirements');
        const designDir = path.join(workspaceRoot, 'specs', 'design');

        await fs.mkdir(reqDir, { recursive: true });
        await fs.mkdir(designDir, { recursive: true });

        // Write files
        const reqPath = path.join(reqDir, `${artifactName}.req.md`);
        const designPath = path.join(designDir, `${artifactName}.design.md`);

        await fs.writeFile(reqPath, requirementSpec, 'utf-8');
        await fs.writeFile(designPath, designSpec, 'utf-8');
    }

    /**
     * Scaffold entire project structure
     */
    public async scaffoldProject(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Check if already has PromptPress structure
        const specsDir = path.join(workspaceRoot, 'specs');
        try {
            await fs.access(specsDir);
            const response = await vscode.window.showWarningMessage(
                'This workspace already has a specs/ directory. Continue anyway?',
                'Yes',
                'No'
            );
            if (response !== 'Yes') {
                return;
            }
        } catch {
            // Directory doesn't exist, good to go
        }

        // Create directory structure
        const dirs = [
            'specs/requirements',
            'specs/design',
            'specs/implementation',
            'artifacts',
            'templates',
            'tools/generators',
            'tools/validators',
            'tools/utilities',
            'docs'
        ];

        for (const dir of dirs) {
            await fs.mkdir(path.join(workspaceRoot, dir), { recursive: true });
        }

        // Copy templates if they don't exist
        const templateSource = path.join(__dirname, '../../templates');
        const templateDest = path.join(workspaceRoot, 'templates');

        try {
            // Check if we have templates in extension
            const templates = ['requirement.template.md', 'design.template.md', 'implementation.template.md'];
            for (const template of templates) {
                const destPath = path.join(templateDest, template);
                try {
                    await fs.access(destPath);
                } catch {
                    // Template doesn't exist, create basic one
                    await this.createBasicTemplate(destPath, template);
                }
            }
        } catch (error) {
            console.warn('Could not copy templates:', error);
        }

        vscode.window.showInformationMessage(
            '✅ PromptPress project structure created! Use "Scaffold Artifact" to create your first spec.'
        );
    }

    /**
     * Create a basic template file
     */
    private async createBasicTemplate(filePath: string, templateName: string): Promise<void> {
        const phase = templateName.replace('.template.md', '').replace('requirement', 'requirement');
        const content = `---
artifact: <artifact-name>
phase: ${phase === 'requirement' ? 'requirement' : phase}
depends-on: []
references: []
version: 1.0.0
last-updated: YYYY-MM-DD
---

# [Artifact Name] - ${phase.charAt(0).toUpperCase() + phase.slice(1)}

## Overview
[Description]

## [Phase-Specific Sections]
[Content]

## Questions & Clarifications
[AI-CLARIFY: Questions?]

## Cross-References
[References to other specs]

## AI Interaction Log
<!-- Auto-maintained by PromptPress extension -->
`;

        await fs.writeFile(filePath, content, 'utf-8');
    }
}
