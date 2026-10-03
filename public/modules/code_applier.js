/**
 * DeepHarness — 1-Click Code Applier
 * File: public/modules/code_applier.js
 *
 * Enhances chat codeblocks that output file code:
 * 1. Inspects codeblocks for headers like '```javascript:public/app.js' or '// filepath: ...'.
 * 2. Injects an interactive '✨ Apply to File' button into codeblock headers.
 * 3. On click:
 *    - Directly writes the code to disk via POST /api/workspace/file.
 *    - Displays a toast notification.
 *    - Seamlessly reloads the Workspace Studio code editor if the file is currently open.
 *    - Triggers file tree & git status refreshes.
 */

(function () {
  'use strict';

  // Internal module state
  const state = {
    observer: null,
    initialized: false
  };

  /**
   * Inject styling for the 1-Click Code Applier button and headers
   */
  function injectStyles() {
    if (document.getElementById('deepharness-code-applier-styles')) return;
    const style = document.createElement('style');
    style.id = 'deepharness-code-applier-styles';
    style.textContent = `
      /* Enhanced 1-Click Apply to File Button */
      .btn-apply-to-file {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(14, 165, 233, 0.12);
        border: 1px solid rgba(14, 165, 233, 0.45);
        color: #38bdf8;
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
        font-size: 11px;
        font-weight: 600;
        padding: 3px 9px;
        border-radius: 5px;
        cursor: pointer;
        user-select: none;
        transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        margin-right: 6px;
      }

      .btn-apply-to-file:hover {
        background: linear-gradient(135deg, #0284c7, #38bdf8);
        border-color: #38bdf8;
        color: #ffffff;
        box-shadow: 0 0 14px rgba(14, 165, 233, 0.5);
        transform: translateY(-1px);
      }

      .btn-apply-to-file:active {
        transform: translateY(0);
      }

      .btn-apply-to-file:disabled {
        opacity: 0.65;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .btn-apply-to-file.applied-success {
        background: rgba(16, 185, 129, 0.15) !important;
        border-color: rgba(16, 185, 129, 0.6) !important;
        color: #34d399 !important;
      }

      .btn-apply-to-file.applied-error {
        background: rgba(239, 68, 68, 0.15) !important;
        border-color: rgba(239, 68, 68, 0.6) !important;
        color: #f87171 !important;
      }

      .btn-apply-to-file .applier-spinner {
        display: inline-block;
        width: 10px;
        height: 10px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: applierSpin 0.6s linear infinite;
      }

      @keyframes applierSpin {
        to { transform: rotate(360deg); }
      }

      /* Dynamically injected code block header when bare pre exists */
      .injected-code-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 10px;
        background: rgba(15, 23, 42, 0.75);
        border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
        font-family: var(--font-mono, monospace);
        font-size: 11px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Helper to trigger DeepHarness toast
   */
  function notifyToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[DeepHarness Toast] (${type}) ${message}`);
    }
  }

  /**
   * Clean and normalize file path relative to workspace root
   */
  function sanitizeFilePath(rawPath) {
    if (!rawPath) return null;
    let clean = rawPath.trim().replace(/^["']|["']$/g, '');
    clean = clean.replace(/\\/g, '/');

    // Strip leading colons or markdown noise
    clean = clean.replace(/^:+/, '');

    // Strip file:// prefix
    clean = clean.replace(/^file:\/\//, '');

    // Strip workspace root if absolute path
    const workspaceRoot = window.state?.settings?.workspace_root || '';
    if (workspaceRoot && clean.startsWith(workspaceRoot)) {
      clean = clean.slice(workspaceRoot.length);
    }

    // Strip leading slashes
    clean = clean.replace(/^\/+/, '');

    // Strip ./ prefix
    clean = clean.replace(/^\.\//, '');

    return clean || null;
  }

  /**
   * Detect target destination file from:
   * 1. Header/tag (e.g. `javascript:public/app.js` or `js:server.js`)
   * 2. In-code comments (`// filepath: ...`, `# filepath: ...`, etc.)
   * 3. DOM attributes & preceding text
   * 4. Active open file in Studio fallback
   */
  function detectFilePath(codeText = '', langTag = '', preEl = null) {
    // 1. Inspect header / language tag: e.g. "javascript:public/app.js"
    if (langTag && langTag.includes(':')) {
      const parts = langTag.split(':');
      const candidate = parts.slice(1).join(':').trim();
      const sanitized = sanitizeFilePath(candidate);
      if (sanitized && sanitized.includes('.')) {
        return sanitized;
      }
    }

    // 2. Check pre element data attributes
    if (preEl) {
      const dataFile = preEl.getAttribute('data-filepath') || preEl.getAttribute('data-file');
      if (dataFile) {
        const sanitized = sanitizeFilePath(dataFile);
        if (sanitized) return sanitized;
      }
    }

    // 3. Inspect in-code comments (first 20 lines)
    if (codeText) {
      const lines = codeText.split('\n').slice(0, 20);
      for (const line of lines) {
        // Matches:
        // // filepath: path/to/file.ext
        // // File: path/to/file.ext
        // // path: path/to/file.ext
        // // filename: path/to/file.ext
        // # filepath: path/to/file.ext
        // /* filepath: path/to/file.ext */
        // <!-- filepath: path/to/file.ext -->
        const match = line.match(/(?:\/\/|#|\/\*|<!--|;)\s*(?:filepath|file|path|filename):\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i);
        if (match && match[1]) {
          const sanitized = sanitizeFilePath(match[1]);
          if (sanitized) return sanitized;
        }

        // Generic comment line with file path: e.g. "// public/modules/autofix.js"
        const directFileComment = line.match(/^(?:\/\/|#)\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)\s*$/);
        if (directFileComment && directFileComment[1] && directFileComment[1].includes('/')) {
          const sanitized = sanitizeFilePath(directFileComment[1]);
          if (sanitized) return sanitized;
        }
      }
    }

    // 4. Preceding sibling element inspection:
    //    e.g. <p>Here is the updated <code>public/app.js</code>:</p>
    if (preEl) {
      const wrapper = preEl.closest('.code-block-wrapper') || preEl;
      let prev = wrapper.previousElementSibling;
      let checkCount = 0;
      while (prev && checkCount < 3) {
        const prevText = prev.textContent || '';
        const prevMatch = prevText.match(/(?:file|filepath|in|to|update|updating)\s*[`"']?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)[`"']?/i);
        if (prevMatch && prevMatch[1] && prevMatch[1].includes('.')) {
          const sanitized = sanitizeFilePath(prevMatch[1]);
          if (sanitized && !sanitized.includes(' ')) return sanitized;
        }
        prev = prev.previousElementSibling;
        checkCount++;
      }
    }

    // 5. Active Studio file fallback (if extension matches)
    const activeFile = window.state?.studio?.activeFile;
    if (activeFile) {
      const activePath = typeof activeFile === 'string' ? activeFile : activeFile.path;
      if (activePath && langTag) {
        const cleanLang = langTag.toLowerCase().split(':')[0].trim();
        const ext = activePath.split('.').pop()?.toLowerCase();
        const langMatchesExt =
          (cleanLang === 'js' || cleanLang === 'javascript') && (ext === 'js' || ext === 'mjs' || ext === 'cjs') ||
          (cleanLang === 'ts' || cleanLang === 'typescript') && (ext === 'ts' || ext === 'tsx') ||
          cleanLang === 'py' && ext === 'py' ||
          cleanLang === 'html' && ext === 'html' ||
          cleanLang === 'css' && ext === 'css' ||
          cleanLang === 'json' && ext === 'json';

        if (langMatchesExt) {
          return sanitizeFilePath(activePath);
        }
      }
    }

    return null;
  }

  /**
   * Reload Studio editor and related state if the written file is currently open
   */
  function reloadEditorIfOpen(filePath, codeText) {
    if (!filePath) return;

    const activeFile = window.state?.studio?.activeFile;
    const currentOpenPath = typeof activeFile === 'string' ? activeFile : activeFile?.path;

    if (currentOpenPath === filePath) {
      // If code editor textarea is present, update value and line numbers
      if (window.el?.studioCodeEditor) {
        window.el.studioCodeEditor.value = codeText;
      }

      if (typeof window.updateLineNumbers === 'function') {
        window.updateLineNumbers(codeText);
      }

      if (typeof window.updateEditorStatusBar === 'function') {
        const ext = '.' + filePath.split('.').pop();
        window.updateEditorStatusBar(codeText, ext, false);
      }

      // Sync state.studio.activeFile object
      if (window.state?.studio?.activeFile && typeof window.state.studio.activeFile === 'object') {
        window.state.studio.activeFile.content = codeText;
        window.state.studio.activeFile.originalContent = codeText;
        window.state.studio.activeFile.isDirty = false;
      }

      // If full file loader exists, ensure synchronized reload
      if (typeof window.openWorkspaceFile === 'function') {
        window.openWorkspaceFile(filePath).catch(() => {});
      }
    }

    // Refresh file tree if available
    if (typeof window.loadFileTree === 'function') {
      window.loadFileTree(window.state?.studio?.currentPath || '');
    }

    // Refresh git status if available
    if (typeof window.loadGitStatus === 'function') {
      window.loadGitStatus();
    }
  }

  /**
   * Write code content directly to disk via POST /api/workspace/file
   */
  async function applyToFile(filePath, codeText, buttonEl) {
    if (!filePath || codeText === undefined) {
      notifyToast('No target file identified for this code block', 'error');
      return;
    }

    const shortName = filePath.split('/').pop();

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.innerHTML = `<span class="applier-spinner"></span> <span>Writing...</span>`;
    }

    try {
      const res = await fetch('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filePath,
          content: codeText
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // Success feedback
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.classList.remove('applied-error');
        buttonEl.classList.add('applied-success');
        buttonEl.innerHTML = `<span>✓ Applied to ${shortName}!</span>`;
        setTimeout(() => {
          if (buttonEl && buttonEl.classList.contains('applied-success')) {
            buttonEl.classList.remove('applied-success');
            buttonEl.innerHTML = `<span>✨ Apply to ${shortName}</span>`;
          }
        }, 4000);
      }

      notifyToast(`✨ Applied changes to ${filePath}!`, 'success');

      // Reload Workspace Studio editor if open
      reloadEditorIfOpen(filePath, codeText);

    } catch (err) {
      console.error('[CodeApplier] Write error:', err);
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.classList.remove('applied-success');
        buttonEl.classList.add('applied-error');
        buttonEl.innerHTML = `<span>❌ Error Applying</span>`;
        setTimeout(() => {
          if (buttonEl) {
            buttonEl.classList.remove('applied-error');
            buttonEl.innerHTML = `<span>✨ Apply to ${shortName}</span>`;
          }
        }, 3000);
      }
      notifyToast(`Failed to apply to ${filePath}: ${err.message}`, 'error');
    }
  }

  /**
   * Scan container and enhance code blocks with '✨ Apply to File' button
   */
  function enhance(container) {
    const root = container || window.el?.messagesContainer || document.getElementById('messagesContainer') || document.body;
    if (!root) return;

    injectStyles();

    // 1. Process standard .code-block-wrapper blocks
    const wrappers = root.querySelectorAll('.code-block-wrapper');
    wrappers.forEach(wrapper => {
      if (wrapper.dataset.codeApplierBound === 'true') return;

      const codePre = wrapper.querySelector('pre code');
      const langTagEl = wrapper.querySelector('.code-lang-tag');
      const codeText = codePre ? codePre.textContent : '';
      const rawLang = langTagEl ? langTagEl.textContent.trim() : '';

      const targetPath = detectFilePath(codeText, rawLang, wrapper.querySelector('pre'));
      if (!targetPath) return;

      wrapper.dataset.codeApplierBound = 'true';
      const shortName = targetPath.split('/').pop();

      // Check existing apply button (e.g. from app.js) to upgrade or replace
      let applyBtn = wrapper.querySelector('.btn-apply-to-file') || wrapper.querySelector('.btn-apply-agent-code');

      if (!applyBtn) {
        applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'btn-apply-to-file';
        const actions = wrapper.querySelector('.code-actions') || wrapper.querySelector('.code-header') || wrapper;
        actions.insertBefore(applyBtn, actions.firstChild);
      } else {
        applyBtn.className = 'btn-apply-to-file';
      }

      applyBtn.innerHTML = `<span>✨ Apply to ${shortName}</span>`;
      applyBtn.title = `Write directly to ${targetPath} and reload Studio editor`;
      applyBtn.dataset.bound = 'true';

      // Clone button or replace event listener cleanly
      const newBtn = applyBtn.cloneNode(true);
      applyBtn.parentNode.replaceChild(newBtn, applyBtn);

      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyToFile(targetPath, codeText, newBtn);
      });
    });

    // 2. Process standalone <pre> blocks without wrapper
    const standalonePres = root.querySelectorAll('pre:not(.code-pre)');
    standalonePres.forEach(pre => {
      if (pre.dataset.codeApplierBound === 'true') return;

      const codeEl = pre.querySelector('code') || pre;
      const codeText = codeEl.textContent || '';
      const targetPath = detectFilePath(codeText, '', pre);

      if (!targetPath) return;
      pre.dataset.codeApplierBound = 'true';
      const shortName = targetPath.split('/').pop();

      let header = pre.querySelector('.injected-code-header');
      if (!header) {
        header = document.createElement('div');
        header.className = 'injected-code-header';
        header.innerHTML = `
          <span style="color: var(--text-dim, #94a3b8); font-weight: 600;">📄 ${targetPath}</span>
          <div class="injected-code-actions"></div>
        `;
        pre.insertBefore(header, pre.firstChild);
      }

      const actionsWrapper = header.querySelector('.injected-code-actions') || header;
      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn-apply-to-file';
      applyBtn.innerHTML = `<span>✨ Apply to ${shortName}</span>`;
      applyBtn.title = `Write directly to ${targetPath} and reload Studio editor`;

      applyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyToFile(targetPath, codeText, applyBtn);
      });

      actionsWrapper.appendChild(applyBtn);
    });
  }

  /**
   * Observe new messages added to chat container
   */
  function setupMessagesObserver() {
    const container = window.el?.messagesContainer || document.getElementById('messagesContainer') || document.body;
    if (!container) return;

    if (state.observer) {
      state.observer.disconnect();
    }

    let debounceTimer = null;
    state.observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        enhance(container);
      }, 80);
    });

    state.observer.observe(container, { childList: true, subtree: true });
  }

  /**
   * Initialize module
   */
  function init() {
    injectStyles();
    enhance();
    setupMessagesObserver();
    state.initialized = true;
  }

  // Public API
  const DeepHarnessCodeApplier = {
    init,
    enhance,
    detectFilePath,
    applyToFile,
    reloadEditorIfOpen
  };

  // Export to global window
  window.DeepHarnessCodeApplier = DeepHarnessCodeApplier;

  // Auto-init on load or immediate
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
