// src/utils.ts
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Gibt den letzten Teil eines Pfades zurück, der der Dateiname oder der letzte Ordnername ist.
 * Dies ist analog zu `path.basename()` in Node.js.
 *
 * @param filePath Der Pfad, dessen Basisname ermittelt werden soll.
 * @returns Der Basisname des Pfades.
 */
export function getBasename(filePath: string): string {
    return path.basename(filePath);
}

/**
 * Berechnet den relativen Pfad eines Dateipfads zum Workspace-Pfad.
 * Stellt sicher, dass die resultierenden Pfadtrennzeichen "/" (Forward Slashes) sind,
 * was besonders nützlich für Git-Operationen ist.
 *
 * @param workspacePath Der absolute Pfad zum Root-Verzeichnis deines Workspaces.
 * @param filePath Der absolute Pfad zu der Datei, deren relativer Pfad berechnet werden soll.
 * @returns Ein String, der den relativen Pfad von `workspacePath` zu `filePath` darstellt,
 * immer mit Forward Slashes.
 */
export function getRelativePath(workspacePath: string, filePath: string): string {
    // 1. Berechnung des relativen Pfades mit Node.js' path.relative().
    //    Diese Funktion gibt den Pfad von 'from' nach 'to' zurück und verwendet
    //    die betriebssystemspezifischen Trennzeichen (z.B. '\' unter Windows).
    const relativePath = path.relative(workspacePath, filePath);

    // 2. Ersetzen aller Backslashes '\' durch Forward Slashes '/'.
    //    Dies ist wichtig, da Git (und viele andere Tools, die UNIX-Pfade erwarten)
    //    Forward Slashes als Pfadtrennzeichen bevorzugen, selbst unter Windows.
    const gitFriendlyPath = relativePath.replace(/\\/g, '/');

    return gitFriendlyPath;
}

/**
 * Retrieves the file system path of the current workspace.
 * @param uri - Optional URI to determine the workspace folder.
 * @returns The workspace path as a string, or undefined if not found.
 */
export function getWorkspacePath(uri?: vscode.Uri): string | undefined {
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

/**
 * Generates a random nonce string.
 * @returns A 32-character random string.
 */
export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Gets the URI for a command, either from the provided URI or the active text editor.
 * @param uri - The URI passed to the command.
 * @returns The determined URI, or undefined if none can be found.
 */
export function getUriForCommand(uri: vscode.Uri | undefined): vscode.Uri | undefined {
    if (uri && uri.fsPath) {
        return uri;
    }
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        return activeEditor.document.uri;
    }
    return undefined;
}

/**
 * Kombiniert einen Workspace-Pfad mit einem relativen Pfad.
 * Beachtet dabei, ob der relative Pfad bereits Teile des Workspace-Pfades enthält,
 * um doppelte Pfadsegmente zu vermeiden. Findet den längstmöglichen gemeinsamen Suffix/Präfix.
 *
 * @param workspacePath Der Basis-Workspace-Pfad (z.B. "//a/b/c").
 * @param relativePath Der relative Pfad zur Datei (z.B. "b/c/d/x.txt").
 * @returns Der vollständige, kombinierte Pfad.
 */
export function combinePaths(workspacePath: string, relativePath: string): string {
    // Normalisiere beide Pfade für konsistente Handhabung
    const normalizedWorkspacePath = path.normalize(workspacePath);
    const normalizedRelativePath = path.normalize(relativePath);

    console.log(`Normalisierter Workspace-Pfad: ${normalizedWorkspacePath}`);
    console.log(`Normalisierter relativer Pfad: ${normalizedRelativePath}`);

    // Zerlege beide Pfade in ihre einzelnen Segmente (Ordner-/Dateinamen)
    // .filter(s => s !== '') entfernt leere Strings, die bei Pfaden wie "/a/b" durch split entstehen könnten
    const workspaceSegments = normalizedWorkspacePath.split(path.sep).filter(s => s !== '');
    const relativeSegments = normalizedRelativePath.split(path.sep).filter(s => s !== '');

    console.log(`Workspace Segmente: [${workspaceSegments.join(', ')}]`);
    console.log(`Relative Segmente: [${relativeSegments.join(', ')}]`);

    let finalRelativeParts: string[] = [];
    let relStartIndex = 0;

    // Iteriere durch die Segmente des relativen Pfades, um den überlappenden Teil zu finden.
    // Wir suchen nach dem längsten Präfix des relativen Pfades, der ein Suffix des Workspace-Pfades ist.
    for (let i = 0; i < relativeSegments.length; i++) {
        // Konstruiere einen potenziellen gemeinsamen Suffix vom relativen Pfad
        const currentRelativePrefix = relativeSegments.slice(0, i + 1).join(path.sep);

        // Überprüfe, ob der normalisierte Workspace-Pfad mit diesem potenziellen Präfix des relativen Pfades endet.
        // Berücksichtige dabei, dass das Trennzeichen vor dem Präfix stehen könnte,
        // oder dass der gesamte Workspace-Pfad dem Präfix entspricht.
        if (normalizedWorkspacePath.endsWith(path.sep + currentRelativePrefix) || normalizedWorkspacePath === currentRelativePrefix) {
            relStartIndex = i + 1; // Aktualisiere den Index, ab dem wir den relativen Pfad übernehmen müssen
        }
    }

    // Die Segmente des relativen Pfades, die nicht überlappen
    finalRelativeParts = relativeSegments.slice(relStartIndex);

    console.log(`Final Relative Parts nach Überlapp-Check: [${finalRelativeParts.join(', ')}]`);

    // Füge den normalisierten Workspace-Pfad mit den nicht-überlappenden relativen Teilen zusammen
    const fullPath = path.join(normalizedWorkspacePath, ...finalRelativeParts);

    return fullPath;
}