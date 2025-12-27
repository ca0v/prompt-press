import * as vscode from 'vscode';
import * as path from 'path';
import { findTextInFiles } from '../utils/textSearch.js';

export class SpecReferenceFinder implements vscode.ReferenceProvider {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Provides references for the symbol at the given position.
     */
    // promptpress/IMP-1077
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
        const fileName = path.basename(document.fileName);
        const artifact = fileName.replace(/\.md$/, '');
        return this.findAllReferences(`${artifact}/${refId}`);
    }

    /**
     * Finds all references to the given REFID across the workspace.
     */
    // promptpress/IMP-1077
    async findAllReferences(refId: string): Promise<vscode.Location[]> {
        const locations: vscode.Location[] = [];
        try {
            await findTextInFiles({ pattern: refId }, {}, (result) => {
                for (const range of result.ranges) {
                    locations.push(new vscode.Location(result.uri, range));
                }
            });
            return locations;
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }
}