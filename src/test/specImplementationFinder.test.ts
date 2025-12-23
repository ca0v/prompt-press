import { TestRunner, it } from './framework.js';
import { SpecImplementationFinder } from '../providers/specImplementationFinder.js';
import * as path from 'path';

export async function runSpecImplementationFinderTests() {
    const runner = new TestRunner();

    runner.describe('SpecImplementationFinder', () => {
        it('should find implementations for req file type', async () => {
            const workspaceRoot = path.resolve(__dirname, '../../'); // Adjust path as needed
            const finder = new SpecImplementationFinder(workspaceRoot);
            const locations = await finder.findAllImplementations('req', 'FR-1002', 'promptpress');
            // Check that locations are returned or empty, depending on data
            for (const loc of locations) {
                if (!loc.uri || !loc.range) {
                    throw new Error('Location missing uri or range');
                }
            }
        });

        it('should find implementations for design file type', async () => {
            const workspaceRoot = path.resolve(__dirname, '../../');
            const finder = new SpecImplementationFinder(workspaceRoot);
            const locations = await finder.findAllImplementations('design', 'DES-1016', 'promptpress');
            for (const loc of locations) {
                if (!loc.uri || !loc.range) {
                    throw new Error('Location missing uri or range');
                }
            }
        });

        it('should find implementations for impl file type', async () => {
            const workspaceRoot = path.resolve(__dirname, '../../');
            const finder = new SpecImplementationFinder(workspaceRoot);
            const locations = await finder.findAllImplementations('impl', 'IMP-1016', 'promptpress');
            for (const loc of locations) {
                if (!loc.uri || !loc.range) {
                    throw new Error('Location missing uri or range');
                }
            }
        });
    });

    await runner.run();
    runner.printSummary();
}