import { fileContents } from './store.js';
import { escapeHtml } from './utils.js';

let activeFile = null;

export function setActiveFileElement(element) {
    if (activeFile) activeFile.classList.remove('active');
    activeFile = element;
    if (activeFile) activeFile.classList.add('active');
}

export function openFile(fileName) {
    const editorTabs = document.getElementById('editor-tabs');
    const codeEditor = document.getElementById('code-editor');

    // Update Tabs
    const existingTab = Array.from(document.querySelectorAll('.editor-tab')).find(tab => tab.textContent.includes(fileName));
    
    document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
    
    if (existingTab) {
        existingTab.classList.add('active');
    } else {
        const newTab = document.createElement('div');
        newTab.className = 'editor-tab active';
        newTab.innerHTML = `
            <span class="file-name">${fileName}</span>
            <span class="close-icon">×</span>
        `;
        newTab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('close-icon')) {
                document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
                newTab.classList.add('active');
                renderCode(fileName);
                
                // Also highlight tree item
                const treeItem = document.querySelector(`.tree-item.file[data-file="${fileName}"]`);
                if (treeItem) {
                    setActiveFileElement(treeItem);
                }
            }
        });
        
        // Close tab logic
        newTab.querySelector('.close-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            newTab.remove();
            if (editorTabs.children.length === 0) {
                codeEditor.innerHTML = `
                    <div class="empty-state">
                        <div class="logo-faded">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#27272a" stroke-width="1">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                                <path d="M2 17L12 22L22 17"/>
                                <path d="M2 12L12 17L22 12"/>
                            </svg>
                        </div>
                        <p>Select a file to view code</p>
                    </div>
                `;
                // Clear active selection in tree
                setActiveFileElement(null);
            } else {
                // Switch to last tab
                const lastTab = editorTabs.lastElementChild;
                lastTab.click();
            }
        });
        
        editorTabs.appendChild(newTab);
    }

    renderCode(fileName);
}

function renderCode(fileName) {
    const codeEditor = document.getElementById('code-editor');
    const content = fileContents[fileName] || '// No content available';
    const extension = fileName.split('.').pop();
    
    // Simple syntax highlighting simulation
    let highlighted = escapeHtml(content);
    
    // Very basic approximations for keywords
    if (extension === 'tsx' || extension === 'ts' || extension === 'js') {
        highlighted = highlighted
            .replace(/(import|from|function|const|return|export|default)/g, '<span class="code-keyword">$1</span>')
            .replace(/'([^']*)'/g, '<span class="code-string">\'$1\'</span>')
            .replace(/"([^"]*)"/g, '<span class="code-string">"$1"</span>');
    } else if (extension === 'css') {
        highlighted = highlighted
            .replace(/([a-z-]+):/g, '<span class="code-attr">$1</span>:')
            .replace(/{/g, ' {').replace(/}/g, '}');
    } else if (extension === 'html') {
            highlighted = highlighted
            .replace(/&lt;([a-z0-9]+)/g, '&lt;<span class="code-tag">$1</span>')
            .replace(/&lt;\/([a-z0-9]+)/g, '&lt;/<span class="code-tag">$1</span>');
    }

    codeEditor.innerHTML = highlighted;
}

