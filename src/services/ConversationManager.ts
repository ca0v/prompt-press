import type * as vscode from 'vscode';
import * as path from 'path';
import { ConversationManagerCore, Conversation } from './ConversationManagerCore.js';

export { Conversation } from './ConversationManagerCore.js';

export class ConversationManager {
    private core: ConversationManagerCore;

    constructor(private context: vscode.ExtensionContext) {
        const historyDir = path.join(
            context.globalStorageUri.fsPath,
            'conversations'
        );
        this.core = new ConversationManagerCore(historyDir);
    }

    /**
     * Get or create conversation for an artifact
     */
    // promptpress/IMP-1034
    public getConversation(artifact: string): Conversation {
        return this.core.getConversation(artifact);
    }

    /**
     * Add message to conversation
     */
    // promptpress/IMP-1035
    public addMessage(
        artifact: string,
        role: 'user' | 'assistant',
        content: string
    ): void {
        this.core.addMessage(artifact, role, content);
    }

    /**
     * Get conversation history formatted for AI
     */
    // promptpress/IMP-1036
    public getHistory(artifact: string, lastN?: number): Array<{ role: string; content: string }> {
        return this.core.getHistory(artifact, lastN);
    }

    /**
     * Clear conversation history
     */
    // promptpress/IMP-1037
    public clearConversation(artifact: string): void {
        this.core.clearConversation(artifact);
    }

    /**
     * List all artifacts with conversations
     */
    // promptpress/IMP-1038
    public listArtifacts(): string[] {
        return this.core.listArtifacts();
    }

    /**
     * Get conversation count
     */
    // promptpress/IMP-1039
    public getMessageCount(artifact: string): number {
        return this.core.getMessageCount(artifact);
    }
}
