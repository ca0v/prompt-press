import * as fs from 'fs';
import * as path from 'path';
import { MarkdownParser } from '../parsers/markdownParser.js';

export class SpecReferenceManager {
    private workspaceRoot: string;
    private markdownParser: MarkdownParser;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.markdownParser = new MarkdownParser();
    }

    // PromptPress/IMP-1062
    resolveSpecPath(specRef: string): string {
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
            return path.join(this.workspaceRoot, 'specs', subdir, `${artifact}.${phase}.md`);
        } else {
            return path.join(this.workspaceRoot, 'specs', phase ? `${artifact}.${phase}.md` : `${artifact}.md`);
        }
    }

    // PromptPress/IMP-1063
    getAllSpecRefs(): string[] {
        const refs: string[] = [];
        const specsDir = path.join(this.workspaceRoot, 'specs');
        if (!fs.existsSync(specsDir)) return refs;
        const subdirs = ['requirements', 'design', 'implementation'];
        for (const subdir of subdirs) {
            const dir = path.join(specsDir, subdir);
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
                for (const file of files) {
                    const match = file.match(/^([a-zA-Z0-9-]+)\.(req|design|impl)\.md$/);
                    if (match) {
                        refs.push(`${match[1]}.${match[2]}`);
                    }
                }
            }
        }
        // Add ConOps
        if (fs.existsSync(path.join(specsDir, 'ConOps.md'))) {
            refs.push('ConOps');
        }
        return refs;
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