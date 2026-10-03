/**
 * DeepHarness — Integrated Terminal Auto-Fix Loop
 * File: public/modules/autofix.js
 *
 * Autonomous terminal error detection and self-healing loop:
 * 1. Monitors terminal output (el.terminalOutput / terminalConsole) for errors & tracebacks.
 * 2. Injects a sleek floating / inline '🪄 Auto-Fix with AI' button.
 * 3. On click:
 *    - Captures error trace and pinpointed affected file.
 *    - Requests AI diagnosis & patch generation.
 *    - Automatically writes fixed code to disk via /api/workspace/file.
 *    - Re-executes the failing terminal command in Workspace Studio.
 */

(function () {
  'use strict';

  // Internal state
  const state = {
    isFixing: false,
    hasActiveError: false,
    lastErrorText: '',
    lastCommand: '',
    affectedFile: null,
    floatingBtn: null,
    inlineBanner: null,
    observer: null,
    initialized: false
  };

  /**
   * Inject sleek styles for floating and inline auto-fix elements
   */
  function injectStyles() {
    if (document.getElementById('deepharness-autofix-styles')) return;
    const style = document.createElement('style');
    style.id = 'deepharness-autofix-styles';
    style.textContent = `
      /* Sleek Floating Auto-Fix Pill */
      .autofix-floating-pill {
        position: absolute;
        bottom: 58px;
        right: 18px;
        z-index: 100;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 9999px;
        background: linear-gradient(135deg, rgba(147, 51, 234, 0.95), rgba(79, 70, 229, 0.95) 50%, rgba(14, 165, 233, 0.95));
        color: #ffffff;
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.2px;
        border: 1px solid rgba(216, 180, 254, 0.6);
        box-shadow: 0 8px 24px rgba(124, 58, 237, 0.45), 0 0 16px rgba(14, 165, 233, 0.35);
        cursor: pointer;
        user-select: none;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        animation: autofixFloatPulse 2s infinite alternate ease-in-out;
      }

      .autofix-floating-pill:hover {
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 12px 28px rgba(124, 58, 237, 0.6), 0 0 22px rgba(56, 189, 248, 0.5);
        border-color: rgba(255, 255, 255, 0.9);
      }

      .autofix-floating-pill:active {
        transform: translateY(0) scale(0.98);
      }

      .autofix-floating-pill:disabled {
        opacity: 0.75;
        cursor: not-allowed;
        animation: none;
        transform: none;
      }

      .autofix-floating-pill .autofix-icon {
        font-size: 14px;
        line-height: 1;
        display: inline-block;
        animation: autofixSpinSparkle 3s infinite ease-in-out;
      }

      .autofix-floating-pill .autofix-target-badge {
        background: rgba(0, 0, 0, 0.3);
        padding: 2px 7px;
        border-radius: 6px;
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: #e0e7ff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Inline Terminal Auto-Fix Card */
      .autofix-inline-card {
        margin: 10px 0;
        padding: 10px 14px;
        border-radius: 8px;
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.28);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        animation: autofixFadeIn 0.25s ease-out;
      }

      .autofix-inline-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: #fca5a5;
      }

      .autofix-inline-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 6px;
        background: linear-gradient(135deg, #9333ea, #0ea5e9);
        color: #fff;
        border: none;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(147, 51, 234, 0.3);
        transition: all 0.15s ease;
      }

      .autofix-inline-btn:hover {
        opacity: 0.95;
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(14, 165, 233, 0.45);
      }

      .autofix-spinner {
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: autofixSpin 0.7s linear infinite;
      }

      @keyframes autofixFloatPulse {
        0% { transform: translateY(0); box-shadow: 0 8px 24px rgba(124, 58, 237, 0.45), 0 0 12px rgba(14, 165, 233, 0.35); }
        100% { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(124, 58, 237, 0.65), 0 0 20px rgba(14, 165, 233, 0.55); }
      }

      @keyframes autofixSpinSparkle {
        0%, 100% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(15deg) scale(1.15); }
      }

      @keyframes autofixSpin {
        to { transform: rotate(360deg); }
      }

      @keyframes autofixFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Safely locate terminal output container from window.el or DOM
   */
  function getTerminalContainer() {
    if (window.el) {
      if (!window.el.terminalOutput) {
        window.el.terminalOutput =
          window.el.terminalConsole ||
          document.getElementById('terminalConsole') ||
          document.getElementById('terminalOutput') ||
          document.querySelector('.terminal-console-container');
      }
      return window.el.terminalOutput;
    }
    return (
      document.getElementById('terminalConsole') ||
      document.getElementById('terminalOutput') ||
      document.querySelector('.terminal-console-container')
    );
  }

  /**
   * Safely locate terminal parent panel to anchor floating controls
   */
  function getTerminalPanel() {
    return (
      document.getElementById('studioPanelTerminal') ||
      getTerminalContainer()?.parentElement ||
      document.body
    );
  }

  /**
   * Helper to append terminal message with fallback
   */
  function logToTerminal(type, text) {
    if (typeof window.appendTerminalLog === 'function') {
      window.appendTerminalLog(type, text);
    } else {
      const container = getTerminalContainer();
      if (!container) return;
      const span = document.createElement('span');
      span.className = `terminal-log-line ${type}`;
      span.textContent = text;
      container.appendChild(span);
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Helper to show toast with fallback
   */
  function notifyToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[DeepHarness Toast] (${type}) ${message}`);
    }
  }

  /**
   * Inspect error string or traceback to extract the pinpointed workspace file
   */
  function extractAffectedFile(errorText = '', command = '') {
    if (!errorText && !command) return null;

    const text = String(errorText);

    // 1. Python Traceback: File "app.py", line 123
    const pyMatch = text.match(/File\s+["']([^"']+\.(?:py|pyx))["'],\s+line\s+\d+/i);
    if (pyMatch && pyMatch[1] && !pyMatch[1].includes('site-packages') && !pyMatch[1].includes('<')) {
      return sanitizeFilePath(pyMatch[1]);
    }

    // 2. Node.js / JavaScript / TypeScript stack trace:
    //    at functionName (/path/to/file.js:12:34) or at /path/to/file.js:12:34
    const jsTraceRegex = /(?:at\s+(?:async\s+)?(?:[^\s(]+)?\s*\(?(?:file:\/\/)?([^:\s()]+\.(?:js|mjs|cjs|ts|tsx|jsx)):(\d+):(\d+)\)?|at\s+(?:file:\/\/)?([^:\s()]+\.(?:js|mjs|cjs|ts|tsx|jsx)):(\d+):(\d+))/gi;
    let match;
    while ((match = jsTraceRegex.exec(text)) !== null) {
      const candidate = match[1] || match[4];
      if (candidate && !candidate.includes('node_modules') && !candidate.startsWith('node:') && !candidate.includes('<anonymous>')) {
        return sanitizeFilePath(candidate);
      }
    }

    // 3. SyntaxError / Error filename prefixes:
    //    SyntaxError: /path/to/app.js: Unexpected token
    const syntaxMatch = text.match(/(?:(?:SyntaxError|ReferenceError|TypeError|Error):\s+)?([a-zA-Z0-9_\-./]+\.(?:js|ts|jsx|tsx|py|json|html|css|vue|svelte|go|rs|cpp|c|sh|sql))(?::\d+)?/i);
    if (syntaxMatch && syntaxMatch[1]) {
      const candidate = syntaxMatch[1];
      if (!candidate.includes('node_modules') && !candidate.includes('node:')) {
        return sanitizeFilePath(candidate);
      }
    }

    // 4. Command line argument parsing fallback:
    //    e.g., "node server.js", "python3 main.py", "ts-node src/index.ts"
    if (command) {
      const cmdParts = command.trim().split(/\s+/);
      for (const part of cmdParts) {
        if (/\.(?:js|mjs|cjs|ts|tsx|jsx|py|html|css|json|sh|go|rs)$/i.test(part)) {
          return sanitizeFilePath(part);
        }
      }
    }

    // 5. Active Studio file fallback
    const studioActive = window.state?.studio?.activeFile;
    if (studioActive) {
      const activePath = typeof studioActive === 'string' ? studioActive : studioActive.path;
      if (activePath) return sanitizeFilePath(activePath);
    }

    return null;
  }

  /**
   * Clean and normalize file path relative to workspace
   */
  function sanitizeFilePath(rawPath) {
    if (!rawPath) return null;
    let clean = rawPath.trim().replace(/^["']|["']$/g, '');
    clean = clean.replace(/\\/g, '/');

    // Strip file:// prefix if present
    clean = clean.replace(/^file:\/\//, '');

    // Strip full absolute workspace path prefix if present
    const workspaceRoot = window.state?.settings?.workspace_root || '';
    if (workspaceRoot && clean.startsWith(workspaceRoot)) {
      clean = clean.slice(workspaceRoot.length);
    }

    // Strip leading /
    clean = clean.replace(/^\/+/, '');

    // If starts with ./, strip it
    clean = clean.replace(/^\.\//, '');

    return clean || null;
  }

  /**
   * Determine if text contains terminal errors or tracebacks
   */
  function isErrorTrace(text) {
    if (!text) return false;
    const errorPatterns = [
      /Traceback\s+\(most\s+recent\s+call\s+last\):/i,
      /(?:SyntaxError|ReferenceError|TypeError|RangeError|URIError|EvalError):/i,
      /UnhandledPromiseRejection/i,
      /Uncaught\s+Exception/i,
      /Process exited with code [1-9]\d*/i,
      /Process error:/i,
      /npm ERR!/i,
      /yarn error/i,
      /pnpm ERR!/i,
      /Cannot find module/i,
      /ModuleNotFoundError:/i,
      /ImportError:/i,
      /AttributeError:/i,
      /NameError:/i,
      /FileNotFoundError:/i,
      /Compilation failed/i,
      /Build failed/i,
      /FATAL ERROR:/i,
      /fatal:\s+/i,
      /failed with exit code/i
    ];

    return errorPatterns.some(regex => regex.test(text));
  }

  /**
   * Display or update the sleek floating '🪄 Auto-Fix with AI' button
   */
  function showFloatingButton(details = {}) {
    injectStyles();
    const panel = getTerminalPanel();
    if (!panel) return;

    // Ensure relative positioning on terminal panel so floating button is contained
    const computedPos = window.getComputedStyle(panel).position;
    if (computedPos === 'static') {
      panel.style.position = 'relative';
    }

    const affected = details.affectedFile || state.affectedFile;
    const targetBadgeHtml = affected ? `<span class="autofix-target-badge" title="${affected}">📄 ${affected.split('/').pop()}</span>` : '';

    if (!state.floatingBtn) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'autofix-floating-pill';
      btn.id = 'deepharnessAutoFixFloatingBtn';
      btn.title = 'AI Auto-Fix: Diagnoses error, patches the code, and re-executes command';
      btn.addEventListener('click', () => triggerAutoFix());
      panel.appendChild(btn);
      state.floatingBtn = btn;
    }

    state.floatingBtn.innerHTML = `
      <span class="autofix-icon">🪄</span>
      <span>Auto-Fix with AI</span>
      ${targetBadgeHtml}
    `;
    state.floatingBtn.style.display = 'inline-flex';
    state.floatingBtn.disabled = false;

    // Also update and show standard Studio auto-fix banner if present in DOM
    const banner = window.el?.terminalAutoFixBanner || document.getElementById('terminalAutoFixBanner');
    if (banner) {
      banner.style.display = 'flex';
      const snippet = banner.querySelector('#terminalErrorSnippet') || banner.querySelector('.tab-msg');
      if (snippet && state.lastErrorText) {
        const lastLine = state.lastErrorText.trim().split('\n').filter(Boolean).pop() || 'Command error';
        snippet.textContent = lastLine.slice(0, 95);
      }
      const aiBtn = banner.querySelector('#btnAutoFixWithAi') || banner.querySelector('.btn-autofix');
      if (aiBtn && !aiBtn.dataset.autofixHooked) {
        aiBtn.dataset.autofixHooked = 'true';
        aiBtn.innerHTML = `<span>🪄 Auto-Fix with AI</span>`;
        aiBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          triggerAutoFix();
        });
      }
    }
  }

  /**
   * Hide floating & inline auto-fix elements
   */
  function hideFloatingButton() {
    if (state.floatingBtn) {
      state.floatingBtn.style.display = 'none';
    }
    const banner = window.el?.terminalAutoFixBanner || document.getElementById('terminalAutoFixBanner');
    if (banner) {
      banner.style.display = 'none';
    }
    state.hasActiveError = false;
  }

  /**
   * Trigger the full autonomous Auto-Fix Loop
   */
  async function triggerAutoFix(options = {}) {
    if (state.isFixing) return;
    state.isFixing = true;

    // Resolve details
    const cmd = options.command || state.lastCommand || window.state?.terminal?.lastCommand || '';
    const errorLog = options.errorText || state.lastErrorText || window.state?.terminal?.lastError || '';
    const targetFile = options.affectedFile || state.affectedFile || extractAffectedFile(errorLog, cmd);

    // Update UI to analyzing state
    if (state.floatingBtn) {
      state.floatingBtn.disabled = true;
      state.floatingBtn.innerHTML = `
        <span class="autofix-spinner"></span>
        <span>🪄 Diagnosing & Healing...</span>
      `;
    }

    notifyToast(`🪄 Diagnosing error with AI${targetFile ? ` in ${targetFile}` : ''}...`, 'info');
    logToTerminal('info', `\n🪄 [Auto-Fix] Captured failure output for command: "$ ${cmd}"\n`);
    if (targetFile) {
      logToTerminal('info', `🎯 [Auto-Fix] Identified target file to patch: "${targetFile}"\n`);
    }

    try {
      // 1. Fetch current file content if file identified
      let currentFileContent = '';
      if (targetFile) {
        try {
          const fileRes = await fetch(`/api/workspace/file?path=${encodeURIComponent(targetFile)}`);
          if (fileRes.ok) {
            const fileData = await fileRes.json();
            currentFileContent = fileData.content || '';
          }
        } catch (readErr) {
          console.warn('[AutoFix] Unable to read target file content:', readErr);
        }
      }

      // 2. Build structured Auto-Fix prompt
      const prompt = `A command failed in the workspace terminal with the following output:

Command:
\`\`\`bash
${cmd || 'npm test'}
\`\`\`

Terminal Error Output:
\`\`\`
${(errorLog || 'Process exited with error').slice(-2500)}
\`\`\`

${targetFile ? `Target File: ${targetFile}\n` : ''}
${currentFileContent ? `Current File Contents:\n\`\`\`\n${currentFileContent}\n\`\`\`\n` : ''}

CRITICAL INSTRUCTIONS:
1. Identify the root cause of the error.
2. Provide the COMPLETE, bug-free corrected file code for "${targetFile || 'the affected file'}".
3. Return your response with the code block explicitly formatted as:
\`\`\`${targetFile ? `javascript:${targetFile}` : 'code'}
// filepath: ${targetFile || 'src/index.js'}
<complete corrected code here>
\`\`\`
Do not use placeholders, diffs, or ellipses ("..."). Return the full, runnable file so it can be saved directly to disk.`;

      logToTerminal('info', `🧠 [Auto-Fix] Requesting autonomous patch from ${window.state?.activeModel || 'DeepSeek AI'}...\n`);

      // 3. Send auto-fix request to AI
      const activeModel = window.state?.activeModel || 'deepseek-chat';
      const sessionId = window.state?.currentSessionId || undefined;

      const aiRes = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          model: activeModel,
          messages: [{ role: 'user', content: prompt }],
          system_prompt: 'You are an automated code-healing engine in DeepHarness. Analyze terminal failure logs and provide the complete fixed file code in a clean code block.'
        })
      });

      if (!aiRes.ok) {
        const errJson = await aiRes.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${aiRes.status}`);
      }

      // Stream and collect assistant reply
      const reader = aiRes.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullAssistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed.startsWith('data: ')) {
            const rawData = trimmed.slice(6);
            if (rawData === '[DONE]') continue;
            try {
              const parsed = JSON.parse(rawData);
              if (parsed.type === 'content' && parsed.delta) {
                fullAssistantText += parsed.delta;
              }
            } catch (e) {}
          }
        }
      }

      // 4. Extract corrected code block
      const extracted = parseCodeFromResponse(fullAssistantText, targetFile);
      if (!extracted || !extracted.code) {
        throw new Error('AI did not return a valid replacement code block. Please review chat output.');
      }

      const finalPath = extracted.path || targetFile;
      if (!finalPath) {
        throw new Error('Could not verify destination file path for the patch.');
      }

      // 5. Automatically write corrected code to disk via /api/workspace/file
      logToTerminal('info', `💾 [Auto-Fix] Writing corrected code to "${finalPath}"...\n`);

      const saveRes = await fetch('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: finalPath,
          content: extracted.code
        })
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        throw new Error(saveData.error || 'Failed to save corrected file');
      }

      // 6. Reload editor if open
      if (typeof window.DeepHarnessCodeApplier?.reloadEditorIfOpen === 'function') {
        window.DeepHarnessCodeApplier.reloadEditorIfOpen(finalPath, extracted.code);
      } else {
        syncEditorIfOpen(finalPath, extracted.code);
      }

      notifyToast(`✅ Auto-fixed ${finalPath}! Re-running command...`, 'success');
      logToTerminal('info', `✨ [Auto-Fix] Successfully patched "${finalPath}". Re-executing command...\n`);

      // Hide the auto-fix button now that fix is applied
      hideFloatingButton();

      // 7. Re-execute the terminal command in Studio!
      if (cmd) {
        setTimeout(() => {
          if (typeof window.runTerminalCommand === 'function') {
            window.runTerminalCommand(cmd);
          } else {
            fetch('/api/terminal/run', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: cmd })
            });
          }
        }, 400);
      }

    } catch (err) {
      console.error('[AutoFix] Auto-fix execution error:', err);
      notifyToast(`Auto-fix failed: ${err.message}`, 'error');
      logToTerminal('error', `\n❌ [Auto-Fix Error] ${err.message}\n`);

      // Restore floating button
      if (state.floatingBtn) {
        state.floatingBtn.disabled = false;
        state.floatingBtn.innerHTML = `
          <span class="autofix-icon">🪄</span>
          <span>Retry Auto-Fix</span>
        `;
      }
    } finally {
      state.isFixing = false;
    }
  }

  /**
   * Parse extracted code block and destination path from AI response
   */
  function parseCodeFromResponse(rawText, fallbackPath) {
    if (!rawText) return null;

    // Match code block with optional header: ```lang:path/to/file or ```lang
    const blockRegex = /```(?:([^\n]*)\n)([\s\S]*?)```/g;
    let match;
    let bestCode = null;
    let bestPath = fallbackPath || null;

    while ((match = blockRegex.exec(rawText)) !== null) {
      const header = (match[1] || '').trim();
      const code = match[2];

      // Check for path in header: ```javascript:public/app.js
      if (header.includes(':')) {
        const parts = header.split(':');
        const candidatePath = parts.slice(1).join(':').trim();
        if (candidatePath) {
          bestPath = sanitizeFilePath(candidatePath);
        }
      }

      // Check for filepath comment inside code: // filepath: ...
      const commentMatch = code.match(/(?:\/\/|#|\/\*|<!--)\s*(?:filepath|file|filename):\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i);
      if (commentMatch && commentMatch[1]) {
        bestPath = sanitizeFilePath(commentMatch[1]);
      }

      bestCode = code;
      // If we found both code and verified path, break
      if (bestCode && bestPath) break;
    }

    if (!bestCode) return null;

    return {
      code: bestCode,
      path: bestPath
    };
  }

  /**
   * Sync editor content if open in Studio
   */
  function syncEditorIfOpen(filePath, codeText) {
    const activeFile = window.state?.studio?.activeFile;
    const currentOpenPath = typeof activeFile === 'string' ? activeFile : activeFile?.path;

    if (currentOpenPath === filePath && window.el?.studioCodeEditor) {
      window.el.studioCodeEditor.value = codeText;

      if (typeof window.updateLineNumbers === 'function') {
        window.updateLineNumbers(codeText);
      }
      if (typeof window.updateEditorStatusBar === 'function') {
        const ext = '.' + filePath.split('.').pop();
        window.updateEditorStatusBar(codeText, ext, false);
      }

      if (window.state?.studio?.activeFile && typeof window.state.studio.activeFile === 'object') {
        window.state.studio.activeFile.content = codeText;
        window.state.studio.activeFile.originalContent = codeText;
        window.state.studio.activeFile.isDirty = false;
      }
    }

    // Refresh file tree & git status if functions exist
    if (typeof window.loadFileTree === 'function') {
      window.loadFileTree(window.state?.studio?.currentPath || '');
    }
    if (typeof window.loadGitStatus === 'function') {
      window.loadGitStatus();
    }
  }

  /**
   * Observe terminal output changes
   */
  function setupTerminalObserver() {
    const container = getTerminalContainer();
    if (!container) return;

    if (state.observer) {
      state.observer.disconnect();
    }

    state.observer = new MutationObserver((mutations) => {
      let detectedError = false;
      let addedErrorText = '';

      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const isErrNode = node.classList?.contains('error') || node.classList?.contains('stderr');
            const textContent = node.textContent || '';
            if (isErrNode || isErrorTrace(textContent)) {
              detectedError = true;
              addedErrorText += textContent + '\n';
            }
          } else if (node.nodeType === Node.TEXT_NODE) {
            if (isErrorTrace(node.textContent)) {
              detectedError = true;
              addedErrorText += node.textContent + '\n';
            }
          }
        }
      }

      if (detectedError) {
        const combinedError = (state.lastErrorText + '\n' + addedErrorText).slice(-3000);
        state.lastErrorText = combinedError;
        state.hasActiveError = true;

        const cmd = window.state?.terminal?.lastCommand || state.lastCommand || '';
        const affected = extractAffectedFile(combinedError, cmd);
        if (affected) state.affectedFile = affected;

        showFloatingButton({ affectedFile: state.affectedFile, errorText: combinedError });
      }
    });

    state.observer.observe(container, { childList: true, subtree: true });
  }

  /**
   * Hook terminal execution functions
   */
  function hookTerminalRunner() {
    // Intercept runTerminalCommand to reset error state
    if (typeof window.runTerminalCommand === 'function' && !window.runTerminalCommand._autofixHooked) {
      const origRun = window.runTerminalCommand;
      window.runTerminalCommand = function (cmd) {
        state.lastCommand = cmd;
        state.lastErrorText = '';
        state.affectedFile = null;
        hideFloatingButton();
        return origRun.apply(this, arguments);
      };
      window.runTerminalCommand._autofixHooked = true;
    }

    // Intercept clearTerminalConsole
    if (typeof window.clearTerminalConsole === 'function' && !window.clearTerminalConsole._autofixHooked) {
      const origClear = window.clearTerminalConsole;
      window.clearTerminalConsole = function () {
        state.lastErrorText = '';
        state.affectedFile = null;
        hideFloatingButton();
        return origClear.apply(this, arguments);
      };
      window.clearTerminalConsole._autofixHooked = true;
    }
  }

  /**
   * Initialize module
   */
  function init() {
    injectStyles();
    setupTerminalObserver();
    hookTerminalRunner();
    state.initialized = true;
  }

  // Public API
  const DeepHarnessAutoFix = {
    init,
    isErrorTrace,
    extractAffectedFile,
    showButton: showFloatingButton,
    hideButton: hideFloatingButton,
    triggerAutoFix,
    getState: () => ({ ...state })
  };

  // Export to global window
  window.DeepHarnessAutoFix = DeepHarnessAutoFix;

  // Auto-init on load or immediate
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
