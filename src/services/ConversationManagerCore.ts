import * as path from 'path';
import * as fs from 'fs/promises';

export interface Conversation {
    artifact: string;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }>;
    currentFile?: string;
}

export class ConversationManagerCore {
    private conversations: Map<string, Conversation> = new Map();
    private historyDir: string;

    constructor(historyDir: string) {
        this.historyDir = historyDir;
        this.ensureHistoryDir();
        this.loadConversations();
    }

    private async ensureHistoryDir() {
        try {
            await fs.mkdir(this.historyDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create history directory:', error);
        }
    }

    /**
     * Get or create conversation for an artifact
     */
    // PromptPress/IMP-1034
    public getConversation(artifact: string): Conversation {
        if (!this.conversations.has(artifact)) {
            const conversation: Conversation = {
                artifact,
                messages: []
            };
            this.conversations.set(artifact, conversation);
        }
        return this.conversations.get(artifact)!;
    }

    /**
     * Add message to conversation
     */
    // PromptPress/IMP-1035
    public addMessage(
        artifact: string,
        role: 'user' | 'assistant',
        content: string
    ): void {
        const conversation = this.getConversation(artifact);
        conversation.messages.push({
            role,
            content,
            timestamp: new Date()
        });
        this.saveConversation(artifact);
    }

    /**
     * Get conversation history formatted for AI
     */
    // PromptPress/IMP-1036
    public getHistory(artifact: string, lastN?: number): Array<{ role: string; content: string }> {
        const conversation = this.getConversation(artifact);
        const messages = lastN
            ? conversation.messages.slice(-lastN)
            : conversation.messages;

        return messages.map(m => ({
            role: m.role,
            content: m.content
        }));
    }

    /**
     * Clear conversation history
     */
    // PromptPress/IMP-1037
    public clearConversation(artifact: string): void {
        this.conversations.delete(artifact);
        const filePath = path.join(this.historyDir, `${artifact}.json`);
        fs.unlink(filePath).catch(() => {});
    }

    /**
     * Save conversation to disk
     */
    private async saveConversation(artifact: string): Promise<void> {
        const conversation = this.conversations.get(artifact);
        if (!conversation) {
            return;
        }

        const filePath = path.join(this.historyDir, `${artifact}.json`);
        try {
            await fs.writeFile(
                filePath,
                JSON.stringify(conversation, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error(`Failed to save conversation ${artifact}:`, error);
        }
    }

    /**
     * Load all conversations from disk
     */
    private async loadConversations(): Promise<void> {
        try {
            const files = await fs.readdir(this.historyDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.historyDir, file);
                    try {
                        const content = await fs.readFile(filePath, 'utf-8');
                        const conversation = JSON.parse(content) as Conversation;
                        // Convert timestamp strings back to Date objects
                        conversation.messages = conversation.messages.map(m => ({
                            ...m,
                            timestamp: new Date(m.timestamp)
                        }));
                        this.conversations.set(conversation.artifact, conversation);
                    } catch (error) {
                        console.error(`Failed to load conversation from ${file}:`, error);
                    }
                }
            }
        } catch (error) {
            // Directory doesn't exist yet, that's fine
        }
    }

    /**
     * List all artifacts with conversations
     */
    // PromptPress/IMP-1038
    public listArtifacts(): string[] {
        return Array.from(this.conversations.keys());
    }

    /**
     * Get conversation count
     */
    // PromptPress/IMP-1039
    public getMessageCount(artifact: string): number {
        const conversation = this.conversations.get(artifact);
        return conversation ? conversation.messages.length : 0;
    }
}