import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Gets all spec references from the specs directory, filtered by allowed phases.
 * ConOps.md is always included if it exists.
 * @param workspaceRoot The workspace root directory
 * @param allowedPhases Array of allowed phase directory names (e.g., ['requirements', 'design'])
 * @returns Array of spec reference strings
 */
export async function getAllSpecRefs(
    workspaceRoot: string,
    allowedPhases: string[] = ['requirements', 'design', 'implementation']
): Promise<string[]> {
    const refs: string[] = [];
    const specsDir = path.join(workspaceRoot, 'specs');

    // Collect files from allowed phase directories
    for (const phase of allowedPhases) {
        const phaseDir = path.join(specsDir, phase);
        try {
            const files = await fs.readdir(phaseDir);
            for (const file of files) {
                if (file.endsWith('.md')) {
                    const match = file.match(/^([a-zA-Z0-9-]+)\.(req|design|impl)\.md$/);
                    if (match) {
                        refs.push(`${match[1]}.${match[2]}`);
                    }
                }
            }
        } catch (error) {
            // Phase directory doesn't exist, skip
        }
    }

    // Add ConOps if it exists
    try {
        await fs.access(path.join(specsDir, 'ConOps.md'));
        refs.push('ConOps');
    } catch {
        // ConOps doesn't exist, skip
    }

    return refs;
}