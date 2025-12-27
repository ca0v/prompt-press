import * as vscode from 'vscode';
import { logger } from '../utils/OutputLogger.js';

export interface TextSearchResult {
    uri: vscode.Uri;
    ranges: vscode.Range[];
}

export async function findTextInFiles(
    query: { pattern: string },
    options: { include?: string; exclude?: string },
    callback: (result: TextSearchResult) => void,
    token?: vscode.CancellationToken
): Promise<void> {
    logger.log(`Searching for pattern: "${query.pattern}" with include: "${options.include || '**/*'}", exclude: "${options.exclude || 'none'}"`);

    const config = vscode.workspace.getConfiguration();
    const filesExclude = config.get<Record<string, boolean>>('files.exclude', {});
    const searchExclude = config.get<Record<string, boolean>>('search.exclude', {});
    const allExclude = { ...filesExclude, ...searchExclude };
    if (options.exclude) {
        allExclude[options.exclude] = true;
    }
    const excludeGlobs = Object.keys(allExclude).filter(key => allExclude[key]);
    const globExclude = excludeGlobs.length > 0 ? `{${excludeGlobs.join(',')}}` : undefined;

    const globInclude = (options.include || '**/*').replace(/\*\*/g, '**');
    const files = await vscode.workspace.findFiles(globInclude, globExclude, undefined, token);
    logger.log(`Found ${files.length} files matching include pattern: ${globInclude}${globExclude ? ` (excluding ${globExclude})` : ''}`);

    let totalMatches = 0;
    for (const file of files) {
        if (token?.isCancellationRequested) break;
        const content = await vscode.workspace.fs.readFile(file);
        const text = content.toString();
        const lines = text.split('\n');
        const ranges: vscode.Range[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let start = 0;
            while ((start = line.indexOf(query.pattern, start)) !== -1) {
                ranges.push(new vscode.Range(i, start, i, start + query.pattern.length));
                start += query.pattern.length;
            }
        }
        if (ranges.length > 0) {
            totalMatches += ranges.length;
            logger.log(`Found ${ranges.length} matches in ${file.fsPath}`);
            callback({ uri: file, ranges });
        }
    }
    logger.log(`Total matches found: ${totalMatches}`);
}