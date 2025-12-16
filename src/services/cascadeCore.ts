/**
 * CascadeCore contains the platform-agnostic cascade logic.
 * It avoids vscode dependencies and logs via a provided logger (defaults to console).
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { XAIClient, ChatMessage } from '../ai/xaiClient';
import { MarkdownParser } from '../parsers/markdownParser';

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
    confirmGitStatus(hasUncommitted: boolean): Promise<'commit'  | 'continue' | 'cancel'>;
    notifyInfo(message: string): void;
    notifyError(message: string): void;
}

export interface Logger {
    log(message: string): void;
}

export class CascadeCore {
    private parser: MarkdownParser;
    private cacheDir: string;

    constructor(
        private xaiClient: XAIClient,
        private workspaceRoot: string,
        private logger: Logger = console
    ) {
        this.parser = new MarkdownParser();
        this.cacheDir = path.join(workspaceRoot, '.promptpress', 'cache');
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

            // Check git status
            const hasUncommitted = await this.checkGitStatus();
            if (hasUncommitted) {
                const gitAction = await ui.confirmGitStatus(hasUncommitted);
                if (gitAction === 'cancel') {
                    this.logger.log('[Cascade] User cancelled due to uncommitted changes');
                    result.success = true;
                    return result;
                } else if (gitAction === 'commit') {
                    ui.notifyInfo('Please commit your changes, then run Apply Changes again.');
                    result.success = true;
                    return result;
                }
                // 'continue' falls through
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
            const status = execSync('git status --porcelain', {
                cwd: this.workspaceRoot,
                encoding: 'utf-8'
            });
            return status.trim().length > 0;
        } catch {
            // Git not available or not a git repo - proceed without check
            return false;
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

            const systemPrompt = `You are an expert at refining technical specifications. Analyze the changes in this ${metadata.phase} specification and determine if any content should be extracted into formal sections.

For REQUIREMENT specs:
- Extract functional/non-functional requirements from prose in Overview or other sections
- Number them appropriately (FR-N, NFR-N)
- Ensure requirements are atomic, testable, and unambiguous

For DESIGN specs:
- Extract component descriptions, API contracts, data structures from discussions
- Organize into proper sections (Components, APIs, Data Models)
- Clarify architectural decisions

For IMPLEMENTATION specs:
- Extract precise code generation instructions from notes
- Organize into File Structure, Module Implementation sections
- Add missing error handling or edge cases

Return the refined document in full. Preserve the original metadata header exactly. Only make changes if meaningful extractions or clarifications are needed. If no refinement needed, return empty string.`;

            const userPrompt = `Modified sections: ${changes.modifiedSections.join(', ')}

Changes summary: ${changes.summary}

Current document:
${currentContent}

Refine this document by extracting structured content from the changes. Return the complete refined document or empty string if no refinement needed.`;

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

        const systemPrompt = `You are an expert software architect. Generate an UPDATED PromptPress design specification based on the modified requirements.

IMPORTANT: The requirements have been updated. Changes: ${changeSummary}
Modified sections: ${modifiedSections.join(', ')}

Your design MUST address these changes and integrate them properly.

Structure:
---
artifact: ${artifactName}
phase: design
depends-on: [${artifactName}.req]
references: []
version: 1.0.0
last-updated: ${new Date().toISOString().split('T')[0]}
---

# ${artifactName.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} - Design

## Architecture Overview
[High-level architecture description - UPDATE for changes]

## Component Design
[Detailed component breakdown - INCLUDE new/modified components]

## Data Structures
[Key data structures - ADD structures for changes]

## API Design
[Interface definitions - INCLUDE new/modified APIs]

## Performance Considerations
[Optimization strategies - CONSIDER performance impacts]

Be specific and technically detailed. ENSURE changes are properly integrated into the design.`;

        const userPrompt = `The requirements have been updated. Key changes: ${changeSummary}

Modified sections: ${modifiedSections.join(', ')}

Generate an updated design specification that incorporates these changes:

UPDATED REQUIREMENTS:
${requirement.substring(0, 3000)}...

Focus on how these changes integrate with or modify the existing architecture.`;

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

        const systemPrompt = `You are an expert at writing precise implementation specifications. Generate an UPDATED PromptPress implementation specification.

IMPORTANT: The design has been updated. Changes: ${changeSummary}
Modified sections: ${modifiedSections.join(', ')}

Your implementation MUST include precise instructions for implementing these changes.

Structure:
---
artifact: ${artifactName}
phase: implementation
depends-on: [${artifactName}.req, ${artifactName}.design]
references: []
version: 1.0.0
last-updated: ${new Date().toISOString().split('T')[0]}
---

# ${artifactName.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} - Implementation

## File Structure
[Detailed file organization - INCLUDE files for changes]

## Module Implementation
[Precise implementation details - DETAIL changed/new modules]

## Code Generation Instructions
[Exact instructions for code generation - SPECIFY change implementation]

Be extremely precise and unambiguous. ENSURE changes are fully specified for code generation.`;

        const userPrompt = `Based on updated requirements and design that include these changes: ${changeSummary}

Modified sections: ${modifiedSections.join(', ')}

Generate complete implementation specification:

REQUIREMENTS (excerpt):
${requirement.substring(0, 1000)}...

DESIGN (excerpt):
${design.substring(0, 1500)}...

Provide detailed implementation instructions for the changes along with preserving existing functionality.`;

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
