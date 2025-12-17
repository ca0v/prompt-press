import * as path from 'path';
import * as fs from 'fs/promises';
import { TestRunner, Assert, it } from './framework';
import { ImplParser } from '../services/implParser';
import { MarkdownParser } from '../parsers/markdownParser';

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
        } else if (ext === '.html') {
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Game of Life</title>
</head>
<body>
    <h1>Game of Life</h1>
    <div id="app"></div>
</body>
</html>`;
        } else if (ext === '.json') {
            return `{
    "name": "game-of-life",
    "version": "1.0.0"
}`;
        } else {
            return `// Mock implementation for ${filePath}`;
        }
    }
}

export async function runImplParserTest(): Promise<void> {
    const runner = new TestRunner();
    runner.describe('ImplParser', () => {
        it('should generate game-of-life source code from impl.md using AI', async () => {
            const parser = new MarkdownParser();
            const mockClient = new MockXAIClient();
            const implParser = new ImplParser(parser, mockClient as any);

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
                        } else if (ext === '.html') {
                            Assert.ok(content.includes('<html'), `HTML file ${fullPath} should contain valid HTML`);
                        }
                    }
                }
            };
            await validateFiles(outputDir);
        });
    });
    await runner.run();
}