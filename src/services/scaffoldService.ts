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
    private promptCache: Map<string, { system: string; user: string }> = new Map();
    private outputChannel: vscode.OutputChannel;
    private aiClient: XAIClient;

    constructor(aiClient: XAIClient, outputChannel: vscode.OutputChannel) {
        this.aiClient = aiClient;
        this.outputChannel = outputChannel;
    }

    /**
     * Load prompt templates from markdown files (system/user split by ---\n\n# User Prompt:)
     */
    private async loadPrompt(promptKey: string): Promise<{ system: string; user: string }> {
        if (this.promptCache.has(promptKey)) {
            return this.promptCache.get(promptKey)!;
        }
        const promptFile = path.join(__dirname, '../prompts', promptKey);
        try {
            const content = await fs.readFile(promptFile, 'utf-8');
            const parts = content.split('---\n\n# User Prompt:');
            if (parts.length !== 2) {
                throw new Error(`Invalid prompt file format: ${promptKey}`);
            }
            const system = parts[0].replace(/^# System Prompt: .*(\n|$)/, '').trim();
            const user = parts[1].replace(/^.*\n/, '').trim();
            const prompts = { system, user };
            this.promptCache.set(promptKey, prompts);
            return prompts;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load prompt for ${promptKey}: ${errorMsg}`);
        }
    }

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

        // Include ConOps if it exists
        const conopsPath = path.join(workspaceRoot, 'specs', 'ConOps.md');
        try {
            const conopsContent = await fs.readFile(conopsPath, 'utf-8');
            contextDescription += `\n\nConcept of Operations:\n\n${conopsContent}`;
        } catch {
            // ConOps doesn't exist, skip
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
            if (ref.requirement) { tags.push(`${ref.name}.req`); }
            if (ref.design) { tags.push(`${ref.name}.design`); }
            return tags;
        });

        const referenceBlock = referencedArtifacts.length > 0
            ? `\n\nReferenced artifacts (context):\n${this.formatReferencedArtifacts(referencedArtifacts)}`
            : '';

        // Load prompt template
        const prompts = await this.loadPrompt('generateRequirement.md');
        const today = new Date().toISOString().split('T')[0];
        const systemPrompt = prompts.system
            .replace(/{artifact_name}/g, artifactName)
            .replace('{reference_tags}', referenceTags.length > 0 ? '["' + referenceTags.join('", "') + '"]' : '[]')
            .replace('{last_updated}', today);
        const userPrompt = prompts.user
            .replace('{description}', description)
            .replace('{reference_block}', referenceBlock);

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        this.outputChannel.appendLine(`[Scaffold] Sending ${messages.length} messages to AI for requirement generation`);
        try {
            const response = await this.aiClient.chat(messages, { maxTokens: 4000 });
            
            // Log the AI response to file
            await this.logAiResponse('generateRequirement', systemPrompt, userPrompt, response);
            
            return response;
        } catch (error: any) {
            this.outputChannel.appendLine(`[Scaffold] Error generating requirement: ${error.message}`);
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
            `${artifactName}.req`,
            ...referencedArtifacts.flatMap(ref => {
                const tags = [];
                if (ref.requirement) tags.push(`${ref.name}.req`);
                if (ref.design) tags.push(`${ref.name}.design`);
                return tags;
            })
        ];

        const referenceBlock = referencedArtifacts.length > 0
            ? `\n\nReferenced artifacts (context):\n${this.formatReferencedArtifacts(referencedArtifacts)}`
            : '';

        // Load prompt template
        const prompts = await this.loadPrompt('generateDesignInitial.md');
        const today = new Date().toISOString().split('T')[0];
        const systemPrompt = prompts.system
            .replace(/{artifact_name}/g, artifactName)
            .replace('{reference_tags}', referenceTags.length > 0 ? '["' + referenceTags.join('", "') + '"]' : '[]')
            .replace('{last_updated}', today);
        const userPrompt = prompts.user
            .replace('{description}', description)
            .replace('{reference_block}', referenceBlock)
            .replace('{requirement_spec}', requirementSpec);

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        this.outputChannel.appendLine(`[Scaffold] Sending ${messages.length} messages to AI for design generation`);
        try {
            const response = await this.aiClient.chat(messages, { maxTokens: 4000 });
            
            // Log the AI response to file
            await this.logAiResponse('generateDesign', systemPrompt, userPrompt, response);
            
            return response;
        } catch (error: any) {
            this.outputChannel.appendLine(`[Scaffold] Error generating design: ${error.message}`);
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
        // Load prompt template
        const prompts = await this.loadPrompt('generateImplementationInitial.md');
        const today = new Date().toISOString().split('T')[0];
        const systemPrompt = prompts.system
            .replace(/{artifact_name}/g, artifactName)
            .replace('{artifact_title}', artifactTitle)
            .replace('{last_updated}', today);
        const userPrompt = prompts.user
            .replace('{requirement_spec}', requirementSpec)
            .replace('{design_spec}', designSpec);

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        this.outputChannel.appendLine(`[Generate] Sending ${messages.length} messages to AI`);
        try {
            const response = await this.aiClient.chat(messages, { maxTokens: 4000 });
            
            // Log the AI response to file
            await this.logAiResponse('generateImplementation', systemPrompt, userPrompt, response);
            
            return response;
        } catch (error: any) {
            this.outputChannel.appendLine(`[Generate] Error generating implementation: ${error.message}`);
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

        // Create ConOps.md from template
        const conopsTemplatePath = path.join(__dirname, '../../templates', 'ConOps.template.md');
        const conopsContent = await fs.readFile(conopsTemplatePath, 'utf-8');
        const conopsWithDate = conopsContent.replace('YYYY-MM-DD', new Date().toISOString().split('T')[0]);
        await fs.writeFile(path.join(workspaceRoot, 'specs', 'ConOps.md'), conopsWithDate, 'utf-8');

        // Set up configuration files (.gitignore, VS Code settings)
        await this.setupConfigurationFiles(workspaceRoot);

        // Copy templates
        const templateSource = path.join(__dirname, '../../templates');
        const templateDest = path.join(workspaceRoot, 'templates');

        try {
            // Copy template files from extension to workspace
            const templates = ['requirement.template.md', 'design.template.md', 'implementation.template.md'];
            for (const template of templates) {
                const srcPath = path.join(templateSource, template);
                const destPath = path.join(templateDest, template);
                const content = await fs.readFile(srcPath, 'utf-8');
                await fs.writeFile(destPath, content, 'utf-8');
            }
        } catch (error) {
            console.warn('Could not copy templates:', error);
        }

        vscode.window.showInformationMessage(
            '✅ PromptPress project structure created! Use "Scaffold Artifact" to create your first spec.'
        );
    }

    /**
     * Update ConOps based on requirement overviews
     */
    public async updateConOps(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const reqDir = path.join(workspaceRoot, 'specs', 'requirements');
        const conopsPath = path.join(workspaceRoot, 'specs', 'ConOps.md');

        // Check if ConOps exists, if not, we'll generate it
        let conopsExists = true;
        try {
            await fs.access(conopsPath);
        } catch {
            conopsExists = false;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating ConOps...',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Collecting requirement overviews...', increment: 25 });

                // Collect all req.md files
                const reqFiles: string[] = [];
                try {
                    const files = await fs.readdir(reqDir);
                    for (const file of files) {
                        if (file.endsWith('.req.md')) {
                            reqFiles.push(path.join(reqDir, file));
                        }
                    }
                } catch {
                    // No requirements directory or empty
                }

                if (reqFiles.length === 0) {
                    vscode.window.showErrorMessage('No requirement files found to analyze.');
                    return;
                }

                // Extract overviews
                const overviews: string[] = [];
                for (const reqFile of reqFiles) {
                    try {
                        const content = await fs.readFile(reqFile, 'utf-8');
                        const overview = this.extractOverviewSection(content);
                        if (overview) {
                            overviews.push(`${path.basename(reqFile)}:\n${overview}`);
                        }
                    } catch (error) {
                        console.warn(`Failed to read ${reqFile}:`, error);
                    }
                }

                if (overviews.length === 0) {
                    vscode.window.showErrorMessage('No overview sections found in requirement files.');
                    return;
                }

                progress.report({ message: 'Reading ConOps...', increment: 25 });

                // Read ConOps or use empty if generating
                let conopsContent = '';
                if (conopsExists) {
                    conopsContent = await fs.readFile(conopsPath, 'utf-8');
                }

                progress.report({ message: 'Analyzing with AI...', increment: 25 });

                // Generate updates
                const conopsSection = conopsExists 
                    ? `Current ConOps.md:\n${conopsContent}`
                    : 'ConOps.md does not exist - generate a new one based on the requirement overviews.';
                const updates = await this.generateConOpsUpdates(conopsSection, overviews.join('\n\n---\n\n'));
                
                // Apply the updates
                await this.applyConOpsUpdates(workspaceRoot, updates, conopsExists);

                progress.report({ message: 'Applying updates...', increment: 25 });

                // Apply updates
                await this.applyConOpsUpdates(workspaceRoot, updates, conopsExists);

                vscode.window.showInformationMessage('✅ ConOps updated successfully!');

            } catch (error: any) {
                this.outputChannel.appendLine(`[ERROR] ConOps update failed: ${error.message}`);
                this.outputChannel.show();
                vscode.window.showErrorMessage(`Failed to update ConOps: ${error.message}`);
            }
        });
    }

    /**
     * Extract the ## Overview section from content
     */
    private extractOverviewSection(content: string): string | null {
        const lines = content.split('\n');
        const overviewStart = lines.findIndex(line => line.trim() === '## Overview');
        if (overviewStart === -1) return null;

        let overviewEnd = lines.findIndex((line, index) => index > overviewStart && line.startsWith('## '));
        if (overviewEnd === -1) overviewEnd = lines.length;

        return lines.slice(overviewStart + 1, overviewEnd).join('\n').trim();
    }

    /**
     * Generate ConOps updates using AI
     */
    private async generateConOpsUpdates(conopsSection: string, requirementOverviews: string): Promise<string> {
        // Load prompt template
        const prompts = await this.loadPrompt('updateConOps.md');
        const systemPrompt = prompts.system;
        const userPrompt = prompts.user
            .replace('{conops_section}', conopsSection)
            .replace('{requirement_overviews}', requirementOverviews);

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        this.outputChannel.appendLine('[UpdateConOps] Sending analysis to AI');
        this.outputChannel.appendLine('[UpdateConOps] System Prompt:');
        this.outputChannel.appendLine(systemPrompt);
        this.outputChannel.appendLine('[UpdateConOps] User Prompt:');
        this.outputChannel.appendLine(userPrompt);
        try {
            const response = await this.aiClient.chat(messages, { maxTokens: 6000 });
            this.outputChannel.appendLine('[UpdateConOps] AI Response:');
            this.outputChannel.appendLine(response);
            
            // Log the AI response to file
            await this.logAiResponse('updateConOps', systemPrompt, userPrompt, response);
            
            return response;
        } catch (error: any) {
            this.outputChannel.appendLine(`[UpdateConOps] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Populate the ConOps template with AI-generated content
     */
    private populateConOpsTemplate(templateContent: string, aiContent: string): string {
        // Split the AI content by sections (assuming it uses ## or ### headers)
        const aiSections: { [key: string]: string } = {};
        const aiLines = aiContent.split('\n');
        let currentSection = '';
        let currentContent: string[] = [];

        for (const line of aiLines) {
            if (line.startsWith('### ')) {
                // Save previous section
                if (currentSection && currentContent.length > 0) {
                    aiSections[currentSection] = currentContent.join('\n').trim();
                }
                // Start new section (remove the ### prefix)
                currentSection = line.substring(4).trim();
                currentContent = [];
            } else if (line.startsWith('## ')) {
                // Save previous section
                if (currentSection && currentContent.length > 0) {
                    aiSections[currentSection] = currentContent.join('\n').trim();
                }
                // Start new section (remove the ## prefix)
                currentSection = line.substring(3).trim();
                currentContent = [];
            } else if (currentSection) {
                currentContent.push(line);
            }
        }
        
        // Save the last section
        if (currentSection && currentContent.length > 0) {
            aiSections[currentSection] = currentContent.join('\n').trim();
        }

        // Replace template sections with AI content
        let populatedTemplate = templateContent;

        // Map AI sections to template sections
        const sectionMappings: { [key: string]: string[] } = {
            'Executive Summary': ['Executive Summary'],
            'Business Objectives': ['Business Objectives'],
            'Stakeholders': ['Stakeholders'],
            'Operational Concept': ['Operational Concept', 'Current State', 'Proposed Solution', 'Operational Scenarios'],
            'Functional Requirements Overview': ['Functional Requirements Overview', 'Requirements Overview'],
            'Non-Functional Requirements Overview': ['Non-Functional Requirements Overview', 'Requirements Overview'],
            'Constraints and Assumptions': ['Constraints and Assumptions', 'Constraints'],
            'Risks and Mitigations': ['Risks and Mitigations', 'Risks'],
            'Future Considerations': ['Future Considerations'],
            'Gap Analysis': ['Gap Analysis'],
            'Recommended Updates': ['Recommended Updates'],
            'Requirements Traceability': ['Requirements Traceability']
        };

        for (const [templateSection, aiSectionNames] of Object.entries(sectionMappings)) {
            for (const aiSectionName of aiSectionNames) {
                if (aiSections[aiSectionName]) {
                    // Replace placeholder content in template section
                    const sectionRegex = new RegExp(`(## ${templateSection}\\s*\\n)\\[.*?\\]`, 's');
                    populatedTemplate = populatedTemplate.replace(sectionRegex, `$1${aiSections[aiSectionName]}`);
                    break; // Use the first matching AI section
                }
            }
        }

        return populatedTemplate;
    }

    /**
     * Log AI responses to files for analysis
     */
    private async logAiResponse(operation: string, systemPrompt: string, userPrompt: string, aiResponse: string): Promise<void> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const logFileName = `${operation}_${timestamp}.log`;
            const logFilePath = path.join(__dirname, '../../logs', logFileName);
            
            const logContent = `=== AI Response Log: ${operation} ===
Timestamp: ${new Date().toISOString()}

=== System Prompt ===
${systemPrompt}

=== User Prompt ===
${userPrompt}

=== AI Response ===
${aiResponse}

=== End Log ===
`;
            
            await fs.writeFile(logFilePath, logContent, 'utf-8');
            this.outputChannel.appendLine(`[Log] AI response saved to: logs/${logFileName}`);
        } catch (error) {
            this.outputChannel.appendLine(`[Log] Failed to save AI response log: ${error}`);
        }
    }

    /**
     * Apply the ConOps updates from AI response
     */
    private async applyConOpsUpdates(workspaceRoot: string, aiResponse: string, conopsExists: boolean): Promise<void> {
        const conopsPath = path.join(workspaceRoot, 'specs', 'ConOps.md');

        this.outputChannel.appendLine('[UpdateConOps] Applying updates from AI response');
        this.outputChannel.appendLine('[UpdateConOps] Full AI Response:');
        this.outputChannel.appendLine(aiResponse);

        // Include the full AI response content, which contains valuable analysis
        let finalContent = aiResponse;
        
        if (!conopsExists) {
            // For new ConOps, try to use the template structure but include all analysis
            const conopsTemplatePath = path.join(__dirname, '../../templates', 'ConOps.template.md');
            const templateContent = await fs.readFile(conopsTemplatePath, 'utf-8');
            const templateWithDate = templateContent.replace('YYYY-MM-DD', new Date().toISOString().split('T')[0]);
            
            // Try to extract and populate structured content, but also append the full analysis
            const updatedContentMatch = aiResponse.match(/### Updated Content\s*\n([\s\S]*?)(?=\n## |\n### |\n$)/);
            if (updatedContentMatch) {
                const updatedConOps = updatedContentMatch[1].trim();
                let structuredContent = this.populateConOpsTemplate(templateWithDate, updatedConOps);
                
                // Append the Gap Analysis and Recommended Updates at the end
                const gapAnalysisMatch = aiResponse.match(/### Gap Analysis\s*\n([\s\S]*?)(?=\n### |\n$)/);
                const recommendedUpdatesMatch = aiResponse.match(/### Recommended Updates\s*\n([\s\S]*?)(?=\n### |\n$)/);
                
                if (gapAnalysisMatch || recommendedUpdatesMatch) {
                    structuredContent += '\n\n## Analysis and Recommendations\n\n';
                    if (gapAnalysisMatch) {
                        structuredContent += '### Gap Analysis\n' + gapAnalysisMatch[1].trim() + '\n\n';
                    }
                    if (recommendedUpdatesMatch) {
                        structuredContent += '### Recommended Updates\n' + recommendedUpdatesMatch[1].trim() + '\n\n';
                    }
                }
                
                finalContent = structuredContent;
                this.outputChannel.appendLine('[UpdateConOps] Created structured ConOps with analysis sections');
            } else {
                // If no clear content section, include the full analysis in the template
                finalContent = this.populateConOpsTemplate(templateWithDate, aiResponse);
                this.outputChannel.appendLine('[UpdateConOps] Populated ConOps template with full AI response');
            }
        }
        // For existing ConOps, replace the entire content with the full AI response (includes all analysis)
        
        await fs.writeFile(conopsPath, finalContent, 'utf-8');
        this.outputChannel.appendLine('[UpdateConOps] Updated ConOps.md');

        // Look for requirement updates in the AI response
        // Handle both the expected format and the actual AI response format
        const reqUpdates: RegExpMatchArray[] = [];
        
        // Try the expected format first: - **File**: filename\n- **Updated Overview**: content
        const expectedMatches = Array.from(aiResponse.matchAll(/- \*\*File\*\*: ([^\n]+)\n- \*\*Updated Overview\*\*:([\s\S]*?)(?=\n- \*\*File\*\*|\n### |\n$)/g));
        reqUpdates.push(...expectedMatches);
        
        // Also try to parse the actual AI format: 1. **Update filename.req.md:**\n   - **Expanded Overview:** content
        const aiFormatMatches = Array.from(aiResponse.matchAll(/^\d+\. \*\*Update ([^\*]+)\*\*:\s*\n(?:[\s\S]*?)- \*\*Expanded Overview:\*\* ([\s\S]*?)(?=\n\d+\. \*\*Update|\n### |\n$)/gm));
        for (const match of aiFormatMatches) {
            const fileName = match[1].trim();
            const updatedOverview = match[2].trim();
            reqUpdates.push([match[0], fileName, updatedOverview] as RegExpMatchArray);
        }
        
        for (const match of reqUpdates) {
            const fileName = match[1].trim();
            const updatedOverview = match[2].trim();
            const reqPath = path.join(workspaceRoot, 'specs', 'requirements', fileName);

            try {
                let content = await fs.readFile(reqPath, 'utf-8');
                // Replace the ## Overview section
                const lines = content.split('\n');
                const overviewIndex = lines.findIndex(line => line.trim() === '## Overview');
                if (overviewIndex !== -1) {
                    let endIndex = lines.findIndex((line, index) => index > overviewIndex && line.startsWith('## '));
                    if (endIndex === -1) endIndex = lines.length;

                    // Replace the section
                    lines.splice(overviewIndex + 1, endIndex - overviewIndex - 1, '', ...updatedOverview.split('\n'));
                    content = lines.join('\n');
                    await fs.writeFile(reqPath, content, 'utf-8');
                    this.outputChannel.appendLine(`[UpdateConOps] Updated overview in ${fileName}`);
                }
            } catch (error) {
                console.warn(`Failed to update ${fileName}:`, error);
            }
        }
    }
}
