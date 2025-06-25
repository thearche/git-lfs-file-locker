// filepath: src/extension.ts
import * as vscode from 'vscode';
import * as cp from 'child_process';
import { promisify } from 'util';
import { combinePaths, getBasename, getRelativePath } from './utils';

const exec = promisify(cp.exec);

// Interface für die geparsten LFS Lock Daten
interface LfsLock {
    id: string;
    path: string;
    owner: {
        name: string;
    };
    locked_at: string;
}

// Hält eine Referenz auf das aktuell geöffnete Panel
let lfsLocksPanel: vscode.WebviewPanel | undefined = undefined;

function getWorkspacePath(uri?: vscode.Uri): string | undefined {
    if (uri) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
            return workspaceFolder.uri.fsPath;
        }
    }
    // Fallback if no URI or not in a workspace folder (less ideal)
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    return undefined;
}

async function executeLfsCommand(command: string, fileUri: vscode.Uri, action: string) {
    const filePath = fileUri.fsPath;
    const workspacePath = getWorkspacePath(fileUri);

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
    vscode.window.showInformationMessage(`Attempting to ${action} "${getBasename(filePath)}" with Git LFS... Check the 'Git LFS' terminal for output.`);
}

// NEU: Sperren abrufen und die Daten an das Webview senden
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

