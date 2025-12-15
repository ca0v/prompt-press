import * as vscode from 'vscode';
import { SpecFileWatcher } from './watchers/specFileWatcher';
import { XAIClient } from './ai/xaiClient';
import { ChatPanelProvider } from './ui/chatPanelProvider';
import { ConversationManager } from './services/conversationManager';
import { ContextBuilder } from './services/contextBuilder';
import { ScaffoldService } from './services/scaffoldService';

export function activate(context: vscode.ExtensionContext) {
    console.log('PromptPress extension is now active');

    // Get configuration
    const config = vscode.workspace.getConfiguration('promptpress');
    const apiKey = config.get<string>('apiKey') || process.env.PROMPT_PRESS_XAI_API_KEY || '';
    
    if (!apiKey) {
        vscode.window.showWarningMessage(
            'PromptPress: No API key configured. Set PROMPT_PRESS_XAI_API_KEY or configure in settings.'
        );
    }

    // Initialize services
    const aiClient = new XAIClient(apiKey, config);
    const conversationManager = new ConversationManager(context);
    const contextBuilder = new ContextBuilder();
    const scaffoldService = new ScaffoldService(aiClient);
    
    // Initialize UI
    const chatPanelProvider = new ChatPanelProvider(
        context.extensionUri,
        aiClient,
        conversationManager,
        contextBuilder
    );

    // Initialize file watcher
    const specWatcher = new SpecFileWatcher(
        chatPanelProvider,
        conversationManager,
        config.get<boolean>('autoMonitor', true)
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.openChat', () => {
            chatPanelProvider.show();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.generateCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const filePath = editor.document.uri.fsPath;
            if (!filePath.endsWith('.impl.md')) {
                vscode.window.showErrorMessage('Please open an implementation spec (.impl.md) file');
                return;
            }

            vscode.window.showInformationMessage(
                'Code generation not yet implemented - coming soon!'
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.validateSpec', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            vscode.window.showInformationMessage(
                'Spec validation not yet implemented - coming soon!'
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.toggleMonitoring', () => {
            specWatcher.toggleMonitoring();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.scaffoldArtifact', async () => {
            await scaffoldService.scaffoldArtifact();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptpress.scaffoldProject', async () => {
            await scaffoldService.scaffoldProject();
        })
    );

    // Register disposables
    context.subscriptions.push(specWatcher);
    context.subscriptions.push(chatPanelProvider);

    // Show status
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = '$(comment-discussion) PromptPress';
    statusBarItem.command = 'promptpress.openChat';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

export function deactivate() {
    console.log('PromptPress extension is now deactivated');
}
