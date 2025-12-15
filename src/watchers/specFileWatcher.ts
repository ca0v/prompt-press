import * as vscode from 'vscode';
import * as path from 'path';
import { ChatPanelProvider } from '../ui/chatPanelProvider';
import { ConversationManager } from '../services/conversationManager';

export class SpecFileWatcher implements vscode.Disposable {
    private watcher: vscode.FileSystemWatcher | undefined;
    private enabled: boolean;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private chatPanel: ChatPanelProvider,
        private conversationManager: ConversationManager,
        enabled: boolean = true
    ) {
        this.enabled = enabled;
        if (enabled) {
            this.startWatching();
        }
    }

    private startWatching() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        // Watch for changes in specs directory
        const pattern = new vscode.RelativePattern(
            workspaceFolders[0],
            'specs/**/*.{req.md,design.md,impl.md}'
        );

        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

        // File created
        this.watcher.onDidCreate((uri) => {
            this.handleFileChange(uri, 'created');
        }, null, this.disposables);

        // File changed
        this.watcher.onDidChange((uri) => {
            this.handleFileChange(uri, 'modified');
        }, null, this.disposables);

        // File deleted
        this.watcher.onDidDelete((uri) => {
            this.handleFileChange(uri, 'deleted');
        }, null, this.disposables);

        console.log('PromptPress: File watcher started');
    }

    private async handleFileChange(uri: vscode.Uri, changeType: 'created' | 'modified' | 'deleted') {
        if (!this.enabled) {
            return;
        }

        const filePath = uri.fsPath;
        const fileName = path.basename(filePath);
        
        console.log(`PromptPress: File ${changeType}: ${fileName}`);

        // Determine spec type
        const specType = this.getSpecType(fileName);
        if (!specType) {
            return;
        }

        // Show notification
        const action = await vscode.window.showInformationMessage(
            `PromptPress: ${fileName} was ${changeType}. Discuss with AI?`,
            'Yes',
            'No',
            'Don\'t ask again'
        );

        if (action === 'Yes') {
            this.chatPanel.show();
            this.chatPanel.notifyFileChange(uri, changeType, specType);
        } else if (action === 'Don\'t ask again') {
            this.enabled = false;
            vscode.window.showInformationMessage(
                'PromptPress: Auto-monitoring disabled. Use "PromptPress: Toggle File Monitoring" to re-enable.'
            );
        }
    }

    private getSpecType(fileName: string): 'requirement' | 'design' | 'implementation' | null {
        if (fileName.endsWith('.req.md')) {
            return 'requirement';
        } else if (fileName.endsWith('.design.md')) {
            return 'design';
        } else if (fileName.endsWith('.impl.md')) {
            return 'implementation';
        }
        return null;
    }

    public toggleMonitoring() {
        this.enabled = !this.enabled;
        const status = this.enabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`PromptPress: File monitoring ${status}`);
        
        if (this.enabled && !this.watcher) {
            this.startWatching();
        }
    }

    public dispose() {
        this.watcher?.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
