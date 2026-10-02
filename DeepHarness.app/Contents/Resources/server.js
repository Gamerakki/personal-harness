const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const { execFile, execSync } = require('node:child_process');

const PORT = process.env.PORT || 4173;
const HOME_DIR = process.env.HOME || require('node:os').homedir();
const DATA_DIR = path.join(HOME_DIR, '.deepharness', 'data');
const EXPORT_DIR = path.join(__dirname, 'exported_code');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

let globalPreviewTimestamp = Date.now();
const terminalSessions = new Map();

// Initialize SQLite database
const dbPath = path.join(DATA_DIR, 'harness.db');
const db = new DatabaseSync(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    system_prompt TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    total_prompt_tokens INTEGER DEFAULT 0,
    total_completion_tokens INTEGER DEFAULT 0,
    total_cache_hit_tokens INTEGER DEFAULT 0,
    total_cache_miss_tokens INTEGER DEFAULT 0,
    total_cost_cny REAL DEFAULT 0,
    total_cost_usd REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    reasoning_content TEXT,
    prompt_cache_hit_tokens INTEGER DEFAULT 0,
    prompt_cache_miss_tokens INTEGER DEFAULT 0,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_cny REAL DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    filename TEXT NOT NULL,
    language TEXT,
    code TEXT NOT NULL,
    saved_path TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS models (
    id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    name TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (id, provider_id),
    FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE CASCADE
  );
`);

// Migration: ensure messages table has model column
try {
  db.exec('ALTER TABLE messages ADD COLUMN model TEXT;');
} catch (_) {}

// Seed & Ensure Default Providers and Models (DeepSeek, OpenRouter, Z.ai, OpenAI, Groq, Ollama)
const DEFAULT_PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    base_url: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-reasoner', name: 'deepseek-reasoner (R1 Thinking)' },
      { id: 'deepseek-chat', name: 'deepseek-chat (V4.1 Coder)' }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'deepseek/deepseek-r1', name: 'OpenRouter: DeepSeek R1' },
      { id: 'deepseek/deepseek-chat', name: 'OpenRouter: DeepSeek V3' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'OpenRouter: Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', name: 'OpenRouter: OpenAI GPT-4o' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'OpenRouter: Llama 3.3 70B' }
    ]
  },
  {
    id: 'zai',
    name: 'Z.ai (GLM)',
    base_url: 'https://api.z.ai/api/paas/v4',
    models: [
      { id: 'glm-4-plus', name: 'Z.ai: GLM-4-Plus (Flagship)' },
      { id: 'glm-4-flash', name: 'Z.ai: GLM-4-Flash (Fast & Free)' },
      { id: 'glm-4-long', name: 'Z.ai: GLM-4-Long (1M Context)' },
      { id: 'codegeex-4', name: 'Z.ai: CodeGeeX-4 (Coding Expert)' }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', name: 'OpenAI: GPT-4o' },
      { id: 'gpt-4o-mini', name: 'OpenAI: GPT-4o-mini' },
      { id: 'o1-preview', name: 'OpenAI: o1 Reasoning' },
      { id: 'o3-mini', name: 'OpenAI: o3-mini' }
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Groq: Llama 3.3 70B' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'Groq: DeepSeek R1 Distill 70B' }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    base_url: 'http://localhost:11434/v1',
    models: []
  }
];

const seedNow = Date.now();
for (const dp of DEFAULT_PROVIDERS) {
  const existing = db.prepare('SELECT id, base_url, api_key FROM providers WHERE id = ?').get(dp.id);
  if (!existing) {
    const initKey = dp.id === 'deepseek' ? getSetting('deepseek_api_key', '') : '';
    db.prepare('INSERT INTO providers (id, name, base_url, api_key, created_at) VALUES (?, ?, ?, ?, ?)').run(
      dp.id, dp.name, dp.base_url, initKey, seedNow
    );
  } else if (!existing.base_url) {
    db.prepare('UPDATE providers SET base_url = ? WHERE id = ?').run(dp.base_url, dp.id);
  }

  for (const m of dp.models) {
    db.prepare('INSERT OR IGNORE INTO models (id, provider_id, name, created_at) VALUES (?, ?, ?, ?)').run(
      m.id, dp.id, m.name, seedNow
    );
  }
}

// Model Pricing Registry (Per 1 Million Tokens)
// Official DeepSeek pricing:
// deepseek-chat: Cache Hit: ¥0.14 / $0.02 | Cache Miss: ¥1.00 / $0.14 | Output: ¥2.00 / $0.28
// deepseek-reasoner: Cache Hit: ¥0.14 / $0.14 | Cache Miss: ¥1.00 / $0.55 | Output: ¥2.19 / $2.19 (or ¥8.00 / $2.19 peak)
const PRICING = {
  'deepseek-chat': {
    name: 'DeepSeek-V4.1 (Chat)',
    cny: { cacheHit: 0.14, cacheMiss: 1.00, output: 2.00 },
    usd: { cacheHit: 0.02, cacheMiss: 0.14, output: 0.28 }
  },
  'deepseek-flash': {
    name: 'DeepSeek-Flash',
    cny: { cacheHit: 0.14, cacheMiss: 1.00, output: 2.00 },
    usd: { cacheHit: 0.02, cacheMiss: 0.14, output: 0.28 }
  },
  'deepseek-reasoner': {
    name: 'DeepSeek-R1 (Reasoner)',
    cny: { cacheHit: 0.14, cacheMiss: 1.00, output: 2.19 },
    usd: { cacheHit: 0.14, cacheMiss: 0.55, output: 2.19 }
  },
  'gpt-4o': {
    name: 'OpenAI GPT-4o',
    cny: { cacheHit: 9.00, cacheMiss: 18.00, output: 72.00 },
    usd: { cacheHit: 1.25, cacheMiss: 2.50, output: 10.00 }
  },
  'claude-3-5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    cny: { cacheHit: 2.15, cacheMiss: 21.50, output: 107.00 },
    usd: { cacheHit: 0.30, cacheMiss: 3.00, output: 15.00 }
  }
};

function calculateCost(model, cacheHitTokens, cacheMissTokens, completionTokens) {
  const p = PRICING[model] || PRICING['deepseek-chat'];
  const hit = cacheHitTokens || 0;
  const miss = cacheMissTokens || 0;
  const comp = completionTokens || 0;

  const costCny = (hit * p.cny.cacheHit + miss * p.cny.cacheMiss + comp * p.cny.output) / 1_000_000;
  const costUsd = (hit * p.usd.cacheHit + miss * p.usd.cacheMiss + comp * p.usd.output) / 1_000_000;

  // Calculate money saved through prompt caching!
  const savedCny = (hit * (p.cny.cacheMiss - p.cny.cacheHit)) / 1_000_000;
  const savedUsd = (hit * (p.usd.cacheMiss - p.usd.cacheHit)) / 1_000_000;

  return {
    costCny: Number(costCny.toFixed(6)),
    costUsd: Number(costUsd.toFixed(6)),
    savedCny: Number(savedCny.toFixed(6)),
    savedUsd: Number(savedUsd.toFixed(6))
  };
}

// Active SSE abort controllers map: streamId -> AbortController
const activeStreams = new Map();

// Helper to get setting
function getSetting(key, defaultValue = '') {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}

// Helper to set setting
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// Helper to get the correct GitHub Authorization header value
// Classic tokens (ghp_) use "token <token>", fine-grained (github_pat_) use "Bearer <token>"
function getGitHubAuthHeader(token) {
  if (token.startsWith('ghp_') || token.startsWith('gho_') || token.startsWith('ghu_') || token.startsWith('ghs_') || token.startsWith('ghr_')) {
    return `token ${token}`;
  }
  return `Bearer ${token}`;
}

// Ensure default settings exist
if (!getSetting('active_model')) setSetting('active_model', 'deepseek-reasoner');
if (!getSetting('deepseek_endpoint')) setSetting('deepseek_endpoint', 'https://api.deepseek.com');
if (!getSetting('currency_display')) setSetting('currency_display', 'both');

// Workspace & Git Helpers
function getWorkspaceRoot() {
  const custom = getSetting('workspace_root');
  if (custom && fs.existsSync(custom)) return custom;
  const homeDir = process.env.HOME || require('node:os').homedir();
  const desktop = path.join(homeDir, 'Desktop');
  const personalHarness = path.join(desktop, 'personal harness');
  if (fs.existsSync(personalHarness)) {
    setSetting('workspace_root', personalHarness);
    return personalHarness;
  }
  if (fs.existsSync(desktop)) {
    setSetting('workspace_root', desktop);
    return desktop;
  }
  setSetting('workspace_root', homeDir);
  return homeDir;
}

function runGit(args, cwd = getWorkspaceRoot()) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return resolve({ success: false, error: (stderr || err.message).trim(), code: err.code, stdout: (stdout || '').trim() });
      }
      resolve({ success: true, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

// MIME types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// Request Parser Helper
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('Body payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    // API Routes
    if (pathname.startsWith('/api/')) {
      // 1. Check DeepSeek Account Balance
      if (pathname === '/api/balance' && method === 'GET') {
        let apiKey = req.headers.authorization?.replace(/^Bearer\s+/i, '') || getSetting('deepseek_api_key');
        if (!apiKey) {
          return sendJson(res, 200, {
            is_available: false,
            configured: false,
            error: 'No DeepSeek API key configured'
          });
        }

        const endpoint = getSetting('deepseek_endpoint', 'https://api.deepseek.com');
        try {
          const balanceRes = await fetch(`${endpoint}/user/balance`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(6000)
          });

          if (!balanceRes.ok) {
            const errText = await balanceRes.text();
            return sendJson(res, balanceRes.status, {
              is_available: false,
              configured: true,
              error: `DeepSeek API returned error ${balanceRes.status}: ${errText}`
            });
          }

          const balanceData = await balanceRes.json();
          // Extract balance info
          const info = balanceData.balance_infos?.[0] || {};
          return sendJson(res, 200, {
            is_available: balanceData.is_available ?? true,
            configured: true,
            currency: info.currency || 'CNY',
            total_balance: info.total_balance || '0.00',
            granted_balance: info.granted_balance || '0.00',
            topped_up_balance: info.topped_up_balance || '0.00',
            raw: balanceData,
            fetched_at: Date.now()
          });
        } catch (apiErr) {
          return sendJson(res, 502, {
            is_available: false,
            configured: true,
            error: `Failed to connect to DeepSeek API: ${apiErr.message}`
          });
        }
      }

      // 2. Settings: GET and POST
      if (pathname === '/api/settings' && method === 'GET') {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        for (const row of rows) {
          if (row.key === 'deepseek_api_key' && row.value) {
            // Mask API key for safety in UI
            settings[row.key] = row.value;
            settings.deepseek_api_key_masked = row.value.slice(0, 7) + '...' + row.value.slice(-4);
          } else {
            settings[row.key] = row.value;
          }
        }
        return sendJson(res, 200, settings);
      }

      if (pathname === '/api/settings' && method === 'POST') {
        const body = await parseJsonBody(req);
        const protectedKeys = ['github_token', 'github_user'];
        for (const [key, value] of Object.entries(body)) {
          if (protectedKeys.includes(key)) continue; // Managed by /api/github/login & /logout
          setSetting(key, String(value));
        }
        return sendJson(res, 200, { success: true });
      }

      // 3. Sessions (Conversations)
      if (pathname === '/api/sessions' && method === 'GET') {
        const sessions = db.prepare(`
          SELECT s.*, COUNT(m.id) as message_count
          FROM sessions s
          LEFT JOIN messages m ON s.id = m.session_id
          GROUP BY s.id
          ORDER BY s.updated_at DESC
        `).all();
        return sendJson(res, 200, sessions);
      }

      if (pathname === '/api/sessions' && method === 'POST') {
        const body = await parseJsonBody(req);
        const id = body.id || crypto.randomUUID();
        const now = Date.now();
        const title = body.title || 'New DeepSeek Session';
        const model = body.model || getSetting('active_model', 'deepseek-reasoner');
        const systemPrompt = body.system_prompt || '';

        db.prepare(`
          INSERT INTO sessions (id, title, model, system_prompt, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, title, model, systemPrompt, now, now);

        const newSession = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
        return sendJson(res, 201, newSession);
      }

      if (pathname.startsWith('/api/sessions/') && method === 'GET') {
        const id = pathname.split('/')[3];
        const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
        if (!session) return sendJson(res, 404, { error: 'Session not found' });
        
        const messages = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(id);
        const snippets = db.prepare('SELECT * FROM snippets WHERE session_id = ? ORDER BY created_at DESC').all(id);
        return sendJson(res, 200, { session, messages, snippets });
      }

      if (pathname.startsWith('/api/sessions/') && method === 'DELETE') {
        const id = pathname.split('/')[3];
        db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
        db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
        return sendJson(res, 200, { success: true });
      }

      if (pathname.startsWith('/api/sessions/') && (method === 'PATCH' || method === 'PUT')) {
        const id = pathname.split('/')[3];
        const body = await parseJsonBody(req);
        if (body.title) {
          db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?').run(body.title, Date.now(), id);
        }
        if (body.system_prompt !== undefined) {
          db.prepare('UPDATE sessions SET system_prompt = ?, updated_at = ? WHERE id = ?').run(body.system_prompt, Date.now(), id);
        }
        if (body.model) {
          db.prepare('UPDATE sessions SET model = ?, updated_at = ? WHERE id = ?').run(body.model, Date.now(), id);
        }
        return sendJson(res, 200, { success: true });
      }

      // 4. Code Snippet Vault & Workspace File Export
      if (pathname === '/api/snippets/export' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { sessionId, filename, language, code } = body;
        if (!code) return sendJson(res, 400, { error: 'Code content required' });

        const safeFilename = (filename || `snippet_${Date.now()}.${language || 'txt'}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const targetPath = path.join(EXPORT_DIR, safeFilename);
        
        fs.writeFileSync(targetPath, code, 'utf-8');

        const snippetId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO snippets (id, session_id, filename, language, code, saved_path, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(snippetId, sessionId || null, safeFilename, language || 'text', code, targetPath, Date.now());

        return sendJson(res, 200, {
          success: true,
          snippetId,
          filename: safeFilename,
          saved_path: targetPath,
          size_bytes: Buffer.byteLength(code, 'utf-8')
        });
      }

      if (pathname === '/api/snippets' && method === 'GET') {
        const snippets = db.prepare('SELECT * FROM snippets ORDER BY created_at DESC').all();
        return sendJson(res, 200, snippets);
      }

      // 4b. Workspace Files & File Tree
      if (pathname === '/api/workspace/config' && method === 'GET') {
        const root = getWorkspaceRoot();
        const gitCheck = await runGit(['rev-parse', '--is-inside-work-tree'], root);
        return sendJson(res, 200, {
          root,
          isGitRepo: gitCheck.success && gitCheck.stdout === 'true',
          has_github_token: Boolean(getSetting('github_token'))
        });
      }

      if (pathname === '/api/workspace/config' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (body.root) {
          const resolved = path.resolve(body.root);
          if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            setSetting('workspace_root', resolved);
          } else {
            return sendJson(res, 400, { error: 'Specified path is not a valid directory' });
          }
        }
        // github_token is managed exclusively by /api/github/login & /logout
        return sendJson(res, 200, {
          success: true,
          root: getWorkspaceRoot(),
          has_github_token: Boolean(getSetting('github_token'))
        });
      }

      if (pathname === '/api/workspace/pick-folder' && method === 'POST') {
        execFile('osascript', ['-e', 'POSIX path of (choose folder with prompt "Select Project Folder for DeepHarness Studio")'], async (err, stdout) => {
          if (err) {
            // User cancelled folder picker dialog
            return sendJson(res, 200, { canceled: true });
          }
          const chosen = (stdout || '').trim();
          if (chosen && fs.existsSync(chosen) && fs.statSync(chosen).isDirectory()) {
            setSetting('workspace_root', chosen);
            const gitCheck = await runGit(['rev-parse', '--is-inside-work-tree'], chosen);
            return sendJson(res, 200, {
              success: true,
              root: chosen,
              isGitRepo: gitCheck.success && gitCheck.stdout === 'true'
            });
          }
          return sendJson(res, 400, { error: 'Invalid directory selected' });
        });
        return;
      }

      if (pathname === '/api/workspace/create-project' && method === 'POST') {
        const body = await parseJsonBody(req);
        let { name, parentDir, template = 'web', initGit = true } = body;
        if (!name || !name.trim()) {
          return sendJson(res, 400, { error: 'Project name is required' });
        }
        const safeName = name.trim().replace(/[^a-zA-Z0-9._-]/g, '-');
        const baseDir = parentDir && fs.existsSync(parentDir) ? path.resolve(parentDir) : getWorkspaceRoot();
        const projectPath = path.join(baseDir, safeName);

        if (fs.existsSync(projectPath)) {
          return sendJson(res, 400, { error: `Directory "${safeName}" already exists in ${baseDir}` });
        }

        try {
          fs.mkdirSync(projectPath, { recursive: true });

          if (template === 'web') {
            fs.writeFileSync(path.join(projectPath, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeName}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <header class="hero">
      <div class="badge">🚀 Modern Web App</div>
      <h1>Welcome to <span>${safeName}</span></h1>
      <p>Built with modern HTML5, CSS3, and JavaScript — ready for DeepHarness AI Studio.</p>
      <div class="actions">
        <button id="counterBtn" class="btn primary">Clicks: <span id="count">0</span></button>
        <a href="https://github.com" target="_blank" class="btn ghost">GitHub ↗</a>
      </div>
    </header>

    <section class="features">
      <div class="card">
        <h3>⚡ Fast & Lightweight</h3>
        <p>Zero build step required. Runs instantly in any modern browser.</p>
      </div>
      <div class="card">
        <h3>🎨 Clean Design</h3>
        <p>Sleek dark-mode aesthetic with custom typography and CSS variables.</p>
      </div>
      <div class="card">
        <h3>🤖 AI-Powered</h3>
        <p>Edit and iterate seamlessly using DeepSeek in DeepHarness Studio.</p>
      </div>
    </section>
  </div>
  <script src="app.js"></script>
</body>
</html>
`);

            fs.writeFileSync(path.join(projectPath, 'style.css'), `:root {
  --bg: #090b10;
  --surface: #131722;
  --surface-hover: #1a2030;
  --border: #222938;
  --accent: #38bdf8;
  --text: #f1f5f9;
  --text-dim: #94a3b8;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}

.container { max-width: 860px; width: 100%; }

.hero {
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(180deg, rgba(56, 189, 248, 0.08) 0%, transparent 100%);
  border: 1px solid var(--border);
  border-radius: 16px;
  margin-bottom: 30px;
}

.badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: rgba(56, 189, 248, 0.12);
  padding: 4px 12px;
  border-radius: 999px;
  margin-bottom: 16px;
}

h1 { font-size: 36px; font-weight: 800; margin-bottom: 12px; }
h1 span { color: var(--accent); }
p { color: var(--text-dim); line-height: 1.6; }

.actions { display: flex; gap: 12px; justify-content: center; margin-top: 24px; }
.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  border: 1px solid transparent;
}
.btn.primary { background: var(--accent); color: #000; }
.btn.primary:hover { opacity: 0.9; transform: translateY(-1px); }
.btn.ghost { background: var(--surface); color: var(--text); border-color: var(--border); }
.btn.ghost:hover { background: var(--surface-hover); }

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 24px;
  border-radius: 12px;
  transition: transform 0.2s;
}
.card:hover { transform: translateY(-2px); border-color: rgba(56, 189, 248, 0.3); }
.card h3 { font-size: 16px; margin-bottom: 8px; color: var(--text); }
.card p { font-size: 13px; color: var(--text-dim); }
`);

            fs.writeFileSync(path.join(projectPath, 'app.js'), `// ${safeName} Application Logic
let count = 0;
const counterBtn = document.getElementById('counterBtn');
const countDisplay = document.getElementById('count');

if (counterBtn && countDisplay) {
  counterBtn.addEventListener('click', () => {
    count++;
    countDisplay.textContent = count;
  });
}

console.log('🚀 ${safeName} initialized!');
`);

            fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${safeName}

A modern web application built with HTML, CSS, and JavaScript.

## Getting Started
Open \`index.html\` directly in your browser, or develop in DeepHarness AI Studio.
`);
          } else if (template === 'react') {
            fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
            fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
              name: safeName,
              private: true,
              version: '0.0.1',
              type: 'module',
              scripts: {
                dev: 'vite',
                build: 'vite build',
                preview: 'vite preview'
              },
              dependencies: {
                react: '^18.3.1',
                'react-dom': '^18.3.1'
              },
              devDependencies: {
                '@vitejs/plugin-react': '^4.3.1',
                vite: '^5.4.0'
              }
            }, null, 2));

            fs.writeFileSync(path.join(projectPath, 'vite.config.js'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`);

            fs.writeFileSync(path.join(projectPath, 'index.html'), `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`);

            fs.writeFileSync(path.join(projectPath, 'src', 'main.jsx'), `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`);

            fs.writeFileSync(path.join(projectPath, 'src', 'App.jsx'), `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app-container">
      <header className="hero">
        <span className="badge">⚛️ React + Vite</span>
        <h1>Welcome to <span>${safeName}</span></h1>
        <p>High-performance React application scaffolded with DeepHarness AI Studio.</p>
        <button onClick={() => setCount(c => c + 1)} className="btn primary">
          Count is: {count}
        </button>
      </header>
    </div>
  );
}
`);

            fs.writeFileSync(path.join(projectPath, 'src', 'index.css'), `:root {
  --bg: #090b10;
  --accent: #38bdf8;
  --text: #f1f5f9;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
.app-container { text-align: center; max-width: 600px; padding: 20px; }
.badge { color: var(--accent); font-weight: 600; font-size: 13px; }
h1 span { color: var(--accent); }
.btn {
  background: var(--accent);
  color: #000;
  border: none;
  padding: 10px 20px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 16px;
}
`);

            fs.writeFileSync(path.join(projectPath, '.gitignore'), `node_modules\ndist\n.DS_Store\n`);
            fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${safeName}\n\nReact + Vite app.\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`);
          } else if (template === 'node') {
            fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({
              name: safeName,
              version: '1.0.0',
              main: 'server.js',
              scripts: {
                start: 'node server.js',
                dev: 'node --watch server.js'
              },
              dependencies: {
                express: '^4.19.2',
                cors: '^2.8.5',
                dotenv: '^16.4.5'
              }
            }, null, 2));

            fs.writeFileSync(path.join(projectPath, 'server.js'), `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: '${safeName}', uptime: process.uptime() });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from ${safeName} Backend API!' });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running at http://localhost:\${PORT}\`);
});
`);

            fs.writeFileSync(path.join(projectPath, '.env.example'), `PORT=3000\n`);
            fs.writeFileSync(path.join(projectPath, '.gitignore'), `node_modules\n.env\n.DS_Store\n`);
            fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${safeName}\n\nNode.js Express REST API.\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`);
          } else if (template === 'python') {
            fs.writeFileSync(path.join(projectPath, 'main.py'), `"""
${safeName} — Starter Application
"""

