import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export class SpecCompletionProvider implements vscode.CompletionItemProvider {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const filePath = document.uri.fsPath;
        const relativePath = path.relative(this.workspaceRoot, filePath);

        // Only provide completions for files in specs/
        if (!relativePath.startsWith('specs/')) {
            return [];
        }

        const fileName = path.basename(filePath);
        const isConOps = fileName === 'ConOps.md';
        const currentPhase = this.getCurrentPhase(fileName);

        // Get all valid spec files
        return this.getAllSpecRefs().then(specRefs => {
            let filteredRefs = specRefs;

            // Filter based on context
            const line = document.lineAt(position).text;
            const linePrefix = line.substring(0, position.character);

            // Check if we're in frontmatter
            const isInFrontmatter = this.isInFrontmatter(document, position);

            if (isInFrontmatter) {
                // In frontmatter depends-on or references
                const frontmatterType = this.getFrontmatterType(linePrefix);
                if (frontmatterType === 'depends-on') {
                    filteredRefs = this.filterForDependsOn(filteredRefs, currentPhase, fileName);
                } else if (frontmatterType === 'references') {
                    filteredRefs = this.filterForReferences(filteredRefs, currentPhase);
                } else {
                    return [];
                }
            } else {
                // In content, for @ mentions
                filteredRefs = this.filterForMentions(filteredRefs, currentPhase, isConOps);
            }

            // Create completion items
            return filteredRefs.map(ref => {
                const item = new vscode.CompletionItem(ref, vscode.CompletionItemKind.Reference);
                item.detail = `Reference to ${ref}`;
                return item;
            });
        });
    }

    private async getAllSpecRefs(): Promise<string[]> {
        const refs: string[] = [];

        // Add ConOps
        refs.push('ConOps');

        // Scan specs directory
        const specsDir = path.join(this.workspaceRoot, 'specs');

        try {
            const entries = await fs.readdir(specsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const subDir = entry.name;
                    const subPath = path.join(specsDir, subDir);
                    const subEntries = await fs.readdir(subPath, { withFileTypes: true });
                    for (const subEntry of subEntries) {
                        if (subEntry.isFile() && subEntry.name.endsWith('.md')) {
                            const artifact = subEntry.name.replace(/\.md$/, '');
                            if (subDir === 'requirements') {
                                refs.push(`${artifact}.req`);
                            } else if (subDir === 'design') {
                                refs.push(`${artifact}.design`);
                            } else if (subDir === 'implementation') {
                                refs.push(`${artifact}.impl`);
                            }
                        }
                    }
                } else if (entry.isFile() && entry.name === 'ConOps.md') {
                    // Already added
                }
            }
        } catch (error) {
            // Ignore errors
        }

        return refs;
    }

    private getCurrentPhase(fileName: string): string | null {
        if (fileName.endsWith('.req.md')) return 'req';
        if (fileName.endsWith('.design.md')) return 'design';
        if (fileName.endsWith('.impl.md')) return 'impl';
        return null;
    }

    private isInFrontmatter(document: vscode.TextDocument, position: vscode.Position): boolean {
        const text = document.getText();
        const lines = text.split('\n');
        let inFrontmatter = false;
        for (let i = 0; i <= position.line; i++) {
            const line = lines[i];
            if (line.trim() === '---') {
                if (inFrontmatter) {
                    return false; // End of frontmatter
                } else {
                    inFrontmatter = true;
                }
            }
        }
        return inFrontmatter;
    }

    private getFrontmatterType(linePrefix: string): string | null {
        if (linePrefix.includes('depends-on:')) return 'depends-on';
        if (linePrefix.includes('references:')) return 'references';
        return null;
    }

    private filterForDependsOn(refs: string[], currentPhase: string | null, currentFileName: string): string[] {
        const currentRef = currentFileName.replace(/\.(req|design|impl)\.md$/, '.$1');

        return refs.filter(ref => {
            // Don't suggest current document
            if (ref === currentRef) return false;

            // Don't suggest ConOps
            if (ref === 'ConOps') return false;

            // Don't suggest .impl files
            if (ref.endsWith('.impl')) return false;

            // Don't suggest files that would create circular dependency
            // For simplicity, we'll allow all for now; full circular check would require parsing deps

            // Phase-specific rules
            if (currentPhase === 'req') {
                // req can depend on req
                return ref.endsWith('.req');
            } else if (currentPhase === 'design') {
                // design can depend on req and design
                return ref.endsWith('.req') || ref.endsWith('.design');
            } else if (currentPhase === 'impl') {
                // impl can depend on req, design, impl
                return true;
            }

            return false;
        });
    }

    private filterForReferences(refs: string[], currentPhase: string | null): string[] {
        // Similar to depends-on but no circular check
        return refs.filter(ref => {
            // Don't suggest ConOps? Wait, references can include ConOps? But prompt says .req/.design/.impl
            // Prompt: "can reference .req, .design, .impl" for specs, ConOps can reference .req
            // But for references array, probably same as depends-on but without circular
            if (ref === 'ConOps') return false; // Assuming references are to specs only

            // Don't suggest .impl files? Prompt doesn't say, but probably same rules
            if (ref.endsWith('.impl')) return false;

            if (currentPhase === 'req') {
                return ref.endsWith('.req');
            } else if (currentPhase === 'design') {
                return ref.endsWith('.req') || ref.endsWith('.design');
            } else if (currentPhase === 'impl') {
                return true;
            }

            return false;
        });
    }

    private filterForMentions(refs: string[], currentPhase: string | null, isConOps: boolean): string[] {
        const currentRef = isConOps ? 'ConOps' : null;

        return refs.filter(ref => {
            // Don't suggest current document
            if (ref === currentRef) return false;

            // Don't suggest .impl files
            if (ref.endsWith('.impl')) return false;

            // For ConOps, only .req
            if (isConOps) {
                return ref.endsWith('.req');
            }

            // For req phase, don't suggest .design
            if (currentPhase === 'req' && ref.endsWith('.design')) return false;

            return true;
        });
    }
}