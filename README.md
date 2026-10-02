# 🚀 DeepHarness — DeepSeek AI Engineering Studio for macOS

A robust, zero-token-wastage, native-feeling Mac desktop harness engineered specifically for **DeepSeek** (`deepseek-reasoner` / R1 and `deepseek-chat` / V3) and extensible to other LLMs.

---

## 🌟 Key Capabilities

### 1. 🪙 Live DeepSeek Account Balance Monitor
- Integrates directly with the official DeepSeek User Balance API: `GET https://api.deepseek.com/user/balance`.
- Displays real-time **Total Available Balance**, **Topped-up Paid Balance**, and **Granted Free Balance** in native **CNY (¥)** and **USD ($)**.
- Live refresh button with status indicator so you always know how much money you have left before executing heavy tasks.

### 2. ⚡ Granular Token Telemetry & Cache Efficiency
- **Prompt Cache Hit vs Miss Breakdown**: DeepSeek provides automatic prefix caching. Cache hits cost only **¥0.14 / 1M tokens** vs **¥1.00 / 1M tokens** for cache misses!
- DeepHarness calculates and displays your **Cache Hit Rate (%)** and exact **Money Saved (¥ and $)** on every single response.
- Context window meter monitors conversation size against the context limit to prevent token explosion and huge bills.

### 3. 🧠 DeepSeek R1 Live Reasoning Trace
- Full Server-Sent Events (SSE) streaming for `deepseek-reasoner` (DeepSeek-R1).
- Live glowing amber accordion displays the internal chain-of-thought in real-time with an active thinking stopwatch (`Thinking for 6.4s...`) before streaming the clean final code.

### 4. 🛑 Zero Token Wastage (Instant Abort)
- Prominent **Stop Generation (`Esc`)** button.
- Immediately signals an `AbortController` to the upstream DeepSeek API, halting token generation instantly if the model is straying off course.

### 5. 💾 Zero Code Loss & Code Vault
- **Transactional SQLite Persistence**: Every prompt, completion, thinking trace, token metric, and timestamp is persisted locally in `data/harness.db` using Node.js built-in SQLite (`node:sqlite`).
- **One-Click Workspace Export**: Every generated code block features a **"Save to Disk"** button that writes the file directly into `./exported_code/` on your Mac.
- Built-in **Code Vault Drawer** lets you inspect, copy, or download all generated code files.

---

## 🖥️ Running on macOS

### Option 1: Double-Click (Zero Setup)
Simply double-click the **`start.command`** file in macOS Finder! It will start the background engine and open a dedicated desktop window.

### Option 2: Terminal Launcher
```bash
./harness-desktop.sh
```
This script launches DeepHarness in a standalone macOS app window using Google Chrome's native `--app` window mode (frameless, isolated session, no browser tabs or address bar). If Chrome is not installed, it automatically opens in your default browser.

### Option 3: Standard Node.js
```bash
npm start
```
Then visit `http://127.0.0.1:4173` in your browser.

---

## ⚙️ Quick Setup (DeepSeek API Key)

1. Launch the app using any method above.
2. Click the ⚙️ **Settings** icon in the top right.
3. Paste your DeepSeek API key (format: `sk-...`).
4. Click **"Test Balance Connection"** to verify that your key is valid and check your account balance.
5. Click **"Save Settings"**.

Your API key is stored securely in your local SQLite database (`data/harness.db`) and **never leaves your Mac** except to make requests to `https://api.deepseek.com`.

---

## 📁 Project Architecture

```
personal harness/
├── package.json              # App scripts (npm start, npm run desktop)
├── server.js                 # Zero-dependency HTTP proxy + node:sqlite engine + SSE streamer
├── harness-desktop.sh        # Mac Desktop app launcher
├── start.command             # Finder double-clickable launcher
├── public/
│   ├── index.html            # Studio interface layout & controls
│   ├── style.css             # Dark macOS Sequoia studio theme
│   ├── app.js                # SSE client, balance fetcher, code vault, tokenizer
│   ├── favicon.svg           # Desktop icon
│   └── icons.svg             # UI SVG assets
├── data/
│   └── harness.db            # Local SQLite database (sessions, telemetry, snippets)
└── exported_code/            # Disk vault for saved scripts and source files
```

---

## 💡 Tips to Maximize DeepSeek Prefix Cache Savings

1. **Keep System Prompts First**: DeepSeek caches from the beginning of the prompt in 64-token units. Selecting one of the pre-built Engineering Roles (`Deep Architect`, `High-Speed Coder`, etc.) keeps the prefix identical across turns, yielding up to **86% cost reduction**.
2. **Avoid Prepending Timestamps**: Never put dynamic timestamps at the start of your messages, as that invalidates the cached prefix.
3. **Use the Abort Button**: If a response starts generating code you don't need, hit `Esc` to stop immediately and conserve tokens.
