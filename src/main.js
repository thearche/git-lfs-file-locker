const vscode = acquireVsCodeApi();
const tableBody = document.querySelector('#locks-table tbody');
const refreshButton = document.getElementById('refresh-button');

window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'update') {
        updateTable(message.locks);
    } else if (message.command === 'error') {
        tableBody.innerHTML = `<tr><td colspan="5">${message.message}</td></tr>`;
    }
});

function updateTable(locks) {
    if (!locks || locks.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No active Git LFS locks found.</td></tr>';
        return;
    }
    tableBody.innerHTML = locks.map(lock => `
        <tr>
            <td>${lock.id}</td>
            <td><a class="file-link" data-path="${lock.path}">${lock.path}</a></td>
            <td>${lock.owner.name}</td>
            <td>${new Date(lock.locked_at).toLocaleString()}</td>
            <td><button class="unlock-button" data-lock-id="${lock.id}">Unlock</button></td>
        </tr>
    `).join('');
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
