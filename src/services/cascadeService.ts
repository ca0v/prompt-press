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
            confirmGitStatus: async (hasUncommitted: boolean) => {
                if (!hasUncommitted) {
                    return 'continue';
                }
                const choice = await vscode.window.showWarningMessage(
                    'You have uncommitted changes. Commit before cascading?',
                    { modal: true },
                    'Commit & Continue',
                    'Continue Anyway',
                    'Cancel'
                );
                if (choice === 'Commit & Continue') {
                    // Open source control view
                    await vscode.commands.executeCommand('workbench.view.scm');
                    return 'commit';
                } else if (choice === 'Continue Anyway') {
                    return 'continue';
                } else {
                    return 'cancel';
                }
            },
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

