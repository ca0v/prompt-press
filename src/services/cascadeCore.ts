/**
 * CascadeCore contains the platform-agnostic cascade logic.
 * It avoids vscode dependencies and logs via a provided logger (defaults to console).
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { XAIClient, ChatMessage } from '../ai/xaiClient';
import { MarkdownParser } from '../parsers/markdownParser';

// Prompt file paths
const PROMPTS = {
    refineDocument: path.join(__dirname, '../prompts/refineDocument.md'),
    generateDesign: path.join(__dirname, '../prompts/generateDesign.md'),
    generateImplementation: path.join(__dirname, '../prompts/generateImplementation.md')
};

export interface ChangeDetectionResult {
    hasChanges: boolean;
    modifiedSections: string[];
    summary: string;
    oldContent: string;
    newContent: string;
}

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
    private cacheDir: string;
    private promptCache: Map<string, { system: string; user: string }> = new Map();

    constructor(
        private xaiClient: XAIClient,
        private workspaceRoot: string,
        private logger: Logger = console
    ) {
        this.parser = new MarkdownParser();
        this.cacheDir = path.join(workspaceRoot, '.promptpress', 'cache');
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
            const req = path.join(specsDir, 'requirements', `${name}.req.md`);
            const design = path.join(specsDir, 'design', `${name}.design.md`);

            const ref: ReferencedArtifact = { name };
            try {
                ref.requirement = await fs.readFile(req, 'utf-8');
            } catch {}
            try {
                ref.design = await fs.readFile(design, 'utf-8');
            } catch {}

            if (ref.requirement || ref.design) {
                results.push(ref);
            }
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

    async applyChanges(
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

            await fs.mkdir(this.cacheDir, { recursive: true });

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

            await this.updateCache(filePath, currentContent);

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

    private async checkGitStatus(): Promise<boolean> {
        try {
            const { execSync } = require('child_process');
            // Check for unstaged changes only (leading space means staged, M/A/D means unstaged)
            const status = execSync('git status --porcelain', {
                cwd: this.workspaceRoot,
                encoding: 'utf-8'
            });
            // Lines starting with space followed by M/A/D are unstaged changes
            const unstaged = status
                .split('\n')
                .filter((line: string) => line.match(/^\s[MAD]/));
            return unstaged.length > 0;
        } catch {
            // Git not available or not a git repo - proceed without check
            return false;
        }
    }

    private async stageChanges(): Promise<void> {
        try {
            const { execSync } = require('child_process');
            execSync('git add -A', {
                cwd: this.workspaceRoot,
                encoding: 'utf-8'
            });
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
        const cacheFile = path.join(this.cacheDir, `${path.basename(filePath)}.baseline`);
        try {
            const cachedContent = await fs.readFile(cacheFile, 'utf-8');
            return this.compareContent(cachedContent, currentContent);
        } catch {
            return await this.detectChangesFromGit(filePath, currentContent);
        }
    }

    private async detectChangesFromGit(filePath: string, currentContent: string): Promise<ChangeDetectionResult> {
        try {
            const { execSync } = require('child_process');
            const gitRoot = execSync('git rev-parse --show-toplevel', { cwd: this.workspaceRoot }).toString().trim();
            const relativePath = path.relative(gitRoot, filePath);
            
            try {
                // Try to get last committed version
                const oldContent = execSync(`git show HEAD:"${relativePath}"`, {
                    cwd: gitRoot,
                    encoding: 'utf-8'
                });
                return this.compareContent(oldContent, currentContent);
            } catch (gitError) {
                // File not in git yet or other issue
                // Check if file has been modified since last commit
                const gitStatus = execSync(`git status --porcelain "${relativePath}"`, {
                    cwd: gitRoot,
                    encoding: 'utf-8'
                }).trim();
                
                // If file appears modified in git status, treat all content as changes
                if (gitStatus.length > 0) {
                    this.logger.log('[Cascade] No git history found, but file has uncommitted changes; treating all content as modifications');
                    return {
                        hasChanges: true,
                        modifiedSections: ['All sections'],
                        summary: 'New or significantly modified file',
                        oldContent: '',
                        newContent: currentContent
                    };
                }
                
                // File not modified - no changes
                return {
                    hasChanges: false,
                    modifiedSections: [],
                    summary: 'No changes',
                    oldContent: '',
                    newContent: currentContent
                };
            }
        } catch (error) {
            this.logger.log('[Cascade] Git not available; treating all content as changes');
            // Not a git repo - treat as new file with all content as changes
            return {
                hasChanges: true,
                modifiedSections: ['All sections'],
                summary: 'New or significantly modified file',
                oldContent: '',
                newContent: currentContent
            };
        }
    }

    private compareContent(oldContent: string, newContent: string): ChangeDetectionResult {
        if (oldContent === newContent) {
            return {
                hasChanges: false,
                modifiedSections: [],
                summary: 'No changes',
                oldContent,
                newContent
            };
        }

        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const modifiedSections = this.findModifiedSections(oldLines, newLines);
        const summary = this.generateChangeSummary(oldLines, newLines, modifiedSections);

        return {
            hasChanges: true,
            modifiedSections,
            summary,
            oldContent,
            newContent
        };
    }

    private findModifiedSections(oldLines: string[], newLines: string[]): string[] {
        const sections = new Set<string>();
        const oldSections = this.buildSectionMap(oldLines);
        const newSections = this.buildSectionMap(newLines);

        for (const [section, newContent] of newSections) {
            const oldContent = oldSections.get(section);
            if (!oldContent || oldContent !== newContent) {
                sections.add(section);
            }
        }
        for (const section of oldSections.keys()) {
            if (!newSections.has(section)) {
                sections.add(section);
            }
        }
        return Array.from(sections);
    }

    private buildSectionMap(lines: string[]): Map<string, string> {
        const sections = new Map<string, string>();
        let currentSection = '';
        let currentContent: string[] = [];

        for (const line of lines) {
            if (line.startsWith('##')) {
                if (currentSection) {
                    sections.set(currentSection, currentContent.join('\n'));
                }
                currentSection = line.replace(/^##\s+/, '').trim();
                currentContent = [];
            } else if (currentSection) {
                currentContent.push(line);
            }
        }
        if (currentSection) {
            sections.set(currentSection, currentContent.join('\n'));
        }
        return sections;
    }

    private generateChangeSummary(oldLines: string[], newLines: string[], modifiedSections: string[]): string {
        const added = newLines.length - oldLines.length;
        const sections = modifiedSections.length;
        let summary = `Modified ${sections} section(s)`;
        if (added > 0) {
            summary += `, added ${added} line(s)`;
        } else if (added < 0) {
            summary += `, removed ${Math.abs(added)} line(s)`;
        }
        return summary;
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
        const baseDir = path.dirname(filePath);
        const designFile = path.join(baseDir, `${artifactName}.design.md`);
        const implFile = path.join(baseDir, `${artifactName}.impl.md`);

        try {
            const designExists = await this.fileExists(designFile);
            if (designExists) {
                this.logger.log('[Cascade] Regenerating design specification...');
                const newDesign = await this.generateDesignWithModification(
                    currentContent,
                    changes.modifiedSections,
                    changes.summary
                );
                await fs.writeFile(designFile, newDesign, 'utf-8');
                result.updatedFiles.push(designFile);
                this.logger.log(`[Cascade] ✅ Updated ${path.basename(designFile)}`);

                const implExists = await this.fileExists(implFile);
                if (implExists) {
                    this.logger.log('[Cascade] Regenerating implementation specification...');
                    const newImpl = await this.generateImplementationWithModification(
                        currentContent,
                        newDesign,
                        changes.modifiedSections,
                        changes.summary
                    );
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
        const baseDir = path.dirname(filePath);
        const reqFile = path.join(baseDir, `${artifactName}.req.md`);
        const implFile = path.join(baseDir, `${artifactName}.impl.md`);

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
                const newImpl = await this.generateImplementationWithModification(
                    requirement,
                    currentContent,
                    changes.modifiedSections,
                    changes.summary
                );
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

    private async generateImplementationWithModification(
        requirement: string,
        design: string,
        modifiedSections: string[],
        changeSummary: string
    ): Promise<string> {
        const parsed = this.parser.parse(requirement);
        const metadata = parsed.metadata;
        const artifactName = metadata?.artifact || 'artifact';
        const artifactTitle = artifactName.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        const prompts = await this.loadPrompts('generateImplementation');
        
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

    private async updateCache(filePath: string, content: string): Promise<void> {
        const cacheFile = path.join(this.cacheDir, `${path.basename(filePath)}.baseline`);
        await fs.writeFile(cacheFile, content, 'utf-8');
        this.logger.log(`[Cascade] Updated baseline cache for ${path.basename(filePath)}`);
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
