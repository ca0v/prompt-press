import * as fs from 'fs';
import * as path from 'path';
import { resolveSpecPath } from './resolveSpecPath.js';
import { getAllSpecRefs } from './getAllSpecRefs.js';
import { MarkdownParser } from '../parsers/markdownParser.js';

export class SpecReferenceManager {
    private workspaceRoot: string;
    private markdownParser: MarkdownParser;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.markdownParser = new MarkdownParser();
    }

    // PromptPress/IMP-1062
    // Now uses the helper from resolveSpecPath.ts
    resolveSpecPath(specRef: string): string {
        return resolveSpecPath(this.workspaceRoot, specRef);
    }

    // PromptPress/IMP-1063
    async getAllSpecRefs(): Promise<string[]> {
        return getAllSpecRefs(this.workspaceRoot);
    }

    // PromptPress/IMP-1064
    getAllDependencies(specRef: string, visited: Set<string> = new Set()): Set<string> {
        if (visited.has(specRef)) {
            return new Set();
        }
        visited.add(specRef);
        const filePath = this.resolveSpecPath(specRef);
        if (!fs.existsSync(filePath)) {
            return new Set();
        }
        const deps = new Set<string>();
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsed = this.markdownParser.parse(content);
            if (parsed.metadata.dependsOn) {
                for (const d of parsed.metadata.dependsOn) {
                    if (d && !visited.has(d)) {
                        deps.add(d);
                        const sub = this.getAllDependencies(d, new Set(visited));
                        sub.forEach(sd => deps.add(sd));
                    }
                }
            }
        } catch {
            // Ignore errors when reading files
        }
        return deps;
    }

    // PromptPress/IMP-1065
    wouldCreateCycle(dep: string, currentRef: string): boolean {
        const allDeps = this.getAllDependencies(dep);
        return allDeps.has(currentRef);
    }
}