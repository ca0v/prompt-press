import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export class SpecImplementationFinder {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Finds all implementations based on file type and REFID following specific rules.
     */
    // PromptPress/IMP-1078
    async findAllImplementations(fileType: 'req' | 'design' | 'impl', refId: string, artifact: string): Promise<vscode.Location[]> {
        const locations: vscode.Location[] = [];
        let files: string[] = [];
        let query: string;

        switch (fileType) {
            case 'req':
                // For requirement spec files: scan design spec files for artifact.req/REFID
                files = await this.getMdFiles(path.join(this.workspaceRoot, 'specs', 'design'), `${artifact}.design.md`);
                query = `${artifact}.req/${refId}`;
                break;
            case 'design':
                // For design spec files: scan implementation spec files for artifact.design/REFID
                files = await this.getMdFiles(path.join(this.workspaceRoot, 'specs', 'implementation'), `${artifact}.impl.md`);
                query = `${artifact}.design/${refId}`;
                break;
            case 'impl':
                // For implementation spec files: scan all files for artifact.impl/REFID
                files = await this.getAllMdFiles(this.workspaceRoot);
                query = `${artifact}.impl/${refId}`;
                break;
            default:
                return locations;
        }

        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const index = line.indexOf(query);
                if (index !== -1) {
                    const uri = vscode.Uri.file(file);
                    const range = new vscode.Range(i, index, i, index + query.length);
                    locations.push(new vscode.Location(uri, range));
                }
            }
        }

        return locations;
    }

    private async getMdFiles(dir: string, pattern: string): Promise<string[]> {
        const files: string[] = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith('.md') && (pattern === '*' || entry.name.includes(pattern.slice(1, -4)))) {
                    files.push(path.join(dir, entry.name));
                }
            }
        } catch (error) {
            // Directory doesn't exist
        }
        return files;
    }

    private async getAllMdFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                files.push(...await this.getAllMdFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
        return files;
    }
}