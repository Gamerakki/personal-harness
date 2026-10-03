// ==========================================================================
// DeepHarness — Multi-Model Arena (Side-by-Side AI Comparison)
// ==========================================================================
(function () {
  'use strict';

  let arenaActive = false;
  let arenaModels = [null, null]; // [modelA, modelB]

  function init() {
    // Add Arena toggle to execution mode bar
    const modeBar = document.querySelector('.execution-mode-bar, .model-toolbar, .chat-toolbar-actions');
    if (!modeBar) return;

    const arenaBtn = document.createElement('button');
    arenaBtn.type = 'button';
    arenaBtn.id = 'arenaToggleBtn';
    arenaBtn.className = 'btn-arena-toggle';
    arenaBtn.title = 'Arena Mode — Compare two models side-by-side';
    arenaBtn.innerHTML = '⚔️ Arena';
    arenaBtn.addEventListener('click', toggleArenaSetup);
    modeBar.appendChild(arenaBtn);
  }

  function toggleArenaSetup() {
    if (arenaActive) {
      deactivateArena();
      return;
    }
    showArenaSetupModal();
  }

  function showArenaSetupModal() {
    let modal = document.getElementById('arenaSetupModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'arenaSetupModal';
      modal.className = 'modal-backdrop studio-modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 500px;">
          <div class="modal-header">
            <div class="mh-title"><span style="font-size: 18px;">⚔️</span><h3>Arena Mode — Pick 2 Models</h3></div>
            <button type="button" class="btn-close-modal" id="closeArenaSetupBtn">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 12px; color: var(--text-dim); margin: 0 0 14px;">
              Send the same prompt to two models simultaneously and compare speed, reasoning, and quality side-by-side.
            </p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 11px; color: var(--text-dim); margin-bottom: 4px; display: block;">Model A (Left)</label>
                <select id="arenaModelA" class="settings-input" style="width: 100%;"></select>
              </div>
              <div>
                <label style="font-size: 11px; color: var(--text-dim); margin-bottom: 4px; display: block;">Model B (Right)</label>
                <select id="arenaModelB" class="settings-input" style="width: 100%;"></select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="cancelArenaBtn">Cancel</button>
            <button type="button" class="btn-primary" id="startArenaBtn">⚔️ Start Arena</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#closeArenaSetupBtn').addEventListener('click', () => { modal.style.display = 'none'; });
      modal.querySelector('#cancelArenaBtn').addEventListener('click', () => { modal.style.display = 'none'; });
      modal.querySelector('#startArenaBtn').addEventListener('click', () => {
        const a = document.getElementById('arenaModelA').value;
        const b = document.getElementById('arenaModelB').value;
        if (!a || !b) { if (typeof showToast === 'function') showToast('Select both models', 'error'); return; }
        if (a === b) { if (typeof showToast === 'function') showToast('Pick two different models', 'error'); return; }
        arenaModels = [a, b];
        activateArena();
        modal.style.display = 'none';
      });
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    // Populate model selects
    const models = (window.state && window.state.models) || [];
    ['arenaModelA', 'arenaModelB'].forEach((id, idx) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '<option value="">— Select Model —</option>';
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name || m.id;
        opt.textContent = (m.providerName ? m.providerName + ' / ' : '') + (m.name || m.id);
        sel.appendChild(opt);
      });
      // Pre-select if we have previous choices
      if (arenaModels[idx]) sel.value = arenaModels[idx];
    });

    modal.style.display = 'flex';
  }

  function activateArena() {
    arenaActive = true;
    const btn = document.getElementById('arenaToggleBtn');
    if (btn) {
      btn.classList.add('arena-active');
      btn.innerHTML = '⚔️ Arena ON';
    }
    if (typeof showToast === 'function') {
      showToast(`⚔️ Arena Mode: ${arenaModels[0]} vs ${arenaModels[1]}`, 'info');
    }
  }

  function deactivateArena() {
    arenaActive = false;
    const btn = document.getElementById('arenaToggleBtn');
    if (btn) {
      btn.classList.remove('arena-active');
      btn.innerHTML = '⚔️ Arena';
    }
    if (typeof showToast === 'function') showToast('Arena mode deactivated', 'info');
  }

  // Run arena comparison
  async function runArena(prompt, historyMessages) {
    if (!arenaActive || arenaModels.length < 2) return null;

    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return null;

    // Create arena row
    const arenaRow = document.createElement('div');
    arenaRow.className = 'arena-comparison-row';
    arenaRow.innerHTML = `
      <div class="arena-header">
        <span>⚔️ Arena Comparison</span>
        <span style="font-size: 11px; color: var(--text-dim);">${arenaModels[0]} vs ${arenaModels[1]}</span>
      </div>
      <div class="arena-columns">
        <div class="arena-col" id="arenaColA">
          <div class="arena-col-header">${arenaModels[0]}</div>
          <div class="arena-col-body arena-col-body-a">
            <div class="arena-thinking">⏳ Thinking...</div>
          </div>
          <div class="arena-col-stats" id="arenaStatsA"></div>
        </div>
        <div class="arena-divider"></div>
        <div class="arena-col" id="arenaColB">
          <div class="arena-col-header">${arenaModels[1]}</div>
          <div class="arena-col-body arena-col-body-b">
            <div class="arena-thinking">⏳ Thinking...</div>
          </div>
          <div class="arena-col-stats" id="arenaStatsB"></div>
        </div>
      </div>
    `;
    messagesContainer.appendChild(arenaRow);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const sessionId = (window.state && window.state.currentSessionId) || 'arena';
    const startTime = Date.now();

    // Stream both models simultaneously
    const streamPromises = arenaModels.map((model, idx) => {
      const colBody = arenaRow.querySelector(idx === 0 ? '.arena-col-body-a' : '.arena-col-body-b');
      const statsEl = document.getElementById(idx === 0 ? 'arenaStatsA' : 'arenaStatsB');
      return streamArenaModel(model, prompt, historyMessages, sessionId, colBody, statsEl, startTime);
    });

    await Promise.allSettled(streamPromises);
    return arenaRow;
  }

  async function streamArenaModel(model, prompt, history, sessionId, colBody, statsEl, startTime) {
    let fullText = '';
    let tokens = 0;
    let firstTokenTime = null;

    try {
      const payload = {
        sessionId,
        model,
        messages: [...(history || []), { role: 'user', content: prompt }],
      };

      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        colBody.innerHTML = `<div style="color: #ef4444; font-size: 12px;">Error: ${res.status} ${res.statusText}</div>`;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      colBody.innerHTML = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              if (!firstTokenTime) firstTokenTime = Date.now();
              fullText += parsed.content;
              tokens++;
              colBody.innerHTML = `<div class="arena-response-text">${formatMarkdownBasic(fullText)}</div>`;
              colBody.scrollTop = colBody.scrollHeight;
            }
            if (parsed.telemetry) {
              const t = parsed.telemetry;
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              const ttft = firstTokenTime ? ((firstTokenTime - startTime) / 1000).toFixed(1) : '—';
              const totalTokens = (t.output_tokens || t.completion_tokens || tokens);
              const tps = elapsed > 0 ? (totalTokens / elapsed).toFixed(1) : '—';
              statsEl.innerHTML = `
                <span>⏱ ${elapsed}s</span>
                <span>📡 TTFT: ${ttft}s</span>
                <span>📊 ${totalTokens} tok</span>
                <span>⚡ ${tps} tok/s</span>
                ${t.cost ? `<span>💰 \$${t.cost}</span>` : ''}
              `;
            }
          } catch (_) {}
        }
      }

      // Final stats if telemetry wasn't sent
      if (!statsEl.innerHTML) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        statsEl.innerHTML = `<span>⏱ ${elapsed}s</span><span>📊 ~${tokens} chunks</span>`;
      }
    } catch (err) {
      colBody.innerHTML = `<div style="color: #ef4444; font-size: 12px;">Stream error: ${err.message}</div>`;
    }
  }

  function formatMarkdownBasic(text) {
    // Very basic markdown: code blocks, bold, inline code
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    return html;
  }

  // Expose
  window.DeepHarnessArena = {
    init,
    isActive: () => arenaActive,
    getModels: () => arenaModels,
    runArena,
    toggleArenaSetup,
    deactivateArena,
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 500);
  }
})();
