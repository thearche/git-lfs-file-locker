# git-lfs-file-locker

A Visual Studio Code extension to manage Git LFS file locks directly from the editor.

## Features

- **Lock/Unlock Files:**
  - Adds context menu items to lock or unlock files tracked by Git LFS.
- **Active Locks Overview:**
  - Command `Git LFS: Show Active Locks` opens a webview listing all current LFS locks in the repository.
  - Table view includes: Lock ID, File Path (clickable to reveal in Explorer), Locked By, Locked At, and Unlock action.
- **Unlock Directly from Webview:**
  - Unlock files with one click from the lock overview.
- **Reveal File in Explorer:**
  - Click on a file path in the webview to reveal it in the VS Code Explorer.
- **Auto-Refresh:**
  - The webview automatically refreshes when it becomes visible and provides a manual refresh button.

## Usage

1. **Lock/Unlock a File:**
   - Right-click a file in the Explorer and select `Git LFS: Lock File` or `Git LFS: Unlock File`.
2. **Show Active Locks:**
   - Open the Command Palette (`Ctrl+Shift+P`), search for `Git LFS: Show Active Locks`.
   - Use the webview to inspect, unlock, or reveal locked files.

## Requirements
- [Git LFS](https://git-lfs.github.com/) must be installed and initialized in your repository.

## Known Issues
- The extension assumes the workspace contains a Git repository with LFS enabled.
- File reveal may not work if the file is outside the current workspace.

## Release Notes
See [CHANGELOG.md](./CHANGELOG.md) for details.
