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
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor(
        enabled: boolean = true,
        workspaceRoot: string = '',
        diagnosticCollection?: vscode.DiagnosticCollection
    ) {
        this.enabled = enabled;
        this.parser = new MarkdownParser();
        this.workspaceRoot = workspaceRoot;
        this.diagnosticCollection = diagnosticCollection || vscode.languages.createDiagnosticCollection('promptpress');
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

        // On create: validate references
        if (changeType === 'created') {
            await this.validateReferences(filePath);
        }

        // On modify: update last-updated and validate references
        if (changeType === 'modified') {
            await this.updateMetadata(filePath);
            await this.validateReferences(filePath);
        }

        // On delete: clear diagnostics
        if (changeType === 'deleted') {
            this.diagnosticCollection.delete(uri);
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

                // Set artifact from filename if not present
                const fileName = path.basename(filePath);
                const artifactName = fileName.replace(/\.(req|design|impl)\.md$/, '');
                if (parsed.metadata.artifact === 'unknown') {
                    parsed.metadata.artifact = artifactName;
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
        const diagnostics: vscode.Diagnostic[] = [];

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = this.parser.parse(content);

            const fileName = path.basename(filePath);
            const specRef = fileName.replace(/\.(req|design|impl)\.md$/, '.$1');

            // Validate depends-on
            if (parsed.metadata.dependsOn) {
                for (const dep of parsed.metadata.dependsOn) {
                    const range = this.findMetadataRange(content, 'depends-on', dep);
                    
                    // Check over-specification
                    if (!/^[a-zA-Z0-9-]+\.(req|design|impl)$/.test(dep)) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `Depends-on '${dep}' is over-specified`,
                            vscode.DiagnosticSeverity.Warning
                        ));
                    } else {
                        // Check existence
                        if (!await this.fileExists(this.resolveSpecPath(dep))) {
                            diagnostics.push(new vscode.Diagnostic(
                                range,
                                `Dependency '${dep}' not found`,
                                vscode.DiagnosticSeverity.Warning
                            ));
                        } else {
                            // Check circular dependency
                            const allDeps = await this.getAllDependencies(dep);
                            if (allDeps.has(specRef)) {
                                diagnostics.push(new vscode.Diagnostic(
                                    range,
                                    `Dependency '${dep}' creates a circular dependency`,
                                    vscode.DiagnosticSeverity.Warning
                                ));
                            }
                        }
                    }
                }
            }

            // Validate references
            if (parsed.metadata.references) {
                for (const ref of parsed.metadata.references) {
                    const range = this.findMetadataRange(content, 'references', ref);
                    
                    // Check over-specification
                    if (!/^[a-zA-Z0-9-]+\.(req|design|impl)$/.test(ref)) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `Reference '${ref}' is over-specified`,
                            vscode.DiagnosticSeverity.Warning
                        ));
                    } else {
                        // Check existence
                        if (!await this.fileExists(this.resolveSpecPath(ref))) {
                            diagnostics.push(new vscode.Diagnostic(
                                range,
                                `Reference '${ref}' not found`,
                                vscode.DiagnosticSeverity.Warning
                            ));
                        }
                    }
                }
            }

            // Validate content references
            for (const ref of parsed.references) {
                const range = this.findContentReferenceRange(content, ref);
                
                // Check over-specification
                if (!/^[a-zA-Z0-9-]+\.(req|design|impl)$/.test(ref)) {
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `Mention '${ref}' is over-specified`,
                        vscode.DiagnosticSeverity.Warning
                    ));
                } else {
                    // Check existence
                    if (!await this.fileExists(this.resolveSpecPath(ref))) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `Mention '${ref}' not found`,
                            vscode.DiagnosticSeverity.Warning
                        ));
                    }
                }
            }
        } catch (error) {
            // If parsing fails, don't add diagnostics
        }

        // Set diagnostics for this file
        this.diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
    }

    private resolveSpecPath(specRef: string): string {
        // specRef format: "artifact-name.phase"
        const [artifact, phase] = specRef.split('.');
        let subdir = '';
        if (phase === 'req') {
            subdir = 'requirements';
        } else if (phase === 'design') {
            subdir = 'design';
        } else if (phase === 'impl') {
            subdir = 'implementation';
        }
        if (subdir) {
            return path.join(this.workspaceRoot, 'specs', subdir, `${artifact}.${phase}.md`);
        } else {
            return path.join(this.workspaceRoot, 'specs', `${artifact}.${phase}.md`);
        }
    }

    private findMetadataRange(content: string, key: string, value: string): vscode.Range {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith(`${key}:`) && line.includes(value)) {
                return new vscode.Range(i, 0, i, line.length);
            }
        }
        // Fallback to first line of frontmatter
        return new vscode.Range(0, 0, 0, lines[0]?.length || 0);
    }

    private findContentReferenceRange(content: string, ref: string): vscode.Range {
        const lines = content.split('\n');
        const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`@${escapedRef}`, 'g');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (regex.test(line)) {
                const index = line.indexOf(`@${ref}`);
                return new vscode.Range(i, index, i, index + `@${ref}`.length);
            }
        }
        // Fallback
        return new vscode.Range(0, 0, 0, 0);
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

    public async validateFile(filePath: string): Promise<void> {
        await this.validateReferences(filePath);
    }

    private async getAllDependencies(specRef: string, visited: Set<string> = new Set()): Promise<Set<string>> {
        if (visited.has(specRef)) {
            return new Set(); // Cycle detected, but return empty to avoid infinite
        }
        visited.add(specRef);

        const filePath = this.resolveSpecPath(specRef);
        if (!await this.fileExists(filePath)) {
            return new Set();
        }

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = this.parser.parse(content);
            const deps = new Set<string>();

            if (parsed.metadata.dependsOn) {
                for (const dep of parsed.metadata.dependsOn) {
                    if (!visited.has(dep)) {
                        deps.add(dep);
                        const subDeps = await this.getAllDependencies(dep, new Set(visited));
                        subDeps.forEach(d => deps.add(d));
                    }
                }
            }

            return deps;
        } catch {
            return new Set();
        }
    }

    public dispose() {
        this.watcher?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
