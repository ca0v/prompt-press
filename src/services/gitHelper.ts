import * as child_process from 'child_process';
import * as path from 'path';

export class GitHelper {
    /**
     * Check if there are unstaged changes in the git repository
     */
    public static async checkGitStatus(workspaceRoot: string): Promise<boolean> {
        try {
            // Check for unstaged changes only (leading space means staged, M/A/D means unstaged, ?? means untracked)
            const status = child_process.execSync('git status --porcelain', {
                cwd: workspaceRoot,
                encoding: 'utf-8'
            });
            // Lines starting with space followed by M/A/D are unstaged changes
            // Lines starting with ?? are untracked files
            const unstaged = status
                .split('\n')
                .filter((line: string) => line.match(/^\s[MAD]/) || line.startsWith('??'));
            return unstaged.length > 0;
        } catch {
            // Git not available or not a git repo - proceed without check
            return false;
        }
    }

    /**
     * Stage all changes in the git repository
     */
    public static async stageChanges(workspaceRoot: string): Promise<void> {
        try {
            child_process.execSync('git add -A', {
                cwd: workspaceRoot,
                encoding: 'utf-8'
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to stage changes: ${errorMsg}`);
        }
    }

    /**
     * Get the last committed version of a file from git
     */
    public static async getLastCommittedContent(workspaceRoot: string, filePath: string): Promise<string | null> {
        try {
            const relativePath = path.relative(workspaceRoot, filePath);
            return child_process.execSync(`git show HEAD:"${relativePath}"`, {
                cwd: workspaceRoot,
                encoding: 'utf-8'
            });
        } catch {
            return null;
        }
    }
}