/**
 * CascadeCore contains the platform-agnostic cascade logic.
 * It avoids vscode dependencies and logs via a provided logger (defaults to console).
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { XAIClient, ChatMessage } from '../ai/xaiClient.js';
import { MarkdownParser } from '../parsers/markdownParser.js';
import { GitHelper } from './gitHelper.js';
import { DiffHelper, ChangeDetectionResult } from './diffHelper.js';
import { __dirname } from '../utils/dirname.js';

// Prompt file paths
const PROMPTS = {
    refineDocument: path.join(__dirname, '../prompts/refineDocument.md'),
    generateDesign: path.join(__dirname, '../prompts/generateDesign.md'),
    syncImplementationSpec: path.join(__dirname, '../prompts/syncImplementationSpec.md')
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

    constructor(
        private xaiClient: XAIClient,
        private workspaceRoot: string,
        private logger: Logger = console
    ) {
        this.parser = new MarkdownParser();
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
                } catch {}

                try {
                    ref.design = await fs.readFile(designPath, 'utf-8');
                    hasDesign = true;
                } catch {}

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

    public async checkGitStatus(): Promise<boolean> {
        return GitHelper.checkGitStatus(this.workspaceRoot);
    }

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
            const refinedContent = await this.xaiClient.chat(messages, { maxTokens: 4000 });

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
        
        if (oldContent) {
            return DiffHelper.compareContent(oldContent, currentContent);
        } else {
            // No git history or staged content, treat as no changes (since we can't determine what changed)
            this.logger.log('[Cascade] No git history or staged content found; cannot detect changes');
            return {
                hasChanges: false,
                modifiedSections: [],
                summary: 'No git history or staged content available for change detection',
                oldContent: '',
                newContent: currentContent
            };
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
        const response = await this.xaiClient.chat(messages, { maxTokens: 4000 });
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
        const response = await this.xaiClient.chat(messages, { maxTokens: 4000 });
        return response;
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