def main():
    print("🚀 Welcome to ${safeName}!")
    print("Built and managed with DeepHarness AI Studio.")

if __name__ == "__main__":
    main()
`);
            fs.writeFileSync(path.join(projectPath, 'requirements.txt'), `# Add your Python dependencies here\n`);
            fs.writeFileSync(path.join(projectPath, '.gitignore'), `__pycache__/\n*.py[cod]\n.venv/\nvenv/\n.env\n.DS_Store\n`);
            fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${safeName}\n\nPython application.\n\n\`\`\`bash\npython3 main.py\n\`\`\`\n`);
          } else {
            // Blank
            fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${safeName}\n\nCreated with DeepHarness AI Studio.\n`);
            fs.writeFileSync(path.join(projectPath, '.gitignore'), `.DS_Store\nnode_modules/\n`);
          }

          let isGit = false;
          if (initGit !== false) {
            await runGit(['init'], projectPath);
            await runGit(['branch', '-M', 'main'], projectPath);
            await runGit(['add', '-A'], projectPath);
            await runGit(['commit', '-m', `Initial commit: scaffold ${template} app via DeepHarness`], projectPath);
            isGit = true;
          }

          setSetting('workspace_root', projectPath);

          return sendJson(res, 200, {
            success: true,
            root: projectPath,
            name: safeName,
            isGitRepo: isGit,
            template
          });
        } catch (err) {
          console.error('Failed to create project:', err);
          return sendJson(res, 500, { error: `Failed to create project: ${err.message}` });
        }
      }

      if (pathname === '/api/workspace/tree' && method === 'GET') {
        const root = getWorkspaceRoot();
        const reqPath = parsedUrl.searchParams.get('path') || '';
        const targetDir = path.resolve(root, reqPath);
        if (!targetDir.startsWith(root)) {
          return sendJson(res, 403, { error: 'Access denied: Path outside workspace' });
        }
        if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
          return sendJson(res, 404, { error: 'Directory not found' });
        }

        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        const items = [];
        const ignored = new Set(['.git', 'node_modules', '.DS_Store', '.system_generated', 'dist', '.gemini']);

        for (const entry of entries) {
          if (ignored.has(entry.name)) continue;
          const fullPath = path.join(targetDir, entry.name);
          const relPath = path.relative(root, fullPath);
          const isDir = entry.isDirectory();
          let size = 0;
          try {
            if (!isDir) size = fs.statSync(fullPath).size;
          } catch (e) {}

          items.push({
            name: entry.name,
            path: relPath,
            isDirectory: isDir,
            size,
            ext: isDir ? '' : path.extname(entry.name).toLowerCase()
          });
        }

        items.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        return sendJson(res, 200, { root, currentPath: reqPath, items });
      }

      if (pathname === '/api/workspace/file' && method === 'GET') {
        const root = getWorkspaceRoot();
        const reqPath = parsedUrl.searchParams.get('path') || '';
        if (!reqPath) return sendJson(res, 400, { error: 'Path query param required' });

        const fullPath = path.resolve(root, reqPath);
        if (!fullPath.startsWith(root)) {
          return sendJson(res, 403, { error: 'Access denied: Path outside workspace' });
        }
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
          return sendJson(res, 404, { error: 'File not found' });
        }

        const stat = fs.statSync(fullPath);
        if (stat.size > 5 * 1024 * 1024) {
          return sendJson(res, 400, { error: 'File exceeds 5MB size limit for text editing' });
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        return sendJson(res, 200, {
          path: reqPath,
          fullPath,
          content,
          size: stat.size,
          ext: path.extname(fullPath).toLowerCase()
        });
      }

      if (pathname === '/api/workspace/file' && method === 'POST') {
        const root = getWorkspaceRoot();
        const body = await parseJsonBody(req);
        const { path: reqPath, content } = body;
        if (!reqPath || content === undefined) {
          return sendJson(res, 400, { error: 'path and content required' });
        }

        const fullPath = path.resolve(root, reqPath);
        if (!fullPath.startsWith(root)) {
          return sendJson(res, 403, { error: 'Access denied: Path outside workspace' });
        }

        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf-8');

        return sendJson(res, 200, {
          success: true,
          path: reqPath,
          bytes: Buffer.byteLength(content, 'utf-8')
        });
      }

      if (pathname === '/api/workspace/create' && method === 'POST') {
        const root = getWorkspaceRoot();
        const body = await parseJsonBody(req);
        const { path: reqPath, type = 'file' } = body;
        if (!reqPath) return sendJson(res, 400, { error: 'Path required' });

        const fullPath = path.resolve(root, reqPath);
        if (!fullPath.startsWith(root)) {
          return sendJson(res, 403, { error: 'Access denied: Path outside workspace' });
        }

        if (type === 'dir') {
          fs.mkdirSync(fullPath, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          if (!fs.existsSync(fullPath)) fs.writeFileSync(fullPath, '', 'utf-8');
        }

        return sendJson(res, 200, { success: true, path: reqPath });
      }

      // Fast recursive file scanner for @file context autocomplete
      if (pathname === '/api/workspace/files-list' && method === 'GET') {
        const root = getWorkspaceRoot();
        const files = [];
        const ignored = new Set(['.git', 'node_modules', 'dist', '.DS_Store', '.system_generated', '.gemini', '__pycache__', '.venv', '.turbo', '.next']);

        function walk(dir, rel = '') {
          if (files.length >= 2000) return;
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (ignored.has(entry.name)) continue;
              const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                files.push({ name: entry.name, path: entryRel, isDirectory: true });
                walk(fullPath, entryRel);
              } else {
                let size = 0;
                try { size = fs.statSync(fullPath).size; } catch (e) {}
                files.push({ name: entry.name, path: entryRel, isDirectory: false, size });
              }
            }
          } catch (e) {}
        }

        walk(root);
        return sendJson(res, 200, { root, files });
      }

      // Multi-file agentic applier
      if (pathname === '/api/workspace/apply-files' && method === 'POST') {
        const root = getWorkspaceRoot();
        const body = await parseJsonBody(req);
        const { files = [] } = body;
        if (!Array.isArray(files) || files.length === 0) {
          return sendJson(res, 400, { error: 'Files array required' });
        }

        const modified = [];
        for (const item of files) {
          if (!item.path || item.content === undefined) continue;
          const fullPath = path.resolve(root, item.path);
          if (!fullPath.startsWith(root)) continue;

          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, item.content, 'utf-8');
          modified.push(item.path);
        }

        globalPreviewTimestamp = Date.now();
        return sendJson(res, 200, { success: true, count: modified.length, files: modified });
      }

      // In-Studio Live Preview Server
      if (pathname.startsWith('/api/workspace/preview')) {
        const root = getWorkspaceRoot();
        let subPath = decodeURIComponent(pathname.replace(/^\/api\/workspace\/preview\/?/, ''));
        if (!subPath || subPath === '') subPath = 'index.html';
        const targetFile = path.resolve(root, subPath);

        if (!targetFile.startsWith(root)) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          return res.end('Access denied: Path outside workspace');
        }

        let finalPath = targetFile;
        if (fs.existsSync(targetFile) && fs.statSync(targetFile).isDirectory()) {
          finalPath = path.join(targetFile, 'index.html');
        }

        if (fs.existsSync(finalPath) && fs.statSync(finalPath).isFile()) {
          const ext = path.extname(finalPath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';

          if (ext === '.html') {
            let html = fs.readFileSync(finalPath, 'utf-8');
            const liveScript = `
<script>
(function() {
  let lastCheck = ${globalPreviewTimestamp};
  setInterval(async () => {
    try {
      const res = await fetch('/api/workspace/preview-timestamp');
      const data = await res.json();
      if (data.timestamp > lastCheck) {
        lastCheck = data.timestamp;
        window.location.reload();
      }
    } catch(e) {}
  }, 1000);
})();
</script>`;
            html = html.includes('</body>') ? html.replace('</body>', `${liveScript}</body>`) : html + liveScript;
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            return res.end(html);
          }

          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          });
          return fs.createReadStream(finalPath).pipe(res);
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><style>body{background:#0b0f19;color:#94a3b8;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}h2{color:#f8fafc;margin-bottom:8px;font-size:18px;}p{font-size:13px;color:#64748b;max-width:360px;line-height:1.5;}code{background:#1e293b;color:#38bdf8;padding:2px 6px;border-radius:4px;}</style></head>
            <body>
              <div>
                <h2>No Static HTML Entry Found</h2>
                <p>Create an <code>index.html</code> in this project folder, or run a dev server (e.g. <code>http://localhost:5173</code>) and enter the URL in the address bar above.</p>
              </div>
            </body>
            </html>
          `);
        }
      }

      if (pathname === '/api/workspace/preview-timestamp' && method === 'GET') {
        return sendJson(res, 200, { timestamp: globalPreviewTimestamp });
      }

      // 4b-iii. Integrated Terminal & Command Runner
      if (pathname === '/api/terminal/run' && method === 'POST') {
        const root = getWorkspaceRoot();
        const body = await parseJsonBody(req);
        const { command } = body;
        if (!command || !command.trim()) {
          return sendJson(res, 400, { error: 'Command required' });
        }

        const id = crypto.randomUUID();
        const cleanCmd = command.trim();

        const proc = require('node:child_process').spawn('/bin/zsh', ['-l', '-c', cleanCmd], {
          cwd: root,
          env: {
            ...process.env,
            PATH: `/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
            FORCE_COLOR: '1'
          }
        });

        const session = {
          id,
          command: cleanCmd,
          process: proc,
          buffer: [],
          isRunning: true,
          exitCode: null,
          errorOutput: '',
          listeners: new Set(),
          startTime: Date.now()
        };

        const appendLog = (type, text) => {
          const entry = { type, text, time: Date.now() };
          session.buffer.push(entry);
          if (session.buffer.length > 2000) session.buffer.shift();
          if (type === 'stderr') session.errorOutput += text;
          for (const listener of session.listeners) {
            try { listener(entry); } catch (e) {}
          }
        };

        appendLog('info', `▶ [Terminal] ${cleanCmd}\n`);

        proc.stdout.on('data', (chunk) => appendLog('stdout', chunk.toString('utf-8')));
        proc.stderr.on('data', (chunk) => appendLog('stderr', chunk.toString('utf-8')));

        proc.on('close', (code) => {
          session.isRunning = false;
          session.exitCode = code;
          if (code === 0) {
            appendLog('info', `\n✓ Process finished (code 0)\n`);
          } else {
            appendLog('error', `\n✗ Process exited with code ${code}\n`);
          }
        });

        proc.on('error', (err) => {
          session.isRunning = false;
          appendLog('error', `\n✗ Process error: ${err.message}\n`);
        });

        terminalSessions.set(id, session);
        return sendJson(res, 200, { id, command: cleanCmd, isRunning: true });
      }

      if (pathname === '/api/terminal/stream' && method === 'GET') {
        const id = parsedUrl.searchParams.get('id');
        const session = terminalSessions.get(id);
        if (!session) {
          return sendJson(res, 404, { error: 'Terminal session not found' });
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        // Send existing buffer
        for (const entry of session.buffer) {
          res.write(`data: ${JSON.stringify(entry)}\n\n`);
        }

        const listener = (entry) => {
          res.write(`data: ${JSON.stringify(entry)}\n\n`);
        };

        session.listeners.add(listener);

        req.on('close', () => {
          session.listeners.delete(listener);
        });
        return;
      }

      if (pathname === '/api/terminal/kill' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { id } = body;
        const session = terminalSessions.get(id);
        if (session && session.isRunning && session.process) {
          try {
            session.process.kill('SIGTERM');
            setTimeout(() => {
              if (session.isRunning) {
                try { session.process.kill('SIGKILL'); } catch (e) {}
              }
            }, 1000);
          } catch (e) {}
          return sendJson(res, 200, { success: true });
        }
        return sendJson(res, 200, { success: true, message: 'Process not running' });
      }

      if (pathname === '/api/terminal/status' && method === 'GET') {
        const id = parsedUrl.searchParams.get('id');
        const session = terminalSessions.get(id);
        if (!session) return sendJson(res, 404, { error: 'Session not found' });
        return sendJson(res, 200, {
          id: session.id,
          command: session.command,
          isRunning: session.isRunning,
          exitCode: session.exitCode,
          hasError: session.exitCode !== null && session.exitCode !== 0,
          errorOutput: session.errorOutput.slice(-3000)
        });
      }

      // 4c. Git & GitHub Operations
      if (pathname === '/api/git/status' && method === 'GET') {
        const root = getWorkspaceRoot();
        const isRepoCheck = await runGit(['rev-parse', '--is-inside-work-tree'], root);
        if (!isRepoCheck.success || isRepoCheck.stdout !== 'true') {
          return sendJson(res, 200, { isRepo: false, root });
        }

        const branchRes = await runGit(['branch', '--show-current'], root);
        const branch = branchRes.stdout || 'main';

        const remoteRes = await runGit(['remote', 'get-url', 'origin'], root);
        const remoteUrl = remoteRes.success ? remoteRes.stdout : '';

        // Extract GitHub owner/repo if origin is github.com
        let githubRepo = null;
        if (remoteUrl) {
          const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/i);
          if (match) {
            githubRepo = { owner: match[1], repo: match[2] };
          }
        }

        const statusRes = await runGit(['status', '--porcelain', '-b'], root);
        const lines = statusRes.stdout ? statusRes.stdout.split('\n') : [];
        const files = [];
        let branchInfo = '';

        for (const line of lines) {
          if (line.startsWith('##')) {
            branchInfo = line.slice(2).trim();
          } else if (line.trim()) {
            const code = line.slice(0, 2).trim();
            const filePath = line.slice(3).trim();
            files.push({ status: code, path: filePath });
          }
        }

        return sendJson(res, 200, {
          isRepo: true,
          root,
          branch,
          branchInfo,
          remoteUrl,
          githubRepo,
          files,
          clean: files.length === 0
        });
      }

      if (pathname === '/api/git/init' && method === 'POST') {
        const root = getWorkspaceRoot();
        const resInit = await runGit(['init'], root);
        if (!resInit.success) return sendJson(res, 500, { error: resInit.error });
        return sendJson(res, 200, { success: true, message: resInit.stdout });
      }

      if (pathname === '/api/git/branches' && method === 'GET') {
        const root = getWorkspaceRoot();
        const branchRes = await runGit(['branch', '--list'], root);
        if (!branchRes.success) {
          return sendJson(res, 200, { current: 'main', branches: ['main'] });
        }
        const lines = branchRes.stdout ? branchRes.stdout.split('\n') : [];
        let current = '';
        const branches = [];
        for (const l of lines) {
          const trimmed = l.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('*')) {
            const name = trimmed.slice(1).trim();
            current = name;
            branches.push(name);
          } else {
            branches.push(trimmed);
          }
        }
        return sendJson(res, 200, { current: current || 'main', branches: branches.length ? branches : ['main'] });
      }

      if (pathname === '/api/git/checkout' && method === 'POST') {
        const root = getWorkspaceRoot();
        const body = await parseJsonBody(req);
        const { branch } = body;
        if (!branch) return sendJson(res, 400, { error: 'Branch name required' });
        const resCheckout = await runGit(['checkout', branch.trim()], root);
        if (!resCheckout.success) return sendJson(res, 400, { error: resCheckout.error });
        return sendJson(res, 200, { success: true, branch: branch.trim(), message: resCheckout.stdout });
      }

      if (pathname === '/api/git/branch' && method === 'POST') {
        const root = getWorkspaceRoot();
        const body = await parseJsonBody(req);
        const { name, checkout = true } = body;
        if (!name) return sendJson(res, 400, { error: 'Branch name required' });
        const cleanName = name.trim().replace(/\s+/g, '-');
        const args = checkout !== false ? ['checkout', '-b', cleanName] : ['branch', cleanName];
        const resBranch = await runGit(args, root);
        if (!resBranch.success) return sendJson(res, 400, { error: resBranch.error });
        return sendJson(res, 200, { success: true, branch: cleanName });
      }

      if (pathname === '/api/git/branch/delete' && method === 'POST') {
        const root = getWorkspaceRoot();
        const body = await parseJsonBody(req);
        const { name, force = false } = body;
        if (!name) return sendJson(res, 400, { error: 'Branch name required' });
        const flag = force ? '-D' : '-d';
        const resDel = await runGit(['branch', flag, name.trim()], root);
        if (!resDel.success) return sendJson(res, 400, { error: resDel.error });
        return sendJson(res, 200, { success: true, message: resDel.stdout });
      }

      if (pathname === '/api/git/remote' && method === 'POST') {
        const root = getWorkspaceRoot();
        const body = await parseJsonBody(req);
        const { url } = body;
        if (!url) return sendJson(res, 400, { error: 'Remote URL required' });
        const checkRemote = await runGit(['remote', 'get-url', 'origin'], root);
        let resRemote;
        if (checkRemote.success) {
          resRemote = await runGit(['remote', 'set-url', 'origin', url.trim()], root);
        } else {
          resRemote = await runGit(['remote', 'add', 'origin', url.trim()], root);
        }
        if (!resRemote.success) return sendJson(res, 400, { error: resRemote.error });
        return sendJson(res, 200, { success: true, remoteUrl: url.trim() });
      }

      if (pathname === '/api/git/pull' && method === 'POST') {
        const root = getWorkspaceRoot();
        const resPull = await runGit(['pull'], root);
        if (!resPull.success) return sendJson(res, 500, { error: resPull.error });
        return sendJson(res, 200, { success: true, message: resPull.stdout });
      }

      if (pathname === '/api/git/diff' && method === 'GET') {
        const root = getWorkspaceRoot();
        const reqFile = parsedUrl.searchParams.get('file') || '';
        const args = ['diff'];
        if (reqFile) args.push('--', reqFile);
        const resDiff = await runGit(args, root);
        return sendJson(res, 200, { diff: resDiff.stdout || '(No unstaged diff)' });
      }

      if (pathname === '/api/git/commit' && method === 'POST') {
        const root = getWorkspaceRoot();
        const body = await parseJsonBody(req);
        const { message } = body;
        if (!message || !message.trim()) return sendJson(res, 400, { error: 'Commit message required' });

        const addRes = await runGit(['add', '-A'], root);
        if (!addRes.success) return sendJson(res, 500, { error: addRes.error });

        const commitRes = await runGit(['commit', '-m', message.trim()], root);
        if (!commitRes.success) return sendJson(res, 500, { error: commitRes.error });

        return sendJson(res, 200, { success: true, message: commitRes.stdout });
      }

      if (pathname === '/api/git/push' && method === 'POST') {
        const root = getWorkspaceRoot();
        const branchRes = await runGit(['branch', '--show-current'], root);
        const branch = branchRes.stdout || 'main';
        const token = getSetting('github_token');

        let pushRes = await runGit(['push', '-u', 'origin', branch], root);

        // If push failed and token is available, attempt token-authenticated push to origin
        if (!pushRes.success && token) {
          const remoteRes = await runGit(['remote', 'get-url', 'origin'], root);
          if (remoteRes.success && remoteRes.stdout.includes('github.com')) {
            const match = remoteRes.stdout.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/i);
            if (match) {
              const authUrl = `https://${token}@github.com/${match[1]}/${match[2]}.git`;
              pushRes = await runGit(['push', '-u', authUrl, branch], root);
            }
          }
        }

        if (!pushRes.success) return sendJson(res, 500, { error: pushRes.error });
        return sendJson(res, 200, { success: true, message: pushRes.stdout });
      }

      if (pathname === '/api/git/ai-commit' && method === 'POST') {
        const root = getWorkspaceRoot();
        const diffRes = await runGit(['diff', 'HEAD'], root);
        const statusRes = await runGit(['status', '--porcelain'], root);
        const diffText = (diffRes.stdout || statusRes.stdout || '').slice(0, 4000);

        if (!diffText.trim()) {
          return sendJson(res, 200, { commitMessage: 'chore: minor updates' });
        }

        const apiKey = getSetting('deepseek_api_key') || process.env.DEEPSEEK_API_KEY;
        const endpoint = getSetting('deepseek_endpoint', 'https://api.deepseek.com');

        try {
          const aiReq = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert developer. Generate a single-line conventional commit message (max 72 chars, e.g. "feat: add user authentication" or "fix: resolve token calculation bug"). Return ONLY the commit message with no markdown, quotes, or explanations.'
                },
                {
                  role: 'user',
                  content: `Generate a commit message for this diff:\n${diffText}`
                }
              ],
              temperature: 0.3,
              max_tokens: 50
            })
          });

          if (aiReq.ok) {
            const data = await aiReq.json();
            const msg = data.choices?.[0]?.message?.content?.trim() || 'feat: update workspace files';
            return sendJson(res, 200, { commitMessage: msg.replace(/^["'`]|["'`]$/g, '') });
          }
        } catch (e) {
          console.error('AI commit msg generation failed:', e);
        }

        return sendJson(res, 200, { commitMessage: 'feat: update workspace files' });
      }

      if (pathname === '/api/github/create-repo' && method === 'POST') {
        const root = getWorkspaceRoot();
        const body = await parseJsonBody(req);
        const { name, description = '', isPrivate = false, autoPush = true, token: customToken } = body;
        const token = customToken || getSetting('github_token');

        if (!token) {
          return sendJson(res, 400, { error: 'GitHub Personal Access Token required. Set it in Settings or Git pane.' });
        }
        if (!name || !name.trim()) {
          return sendJson(res, 400, { error: 'Repository name required' });
        }

        const repoName = name.trim().replace(/[^a-zA-Z0-9._-]/g, '-');

        try {
          const dbToken = getSetting('github_token');
          console.log(`[create-repo] customToken: ${customToken ? customToken.substring(0, 8) + '...' : 'none'}`);
          console.log(`[create-repo] dbToken: ${dbToken ? dbToken.substring(0, 8) + '...' : 'none'} (type: ${typeof dbToken})`);
          console.log(`[create-repo] resolved token: ${token ? token.substring(0, 8) + '...' : 'none'} (type: ${typeof token})`);
          const ghRes = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: {
              'Authorization': getGitHubAuthHeader(token),
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'User-Agent': 'DeepHarness-Desktop'
            },
            body: JSON.stringify({
              name: repoName,
              description: description.trim(),
              private: !!isPrivate,
              auto_init: false
            })
          });

          const ghData = await ghRes.json();
          if (!ghRes.ok) {
            console.error(`[create-repo] GitHub API error ${ghRes.status}:`, JSON.stringify(ghData));
            return sendJson(res, ghRes.status, {
              error: ghData.message || 'GitHub repo creation failed',
              errors: ghData.errors
            });
          }

          const cloneUrl = ghData.clone_url;
          const htmlUrl = ghData.html_url;
          const fullName = ghData.full_name;

          // 1. Ensure local folder is initialized as git repo
          const checkWorkTree = await runGit(['rev-parse', '--is-inside-work-tree'], root);
          if (!checkWorkTree.success || checkWorkTree.stdout !== 'true') {
            await runGit(['init'], root);
            await runGit(['branch', '-M', 'main'], root);
          }

          // 2. Set remote origin using token for initial push
          const authRemoteUrl = `https://${token}@github.com/${fullName}.git`;
          const checkOrigin = await runGit(['remote', 'get-url', 'origin'], root);
          if (checkOrigin.success) {
            await runGit(['remote', 'set-url', 'origin', authRemoteUrl], root);
          } else {
            await runGit(['remote', 'add', 'origin', authRemoteUrl], root);
          }

          // 3. If autoPush requested, commit any changes and push
          let pushWarning = null;
          if (autoPush) {
            const logCheck = await runGit(['rev-parse', 'HEAD'], root);
            if (!logCheck.success) {
              await runGit(['add', '-A'], root);
              await runGit(['commit', '-m', 'Initial commit from DeepHarness'], root);
            }
            const branchRes = await runGit(['branch', '--show-current'], root);
            const currentBranch = branchRes.stdout || 'main';
            const pushRes = await runGit(['push', '-u', 'origin', currentBranch], root);
            if (!pushRes.success) {
              pushWarning = `Repository created on GitHub, but initial push had an issue: ${pushRes.error}`;
            }
          }

          // Set clean origin URL
          await runGit(['remote', 'set-url', 'origin', cloneUrl], root);

          return sendJson(res, 200, {
            success: true,
            repoUrl: htmlUrl,
            cloneUrl,
            fullName,
            warning: pushWarning,
            message: `Created and linked ${fullName} on GitHub!`
          });
        } catch (err) {
          console.error('Error creating GitHub repo:', err);
          return sendJson(res, 500, { error: `Failed to create GitHub repo: ${err.message}` });
        }
      }

      if (pathname === '/api/github/pr' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { title, body: prBody, head, base = 'main', owner, repo, token: customToken } = body;
        const token = customToken || getSetting('github_token');

        if (!token) {
          return sendJson(res, 400, { error: 'GitHub Personal Access Token required. Set it in Settings or Git pane.' });
        }
        if (!title || !head || !owner || !repo) {
          return sendJson(res, 400, { error: 'title, head branch, owner, and repo are required' });
        }

        try {
          const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': getGitHubAuthHeader(token),
              'Accept': 'application/vnd.github+json',
              'User-Agent': 'DeepHarness-Desktop'
            },
            body: JSON.stringify({
              title,
              body: prBody || 'Created seamlessly via DeepHarness AI Studio.',
              head,
              base
            })
          });

          const ghData = await ghRes.json();
          if (!ghRes.ok) {
            return sendJson(res, ghRes.status, {
              error: ghData.message || 'GitHub API returned an error',
              errors: ghData.errors
            });
          }

          return sendJson(res, 200, {
            success: true,
            prUrl: ghData.html_url,
            number: ghData.number,
            title: ghData.title,
            state: ghData.state
          });
        } catch (err) {
          return sendJson(res, 500, { error: `Failed to contact GitHub API: ${err.message}` });
        }
      }

      if (pathname === '/api/github/account' && method === 'GET') {
        const token = getSetting('github_token');
        if (!token) {
          return sendJson(res, 200, { authenticated: false });
        }
        try {
          const ghRes = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': getGitHubAuthHeader(token),
              'User-Agent': 'DeepHarness-Desktop',
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          if (ghRes.ok) {
            const user = await ghRes.json();
            const userData = {
              login: user.login,
              name: user.name || user.login,
              avatar_url: user.avatar_url,
              html_url: user.html_url,
              public_repos: user.public_repos
            };
            setSetting('github_user', JSON.stringify(userData));
            return sendJson(res, 200, { authenticated: true, user: userData });
          } else {
            // Token might be revoked or invalid
            return sendJson(res, 200, { authenticated: false, error: 'GitHub token is no longer valid' });
          }
        } catch (err) {
          // If offline or network issue, fallback to cached user if available
          const cachedUser = getSetting('github_user');
          if (cachedUser) {
            try {
              return sendJson(res, 200, { authenticated: true, user: JSON.parse(cachedUser), offline: true });
            } catch (e) {}
          }
          return sendJson(res, 200, { authenticated: false, error: err.message });
        }
      }

      if (pathname === '/api/github/login' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { token } = body;
        if (!token || !token.trim()) {
          return sendJson(res, 400, { error: 'Personal Access Token required' });
        }
        const cleanToken = token.trim();
        try {
          const ghRes = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': getGitHubAuthHeader(cleanToken),
              'User-Agent': 'DeepHarness-Desktop',
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          if (!ghRes.ok) {
            const errData = await ghRes.json().catch(() => ({}));
            return sendJson(res, 401, {
              error: errData.message || 'Invalid GitHub token. Please verify scopes and token value.'
            });
          }
          const user = await ghRes.json();
          const userData = {
            login: user.login,
            name: user.name || user.login,
            avatar_url: user.avatar_url,
            html_url: user.html_url,
            public_repos: user.public_repos
          };
          setSetting('github_token', cleanToken);
          setSetting('github_user', JSON.stringify(userData));
          return sendJson(res, 200, { success: true, user: userData });
        } catch (err) {
          return sendJson(res, 500, { error: `Authentication failed: ${err.message}` });
        }
      }

      if (pathname === '/api/github/logout' && method === 'POST') {
        db.prepare("DELETE FROM settings WHERE key IN ('github_token', 'github_user')").run();
        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/system/open-external' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { url } = body;
        if (!url) return sendJson(res, 400, { error: 'URL required' });
        execFile('open', [url], (err) => {
          if (err) console.error('Failed to open external url:', err);
        });
        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/system/restart' && method === 'POST') {
        sendJson(res, 200, { success: true, message: 'Server restarting...' });
        setTimeout(() => {
          process.exit(0);
        }, 150);
        return;
      }

      // 5. Global Stats & Token Efficiency Overview
      if (pathname === '/api/stats/overview' && method === 'GET') {
        const stats = db.prepare(`
          SELECT 
            COUNT(DISTINCT s.id) as total_sessions,
            COUNT(m.id) as total_messages,
            SUM(m.prompt_cache_hit_tokens) as total_cache_hit_tokens,
            SUM(m.prompt_cache_miss_tokens) as total_cache_miss_tokens,
            SUM(m.prompt_tokens) as total_prompt_tokens,
            SUM(m.completion_tokens) as total_completion_tokens,
            SUM(m.total_tokens) as total_tokens,
            SUM(m.cost_cny) as total_cost_cny,
            SUM(m.cost_usd) as total_cost_usd
          FROM sessions s
          LEFT JOIN messages m ON s.id = m.session_id
        `).get();

        const hit = stats.total_cache_hit_tokens || 0;
        const miss = stats.total_cache_miss_tokens || 0;
        const promptTotal = (hit + miss) || (stats.total_prompt_tokens || 0);
        const cacheHitRate = promptTotal > 0 ? (hit / promptTotal) * 100 : 0;

        // Estimated savings from cache hit
        const savedCny = (hit * (1.00 - 0.14)) / 1_000_000;
        const savedUsd = (hit * (0.14 - 0.02)) / 1_000_000;

        return sendJson(res, 200, {
          ...stats,
          cache_hit_rate: Number(cacheHitRate.toFixed(1)),
          saved_cny: Number(savedCny.toFixed(5)),
          saved_usd: Number(savedUsd.toFixed(5)),
          models_available: Object.keys(PRICING)
        });
      }

      // 6. Providers & Models Management
      if (pathname === '/api/providers' && method === 'GET') {
        const providers = db.prepare(`
          SELECT p.*, COUNT(m.id) as model_count
          FROM providers p
          LEFT JOIN models m ON p.id = m.provider_id
          GROUP BY p.id
          ORDER BY p.name ASC
        `).all();
        return sendJson(res, 200, providers);
      }

      if (pathname === '/api/providers' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { id, name, base_url, api_key } = body;
        if (!id || !name || !base_url) {
          return sendJson(res, 400, { error: 'id, name, and base_url are required' });
        }
        db.prepare(`
          INSERT INTO providers (id, name, base_url, api_key, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            base_url = excluded.base_url,
            api_key = CASE WHEN excluded.api_key != '' THEN excluded.api_key ELSE providers.api_key END
        `).run(id, name, base_url, api_key || '', Date.now());

        if (id === 'deepseek' && api_key) {
          setSetting('deepseek_api_key', api_key);
          setSetting('deepseek_endpoint', base_url);
        }

        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/models' && method === 'GET') {
        const models = db.prepare(`
          SELECT m.*, p.name as provider_name, p.base_url
          FROM models m
          JOIN providers p ON m.provider_id = p.id
          ORDER BY p.name ASC, m.id ASC
        `).all();
        return sendJson(res, 200, models);
      }

      // Auto-Fetch Models from Provider's /models endpoint
      if (pathname === '/api/models/fetch' && method === 'POST') {
        const body = await parseJsonBody(req);
        const providerId = body.provider_id || 'deepseek';
        const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(providerId);

        let baseUrl = body.base_url || provider?.base_url || 'https://api.deepseek.com';
        let apiKey = body.api_key || provider?.api_key || (providerId === 'deepseek' ? getSetting('deepseek_api_key') : '');

        let modelsUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        if (providerId === 'ollama') {
          modelsUrl = modelsUrl.replace(/\/v1$/, '') + '/api/tags';
        } else if (!modelsUrl.endsWith('/models')) {
          modelsUrl += '/models';
        }

        try {
          const headers = { 'Accept': 'application/json' };
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }
          if (providerId === 'openrouter') {
            headers['HTTP-Referer'] = 'https://github.com/deepharness';
            headers['X-Title'] = 'DeepHarness';
          }

          const fetchRes = await fetch(modelsUrl, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(12000)
          });
          if (!fetchRes.ok) {
            const errText = await fetchRes.text();
            return sendJson(res, fetchRes.status, {
              success: false,
              error: `Provider ${providerId} returned error ${fetchRes.status}: ${errText}`
            });
          }

          const data = await fetchRes.json();
          let rawModels = [];

          if (Array.isArray(data.data)) {
            rawModels = data.data.map(m => ({ id: m.id || m.name, name: m.name || m.id }));
          } else if (Array.isArray(data.models)) {
            rawModels = data.models.map(m => ({ id: m.name || m.model || m.id, name: m.name || m.id }));
          } else if (Array.isArray(data)) {
            rawModels = data.map(m => ({ id: typeof m === 'string' ? m : (m.id || m.name), name: typeof m === 'string' ? m : (m.name || m.id) }));
          }

          if (rawModels.length === 0) {
            return sendJson(res, 200, { success: true, count: 0, models: [], message: 'No models found' });
          }

          const insertStmt = db.prepare('INSERT OR REPLACE INTO models (id, provider_id, name, created_at) VALUES (?, ?, ?, ?)');
          const now = Date.now();
          for (const m of rawModels) {
            if (m.id) {
              insertStmt.run(String(m.id), providerId, String(m.name || m.id), now);
            }
          }

          const updatedModels = db.prepare('SELECT * FROM models WHERE provider_id = ?').all(providerId);
          return sendJson(res, 200, {
            success: true,
            provider_id: providerId,
            count: updatedModels.length,
            models: updatedModels
          });
        } catch (fetchErr) {
          return sendJson(res, 502, {
            success: false,
            error: `Failed to fetch models from ${modelsUrl}: ${fetchErr.message}`
          });
        }
      }

      // 7. Abort Active Chat Stream (Prevents Token Wastage)
      if (pathname === '/api/chat/abort' && method === 'POST') {
        const body = await parseJsonBody(req);
        const streamId = body.streamId;
        if (streamId && activeStreams.has(streamId)) {
          const controller = activeStreams.get(streamId);
          controller.abort();
          activeStreams.delete(streamId);
          return sendJson(res, 200, { success: true, aborted: streamId });
        }
        return sendJson(res, 200, { success: true, message: 'Stream already terminated or not found' });
      }

      // 7. Streaming Chat Completions (SSE proxy with token tracking and R1 reasoning support)
      if (pathname === '/api/chat/stream' && method === 'POST') {
        const body = await parseJsonBody(req);
        const {
          sessionId,
          model = 'deepseek-reasoner',
          messages = [],
          temperature = 0.6,
          max_tokens = 8192,
          system_prompt = ''
        } = body;

        // Resolve Provider & Endpoint for the requested model
        let providerId = 'deepseek';
        const modelRow = db.prepare('SELECT provider_id FROM models WHERE id = ?').get(model);
        if (modelRow) {
          providerId = modelRow.provider_id;
        } else if (model.startsWith('deepseek')) {
          providerId = 'deepseek';
        } else if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
          providerId = 'openai';
        } else if (model.includes('/')) {
          providerId = 'openrouter';
        } else if (model.startsWith('glm') || model.startsWith('codegeex') || model.startsWith('charglm')) {
          providerId = 'zai';
        }

        const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(providerId);
        let endpoint = provider ? provider.base_url : getSetting('deepseek_endpoint', 'https://api.deepseek.com');
        let apiKey = provider?.api_key || (providerId === 'deepseek' ? getSetting('deepseek_api_key') : '');
        if (!apiKey && providerId === 'deepseek') {
          apiKey = req.headers.authorization?.replace(/^Bearer\s+/i, '');
        }

        if (!apiKey && providerId !== 'ollama') {
          return sendJson(res, 400, { error: `API Key for ${provider?.name || providerId} is required. Please configure it in Settings -> Providers.` });
        }

        let completionsUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
        if (!completionsUrl.endsWith('/chat/completions')) {
          completionsUrl += '/chat/completions';
        }

        const targetSessionId = sessionId || crypto.randomUUID();
        const startTime = Date.now();

        // Ensure session exists in SQLite to prevent FOREIGN KEY constraint error
        const sessionExists = db.prepare('SELECT id FROM sessions WHERE id = ?').get(targetSessionId);
        if (!sessionExists) {
          const firstMsg = messages.find(m => m.role === 'user')?.content || 'New Chat';
          let title = 'New Chat';
          if (typeof firstMsg === 'string') {
            title = firstMsg.slice(0, 30).trim() || 'New Chat';
          } else if (Array.isArray(firstMsg)) {
            const textPart = firstMsg.find(p => p.type === 'text')?.text;
            title = (textPart || 'Image Chat').slice(0, 30).trim() || 'Image Chat';
          }
          db.prepare(`
            INSERT INTO sessions (id, title, model, system_prompt, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(targetSessionId, title, model, system_prompt || '', startTime, startTime);
        }

        const streamId = crypto.randomUUID();
        const userMessageId = crypto.randomUUID();
        const assistantMessageId = crypto.randomUUID();

        // Save incoming user message to SQLite immediately
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
          const contentToSave = typeof lastUserMsg.content === 'string'
            ? lastUserMsg.content
            : JSON.stringify(lastUserMsg.content);
          db.prepare(`
            INSERT INTO messages (id, session_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(userMessageId, targetSessionId, 'user', contentToSave, startTime);
        }

        // Prepare conversation payload for LLM
        const fullMessages = [];
        let cleanPrompt = (system_prompt || '').replace(/You are DeepSeek R1 acting as/gi, 'You are').trim();
        cleanPrompt += `\n[Environment Context: Current active model is "${model}". Provider is "${provider?.name || providerId}". If the user asks what model you are, state this exact model name.]`;
        fullMessages.push({ role: 'system', content: cleanPrompt });
        for (const m of messages) {
          fullMessages.push({ role: m.role, content: m.content });
        }

        // Set up AbortController for upstream cancellation
        const abortController = new AbortController();
        activeStreams.set(streamId, abortController);

        // Client disconnected handling
        req.on('close', () => {
          if (activeStreams.has(streamId)) {
            abortController.abort();
            activeStreams.delete(streamId);
          }
        });

        // Setup SSE response headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });
        res.write(`data: ${JSON.stringify({ type: 'start', streamId, assistantMessageId })}\n\n`);

        let fullContent = '';
        let fullReasoning = '';
        let usageData = {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          prompt_cache_hit_tokens: 0,
          prompt_cache_miss_tokens: 0
        };

        try {
          const reqHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          };
          if (apiKey) {
            reqHeaders['Authorization'] = `Bearer ${apiKey}`;
          }
          if (providerId === 'openrouter') {
            reqHeaders['HTTP-Referer'] = 'https://github.com/deepharness';
            reqHeaders['X-Title'] = 'DeepHarness';
          }

          // Send request to LLM Chat Completions
          const upstreamRes = await fetch(completionsUrl, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify({
              model,
              messages: fullMessages,
              temperature: model.includes('reasoner') || model.includes('r1') ? 1.0 : temperature,
              max_tokens,
              stream: true,
              stream_options: {
                include_usage: true
              }
            }),
            signal: abortController.signal
          });

          if (!upstreamRes.ok) {
            const errText = await upstreamRes.text();
            res.write(`data: ${JSON.stringify({ type: 'error', error: `DeepSeek API Error (${upstreamRes.status}): ${errText}` })}\n\n`);
            res.end();
            activeStreams.delete(streamId);
            return;
          }

          const reader = upstreamRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep last partial line

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue; // Keepalive/comment
              if (trimmed === 'data: [DONE]') {
                continue;
              }

              if (trimmed.startsWith('data: ')) {
                const jsonStr = trimmed.slice(6);
                try {
                  const chunk = JSON.parse(jsonStr);
                  const delta = chunk.choices?.[0]?.delta;
                  
                  // 1. DeepSeek R1 reasoning stream chunk
                  if (delta?.reasoning_content) {
                    fullReasoning += delta.reasoning_content;
                    res.write(`data: ${JSON.stringify({ type: 'reasoning', delta: delta.reasoning_content })}\n\n`);
                  }

                  // 2. Final content stream chunk
                  if (delta?.content) {
                    fullContent += delta.content;
                    res.write(`data: ${JSON.stringify({ type: 'content', delta: delta.content })}\n\n`);
                  }

                  // 3. Token usage data chunk (from include_usage)
                  if (chunk.usage) {
                    usageData.prompt_tokens = chunk.usage.prompt_tokens || usageData.prompt_tokens;
                    usageData.completion_tokens = chunk.usage.completion_tokens || usageData.completion_tokens;
                    usageData.total_tokens = chunk.usage.total_tokens || usageData.total_tokens;
                    usageData.prompt_cache_hit_tokens = chunk.usage.prompt_cache_hit_tokens || chunk.usage.prompt_tokens_details?.cached_tokens || 0;
                    usageData.prompt_cache_miss_tokens = chunk.usage.prompt_cache_miss_tokens || (usageData.prompt_tokens - usageData.prompt_cache_hit_tokens);
                  }
                } catch (e) {
                  // Ignore JSON parse error on partial chunks
                }
              }
            }
          }

          // If upstream did not return usage, approximate token usage
          if (usageData.total_tokens === 0) {
            // Rough estimation (~3.8 chars per token for English/code)
            const promptChars = fullMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
            const promptEst = Math.ceil(promptChars / 3.8);
            const compEst = Math.ceil((fullContent.length + fullReasoning.length) / 3.8);
            usageData.prompt_tokens = promptEst;
            usageData.completion_tokens = compEst;
            usageData.total_tokens = promptEst + compEst;
            usageData.prompt_cache_miss_tokens = promptEst;
            usageData.prompt_cache_hit_tokens = 0;
          }

          const latencyMs = Date.now() - startTime;
          const costs = calculateCost(
            model,
            usageData.prompt_cache_hit_tokens,
            usageData.prompt_cache_miss_tokens,
            usageData.completion_tokens
          );

          // Save assistant response and token telemetry into SQLite
          db.prepare(`
            INSERT INTO messages (
              id, session_id, role, model, content, reasoning_content,
              prompt_cache_hit_tokens, prompt_cache_miss_tokens,
              prompt_tokens, completion_tokens, total_tokens,
              cost_cny, cost_usd, latency_ms, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            assistantMessageId, targetSessionId, 'assistant', model, fullContent, fullReasoning,
            usageData.prompt_cache_hit_tokens, usageData.prompt_cache_miss_tokens,
            usageData.prompt_tokens, usageData.completion_tokens, usageData.total_tokens,
            costs.costCny, costs.costUsd, latencyMs, Date.now()
          );

          // Update session aggregate metrics and ensure session model reflects current model
          db.prepare(`
            UPDATE sessions SET
              updated_at = ?,
              model = ?,
              total_prompt_tokens = total_prompt_tokens + ?,
              total_completion_tokens = total_completion_tokens + ?,
              total_cache_hit_tokens = total_cache_hit_tokens + ?,
              total_cache_miss_tokens = total_cache_miss_tokens + ?,
              total_cost_cny = total_cost_cny + ?,
              total_cost_usd = total_cost_usd + ?
            WHERE id = ?
          `).run(
            Date.now(),
            model,
            usageData.prompt_tokens, usageData.completion_tokens,
            usageData.prompt_cache_hit_tokens, usageData.prompt_cache_miss_tokens,
            costs.costCny, costs.costUsd,
            targetSessionId
          );

          // Notify frontend that generation is complete with full telemetry
          res.write(`data: ${JSON.stringify({
            type: 'done',
            messageId: assistantMessageId,
            usage: usageData,
            costs,
            latencyMs
          })}\n\n`);

          res.end();
        } catch (streamErr) {
          if (abortController.signal.aborted) {
            // User aborted the stream: save partial generation to SQLite so code is NOT lost!
            const latencyMs = Date.now() - startTime;
            if (fullContent || fullReasoning) {
              db.prepare(`
                INSERT INTO messages (
                  id, session_id, role, model, content, reasoning_content,
                  latency_ms, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                assistantMessageId, targetSessionId, 'assistant', model, fullContent, fullReasoning,
                latencyMs, Date.now()
              );
            }
            res.write(`data: ${JSON.stringify({ type: 'aborted', message: 'Generation aborted by user.' })}\n\n`);
            res.end();
          } else {
            res.write(`data: ${JSON.stringify({ type: 'error', error: streamErr.message })}\n\n`);
            res.end();
          }
        } finally {
          activeStreams.delete(streamId);
        }
        return;
      }

      return sendJson(res, 404, { error: 'API endpoint not found' });
    }

    // Static File Serving
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '') safePath = '/index.html';

    const filePath = path.join(PUBLIC_DIR, safePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // Fallback to index.html for SPA routes
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        fs.createReadStream(indexPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    }
  } catch (err) {
    console.error('Server error:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 DeepSeek Personal AI Harness running at: http://127.0.0.1:${PORT}`);
  console.log(`💾 SQLite Database connected at: ${dbPath}`);
  console.log(`📂 Code Export Vault at: ${EXPORT_DIR}\n`);
});
