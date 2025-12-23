import { getTargetFolder, getTargetExt, getBaseName } from '../utils/specLinkUtils.js';
import { TestRunner, it } from './framework.js';
import { Assert } from "./Assert.js";

export async function runSpecLinkUtilsTests(): Promise<void> {
    const runner = new TestRunner();

    runner.describe('Spec Link Utils', () => {
        runner.describe('getTargetFolder', () => {
            it('should return "requirements" for FR', () => {
                Assert.equal(getTargetFolder('FR'), 'requirements');
            });

            it('should return "requirements" for NFR', () => {
                Assert.equal(getTargetFolder('NFR'), 'requirements');
            });

            it('should return "design" for DES', () => {
                Assert.equal(getTargetFolder('DES'), 'design');
            });

            it('should return "implementation" for IMP', () => {
                Assert.equal(getTargetFolder('IMP'), 'implementation');
            });

            it('should return null for unknown type', () => {
                Assert.equal(getTargetFolder('UNKNOWN'), null);
            });

            it('should return null for empty string', () => {
                Assert.equal(getTargetFolder(''), null);
            });
        });

        runner.describe('getTargetExt', () => {
            it('should return "req" for FR', () => {
                Assert.equal(getTargetExt('FR'), 'req');
            });

            it('should return "req" for NFR', () => {
                Assert.equal(getTargetExt('NFR'), 'req');
            });

            it('should return "design" for DES', () => {
                Assert.equal(getTargetExt('DES'), 'design');
            });

            it('should return "impl" for IMP', () => {
                Assert.equal(getTargetExt('IMP'), 'impl');
            });

            it('should return null for unknown type', () => {
                Assert.equal(getTargetExt('UNKNOWN'), null);
            });

            it('should return null for empty string', () => {
                Assert.equal(getTargetExt(''), null);
            });
        });

        runner.describe('getBaseName', () => {
            it('should extract base name from design file', () => {
                Assert.equal(getBaseName('promptpress.design.md'), 'promptpress');
            });

            it('should extract base name from req file', () => {
                Assert.equal(getBaseName('hello-world.req.md'), 'hello-world');
            });

            it('should extract base name from impl file', () => {
                Assert.equal(getBaseName('myproject.impl.md'), 'myproject');
            });

            it('should handle file with multiple dots', () => {
                Assert.equal(getBaseName('my.project.name.design.md'), 'my.project.name');
            });

            it('should handle file without extension', () => {
                Assert.equal(getBaseName('promptpress'), '');
            });

            it('should handle file with path', () => {
                Assert.equal(getBaseName('/path/to/promptpress.design.md'), 'promptpress');
            });

            it('should handle empty string', () => {
                Assert.equal(getBaseName(''), '');
            });
        });
    });

    await runner.run();
    runner.printSummary();
}

// Export for use in main test runner
export { runSpecLinkUtilsTests as default };