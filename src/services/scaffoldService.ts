import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { XAIClient, ChatMessage } from '../ai/xaiClient';

type ReferencedArtifact = {
    name: string;
    requirement?: string;
    design?: string;
};

export class ScaffoldService {
    constructor(
        private aiClient: XAIClient,
        private outputChannel: vscode.OutputChannel
    ) {}

    /**
     * Extract mentioned artifacts in the form @artifact-name
     */
    private parseMentions(text: string): string[] {
        const mentions = new Set<string>();
        const regex = /@([a-z0-9-]+)/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
            mentions.add(match[1]);
        }
        return Array.from(mentions);
    }

    /**
     * Load referenced artifact specs (requirement/design/implementation) if present.
     * Silently skips artifacts that do not exist.
     */
    private async loadReferencedArtifacts(
        workspaceRoot: string,
        artifactNames: string[],
        phaseContext: 'requirement' | 'design'
    ): Promise<ReferencedArtifact[]> {
        const results: ReferencedArtifact[] = [];

        for (const name of artifactNames) {
            const ref: ReferencedArtifact = { name };

            const reqPath = path.join(workspaceRoot, 'specs', 'requirements', `${name}.req.md`);
            const designPath = path.join(workspaceRoot, 'specs', 'design', `${name}.design.md`);

            try {
                ref.requirement = await fs.readFile(reqPath, 'utf-8');
            } catch { /* ignore */ }

            if (phaseContext === 'design') {
                try {
                    ref.design = await fs.readFile(designPath, 'utf-8');
                } catch { /* ignore */ }
            }

            if (ref.requirement || ref.design) {
                results.push(ref);
            }
        }

        return results;
    }

    /**
     * Format referenced artifacts into a concise context block for the AI.
     */
    private formatReferencedArtifacts(references: ReferencedArtifact[]): string {
        const limit = 15000;
        return references.map(ref => {
            const parts: string[] = [`Artifact: ${ref.name}`];
            if (ref.requirement) {
                parts.push(`Requirement (${ref.name}.req):\n${ref.requirement.slice(0, limit)}${ref.requirement.length > limit ? '... [truncated]' : ''}`);
            }
            if (ref.design) {
                parts.push(`Design (${ref.name}.design):\n${ref.design.slice(0, limit)}${ref.design.length > limit ? '... [truncated]' : ''}`);
            }
            return parts.join('\n\n');
        }).join('\n\n---\n\n');
    }

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

        // Step 4: Collect referenced artifacts mentioned via @artifact-name
        const mentionedArtifacts = this.parseMentions(description);
        let referencedArtifacts: ReferencedArtifact[] = [];
        if (mentionedArtifacts.length > 0) {
            referencedArtifacts = await this.loadReferencedArtifacts(workspaceRoot, mentionedArtifacts, 'requirement');
        }

        // Step 5: Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Scaffolding ${artifactName}...`,
            cancellable: false
        }, async (progress) => {
            try {
                // Generate requirement spec
                progress.report({ message: 'Generating requirements...', increment: 25 });
                this.outputChannel.appendLine(`[Scaffold] Generating requirement spec for: ${artifactName}`);
                const requirementSpec = await this.generateRequirement(artifactName, contextDescription, referencedArtifacts);
                this.outputChannel.appendLine(`[Scaffold] Requirement spec generated (${requirementSpec.length} chars)`);

                // Generate design spec
                progress.report({ message: 'Generating design...', increment: 25 });
                this.outputChannel.appendLine(`[Scaffold] Generating design spec for: ${artifactName}`);
                const designRefArtifacts = mentionedArtifacts.length > 0
                    ? await this.loadReferencedArtifacts(workspaceRoot, mentionedArtifacts, 'design')
                    : [];

                const designSpec = await this.generateDesign(artifactName, contextDescription, requirementSpec, designRefArtifacts);
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
    private async generateRequirement(
        artifactName: string,
        description: string,
        referencedArtifacts: ReferencedArtifact[]
    ): Promise<string> {
        this.outputChannel.appendLine(`[Scaffold] Generating requirement for artifact: ${artifactName}`);
        this.outputChannel.appendLine(`[Scaffold] Description length: ${description.length} chars`);

        const referenceTags = referencedArtifacts.flatMap(ref => {
            const tags: string[] = [];
            if (ref.requirement) { tags.push(`@ref:${ref.name}.req`); }
            if (ref.design) { tags.push(`@ref:${ref.name}.design`); }
            return tags;
        });

        const referenceBlock = referencedArtifacts.length > 0
            ? `\n\nReferenced artifacts (context):\n${this.formatReferencedArtifacts(referencedArtifacts)}`
            : '';
        
        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: `You are an expert at writing formal software requirements. Generate a PromptPress requirement specification following this exact structure:

---
artifact: ${artifactName}
phase: requirement
depends-on: []
references: [${referenceTags.join(', ')}]
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
                content: `Generate a requirement specification for:\n\n${description}${referenceBlock}`
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
        requirementSpec: string,
        referencedArtifacts: ReferencedArtifact[]
    ): Promise<string> {
        this.outputChannel.appendLine(`[Scaffold] Generating design for artifact: ${artifactName}`);
        this.outputChannel.appendLine(`[Scaffold] Requirement spec length: ${requirementSpec.length} chars`);

        const referenceTags = [
            `@ref:${artifactName}.req`,
            ...referencedArtifacts.flatMap(ref => {
                const tags: string[] = [];
                if (ref.requirement) { tags.push(`@ref:${ref.name}.req`); }
                if (ref.design) { tags.push(`@ref:${ref.name}.design`); }
                return tags;
            })
        ];

        const referenceBlock = referencedArtifacts.length > 0
            ? `\n\nReferenced artifacts (context):\n${this.formatReferencedArtifacts(referencedArtifacts)}`
            : '';
        
        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: `You are an expert software architect. Generate a PromptPress design specification following this exact structure:

---
artifact: ${artifactName}
phase: design
depends-on: []
references: [${referenceTags.join(', ')}]
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
                content: `Generate a design specification for:\n\n${description}${referenceBlock}\n\nBased on these requirements:\n\n${requirementSpec}`
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
     * Generate implementation spec from existing requirement and design specs
     */
    public async generateImplementationSpec(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Get active editor or prompt for artifact name
        const editor = vscode.window.activeTextEditor;
        let artifactName: string | undefined;

        if (editor) {
            const filePath = editor.document.uri.fsPath;
            const match = filePath.match(/([a-z0-9-]+)\.(req|design)\.md$/);
            if (match) {
                artifactName = match[1];
            }
        }

        if (!artifactName) {
            artifactName = await vscode.window.showInputBox({
                prompt: 'Enter artifact name (e.g., user-authentication)',
                placeHolder: 'artifact-name',
                validateInput: (value) => {
                    if (!value.match(/^[a-z0-9-]+$/)) {
                        return 'Use lowercase letters, numbers, and hyphens only';
                    }
                    return null;
                }
            });

            if (!artifactName) {
                return;
            }
        }

        const reqDir = path.join(workspaceRoot, 'specs', 'requirements');
        const designDir = path.join(workspaceRoot, 'specs', 'design');
        const implDir = path.join(workspaceRoot, 'specs', 'implementation');

        const reqPath = path.join(reqDir, `${artifactName}.req.md`);
        const designPath = path.join(designDir, `${artifactName}.design.md`);
        const implPath = path.join(implDir, `${artifactName}.impl.md`);

        // Check if requirement and design exist
        try {
            await fs.access(reqPath);
            await fs.access(designPath);
        } catch {
            vscode.window.showErrorMessage(
                `Missing requirement or design spec for ${artifactName}. Both ${artifactName}.req.md and ${artifactName}.design.md must exist.`
            );
            return;
        }

        // Check if implementation already exists
        try {
            await fs.access(implPath);
            const response = await vscode.window.showWarningMessage(
                `Implementation spec ${artifactName}.impl.md already exists. Overwrite?`,
                'Yes',
                'No'
            );
            if (response !== 'Yes') {
                return;
            }
        } catch {
            // Implementation doesn't exist, good to proceed
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Generating implementation for ${artifactName}...`,
                cancellable: false
            },
            async (progress) => {
                try {
                    this.outputChannel.appendLine(`[Generate] Reading requirement and design specs...`);
                    const requirementContent = await fs.readFile(reqPath, 'utf-8');
                    const designContent = await fs.readFile(designPath, 'utf-8');

                    this.outputChannel.appendLine(`[Generate] Generating implementation spec with AI...`);
                    const implSpec = await this.generateImplementation(
                        artifactName,
                        requirementContent,
                        designContent
                    );

                    await fs.mkdir(implDir, { recursive: true });
                    await fs.writeFile(implPath, implSpec, 'utf-8');

                    this.outputChannel.appendLine(`[Generate] ✅ Implementation spec created: ${implPath}`);
                    vscode.window.showInformationMessage(
                        `✅ Implementation spec generated: ${artifactName}.impl.md`
                    );

                    // Open the generated file
                    const doc = await vscode.workspace.openTextDocument(implPath);
                    await vscode.window.showTextDocument(doc);

                } catch (error: any) {
                    this.outputChannel.appendLine(`[ERROR] Implementation generation failed: ${error.message}`);
                    this.outputChannel.show();
                    vscode.window.showErrorMessage(`Failed to generate implementation: ${error.message}`);
                }
            }
        );
    }

    /**
     * Generate implementation specification using AI
     */
    private async generateImplementation(
        artifactName: string,
        requirementSpec: string,
        designSpec: string
    ): Promise<string> {
        this.outputChannel.appendLine(`[Generate] Generating implementation for artifact: ${artifactName}`);

        const artifactTitle = artifactName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        const messages: ChatMessage[] = [
            {
                role: 'system',
                content: `You are an expert software engineer. Generate a PromptPress implementation specification following this exact structure:

---
artifact: ${artifactName}
phase: implementation
depends-on: []
references: [@ref:${artifactName}.req, @ref:${artifactName}.design]
version: 1.0.0
last-updated: ${new Date().toISOString().split('T')[0]}
---

# ${artifactTitle} - Implementation

## Overview
[High-level implementation summary]

## File Structure
\`\`\`
artifact-name/
├── src/
│   ├── index.ts
│   └── ...
└── tests/
    └── ...
\`\`\`

## Modules & Components
### Module 1
- Purpose: [What it does]
- Exports: [Public API]
- Dependencies: [What it uses]

## Implementation Details
### Component/Function 1
- Signature: \`function name(params): returnType\`
- Logic: [Step-by-step algorithm]
- Edge cases: [Error handling, validation]

## Data Structures
\`\`\`typescript
interface Example {
    // ...
}
\`\`\`

## Test Scenarios
- Test 1: [What to test, expected behavior]
- Test 2: [Edge case testing]

## Dependencies
- package1: [Why needed]
- package2: [Purpose]

## Configuration
[Environment variables, config files, setup]

## Deployment Notes
[Build process, deployment steps]

## Cross-References
- @ref:${artifactName}.req - Requirements
- @ref:${artifactName}.design - Design

## AI Interaction Log
<!-- Auto-maintained by PromptPress extension -->

Generate a complete, precise implementation specification. Include exact function signatures, detailed logic, and comprehensive test scenarios.`
            },
            {
                role: 'user',
                content: `Generate an implementation specification based on:

**Requirements:**
${requirementSpec}

**Design:**
${designSpec}`
            }
        ];

        this.outputChannel.appendLine(`[Generate] Sending ${messages.length} messages to AI`);
        
        try {
            const result = await this.aiClient.chat(messages);
            this.outputChannel.appendLine(`[Generate] Implementation generation successful`);
            return result;
        } catch (error: any) {
            this.outputChannel.appendLine(`[ERROR] Implementation generation failed: ${error.message}`);
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
    private async setupConfigurationFiles(workspaceRoot: string): Promise<void> {
        // Update .gitignore to exclude .baseline files
        const gitignorePath = path.join(workspaceRoot, '.gitignore');
        const baselineIgnorePattern = '*.baseline';
        
        try {
            const existingGitignore = await fs.readFile(gitignorePath, 'utf-8');
            // Only add if not already present
            if (!existingGitignore.includes(baselineIgnorePattern)) {
                const updatedGitignore = existingGitignore.trimEnd() + `\n\n# PromptPress cache files\n${baselineIgnorePattern}\n.promptpress/\n`;
                await fs.writeFile(gitignorePath, updatedGitignore, 'utf-8');
                this.outputChannel.appendLine('[Scaffold] Updated .gitignore to exclude .baseline files');
            }
        } catch {
            // .gitignore doesn't exist, create it
            const gitignoreContent = `# PromptPress cache files\n${baselineIgnorePattern}\n.promptpress/\n`;
            await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8');
            this.outputChannel.appendLine('[Scaffold] Created .gitignore to exclude .baseline files');
        }

        // Update VS Code settings to exclude .baseline from search
        const vscodeDir = path.join(workspaceRoot, '.vscode');
        const settingsPath = path.join(vscodeDir, 'settings.json');

        try {
            await fs.mkdir(vscodeDir, { recursive: true });
            let settings: any = {};
            
            try {
                const existingSettings = await fs.readFile(settingsPath, 'utf-8');
                settings = JSON.parse(existingSettings);
            } catch {
                // File doesn't exist or is invalid JSON, start fresh
            }

            // Add search exclude pattern for .baseline files if not present
            if (!settings['search.exclude']) {
                settings['search.exclude'] = {};
            }
            if (!settings['search.exclude']['**/*.baseline']) {
                settings['search.exclude']['**/*.baseline'] = true;
                settings['search.exclude']['.promptpress/**'] = true;
                settings['search.exclude']['templates/**'] = true;
                await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
                this.outputChannel.appendLine('[Scaffold] Updated VS Code settings to exclude .baseline and templates from search');
            }
        } catch (error) {
            this.outputChannel.appendLine(`[Scaffold] Warning: Could not update VS Code settings: ${error}`);
        }
    }

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

        // Set up configuration files (.gitignore, VS Code settings)
        await this.setupConfigurationFiles(workspaceRoot);

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
