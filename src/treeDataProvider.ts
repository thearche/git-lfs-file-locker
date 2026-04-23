import * as vscode from 'vscode';
import { getWorkspacePath } from './utils';
import * as path from 'path';
import * as cp from 'child_process';
import { promisify } from 'util';
import { LockManager } from './lockManager';

const exec = promisify(cp.exec);

interface LfsLock {
    id: string;
    path: string;
    owner: {
        name: string;
    };
    locked_at: string;
}

export class LfsLockTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly lock: LfsLock
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        const lockedDate = new Date(lock.locked_at);
        const dateString = lockedDate.toLocaleDateString();
        const timeString = lockedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.tooltip = `${lock.path}\nID: ${lock.id}\nLocked by: ${lock.owner.name}\nLocked at: ${lockedDate.toLocaleString()}`;
        this.description = `by ${lock.owner.name} on ${dateString} at ${timeString}`;
        this.iconPath = new vscode.ThemeIcon('lock');
        this.contextValue = 'lfsLock';
        this.command = {
            command: 'git-lfs-file-locker.revealFileFromView',
            title: 'Reveal File',
            arguments: [this]
        };
    }
}

export class LfsLocksTreeDataProvider implements vscode.TreeDataProvider<LfsLockTreeItem | GroupTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<LfsLockTreeItem | GroupTreeItem | undefined | null | void> = new vscode.EventEmitter<LfsLockTreeItem | GroupTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<LfsLockTreeItem | GroupTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private lockManager: LockManager) {
        this.lockManager.onDidChangeLocks(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LfsLockTreeItem | GroupTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: LfsLockTreeItem | GroupTreeItem): Promise<Array<LfsLockTreeItem | GroupTreeItem>> {
        if (element instanceof GroupTreeItem) {
            return element.locks.map(lock => new LfsLockTreeItem(path.basename(lock.path), lock));
        }

        const workspacePath = getWorkspacePath();
        if (!workspacePath) {
            // Return a tree item with a message if not in a workspace.
            const item = new vscode.TreeItem("Please open a folder or workspace to see LFS locks.");
            item.iconPath = new vscode.ThemeIcon('info');
            return [item as LfsLockTreeItem];
        }

        try {
            const { stdout } = await exec('git lfs locks --json', { cwd: workspacePath });

            if (!stdout || stdout.trim() === '') {
                const item = new vscode.TreeItem("No active Git LFS locks found.");
                item.iconPath = new vscode.ThemeIcon('check');
                return [item as LfsLockTreeItem];
            }

            const parsedData = JSON.parse(stdout);
            const locksList: LfsLock[] = Array.isArray(parsedData) ? parsedData : (parsedData.locks || []);

            if (locksList.length === 0) {
                const item = new vscode.TreeItem("No active Git LFS locks found.");
                item.iconPath = new vscode.ThemeIcon('check');
                return [item as LfsLockTreeItem];
            }

            const grouped = groupLocksByDate(locksList);
            return grouped.map(group => new GroupTreeItem(group.label, group.key, group.locks));

        } catch (error: any) {
            console.error("Failed to fetch LFS locks:", error);
            const item = new vscode.TreeItem("Error fetching LFS locks.");
            item.tooltip = error.message;
            item.iconPath = new vscode.ThemeIcon('error');
            return [item as LfsLockTreeItem];
        }
    }
}

type LockGroupKey = 'today' | 'thisWeek' | 'thisMonth' | 'older';



function getStartOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getStartOfWeek(date: Date): Date {
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Monday as first day of week
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(date.getDate() + diff);
    return start;
}

function getStartOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

class GroupTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly groupKey: string,
        public readonly locks: LfsLock[]
    ) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = 'lfsLockGroup';
    }
}

function groupLocksByDate(locks: LfsLock[]): Array<{ key: LockGroupKey; label: string; locks: LfsLock[] }> {
    const now = new Date();
    const startOfToday = getStartOfDay(now);
    const startOfWeek = getStartOfWeek(now);
    const startOfMonth = getStartOfMonth(now);

    const groups: Record<LockGroupKey, LfsLock[]> = {
        today: [],
        thisWeek: [],
        thisMonth: [],
        older: []
    };

    locks.forEach(lock => {
        const lockedDate = new Date(lock.locked_at);
        const lockStartOfDay = getStartOfDay(lockedDate);

        if (lockStartOfDay >= startOfToday) {
            groups.today.push(lock);
            return;
        }
        if (lockedDate >= startOfWeek) {
            groups.thisWeek.push(lock);
            return;
        }
        if (lockedDate >= startOfMonth) {
            groups.thisMonth.push(lock);
            return;
        }
        groups.older.push(lock);
    });

    const ordered: Array<{ key: LockGroupKey; label: string; locks: LfsLock[] }> = [
        { key: 'today', label: 'Today', locks: groups.today },
        { key: 'thisWeek', label: 'This Week', locks: groups.thisWeek },
        { key: 'thisMonth', label: 'This Month', locks: groups.thisMonth },
        { key: 'older', label: 'Older', locks: groups.older }
    ];

    // Only return groups that have at least one lock
    return ordered.filter(group => group.locks.length > 0);

    
}