import { TestRunner, it } from './framework.js';
import { Assert } from "./Assert.js";
import { MarkdownParser } from '../parsers/markdownParser.js';

export async function runMarkdownParserTest(): Promise<void> {
    const runner = new TestRunner();
    runner.describe('MarkdownParser', () => {
        it('should extract references without trailing punctuation', async () => {
            const parser = new MarkdownParser();
            const content = 'The base @faction.req consists of five distinct geode types: @geode-pyrite.req, @geode-quartz.req, @geode-calcite.req, @geode-amethyst.req, and @geode-quartz.req.';
            const parsed = parser.parse(content);
            const expectedReferences = ['faction.req', 'geode-pyrite.req', 'geode-quartz.req', 'geode-calcite.req', 'geode-amethyst.req', 'geode-quartz.req'];
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

| Document | Action | Details |
|----------|--------|---------|
| geode-rose-quartz.req.md | Remove from Overview | Rose Quartz moves one space |
| geode-rose-quartz.req.md | Add to AI-CLARIFY section | Color distinction noted |
| faction.req.md | None | - |

End of report.
`;
            const result = parser.parseChangeTable(tableContent);
            const expected = [
                { document: 'geode-rose-quartz.req.md', action: 'Remove from Overview', details: 'Rose Quartz moves one space' },
                { document: 'geode-rose-quartz.req.md', action: 'Add to AI-CLARIFY section', details: 'Color distinction noted' },
                { document: 'faction.req.md', action: 'None', details: '' }
            ];
            Assert.deepEqual(result, expected);
        });
    });
    await runner.run();
}