// ÜBERARBEITET: showLocksView verwaltet jetzt den Lebenszyklus des Webview-Panels.
async function showLocksView() {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    if (lfsLocksPanel) {
        lfsLocksPanel.reveal(column);
        await fetchLocksAndUpdateWebview(lfsLocksPanel.webview);
        return;
    }

    lfsLocksPanel = vscode.window.createWebviewPanel(
        'gitLfsLocks',
        'Active Git LFS Locks',
        column || vscode.ViewColumn.One,
        {
            enableScripts: true, // Wichtig, um JavaScript im Webview zu erlauben
            retainContextWhenHidden: true // Sorgt dafür, dass der Webview-Inhalt im Hintergrund erhalten bleibt
        }
    );

    lfsLocksPanel.webview.html = getWebviewContent(lfsLocksPanel.webview);
    await fetchLocksAndUpdateWebview(lfsLocksPanel.webview);

    // NEU: Aktualisiert die Ansicht, wenn sie wieder sichtbar wird
    lfsLocksPanel.onDidChangeViewState(
        async e => {
            if (e.webviewPanel.visible) {
                await fetchLocksAndUpdateWebview(lfsLocksPanel!.webview);
            }
        }
    );

    // NEU: Listener für Nachrichten aus dem Webview (z.B. Klick auf "Unlock")
    lfsLocksPanel.webview.onDidReceiveMessage(
        async message => {
            const workspacePath = getWorkspacePath();
            if (!workspacePath) { return; }

            switch (message.command) {
                case 'unlockFile':
                    try {
                        // Führe den Unlock-Befehl im Hintergrund aus
                        await exec(`git lfs unlock --id=${message.lockId}`, { cwd: workspacePath });
                        vscode.window.showInformationMessage(`Successfully unlocked file (ID: ${message.lockId}).`);
                        // Lade die Liste neu, um die Änderung anzuzeigen
                        await fetchLocksAndUpdateWebview(lfsLocksPanel!.webview);
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Failed to unlock file: ${error.message}`);
                    }
                    return;

                case 'refresh':
                    await fetchLocksAndUpdateWebview(lfsLocksPanel!.webview);
                    return;

                // NEU: Verwende den relativen Pfad, um die Datei im Explorer anzuzeigen
                case 'revealFile':
                    await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(combinePaths(workspacePath, message.path)));
                    return;
            }
        },
        undefined
    );

    // NEU: Setzt die Referenz zurück, wenn das Panel geschlossen wird
    lfsLocksPanel.onDidDispose(
        () => {
            lfsLocksPanel = undefined;
        },
        null
    );
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// ÜBERARBEITET: getWebviewContent enthält jetzt JavaScript für die Interaktion.
function getWebviewContent(webview: vscode.Webview): string {
    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();
    // Die Tabelle wird jetzt dynamisch per JavaScript gefüllt.
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy" content="default-src 'unsafe-inline'"; script-src 'nonce-${nonce}'>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Active Git LFS Locks</title>
            <style>
                body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background-color: var(--vscode-editor-background); }
                table { width: 100%; border-collapse: collapse; }
                th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--vscode-editor-widget-border); }
                th { background-color: var(--vscode-side-bar-background); }
                button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 5px 10px; cursor: pointer; border-radius: 2px; }
                button:hover { background-color: var(--vscode-button-hoverBackground); }
                .actions-header { display: flex; justify-content: space-between; align-items: center; }
                a { color: var(--vscode-textLink-foreground); cursor: pointer; }
                a:hover { text-decoration: underline; }
            </style>
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
                    <!-- Inhalt wird dynamisch eingefügt -->
                </tbody>
            </table>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                const tableBody = document.querySelector('#locks-table tbody');
                const refreshButton = document.getElementById('refresh-button');

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'update') {
                        updateTable(message.locks);
                    } else if (message.command === 'error') {
                        tableBody.innerHTML = \`<tr><td colspan="5">\${message.message}</td></tr>\`;
                    }
                });

                function updateTable(locks) {
                    if (!locks || locks.length === 0) {
                        tableBody.innerHTML = '<tr><td colspan="5">No active Git LFS locks found.</td></tr>';
                        return;
                    }
                    tableBody.innerHTML = locks.map(lock => \`
                        <tr>
                            <td>\${lock.id}</td>
                            <td><a class="file-link" data-path="\${lock.path}">\${lock.path}</a></td>
                            <td>\${lock.owner.name}</td>
                            <td>\${new Date(lock.locked_at).toLocaleString()}</td>
                            <td><button class="unlock-button" data-lock-id="\${lock.id}">Unlock</button></td>
                        </tr>
                    \`).join('');
                }

                document.addEventListener('click', event => {
                    if (event.target.classList.contains('unlock-button')) {
                        const lockId = event.target.dataset.lockId;
                        vscode.postMessage({ command: 'unlockFile', lockId: lockId });
                    } else if (event.target.classList.contains('file-link')) {
                        const filePath = event.target.dataset.path;
                        vscode.postMessage({ command: 'revealFile', path: filePath });
                    }
                });

                refreshButton.addEventListener('click', () => {
                    vscode.postMessage({ command: 'refresh' });
                });
            </script>
        </body>
        </html>
    `;
}

export function activate(context: vscode.ExtensionContext) {
    let lockFileDisposable = vscode.commands.registerCommand('git-lfs-file-locker.lockFile', async (uri: vscode.Uri) => {
        if (!uri || !uri.fsPath) {
            // If called from command palette, try active editor
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                uri = activeEditor.document.uri;
            } else {
                vscode.window.showErrorMessage('No file selected or active to lock.');
                return;
            }
        }
        await executeLfsCommand('lock', uri, 'lock');
    });

    let unlockFileDisposable = vscode.commands.registerCommand('git-lfs-file-locker.unlockFile', async (uri: vscode.Uri) => {
        if (!uri || !uri.fsPath) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                uri = activeEditor.document.uri;
            } else {
                vscode.window.showErrorMessage('No file selected or active to unlock.');
                return;
            }
        }
        await executeLfsCommand('unlock', uri, 'unlock');
    });

    let showLocksDisposable = vscode.commands.registerCommand('git-lfs-file-locker.showLocks', showLocksView);

    context.subscriptions.push(lockFileDisposable, unlockFileDisposable, showLocksDisposable);
}

// ÜBERARBEITET: deactivate sorgt dafür, dass das Panel geschlossen wird, wenn die Erweiterung deaktiviert wird.
export function deactivate() {
    if (lfsLocksPanel) {
        lfsLocksPanel.dispose();
    }
}