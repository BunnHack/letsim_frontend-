import { WebContainer } from '@webcontainer/api';
import { getAllFiles, getFileContent, hasFile } from './store.js';
import { appendToConsole } from './preview.js';

let webcontainerInstance = null;
let devProcess = null;

export async function initializeWebcontainer() {
  const runBtn = document.getElementById('run-btn');
  if (runBtn) {
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

  const consoleInput = document.getElementById('console-input');
  if (consoleInput) {
    consoleInput.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();

      const value = consoleInput.value.trim();
      if (!value) return;

      appendToConsole(`$ ${value}\n`);
      consoleInput.value = '';

      try {
        await runCommand(value);
      } catch (err) {
        console.error('Command error:', err);
        appendToConsole(`[error] ${err?.message ?? String(err)}\n`);
      }
    });
  }

  // Auto-boot WebContainer and sync files on page load
  try {
    await bootWebContainer();
    await syncProjectFiles();
  } catch (err) {
    console.error('WebContainer boot error:', err);
    appendToConsole(`[webcontainer] boot failed: ${err?.message ?? String(err)}\n`);
  }
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

export async function runCommand(commandLine, options = {}) {
  const { onOutput } = options || {};

  await bootWebContainer();
  await syncProjectFiles();

  const parts = commandLine.split(' ').filter(Boolean);
  if (!parts.length) {
    return { success: true, exitCode: 0, output: '' };
  }

  const [cmd, ...args] = parts;

  let proc;
  try {
    proc = await webcontainerInstance.spawn(cmd, args);
  } catch (err) {
    const msg = `[spawn error] ${err?.message ?? String(err)}\n`;
    appendToConsole(msg);
    if (typeof onOutput === 'function') {
      try {
        onOutput(msg);
      } catch (e) {
        console.error('runCommand onOutput error:', e);
      }
    }
    return { success: false, exitCode: null, output: msg };
  }

  let output = '';
  await drainOutput(proc, (text) => {
    output += text;
    if (typeof onOutput === 'function') {
      try {
        onOutput(text);
      } catch (e) {
        console.error('runCommand onOutput error:', e);
      }
    }
  });

  const exitCode = await proc.exit;
  const exitLine = `[process exited with code ${exitCode}]\n`;
  appendToConsole(exitLine);
  if (typeof onOutput === 'function') {
    try {
      onOutput(exitLine);
    } catch (e) {
      console.error('runCommand onOutput error:', e);
    }
  }
  output += exitLine;

  return { success: exitCode === 0, exitCode, output };
}

async function drainOutput(proc, onChunk) {
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
      appendToConsole(text);
      if (typeof onChunk === 'function') {
        try {
          onChunk(text);
        } catch (e) {
          console.error('drainOutput onChunk error:', e);
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (_) {
      // ignore
    }
  }
}

