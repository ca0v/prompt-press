/**
 * UNTESTABLE: The SpecHoverProvider depends on VS Code APIs and cannot be fully tested without mocking.
 * These tests are minimal and only cover instantiation.
 */
import { TestRunner, it } from './framework.js';
import { SpecHoverProvider } from '../providers/specHoverProvider.js';
import { MarkdownParser } from '../parsers/markdownParser.js';

export async function runSpecHoverProviderTests() {
    const runner = new TestRunner();

    runner.describe('SpecHoverProvider', () => {
        it('should be instantiable', () => {
            const parser = new MarkdownParser();
            const provider = new SpecHoverProvider('/tmp', parser);
            if (!provider) throw new Error('Provider not created');
        });

        // Note: Full integration test would require vscode mocks, which are not set up in this test framework
        // The provideHover method is tested manually in VS Code environment
    });

    await runner.run();
    runner.printSummary();
}