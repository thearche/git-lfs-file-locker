// filepath: src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { promisify } from 'util';

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
    const fileName = path.basename(filePath);
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

    const relativeFilePath = path.relative(workspacePath, filePath).replace(/\\/g, '/'); // Use forward slashes for git

    const terminal = vscode.window.createTerminal({ name: "Git LFS", cwd: workspacePath });
    terminal.sendText(`git lfs ${command} "${relativeFilePath}"`);
    terminal.show();

    vscode.window.showInformationMessage(`Attempting to ${action} "${fileName}" with Git LFS... Check the 'Git LFS' terminal for output.`);
}

async function showLocksView() {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        vscode.window.showErrorMessage('Please open a folder or workspace to show LFS locks.');
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Fetching Git LFS locks...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 50 });

            // Führe 'git lfs locks --json' aus, um die Daten strukturiert zu erhalten
            const { stdout, stderr } = await exec('git lfs locks --json', { cwd: workspacePath });

            if (stderr) {
                vscode.window.showErrorMessage(`Error fetching LFS locks: ${stderr}`);
                return;
            }

            // WICHTIG: Prüfen, ob die Ausgabe leer ist, bevor geparst wird.
            if (!stdout || stdout.trim() === '') {
                vscode.window.showInformationMessage('No active Git LFS locks found in this repository.');
                return;
            }

            let locksList: LfsLock[];
            try {
                // Versuche, die Ausgabe zu parsen
                const parsedData = JSON.parse(stdout);

                // --- DIAGNOSE-CODE ---
                // Wir loggen das geparste Objekt, um seine Struktur zu sehen.
                // Öffnen Sie die Entwicklerkonsole (Hilfe > Entwicklertools umschalten), um dies zu sehen.
                console.log('Parsed LFS Lock Data:', parsedData); 
                // ---------------------

                // Prüfen, ob das Ergebnis ein Objekt mit einer 'locks'-Eigenschaft ist
                if (parsedData && Array.isArray(parsedData.locks)) {
                    locksList = parsedData.locks;
                } 
                // Prüfen, ob das Ergebnis direkt ein Array ist
                else if (Array.isArray(parsedData)) {
                    locksList = parsedData;
                } 
                // Wenn keines von beiden zutrifft, ist die Struktur unerwartet
                else {
                    vscode.window.showErrorMessage('Unexpected LFS lock data structure received.');
                    console.error('Unexpected LFS lock data structure:', parsedData);
                    return;
                }

            } catch (e) {
                // Wenn das Parsen fehlschlägt, zeige die Rohdaten zur Fehlersuche an.
                console.error("Failed to parse Git LFS JSON output:", stdout);
                vscode.window.showErrorMessage(`Failed to parse LFS lock data. Raw output: ${stdout}`);
                return;
            }

            // Diese Logik ist korrekt, wenn locksList ein gültiges Objekt ist.
            if (locksList.length === 0) {
                vscode.window.showInformationMessage('No active Git LFS locks found in this repository.');
                return;
            }

            // Erstelle und zeige ein neues Webview Panel
            const panel = vscode.window.createWebviewPanel(
                'gitLfsLocks', // Interner Typ des Panels
                'Active Git LFS Locks', // Titel des Panels
                vscode.ViewColumn.One, // Zeige es in einer neuen Spalte
                {} // Webview Optionen
            );

            // Übergeben Sie die korrekte Liste an die Webview-Funktion
            panel.webview.html = getWebviewContent(locksList);
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to execute 'git lfs locks': ${error.message}`);
    }
}

function getWebviewContent(locks: LfsLock[]): string {
    // Erstelle die Tabellenzeilen aus den Lock-Daten
    const rows = locks.map(lock => `
        <tr>
            <td>${lock.id}</td>
            <td>${lock.path}</td>
            <td>${lock.owner.name}</td>
            <td>${new Date(lock.locked_at).toLocaleString()}</td>
        </tr>
    `).join('');

    // Gib das vollständige HTML zurück, inklusive einfacher Stile für die Lesbarkeit
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-T">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Active Git LFS Locks</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    text-align: left;
                    padding: 8px;
                    border-bottom: 1px solid var(--vscode-editor-widget-border);
                }
                th {
                    background-color: var(--vscode-side-bar-background);
                }
                tr:nth-child(even) {
                    background-color: var(--vscode-editor-widget-background);
                }
            </style>
        </head>
        <body>
            <h1>Active Git LFS Locks</h1>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>File Path</th>
                        <th>Locked By</th>
                        <th>Locked At</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
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

export function deactivate() {}