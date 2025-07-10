# git-lfs-file-locker

A Visual Studio Code extension to manage Git LFS file locks directly from the editor.

## Features

- **Lock/Unlock Files:**
  - Adds context menu items to lock or unlock files tracked by Git LFS.
- **Intelligent AL File Locking:**
  - When locking/unlocking a `.al` file, the extension automatically finds the corresponding layout file (e.g., `.docx`) and applies the lock to it.
- **Native Tree View for Active Locks:**
  - A native tree view in the Activity Bar lists all current LFS locks for a clean and integrated experience.
  - Provides context menu actions to unlock or reveal files directly from the view.
- **Detailed Lock Overview in Editor:**
  - A command in the tree view's title bar opens a detailed table view of all locks in a separate editor tab.
  - From the table, you can unlock files or reveal them in the Explorer.
- **Auto-Refresh:**
  - The lock views automatically refresh and provide a manual refresh button.

## Usage

1. **Lock/Unlock a File:**
   - Right-click a file in the Explorer and select `Git LFS: Lock File` or `Git LFS: Unlock File`.
2. **View Active Locks:**
   - Open the "Git LFS" view in the Activity Bar.
   - Use the context menu on a locked file to unlock or reveal it.
   - Click the "Show Active Locks in Editor" icon in the view's title bar for a more detailed table.

## Requirements
- [Git LFS](https://git-lfs.github.com/) must be installed and initialized in your repository.

## Known Issues
- The extension assumes the workspace contains a Git repository with LFS enabled.
- File reveal may not work if the file is outside the current workspace.

## Release Notes
See [CHANGELOG.md](./CHANGELOG.md) for details.
