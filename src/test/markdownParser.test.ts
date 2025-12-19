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
    });
    await runner.run();
}