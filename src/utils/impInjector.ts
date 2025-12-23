import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';

const MODULE_NAME = 'PromptPress';
const SRC_DIR = path.join(process.cwd(), 'src');

async function getTsFiles(): Promise<string[]> {
    const files: string[] = [];

    async function scan(dir: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'test') {
                    await scan(fullPath);
                }
            } else if (entry.name.endsWith('.ts')) {
                files.push(fullPath);
            }
        }
    }

    await scan(SRC_DIR);
    return files.sort(); // alphabetical
}

function findExistingImpIds(content: string): number[] {
    const ids: number[] = [];
    const regex = /\/\/ PromptPress\/IMP-(\d{4})/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        ids.push(parseInt(match[1], 10));
    }
    return ids;
}

function getIndent(content: string, pos: number): string {
    const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
    const line = content.substring(lineStart, content.indexOf('\n', lineStart) || content.length);
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
}

function findPublicMethods(content: string): Array<{ start: number; method: string; indent: string }> {
    const methods: Array<{ start: number; method: string; indent: string }> = [];

    const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);

    function visit(node: ts.Node) {
        if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            // exported function
            const start = node.getStart(sourceFile);
            const indent = getIndent(content, start);
            const method = node.getText(sourceFile).trim();
            methods.push({ start, method, indent });
        } else if (ts.isClassDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            // exported class
            ts.forEachChild(node, visitClassMember);
        }
        ts.forEachChild(node, visit);
    }

    function visitClassMember(node: ts.Node) {
        if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name) &&
            !node.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword) &&
            node.name.text !== 'constructor' && !node.name.text.startsWith('_')) {
            // public method
            const start = node.getStart(sourceFile);
            const indent = getIndent(content, start);
            const method = node.getText(sourceFile).trim();
            methods.push({ start, method, indent });
        }
    }

    visit(sourceFile);

    // Sort by position
    methods.sort((a, b) => a.start - b.start);

    return methods;
}

function isDecorated(content: string, start: number): boolean {
    // Check previous lines for IMP comment, skipping comment lines
    const lines = content.substring(0, start).split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line === '') continue;
        if (line.startsWith('// PromptPress/IMP-')) return true;
        // Continue past comment lines: //, /**, *, */
        if (!line.startsWith('//') && !line.startsWith('/**') && !line.startsWith('*') && !line.startsWith('*/')) break;
    }
    return false;
}

async function injectImpComments(): Promise<void> {
    const files = await getTsFiles();
    
    // Find max existing ID
    let maxId = 999; // Start from 1000
    for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const ids = findExistingImpIds(content);
        if (ids.length > 0) {
            maxId = Math.max(maxId, Math.max(...ids));
        }
    }
    let currentId = maxId + 1;

    for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        
        const methods = findPublicMethods(content);

        let newContent = content;
        let offset = 0;

        for (const { start, indent } of methods) {
            const adjustedStart = start + offset;
            if (!isDecorated(newContent, adjustedStart)) {
                // Find the start of the line
                const lineStart = newContent.lastIndexOf('\n', adjustedStart - 1) + 1;

                const comment = `${indent}// ${MODULE_NAME}/IMP-${currentId.toString().padStart(4, '0')}\n`;
                newContent = newContent.substring(0, lineStart) + comment + newContent.substring(lineStart);
                offset += comment.length;
                currentId++;
            }
        }

        if (newContent !== content) {
            await fs.writeFile(file, newContent, 'utf-8');
            console.log(`Updated ${file}`);
        }
    }

    console.log(`Injected IMP comments up to IMP-${(currentId - 1).toString().padStart(4, '0')}`);
}

injectImpComments().catch(console.error);


