import { TestRunner, it } from './framework.js';
import { SpecReferenceFinder } from '../providers/specReferenceFinder.js';
import * as path from 'path';

export async function runSpecReferenceFinderTests() {
    const runner = new TestRunner();

    runner.describe('SpecReferenceFinder', () => {
        it('should find references to a REFID in spec files', async () => {
            const workspaceRoot = path.resolve(__dirname, '../../'); // Adjust path as needed
            const finder = new SpecReferenceFinder(workspaceRoot);
            const locations = await finder.findAllReferences('promptpress.design/DES-1016');
            // Assuming there are some references, check that locations are returned
            if (locations.length === 0) {
                throw new Error('Expected to find at least one reference to DES-1016');
            }
            // Check that each location has uri and range
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