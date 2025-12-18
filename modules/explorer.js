import { openFile, setActiveFileElement } from './editor.js';
import { getAllFiles } from './store.js';

export function renderFileTree() {
    const fileTree = document.querySelector('.file-tree');
    if (!fileTree) return;

    fileTree.innerHTML = '';

    const files = getAllFiles();

    if (!files.length) {
        const empty = document.createElement('div');
        empty.className = 'explorer-empty';
        empty.textContent = 'No files yet. Ask the AI to generate some.';
        fileTree.appendChild(empty);
        return;
    }

    files.forEach((path) => {
        const item = document.createElement('div');
        item.className = 'tree-item file';
        item.dataset.file = path;
        item.innerHTML = `
            <span class="file-icon ${getFileIconClass(path)}">●</span>
            <span class="file-name">${path}</span>
        `;
        fileTree.appendChild(item);
    });
}

function getFileIconClass(path) {
    if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'tsx';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.json')) return 'json';
    return 'txt';
}

export function initializeExplorer() {
    const fileTree = document.querySelector('.file-tree');
    
    if (!fileTree) return;

    renderFileTree();

    // Use Event Delegation for efficient handling of dynamic content
    fileTree.addEventListener('click', (e) => {
        // Handle Folder Toggle
        const folderLabel = e.target.closest('.tree-item.folder > .tree-label');
        if (folderLabel) {
            e.stopPropagation();
            const folder = folderLabel.parentElement;
            const children = folder.querySelector('.tree-children');
            const chevron = folderLabel.querySelector('.chevron');
            
            if (children) {
                if (children.style.display === 'none') {
                    children.style.display = 'block';
                    chevron.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>'; // Down
                } else {
                    children.style.display = 'none';
                    chevron.innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>'; // Right
                }
            }
            return;
        }

        // Handle File Selection
        const fileItem = e.target.closest('.tree-item.file');
        if (fileItem) {
            // Prevent triggering if we clicked a folder that happens to be inside (not possible with current structure but good safety)
            const fileName = fileItem.getAttribute('data-file');
            
            if (fileName) {
                // UI Selection
                setActiveFileElement(fileItem);

                // Open File in Editor
                openFile(fileName);
            }
        }
    });
}

