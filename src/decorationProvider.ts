import * as vscode from 'vscode';
import { LockManager } from './lockManager';

export class GitLfsDecorationProvider implements vscode.FileDecorationProvider {
    
    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    constructor(private lockManager: LockManager) {
        this.lockManager.onDidChangeLocks(() => {
            this._onDidChangeFileDecorations.fire(undefined);
        });
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if (this.lockManager.isLocked(uri.fsPath)) {
            const details = this.lockManager.getLockDetails(uri.fsPath);
            const owner = details?.owner?.name || 'Unbekannt';

            return {
                badge: '🔒', 
                tooltip: `Gesperrt durch Git LFS (${owner})`,
                color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'), 
                propagate: false 
            };
        }
        return undefined;
    }
}