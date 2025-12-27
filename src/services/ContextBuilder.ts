import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { MarkdownParser, ParsedSpec } from '../parsers/markdownParser.js';
import { ContextBuilderCore, ContextItem } from './ContextBuilderCore.js';

export { ContextItem } from './ContextBuilderCore.js';

export class ContextBuilder {
    private core: ContextBuilderCore;

    constructor(workspaceRoot: string) {
        this.core = new ContextBuilderCore(workspaceRoot);
    }

    /**
     * Build context for a changed file based on phase-aware strategy
     */
    // promptpress/IMP-1030
    public async buildContext(
        changedFilePath: string,
        maxTokens: number = 8000
    ): Promise<{ context: ContextItem[]; summary: string }> {
        return this.core.buildContext(changedFilePath, maxTokens);
    }

    /**
     * Load additional documents requested by AI
     */
    // promptpress/IMP-1031
    public async loadRequestedDocuments(docRefs: string[]): Promise<ContextItem[]> {
        return this.core.loadRequestedDocuments(docRefs);
    }

    /**
     * Estimate token count (rough approximation)
     */
    // promptpress/IMP-1032
    public estimateTokens(context: ContextItem[]): number {
        return this.core.estimateTokens(context);
    }

    /**
     * Format context for AI prompt
     */
    // promptpress/IMP-1033
    public formatContextForAI(context: ContextItem[]): string {
        return this.core.formatContextForAI(context);
    }
}
