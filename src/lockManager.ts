import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface LfsLock {
    id: string;
    path: string;
    owner: { name: string };
    locked_at: string;
}

export class LockManager {
    private lockedFilePaths: Set<string> = new Set();
    private locksDetails: Map<string, LfsLock> = new Map();
    private _onDidChangeLocks = new vscode.EventEmitter<void>();
    readonly onDidChangeLocks = this._onDidChangeLocks.event;
    private refreshInterval: NodeJS.Timeout | undefined;

    constructor() {
        this.refresh();
        this.startAutoRefresh();
    }

    private startAutoRefresh(): void {
        // Refresh every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.refresh();
        }, 5 * 60 * 1000);
    }

    public dispose(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    private normalizePath(p: string): string {
        return path.normalize(p).toLowerCase();
    }

    public async refresh(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const newLockedPaths = new Set<string>();
        const newLocksDetails = new Map<string, LfsLock>();

        for (const folder of workspaceFolders) {
            const rootPath = folder.uri.fsPath;
            try {
                const { stdout } = await execAsync('git lfs locks --json', { cwd: rootPath });
                if (!stdout) continue;

                const parsed = JSON.parse(stdout);
                const locks: LfsLock[] = Array.isArray(parsed) ? parsed : (parsed.locks || []);

                locks.forEach(lock => {
                    const absolutePath = path.join(rootPath, lock.path);
                    const normalized = this.normalizePath(absolutePath);
                    
                    newLockedPaths.add(normalized);
                    newLocksDetails.set(normalized, lock);
                });
            } catch (error) {
                console.warn(`LFS Locks konnten für ${rootPath} nicht geladen werden:`, error);
            }
        }

        this.lockedFilePaths = newLockedPaths;
        this.locksDetails = newLocksDetails;
        this._onDidChangeLocks.fire();
    }

    public isLocked(filePath: string): boolean {
        return this.lockedFilePaths.has(this.normalizePath(filePath));
    }

    public getLockDetails(filePath: string): LfsLock | undefined {
        return this.locksDetails.get(this.normalizePath(filePath));
    }

    public getAllLocks(): LfsLock[] {
        return Array.from(this.locksDetails.values());
    }
}