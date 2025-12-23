import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export class SpecReferenceFinder implements vscode.ReferenceProvider {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Provides references for the symbol at the given position.
     */
    // PromptPress/IMP-1077
    provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Location[]> {
        const wordRange = document.getWordRangeAtPosition(position, /FR-\d{4}|DES-\d{4}|IMP-\d{4}/);
        if (!wordRange) {
            return [];
        }
        const refId = document.getText(wordRange);
        return this.findAllReferences(refId);
    }

    /**
     * Finds all references to the given REFID across the workspace.
     */
    // PromptPress/IMP-1077
    async findAllReferences(refId: string): Promise<vscode.Location[]> {
        const locations: vscode.Location[] = [];
        const specsDir = path.join(this.workspaceRoot, 'specs');

        // Recursively find all .md files in specs/
        const files = await this.getAllMdFiles(specsDir);

        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const index = line.indexOf(refId);
                if (index !== -1) {
                    const uri = vscode.Uri.file(file);
                    const range = new vscode.Range(i, index, i, index + refId.length);
                    locations.push(new vscode.Location(uri, range));
                }
            }
        }

        return locations;
    }

    private async getAllMdFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...await this.getAllMdFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
        return files;
    }
}