import vscode from 'vscode';
import cp from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { getWorkspacePath, getNonce, combinePaths } from './utils';
import { LfsLock } from './lockManager';

export async function fetchLocksAndUpdateWebview(webview: vscode.Webview, exec = promisify(cp.exec)) {
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

export function showLocks(context: vscode.ExtensionContext, lfsLocksPanel: vscode.WebviewPanel | undefined = undefined, exec = promisify(cp.exec), lockManager?: any, executeLfsCommand?: any) {
    const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

    if (lfsLocksPanel) {
        lfsLocksPanel.reveal(column);
        fetchLocksAndUpdateWebview(lfsLocksPanel.webview, exec);
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

    panel.iconPath = {
        light: vscode.Uri.joinPath(context.extensionUri, 'icon.png'),
        dark: vscode.Uri.joinPath(context.extensionUri, 'icon.png')
    };
    
    lfsLocksPanel = panel;

    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
    fetchLocksAndUpdateWebview(panel.webview, exec);

    // Listen to lock manager changes and refresh webview
    if (lockManager) {
        const lockChangeListener = lockManager.onDidChangeLocks(() => {
            fetchLocksAndUpdateWebview(panel.webview, exec);
        });
        context.subscriptions.push(lockChangeListener);
    }

    panel.onDidDispose(() => {
        lfsLocksPanel = undefined;
    }, null, context.subscriptions);

    panel.webview.onDidReceiveMessage(async message => {
        const workspacePath = getWorkspacePath();
        if (!workspacePath) { return; }

        switch (message.command) {
            case 'unlockFile':
                if (executeLfsCommand) {
                    await executeLfsCommand('unlock', undefined, message.lockId, lockManager);
                }
                return;

            case 'revealFile':
                try {
                    const { stdout: gitRepoPath } = await exec('git rev-parse --show-toplevel', { cwd: workspacePath });
                    const repoRoot = gitRepoPath.trim();
                    const absoluteFilePath = combinePaths(repoRoot, message.path);
                    const fileUri = vscode.Uri.file(absoluteFilePath);
                    vscode.commands.executeCommand('revealInExplorer', fileUri);
                } catch (error: any) {
                    vscode.window.showErrorMessage(`Could not reveal file: ${error.message}`);
                }
                return;
            case 'refresh':
                if (lfsLocksPanel) {
                    fetchLocksAndUpdateWebview(lfsLocksPanel.webview, exec);
                }
                return;
        }
    });
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
