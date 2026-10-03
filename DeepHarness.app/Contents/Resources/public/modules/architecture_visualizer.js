// ==========================================================================
// DeepHarness — Codebase Architecture Visualizer (Mermaid Diagrams)
// ==========================================================================
(function () {
  'use strict';

  async function scanArchitecture() {
    const result = { nodes: {}, edges: [], entryPoints: [], fileTypes: {} };

    try {
      const res = await fetch('/api/workspace/files-list');
      const data = await res.json();
      const files = (data.files || []).filter(f => !f.isDirectory);

      // Filter to code files only
      const codeFiles = files.filter(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        return ['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'css', 'html', 'vue', 'svelte'].includes(ext);
      });

      // Count file types
      codeFiles.forEach(f => {
        const ext = f.name.split('.').pop().toLowerCase();
        result.fileTypes[ext] = (result.fileTypes[ext] || 0) + 1;
      });

      // Identify entry points
      const entryNames = ['index.html', 'app.js', 'main.js', 'index.js', 'server.js', 'main.py', 'app.py', 'main.go', 'main.rs'];
      codeFiles.forEach(f => {
        if (entryNames.includes(f.name)) {
          result.entryPoints.push(f.path);
        }
      });

      // Scan imports for each file (limit to first 50 for performance)
      const scannable = codeFiles.slice(0, 50);
      for (const file of scannable) {
        try {
          const fRes = await fetch(`/api/workspace/file?path=${encodeURIComponent(file.path)}`);
          const fData = await fRes.json();
          if (!fData.content) continue;

          const imports = extractImports(fData.content, file.path);
          const exports = extractExports(fData.content);

          result.nodes[file.path] = {
            name: file.name,
            path: file.path,
            imports,
            exports,
            lines: fData.content.split('\n').length,
            type: categorizeFile(file.path, fData.content),
          };

          imports.forEach(imp => {
            result.edges.push({ from: file.path, to: imp, type: 'imports' });
          });
        } catch (_) {}
      }
    } catch (err) {
      console.error('[ArchVisualizer] Scan error:', err);
    }

    return result;
  }

  function extractImports(content, filePath) {
    const imports = [];
    const ext = filePath.split('.').pop().toLowerCase();

    if (['js', 'ts', 'jsx', 'tsx', 'vue', 'svelte'].includes(ext)) {
      // ES6 imports
      const esMatches = content.matchAll(/import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g);
      for (const m of esMatches) {
        if (!m[1].startsWith('.') && !m[1].startsWith('/')) continue; // Skip node_modules
        imports.push(resolveImportPath(m[1], filePath));
      }
      // require()
      const reqMatches = content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const m of reqMatches) {
        if (!m[1].startsWith('.') && !m[1].startsWith('/')) continue;
        imports.push(resolveImportPath(m[1], filePath));
      }
    } else if (['py'].includes(ext)) {
      // Python imports
      const pyMatches = content.matchAll(/(?:from|import)\s+([\w.]+)/g);
      for (const m of pyMatches) {
        if (m[1].startsWith('.') || !m[1].includes('.')) {
          imports.push(m[1].replace(/\./g, '/') + '.py');
        }
      }
    } else if (['html'].includes(ext)) {
      // Script/link tags
      const scriptMatches = content.matchAll(/<script[^>]+src=["']([^"']+)["']/g);
      for (const m of scriptMatches) imports.push(m[1]);
      const linkMatches = content.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/g);
      for (const m of linkMatches) imports.push(m[1]);
    }

    return imports;
  }

  function resolveImportPath(importPath, fromFile) {
    if (importPath.startsWith('/')) return importPath;
    const dir = fromFile.split('/').slice(0, -1).join('/');
    const parts = (dir ? dir + '/' + importPath : importPath).split('/');
    const resolved = [];
    parts.forEach(p => {
      if (p === '..') resolved.pop();
      else if (p !== '.') resolved.push(p);
    });
    return resolved.join('/');
  }

  function extractExports(content) {
    const exports = [];
    // module.exports
    const modExports = content.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    if (modExports) {
      modExports[1].split(',').forEach(e => {
        const name = e.trim().split(':')[0].trim().split(' ').pop();
        if (name) exports.push(name);
      });
    }
    // export function/const/class
    const esExports = content.matchAll(/export\s+(?:default\s+)?(?:function|const|class|let|var)\s+(\w+)/g);
    for (const m of esExports) exports.push(m[1]);

    // window.Something assignments
    const winExports = content.matchAll(/window\.(\w+)\s*=/g);
    for (const m of winExports) exports.push('window.' + m[1]);

    return exports;
  }

  function categorizeFile(path, content) {
    const name = path.split('/').pop().toLowerCase();
    if (name.includes('server') || name.includes('api') || content.includes('createServer') || content.includes('app.listen')) return 'server';
    if (name.includes('route') || content.includes('router.')) return 'router';
    if (name.includes('model') || name.includes('schema') || content.includes('mongoose.model') || content.includes('CREATE TABLE')) return 'model';
    if (name.includes('test') || name.includes('spec') || content.includes('describe(') || content.includes('test(')) return 'test';
    if (name.endsWith('.css') || name.endsWith('.scss')) return 'style';
    if (name.endsWith('.html')) return 'template';
    if (name.includes('util') || name.includes('helper')) return 'utility';
    if (name.includes('config') || name.includes('.env')) return 'config';
    if (name.includes('middleware') || content.includes('(req, res, next)')) return 'middleware';
    return 'module';
  }

  function generateMermaidDiagram(architecture) {
    const { nodes, edges, entryPoints } = architecture;
    let mermaid = 'flowchart TD\n';

    const typeStyles = {
      server: ':::server',
      router: ':::router',
      model: ':::model',
      style: ':::style',
      template: ':::template',
      test: ':::test',
      utility: ':::utility',
      config: ':::config',
      middleware: ':::middleware',
      module: ':::module',
    };

    const typeIcons = {
      server: '🖥️',
      router: '🔀',
      model: '📦',
      style: '🎨',
      template: '📄',
      test: '🧪',
      utility: '🔧',
      config: '⚙️',
      middleware: '🔗',
      module: '📁',
    };

    // Create node IDs
    const nodeIds = {};
    let counter = 0;
    Object.keys(nodes).forEach(path => {
      nodeIds[path] = `n${counter++}`;
      const node = nodes[path];
      const icon = typeIcons[node.type] || '📁';
      const label = `${icon} ${node.name}`;
      const isEntry = entryPoints.includes(path);
      if (isEntry) {
        mermaid += `  ${nodeIds[path]}[["${label}"]]\n`;
      } else {
        mermaid += `  ${nodeIds[path]}["${label}"]\n`;
      }
    });

    // Create edges (deduplicate)
    const seenEdges = new Set();
    edges.forEach(e => {
      const fromId = nodeIds[e.from];
      // Find matching node for the target
      const toNode = Object.keys(nodes).find(p => p === e.to || p.endsWith('/' + e.to) || p.endsWith(e.to + '.js') || p.endsWith(e.to + '.ts'));
      const toId = toNode ? nodeIds[toNode] : null;
      if (fromId && toId) {
        const key = `${fromId}-${toId}`;
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          mermaid += `  ${fromId} --> ${toId}\n`;
        }
      }
    });

    // Add styles
    mermaid += '\n  classDef server fill:#1e3a5f,stroke:#60a5fa,color:#93c5fd\n';
    mermaid += '  classDef template fill:#4a2040,stroke:#f472b6,color:#fbcfe8\n';
    mermaid += '  classDef style fill:#3b2065,stroke:#a78bfa,color:#c4b5fd\n';
    mermaid += '  classDef model fill:#1e4030,stroke:#34d399,color:#6ee7b7\n';
    mermaid += '  classDef test fill:#4a3f10,stroke:#fbbf24,color:#fde68a\n';
    mermaid += '  classDef module fill:#1e293b,stroke:#475569,color:#94a3b8\n';

    // Apply styles
    Object.keys(nodes).forEach(path => {
      const node = nodes[path];
      const id = nodeIds[path];
      if (typeStyles[node.type]) {
        mermaid += `  class ${id} ${node.type}\n`;
      }
    });

    return mermaid;
  }

  // Show architecture modal
  async function showArchitectureVisualizer() {
    let modal = document.getElementById('archVisualizerModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'archVisualizerModal';
      modal.className = 'modal-backdrop studio-modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 800px; max-height: 85vh;">
          <div class="modal-header">
            <div class="mh-title"><span style="font-size: 18px;">🗺️</span><h3>Architecture Visualizer</h3></div>
            <button type="button" class="btn-close-modal" id="closeArchVisBtn">✕</button>
          </div>
          <div class="modal-body" style="overflow: auto; max-height: 65vh;">
            <div id="archVisSummary" style="margin-bottom: 14px;"></div>
            <div id="archVisDiagram" style="background: rgba(0,0,0,0.2); border-radius: 10px; padding: 16px; min-height: 200px; overflow: auto;"></div>
            <details style="margin-top: 12px;">
              <summary style="font-size: 12px; color: var(--text-dim); cursor: pointer;">📝 Raw Mermaid Source</summary>
              <textarea id="archMermaidSource" readonly style="width: 100%; height: 120px; background: rgba(0,0,0,0.3); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: 6px; font-family: var(--font-mono); font-size: 11px; padding: 8px; margin-top: 6px;"></textarea>
            </details>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="closeArchVisBtn2">Close</button>
            <button type="button" class="btn-primary" id="rescanArchBtn">🔄 Rescan</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('#closeArchVisBtn').addEventListener('click', () => { modal.style.display = 'none'; });
      modal.querySelector('#closeArchVisBtn2').addEventListener('click', () => { modal.style.display = 'none'; });
      modal.querySelector('#rescanArchBtn').addEventListener('click', () => { renderArchitecture(); });
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    modal.style.display = 'flex';
    renderArchitecture();
  }

  async function renderArchitecture() {
    const summaryEl = document.getElementById('archVisSummary');
    const diagramEl = document.getElementById('archVisDiagram');
    const sourceEl = document.getElementById('archMermaidSource');

    if (summaryEl) summaryEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-dim);">🔍 Scanning codebase...</div>';
    if (diagramEl) diagramEl.innerHTML = '';

    const arch = await scanArchitecture();
    const nodeCount = Object.keys(arch.nodes).length;
    const edgeCount = arch.edges.length;

    // Summary
    if (summaryEl) {
      const typeList = Object.entries(arch.fileTypes)
        .sort((a, b) => b[1] - a[1])
        .map(([ext, count]) => `<span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 10px; font-size: 11px;">.${ext} (${count})</span>`)
        .join(' ');
      summaryEl.innerHTML = `
        <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--text-dim);">
          <span>📂 ${nodeCount} files scanned</span>
          <span>🔗 ${edgeCount} dependencies found</span>
          <span>🚀 ${arch.entryPoints.length} entry points</span>
        </div>
        <div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;">${typeList}</div>
      `;
    }

    if (nodeCount === 0) {
      if (diagramEl) diagramEl.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-dim);">No code files found in workspace</div>';
      return;
    }

    const mermaid = generateMermaidDiagram(arch);
    if (sourceEl) sourceEl.value = mermaid;

    // Try to render with Mermaid if available, otherwise show source
    if (diagramEl) {
      if (window.mermaid) {
        try {
          const { svg } = await window.mermaid.render('archDiagramSvg', mermaid);
          diagramEl.innerHTML = svg;
        } catch (e) {
          diagramEl.innerHTML = `<pre style="font-size: 11px; color: var(--text-dim); white-space: pre-wrap;">${escapeHtml(mermaid)}</pre>`;
        }
      } else {
        // Load Mermaid dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
        script.onload = async () => {
          window.mermaid.initialize({ startOnLoad: false, theme: 'dark' });
          try {
            const { svg } = await window.mermaid.render('archDiagramSvg', mermaid);
            diagramEl.innerHTML = svg;
          } catch (e) {
            diagramEl.innerHTML = `<pre style="font-size: 11px; color: var(--text-dim); white-space: pre-wrap;">${escapeHtml(mermaid)}</pre>`;
          }
        };
        script.onerror = () => {
          diagramEl.innerHTML = `<pre style="font-size: 11px; color: var(--text-dim); white-space: pre-wrap;">${escapeHtml(mermaid)}</pre>
          <p style="font-size: 11px; color: var(--text-dim); margin-top: 8px;">⚠️ Mermaid library couldn't load. Copy the source above to <a href="https://mermaid.live" target="_blank" style="color: var(--ds-cyan-light);">mermaid.live</a> to visualize.</p>`;
        };
        document.head.appendChild(script);
      }
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.DeepHarnessArchVisualizer = { showArchitectureVisualizer, scanArchitecture, generateMermaidDiagram };
})();
