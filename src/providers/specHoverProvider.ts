import * as vscode from 'vscode';
import * as path from 'path';
import { MarkdownParser } from '../parsers/markdownParser.js';

export class SpecHoverProvider implements vscode.HoverProvider {
    constructor(private workspaceRoot: string, private parser: MarkdownParser) {}

    /**
     * Provides hover tooltips for spec references by finding the source document and extracting descriptions.
     */
    // PromptPress/IMP-1081
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

        // Determine the spec type (FR, DES, IMP)
        const type = specId.split('-')[0];
        const phaseMap: { [key: string]: 'requirement' | 'design' | 'implementation' } = {
            'FR': 'requirement',
            'DES': 'design',
            'IMP': 'implementation'
        };
        const phase = phaseMap[type];
        if (!phase) {
            return null;
        }

        // Assume artifact is 'promptpress' for now
        const artifact = 'promptpress';

        // Find the source document path
        const extMap: { [key in 'requirement' | 'design' | 'implementation']: string } = { requirement: 'req', design: 'design', implementation: 'impl' };
        const ext = extMap[phase];
        const filePath = path.join(this.workspaceRoot, 'specs', phase, `${artifact}.${ext}.md`);

        try {
            // Parse the source document
            const parsed = await this.parser.parseFile(filePath);
            const content = parsed.content;

            // Find the section starting with "### SPEC_ID"
            const regex = new RegExp(`^### ${specId}$`, 'm');
            const match = content.match(regex);
            if (!match) {
                return null;
            }

            const startIndex = match.index! + match[0].length;

            // Extract the entire specification block (from "### SPEC_ID" to the next "###" or end of section)
            const nextMatch = content.substring(startIndex).match(/^### /m);
            const endIndex = nextMatch ? startIndex + nextMatch.index! : content.length;
            const block = content.substring(startIndex, endIndex).trim();

            // Return a Hover with the extracted content
            return new vscode.Hover(new vscode.MarkdownString(block));
        } catch (error) {
            // Return null if no hover content found
            return null;
        }
    }
}