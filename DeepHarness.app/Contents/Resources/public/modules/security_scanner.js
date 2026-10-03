// ==========================================================================
// DeepHarness — Pre-Commit Secret & Security Scanner
// ==========================================================================
(function () {
  'use strict';

  // Secret patterns to detect
  const SECRET_PATTERNS = [
    { name: 'OpenAI / DeepSeek API Key', regex: /sk-[a-zA-Z0-9]{20,}/, severity: 'critical' },
    { name: 'GitHub PAT (Classic)', regex: /ghp_[a-zA-Z0-9]{36,}/, severity: 'critical' },
    { name: 'GitHub PAT (Fine-grained)', regex: /github_pat_[a-zA-Z0-9_]{22,}/, severity: 'critical' },
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/, severity: 'critical' },
    { name: 'AWS Secret Key', regex: /(?:aws_secret_access_key|secret_key)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/i, severity: 'critical' },
    { name: 'Private Key Block', regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\sKEY-----/, severity: 'critical' },
    { name: 'Generic Secret/Password', regex: /(?:password|secret|token|api_key)\s*[=:]\s*["'][^"']{8,}["']/i, severity: 'warning' },
    { name: 'Slack Webhook', regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[a-zA-Z0-9]+/, severity: 'critical' },
    { name: 'Stripe Key', regex: /(?:sk|pk)_(?:test|live)_[a-zA-Z0-9]{24,}/, severity: 'critical' },
    { name: 'Anthropic Key', regex: /sk-ant-[a-zA-Z0-9\-_]{20,}/, severity: 'critical' },
    { name: 'Google API Key', regex: /AIzaSy[a-zA-Z0-9\-_]{33}/, severity: 'warning' },
    { name: 'JWT Token', regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+/, severity: 'warning' },
  ];

  // Files that should never be committed
  const SENSITIVE_FILES = ['.env', '.env.local', '.env.production', 'id_rsa', 'id_ed25519', '.pem'];

  let lastScanResults = null;

  async function scanForSecrets() {
    const results = { clean: true, findings: [], scannedFiles: 0 };

    try {
      // Get git status for changed/staged files
      const gitRes = await fetch('/api/git/status');
      const gitData = await gitRes.json();

      if (!gitData.isRepo) {
        results.message = 'Not a git repository';
        lastScanResults = results;
        return results;
      }

      // Collect changed files
      const changedFiles = [];
      if (gitData.staged) changedFiles.push(...gitData.staged.map(f => f.file || f));
      if (gitData.modified) changedFiles.push(...gitData.modified.map(f => f.file || f));
      if (gitData.untracked) changedFiles.push(...gitData.untracked.map(f => f.file || f));

      // Parse from raw status if needed
      if (changedFiles.length === 0 && gitData.status) {
        const lines = gitData.status.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          const match = line.match(/^\s*[MADRCU?!]+\s+(.+)$/);
          if (match) changedFiles.push(match[1].trim());
        });
      }

      // Deduplicate
      const uniqueFiles = [...new Set(changedFiles)];
      results.scannedFiles = uniqueFiles.length;

      // Check for sensitive file names
      uniqueFiles.forEach(filePath => {
        const name = filePath.split('/').pop();
        if (SENSITIVE_FILES.some(sf => name === sf || name.endsWith(sf))) {
          results.clean = false;
          results.findings.push({
            file: filePath,
            type: 'Sensitive File',
            detail: `${name} should not be committed — add it to .gitignore`,
            severity: 'critical',
            line: 0,
          });
        }
      });

      // Scan file contents for secret patterns
      for (const filePath of uniqueFiles) {
        // Skip binary-looking files and large files
        if (/\.(png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|svg|mp3|mp4|zip|tar|gz|pdf)$/i.test(filePath)) continue;
        if (filePath.includes('node_modules/') || filePath.includes('.git/')) continue;

        try {
          const fileRes = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`);
          const fileData = await fileRes.json();
          if (!fileData.content) continue;

          const lines = fileData.content.split('\n');
          lines.forEach((line, idx) => {
            SECRET_PATTERNS.forEach(pattern => {
              if (pattern.regex.test(line)) {
                results.clean = false;
                results.findings.push({
                  file: filePath,
                  type: pattern.name,
                  detail: line.trim().slice(0, 80) + (line.trim().length > 80 ? '...' : ''),
                  severity: pattern.severity,
                  line: idx + 1,
                });
              }
            });
          });
        } catch (_) {}
      }
    } catch (err) {
      results.error = err.message;
    }

    lastScanResults = results;
    updateSecurityBadge(results);
    return results;
  }

  function updateSecurityBadge(results) {
    let badge = document.getElementById('securityScanBadge');
    if (!badge) {
      // Try to insert badge in git panel header
      const gitHeader = document.querySelector('.git-status-header, .git-panel-header, #gitPanel .studio-tab-content');
      if (!gitHeader) return;
      badge = document.createElement('span');
      badge.id = 'securityScanBadge';
      badge.className = 'security-scan-badge';
      badge.style.cssText = 'cursor: pointer; font-size: 11px; padding: 2px 8px; border-radius: 10px; margin-left: 8px; display: inline-flex; align-items: center; gap: 4px;';
      badge.addEventListener('click', showScanReport);
      gitHeader.appendChild(badge);
    }

    if (results.clean) {
      badge.innerHTML = '🛡️ Secrets Clean';
      badge.style.background = 'rgba(16, 185, 129, 0.15)';
      badge.style.color = '#10b981';
    } else {
      const count = results.findings.length;
      badge.innerHTML = `⚠️ ${count} Secret${count > 1 ? 's' : ''} Found`;
      badge.style.background = 'rgba(239, 68, 68, 0.15)';
      badge.style.color = '#ef4444';
    }
  }

  function showScanReport() {
    if (!lastScanResults) {
      if (typeof showToast === 'function') showToast('Run a security scan first', 'info');
      return;
    }

    let modal = document.getElementById('secretScanModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'secretScanModal';
      modal.className = 'modal-backdrop studio-modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 560px;">
          <div class="modal-header">
            <div class="mh-title"><span style="font-size: 18px;">🛡️</span><h3>Security Scan Report</h3></div>
            <button type="button" class="btn-close-modal" id="closeSecretScanBtn">✕</button>
          </div>
          <div class="modal-body" id="secretScanBody" style="max-height: 400px; overflow-y: auto;"></div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="closeSecretScanBtn2">Close</button>
            <button type="button" class="btn-primary" id="rescanSecretsBtn">🔄 Rescan</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#closeSecretScanBtn').addEventListener('click', () => { modal.style.display = 'none'; });
      modal.querySelector('#closeSecretScanBtn2').addEventListener('click', () => { modal.style.display = 'none'; });
      modal.querySelector('#rescanSecretsBtn').addEventListener('click', async () => {
        await scanForSecrets();
        renderScanReport();
      });
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    renderScanReport();
    modal.style.display = 'flex';
  }

  function renderScanReport() {
    const body = document.getElementById('secretScanBody');
    if (!body || !lastScanResults) return;

    const r = lastScanResults;
    if (r.clean) {
      body.innerHTML = `
        <div style="text-align: center; padding: 30px;">
          <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
          <div style="font-size: 14px; font-weight: 600; color: #10b981;">All Clean!</div>
          <div style="font-size: 12px; color: var(--text-dim); margin-top: 6px;">
            Scanned ${r.scannedFiles} changed file${r.scannedFiles !== 1 ? 's' : ''} — no secrets detected.
          </div>
        </div>
      `;
    } else {
      let html = `<div style="font-size: 12px; color: var(--text-dim); margin-bottom: 12px;">
        Found ${r.findings.length} potential secret${r.findings.length > 1 ? 's' : ''} in ${r.scannedFiles} scanned file${r.scannedFiles !== 1 ? 's' : ''}:
      </div>`;
      r.findings.forEach(f => {
        const isCritical = f.severity === 'critical';
        html += `
          <div style="background: ${isCritical ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)'}; border: 1px solid ${isCritical ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 12px; font-weight: 600; color: ${isCritical ? '#ef4444' : '#f59e0b'};">${isCritical ? '🔴' : '🟡'} ${f.type}</span>
              <span style="font-size: 10px; color: var(--text-dim);">${f.file}${f.line ? ':' + f.line : ''}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); word-break: break-all;">
              ${escapeHtml(f.detail)}
            </div>
          </div>
        `;
      });
      body.innerHTML = html;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Hook into git commit flow — intercept commit button
  function interceptCommit() {
    // Try to find the commit button and add a pre-check
    const observer = new MutationObserver(() => {
      const commitBtn = document.getElementById('btnGitCommit') || document.querySelector('[data-action="git-commit"]');
      if (commitBtn && !commitBtn.dataset.secretHooked) {
        commitBtn.dataset.secretHooked = 'true';
        const originalClick = commitBtn.onclick;
        commitBtn.addEventListener('click', async (e) => {
          const results = await scanForSecrets();
          if (!results.clean) {
            const criticalCount = results.findings.filter(f => f.severity === 'critical').length;
            if (criticalCount > 0) {
              e.stopImmediatePropagation();
              e.preventDefault();
              showScanReport();
              if (typeof showToast === 'function') {
                showToast(`⚠️ ${criticalCount} critical secret(s) detected! Review before committing.`, 'error');
              }
            }
          }
        }, true); // Capture phase to run first
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { interceptCommit(); });
  } else {
    interceptCommit();
  }

  window.DeepHarnessSecurityScanner = { scanForSecrets, showScanReport, updateSecurityBadge };
})();
