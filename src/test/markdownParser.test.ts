import { TestRunner, it } from './framework.js';
import { Assert } from "./Assert.js";
import { MarkdownParser } from '../parsers/markdownParser.js';

export async function runMarkdownParserTest(): Promise<void> {
    const runner = new TestRunner();
    runner.describe('MarkdownParser', () => {
        it('should extract references without trailing punctuation', async () => {
            const parser = new MarkdownParser();
            const content = 'The base @faction.req consists of five distinct geode types: @geode-pyrite.req, @geode-calcite.req, @geode-amethyst.req, and @geode-quartz.req.';
            const parsed = parser.parse(content);
            const expectedReferences = ['faction.req', 'geode-pyrite.req', 'geode-calcite.req', 'geode-amethyst.req', 'geode-quartz.req'];
            Assert.deepEqual(parsed.references, expectedReferences);
        });

        it('should parse a general markdown table', async () => {
            const parser = new MarkdownParser();
            const tableContent = `
Some text before

| Name | Age | City |
|------|-----|------|
| John | 25  | NY   |
| Jane | 30  | LA   |

Some text after
`;
            const result = parser.parseMarkdownTable(tableContent);
            const expected = [
                { Name: 'John', Age: '25', City: 'NY' },
                { Name: 'Jane', Age: '30', City: 'LA' }
            ];
            Assert.deepEqual(result, expected);
        });

        it('should parse change table for tersify', async () => {
            const parser = new MarkdownParser();
            const tableContent = `
AI analysis complete.

| Target Document | Action | Details | Reason |
|-----------------|--------|---------|--------|
| geode-rose-quartz.req.md | Remove from Overview | Rose Quartz moves one space | Duplicate |
| geode-rose-quartz.req.md | Add to AI-CLARIFY section | Color distinction noted | Missing detail |
| faction.req.md | None | - | - |

End of report.
`;
            const result = parser.parseChangeTable(tableContent);
            const expected = [
                { document: 'geode-rose-quartz.req.md', action: 'Remove from Overview', details: 'Rose Quartz moves one space', reason: 'Duplicate' },
                { document: 'geode-rose-quartz.req.md', action: 'Add to AI-CLARIFY section', details: 'Color distinction noted', reason: 'Missing detail' },
                { document: 'faction.req.md', action: 'None', details: '', reason: '' }
            ];
            Assert.deepEqual(result, expected);
        });

        it('should parse tersify response table with formatted separator', async () => {
            const parser = new MarkdownParser();
            const fs = await import('fs/promises');
            const content = await fs.readFile('/home/ca0v/code/prompt-press/test/data/tersify-response.md', 'utf-8');
            const result = parser.parseMarkdownTable(content);
            Assert.equal(result.length, 20);
            Assert.equal(result[0]['Target Document'], 'faction.req');
            Assert.equal(result[0]['Action'], 'Remove from Overview');
            Assert.equal(result[0]['Details'], 'The base faction is called **The Crystalline Guard** and is detailed in @faction-crystaline-guard.req;');
            Assert.equal(result[19]['Target Document'], 'geode-rose-quartz.req');
            Assert.equal(result[19]['Action'], 'None');
        });
    });
    await runner.run();
}