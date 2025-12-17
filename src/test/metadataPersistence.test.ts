import { TestRunner, Assert, it } from './framework';
import * as path from 'path';
import * as fs from 'fs/promises';
import { MarkdownParser } from '../parsers/markdownParser';
import { SpecFileWatcher } from '../watchers/specFileWatcher';

const runner = new TestRunner();

runner.describe('Metadata Persistence Tests', () => {
    it('should preserve depends-on and references when saving', async () => {
        const workspaceRoot = path.join(process.cwd(), 'test-output', 'metadata-persistence');
        await fs.rm(workspaceRoot, { recursive: true, force: true }).catch(() => {});
        await fs.mkdir(workspaceRoot, { recursive: true });

        const filePath = path.join(workspaceRoot, 'ui-ux.req.md');
        const initial = `---\nartifact: ui-ux\nphase: requirement\ndepends-on: []\nreferences: [game-board.req, faction.req]\nversion: 1.0.0\nlast-updated: 2025-12-17\n---\n\n# UI/UX - Requirements\n\n## Overview\nText`;
        await fs.writeFile(filePath, initial, 'utf-8');

        const parser = new MarkdownParser();
        const spec = parser.parse(initial);
        Assert.ok(spec.metadata.dependsOn?.length === 0, 'depends-on parsed as empty array');
        Assert.ok(spec.metadata.references?.length === 2, 'references parsed with two entries');

        // Use SpecFileWatcher.updateFrontmatter to simulate save-time update
        const watcher = new SpecFileWatcher(false, workspaceRoot) as any;
        const updatedContent = watcher.updateFrontmatter(initial, spec.metadata);
        await fs.writeFile(filePath, updatedContent, 'utf-8');

        const updatedText = await fs.readFile(filePath, 'utf-8');
        // Verify frontmatter still contains depends-on and references
        Assert.ok(/depends-on:\s*\[\]/.test(updatedText), 'depends-on preserved as empty list');
        Assert.ok(/references:\s*\[.*["']game-board\.req["'].*["']faction\.req["'].*\]/.test(updatedText), 'references preserved');
    });

    it('should preserve non-empty depends-on list on save', async () => {
        const workspaceRoot = path.join(process.cwd(), 'test-output', 'metadata-persistence');
        await fs.mkdir(workspaceRoot, { recursive: true });

        const filePath = path.join(workspaceRoot, 'ui-ux.design.md');
        const initial = `---\nartifact: ui-ux\nphase: design\ndepends-on: [session-manager, crypto-utils]\nreferences: [game-board.req]\nversion: 1.0.0\nlast-updated: 2025-12-17\n---\n\n# UI/UX - Design\n\n## Overview\nText`;
        await fs.writeFile(filePath, initial, 'utf-8');

        const parser = new MarkdownParser();
        const spec = parser.parse(initial);
        Assert.equal(spec.metadata.dependsOn?.length, 2, 'non-empty depends-on parsed');
        Assert.equal(spec.metadata.references?.length, 1, 'one reference parsed');

        const watcher = new SpecFileWatcher(false, workspaceRoot) as any;
        const updatedContent = watcher.updateFrontmatter(initial, spec.metadata);
        await fs.writeFile(filePath, updatedContent, 'utf-8');

        const updatedText = await fs.readFile(filePath, 'utf-8');
        Assert.ok(/depends-on:\s*\[.*["']session-manager["'].*["']crypto-utils["'].*\]/.test(updatedText), 'depends-on preserved');
        Assert.ok(/references:\s*\[.*["']game-board\.req["'].*\]/.test(updatedText), 'references preserved');
    });
});

export default runner;
