/**
 * Tests for IDE validation logic
 * Tests parsing of mentions, validation of references, circular dependencies, over-specification
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { MarkdownParser } from '../parsers/markdownParser';
import { TestRunner, it } from './framework';
import { Assert } from "./Assert";

const tmpDir = path.join(__dirname, '../../test-output/ide-validation');
const parser = new MarkdownParser();

// Mock file system for testing
class MockFileSystem {
    private files: Set<string> = new Set();

    addFile(filePath: string) {
        this.files.add(path.resolve(filePath));
    }

    exists(filePath: string): boolean {
        return this.files.has(path.resolve(filePath));
    }
}

const mockFs = new MockFileSystem();

// Helper to check if ref is over-specified
function isOverSpecified(ref: string): boolean {
    return !/^[a-zA-Z0-9-]+\.(req|design|impl)$/.test(ref);
}

// Helper to resolve spec path
function resolveSpecPath(specRef: string): string {
    const [artifact, phase] = specRef.split('.');
    let subdir = '';
    if (phase === 'req') subdir = 'requirements';
    else if (phase === 'design') subdir = 'design';
    else if (phase === 'impl') subdir = 'implementation';
    return path.join(tmpDir, 'specs', subdir, `${artifact}.${phase}.md`);
}

// Helper to get all dependencies (simplified for test)
function getAllDependencies(specRef: string, visited: Set<string> = new Set()): Set<string> {
    if (visited.has(specRef)) {
        return new Set();
    }
    visited.add(specRef);

    const filePath = resolveSpecPath(specRef);
    if (!mockFs.exists(filePath)) {
        return new Set();
    }

    // Simulate reading and parsing
    const deps = new Set<string>();
    // For test, assume some deps
    if (specRef === 'a.req') deps.add('b.req');
    if (specRef === 'b.req') deps.add('a.req');

    const subDeps = new Set<string>();
    for (const dep of deps) {
        if (!visited.has(dep)) {
            const sub = getAllDependencies(dep, new Set(visited));
            sub.forEach(d => subDeps.add(d));
        }
    }

    deps.forEach(d => subDeps.add(d));
    return subDeps;
}

async function createSpec(fileName: string, frontmatter: string, body: string = '# Test') {
    const filePath = path.join(tmpDir, fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${frontmatter}\n${body}`, 'utf-8');
    return filePath;
}

async function getDiagnostics(filePath: string): Promise<any[]> {
    const watcher = new SpecFileWatcher(false, path.resolve(tmpDir, '..', '..'));
    const diagnostics: any[] = [];
    (watcher as any).diagnosticCollection = {
        set: (uri: any, diags: any[]) => {
            diagnostics.push(...diags);
        }
    };
    await (watcher as any).validateReferences(filePath);
    return diagnostics;
}

export async function runIdeValidationTests() {
    // Clean up
    await fs.rm(tmpDir, { recursive: true, force: true });

    new TestRunner().describe('IDE Validation Tests', () => {
        it('should extract simple mentions from content', () => {
            const content = `
# Test
This references @foo.req and @bar.design
`;
            const parsed = parser.parse(content);
            Assert.deepEqual(parsed.references, ['foo.req', 'bar.design']);
        });

        it('should extract mentions with over-specification', () => {
            const content = `
# Test
This references @foo.req[extra] and @bar.design
`;
            const parsed = parser.parse(content);
            Assert.deepEqual(parsed.references, ['foo.req[extra]', 'bar.design']);
        });

        it('should validate depends-on existence', async () => {
            await createSpec('specs/requirements/foo.req.md', '---\nartifact: foo\nphase: requirement\n---');
            const filePath = await createSpec('specs/requirements/test.req.md', '---\nartifact: test\nphase: requirement\ndepends-on: [foo.req]\n---');

            const diagnostics = await getDiagnostics(filePath);

            Assert.equal(diagnostics.length, 0, 'Should have no diagnostics for existing dependency');
        });

        it('should report warning for non-existent depends-on', async () => {
            const filePath = await createSpec('specs/requirements/test.req.md', '---\nartifact: test\nphase: requirement\ndepends-on: [nonexistent.req]\n---');

            const diagnostics = await getDiagnostics(filePath);

            Assert.equal(diagnostics.length, 1);
            Assert.equal(diagnostics[0].message, "Dependency 'nonexistent.req' not found");
            Assert.equal(diagnostics[0].severity, 1); // Warning
        });

        it('should report warning for over-specified depends-on', async () => {
            const filePath = await createSpec('specs/requirements/test.req.md', '---\nartifact: test\nphase: requirement\ndepends-on: [foo.req[extra]]\n---');

            const diagnostics = await getDiagnostics(filePath);

            Assert.equal(diagnostics.length, 1);
            Assert.equal(diagnostics[0].message, "Depends-on 'foo.req[extra]' is over-specified");
            Assert.equal(diagnostics[0].severity, 1);
        });

        it('should report warning for circular dependency', async () => {
            await createSpec('specs/requirements/a.req.md', '---\nartifact: a\nphase: requirement\ndepends-on: [b.req]\n---');
            await createSpec('specs/requirements/b.req.md', '---\nartifact: b\nphase: requirement\ndepends-on: [a.req]\n---');
            const filePath = path.join(tmpDir, 'specs/requirements/a.req.md');

            const diagnostics = await getDiagnostics(filePath);

            Assert.equal(diagnostics.length, 1);
            Assert.equal(diagnostics[0].message, "Dependency 'b.req' creates a circular dependency");
            Assert.equal(diagnostics[0].severity, 1);
        });

        it('should validate references existence', async () => {
            await createSpec('specs/requirements/foo.req.md', '---\nartifact: foo\nphase: requirement\n---');
            const filePath = await createSpec('specs/requirements/test.req.md', '---\nartifact: test\nphase: requirement\nreferences: [foo.req]\n---');

            const diagnostics = await getDiagnostics(filePath);

            Assert.equal(diagnostics.length, 0);
        });

        it('should report warning for non-existent references', async () => {
            const filePath = await createSpec('specs/requirements/test.req.md', '---\nartifact: test\nphase: requirement\nreferences: [nonexistent.req]\n---');

            const diagnostics = await getDiagnostics(filePath);

            Assert.equal(diagnostics.length, 1);
            Assert.equal(diagnostics[0].message, "Reference 'nonexistent.req' not found");
            Assert.equal(diagnostics[0].severity, 1);
        });

        it('should validate content mentions existence', async () => {
            await createSpec('specs/requirements/foo.req.md', '---\nartifact: foo\nphase: requirement\n---');
            const filePath = await createSpec('specs/requirements/test.req.md', '---\nartifact: test\nphase: requirement\n---', '# Test\nSee @foo.req');

            const diagnostics = await getDiagnostics(filePath);

            Assert.equal(diagnostics.length, 0);
        });

        it('should report warning for non-existent content mentions', async () => {
            const filePath = await createSpec('specs/requirements/test.req.md', '---\nartifact: test\nphase: requirement\n---', '# Test\nSee @nonexistent.req');

            const diagnostics = await getDiagnostics(filePath);

            Assert.equal(diagnostics.length, 1);
            Assert.equal(diagnostics[0].message, "Mention 'nonexistent.req' not found");
            Assert.equal(diagnostics[0].severity, 1);
        });

        it('should report warning for over-specified content mentions', async () => {
            const filePath = await createSpec('specs/requirements/test.req.md', '---\nartifact: test\nphase: requirement\n---', '# Test\nSee @foo.req[extra]');

            const diagnostics = await getDiagnostics(filePath);

            Assert.equal(diagnostics.length, 1);
            Assert.equal(diagnostics[0].message, "Mention 'foo.req[extra]' is over-specified");
            Assert.equal(diagnostics[0].severity, 1);
        });
    });
}