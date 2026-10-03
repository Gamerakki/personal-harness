// ==========================================================================
// DeepHarness — Smart @ Context Mentions (Enhanced Context Autocomplete)
// ==========================================================================
(function () {
  'use strict';

  // Extend the existing @file autocomplete with @git:diff, @terminal, @tree
  const CONTEXT_TAGS = [
    { tag: '@git:diff', icon: '🔀', label: 'Git Diff (uncommitted changes)', type: 'git-diff' },
    { tag: '@git:status', icon: '📋', label: 'Git Status', type: 'git-status' },
    { tag: '@terminal', icon: '💻', label: 'Last Terminal Output (50 lines)', type: 'terminal' },
    { tag: '@tree', icon: '🌳', label: 'Project File Tree', type: 'tree' },
  ];

  let hooked = false;

  function init() {
    if (hooked) return;
    hooked = true;

    const promptTextarea = document.getElementById('promptTextarea');
    if (!promptTextarea) return;

    // Intercept the existing input handler to add smart mentions
    promptTextarea.addEventListener('input', handleSmartMentionInput);
  }

  function handleSmartMentionInput() {
    const promptTextarea = document.getElementById('promptTextarea');
    if (!promptTextarea) return;

    const val = promptTextarea.value;
    const cursorPos = promptTextarea.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);

    // Match @word pattern at cursor
    const atMatch = textBeforeCursor.match(/@([a-zA-Z0-9_:.\-/]*)$/);
    if (!atMatch) return;

    const query = atMatch[1].toLowerCase();

    // Check if this matches one of our smart context tags
    const matchingTags = CONTEXT_TAGS.filter(t =>
      t.tag.toLowerCase().includes('@' + query) || t.type.includes(query) || t.label.toLowerCase().includes(query)
    );

    if (matchingTags.length === 0) return; // Let the existing @file handler deal with it

    // Check if existing file autocomplete dropdown is showing files
    // We'll inject our smart tags at the top of the dropdown
    injectSmartTagsIntoDropdown(matchingTags, query);
  }

  function injectSmartTagsIntoDropdown(tags, query) {
    const dropdown = document.getElementById('fileAutocompleteDropdown');
    const fadList = document.getElementById('fadList');
    if (!dropdown || !fadList) return;

    // Remove any existing smart tag items
    fadList.querySelectorAll('.fad-smart-tag').forEach(el => el.remove());

    // Insert smart tags at the top
    const firstChild = fadList.firstChild;
    tags.forEach(t => {
      const item = document.createElement('div');
      item.className = 'fad-item fad-smart-tag';
      item.dataset.tagType = t.type;
      item.innerHTML = `
        <span class="fad-item-icon">${t.icon}</span>
        <span class="fad-item-name" style="color: var(--ds-cyan-light);">${t.tag}</span>
        <span class="fad-item-path">${t.label}</span>
      `;
      item.addEventListener('click', () => {
        handleSmartTagSelect(t);
      });
      if (firstChild) {
        fadList.insertBefore(item, firstChild);
      } else {
        fadList.appendChild(item);
      }
    });

    dropdown.style.display = 'block';
  }

  async function handleSmartTagSelect(tag) {
    const promptTextarea = document.getElementById('promptTextarea');
    const dropdown = document.getElementById('fileAutocompleteDropdown');
    if (dropdown) dropdown.style.display = 'none';

    // Replace @query with the tag
    if (promptTextarea) {
      promptTextarea.value = promptTextarea.value.replace(/@[a-zA-Z0-9_:.\-/]*$/, '').trimEnd();
    }

    // Fetch context and attach it
    let contextContent = '';
    let contextName = tag.tag;

    try {
      switch (tag.type) {
        case 'git-diff': {
          const res = await fetch('/api/git/status');
          const data = await res.json();
          if (data.diff) {
            contextContent = data.diff;
          } else if (data.status) {
            contextContent = data.status;
          } else {
            contextContent = '(No uncommitted changes)';
          }
          break;
        }
        case 'git-status': {
          const res = await fetch('/api/git/status');
          const data = await res.json();
          contextContent = data.status || JSON.stringify(data, null, 2);
          break;
        }
        case 'terminal': {
          const termConsole = document.getElementById('terminalConsole');
          if (termConsole) {
            const lines = Array.from(termConsole.querySelectorAll('.terminal-log-line'))
              .slice(-50)
              .map(el => el.textContent)
              .join('\n');
            contextContent = lines || '(Terminal is empty)';
          } else {
            contextContent = '(Terminal not available)';
          }
          break;
        }
        case 'tree': {
          const res = await fetch('/api/workspace/files-list');
          const data = await res.json();
          const files = data.files || [];
          contextContent = buildTreeString(files);
          break;
        }
      }
    } catch (err) {
      contextContent = `(Error fetching ${tag.type}: ${err.message})`;
    }

    // Add to attached context
    if (window.state && window.state.attachedContextFiles) {
      // Remove existing same-type attachment
      window.state.attachedContextFiles = window.state.attachedContextFiles.filter(f => f.path !== contextName);
      window.state.attachedContextFiles.push({
        name: contextName,
        path: contextName,
        content: contextContent,
      });
      if (typeof renderContextTags === 'function') renderContextTags();
      if (typeof showToast === 'function') showToast(`📎 Attached ${contextName} to prompt context`, 'info');
    }

    if (promptTextarea) {
      promptTextarea.value = promptTextarea.value.trimEnd() + ' ';
      promptTextarea.focus();
    }
  }

  function buildTreeString(files) {
    if (!files || files.length === 0) return '(Empty workspace)';
    // Build a simple indented tree
    const lines = [];
    const maxFiles = 200;
    const sorted = files.slice(0, maxFiles).sort((a, b) => a.path.localeCompare(b.path));
    sorted.forEach(f => {
      const depth = (f.path.match(/\//g) || []).length;
      const indent = '  '.repeat(depth);
      const icon = f.isDirectory ? '📁' : '📄';
      lines.push(`${indent}${icon} ${f.name}`);
    });
    if (files.length > maxFiles) {
      lines.push(`... and ${files.length - maxFiles} more files`);
    }
    return lines.join('\n');
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 300);
  }

  window.DeepHarnessSmartMentions = { init, CONTEXT_TAGS };
})();
