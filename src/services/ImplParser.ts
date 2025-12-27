import * as fs from 'fs/promises';
import * as path from 'path';
import type * as vscode from 'vscode';
import { MarkdownParser } from '../parsers/markdownParser.js';
import { XAIClient } from '../ai/xaiClient.js';
import { FileStructureParser } from './FileStructureParser.js';
import { ImplParserCore } from './ImplParserCore.js';
import { Logger } from './FileStructureParserCore.js';

export { FileInfo } from './ImplParserCore.js';

export class ImplParser {
    private core: ImplParserCore;

    constructor(private parser: MarkdownParser, private xaiClient: XAIClient, private outputChannel: vscode.OutputChannel, private fileStructureParser: FileStructureParser) {
        const logger: Logger = {
            log: (message: string) => this.outputChannel.appendLine(message)
        };
        this.core = new ImplParserCore(parser, xaiClient, logger, fileStructureParser);
    }

    // promptpress/IMP-1050
    async parseAndGenerate(implPath: string): Promise<void> {
        return this.core.parseAndGenerate(implPath);
    }
}