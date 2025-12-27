/**
 * CascadeCore contains the platform-agnostic cascade logic.
 * It avoids vscode dependencies and logs via a provided logger (defaults to console).
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { XAIClient, ChatMessage } from '../ai/xaiClient.js';
import { MarkdownParser } from '../parsers/markdownParser.js';
import { GitHelper } from './GitHelper.js';
import { PromptLogger } from '../utils/PromptLogger.js';
import { DiffHelper, ChangeDetectionResult } from './DiffHelper.js';
import { __dirname } from '../utils/dirname.js';
import { TersifyActionParser } from './TersifyActionParser.js';

// Prompt file paths
const PROMPTS = {
    refineDocument: path.join(__dirname, '../prompts/refineDocument.md'),
    generateDesign: path.join(__dirname, '../prompts/generateDesign.md'),
    syncImplementationSpec: path.join(__dirname, '../prompts/syncImplementationSpec.md'),
    tersifySpec: path.join(__dirname, '../prompts/tersifySpec.md')
};

export interface CascadeResult {
    success: boolean;
    updatedFiles: string[];
    errors: string[];
}

export interface CascadeUI {
    confirm(message: string): Promise<boolean>;
    confirmGitStatus(hasUnstaged: boolean): Promise<'stage' | 'continue' | 'cancel'>;
    notifyInfo(message: string): void;
    notifyError(message: string): void;
}

export interface Logger {
    log(message: string): void;
}

export interface ReferencedArtifact {
    name: string;
    requirement?: string;
    design?: string;
}

export class CascadeCore {
    private parser: MarkdownParser;
    private promptCache: Map<string, { system: string; user: string }> = new Map();
    private promptLogger: PromptLogger;

    constructor(
        private xaiClient: XAIClient,
        private workspaceRoot: string,
        private logger: Logger = console
    ) {
        this.parser = new MarkdownParser();
        this.promptLogger = new PromptLogger((msg) => this.logger.log(msg));
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private async loadPrompts(promptKey: string): Promise<{ system: string; user: string }> {
        if (this.promptCache.has(promptKey)) {
            return this.promptCache.get(promptKey)!;
        }

        const promptFile = PROMPTS[promptKey as keyof typeof PROMPTS];
        if (!promptFile) {
            throw new Error(`Unknown prompt key: ${promptKey}`);
        }

        try {
            const content = await fs.readFile(promptFile, 'utf-8');
            const parts = content.split('---\n\n# User Prompt:');
            if (parts.length !== 2) {
                throw new Error(`Invalid prompt file format: ${promptKey}`);
            }

            const system = parts[0].replace(/^# System Prompt: .*\n/, '').trim();
            const user = parts[1].replace(/^.*\n/, '').trim();

            const prompts = { system, user };
            this.promptCache.set(promptKey, prompts);
            return prompts;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load prompts for ${promptKey}: ${errorMsg}`);
        }
    }

    private parseMentions(text: string): string[] {
        const mentions = new Set<string>();
        const regex = /@([a-z0-9-]+)/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
            mentions.add(match[1]);
        }
        return Array.from(mentions);
    }

    private async loadReferencedArtifacts(
        artifactNames: string[],
        specsDir: string = path.join(this.workspaceRoot, 'specs')
    ): Promise<ReferencedArtifact[]> {
        const results: ReferencedArtifact[] = [];

        for (const name of artifactNames) {
            // Parse artifact name to separate base name from phase if present
            const parts = name.split('.');
            let baseName: string;
            let specificPhase: string | null = null;

            if (parts.length === 2 && (parts[1] === 'req' || parts[1] === 'design')) {
                // Name includes phase (e.g. "geode-quartz.req")
                baseName = parts[0];
                specificPhase = parts[1];
            } else {
                // Name without phase (e.g. "geode-quartz")
                baseName = name;
            }

            const ref: ReferencedArtifact = { name: baseName };

            if (specificPhase) {
                // Load only the specific phase file
                const filePath = path.join(specsDir, specificPhase === 'req' ? 'requirements' : 'design', `${baseName}.${specificPhase}.md`);
                try {
                    if (specificPhase === 'req') {
                        ref.requirement = await fs.readFile(filePath, 'utf-8');
                    } else {
                        ref.design = await fs.readFile(filePath, 'utf-8');
                    }
                } catch (error) {
                    throw new Error(`Referenced artifact file not found: ${filePath}`);
                }
            } else {
                // Load both req and design, but only fail if neither exists
                const reqPath = path.join(specsDir, 'requirements', `${baseName}.req.md`);
                const designPath = path.join(specsDir, 'design', `${baseName}.design.md`);

                let hasReq = false;
                let hasDesign = false;

                try {
                    ref.requirement = await fs.readFile(reqPath, 'utf-8');
                    hasReq = true;
                } catch {
                    // Ignore errors when file doesn't exist
                }

                try {
                    ref.design = await fs.readFile(designPath, 'utf-8');
                    hasDesign = true;
                } catch {
                    // Ignore errors when file doesn't exist
                }

                if (!hasReq && !hasDesign) {
                    throw new Error(`No requirement or design files found for artifact: ${baseName}`);
                }
            }

            results.push(ref);
        }

        return results;
    }

    private formatReferencedArtifacts(references: ReferencedArtifact[]): string {
        const limit = 15000;
        return references.map(ref => {
            const parts: string[] = [`Artifact: ${ref.name}`];
            if (ref.requirement) {
                parts.push(`**Requirement:**\n${ref.requirement.substring(0, limit)}${ref.requirement.length > limit ? '... [truncated]' : ''}`);
            }
            if (ref.design) {
                parts.push(`**Design:**\n${ref.design.substring(0, limit)}${ref.design.length > limit ? '... [truncated]' : ''}`);
            }
            return parts.join('\n\n');
        }).join('\n\n---\n\n');
    }

    // promptpress/IMP-1023
    async refactorSpec(
        filePath: string,
        ui: CascadeUI
    ): Promise<CascadeResult> {
        const result: CascadeResult = {
            success: false,
            updatedFiles: [],
            errors: []
        };

        try {
            this.logger.log(`[Cascade] Starting change detection for ${path.basename(filePath)}`);

            const currentContent = await fs.readFile(filePath, 'utf-8');
            const parsed = this.parser.parse(currentContent);
            const metadata = parsed.metadata;

            if (!metadata) {
                result.errors.push('Invalid markdown file - missing metadata header');
                return result;
            }

            const changes = await this.detectChanges(filePath, currentContent);

            if (!changes.hasChanges) {
                this.logger.log('[Cascade] No changes detected');
                ui.notifyInfo('No changes detected in this file.');
                result.success = true;
                return result;
            }

            this.logger.log(`[Cascade] Changes detected in sections: ${changes.modifiedSections.join(', ')}`);
            this.logger.log(`[Cascade] Summary: ${changes.summary}`);

            // Check git status for unstaged changes
            const hasUnstaged = await this.checkGitStatus();
            if (hasUnstaged) {
                const gitAction = await ui.confirmGitStatus(hasUnstaged);
                if (gitAction === 'cancel') {
                    this.logger.log('[Cascade] User cancelled due to unstaged changes');
                    result.success = true;
                    return result;
                } else if (gitAction === 'stage') {
                    await this.stageChanges();
                    this.logger.log('[Cascade] Staged changes, proceeding with cascade');
                    // 'stage' falls through to continue
                }
                // 'continue' or 'stage' falls through
            }

            // Refine source document first
            await this.refineSourceDocument(filePath, currentContent, changes, result);

            // Then cascade to dependent files
            if (metadata.phase === 'requirement') {
                await this.cascadeFromRequirement(filePath, currentContent, changes, result);
            } else if (metadata.phase === 'design') {
                await this.cascadeFromDesign(filePath, currentContent, changes, result);
            } else {
                result.errors.push('Can only cascade changes from requirement or design phases');
                return result;
            }

            result.success = result.errors.length === 0;
            if (result.success) {
                // Update baseline cache with current content
                await this.updateBaselineCache(filePath, currentContent);
                ui.notifyInfo(`Successfully cascaded changes to ${result.updatedFiles.length} file(s)`);
            }

            return result;

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.log(`[Cascade] Error: ${errorMsg}`);
            result.errors.push(errorMsg);
            ui.notifyError(`Cascade failed: ${errorMsg}`);
            return result;
        }
    }

    // promptpress/IMP-1024
    async tersifySpec(
        filePath: string,
        ui: CascadeUI
    ): Promise<CascadeResult> {
        const result: CascadeResult = {
            success: false,
            updatedFiles: [],
            errors: []
        };

        try {
            this.logger.log(`[Tersify] Starting tersification for ${path.basename(filePath)}`);

            const sourceContent = await fs.readFile(filePath, 'utf-8');
            const parsed = this.parser.parse(sourceContent);
            const metadata = parsed.metadata;

            if (!metadata || !metadata.references || metadata.references.length === 0) {
                ui.notifyInfo('No references found in this document. Nothing to tersify.');
                result.success = true;
                return result;
            }

            // Load all referenced documents
            const referencedDocs: { filename: string; content: string }[] = [];
            const specsDir = path.join(this.workspaceRoot, 'specs');

            for (const ref of metadata.references) {
                // Parse reference to separate base name from phase
                const parts = ref.split('.');
                let baseName: string;
                let specificPhase: string | null = null;

                if (parts.length === 2 && (parts[1] === 'req' || parts[1] === 'design')) {
                    // Name includes phase (e.g. "game-of-life.design")
                    baseName = parts[0];
                    specificPhase = parts[1];
                } else {
                    // Name without phase (fallback)
                    baseName = ref;
                }

                let refPath: string;
                if (specificPhase) {
                    // Load from specific phase directory
                    const phaseDir = specificPhase === 'req' ? 'requirements' : 'design';
                    refPath = path.join(specsDir, phaseDir, `${baseName}.${specificPhase}.md`);
                } else {
                    // Fallback: look in specs directory
                    refPath = path.join(specsDir, `${ref}.md`);
                }

                if (await this.fileExists(refPath)) {
                    const content = await fs.readFile(refPath, 'utf-8');
                    referencedDocs.push({ filename: ref, content });
                } else {
                    this.logger.log(`[Tersify] Referenced document not found: ${refPath}`);
                }
            }

            if (referencedDocs.length === 0) {
                ui.notifyInfo('No referenced documents found. Nothing to tersify.');
                result.success = true;
                return result;
            }

            // Load all dependent documents (documents that depend on the source)
            const dependentDocs: { filename: string; content: string }[] = [];
            const sourceArtifact = metadata.artifact;

            // Scan all spec files to find dependents
            const phaseDirs = ['requirements', 'design', 'implementation'];
            for (const phaseDir of phaseDirs) {
                const dirPath = path.join(specsDir, phaseDir);
                if (await this.fileExists(dirPath)) {
                    const files = await fs.readdir(dirPath);
                    for (const file of files) {
                        if (file.endsWith('.md')) {
                            const filePath = path.join(dirPath, file);
                            try {
                                const content = await fs.readFile(filePath, 'utf-8');
                                const parsed = this.parser.parse(content);
                                if (parsed.metadata.dependsOn && parsed.metadata.dependsOn.includes(sourceArtifact)) {
                                    dependentDocs.push({ filename: file.replace('.md', ''), content });
                                }
                            } catch (error) {
                                this.logger.log(`[Tersify] Error reading potential dependent file ${filePath}: ${error}`);
                            }
                        }
                    }
                }
            }

            // Filter out dependent documents that are already in referenced documents
            const referencedFilenames = new Set(referencedDocs.map(doc => doc.filename));
            const filteredDependentDocs = dependentDocs.filter(doc => {
                if (referencedFilenames.has(doc.filename)) {
                    this.logger.log(`[Tersify] Warning: Document ${doc.filename} is both referenced and dependent on ${sourceArtifact}. Excluding from dependents.`);
                    return false;
                }
                return true;
            });

            // Check git status
            const hasUnstaged = await this.checkGitStatus();
            if (hasUnstaged) {
                const gitAction = await ui.confirmGitStatus(hasUnstaged);
                if (gitAction === 'cancel') {
                    this.logger.log('[Tersify] User cancelled due to unstaged changes');
                    result.success = true;
                    return result;
                } else if (gitAction === 'stage') {
                    await this.stageChanges();
                    this.logger.log('[Tersify] Staged changes, proceeding with tersification');
                }
            }

            // Create the AI prompt
            const prompts = await this.loadPrompts('tersifySpec');
            const sourceFilename = path.basename(filePath);

            const referencedText = referencedDocs.map(doc => 
                `## ${doc.filename}.md\n\n${doc.content}`
            ).join('\n\n---\n\n');

            const dependentText = filteredDependentDocs.map(doc => 
                `## ${doc.filename}.md\n\n${doc.content}`
            ).join('\n\n---\n\n');

            const userPrompt = prompts.user
                .replace('{source_filename}', sourceFilename)
                .replace('{content}', sourceContent)
                .replace('{referenced_documents}', referencedText)
                .replace('{dependent_documents}', dependentText);

            const messages: ChatMessage[] = [
                { role: 'system', content: prompts.system },
                { role: 'user', content: userPrompt }
            ];

            // Log the AI request
            const logId = await this.promptLogger.logRequest(this.workspaceRoot, 'tersify', prompts.system, userPrompt);

            this.logger.log('[Tersify] Calling AI to analyze documents for tersification...');
            const aiResponse = await this.xaiClient.chat(messages, { maxTokens: 4000 });

            // Log the AI response
            await this.promptLogger.logResponse(this.workspaceRoot, logId, 'tersify', aiResponse);

            // Parse the AI response and apply changes
            await this.applyTersifyChanges(filePath, sourceContent, referencedDocs, aiResponse, result, specsDir);

            result.success = result.errors.length === 0;
            if (result.success) {
                ui.notifyInfo(`Successfully tersified ${result.updatedFiles.length} file(s)`);
            }

            return result;

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.log(`[Tersify] Error: ${errorMsg}`);
            result.errors.push(errorMsg);
            ui.notifyError(`Tersify failed: ${errorMsg}`);
            return result;
        }
    }

    // promptpress/IMP-1025
    public async checkGitStatus(): Promise<boolean> {
        return GitHelper.checkGitStatus(this.workspaceRoot);
    }

    // promptpress/IMP-1026
    public async stageChanges(): Promise<void> {
        try {
            await GitHelper.stageChanges(this.workspaceRoot);
            this.logger.log('[Cascade] Successfully staged all changes');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.log(`[Cascade] Warning: Failed to stage changes: ${errorMsg}`);
            // Don't throw - allow cascade to continue even if staging fails
        }
    }

    private async refineSourceDocument(
        filePath: string,
        currentContent: string,
        changes: ChangeDetectionResult,
        result: CascadeResult
    ): Promise<void> {
        try {
            const parsed = this.parser.parse(currentContent);
            const metadata = parsed.metadata;
            if (!metadata) { return; }

            this.logger.log('[Cascade] Analyzing changes for extractable content...');

            // Extract referenced artifacts from modified sections and summary
            const changeText = changes.modifiedSections.join(' ') + ' ' + changes.summary;
            const mentionedArtifacts = this.parseMentions(changeText);
            let referencedArtifacts: ReferencedArtifact[] = [];
            if (mentionedArtifacts.length > 0) {
                referencedArtifacts = await this.loadReferencedArtifacts(mentionedArtifacts);
                this.logger.log(`[Cascade] Found ${referencedArtifacts.length} referenced artifact(s): ${referencedArtifacts.map(r => r.name).join(', ')}`);
            }

            const prompts = await this.loadPrompts('refineDocument');
            
            // Format system prompt with context
            const systemPrompt = prompts.system
                .replace('{modified_sections}', changes.modifiedSections.join(', '))
                .replace('{change_summary}', changes.summary);

            // Build reference block for user prompt
            const referenceBlock = referencedArtifacts.length > 0
                ? `\n\nReferenced artifacts (for context):\n${this.formatReferencedArtifacts(referencedArtifacts)}`
                : '';

            // Format user prompt with context
            const userPrompt = prompts.user
                .replace('{modified_sections}', changes.modifiedSections.join(', '))
                .replace('{change_summary}', changes.summary)
                .replace('{current_content}', currentContent + referenceBlock);

            const messages: ChatMessage[] = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ];

            this.logger.log('[Cascade] Calling AI for document refinement...');
            const logId = await this.promptLogger.logRequest(this.workspaceRoot, 'refine-document', systemPrompt, userPrompt);
            const refinedContent = await this.xaiClient.chat(messages, { maxTokens: 4000 });
            await this.promptLogger.logResponse(this.workspaceRoot, logId, 'refine-document', refinedContent);

            if (refinedContent && refinedContent.trim().length > 100) {
                await fs.writeFile(filePath, refinedContent, 'utf-8');
                result.updatedFiles.push(filePath);
                this.logger.log(`[Cascade] ✅ Refined source document: ${path.basename(filePath)}`);
            } else {
                this.logger.log('[Cascade] No refinements needed for source document');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.log(`[Cascade] ⚠️  Document refinement skipped: ${errorMsg}`);
            // Don't fail cascade if refinement fails
        }
    }

    private async detectChanges(filePath: string, currentContent: string): Promise<ChangeDetectionResult> {
        // First try to get last committed content
        let oldContent = await GitHelper.getLastCommittedContent(this.workspaceRoot, filePath);
        
        // If no committed content, try to get staged content (for new files that are staged)
        if (!oldContent) {
            oldContent = await GitHelper.getStagedContent(this.workspaceRoot, filePath);
        }
        
        // If still no content, try to get baseline from cache
        if (!oldContent) {
            const cacheDir = path.join(this.workspaceRoot, '.promptpress', 'cache');
            const baselineFile = path.join(cacheDir, path.basename(filePath) + '.baseline');
            try {
                oldContent = await fs.readFile(baselineFile, 'utf-8');
                this.logger.log('[Cascade] Using baseline from cache for change detection');
            } catch {
                // No baseline either
            }
        }
        
        if (oldContent) {
            return DiffHelper.compareContent(oldContent, currentContent);
        } else {
            // No git history, staged content, or baseline, treat as no changes (since we can't determine what changed)
            this.logger.log('[Cascade] No git history, staged content, or baseline found; cannot detect changes');
            return {
                hasChanges: false,
                modifiedSections: [],
                summary: 'No git history, staged content, or baseline available for change detection',
                oldContent: '',
                newContent: currentContent
            };
        }
    }

    private async updateBaselineCache(filePath: string, content: string): Promise<void> {
        try {
            const cacheDir = path.join(this.workspaceRoot, '.promptpress', 'cache');
            await fs.mkdir(cacheDir, { recursive: true });
            const baselineFile = path.join(cacheDir, path.basename(filePath) + '.baseline');
            await fs.writeFile(baselineFile, content, 'utf-8');
            this.logger.log(`[Cascade] Updated baseline cache for ${path.basename(filePath)}`);
        } catch (error) {
            this.logger.log(`[Cascade] Warning: Failed to update baseline cache: ${error}`);
        }
    }

    private buildConfirmMessage(metadata: any, changes: ChangeDetectionResult): string {
        return `Cascade changes from ${metadata.artifact}.${metadata.phase}?\n\n` +
            `Changes: ${changes.summary}\n` +
            `Modified sections: ${changes.modifiedSections.join(', ')}\n\n` +
            `This will regenerate dependent specifications.`;
    }

    private async cascadeFromRequirement(
        filePath: string,
        currentContent: string,
        changes: ChangeDetectionResult,
        result: CascadeResult
    ): Promise<void> {
        const parsed = this.parser.parse(currentContent);
        const metadata = parsed.metadata;
        if (!metadata) {
            result.errors.push('Failed to parse metadata');
            return;
        }

        const artifactName = metadata.artifact;
        const specsDir = path.dirname(path.dirname(filePath));
        const designFile = path.join(specsDir, 'design', `${artifactName}.design.md`);
        const implFile = path.join(specsDir, 'implementation', `${artifactName}.impl.md`);

        try {
            const designExists = await this.fileExists(designFile);
            if (designExists) {
                this.logger.log('[Cascade] Regenerating design specification...');
                const newDesign = await this.generateDesignWithModification(
                    currentContent,
                    changes.modifiedSections,
                    changes.summary
                );
                await fs.mkdir(path.dirname(designFile), { recursive: true });
                await fs.writeFile(designFile, newDesign, 'utf-8');
                result.updatedFiles.push(designFile);
                this.logger.log(`[Cascade] ✅ Updated ${path.basename(designFile)}`);

                const implExists = await this.fileExists(implFile);
                if (implExists) {
                    this.logger.log('[Cascade] Regenerating implementation specification...');
                    const newImpl = await this.syncImplementationSpecWithModification(
                        currentContent,
                        newDesign,
                        changes.modifiedSections,
                        changes.summary
                    );
                    await fs.mkdir(path.dirname(implFile), { recursive: true });
                    await fs.writeFile(implFile, newImpl, 'utf-8');
                    result.updatedFiles.push(implFile);
                    this.logger.log(`[Cascade] ✅ Updated ${path.basename(implFile)}`);
                }
            } else {
                this.logger.log('[Cascade] No design file found, skipping cascade');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to cascade: ${errorMsg}`);
            this.logger.log(`[Cascade] ❌ Error: ${errorMsg}`);
        }
    }

    private async cascadeFromDesign(
        filePath: string,
        currentContent: string,
        changes: ChangeDetectionResult,
        result: CascadeResult
    ): Promise<void> {
        const parsed = this.parser.parse(currentContent);
        const metadata = parsed.metadata;
        if (!metadata) {
            result.errors.push('Failed to parse metadata');
            return;
        }

        const artifactName = metadata.artifact;
        const specsDir = path.dirname(path.dirname(filePath));
        const reqFile = path.join(specsDir, 'requirements', `${artifactName}.req.md`);
        const implFile = path.join(specsDir, 'implementation', `${artifactName}.impl.md`);

        try {
            const implExists = await this.fileExists(implFile);
            const reqExists = await this.fileExists(reqFile);

            if (!reqExists) {
                result.errors.push('Cannot cascade from design without requirement file');
                return;
            }

            const requirement = await fs.readFile(reqFile, 'utf-8');

            if (implExists) {
                this.logger.log('[Cascade] Regenerating implementation specification...');
                const newImpl = await this.syncImplementationSpecWithModification(
                    requirement,
                    currentContent,
                    changes.modifiedSections,
                    changes.summary
                );
                await fs.mkdir(path.dirname(implFile), { recursive: true });
                await fs.writeFile(implFile, newImpl, 'utf-8');
                result.updatedFiles.push(implFile);
                this.logger.log(`[Cascade] ✅ Updated ${path.basename(implFile)}`);
            } else {
                this.logger.log('[Cascade] No implementation file found, skipping cascade');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to cascade: ${errorMsg}`);
            this.logger.log(`[Cascade] ❌ Error: ${errorMsg}`);
        }
    }

    private async generateDesignWithModification(
        requirement: string,
        modifiedSections: string[],
        changeSummary: string
    ): Promise<string> {
        const parsed = this.parser.parse(requirement);
        const metadata = parsed.metadata;
        const artifactName = metadata?.artifact || 'artifact';
        const artifactTitle = artifactName.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        const prompts = await this.loadPrompts('generateDesign');
        
        // Format system prompt with context
        const systemPrompt = prompts.system
            .replace('{change_summary}', changeSummary)
            .replace('{modified_sections}', modifiedSections.join(', '))
            .replace(/{artifact_name}/g, artifactName)
            .replace('{last_updated}', new Date().toISOString().split('T')[0])
            .replace('{artifact_title}', artifactTitle);

        // Format user prompt with context
        const userPrompt = prompts.user
            .replace('{change_summary}', changeSummary)
            .replace('{modified_sections}', modifiedSections.join(', '))
            .replace('{requirement_excerpt}', requirement.substring(0, 3000) + '...');

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        this.logger.log('[Cascade] Calling AI to generate updated design...');
        const logId = await this.promptLogger.logRequest(this.workspaceRoot, 'generate-design', systemPrompt, userPrompt);
        const response = await this.xaiClient.chat(messages, { maxTokens: 4000 });
        await this.promptLogger.logResponse(this.workspaceRoot, logId, 'generate-design', response);

        return response;
    }

    private async syncImplementationSpecWithModification(
        requirement: string,
        design: string,
        modifiedSections: string[],
        changeSummary: string
    ): Promise<string> {
        const parsed = this.parser.parse(requirement);
        const metadata = parsed.metadata;
        const artifactName = metadata?.artifact || 'artifact';
        const artifactTitle = artifactName.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        const prompts = await this.loadPrompts('syncImplementationSpec');
        
        // Format system prompt with context
        const systemPrompt = prompts.system
            .replace('{change_summary}', changeSummary)
            .replace('{modified_sections}', modifiedSections.join(', '))
            .replace(/{artifact_name}/g, artifactName)
            .replace('{last_updated}', new Date().toISOString().split('T')[0])
            .replace('{artifact_title}', artifactTitle);

        // Format user prompt with context
        const userPrompt = prompts.user
            .replace('{change_summary}', changeSummary)
            .replace('{modified_sections}', modifiedSections.join(', '))
            .replace('{requirement_excerpt}', requirement.substring(0, 1000) + '...')
            .replace('{design_excerpt}', design.substring(0, 1500) + '...');

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        this.logger.log('[Cascade] Calling AI to generate updated implementation...');
        const logId = await this.promptLogger.logRequest(this.workspaceRoot, 'sync-implementation', systemPrompt, userPrompt);
        const response = await this.xaiClient.chat(messages, { maxTokens: 4000 });
        await this.promptLogger.logResponse(this.workspaceRoot, logId, 'sync-implementation', response);

        return response;
    }

    private async applyTersifyChanges(
        sourcePath: string,
        sourceContent: string,
        referencedDocs: { filename: string; content: string }[],
        aiResponse: string,
        result: CascadeResult,
        specsDir: string
    ): Promise<void> {
        // Parse the AI response table
        const tableChanges = this.parser.parseChangeTable(aiResponse);

        // Group changes by document
        const changesByDoc = this.parser.groupChangesByDocument(tableChanges);

        // Apply changes to each document
        for (const [docName, changes] of changesByDoc) {
            await this.applyChangesToDocument(docName, changes, result, specsDir, sourcePath);
        }
    }

    private async applyChangesToDocument(
        docName: string,
        changes: { type: string; section: string; content: string }[],
        result: CascadeResult,
        specsDir: string,
        sourcePath: string
    ): Promise<void> {
        let filePath: string;
        if (docName === path.basename(sourcePath, '.md')) {
            filePath = sourcePath;
        } else {
            // Parse docName to determine correct path
            const parts = docName.split('.');
            let baseName: string;
            let specificPhase: string | null = null;

            if (parts.length === 2 && (parts[1] === 'req' || parts[1] === 'design')) {
                baseName = parts[0];
                specificPhase = parts[1];
            } else {
                baseName = docName;
            }

            if (specificPhase) {
                const phaseDir = specificPhase === 'req' ? 'requirements' : 'design';
                filePath = path.join(specsDir, phaseDir, `${baseName}.${specificPhase}.md`);
            } else {
                filePath = path.join(specsDir, `${docName}.md`);
            }
        }

        let content = await fs.readFile(filePath, 'utf-8');
        const originalContent = content;

        for (const change of changes) {
            content = this.applyChange(content, change);
        }

        if (content !== originalContent) {
            await fs.writeFile(filePath, content, 'utf-8');
            result.updatedFiles.push(filePath);
            this.logger.log(`[Tersify] Updated ${docName}`);
        } else {
            this.logger.log(`[Tersify] No changes applied to ${docName} - text not found or already up to date`);
        }
    }

    private parseSection(section: string): { primary: string; secondary?: string } {
        if (section === 'AI-CLARIFY section') {
            return { primary: 'Questions & Clarifications' };
        }
        const parts = section.split(' ');
        if (parts.length > 1) {
            const lastPart = parts[parts.length - 1];
            if (/^(FR|NFR)-\d+$/.test(lastPart)) {
                return { primary: parts.slice(0, -1).join(' '), secondary: lastPart };
            }
        }
        return { primary: section };
    }

    // promptpress/IMP-1027
    public applyChange(content: string, change: { type: string; section: string; content: string }): string {
        const { primary, secondary } = this.parseSection(change.section);
        let contentToMatch = change.content;
        
        if (change.type === 'Remove from' && secondary) {
            // For secondary sections, remove the label prefix from the content to match
            const labelPrefix = `${secondary}: `;
            if (contentToMatch.startsWith(labelPrefix)) {
                contentToMatch = contentToMatch.substring(labelPrefix.length);
            }
        }
        
        // Normalize for comparison (trim, collapse spaces, remove trailing punctuation)
        const normalize = (str: string) => str.trim().replace(/\s+/g, ' ').replace(/[;.,]$/, '');
        const normalizedCurrent = normalize(this.parser.getSection(content, primary, secondary));
        const normalizedToMatch = normalize(contentToMatch);
        
        if (change.type === 'Remove from') {
            const current = this.parser.getSection(content, primary, secondary);
            this.logger.log(`[Tersify] Current section content for ${primary}${secondary ? ' ' + secondary : ''}: "${current.substring(0, 200)}${current.length > 200 ? '...' : ''}"`);
            if (!normalizedCurrent.includes(normalizedToMatch)) {
                this.logger.log(`[Tersify] Warning: Text to remove not found in ${primary}${secondary ? ' ' + secondary : ''}: ${contentToMatch.substring(0, 100)}${contentToMatch.length > 100 ? '...' : ''}`);
                this.logger.log(`[Tersify] Normalized current: "${normalizedCurrent.substring(0, 200)}"`);
                this.logger.log(`[Tersify] Normalized to match: "${normalizedToMatch.substring(0, 100)}"`);
            }
            const newContent = current.replace(contentToMatch, '').trim();
            return this.parser.setSection(content, primary, secondary, newContent);
        } else if (change.type === 'Add to') {
            const current = this.parser.getSection(content, primary, secondary);
            const newContent = current ? current + '\n' + contentToMatch : contentToMatch;
            return this.parser.setSection(content, primary, secondary, newContent);
        } else {
            this.logger.log(`[Tersify] Warning: Unknown change type "${change.type}"`);
        }
        return content;
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
