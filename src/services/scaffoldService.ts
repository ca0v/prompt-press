import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { XAIClient, ChatMessage } from '../ai/xaiClient.js';
import { GitHelper } from './gitHelper.js';
import { DiffHelper } from './diffHelper.js';
import { __dirname } from '../utils/dirname.js';
import { MarkdownFormatter } from '../utils/markdownFormatter.js';

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
    public async createRequirementSpec(): Promise<void> {
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
            prompt: 'High-level description',
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

        // Step 3: Build context with ConOps
        let contextDescription = description;
        
        // Always include ConOps if it exists
        const conopsPath = path.join(workspaceRoot, 'specs', 'ConOps.md');
        try {
            const conopsContent = await fs.readFile(conopsPath, 'utf-8');
            contextDescription += `\n\nConcept of Operations:\n\n${conopsContent}`;
        } catch {
            vscode.window.showWarningMessage('ConOps.md not found. Consider running "Update ConOps" first for better context.');
        }

        // Step 4: Collect referenced artifacts mentioned via @artifact-name
        const mentionedArtifacts = this.parseMentions(description);
        let referencedArtifacts: ReferencedArtifact[] = [];
        if (mentionedArtifacts.length > 0) {
            referencedArtifacts = await this.loadReferencedArtifacts(workspaceRoot, mentionedArtifacts, 'requirement');
        }

        // Check if all mentioned artifacts exist
        if (mentionedArtifacts.length > 0 && referencedArtifacts.length !== mentionedArtifacts.length) {
            const missing = mentionedArtifacts.filter(name => !referencedArtifacts.some(ref => ref.name === name));
            vscode.window.showErrorMessage(`Some mentioned artifacts (@${missing.join(', @')}) could not be found. Please ensure all referenced artifacts exist before scaffolding.`);
            return;
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
    public async syncImplementationSpecSpec(): Promise<void> {
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
                    const implSpec = await this.syncImplementationSpec(
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
    private async syncImplementationSpec(
        artifactName: string,
        requirementSpec: string,
        designSpec: string
    ): Promise<string> {
        this.outputChannel.appendLine(`[Generate] Generating implementation for artifact: ${artifactName}`);

        const artifactTitle = artifactName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        // Load prompt template
        const prompts = await this.loadPrompt('syncImplementationSpecInitial.md');
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
            await this.logAiResponse('syncImplementationSpec', systemPrompt, userPrompt, response);
            
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

    /**
     * Check git status for unstaged changes
     */
    private async checkGitStatus(workspaceRoot: string): Promise<boolean> {
        return GitHelper.checkGitStatus(workspaceRoot);
    }

    /**
     * Stage all changes
     */
    private async stageChanges(workspaceRoot: string): Promise<void> {
        try {
            await GitHelper.stageChanges(workspaceRoot);
            this.outputChannel.appendLine('[syncConOps] Successfully staged all changes');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`[syncConOps] Warning: Failed to stage changes: ${errorMsg}`);
            // Don't throw - allow cascade to continue even if staging fails
        }
    }

    /**
     * Detect changes in ConOps file
     */
    private async detectConOpsChanges(workspaceRoot: string, conopsPath: string, currentContent: string): Promise<{ hasChanges: boolean; summary: string; modifiedSections: string[] }> {
        const cacheDir = path.join(workspaceRoot, '.promptpress', 'cache');
        const cacheFile = path.join(cacheDir, 'ConOps.md.baseline');
        
        try {
            const cachedContent = await fs.readFile(cacheFile, 'utf-8');
            const changes = DiffHelper.compareContent(cachedContent, currentContent);
            return {
                hasChanges: changes.hasChanges,
                summary: changes.summary,
                modifiedSections: changes.modifiedSections
            };
        } catch {
            // No cache, try git
            const oldContent = await GitHelper.getLastCommittedContent(workspaceRoot, conopsPath);
            if (oldContent) {
                const changes = DiffHelper.compareContent(oldContent, currentContent);
                return {
                    hasChanges: changes.hasChanges,
                    summary: changes.summary,
                    modifiedSections: changes.modifiedSections
                };
            } else {
                // No git history
                this.outputChannel.appendLine('[syncConOps] No git history found, treating as new changes');
                return {
                    hasChanges: true,
                    summary: 'New or significantly modified ConOps',
                    modifiedSections: ['All sections']
                };
            }
        }
    }

    /**
     * Compare content and detect changes
     */
    /**
     * Update ConOps based on requirement overviews
     */
    public async syncConOps(): Promise<void> {
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

                // Ensure requirements directory exists
                await fs.mkdir(reqDir, { recursive: true });

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
                    vscode.window.showWarningMessage('No requirement files found to analyze. Will use README.md as context if available.');
                }

                // Extract overviews from requirements
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

                // If no requirement overviews, try to use README.md as context
                let readmeContent = '';
                if (overviews.length === 0) {
                    const readmePath = path.join(workspaceRoot, 'README.md');
                    try {
                        readmeContent = await fs.readFile(readmePath, 'utf-8');
                        this.outputChannel.appendLine('[syncConOps] Using README.md as context since no requirements found');
                    } catch {
                        vscode.window.showErrorMessage('No requirement files or README.md found to analyze.');
                        return;
                    }
                }

                progress.report({ message: 'Reading ConOps...', increment: 25 });

                // Read ConOps or use empty if generating
                let conopsContent = '';
                let conopsChanges = { hasChanges: false, summary: '', modifiedSections: [] as string[] };
                
                if (conopsExists) {
                    conopsContent = await fs.readFile(conopsPath, 'utf-8');
                    
                    // Check git status and prompt to stage if needed
                    const hasUnstaged = await this.checkGitStatus(workspaceRoot);
                    if (hasUnstaged) {
                        const gitAction = await vscode.window.showWarningMessage(
                            'ConOps.md has unstaged changes. Stage them before updating?',
                            'Stage Changes',
                            'Continue Without Staging',
                            'Cancel'
                        );
                        
                        if (gitAction === 'Cancel') {
                            return;
                        } else if (gitAction === 'Stage Changes') {
                            await this.stageChanges(workspaceRoot);
                        }
                        // 'Continue Without Staging' falls through
                    }
                    
                    // Detect changes in ConOps
                    conopsChanges = await this.detectConOpsChanges(workspaceRoot, conopsPath, conopsContent);
                    if (conopsChanges.hasChanges) {
                        this.outputChannel.appendLine(`[syncConOps] Detected changes: ${conopsChanges.summary}`);
                        this.outputChannel.appendLine(`[syncConOps] Modified sections: ${conopsChanges.modifiedSections.join(', ')}`);
                    }
                }

                progress.report({ message: 'Analyzing with AI...', increment: 25 });

                // Generate updates with change context
                const changeContext = conopsChanges.hasChanges 
                    ? `\n\nRecent ConOps Changes:\n- Summary: ${conopsChanges.summary}\n- Modified sections: ${conopsChanges.modifiedSections.join(', ')}`
                    : '';
                    
                const conopsSection = conopsExists 
                    ? `Current ConOps.md:${changeContext}\n\n${conopsContent}`
                    : `ConOps.md does not exist - generate a new one based on the ${overviews.length > 0 ? 'requirement overviews' : 'project README'}.`;
                
                const contextContent = overviews.length > 0 
                    ? overviews.join('\n\n---\n\n')
                    : `Project README.md:\n\n${readmeContent}`;
                    
                const updates = await this.generateConOpsUpdates(conopsSection, contextContent);
                
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
    private async generateConOpsUpdates(conopsSection: string, contextContent: string): Promise<string> {
        // Load prompt template
        const prompts = await this.loadPrompt('updateConOps.md');
        const systemPrompt = prompts.system;
        const userPrompt = prompts.user
            .replace('{conops_section}', conopsSection)
            .replace('{requirement_overviews}', contextContent);

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        this.outputChannel.appendLine('[syncConOps] Sending analysis to AI');
        this.outputChannel.appendLine('[syncConOps] System Prompt:');
        this.outputChannel.appendLine(systemPrompt);
        this.outputChannel.appendLine('[syncConOps] User Prompt:');
        this.outputChannel.appendLine(userPrompt);
        try {
            const response = await this.aiClient.chat(messages, { maxTokens: 6000 });
            this.outputChannel.appendLine('[syncConOps] AI Response:');
            this.outputChannel.appendLine(response);
            
            // Log the AI response to file
            await this.logAiResponse('syncConOps', systemPrompt, userPrompt, response);
            
            return response;
        } catch (error: any) {
            this.outputChannel.appendLine(`[syncConOps] Error: ${error.message}`);
            throw error;
        }
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

        this.outputChannel.appendLine('[syncConOps] Applying updates from AI response');
        this.outputChannel.appendLine('[syncConOps] Full AI Response:');
        this.outputChannel.appendLine(aiResponse);

        // Ensure the specs directory exists
        await fs.mkdir(path.dirname(conopsPath), { recursive: true });

        // Include the full AI response content, which contains valuable analysis
        let finalContent = aiResponse;
        
        if (!conopsExists) {
            // For new ConOps, use the AI-generated content directly
            // The syncConOps prompt generates a complete, structured ConOps document
            this.outputChannel.appendLine('[syncConOps] Created new ConOps from AI response');
        }
        // For existing ConOps, replace the entire content with the full AI response (includes all analysis)
        
        await fs.writeFile(conopsPath, finalContent, 'utf-8');
        this.outputChannel.appendLine('[syncConOps] Updated ConOps.md');

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
                    this.outputChannel.appendLine(`[syncConOps] Updated overview in ${fileName}`);
                }
            } catch (error) {
                console.warn(`Failed to update ${fileName}:`, error);
            }
        }
    }

    /**
     * Sync TOC with ConOps document
     */
    public async syncTOC(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        const conopsPath = path.join(workspaceRoot, 'specs', 'ConOps.md');
        const tocPath = path.join(workspaceRoot, 'specs', 'TOC.md');
        const readmePath = path.join(workspaceRoot, 'README.md');

        // Read ConOps
        let conopsContent = '';
        try {
            conopsContent = await fs.readFile(conopsPath, 'utf-8');
        } catch {
            vscode.window.showErrorMessage('ConOps.md not found. Please create ConOps.md first.');
            return;
        }

        // Read existing TOC if exists
        let tocContent = '';
        const tocExists = await fs.access(tocPath).then(() => true).catch(() => false);
        if (tocExists) {
            tocContent = await fs.readFile(tocPath, 'utf-8');
        }

        // Read README if exists
        let readmeContent = '';
        try {
            readmeContent = await fs.readFile(readmePath, 'utf-8');
        } catch {
            // Ignore if not found
        }

        // Read all req specs
        let reqSpecs = '';
        const reqDir = path.join(workspaceRoot, 'specs', 'requirements');
        try {
            const files = await fs.readdir(reqDir);
            for (const file of files) {
                if (file.endsWith('.req.md')) {
                    const content = await fs.readFile(path.join(reqDir, file), 'utf-8');
                    reqSpecs += `\n\n${file}:\n${content}`;
                }
            }
        } catch {
            // Ignore if dir not found
        }

        // Load prompt
        const prompts = await this.loadPrompt('syncTOC.md');

        const userPrompt = prompts.user
            .replace('{conops_content}', conopsContent)
            .replace('{toc_content}', tocContent)
            .replace('{readme_content}', readmeContent)
            .replace('{req_specs}', reqSpecs);

        const messages: ChatMessage[] = [
            { role: 'system', content: prompts.system },
            { role: 'user', content: userPrompt }
        ];

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Syncing TOC...',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Generating TOC...', increment: 50 });
                const response = await this.aiClient.chat(messages, { maxTokens: 4000 });

                // Format the markdown response
                let formattedResponse = response;
                try {
                    formattedResponse = MarkdownFormatter.format(response);
                    this.outputChannel.appendLine('[syncTOC] Markdown formatting applied successfully');
                } catch (formatError: any) {
                    this.outputChannel.appendLine(`[syncTOC] Markdown formatting failed: ${formatError.message}, saving unformatted response`);
                }

                // Write to TOC.md (always save, even if formatting failed)
                await fs.writeFile(tocPath, formattedResponse, 'utf-8');
                this.outputChannel.appendLine(`[syncTOC] Updated TOC.md`);

                progress.report({ message: 'TOC synced successfully', increment: 50 });
                vscode.window.showInformationMessage('TOC synced successfully!');
            } catch (error: any) {
                this.outputChannel.appendLine(`[syncTOC] Error: ${error.message}`);
                vscode.window.showErrorMessage(`Failed to sync TOC: ${error.message}`);
            }
        });
    }

}
