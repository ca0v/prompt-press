import type * as vscode from 'vscode';

/**
 * OutputLogger - IMP-1079, IMP-1080
 * Logger that always writes to console and optionally to VS Code output channel.
 */
export class OutputLogger {
    private outputChannel: vscode.OutputChannel | null = null;

    /**
     * IMP-1079: log
     * Logs a message to console and optionally to the configured output channel.
     * @param message The message to log.
     */
    public log(message: string): void {
        // Always log to console
        console.log(message);
        
        // Also log to output channel if set
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
    }

    /**
     * IMP-1080: setOutputChannel
     * Sets the output channel to use for logging. If set, messages go to both console and channel.
     * @param channel The VS Code output channel or null.
     */
    public setOutputChannel(channel: vscode.OutputChannel | null): void {
        this.outputChannel = channel;
    }
}

/**
 * Global logger instance
 */
export const logger = new OutputLogger();