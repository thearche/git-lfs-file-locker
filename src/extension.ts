// filepath: src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

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

    context.subscriptions.push(lockFileDisposable, unlockFileDisposable);
}

export function deactivate() {}