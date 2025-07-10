// filepath: src/extension.ts
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { promisify } from 'util';
import { getBasename, getRelativePath, getWorkspacePath, getNonce, getUriForCommand } from './utils';
import * as path from 'path';

const exec = promisify(cp.exec);

// Interface for parsed LFS lock data
interface LfsLock {
    id: string;
    path: string;
    owner: {
        name: string;
    };
    locked_at: string;
}

// Holds a reference to the currently open panel
let lfsLocksPanel: vscode.WebviewPanel | undefined = undefined;

async function executeLfsCommand(command: string, fileUri: vscode.Uri) {
    let effectiveFileUri = fileUri;
    const originalFilePath = fileUri.fsPath;

    // If trying to lock or unlock a .al file, try to find the layout file and act on it instead.
    if ((command === 'lock' || command === 'unlock') && originalFilePath.toLowerCase().endsWith('.al')) {
        try {
            const alFileContent = await vscode.workspace.fs.readFile(fileUri);
            const contentStr = Buffer.from(alFileContent).toString('utf8');

            // Regex to find WordLayout or LayoutFile path
            const layoutRegex = /(?:WordLayout|LayoutFile)\s*=\s*'([^']+)';/i;
            const match = contentStr.match(layoutRegex);

            if (match && match[1]) {
                const layoutPath = match[1];
                const workspaceRoot = getWorkspacePath(fileUri);
                if (!workspaceRoot) {
                    vscode.window.showErrorMessage(`Could not determine workspace root for '${getBasename(originalFilePath)}'.`);
                    return;
                }
                const docxFilePath = path.resolve(workspaceRoot, layoutPath);
                const docxFileUri = vscode.Uri.file(docxFilePath);

                try {
                    // Check if the layout file exists
                    await vscode.workspace.fs.stat(docxFileUri);
                    effectiveFileUri = docxFileUri;
                    vscode.window.showInformationMessage(`Redirected ${command} from ${getBasename(originalFilePath)} to ${getBasename(docxFilePath)}.`);
                } catch {
                    // Corresponding layout file does not exist
                    vscode.window.showWarningMessage(`Could not find layout file '${layoutPath}' (resolved to '${docxFilePath}') specified in '${getBasename(originalFilePath)}'. No file was ${command}ed.`);
                    return;
                }
            } else {
                vscode.window.showWarningMessage(`No WordLayout or LayoutFile property found in '${getBasename(originalFilePath)}'. No file was ${command}ed.`);
                return;
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error reading file '${getBasename(originalFilePath)}': ${error.message}`);
            return;
        }
    }

    const filePath = effectiveFileUri.fsPath;
    const workspacePath = getWorkspacePath(effectiveFileUri);

    if (!workspacePath) {
        vscode.window.showErrorMessage('File is not part of a workspace. Cannot determine Git LFS context.');
        return;
    }

    // Check if Git LFS is installed (basic check)
    try {
        cp.execSync('git lfs version', { cwd: workspacePath, encoding: 'utf8' });
    } catch (error) {
        vscode.window.showErrorMessage('Git LFS does not seem to be installed or configured for this repository. Please run "git lfs install" in the repository root.');
        return;
    }

    const relativeFilePath = getRelativePath(workspacePath, filePath);
    var terminal = vscode.window.activeTerminal;
    if (!terminal) {
        terminal = vscode.window.createTerminal({ name: "Git LFS", cwd: workspacePath });
    }
    terminal.sendText(`git lfs ${command} "${relativeFilePath}"`);
    terminal.show();
    vscode.window.showInformationMessage(`Attempting to ${command} "${getBasename(filePath)}" with Git LFS... Check the 'Git LFS' terminal for output.`);
}

class LfsLockTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly lock: LfsLock
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `${lock.path}\nID: ${lock.id}\nLocked by: ${lock.owner.name}\nLocked at: ${new Date(lock.locked_at).toLocaleString()}`;
        this.description = `by ${lock.owner.name} at ${new Date(lock.locked_at).toLocaleTimeString()}`;
        this.iconPath = new vscode.ThemeIcon('lock');
        this.contextValue = 'lfsLock';
        this.command = {
            command: 'git-lfs-file-locker.revealFileFromView',
            title: 'Reveal File',
            arguments: [this]
        };
    }
}

class LfsLocksTreeDataProvider implements vscode.TreeDataProvider<LfsLockTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<LfsLockTreeItem | undefined | null | void> = new vscode.EventEmitter<LfsLockTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<LfsLockTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LfsLockTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: LfsLockTreeItem): Promise<LfsLockTreeItem[]> {
        if (element) {
            return []; // No children for locks
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

            return locksList.map(lock => new LfsLockTreeItem(path.basename(lock.path), lock));

        } catch (error: any) {
            console.error("Failed to fetch LFS locks:", error);
            const item = new vscode.TreeItem("Error fetching LFS locks.");
            item.tooltip = error.message;
            item.iconPath = new vscode.ThemeIcon('error');
            return [item as LfsLockTreeItem];
        }
    }
}

async function fetchLocksAndUpdateWebview(webview: vscode.Webview) {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        webview.postMessage({ command: 'error', message: 'Please open a folder or workspace.' });
        return;
    }

    try {
        const { stdout } = await exec('git lfs locks --json', { cwd: workspacePath });
        if (!stdout || stdout.trim() === '') {
            webview.postMessage({ command: 'update', locks: [] });
            return;
        }

        const parsedData = JSON.parse(stdout);
        const locksList: LfsLock[] = Array.isArray(parsedData) ? parsedData : parsedData.locks || [];
        webview.postMessage({ command: 'update', locks: locksList });

    } catch (error: any) {
        console.error("Failed to fetch LFS locks:", error);
        webview.postMessage({ command: 'error', message: `Failed to fetch LFS locks: ${error.message}` });
    }
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'style.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'src', 'main.js'));

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Active Git LFS Locks</title>
            <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
            <div class="actions-header">
                <h1>Active Git LFS Locks</h1>
                <button id="refresh-button">Refresh</button>
            </div>
            <table id="locks-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>File Path</th>
                        <th>Locked By</th>
                        <th>Locked At</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Content is dynamically inserted -->
                </tbody>
            </table>

            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>
    `;
}

export function activate(context: vscode.ExtensionContext) {
    const lfsLocksTreeDataProvider = new LfsLocksTreeDataProvider();
    vscode.window.registerTreeDataProvider('gitLfsLocksView', lfsLocksTreeDataProvider);

    let lockFileDisposable = vscode.commands.registerCommand('git-lfs-file-locker.lockFile', async (uri: vscode.Uri) => {
        const fileUri = getUriForCommand(uri);
        if (!fileUri) {
            vscode.window.showErrorMessage('No file selected or active to lock.');
            return;
        }
        await executeLfsCommand('lock', fileUri);
    });

    let unlockFileDisposable = vscode.commands.registerCommand('git-lfs-file-locker.unlockFile', async (uri: vscode.Uri) => {
        const fileUri = getUriForCommand(uri);
        if (!fileUri) {
            vscode.window.showErrorMessage('No file selected or active to unlock.');
            return;
        }
        await executeLfsCommand('unlock', fileUri);
    });

    let showLocksDisposable = vscode.commands.registerCommand('git-lfs-file-locker.showLocks', () => {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (lfsLocksPanel) {
            lfsLocksPanel.reveal(column);
            fetchLocksAndUpdateWebview(lfsLocksPanel.webview);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'gitLfsLocks',
            'Git LFS Locks',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [context.extensionUri]
            }
        );
        lfsLocksPanel = panel;

        panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
        fetchLocksAndUpdateWebview(panel.webview);

        panel.onDidDispose(() => {
            lfsLocksPanel = undefined;
        }, null, context.subscriptions);

        panel.webview.onDidReceiveMessage(async message => {
            const workspacePath = getWorkspacePath();
            if (!workspacePath) { return; }

            switch (message.command) {
                case 'unlockFile':
                    try {
                        await exec(`git lfs unlock --id=${message.lockId}`, { cwd: workspacePath });
                        vscode.window.showInformationMessage(`Successfully unlocked file (ID: ${message.lockId}).`);
                        if (lfsLocksPanel) {
                            fetchLocksAndUpdateWebview(lfsLocksPanel.webview);
                        }
                        lfsLocksTreeDataProvider.refresh();
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Failed to unlock file: ${error.message}`);
                    }
                    return;

                case 'revealFile':
                    try {
                        const { stdout: gitRepoPath } = await exec('git rev-parse --show-toplevel', { cwd: workspacePath });
                        const repoRoot = gitRepoPath.trim();
                        const absoluteFilePath = path.join(repoRoot, message.path);
                        const fileUri = vscode.Uri.file(absoluteFilePath);
                        vscode.commands.executeCommand('revealInExplorer', fileUri);
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Could not reveal file: ${error.message}`);
                    }
                    return;
                case 'refresh':
                    if (lfsLocksPanel) {
                        fetchLocksAndUpdateWebview(lfsLocksPanel.webview);
                    }
                    return;
            }
        });
    });

    let refreshLocksDisposable = vscode.commands.registerCommand('git-lfs-file-locker.refreshLocks', () => {
        lfsLocksTreeDataProvider.refresh();
        if (lfsLocksPanel) {
            fetchLocksAndUpdateWebview(lfsLocksPanel.webview);
        }
    });

    let unlockFileFromViewDisposable = vscode.commands.registerCommand('git-lfs-file-locker.unlockFileFromView', async (item: LfsLockTreeItem) => {
        const workspacePath = getWorkspacePath();
        if (!workspacePath || !item.lock) { return; }
        try {
            await exec(`git lfs unlock --id=${item.lock.id}`, { cwd: workspacePath });
            vscode.window.showInformationMessage(`Successfully unlocked file: ${item.lock.path}`);
            lfsLocksTreeDataProvider.refresh();
            if (lfsLocksPanel) {
                fetchLocksAndUpdateWebview(lfsLocksPanel.webview);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to unlock file: ${error.message}`);
        }
    });

    let revealFileFromViewDisposable = vscode.commands.registerCommand('git-lfs-file-locker.revealFileFromView', async (item: LfsLockTreeItem) => {
        const workspacePath = getWorkspacePath();
        if (!workspacePath || !item.lock) { return; }
        try {
            const { stdout: gitRepoPath } = await exec('git rev-parse --show-toplevel', { cwd: workspacePath });
            const repoRoot = gitRepoPath.trim();
            const absoluteFilePath = path.join(repoRoot, item.lock.path);
            const fileUri = vscode.Uri.file(absoluteFilePath);
            await vscode.commands.executeCommand('revealInExplorer', fileUri);
            await vscode.commands.executeCommand('vscode.open', fileUri);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Could not reveal file: ${error.message}`);
        }
    });

    context.subscriptions.push(
        lockFileDisposable,
        unlockFileDisposable,
        showLocksDisposable,
        refreshLocksDisposable,
        unlockFileFromViewDisposable,
        revealFileFromViewDisposable
    );
}

export function deactivate() {
    if (lfsLocksPanel) {
        lfsLocksPanel.dispose();
    }
}