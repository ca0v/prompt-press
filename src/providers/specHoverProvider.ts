/**
 * UNTESTABLE: This provider depends on VS Code APIs and cannot be unit tested without extensive mocking.
 * It should be refactored to build upon a testable core that handles the business logic.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { MarkdownParser } from '../parsers/markdownParser.js';
import { getBaseName, getTargetFolder, getTargetExt, resolveSpecFilePath, extractSpecBlock } from '../utils/specLinkUtils.js';

export class SpecHoverProvider implements vscode.HoverProvider {
    constructor(private workspaceRoot: string, private parser: MarkdownParser) {}

    /**
     * Provides hover tooltips for spec references by finding the source document and extracting descriptions.
     */
    // promptpress/IMP-1081
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        // Extract the word at position to get the SPEC_ID
        const wordRange = document.getWordRangeAtPosition(position, /[A-Z]{2,3}-\d{4}/);
        if (!wordRange) {
            return null;
        }

        const specId = document.getText(wordRange);

        // Resolve the spec file path
        const line = document.lineAt(position.line).text;
        const filePath = resolveSpecFilePath(specId, line, document.fileName, this.workspaceRoot);
        if (!filePath) {
            return null;
        }

        try {
            // Parse the source document
            const uri = vscode.Uri.file(filePath);
            const sourceDocument = await vscode.workspace.openTextDocument(uri);
            const content = sourceDocument.getText();

            // Extract the spec block
            const block = extractSpecBlock(content, specId);
            if (!block) {
                return null;
            }

            // Return a Hover with the extracted content
            return new vscode.Hover(new vscode.MarkdownString(block));
        } catch (error) {
            // Return null if no hover content found
            return null;
        }
    }
}