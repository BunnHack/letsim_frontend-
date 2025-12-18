import { setFileContent, getAllFiles, getFileContent, hasFile } from './store.js';
import { renderFileTree } from './explorer.js';
import { setPreviewContent } from './preview.js';
import { openFile } from './editor.js';

/**
 * Parse AI output for specially formatted file blocks:
 *
 * ```file:path/to/file.ext
 * // file contents...
 * ```
 */
function parseFileBlocksFromText(text) {
    const lines = text.split('\n');
    const blocks = [];
    let current = null;

    for (const line of lines) {
        const headerMatch = line.match(/^```file:(.+)$/i);
        if (headerMatch) {
            if (current) {
                blocks.push({
                    path: current.path,
                    content: current.contentLines.join('\n'),
                });
            }
            current = {
                path: headerMatch[1].trim(),
                contentLines: [],
            };
            continue;
        }

        if (current && line.trim() === '```') {
            blocks.push({
                path: current.path,
                content: current.contentLines.join('\n'),
            });
            current = null;
            continue;
        }

        if (current) {
            current.contentLines.push(line);
        }
    }

    if (current) {
        blocks.push({
            path: current.path,
            content: current.contentLines.join('\n'),
        });
    }

    return blocks;
}

function extractHtmlFromMarkdown(text) {
    const codeBlockMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (!codeBlockMatch) return null;

    const code = codeBlockMatch[1].trim();
    if (code.toLowerCase().includes('<!doctype') || code.toLowerCase().includes('<html')) {
        return code;
    }
    return null;
}

function resolveProjectPath(ref) {
    if (!ref) return '';
    const withoutQuery = ref.split(/[?#]/)[0];
    return withoutQuery.replace(/^\.\//, '');
}

/**
 * Build a preview HTML document from the current in-memory project,
 * using index.html as the entry when present and inlining any local
 * CSS/JS files it references.
 */
function buildPreviewHtmlFromFiles() {
    const files = getAllFiles();
    if (!files.length) return null;

    const entryPath =
        files.includes('index.html')
            ? 'index.html'
            : files.find((f) => f.toLowerCase().endsWith('.html'));

    if (!entryPath) return null;

    const rawHtml = getFileContent(entryPath);
    if (!rawHtml) return null;

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');

        // Inline stylesheets that point to in-memory project files
        doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
            const hrefAttr = link.getAttribute('href');
            const href = resolveProjectPath(hrefAttr);
            if (!href || !hasFile(href)) return;

            const css = getFileContent(href);
            const styleEl = doc.createElement('style');
            styleEl.textContent = css;
            link.replaceWith(styleEl);
        });

        // Inline scripts that point to in-memory project files
        doc.querySelectorAll('script[src]').forEach((scriptEl) => {
            const srcAttr = scriptEl.getAttribute('src');
            const src = resolveProjectPath(srcAttr);
            if (!src || !hasFile(src)) return;

            const js = getFileContent(src);
            const inlineScript = doc.createElement('script');
            const type = scriptEl.getAttribute('type');
            if (type) inlineScript.setAttribute('type', type);
            inlineScript.textContent = js;
            scriptEl.replaceWith(inlineScript);
        });

        const docEl = doc.documentElement;
        if (!docEl) return rawHtml;

        return '<!DOCTYPE html>\n' + docEl.outerHTML;
    } catch (err) {
        console.warn('Failed to build multi-file preview, using raw HTML', err);
        return rawHtml;
    }
}

/**
 * Take the full AI message text, extract any file blocks, and
 * apply them into the in-memory project + UI.
 */
export function handleAiGeneratedCodeFromText(text) {
    let blocks = parseFileBlocksFromText(text);

    // Fallback: if there are no explicit file blocks, but there is an HTML
    // code block, treat the first HTML snippet as "index.html".
    if (!blocks.length) {
        const html = extractHtmlFromMarkdown(text);
        if (html) {
            blocks = [{ path: 'index.html', content: html }];
        }
    }

    if (!blocks.length) return;

    // Update in-memory files
    blocks.forEach(({ path, content }) => {
        if (!path) return;
        setFileContent(path, content);
    });

    // Refresh explorer tree
    renderFileTree();

    // Open the first generated/updated file
    const firstBlock = blocks[0];
    if (firstBlock?.path) {
        openFile(firstBlock.path);
    }

    // Build a combined preview from all project files (HTML + linked CSS/JS)
    const previewHtml = buildPreviewHtmlFromFiles();
    if (previewHtml) {
        setPreviewContent(previewHtml);
    }
}

