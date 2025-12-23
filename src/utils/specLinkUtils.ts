/**
 * Utility functions for spec document linking.
 */

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