import * as path from 'path';
import * as fs from 'fs/promises';
import { MarkdownParser, ParsedSpec } from '../parsers/markdownParser.js';

export interface ContextItem {
    filePath: string;
    specType: 'requirement' | 'design' | 'implementation' | 'concept';
    content: string;
    metadata: any;
}

export class ContextBuilderCore {
    private parser: MarkdownParser;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.parser = new MarkdownParser();
    }

    /**
     * Build context for a changed file based on phase-aware strategy
     */
    // promptpress/IMP-1030
    public async buildContext(
        changedFilePath: string,
        maxTokens: number = 8000
    ): Promise<{ context: ContextItem[]; summary: string }> {
        const context: ContextItem[] = [];
        
        // Parse the changed file
        const changedSpec = await this.parser.parseFile(changedFilePath);
        const changedItem = await this.createContextItem(changedFilePath, changedSpec);
        context.push(changedItem);

        // Include ConOps for requirement files
        const phase = changedSpec.metadata.phase;
        if (phase === 'requirement') {
            const conopsPath = path.join(path.dirname(path.dirname(changedFilePath)), 'ConOps.md');
            try {
                await fs.access(conopsPath);
                const conopsSpec = await this.parser.parseFile(conopsPath);
                context.push(await this.createContextItem(conopsPath, conopsSpec));
            } catch {
                // ConOps doesn't exist or can't be read
            }
        }

        // Determine what additional context to include based on phase
        const artifactName = changedSpec.metadata.artifact;

        // Add phase-based dependencies
        if (phase === 'design' || phase === 'implementation') {
            // Include requirement file
            const reqFile = await this.findRelatedFile(artifactName, 'requirement');
            if (reqFile) {
                const reqSpec = await this.parser.parseFile(reqFile);
                context.push(await this.createContextItem(reqFile, reqSpec));
            }
        }

        if (phase === 'implementation') {
            // Include design file
            const designFile = await this.findRelatedFile(artifactName, 'design');
            if (designFile) {
                const designSpec = await this.parser.parseFile(designFile);
                context.push(await this.createContextItem(designFile, designSpec));
            }
        }

        // Add explicitly referenced files
        for (const ref of changedSpec.references) {
            const refFile = await this.resolveReference(ref);
            if (refFile && !context.some(c => c.filePath === refFile)) {
                try {
                    const refSpec = await this.parser.parseFile(refFile);
                    context.push(await this.createContextItem(refFile, refSpec));
                } catch (error) {
                    console.warn(`Failed to load reference ${ref}:`, error);
                }
            }
        }

        // Create summary
        const summary = this.createContextSummary(context, changedFilePath);

        return { context, summary };
    }

    /**
     * Load additional documents requested by AI
     */
    // promptpress/IMP-1031
    public async loadRequestedDocuments(docRefs: string[]): Promise<ContextItem[]> {
        const items: ContextItem[] = [];

        for (const ref of docRefs) {
            const filePath = await this.resolveReference(ref);
            if (filePath) {
                try {
                    const spec = await this.parser.parseFile(filePath);
                    items.push(await this.createContextItem(filePath, spec));
                } catch (error) {
                    console.warn(`Failed to load requested document ${ref}:`, error);
                }
            }
        }

        return items;
    }

    /**
     * Create a context item from parsed spec
     */
    private async createContextItem(
        filePath: string,
        spec: ParsedSpec
    ): Promise<ContextItem> {
        return {
            filePath,
            specType: spec.metadata.phase,
            content: spec.content,
            metadata: spec.metadata
        };
    }

    /**
     * Find related file by artifact name and type
     */
    private async findRelatedFile(
        artifactName: string,
        type: 'requirement' | 'design' | 'implementation'
    ): Promise<string | null> {
        const extensions: { [key: string]: string } = {
            'requirement': '.req.md',
            'design': '.design.md',
            'implementation': '.impl.md'
        };

        const typeDir: { [key: string]: string } = {
            'requirement': 'requirements',
            'design': 'design',
            'implementation': 'implementation'
        };

        const expectedPath = path.join(
            this.workspaceRoot,
            'specs',
            typeDir[type],
            `${artifactName}${extensions[type]}`
        );

        try {
            await fs.access(expectedPath);
            return expectedPath;
        } catch {
            return null;
        }
    }

    /**
     * Resolve @ref:artifact-name.phase to file path
     */
    private async resolveReference(ref: string): Promise<string | null> {
        // Parse reference: artifact-name.req -> {artifact: artifact-name, type: requirement}
        const match = ref.match(/^([a-zA-Z0-9-]+)\.(req|design|impl)$/);
        if (!match) {
            return null;
        }

        const artifactName = match[1];
        const typeMap: { [key: string]: 'requirement' | 'design' | 'implementation' } = {
            'req': 'requirement',
            'design': 'design',
            'impl': 'implementation'
        };
        const type = typeMap[match[2]];

        return await this.findRelatedFile(artifactName, type);
    }

    /**
     * Create a summary of the context being sent
     */
    private createContextSummary(context: ContextItem[], primaryFile: string): string {
        const lines: string[] = [
            `Context includes ${context.length} file(s):`,
            ''
        ];

        for (const item of context) {
            const isPrimary = item.filePath === primaryFile;
            const marker = isPrimary ? '→' : ' ';
            const fileName = path.basename(item.filePath);
            lines.push(`${marker} ${fileName} (${item.specType})`);
        }

        return lines.join('\n');
    }

    /**
     * Estimate token count (rough approximation)
     */
    // promptpress/IMP-1032
    public estimateTokens(context: ContextItem[]): number {
        let totalChars = 0;
        for (const item of context) {
            totalChars += item.content.length;
        }
        // Rough estimate: 1 token ≈ 4 characters
        return Math.ceil(totalChars / 4);
    }

    /**
     * Format context for AI prompt
     */
    // promptpress/IMP-1033
    public formatContextForAI(context: ContextItem[]): string {
        const parts: string[] = [];

        for (const item of context) {
            const fileName = path.basename(item.filePath);
            parts.push(`--- ${fileName} ---`);
            parts.push(item.content);
            parts.push('');
        }

        return parts.join('\n');
    }
}