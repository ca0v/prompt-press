import { getTargetPhase, getBaseName } from '../utils/specLinkUtils.js';
import { TestRunner, it } from './framework.js';
import { Assert } from "./Assert.js";

export async function runSpecLinkUtilsTests(): Promise<void> {
    const runner = new TestRunner();

    runner.describe('Spec Link Utils', () => {
        runner.describe('getTargetPhase', () => {
            it('should return "requirements" for FR', () => {
                Assert.equal(getTargetPhase('FR'), 'requirements');
            });

            it('should return "requirements" for NFR', () => {
                Assert.equal(getTargetPhase('NFR'), 'requirements');
            });

            it('should return "design" for DES', () => {
                Assert.equal(getTargetPhase('DES'), 'design');
            });

            it('should return "implementation" for IMP', () => {
                Assert.equal(getTargetPhase('IMP'), 'implementation');
            });

            it('should return null for unknown type', () => {
                Assert.equal(getTargetPhase('UNKNOWN'), null);
            });

            it('should return null for empty string', () => {
                Assert.equal(getTargetPhase(''), null);
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