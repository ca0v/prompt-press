import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export class SpecCompletionProvider implements vscode.DocumentLinkProvider {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Provides document links for @mentions and frontmatter references to spec documents.
     * Enables navigation from references like @artifact.req to the corresponding spec file.
     */
    // PromptPress/IMP-1016
    provideDocumentLinks(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentLink[]> {
        const filePath = document.uri.fsPath;
        const relativePath = path.relative(this.workspaceRoot, filePath);

        // Only provide links for files in specs/
        if (!relativePath.startsWith('specs/')) {
            return [];
        }

        return this.getAllSpecRefs().then(async specRefs => {
            const links: vscode.DocumentLink[] = [];
            const text = document.getText();
            const regex = /@([a-zA-Z0-9_.-]+)/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const mention = match[1];
                let ref = mention;
                if (ref.endsWith('.md')) {
                    ref = ref.slice(0, -3);
                }
                if (specRefs.includes(ref)) {
                    const startPos = document.positionAt(match.index);
                    const endPos = document.positionAt(match.index + match[0].length);
                    const range = new vscode.Range(startPos, endPos);
                    const targetPath = await this.resolveSpecPath(ref);
                    if (targetPath) {
                        const uri = vscode.Uri.file(targetPath);
                        links.push(new vscode.DocumentLink(range, uri));
                    }
                }
            }

            // Handle frontmatter
            const lines = text.split('\n');
            let frontmatterStartLine = -1;
            let frontmatterEndLine = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === '---') {
                    if (frontmatterStartLine === -1) {
                        frontmatterStartLine = i;
                    } else {
                        frontmatterEndLine = i;
                        break;
                    }
                }
            }
            if (frontmatterStartLine !== -1 && frontmatterEndLine !== -1) {
                const frontmatterStartPos = document.lineAt(frontmatterStartLine + 1).range.start;
                const frontmatterEndPos = document.lineAt(frontmatterEndLine).range.start;
                const frontmatterRange = new vscode.Range(frontmatterStartPos, frontmatterEndPos);
                const frontmatterText = document.getText(frontmatterRange);
                const refRegex = /([a-zA-Z0-9_.-]+)/g;
                while ((match = refRegex.exec(frontmatterText)) !== null) {
                    const ref = match[1];
                    if (specRefs.includes(ref)) {
                        const startPos = document.positionAt(document.offsetAt(frontmatterRange.start) + match.index);
                        const endPos = document.positionAt(document.offsetAt(startPos) + ref.length);
                        const range = new vscode.Range(startPos, endPos);
                        const targetPath = await this.resolveSpecPath(ref);
                        if (targetPath) {
                            const uri = vscode.Uri.file(targetPath);
                            links.push(new vscode.DocumentLink(range, uri));
                        }
                    }
                }
            }

            return links;
        });
    }

    private async getAllSpecRefs(): Promise<string[]> {
        const refs: string[] = [];
        const specsDir = path.join(this.workspaceRoot, 'specs');

        const collectMdFiles = async (dir: string): Promise<void> => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        await collectMdFiles(path.join(dir, entry.name));
                    } else if (entry.isFile() && entry.name.endsWith('.md')) {
                        const ref = entry.name.replace(/\.md$/, '');
                        refs.push(ref);
                    }
                }
            } catch (error) {
                // Ignore errors
            }
        };

        await collectMdFiles(specsDir);
        return refs;
    }

    private async resolveSpecPath(specRef: string): Promise<string | null> {
        const parts = specRef.split('.');
        const artifact = parts[0];
        const phase = parts[1];
        let subdir = '';
        if (phase === 'req') {
            subdir = 'requirements';
        } else if (phase === 'design') {
            subdir = 'design';
        } else if (phase === 'impl') {
            subdir = 'implementation';
        }
        let filePath: string;
        if (subdir) {
            filePath = path.join(this.workspaceRoot, 'specs', subdir, `${artifact}.${phase}.md`);
        } else {
            filePath = path.join(this.workspaceRoot, 'specs', phase ? `${artifact}.${phase}.md` : `${artifact}.md`);
        }
        try {
            await fs.access(filePath);
            return filePath;
        } catch {
            return null;
        }
    }
}
