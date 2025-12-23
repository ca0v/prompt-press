import type * as vscode from 'vscode';
import { FileStructureParserCore, Logger } from './FileStructureParserCore.js';

export class FileStructureParser {
    private core: FileStructureParserCore;

    constructor(private outputChannel: vscode.OutputChannel) {
        const logger: Logger = {
            log: (message: string) => this.outputChannel.appendLine(message)
        };
        this.core = new FileStructureParserCore(logger);
    }

    /**
     * Parse file descriptions from a File Structure section
     * Supports both original format (- `file`: desc) and tree format
     */
    // PromptPress/IMP-1044
    parseFileDescriptions(section: string): Map<string, string> {
        return this.core.parseFileDescriptions(section);
    }

    /**
     * Parse a tree format section into a dictionary of file paths and descriptions
     */
    // PromptPress/IMP-1045
    parseTreeToDict(input: string): Record<string, string> {
        return this.core.parseTreeToDict(input);
    }
}