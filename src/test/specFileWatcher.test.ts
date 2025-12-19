import * as fs from 'fs/promises';
import * as path from 'path';
import { SpecFileWatcher } from '../watchers/specFileWatcher.js';
import { MarkdownParser } from '../parsers/markdownParser.js';
import { TestRunner, it } from './framework.js';
import { Assert } from "./Assert.js";
import { __dirname } from '../utils/dirname.js';
const tmpDir = path.join(__dirname, '../../test-output/specFileWatcher');
const parser = new MarkdownParser();

async function writeAndSaveSpec(fileName: string, frontmatter: string, body: string) {
    const filePath = path.join(tmpDir, fileName);
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(filePath, `${frontmatter}\n${body}`, 'utf-8');
    // Simulate watcher save
    const watcher = new SpecFileWatcher(false, path.resolve(tmpDir, '..', '..'));
    // Directly call updateMetadata (simulate save)
    await watcher['updateMetadata'](filePath);
    return filePath;
}

new TestRunner().describe('SpecFileWatcher', () => {
    it('should set correct phase and last-updated for requirement', async () => {
        const fileName = 'artifact1.req.md';
        const frontmatter = `---\nartifact: artifact1\nphase: wrong\nlast-updated: 2000-01-01\n---`;
        const body = '\n# Test\n';
        const filePath = await writeAndSaveSpec(fileName, frontmatter, body);
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parser.parse(content);
        Assert.equal(parsed.metadata.artifact, 'artifact1');
        Assert.equal(parsed.metadata.phase, 'requirement');
        Assert.ok(parsed.metadata.lastUpdated && parsed.metadata.lastUpdated.match(/^\d{4}-\d{2}-\d{2}$/), 'last-updated should be set to today');
    });
    it('should set correct phase and last-updated for design', async () => {
        const fileName = 'artifact2.design.md';
        const frontmatter = `---\nartifact: artifact2\nphase: wrong\nlast-updated: 2000-01-01\n---`;
        const body = '\n# Test\n';
        const filePath = await writeAndSaveSpec(fileName, frontmatter, body);
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parser.parse(content);
        Assert.equal(parsed.metadata.artifact, 'artifact2');
        Assert.equal(parsed.metadata.phase, 'design');
        Assert.ok(parsed.metadata.lastUpdated && parsed.metadata.lastUpdated.match(/^\d{4}-\d{2}-\d{2}$/), 'last-updated should be set to today');
    });
    it('should set correct phase and last-updated for implementation', async () => {
        const fileName = 'artifact3.impl.md';
        const frontmatter = `---\nartifact: artifact3\nphase: wrong\nlast-updated: 2000-01-01\n---`;
        const body = '\n# Test\n';
        const filePath = await writeAndSaveSpec(fileName, frontmatter, body);
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parser.parse(content);
        Assert.equal(parsed.metadata.artifact, 'artifact3');
        Assert.equal(parsed.metadata.phase, 'implementation');
        Assert.ok(parsed.metadata.lastUpdated && parsed.metadata.lastUpdated.match(/^\d{4}-\d{2}-\d{2}$/), 'last-updated should be set to today');
    });
});
