import * as vscode from 'vscode';

export class SpecImplementationFinder {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Finds all implementations based on file type and REFID following specific rules.
     */
    // PromptPress/IMP-1078
    async findAllImplementations(fileType: 'req' | 'design' | 'impl', refId: string, artifact: string): Promise<vscode.Location[]> {
        let query: string;
        let include: string;
        let exclude: string | undefined;

        switch (fileType) {
            case 'req':
                include = 'specs/design/**/*';
                query = `${artifact}.req/${refId}`;
                break;
            case 'design':
                include = 'specs/implementation/**/*';
                query = `${artifact}.design/${refId}`;
                break;
            case 'impl':
                include = '**/*';
                exclude = 'specs/**/*';
                query = `${artifact}/${refId}`;
                break;
            default:
                return [];
        }

        try {
            const locations: vscode.Location[] = [];
            const searchQuery = { pattern: query };
            const searchOptions = { include, exclude };
            await vscode.workspace.findTextInFiles(searchQuery, searchOptions, (result) => {
                for (const range of result.ranges) {
                    locations.push(new vscode.Location(result.uri, range));
                }
            });
            return locations;
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }


}