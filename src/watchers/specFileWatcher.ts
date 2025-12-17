import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { MarkdownParser, SpecMetadata } from '../parsers/markdownParser';

export class SpecFileWatcher implements vscode.Disposable {
    private watcher: vscode.FileSystemWatcher | undefined;
    private enabled: boolean;
    private disposables: vscode.Disposable[] = [];
    private parser: MarkdownParser;
    private workspaceRoot: string;

    constructor(
        enabled: boolean = true,
        workspaceRoot: string = ''
    ) {
        this.enabled = enabled;
        this.parser = new MarkdownParser();
        this.workspaceRoot = workspaceRoot;
        if (enabled) {
            this.startWatching();
        }
    }

    private startWatching() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        this.workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Watch for changes in specs directory
        const pattern = new vscode.RelativePattern(
            workspaceFolders[0],
            'specs/**/*.{req.md,design.md,impl.md}'
        );

        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

        // File created
        this.watcher.onDidCreate((uri) => {
            this.handleFileChange(uri, 'created');
        }, null, this.disposables);

        // File changed
        this.watcher.onDidChange((uri) => {
            this.handleFileChange(uri, 'modified');
        }, null, this.disposables);

        // File deleted
        this.watcher.onDidDelete((uri) => {
            this.handleFileChange(uri, 'deleted');
        }, null, this.disposables);

        console.log('PromptPress: File watcher started');
    }

    private async handleFileChange(uri: vscode.Uri, changeType: 'created' | 'modified' | 'deleted') {
        if (!this.enabled) {
            return;
        }

        const filePath = uri.fsPath;
        const fileName = path.basename(filePath);
        
        console.log(`PromptPress: File ${changeType}: ${fileName}`);

        // Determine spec type
        const specType = this.getSpecType(fileName);
        if (!specType) {
            return;
        }

        // On modify: update last-updated and validate references
        if (changeType === 'modified') {
            await this.updateMetadata(filePath);
            await this.validateReferences(filePath);
        }
    }

    private async updateMetadata(filePath: string): Promise<void> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = this.parser.parse(content);
            if (parsed.metadata) {
                const today = new Date().toISOString().split('T')[0];
                parsed.metadata.lastUpdated = today;

                // Enforce correct phase based on file extension
                if (filePath.endsWith('.req.md')) {
                    parsed.metadata.phase = 'requirement';
                } else if (filePath.endsWith('.design.md')) {
                    parsed.metadata.phase = 'design';
                } else if (filePath.endsWith('.impl.md')) {
                    parsed.metadata.phase = 'implementation';
                }

                // Reconstruct frontmatter with updated metadata
                const updatedContent = this.updateFrontmatter(content, parsed.metadata);
                // Only write if changed
                if (updatedContent !== content) {
                    await fs.writeFile(filePath, updatedContent, 'utf-8');
                    console.log(`PromptPress: Updated last-updated/phase in ${path.basename(filePath)}`);
                }
            }
        } catch (error) {
            console.warn(`PromptPress: Could not update metadata for ${path.basename(filePath)}: ${error}`);
        }
    }

    private updateFrontmatter(content: string, metadata: SpecMetadata): string {
        // Remove existing frontmatter
        const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');
        
        // Reconstruct frontmatter
        const frontmatterLines = [
            '---',
            `artifact: ${metadata.artifact}`,
            `phase: ${metadata.phase}`,
        ];
        
        if (metadata.dependsOn !== undefined) {
            const items = (metadata.dependsOn || []).map(v => `"${v}"`).join(', ');
            frontmatterLines.push(`depends-on: [${items}]`);
        }
        if (metadata.references !== undefined) {
            const items = (metadata.references || []).map(v => `"${v}"`).join(', ');
            frontmatterLines.push(`references: [${items}]`);
        }
        if (metadata.version) {
            frontmatterLines.push(`version: ${metadata.version}`);
        }
        if (metadata.lastUpdated) {
            frontmatterLines.push(`last-updated: ${metadata.lastUpdated}`);
        }
        frontmatterLines.push('---');
        
        return frontmatterLines.join('\n') + '\n' + withoutFrontmatter;
    }

    private async validateReferences(filePath: string): Promise<void> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = this.parser.parse(content);
            const warnings: string[] = [];

            // Validate depends-on (format: artifact.phase)
            if (parsed.metadata.dependsOn) {
                for (const dep of parsed.metadata.dependsOn) {
                    if (!await this.fileExists(this.resolveSpecPath(dep))) {
                        warnings.push(`depends-on: ${dep} not found`);
                    }
                }
            }

            // Validate references (format: artifact.phase)
            if (parsed.metadata.references) {
                for (const ref of parsed.metadata.references) {
                    if (!await this.fileExists(this.resolveSpecPath(ref))) {
                        warnings.push(`references: ${ref} not found`);
                    }
                }
            }

            // Log warnings if any
            if (warnings.length > 0) {
                console.warn(`PromptPress: Warnings in ${path.basename(filePath)}: ${warnings.join('; ')}`);
            }
        } catch (error) {
            console.warn(`PromptPress: Could not validate references in ${path.basename(filePath)}: ${error}`);
        }
    }

    private resolveSpecPath(specRef: string): string {
        // specRef format: "artifact-name.phase"
        const [artifact, phase] = specRef.split('.');
        return path.join(this.workspaceRoot, 'specs', `${artifact}.${phase}.md`);
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private getSpecType(fileName: string): 'requirement' | 'design' | 'implementation' | null {
        if (fileName.endsWith('.req.md')) {
            return 'requirement';
        } else if (fileName.endsWith('.design.md')) {
            return 'design';
        } else if (fileName.endsWith('.impl.md')) {
            return 'implementation';
        }
        return null;
    }

    public toggleMonitoring() {
        this.enabled = !this.enabled;
        const status = this.enabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`PromptPress: File monitoring ${status}`);
        
        if (this.enabled && !this.watcher) {
            this.startWatching();
        }
    }

    public dispose() {
        this.watcher?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
