import * as vscode from 'vscode';

export class FileStructureParser {
    constructor(private outputChannel: vscode.OutputChannel) { }

    /**
     * Parse file descriptions from a File Structure section
     * Supports both original format (- `file`: desc) and tree format
     */
    parseFileDescriptions(section: string): Map<string, string> {
        const descriptions = new Map<string, string>();
        // this.parseTreeFormat(section, descriptions);

        // confirm the section starts with "```" and ends with "```", otherwise fail gracefully
        if (!section.startsWith('```') || !section.endsWith('```')) {
            this.outputChannel.appendLine('Invalid section format');
            return descriptions;
        }

        // strip the ``` markers
        section = section.slice(3, -3).trim();

        const fileDict = this.parseTreeToDict(section);

        for (const [filePath, desc] of Object.entries(fileDict)) {
            // skip directories
            if (filePath.endsWith('/')) continue;
            // skip uncommented files
            if (desc === '') continue;
            descriptions.set(filePath, desc);
        }

        return descriptions;
    }

    parseTreeToDict(input: string): Record<string, string> {
        const lines = input.trim().split('\n');
        const result: Record<string, string> = {};
        const pathParts: string[] = [];

        for (const line of lines) {
            const trimmed = line.trimEnd();
            if (!trimmed) continue;

            const depth = (line.length - trimmed.length) / 2;
            const content = trimmed.replace(/^[└├│─┬─ ]+/, '');
            const commentMatch = content.match(/^(.*?)\s*(?:(?:#|\/\/)\s*(.*))?$/);

            const name = commentMatch![1].trim();
            const comment = commentMatch![2]?.trim() ?? '';

            pathParts.length = depth;
            pathParts.push(name);

            const fullPath = pathParts.join('/');
            if (comment) result[fullPath] = comment;
        }

        return result;
    }

    private parseTreeFormat(section: string, descriptions: Map<string, string>): void {
        /*
        
        Converts tree format like:
        
        game-board/
        ├── src/
        │   ├── board.ts          # Main Board class implementation
        │   ├── renderer.ts       # Grid and piece rendering logic
        │   ├── state-manager.ts  # In-memory state management
        │   ├── interaction-handler.ts  # User input processing
        │   ├── persistence.ts    # Save/load with jsonbin.io
        │   ├── types.ts          # TypeScript interfaces and types
        │   └── index.ts          # Entry point exporting Board class
        ├── tests/
        │   ├── board.test.ts     # Unit tests for Board class
        │   ├── renderer.test.ts  # Tests for rendering components
        │   └── integration.test.ts  # End-to-end tests for full board behavior
        ├── package.json          # NPM dependencies and scripts
        ├── tsconfig.json         # TypeScript configuration
        └── README.md             # Implementation notes

        Into a collection of file paths and descriptions like this:

        'game-board/src/board.ts' => 'Main Board class implementation'
        */

        const lines = section.split('\n');
        const pathStack: string[] = [];
        const treeLineRegex = /^([ \t│]*)([├└]── )?(.+?)(?:\s+#\s*(.*))?$/;

        for (const line of lines) {
            const match = treeLineRegex.exec(line);
            if (!match) continue;

            const indent = match[1] || '';
            const branch = match[2];
            const entry = match[3]?.trim();
            const desc = match[4]?.trim() || '';

            if (!entry) continue;

            const isDir = entry.endsWith('/');
            const cleanEntry = entry.replace(/\/$/, '');
            const depth = indent.replace(/[^│]/g, '').length + (branch ? 1 : 0);

            while (pathStack.length > depth) {
                pathStack.pop();
            }

            if (isDir) {
                pathStack.push(cleanEntry);
            } else {
                const fullPath = pathStack.slice(0, depth).concat(cleanEntry).join('/');
                if (!descriptions.has(fullPath)) {
                    descriptions.set(fullPath, desc);
                }
            }
        }
    }
}