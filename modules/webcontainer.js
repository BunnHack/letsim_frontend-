import { WebContainer } from '@webcontainer/api';
import { getAllFiles, getFileContent, hasFile } from './store.js';

let webcontainerInstance = null;
let devProcess = null;

export function initializeWebcontainer() {
  const runBtn = document.getElementById('run-btn');
  if (!runBtn) return;

  runBtn.addEventListener('click', async () => {
    try {
      runBtn.setAttribute('aria-busy', 'true');
      await bootWebContainer();
      await syncProjectFiles();
      await installDepsIfNeeded();
      await startDevServer();
    } catch (err) {
      console.error('WebContainer error:', err);
      alert('WebContainer error: ' + (err?.message ?? err));
    } finally {
      runBtn.removeAttribute('aria-busy');
    }
  });
}

async function bootWebContainer() {
  if (webcontainerInstance) return webcontainerInstance;
  webcontainerInstance = await WebContainer.boot();

  webcontainerInstance.on('server-ready', (port, url) => {
    const frame = document.getElementById('preview-frame');
    if (frame) {
      frame.removeAttribute('srcdoc');
      frame.setAttribute('src', url);
    }
    const urlText = document.querySelector('.url-text');
    if (urlText) urlText.textContent = url.replace(/^https?:\/\//, '');
  });

  return webcontainerInstance;
}

async function syncProjectFiles() {
  const files = getAllFiles();

  // Scaffold a minimal project if empty or missing index.html
  if (!files.length || !hasFile('index.html')) {
    await webcontainerInstance.fs.mkdir('/', { recursive: true }).catch(() => {});
    await webcontainerInstance.fs.writeFile('/index.html', `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>WebContainers App</title>
    <link rel="stylesheet" href="/style.css">
  </head>
  <body>
    <h1>Hello from WebContainers</h1>
    <p>Edit your files in the left editor and press Run.</p>
    <script type="module" src="/main.js"></script>
  </body>
</html>`);
    await webcontainerInstance.fs.writeFile('/main.js', `document.body.insertAdjacentHTML('beforeend', '<p>JS loaded at ' + new Date().toLocaleTimeString() + '</p>');`);
    await webcontainerInstance.fs.writeFile('/style.css', `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px}`);
  }

  // Write all in-memory files
  for (const path of files) {
    const content = getFileContent(path);
    const full = '/' + path.replace(/^\/+/, '');
    const dir = full.split('/').slice(0, -1).join('/') || '/';
    await webcontainerInstance.fs.mkdir(dir, { recursive: true }).catch(() => {});
    await webcontainerInstance.fs.writeFile(full, content);
  }

  // Ensure package.json for Vite dev server
  const defaultPkg = {
    name: 'lovable-webc',
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite --port 5173 --host',
      build: 'vite build',
      preview: 'vite preview --host'
    },
    devDependencies: {
      vite: '^5.4.0'
    }
  };

  let needPkg = true;
  try {
    await webcontainerInstance.fs.readFile('/package.json', 'utf-8');
    needPkg = false;
  } catch {
    needPkg = true;
  }
  if (needPkg) {
    await webcontainerInstance.fs.writeFile('/package.json', JSON.stringify(defaultPkg, null, 2));
  }
}

async function installDepsIfNeeded() {
  // Simple check for node_modules
  let hasNodeModules = false;
  try {
    const entries = await webcontainerInstance.fs.readdir('/');
    hasNodeModules = entries.includes('node_modules');
  } catch {}

  if (!hasNodeModules) {
    const install = await webcontainerInstance.spawn('npm', ['install']);
    await drainOutput(install);
    const code = await install.exit;
    if (code !== 0) throw new Error('npm install failed');
  }
}

async function startDevServer() {
  if (devProcess) {
    try { devProcess.kill(); } catch {}
    devProcess = null;
  }
  devProcess = await webcontainerInstance.spawn('npm', ['run', 'dev']);
  // Drain output to keep process flowing
  drainOutput(devProcess);
}

async function drainOutput(proc) {
  if (!proc?.output || typeof proc.output.getReader !== 'function') return;

  const reader = proc.output.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value == null) continue;

      let text = '';
      if (
        value instanceof Uint8Array ||
        value instanceof ArrayBuffer ||
        (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(value))
      ) {
        text = decoder.decode(value);
      } else {
        text = String(value);
      }

      console.log(text);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (_) {
      // ignore
    }
  }
}

