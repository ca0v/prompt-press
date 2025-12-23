import * as vscode from 'vscode';
import * as path from 'path';
import { resolveSpecPath as resolveSpecPathSync } from '../spec/resolveSpecPath.js';
import { getAllSpecRefs } from '../spec/getAllSpecRefs.js';
import * as fs from 'fs/promises';
import { getTargetFolder, getTargetExt, getBaseName } from '../utils/specLinkUtils.js';

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

        // Only provide links for files in specs/ or .ts files
        if (!relativePath.startsWith('specs/') && !filePath.endsWith('.ts')) {
            return [];
        }

        // For .ts files, only handle IMP- references
        if (filePath.endsWith('.ts')) {
            return this.getLinksForTsFile(document);
        }

        return this.getLinksForSpecFiles(document);
    }

    private static extractImpMatches(text: string): Array<{index: number, specName: string, impId: string}> {
        const matches: Array<{index: number, specName: string, impId: string}> = [];
        const impRegex = /\/\/\s*([a-zA-Z0-9_-]+)\/IMP-(\d{4})\b/g;
        let match;
        while ((match = impRegex.exec(text)) !== null) {
            matches.push({
                index: match.index,
                specName: match[1],
                impId: `IMP-${match[2]}`
            });
        }
        return matches;
    }

    private static computeTargetPath(specName: string): string {
        return path.join('.', 'specs', 'implementation', `${specName}.impl.md`);
    }

    private async getLinksForTsFile(document: vscode.TextDocument): Promise<vscode.DocumentLink[]> {
        const links: vscode.DocumentLink[] = [];
        const text = document.getText();
        
        const impMatches = SpecCompletionProvider.extractImpMatches(text);
        for (const match of impMatches) {
            const targetPath = path.join(this.workspaceRoot, SpecCompletionProvider.computeTargetPath(match.specName));
            
            console.log(`[SpecLink] Found IMP reference: ${match.impId} in spec: ${match.specName}, targeting: ${targetPath}`);
            
            try {
                await fs.access(targetPath);
                const startPos = document.positionAt(match.index + text.substring(match.index).indexOf(match.impId));
                const endPos = document.positionAt(match.index + text.substring(match.index).indexOf(match.impId) + match.impId.length);
                const range = new vscode.Range(startPos, endPos);
                
                // Read target file to find the first instance of IMP-xxxx
                const targetContent = await fs.readFile(targetPath, 'utf8');
                const lines = targetContent.split('\n');
                let targetLine = -1;
                let targetCol = 0;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const index = line.indexOf(match.impId);
                    if (index !== -1) {
                        targetLine = i;
                        targetCol = index;
                        break;
                    }
                }
                
                let uri: vscode.Uri;
                if (targetLine !== -1) {
                    uri = vscode.Uri.parse(`file://${targetPath}#L${targetLine + 1}:${targetCol + 1}`);
                    console.log(`[SpecLink] Linking to ${targetPath} at line ${targetLine + 1}, col ${targetCol + 1}`);
                } else {
                    uri = vscode.Uri.file(targetPath);
                    console.log(`[SpecLink] IMP-${match.impId} not found in target file, linking to file`);
                }
                links.push(new vscode.DocumentLink(range, uri));
            } catch (error) {
                console.log(`[SpecLink] Target file not accessible: ${targetPath}`, error);
                // file not found, skip
            }
        }
        return links;
    }

    private async getLinksForSpecFiles(document: vscode.TextDocument): Promise<vscode.DocumentLink[]> {
        return this.getAllSpecRefs(document).then(async specRefs => {
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

            // Handle ID references like FR-1000, DES-1014, etc.
            const idRegex = /\b(FR|NFR|DES|IMP)-(\d{4})\b/g;
            let idMatch;
            while ((idMatch = idRegex.exec(text)) !== null) {
                const id = idMatch[0];
                const type = idMatch[1];
                const targetFolder = getTargetFolder(type);
                const targetExt = getTargetExt(type);
                if (targetFolder && targetExt) {
                    const baseName = getBaseName(document.fileName);
                    const targetFileName = `${baseName}.${targetExt}.md`;
                    const targetPath = path.join(this.workspaceRoot, 'specs', targetFolder, targetFileName);
                    try {
                        await fs.access(targetPath);
                        const startPos = document.positionAt(idMatch.index);
                        const endPos = document.positionAt(idMatch.index + id.length);
                        const range = new vscode.Range(startPos, endPos);
                        
                        // Read target file to find the header position
                        const targetContent = await fs.readFile(targetPath, 'utf8');
                        const lines = targetContent.split('\n');
                        let headerLine = -1;
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].trim().startsWith('###') && lines[i].includes(id)) {
                                headerLine = i;
                                break;
                            }
                        }
                        
                        let uri: vscode.Uri;
                        if (headerLine !== -1) {
                            const line = lines[headerLine];
                            const idIndex = line.indexOf(id);
                            if (idIndex !== -1) {
                                uri = vscode.Uri.parse(`file://${targetPath}#L${headerLine + 1}:${idIndex + 1}`);
                            } else {
                                uri = vscode.Uri.parse(`file://${targetPath}#L${headerLine + 1}`);
                            }
                        } else {
                            uri = vscode.Uri.file(targetPath);
                        }
                        links.push(new vscode.DocumentLink(range, uri));
                    } catch {
                        // file not found, skip
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

    private async getAllSpecRefs(document: vscode.TextDocument): Promise<string[]> {
        const fileName = path.basename(document.fileName);
        let allowedPhases: string[];

        if (fileName.endsWith('.req.md')) {
            // Req docs can only see requirements
            allowedPhases = ['requirements'];
        } else if (fileName.endsWith('.design.md')) {
            // Design docs can see requirements and design
            allowedPhases = ['requirements', 'design'];
        } else if (fileName.endsWith('.impl.md')) {
            // Impl docs can see all phases
            allowedPhases = ['requirements', 'design', 'implementation'];
        } else if (fileName === 'ConOps.md') {
            // ConOps can reference requirements
            allowedPhases = ['requirements'];
        } else {
            // Fallback for other files
            allowedPhases = ['requirements', 'design', 'implementation'];
        }

        return getAllSpecRefs(this.workspaceRoot, allowedPhases);
    }

    /**
     * Uses the shared resolveSpecPath helper and checks file existence.
     */
    private async resolveSpecPath(specRef: string): Promise<string | null> {
        const filePath = resolveSpecPathSync(this.workspaceRoot, specRef);
        try {
            await fs.access(filePath);
            return filePath;
        } catch {
            return null;
        }
    }
}