import * as vscode from 'vscode';
import * as path from 'path';
import { MarkdownParser } from '../parsers/markdownParser.js';
import { SpecFileProcessor } from '../services/specFileProcessor.js';

export class SpecFileWatcher implements vscode.Disposable {
    private watcher: vscode.FileSystemWatcher | undefined;
    private enabled: boolean;
    private disposables: vscode.Disposable[] = [];
    private parser: MarkdownParser;
    private workspaceRoot: string;
    private diagnosticCollection: vscode.DiagnosticCollection;
    public processor?: SpecFileProcessor;

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
        this.processor = new SpecFileProcessor(this.parser, this.workspaceRoot);

        // Watch for changes in specs directory
        const pattern = new vscode.RelativePattern(
            workspaceFolders[0],
            'specs/**/*.{req.md,design.md,impl.md,md}'
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

        // Determine spec type or if it's ConOps
        const specType = this.getSpecType(fileName);

        // On create: update metadata and validate references
        if (changeType === 'created') {
            if (specType) {
                const document = await vscode.workspace.openTextDocument(filePath);
                await this.processor!.updateMetadata(document);
            }
            await this.processor!.convertOverspecifiedReferences(filePath);
            const errors = await this.processor!.validateReferences(filePath);
            const diagnostics = errors.map(error => new vscode.Diagnostic(
                new vscode.Range(error.line, error.column, error.line, error.column + error.length),
                error.message,
                vscode.DiagnosticSeverity.Warning
            ));
            this.diagnosticCollection.set(uri, diagnostics);
        }

        // On modify: update last-updated and validate references (only for specs, not ConOps)
        if (changeType === 'modified') {
            if (specType) {
                const document = await vscode.workspace.openTextDocument(filePath);
                await this.processor!.updateMetadata(document);
            }
            await this.processor!.convertOverspecifiedReferences(filePath);
            const errors = await this.processor!.validateReferences(filePath);
            const diagnostics = errors.map(error => new vscode.Diagnostic(
                new vscode.Range(error.line, error.column, error.line, error.column + error.length),
                error.message,
                vscode.DiagnosticSeverity.Warning
            ));
            this.diagnosticCollection.set(uri, diagnostics);
        }

        // On delete: clear diagnostics
        if (changeType === 'deleted') {
            this.diagnosticCollection.delete(uri);
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

    // PromptPress/IMP-1073
    public toggleMonitoring() {
        this.enabled = !this.enabled;
        const status = this.enabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`PromptPress: File monitoring ${status}`);
        
        if (this.enabled && !this.watcher) {
            this.startWatching();
        }
    }

    // PromptPress/IMP-1074
    public async validateFile(filePath: string): Promise<void> {
        await this.processor?.convertOverspecifiedReferences(filePath);
    }

    // PromptPress/IMP-1075
    public async updateMetadata(filePath: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument(filePath);
        await this.processor?.updateMetadata(document);
    }

    // PromptPress/IMP-1076
    public dispose() {
        this.watcher?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
