let previewFrameElement;
let consoleOutputElement;
let consolePanelElement;
let consoleToggleButton;

/**
 * Initialize the preview pane with a simple default page.
 */
export function initializePreview() {
    previewFrameElement = document.getElementById('preview-frame');
    consoleOutputElement = document.getElementById('console-output');
    consolePanelElement = document.getElementById('console-panel');
    consoleToggleButton = document.getElementById('console-toggle-btn');

    if (previewFrameElement) {
        setPreviewContent(defaultHtmlContent);
    }

    if (consoleToggleButton && consolePanelElement) {
        consoleToggleButton.addEventListener('click', () => {
            consolePanelElement.classList.toggle('open');
            consoleToggleButton.classList.toggle('active');

            if (consolePanelElement.classList.contains('open')) {
                const input = document.getElementById('console-input');
                if (input) {
                    input.focus();
                }
            }
        });
    }
}

/**
 * Replace the contents of the preview iframe with the given HTML.
 */
export function setPreviewContent(html) {
    if (!previewFrameElement) {
        previewFrameElement = document.getElementById('preview-frame');
    }
    if (previewFrameElement) {
        previewFrameElement.srcdoc = html;
    }
}

function normalizeConsoleText(input) {
    if (!input) return '';
    let value = String(input);

    // Strip ANSI escape sequences like "\x1B[1G", "\x1B[0K", etc.
    value = value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');

    // Handle carriage returns by keeping only the last segment on the line
    if (value.includes('\r')) {
        const segments = value.split('\r');
        value = segments[segments.length - 1];
    }

    return value;
}

export function appendToConsole(text) {
    const value = normalizeConsoleText(text);
    if (!value) return;

    if (!consoleOutputElement) {
        consoleOutputElement = document.getElementById('console-output');
    }
    const target = consoleOutputElement;
    if (!target) return;

    target.textContent += value;
    if (!value.endsWith('\n')) {
        target.textContent += '\n';
    }

    const container = target.parentElement || target;
    container.scrollTop = container.scrollHeight;
}

const defaultHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #fff; color: #333; }
            .logo { width: 80px; height: 80px; color: #6366f1; margin-bottom: 24px; animation: spin 20s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            h1 { margin: 0 0 16px; font-size: 24px; font-weight: 600; }
            button { background: #1a1a1a; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: transform 0.1s; }
            button:active { transform: scale(0.96); }
            p { margin-top: 16px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <svg class="logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" fill-opacity="0.5"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h1>Hello Lovable</h1>
        <button id="counter">count is 0</button>
        <p>Edit <code>src/App.tsx</code> to test HMR</p>
        <script>
            let count = 0;
            const btn = document.getElementById('counter');
            btn.addEventListener('click', () => {
                count++;
                btn.textContent = 'count is ' + count;
            });
        </script>
    </body>
    </html>
`;

