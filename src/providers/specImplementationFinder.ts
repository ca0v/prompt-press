import * as vscode from 'vscode';
import { logger } from '../utils/OutputLogger';

export class SpecImplementationFinder {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Finds all implementations based on file type and REFID following specific rules.
     */
    // promptpress/IMP-1078
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
                query = `// ${artifact}/${refId}`;
                break;
            default:
                logger.log(`Unexpected fileType: ${fileType}, no search performed`);
                return [];
        }

        logger.log(`Finding implementations for ${fileType} ${artifact}/${refId} with query: ${query}`);

        try {
            const locations: vscode.Location[] = [];
            const searchQuery = { pattern: query };
            const searchOptions = { include, exclude };
            await vscode.workspace.findTextInFiles(searchQuery, searchOptions, (result) => {
                for (const range of result.ranges) {
                    locations.push(new vscode.Location(result.uri, range));
                }
            });
            logger.log(`Found ${locations.length} implementations`);
            if (locations.length === 0) {
                logger.log(`No implementations found for query: ${query} in ${include}${exclude ? ` (excluding ${exclude})` : ''}`);
            }
            return locations;
        } catch (error) {
            logger.log(`Search failed: ${error}`);
            console.error('Search failed:', error);
            return [];
        }
    }


}