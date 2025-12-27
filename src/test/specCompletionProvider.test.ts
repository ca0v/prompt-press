/**
 * UNTESTABLE: The SpecCompletionProvider depends on VS Code APIs and cannot be fully tested without mocking.
 * These tests only cover static utility methods.
 */
import { TestRunner, it } from './framework.js';
import { SpecCompletionProvider } from '../providers/specCompletionProvider.js';

export async function runSpecCompletionProviderTests() {
    const runner = new TestRunner();

    runner.describe('SpecCompletionProvider', () => {
        it('should extract IMP matches from text', () => {
            const text = '\n\n// Attacks/IMP-1000\n';
            const matches = (SpecCompletionProvider as any).extractImpMatches(text);
            if (matches.length !== 1) throw new Error(`Expected 1 match, got ${matches.length}`);
            const match = matches[0];
            if (match.specName !== 'Attacks') throw new Error(`Expected specName 'Attacks', got '${match.specName}'`);
            if (match.impId !== 'IMP-1000') throw new Error(`Expected impId 'IMP-1000', got '${match.impId}'`);
            if (match.index !== 2) throw new Error(`Expected index 2, got ${match.index}`);
        });

        it('should compute target path for spec name', () => {
            const result = (SpecCompletionProvider as any).computeTargetPath('Attacks');
            if (result !== './specs/implementation/Attacks.impl.md') {
                throw new Error(`Expected './specs/implementation/Attacks.impl.md', got '${result}'`);
            }
        });
    });

    await runner.run();
    runner.printSummary();
}