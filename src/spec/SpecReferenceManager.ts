import * as fs from 'fs';
import * as path from 'path';

export class SpecReferenceManager {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

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
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (frontmatterMatch) {
                const yaml = frontmatterMatch[1];
                const dependsOnMatch = yaml.match(/depends-on:\s*\[([^\]]*)\]/);
                if (dependsOnMatch) {
                    const depsStr = dependsOnMatch[1];
                    const depRefs = depsStr.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                    for (const d of depRefs) {
                        if (d && !visited.has(d)) {
                            deps.add(d);
                            const sub = this.getAllDependencies(d, new Set(visited));
                            sub.forEach(sd => deps.add(sd));
                        }
                    }
                }
            }
        } catch {
            // Ignore errors when reading files
        }
        return deps;
    }

    wouldCreateCycle(dep: string, currentRef: string): boolean {
        const allDeps = this.getAllDependencies(dep);
        return allDeps.has(currentRef);
    }
}