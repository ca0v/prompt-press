import { getTargetFolder, getTargetExt, getBaseName, resolveSpecFilePath, extractSpecBlock } from '../utils/specLinkUtils.js';
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

        runner.describe('resolveSpecFilePath', () => {
            it('should resolve FR spec from comment', () => {
                const result = resolveSpecFilePath('FR-1019', '// PromptPress/FR-1019', '/some/file.ts', '/workspace');
                Assert.equal(result, '/workspace/specs/requirements/PromptPress.req.md');
            });

            it('should resolve IMP spec from comment', () => {
                const result = resolveSpecFilePath('IMP-1081', '// MyProject/IMP-1081', '/some/file.ts', '/workspace');
                Assert.equal(result, '/workspace/specs/implementation/MyProject.impl.md');
            });

            it('should resolve DES spec from spec file', () => {
                const result = resolveSpecFilePath('DES-1039', 'some line', '/workspace/specs/design/promptpress.design.md', '/workspace');
                Assert.equal(result, '/workspace/specs/design/promptpress.design.md');
            });

            it('should throw error for unknown artifact', () => {
                Assert.throws(() => {
                    resolveSpecFilePath('IMP-1000', 'no comment', '/some/file.ts', '/workspace');
                }, 'Artifact was not explicitly defined in the comment and could not be inferred from the current document name');
            });

            it('should return null for unknown type', () => {
                const result = resolveSpecFilePath('UNK-1000', 'line', '/file.ts', '/workspace');
                Assert.equal(result, null);
            });

            it('should throw error for lowercase type', () => {
                Assert.throws(() => {
                    resolveSpecFilePath('fr-1019', '// PromptPress/fr-1019', '/some/file.ts', '/workspace');
                }, "Spec ID type 'fr' must be uppercase");
            });
        });

        runner.describe('extractSpecBlock', () => {
            it('should extract block for simple FR spec', () => {
                const content = `### FR-1001
- **Description**: Test description
- **Priority**: High

### FR-1002
- **Description**: Another`;
                const result = extractSpecBlock(content, 'FR-1001');
                Assert.equal(result, '- **Description**: Test description\n- **Priority**: High');
            });

            it('should extract block for complex IMP spec', () => {
                const content = `### attack(enemy: IEnemy) (IMP-1002)
- **Belongs to**: SomeClass
- **Description**: Attack method

### defend() (IMP-1003)
- **Belongs to**: SomeClass`;
                const result = extractSpecBlock(content, 'IMP-1002');
                Assert.equal(result, '- **Belongs to**: SomeClass\n- **Description**: Attack method');
            });

            it('should extract block for DES spec with parentheses', () => {
                const content = `### CascadeCore (DES-1018)
- **Description**: Core class
- **Inheritance**: None

### Another (DES-1019)`;
                const result = extractSpecBlock(content, 'DES-1018');
                Assert.equal(result, '- **Description**: Core class\n- **Inheritance**: None');
            });

            it('should return null if spec not found', () => {
                const content = `### FR-1001
content`;
                const result = extractSpecBlock(content, 'FR-1002');
                Assert.equal(result, null);
            });

            it('should extract until end if no next section', () => {
                const content = `### FR-1001
- **Description**: Last spec
- **Priority**: Low`;
                const result = extractSpecBlock(content, 'FR-1001');
                Assert.equal(result, '- **Description**: Last spec\n- **Priority**: Low');
            });

            it('should return null for content without matching spec header', () => {
                const content = `# Implementation Specification for Attacks

## Overview
- The Attacks module implements various enemy attack behaviors and sensor mechanisms for triggering attacks in the game, including charge, explode, leap, smash, slide, and spirit attacks, along with sensors for death, jump, proximity, and time-based triggers.
- **chargeAttack.ts** - Implements charge attack behavior.
- **deathAttackSensor.ts** - Sensor for triggering attacks on enemy death.
- **explodeAttack.ts** - Implements explode attac…Libraries**: None
- **Internal Dependencies**: models, fun utilities, games assets, IAttackState
- **System Requirements**: ES6+ async/await support

## Error Handling
- Checks for enemy death before actions.
- Graceful returns if conditions not met.

## Performance Considerations
- Async delays use sleep utility.
- Physics cloning for state preservation.

## Security Considerations
- No user input; internal game logic.

## Notes
- Attacks are modular, triggered by sensors based on game state.`;
                const result = extractSpecBlock(content, 'IMP-1003');
                Assert.equal(result, null);
            });
        });
    });

    await runner.run();
    runner.printSummary();
}

// Export for use in main test runner
export { runSpecLinkUtilsTests as default };