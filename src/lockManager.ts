import * as vscode from 'vscode';
import * as path from 'path';
import { combinePaths } from './utils';
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

    public async refresh(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const rootPath = workspaceFolders[0].uri.fsPath;

        try {
            const { stdout } = await execAsync('git lfs locks --json', { cwd: rootPath });
            const parsed = JSON.parse(stdout);
            const locks: LfsLock[] = Array.isArray(parsed) ? parsed : parsed.locks || [];

            this.lockedFilePaths.clear();
            this.locksDetails.clear();

            locks.forEach(lock => {
                const absolutePath = combinePaths(rootPath, lock.path);
                this.lockedFilePaths.add(absolutePath);
                this.locksDetails.set(absolutePath, lock);
            });

            this._onDidChangeLocks.fire();

        } catch (error) {
            console.error('Fehler beim Laden der LFS Locks:', error);
        }
    }

    public isLocked(filePath: string): boolean {
        return this.lockedFilePaths.has(path.normalize(filePath));
    }

    public getLockDetails(filePath: string): LfsLock | undefined {
        return this.locksDetails.get(path.normalize(filePath));
    }

    public getAllLocks(): LfsLock[] {
        return Array.from(this.locksDetails.values());
    }
}