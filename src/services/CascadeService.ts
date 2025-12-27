/**
 * VS Code-facing wrapper around CascadeCore.
 */

import * as vscode from 'vscode';
import { XAIClient } from '../ai/xaiClient.js';
import { CascadeCore, CascadeUI, Logger } from './CascadeCore.js';

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
    // promptpress/IMP-1028
    async refactorSpec(filePath: string) {
        const ui: CascadeUI = {
            confirmGitStatus: async (hasUnstaged: boolean) => {
                if (!hasUnstaged) {
                    return 'continue';
                }
                const choice = await vscode.window.showWarningMessage(
                    'You have unstaged changes. Would you like to stage them before proceeding?',
                    { modal: true },
                    'Stage & Continue',
                    'Continue Without Staging',
                    'Cancel'
                );
                if (choice === 'Stage & Continue') {
                    return 'stage';
                } else if (choice === 'Continue Without Staging') {
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

        return await this.core.refactorSpec(filePath, ui);
    }

    // promptpress/IMP-1029
    async tersifySpec(filePath: string) {
        const ui: CascadeUI = {
            confirmGitStatus: async (hasUnstaged: boolean) => {
                if (!hasUnstaged) {
                    return 'continue';
                }
                const choice = await vscode.window.showWarningMessage(
                    'You have unstaged changes. Would you like to stage them before proceeding?',
                    { modal: true },
                    'Stage & Continue',
                    'Continue Without Staging',
                    'Cancel'
                );
                if (choice === 'Stage & Continue') {
                    return 'stage';
                } else if (choice === 'Continue Without Staging') {
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

        return await this.core.tersifySpec(filePath, ui);
    }

}

