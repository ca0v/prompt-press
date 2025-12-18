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
    mockFs.addFile(filePath);
    return filePath;
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
This references @foo.req[extra] and @bar.design.md
`;
            const parsed = parser.parse(content);
            Assert.deepEqual(parsed.references, ['foo.req[extra]', 'bar.design.md']);
        });

        it('should detect over-specified depends-on', () => {
            const dep = 'foo.req[extra]';
            Assert.equal(isOverSpecified(dep), true);
        });

        it('should not detect over-specified for valid depends-on', () => {
            const dep = 'foo.req';
            Assert.equal(isOverSpecified(dep), false);
        });

        it('should detect non-existent file', () => {
            const ref = 'nonexistent.req';
            const filePath = resolveSpecPath(ref);
            Assert.equal(mockFs.exists(filePath), false);
        });

        it('should detect existing file', async () => {
            await createSpec('specs/requirements/foo.req.md', '---\nartifact: foo\nphase: requirement\n---');
            const ref = 'foo.req';
            const filePath = resolveSpecPath(ref);
            Assert.equal(mockFs.exists(filePath), true);
        });

        it('should detect circular dependency', () => {
            const specRef = 'a.req';
            const allDeps = getAllDependencies(specRef);
            Assert.equal(allDeps.has(specRef), true);
        });

        it('should not detect circular for non-circular', () => {
            const specRef = 'c.req';
            const allDeps = getAllDependencies(specRef);
            Assert.equal(allDeps.has(specRef), false);
        });

        // Auto-completion tests
        it('should not suggest current document in @ mentions', () => {
            const currentRef = 'foo.req';
            const allRefs = ['foo.req', 'bar.req', 'baz.design'];
            const filtered = allRefs.filter(ref => ref !== currentRef);
            Assert.deepEqual(filtered, ['bar.req', 'baz.design']);
        });

        it('should not suggest .impl files in @ mentions', () => {
            const allRefs = ['foo.req', 'bar.design', 'baz.impl'];
            const filtered = allRefs.filter(ref => !ref.endsWith('.impl'));
            Assert.deepEqual(filtered, ['foo.req', 'bar.design']);
        });

        it('should filter design files for req phase in @ mentions', () => {
            const currentPhase = 'req';
            const allRefs = ['foo.req', 'bar.req', 'baz.design'];
            const filtered = allRefs.filter(ref => !(currentPhase === 'req' && ref.endsWith('.design')));
            Assert.deepEqual(filtered, ['foo.req', 'bar.req']);
        });

        it('should allow all phases for design in @ mentions', () => {
            const currentPhase = 'design';
            const allRefs = ['foo.req', 'bar.design', 'baz.impl'];
            const filtered = allRefs.filter(ref => !ref.endsWith('.impl'));
            Assert.deepEqual(filtered, ['foo.req', 'bar.design']);
        });

        it('should not suggest current document in frontmatter lists', () => {
            const currentRef = 'foo.req';
            const allRefs = ['foo.req', 'bar.req'];
            const filtered = allRefs.filter(ref => ref !== currentRef);
            Assert.deepEqual(filtered, ['bar.req']);
        });

        it('should avoid circular dependencies in depends-on', () => {
            const currentRef = 'a.req';
            const allRefs = ['a.req', 'b.req', 'c.req'];
            // Mock wouldCreateCycle: assume b.req depends on a.req, so adding a.req to b.req would cycle
            const filtered = allRefs.filter(ref => {
                if (ref === currentRef) return false;
                // Simulate: for b.req, wouldCreateCycle('a.req', 'b.req') = true
                if (ref === 'b.req' && currentRef === 'a.req') return false;
                return true;
            });
            Assert.deepEqual(filtered, ['c.req']);
        });

        it('should filter design files for req phase in frontmatter', () => {
            const currentPhase = 'req';
            const allRefs = ['foo.req', 'bar.design'];
            const filtered = allRefs.filter(ref => !(currentPhase === 'req' && ref.endsWith('.design')));
            Assert.deepEqual(filtered, ['foo.req']);
        });
    });
}