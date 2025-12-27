/**
 * Utility functions for spec document linking.
 */

import * as path from 'path';

/**
 * Maps ID types to their corresponding phase folders.
 */
export function getTargetFolder(type: string): string | null {
    const folderMap: { [key: string]: string } = {
        'FR': 'requirements',
        'NFR': 'requirements',
        'DES': 'design',
        'IMP': 'implementation'
    };
    return folderMap[type] || null;
}

/**
 * Maps ID types to their corresponding file extensions.
 */
export function getTargetExt(type: string): string | null {
    const extMap: { [key: string]: string } = {
        'FR': 'req',
        'NFR': 'req',
        'DES': 'design',
        'IMP': 'impl'
    };
    return extMap[type] || null;
}

/**
 * Extracts the base name from a spec file path.
 * For example, 'promptpress.design.md' -> 'promptpress'
 */
export function getBaseName(fileName: string): string {
    const base = fileName.split('/').pop() || '';
    const parts = base.split('.');
    if (parts.length >= 3) {
        return parts.slice(0, -2).join('.');
    } else {
        return '';
    }
}

/**
 * Resolves the file path for a given spec ID by determining the artifact, folder, and extension.
 * The fully-qualified SPEC-ID format is ArtifactName.[req|design|impl]/SPEC-ID
 */
export function resolveSpecFilePath(specId: string, lineText: string, fileName: string, workspaceRoot: string): string | null {
    // Determine the spec type (FR, DES, IMP)
    const type = specId.split('-')[0];
    if (type !== type.toUpperCase()) {
        throw new Error(`Spec ID type '${type}' must be uppercase`);
    }
    const folder = getTargetFolder(type);
    const ext = getTargetExt(type);
    if (!folder || !ext) {
        return null;
    }

    let artifact: string | null = null;
    const commentRegex = new RegExp(`\\/\\/\\s*([a-zA-Z0-9_-]+)\\/\\s*${specId}\\b`);
    const commentMatch = lineText.match(commentRegex);
    if (commentMatch) {
        artifact = commentMatch[1];
    } else {
        // Fall back to fileName if it's a spec file
        const baseFileName = path.basename(fileName);
        if (baseFileName.match(/^[a-zA-Z0-9_-]+\.(req|design|impl)\.md$/)) {
            artifact = getBaseName(baseFileName);
        }
    }

    if (!artifact) {
        throw new Error('Artifact was not explicitly defined in the comment and could not be inferred from the current document name');
    }

    // Construct the file path
    return path.join(workspaceRoot, 'specs', folder, `${artifact}.${ext}.md`);
}

/**
 * Extracts the specification block for a given spec ID from the content.
 * Finds the section header containing the spec ID and extracts the content until the next section header.
 */
export function extractSpecBlock(content: string, specId: string): string | null {
    // Find the section starting with "### " and containing the SPEC_ID
    const regex = new RegExp(`^###.*${specId}[^a-zA-Z0-9_-]*`, 'm');
    const match = content.match(regex);
    if (!match) {
        return null;
    }

    const startIndex = match.index! + match[0].length;

    // Extract the entire specification block (from "### SPEC_ID" to the next section header or end of content)
    const nextMatch = content.substring(startIndex).match(/^#{1,3} /m);
    const endIndex = nextMatch ? startIndex + nextMatch.index! : content.length;
    const block = content.substring(startIndex, endIndex).trim();

    return block;
}