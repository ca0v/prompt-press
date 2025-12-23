import * as path from 'path';

/**
 * Resolves the file path for a given spec reference string.
 * @param workspaceRoot The root directory of the workspace.
 * @param specRef The spec reference string (e.g., artifact.req, artifact.design, artifact.impl).
 * @returns The resolved file path.
 */
export function resolveSpecPath(workspaceRoot: string, specRef: string): string {
    const parts = specRef.split('.');
    const artifact = parts[0];
    const phase = parts[1];
    let subdir = '';
    if (phase === 'req') {
        subdir = 'requirements';
    } else if (phase === 'design') {
        subdir = 'design';
    } else if (phase === 'impl') {
        subdir = 'implementation';
    }
    if (subdir) {
        return path.join(workspaceRoot, 'specs', subdir, `${artifact}.${phase}.md`);
    } else {
        return path.join(workspaceRoot, 'specs', phase ? `${artifact}.${phase}.md` : `${artifact}.md`);
    }
}