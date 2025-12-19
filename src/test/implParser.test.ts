import * as path from 'path';
import * as fs from 'fs/promises';
import { TestRunner, it } from './framework.js';
import { Assert } from "./Assert.js";
import { ImplParser } from '../services/implParser.js';
import { FileStructureParser } from '../services/fileStructureParser.js';
import { MarkdownParser } from '../parsers/markdownParser.js';
import { __dirname } from '../utils/dirname.js';

// Mock XAIClient
class MockXAIClient {
    callCount = 0;
    lastMessages: any[] = [];

    async chat(messages: any[], options?: any): Promise<string> {
        this.callCount++;
        this.lastMessages = messages;

        const content = messages[0].content;
        const filePathMatch = content.match(/Instructions: Implement the code for ([^\s]+)/);
        const filePath = filePathMatch ? filePathMatch[1] : '';
        const ext = path.extname(filePath);

        if (ext === '.js') {
            return `// Implementation for ${filePath}
// This is valid JavaScript code
function example() {
    console.log('Hello from ${filePath}');
}
module.exports = example;`;
        } else if (ext === '.ts') {
            return `// Implementation for ${filePath}
// This is valid TypeScript code
export class Example {
    constructor() {
        console.log('Hello from ${filePath}');
    }
}`;
        } else if (ext === '.html') {
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Game Board</title>
</head>
<body>
    <h1>Game Board</h1>
    <div id="app"></div>
</body>
</html>`;
        } else if (ext === '.json') {
            return `{
    "name": "game-board",
    "version": "1.0.0"
}`;
        } else if (ext === '.md') {
            return `# Game Board

Implementation notes for the game board component.`;
        } else {
            return `// Mock implementation for ${filePath}`;
        }
    }
}

// Mock OutputChannel
class MockOutputChannel {
    messages: string[] = [];
    appendLine(message: string) {
        this.messages.push(message);
    }
}

// Mock FileStructureParser
class MockFileStructureParser {
    parseFileDescriptions(section: string): Map<string, string> {
        // Simple mock that parses basic format for testing
        const descriptions = new Map<string, string>();
        const lines = section.split('\n');
        for (const line of lines) {
            const match = line.match(/- `([^`]+)`: (.+)/);
            if (match) {
                descriptions.set(match[1], match[2]);
            }
        }
        return descriptions;
    }
}

export async function runImplParserTest(): Promise<void> {
    const runner = new TestRunner();
    runner.describe('ImplParser', () => {
        it('should generate game-of-life source code from impl.md using AI', async () => {
            const parser = new MarkdownParser();
            const mockClient = new MockXAIClient();
            const mockOutputChannel = new MockOutputChannel();
            const mockFileStructureParser = new MockFileStructureParser();
            const implParser = new ImplParser(parser, mockClient as any, mockOutputChannel as any, mockFileStructureParser as any);

            const implPath = path.join(__dirname, '../../test-output/game-of-life.impl.md');
            const outputDir = path.join(path.dirname(implPath), 'game-of-life-generated');

            // Clean up any existing output
            try {
                await fs.rm(outputDir, { recursive: true, force: true });
            } catch {}

            // Run the parser
            await implParser.parseAndGenerate(implPath);

            // Verify output directory exists
            const stats = await fs.stat(outputDir);
            Assert.ok(stats.isDirectory(), 'Output directory should be created');

            // Verify AI was called
            Assert.ok(mockClient.callCount > 0, 'AI should have been called');

            // Validate all generated JS and HTML files
            const validateFiles = async (dir: string) => {
                const items = await fs.readdir(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) {
                        await validateFiles(fullPath);
                    } else if (item.isFile() && !item.name.endsWith('.ico')) {
                        const content = await fs.readFile(fullPath, 'utf8');
                        const ext = path.extname(item.name);
                        if (ext === '.js') {
                            Assert.ok(content.includes('function') || content.includes('console.log'), `JS file ${fullPath} should contain valid JS code`);
                        } else if (ext === '.ts') {
                            Assert.ok(content.includes('export') || content.includes('class'), `TS file ${fullPath} should contain valid TS code`);
                        } else if (ext === '.html') {
                            Assert.ok(content.includes('<html'), `HTML file ${fullPath} should contain valid HTML`);
                        }
                    }
                }
            };
            await validateFiles(outputDir);
        });
    });

    runner.describe('FileStructureParser', () => {
        it('should parse tree format file descriptions', async () => {
            const mockOutputChannel = new MockOutputChannel();
            const parser = new FileStructureParser(mockOutputChannel as any);

            const section = `
\`\`\`
src/
    ├── index.js          # Main entry point
    ├── game.js           # Game logic
\`\`\`
`;

            const result = parser.parseFileDescriptions(section);

            Assert.equal(result.size, 2, 'Should parse 2 file descriptions from tree format');
            Assert.equal(result.get('src/index.js'), 'Main entry point');
            Assert.equal(result.get('src/game.js'), 'Game logic');
        });

        it('should return empty map for empty section', async () => {
            const mockOutputChannel = new MockOutputChannel();
            const parser = new FileStructureParser(mockOutputChannel as any);

            const result = parser.parseFileDescriptions('');

            Assert.equal(result.size, 0, 'Should return empty map for empty section');
        });

        it('should parse standard tree format file descriptions', async () => {
            const mockOutputChannel = new MockOutputChannel();
            const parser = new FileStructureParser(mockOutputChannel as any);

            const section = `
\`\`\`
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
\`\`\`
`;

            const result = parser.parseFileDescriptions(section);

            Assert.equal(result.size, 13, 'Should parse 13 file descriptions');
            Assert.equal(result.get('game-board/src/board.ts'), 'Main Board class implementation');
            Assert.equal(result.get('game-board/src/renderer.ts'), 'Grid and piece rendering logic');
            Assert.equal(result.get('game-board/src/state-manager.ts'), 'In-memory state management');
            Assert.equal(result.get('game-board/src/interaction-handler.ts'), 'User input processing');
            Assert.equal(result.get('game-board/src/persistence.ts'), 'Save/load with jsonbin.io');
            Assert.equal(result.get('game-board/src/types.ts'), 'TypeScript interfaces and types');
            Assert.equal(result.get('game-board/src/index.ts'), 'Entry point exporting Board class');
            Assert.equal(result.get('game-board/tests/board.test.ts'), 'Unit tests for Board class');
            Assert.equal(result.get('game-board/tests/renderer.test.ts'), 'Tests for rendering components');
            Assert.equal(result.get('game-board/tests/integration.test.ts'), 'End-to-end tests for full board behavior');
            Assert.equal(result.get('game-board/package.json'), 'NPM dependencies and scripts');
            Assert.equal(result.get('game-board/tsconfig.json'), 'TypeScript configuration');
            Assert.equal(result.get('game-board/README.md'), 'Implementation notes');
        });

    });
    await runner.run();
}