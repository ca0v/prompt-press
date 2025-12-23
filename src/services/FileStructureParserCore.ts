export interface Logger {
    log(message: string): void;
}

export class FileStructureParserCore {
    constructor(private logger: Logger) { }

    /**
     * Parse file descriptions from a File Structure section
     * Supports both original format (- `file`: desc) and tree format
     */
    // PromptPress/IMP-1044
    parseFileDescriptions(section: string): Map<string, string> {
        const descriptions = new Map<string, string>();
        // this.parseTreeFormat(section, descriptions);

        // scan to first ```
        const startIndex = section.indexOf('```');
        if (startIndex === -1) {
            this.logger.log('Invalid section format: missing opening ```');
            return descriptions;
        }
        section = section.slice(startIndex);

        // scan to last ```
        const endIndex = section.lastIndexOf('```');
        if (endIndex === -1) {
            this.logger.log('Invalid section format: missing closing ```');
            return descriptions;
        }
        section = section.slice(0, endIndex + 3);

        // confirm the section starts with "```" and ends with "```", otherwise fail gracefully
        if (!section.startsWith('```') || !section.endsWith('```')) {
            this.logger.log('Invalid section format');
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

    /**
     * Parse a tree format section into a dictionary of file paths and descriptions
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

    Observe that it starts with a root directory
    Every directory ends with "/"
    Every ├─ indicates a file or directory at the current level
    Every │ indicates continuation of the parent directory
    Every └─ indicates the last file or directory at the current level

    Given that, we can maintain a stack of directory names to build the full path
    by pushing the directory onto the stack when we enter a new directory
    and popping it off when we exit a directory.

    The comments after # or // are treated as descriptions.

    The result is a dictionary mapping full file paths to their descriptions.
     */
    // PromptPress/IMP-1045
    parseTreeToDict(input: string): Record<string, string> {
        const lines = input.trim().split('\n');
        const result: Record<string, string> = {};
        const stack: string[] = [];
        let prevHadChildren = false;

        for (const line of lines) {
            const trimmed = line.trimEnd();
            if (!trimmed) continue;

            const noPrefix = trimmed.replace(/^[\└├│──┬─ ]+/, '');
            const isLast = trimmed.includes('└');
            const isDir = noPrefix.endsWith('/');

            let name: string;
            let comment = '';

            if (isDir) {
                name = noPrefix.slice(0, -1).trim();
            } else {
                const match = noPrefix.match(/^(.*?)\s*(?:#|\/\/)\s*(.*)$/);
                name = match ? match[1].trim() : noPrefix.trim();
                comment = match ? match[2].trim() : '';
            }

            // Build path
            const fullPath = [...stack, name].join('/');

            // Update stack
            if (prevHadChildren && isLast) {
                stack.pop();
            }

            if (isDir) {
                stack.push(name);
            }

            prevHadChildren = trimmed.includes('├') || trimmed.includes('┬');

            if (comment) {
                result[fullPath] = comment;
            }
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