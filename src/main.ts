import cp from 'child_process';
import path from 'path';
import { promisify } from 'util';
import vscode from 'vscode';
import { GitLfsDecorationProvider } from './decorationProvider';
import { LockManager } from './lockManager';
import { LfsLocksTreeDataProvider, LfsLockTreeItem } from './treeDataProvider';
import { getBasename, getRelativePath, getUriForCommand, getWorkspacePath } from './utils';
import { fetchLocksAndUpdateWebview, showLocks } from './webView';

const exec = promisify(cp.exec); // Holds a reference to the currently open panel
let lfsLocksPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    const lockManager = new LockManager();
    const decorationProvider = new GitLfsDecorationProvider(lockManager);
    context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorationProvider));
    const treeDataProvider = new LfsLocksTreeDataProvider(lockManager);
    vscode.window.registerTreeDataProvider('gitLfsLocksView', treeDataProvider);

    context.subscriptions.push(vscode.commands.registerCommand('git-lfs-file-locker.lockFile', async (uri: vscode.Uri) => {
        const fileUri = getUriForCommand(uri);
        if (!fileUri) {
            vscode.window.showErrorMessage('No file selected or active to lock.');
            return;
        }
        await executeLfsCommand('lock', fileUri);
        await lockManager.refresh();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('git-lfs-file-locker.unlockFile', async (uri: vscode.Uri) => {
        const fileUri = getUriForCommand(uri);
        if (!fileUri) {
            vscode.window.showErrorMessage('No file selected or active to unlock.');
            return;
        }
        await executeLfsCommand('unlock', fileUri);
        await lockManager.refresh();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('git-lfs-file-locker.showLocks', (context) => {
        showLocks(context, lfsLocksPanel, exec);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('git-lfs-file-locker.refreshLocks', () => {
        treeDataProvider.refresh();
        if (lfsLocksPanel) {
            fetchLocksAndUpdateWebview(lfsLocksPanel.webview, exec);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('git-lfs-file-locker.unlockFileFromView', async (item: LfsLockTreeItem) => {
        const workspacePath = getWorkspacePath();
        if (!workspacePath || !item.lock) { return; }
        try {
            await exec(`git lfs unlock --id=${item.lock.id}`, { cwd: workspacePath });
            vscode.window.showInformationMessage(`Successfully unlocked file: ${item.lock.path}`);
            treeDataProvider.refresh();
            if (lfsLocksPanel) {
                fetchLocksAndUpdateWebview(lfsLocksPanel.webview);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to unlock file: ${error.message}`);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('git-lfs-file-locker.revealFileFromView', async (item: LfsLockTreeItem) => {
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
    }));

    context.subscriptions.push(vscode.window.onDidChangeWindowState(state => {
        if (state.focused) {
            lockManager.refresh();
        }
    }));
}

export function deactivate() {
    if (lfsLocksPanel) {
        lfsLocksPanel.dispose();
    }
}

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
                // Ensure the layout path is resolved relative to the workspace root
                const normalizedLayoutPath = layoutPath.startsWith('./') ? layoutPath.substring(2) : layoutPath;
                const docxFilePath = path.resolve(workspaceRoot, normalizedLayoutPath);
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
        await exec('git lfs version', { cwd: workspacePath, encoding: 'utf8' });
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