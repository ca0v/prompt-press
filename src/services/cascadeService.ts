/**
 * VS Code-facing wrapper around CascadeCore.
 */

import * as vscode from 'vscode';
import { XAIClient } from '../ai/xaiClient';
import { CascadeCore, CascadeUI, Logger } from './cascadeCore';

export class CascadeServiceCommands {
    private core: CascadeCore;
    private logger: Logger;

    constructor(
        xaiClient: XAIClient,
        private outputChannel: vscode.OutputChannel,
        workspaceRoot: string
    ) {
        this.logger = {
            log: (msg: string) => {
                this.outputChannel.appendLine(msg);
                console.log(msg);
            }
        };
        this.core = new CascadeCore(xaiClient, workspaceRoot, this.logger);
    }

    /**
     * Main entry point for applying changes
     * Detects changes in the current file and cascades through dependent phases
     */
    async applyChanges(filePath: string) {
        const ui: CascadeUI = {
            confirm: async (message: string) => {
                const choice = await vscode.window.showWarningMessage(
                    message,
                    { modal: true },
                    'Proceed',
                    'Cancel'
                );
                return choice === 'Proceed';
            },
            notifyInfo: (msg: string) => vscode.window.showInformationMessage(msg),
            notifyError: (msg: string) => vscode.window.showErrorMessage(msg)
        };

        return await this.core.applyChanges(filePath, ui);
    }

}

