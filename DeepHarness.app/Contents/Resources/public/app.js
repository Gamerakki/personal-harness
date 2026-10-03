/* ==========================================================================
   DeepHarness — DeepSeek AI Engineering Studio Client Logic
   ========================================================================== */

// System Prompt Presets (Focused on engineering persona without forcing a model identity)
const SYSTEM_PRESETS = {
  'r1-architect': `You are an elite Principal Software Architect and Deep Reasoning Engine.
Before delivering the solution, think through all edge cases, memory models, thread safety, race conditions, time/space complexity, and architecture tradeoffs.
Provide complete, modular, idiomatic code with zero placeholders and zero omissions.`,

  'v3-coder': `You are an elite Senior Staff Engineer.
Write high-performance, production-ready, clean, modular code. Minimize unnecessary fluff and make implementations directly runnable. Ensure high test coverage and clean error handling.`,

  'bug-hunter': `You are an expert Security Researcher & Systems Auditor.
Scrutinize code line-by-line for memory leaks, resource exhaustion, concurrency race conditions, null dereferences, and boundary condition failures. Clearly explain the vulnerability and provide the bulletproof patch.`,

  'token-saver': `You are a Minimalist Token-Saver Engineering Assistant.
Deliver the highest signal-to-noise ratio. Give direct, concise code and technical explanations without conversational preamble. Maximize token efficiency and prefix cache reuse.`
};

// Application State
const state = {
  sessions: [],
  currentSessionId: null,
  currentSession: null,
  activeModel: 'deepseek-reasoner',
  activePresetKey: 'r1-architect',
  systemPrompt: SYSTEM_PRESETS['r1-architect'],
  isStreaming: false,
  activeStreamId: null,
  abortController: null,
  balance: null,
  settings: {},
  thinkingStartTime: 0,
  thinkingTimerInterval: null,
  attachedImage: null,
  executionMode: 'fast',
  studio: {
    activeTab: 'files',
    currentPath: '',
    activeFile: null,
    viewMode: 'editor',
    gitStatus: null
  },
  githubUser: null,
  attachedContextFiles: [],
  terminal: {
    currentId: null,
    eventSource: null,
    isRunning: false,
    lastError: null
  },
  cachedFilesList: [],
  pendingTurnRetry: null,
  selectedQuotaModel: null
};

// DOM Elements
const el = {
  quotaExhaustedModal: document.getElementById('quotaExhaustedModal'),
  closeQuotaModalBtn: document.getElementById('closeQuotaModalBtn'),
  cancelQuotaModalBtn: document.getElementById('cancelQuotaModalBtn'),
  confirmSwitchAndResumeBtn: document.getElementById('confirmSwitchAndResumeBtn'),
  quotaFailedModelName: document.getElementById('quotaFailedModelName'),
  quotaFailedErrorDetail: document.getElementById('quotaFailedErrorDetail'),
  targetResumeModelName: document.getElementById('targetResumeModelName'),
  quotaModelsGrid: document.getElementById('quotaModelsGrid'),
  quickKeyProviderSelect: document.getElementById('quickKeyProviderSelect'),
  quickKeyInput: document.getElementById('quickKeyInput'),
  saveQuickKeyBtn: document.getElementById('saveQuickKeyBtn'),
  modeFastBtn: document.getElementById('modeFastBtn'),
  modeDeepBtn: document.getElementById('modeDeepBtn'),
  modeAutoBtn: document.getElementById('modeAutoBtn'),
  autoModeLabel: document.getElementById('autoModeLabel'),
  personaDropdownBtn: document.getElementById('personaDropdownBtn'),
  personaMenuDropdown: document.getElementById('personaMenuDropdown'),
  personaBtnIcon: document.getElementById('personaBtnIcon'),
  personaBtnLabel: document.getElementById('personaBtnLabel'),
  balanceDisplay: document.getElementById('balanceDisplay'),
  balanceStatusDot: document.getElementById('balanceStatusDot'),
  refreshBalanceBtn: document.getElementById('refreshBalanceBtn'),
  sessionTokensDisplay: document.getElementById('sessionTokensDisplay'),
  sessionCostDisplay: document.getElementById('sessionCostDisplay'),
  cacheRatePercent: document.getElementById('cacheRatePercent'),
  cacheSavingsDisplay: document.getElementById('cacheSavingsDisplay'),
  modelSelector: document.getElementById('modelSelector'),
  activeModelRatePill: document.getElementById('activeModelRatePill'),
  newChatBtn: document.getElementById('newChatBtn'),
  sessionList: document.getElementById('sessionList'),
  sessionCountBadge: document.getElementById('sessionCountBadge'),
  sessionSearchInput: document.getElementById('sessionSearchInput'),
  ltTotalTokens: document.getElementById('ltTotalTokens'),
  ltTotalCost: document.getElementById('ltTotalCost'),
  ltTotalSaved: document.getElementById('ltTotalSaved'),
  activeSessionTitle: document.getElementById('activeSessionTitle'),
  renameSessionBtn: document.getElementById('renameSessionBtn'),
  sessionTitleInputWrapper: document.getElementById('sessionTitleInputWrapper'),
  sessionTitleInput: document.getElementById('sessionTitleInput'),
  saveSessionTitleBtn: document.getElementById('saveSessionTitleBtn'),
  cancelSessionTitleBtn: document.getElementById('cancelSessionTitleBtn'),
  contextGaugeFill: document.getElementById('contextGaugeFill'),
  contextGaugeText: document.getElementById('contextGaugeText'),
  exportSessionBtn: document.getElementById('exportSessionBtn'),
  clearSessionBtn: document.getElementById('clearSessionBtn'),
  deleteSessionModal: document.getElementById('deleteSessionModal'),
  deleteSessionModalTitle: document.getElementById('deleteSessionModalTitle'),
  closeDeleteSessionModalBtn: document.getElementById('closeDeleteSessionModalBtn'),
  cancelDeleteSessionBtn: document.getElementById('cancelDeleteSessionBtn'),
  confirmDeleteSessionBtn: document.getElementById('confirmDeleteSessionBtn'),
  messagesContainer: document.getElementById('messagesContainer'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  messagesFlow: document.getElementById('messagesFlow'),
  abortFloatingBar: document.getElementById('abortFloatingBar'),
  abortGenerationBtn: document.getElementById('abortGenerationBtn'),
  promptTokenMeter: document.getElementById('promptTokenMeter'),
  activePersonaDisplay: document.getElementById('activePersonaDisplay'),
  toggleSystemPromptBtn: document.getElementById('toggleSystemPromptBtn'),
  systemPromptDrawer: document.getElementById('systemPromptDrawer'),
  closeSystemPromptDrawer: document.getElementById('closeSystemPromptDrawer'),
  systemPromptInput: document.getElementById('systemPromptInput'),
  promptTextarea: document.getElementById('promptTextarea'),
  floatingInputCard: document.getElementById('floatingInputCard'),
  attachmentPreviewContainer: document.getElementById('attachmentPreviewContainer'),
  attachmentThumbImg: document.getElementById('attachmentThumbImg'),
  attachmentName: document.getElementById('attachmentName'),
  attachmentSize: document.getElementById('attachmentSize'),
  removeAttachmentBtn: document.getElementById('removeAttachmentBtn'),
  attachImageBtn: document.getElementById('attachImageBtn'),
  imageFileInput: document.getElementById('imageFileInput'),
  sendBtn: document.getElementById('sendBtn'),
  openVaultBtn: document.getElementById('openVaultBtn'),
  vaultCountBadge: document.getElementById('vaultCountBadge'),
  vaultBackdrop: document.getElementById('vaultBackdrop'),
  vaultDrawer: document.getElementById('vaultDrawer'),
  closeVaultBtn: document.getElementById('closeVaultBtn'),
  vaultList: document.getElementById('vaultList'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  settingApiKey: document.getElementById('settingApiKey'),
  toggleApiKeyVisibility: document.getElementById('toggleApiKeyVisibility'),
  settingEndpoint: document.getElementById('settingEndpoint'),
  settingCurrency: document.getElementById('settingCurrency'),
  testConnectionBtn: document.getElementById('testConnectionBtn'),
  diagnosticBox: document.getElementById('diagnosticBox'),
  toastContainer: document.getElementById('toastContainer'),
  fetchModelsBtn: document.getElementById('fetchModelsBtn'),
  tabBtnDeepSeek: document.getElementById('tabBtnDeepSeek'),
  tabBtnProviders: document.getElementById('tabBtnProviders'),
  tabDeepSeek: document.getElementById('tabDeepSeek'),
  tabProviders: document.getElementById('tabProviders'),
  providersList: document.getElementById('providersList'),
  newProvId: document.getElementById('newProvId'),
  newProvName: document.getElementById('newProvName'),
  newProvUrl: document.getElementById('newProvUrl'),
  newProvKey: document.getElementById('newProvKey'),
  addProviderBtn: document.getElementById('addProviderBtn'),
  openEditorBtn: document.getElementById('openEditorBtn'),
  openEditorSidebarBtn: document.getElementById('openEditorSidebarBtn'),
  openEditorChatBtn: document.getElementById('openEditorChatBtn'),
  studioBackdrop: document.getElementById('studioBackdrop'),
  studioDrawer: document.getElementById('studioDrawer'),
  closeStudioBtn: document.getElementById('closeStudioBtn'),
  studioRootBadge: document.getElementById('studioRootBadge'),
  studioRootDisplay: document.getElementById('studioRootDisplay'),
  studioOpenFolderBtn: document.getElementById('studioOpenFolderBtn'),
  studioNewProjectBtn: document.getElementById('studioNewProjectBtn'),
  treeOpenFolderBtn: document.getElementById('treeOpenFolderBtn'),
  treeNewProjectBtn: document.getElementById('treeNewProjectBtn'),
  newProjectModal: document.getElementById('newProjectModal'),
  closeNewProjectModalBtn: document.getElementById('closeNewProjectModalBtn'),
  cancelNewProjectBtn: document.getElementById('cancelNewProjectBtn'),
  confirmNewProjectBtn: document.getElementById('confirmNewProjectBtn'),
  newProjectNameInput: document.getElementById('newProjectNameInput'),
  newProjectParentInput: document.getElementById('newProjectParentInput'),
  browseNewProjectLocationBtn: document.getElementById('browseNewProjectLocationBtn'),
  templateGrid: document.getElementById('templateGrid'),
  newProjectInitGit: document.getElementById('newProjectInitGit'),
  newProjectStatusNotice: document.getElementById('newProjectStatusNotice'),
  openFolderModal: document.getElementById('openFolderModal'),
  closeOpenFolderModalBtn: document.getElementById('closeOpenFolderModalBtn'),
  cancelOpenFolderBtn: document.getElementById('cancelOpenFolderBtn'),
  confirmCustomFolderBtn: document.getElementById('confirmCustomFolderBtn'),
  nativePickFolderModalBtn: document.getElementById('nativePickFolderModalBtn'),
  customFolderPathInput: document.getElementById('customFolderPathInput'),
  openFolderStatusNotice: document.getElementById('openFolderStatusNotice'),
  afbName: document.getElementById('afbName'),
  studioSaveFileBtn: document.getElementById('studioSaveFileBtn'),
  studioTabBtnFiles: document.getElementById('studioTabBtnFiles'),
  studioTabBtnGit: document.getElementById('studioTabBtnGit'),
  studioTabBtnTerminal: document.getElementById('studioTabBtnTerminal'),
  studioGitBadge: document.getElementById('studioGitBadge'),
  studioTermBadge: document.getElementById('studioTermBadge'),
  studioPanelFiles: document.getElementById('studioPanelFiles'),
  studioPanelGit: document.getElementById('studioPanelGit'),
  studioPanelTerminal: document.getElementById('studioPanelTerminal'),
  studioEditorArea: document.getElementById('studioEditorArea'),
  editorViewContainer: document.getElementById('editorViewContainer'),
  previewViewContainer: document.getElementById('previewViewContainer'),
  studioPreviewIframe: document.getElementById('studioPreviewIframe'),
  previewFrameWrapper: document.getElementById('previewFrameWrapper'),
  previewRefreshBtn: document.getElementById('previewRefreshBtn'),
  previewUrlInput: document.getElementById('previewUrlInput'),
  previewDeviceDesktop: document.getElementById('previewDeviceDesktop'),
  previewDeviceTablet: document.getElementById('previewDeviceTablet'),
  previewDeviceMobile: document.getElementById('previewDeviceMobile'),
  previewExternalBtn: document.getElementById('previewExternalBtn'),
  previewMobileQrBtn: document.getElementById('previewMobileQrBtn'),
  studioViewModes: document.getElementById('studioViewModes'),
  svmEditorBtn: document.getElementById('svmEditorBtn'),
  svmSplitBtn: document.getElementById('svmSplitBtn'),
  svmPreviewBtn: document.getElementById('svmPreviewBtn'),
  svmDiffBtn: document.getElementById('svmDiffBtn'),
  btnRunDevServer: document.getElementById('btnRunDevServer'),
  btnRunInstall: document.getElementById('btnRunInstall'),
  btnRunTest: document.getElementById('btnRunTest'),
  btnKillProcess: document.getElementById('btnKillProcess'),
  btnClearTerminal: document.getElementById('btnClearTerminal'),
  terminalAutoFixBanner: document.getElementById('terminalAutoFixBanner'),
  terminalErrorSnippet: document.getElementById('terminalErrorSnippet'),
  btnAutoFixWithAi: document.getElementById('btnAutoFixWithAi'),
  terminalConsole: document.getElementById('terminalConsole'),
  terminalInputCmd: document.getElementById('terminalInputCmd'),
  btnTerminalSubmit: document.getElementById('btnTerminalSubmit'),
  contextTagsContainer: document.getElementById('contextTagsContainer'),
  fileAutocompleteDropdown: document.getElementById('fileAutocompleteDropdown'),
  fadList: document.getElementById('fadList'),
  attachFileContextBtn: document.getElementById('attachFileContextBtn'),
  fileTreeFilter: document.getElementById('fileTreeFilter'),
  treeNewFileBtn: document.getElementById('treeNewFileBtn'),
  treeRefreshBtn: document.getElementById('treeRefreshBtn'),
  fileTreeContainer: document.getElementById('fileTreeContainer'),
  studioHeaderGithubBtn: document.getElementById('studioHeaderGithubBtn'),
  studioArchVisBtn: document.getElementById('studioArchVisBtn'),
  studioSecurityScanBtn: document.getElementById('studioSecurityScanBtn'),
  gitBranchSelect: document.getElementById('gitBranchSelect'),
  gitNewBranchBtn: document.getElementById('gitNewBranchBtn'),
  gitDeleteBranchBtn: document.getElementById('gitDeleteBranchBtn'),
  gitPullBtn: document.getElementById('gitPullBtn'),
  gitRefreshBtn: document.getElementById('gitRefreshBtn'),
  inlineNewBranchCard: document.getElementById('inlineNewBranchCard'),
  closeInlineNewBranchBtn: document.getElementById('closeInlineNewBranchBtn'),
  inlineBranchNameInput: document.getElementById('inlineBranchNameInput'),
  confirmInlineBranchBtn: document.getElementById('confirmInlineBranchBtn'),
  inlineBranchNotice: document.getElementById('inlineBranchNotice'),
  inlineDeleteBranchCard: document.getElementById('inlineDeleteBranchCard'),
  closeInlineDeleteBranchBtn: document.getElementById('closeInlineDeleteBranchBtn'),
  inlineDeleteBranchSelect: document.getElementById('inlineDeleteBranchSelect'),
  inlineDeleteBranchForce: document.getElementById('inlineDeleteBranchForce'),
  confirmInlineDeleteBranchBtn: document.getElementById('confirmInlineDeleteBranchBtn'),
  inlineDeleteBranchNotice: document.getElementById('inlineDeleteBranchNotice'),
  gitRepoBar: document.getElementById('gitRepoBar'),
  ghAccountUnauth: document.getElementById('ghAccountUnauth'),
  ghAccountAuth: document.getElementById('ghAccountAuth'),
  ghUserAvatar: document.getElementById('ghUserAvatar'),
  ghUsername: document.getElementById('ghUsername'),
  openGhSignInBtn: document.getElementById('openGhSignInBtn'),
  inlineGhSignInCard: document.getElementById('inlineGhSignInCard'),
  closeInlineGhSignInBtn: document.getElementById('closeInlineGhSignInBtn'),
  inlineOpenGhTokenBtn: document.getElementById('inlineOpenGhTokenBtn'),
  inlineGhSignInTokenInput: document.getElementById('inlineGhSignInTokenInput'),
  toggleInlineGhSignInVisibility: document.getElementById('toggleInlineGhSignInVisibility'),
  confirmInlineGhSignInBtn: document.getElementById('confirmInlineGhSignInBtn'),
  inlineGhSignInNotice: document.getElementById('inlineGhSignInNotice'),
  ghSignOutBtn: document.getElementById('ghSignOutBtn'),
  ghSignInModal: document.getElementById('ghSignInModal'),
  closeGhSignInModalBtn: document.getElementById('closeGhSignInModalBtn'),
  cancelGhSignInBtn: document.getElementById('cancelGhSignInBtn'),
  confirmGhSignInBtn: document.getElementById('confirmGhSignInBtn'),
  openGhTokenPageBtn: document.getElementById('openGhTokenPageBtn'),
  ghSignInTokenInput: document.getElementById('ghSignInTokenInput'),
  toggleGhSignInTokenVisibility: document.getElementById('toggleGhSignInTokenVisibility'),
  ghSignInNotice: document.getElementById('ghSignInNotice'),
  inlineRepoAuthBadge: document.getElementById('inlineRepoAuthBadge'),
  inlinePublishAsUser: document.getElementById('inlinePublishAsUser'),
  inlineRepoAuthPrompt: document.getElementById('inlineRepoAuthPrompt'),
  inlinePromptSignInBtn: document.getElementById('inlinePromptSignInBtn'),
  inlineRepoTokenGroup: document.getElementById('inlineRepoTokenGroup'),
  gitLinkedState: document.getElementById('gitLinkedState'),
  gitUnlinkedState: document.getElementById('gitUnlinkedState'),
  gitRepoLink: document.getElementById('gitRepoLink'),
  gitEditRemoteBtn: document.getElementById('gitEditRemoteBtn'),
  toggleInlineCreateRepoBtn: document.getElementById('toggleInlineCreateRepoBtn'),
  inlineCreateRepoCard: document.getElementById('inlineCreateRepoCard'),
  closeInlineCreateRepoBtn: document.getElementById('closeInlineCreateRepoBtn'),
  inlineRepoNameInput: document.getElementById('inlineRepoNameInput'),
  inlineRepoDescInput: document.getElementById('inlineRepoDescInput'),
  inlineVisPillPublic: document.getElementById('inlineVisPillPublic'),
  inlineVisPillPrivate: document.getElementById('inlineVisPillPrivate'),
  inlineRepoTokenInput: document.getElementById('inlineRepoTokenInput'),
  toggleInlineGhKeyVisibility: document.getElementById('toggleInlineGhKeyVisibility'),
  inlineRepoAutoPush: document.getElementById('inlineRepoAutoPush'),
  confirmInlineCreateRepoBtn: document.getElementById('confirmInlineCreateRepoBtn'),
  inlineRepoStatusNotice: document.getElementById('inlineRepoStatusNotice'),
  toggleInlineLinkRemoteBtn: document.getElementById('toggleInlineLinkRemoteBtn'),
  inlineLinkRemoteCard: document.getElementById('inlineLinkRemoteCard'),
  closeInlineLinkRemoteBtn: document.getElementById('closeInlineLinkRemoteBtn'),
  inlineRemoteUrlInput: document.getElementById('inlineRemoteUrlInput'),
  confirmInlineLinkRemoteBtn: document.getElementById('confirmInlineLinkRemoteBtn'),
  inlineRemoteNotice: document.getElementById('inlineRemoteNotice'),
  openCreateRepoModalBtn: document.getElementById('openCreateRepoModalBtn'),
  createRepoModal: document.getElementById('createRepoModal'),
  closeCreateRepoModalBtn: document.getElementById('closeCreateRepoModalBtn'),
  cancelCreateRepoBtn: document.getElementById('cancelCreateRepoBtn'),
  confirmCreateRepoBtn: document.getElementById('confirmCreateRepoBtn'),
  newRepoNameInput: document.getElementById('newRepoNameInput'),
  newRepoDescInput: document.getElementById('newRepoDescInput'),
  modalGhTokenInput: document.getElementById('modalGhTokenInput'),
  toggleModalGhKeyVisibility: document.getElementById('toggleModalGhKeyVisibility'),
  visPillPublic: document.getElementById('visPillPublic'),
  visPillPrivate: document.getElementById('visPillPrivate'),
  newRepoAutoPush: document.getElementById('newRepoAutoPush'),
  createRepoStatusNotice: document.getElementById('createRepoStatusNotice'),
  createBranchModal: document.getElementById('createBranchModal'),
  closeCreateBranchModalBtn: document.getElementById('closeCreateBranchModalBtn'),
  cancelCreateBranchBtn: document.getElementById('cancelCreateBranchBtn'),
  confirmCreateBranchBtn: document.getElementById('confirmCreateBranchBtn'),
  newBranchNameInput: document.getElementById('newBranchNameInput'),
  createBranchStatusNotice: document.getElementById('createBranchStatusNotice'),
  deleteBranchModal: document.getElementById('deleteBranchModal'),
  closeDeleteBranchModalBtn: document.getElementById('closeDeleteBranchModalBtn'),
  cancelDeleteBranchBtn: document.getElementById('cancelDeleteBranchBtn'),
  confirmDeleteBranchBtn: document.getElementById('confirmDeleteBranchBtn'),
  deleteBranchSelect: document.getElementById('deleteBranchSelect'),
  deleteBranchForce: document.getElementById('deleteBranchForce'),
  deleteBranchStatusNotice: document.getElementById('deleteBranchStatusNotice'),
  editRemoteModal: document.getElementById('editRemoteModal'),
  closeEditRemoteModalBtn: document.getElementById('closeEditRemoteModalBtn'),
  cancelEditRemoteBtn: document.getElementById('cancelEditRemoteBtn'),
  confirmEditRemoteBtn: document.getElementById('confirmEditRemoteBtn'),
  editRemoteUrlInput: document.getElementById('editRemoteUrlInput'),
  editRemoteStatusNotice: document.getElementById('editRemoteStatusNotice'),
  gitChangedCount: document.getElementById('gitChangedCount'),
  gitChangesList: document.getElementById('gitChangesList'),
  gitAiCommitBtn: document.getElementById('gitAiCommitBtn'),
  gitCommitInput: document.getElementById('gitCommitInput'),
  gitCommitBtn: document.getElementById('gitCommitBtn'),
  gitPushBtn: document.getElementById('gitPushBtn'),
  gitPrTitleInput: document.getElementById('gitPrTitleInput'),
  gitPrBodyInput: document.getElementById('gitPrBodyInput'),
  gitPrBaseDisplay: document.getElementById('gitPrBaseDisplay'),
  gitCreatePrBtn: document.getElementById('gitCreatePrBtn'),
  gitPrResultNotice: document.getElementById('gitPrResultNotice'),
  editorViewContainer: document.getElementById('editorViewContainer'),
  editorLineNumbers: document.getElementById('editorLineNumbers'),
  studioCodeEditor: document.getElementById('studioCodeEditor'),
  editorDirtyIndicator: document.getElementById('editorDirtyIndicator'),
  editorFileLang: document.getElementById('editorFileLang'),
  editorLineColInfo: document.getElementById('editorLineColInfo'),
  editorCharCount: document.getElementById('editorCharCount'),
  editorFileSize: document.getElementById('editorFileSize'),
  diffViewContainer: document.getElementById('diffViewContainer'),
  diffViewerTitle: document.getElementById('diffViewerTitle'),
  applyDiffToFileBtn: document.getElementById('applyDiffToFileBtn'),
  diffCodeDisplay: document.getElementById('diffCodeDisplay'),
  tabBtnGitHub: document.getElementById('tabBtnGitHub'),
  tabGitHub: document.getElementById('tabGitHub'),
  settingWorkspaceRoot: document.getElementById('settingWorkspaceRoot'),
  settingGitHubToken: document.getElementById('settingGitHubToken'),
  toggleGhKeyVisibility: document.getElementById('toggleGhKeyVisibility')
};

// ==========================================================================
// Initialization
// ==========================================================================

async function init() {
  try {
    setupEventListeners();
  } catch (err) {
    console.error('setupEventListeners error:', err);
  }

  // Load all local SQLite & cached configuration data in parallel
  await Promise.allSettled([
    loadSettings(),
    loadModels(),
    loadProviders(),
    loadSessions(),
    loadLifetimeStats(),
    loadSnippets()
  ]);

  // If sessions exist, select first, else create new
  if (state.sessions && state.sessions.length > 0) {
    await selectSession(state.sessions[0].id).catch(err => console.error('selectSession error:', err));
  } else {
    await createNewSession().catch(err => console.error('createNewSession error:', err));
  }

  // Pre-load preset
  setPreset('r1-architect');

  // Background non-blocking network calls (balance & github)
  fetchBalance().catch(err => console.warn('Background balance check error:', err));
  checkGitHubAccount().catch(err => console.warn('Background github check error:', err));
}

// ==========================================================================
// Event Listeners
// ==========================================================================

function setupEventListeners() {
  // Model selector
  if (el.modelSelector) {
    el.modelSelector.addEventListener('change', (e) => {
      state.activeModel = e.target.value;
      updateSessionModel(state.activeModel);
      showToast(`Active Model: ${state.activeModel}`);
    });
  }

  // Balance refresh
  if (el.refreshBalanceBtn) {
    el.refreshBalanceBtn.addEventListener('click', () => {
      fetchBalance(true);
    });
  }

  // New Chat
  if (el.newChatBtn) {
    el.newChatBtn.addEventListener('click', () => createNewSession());
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      createNewSession();
    }
    if ((e.altKey && (e.key === 's' || e.key === 'S')) || ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'E' || e.key === 'e'))) {
      e.preventDefault();
      toggleStudio();
    }
    if (e.key === 'Escape') {
      if (el.deleteSessionModal && el.deleteSessionModal.style.display !== 'none') {
        hideDeleteSessionModal();
        return;
      }
      if (state.studio && state.studio.isOpen) {
        closeStudio();
        return;
      }
      if (state.isStreaming) {
        e.preventDefault();
        abortCurrentStream();
      }
    }
  });

  // Prompt input
  if (el.promptTextarea) {
    el.promptTextarea.addEventListener('input', () => {
      autoResizeTextarea(el.promptTextarea);
      updatePromptTokenEstimate();
    });

    el.promptTextarea.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!state.isStreaming) handleSendMessage();
      }
    });
  }

  if (el.sendBtn) {
    el.sendBtn.addEventListener('click', () => {
      if (!state.isStreaming) handleSendMessage();
    });
  }

  // Stop Generation
  if (el.abortGenerationBtn) {
    el.abortGenerationBtn.addEventListener('click', abortCurrentStream);
  }

  // Preset / Role Buttons
  document.querySelectorAll('.preset-pill, .role-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      setPreset(preset);
      if (el.personaMenuDropdown) {
        el.personaMenuDropdown.style.display = 'none';
        if (el.personaDropdownBtn && el.personaDropdownBtn.parentElement) {
          el.personaDropdownBtn.parentElement.classList.remove('open');
        }
      }
    });
  });

  // Persona Dropdown Toggle & Outside Click Dismiss
  if (el.personaDropdownBtn && el.personaMenuDropdown) {
    el.personaDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isClosed = el.personaMenuDropdown.style.display === 'none' || !el.personaMenuDropdown.style.display;
      el.personaMenuDropdown.style.display = isClosed ? 'flex' : 'none';
      if (el.personaDropdownBtn.parentElement) {
        el.personaDropdownBtn.parentElement.classList.toggle('open', isClosed);
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.persona-dropdown-container')) {
        el.personaMenuDropdown.style.display = 'none';
        if (el.personaDropdownBtn && el.personaDropdownBtn.parentElement) {
          el.personaDropdownBtn.parentElement.classList.remove('open');
        }
      }
    });
  }

  // Execution Mode Quick Switcher (Fast V4.1 vs Deep R1 vs Auto)
  if (el.modeFastBtn) el.modeFastBtn.addEventListener('click', () => setExecutionMode('fast'));
  if (el.modeDeepBtn) el.modeDeepBtn.addEventListener('click', () => setExecutionMode('deep'));
  if (el.modeAutoBtn) el.modeAutoBtn.addEventListener('click', () => setExecutionMode('auto'));

  // Starter Cards
  document.querySelectorAll('.starter-chip, .starter-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      el.promptTextarea.value = prompt;
      autoResizeTextarea(el.promptTextarea);
      updatePromptTokenEstimate();
      el.promptTextarea.focus();
    });
  });

  // System Prompt drawer
  if (el.toggleSystemPromptBtn) {
    el.toggleSystemPromptBtn.addEventListener('click', () => {
      if (!el.systemPromptDrawer) return;
      const isHidden = el.systemPromptDrawer.style.display === 'none';
      el.systemPromptDrawer.style.display = isHidden ? 'block' : 'none';
      if (isHidden && el.systemPromptInput) {
        el.systemPromptInput.value = state.systemPrompt;
        el.systemPromptInput.focus();
      }
    });
  }

  if (el.closeSystemPromptDrawer) {
    el.closeSystemPromptDrawer.addEventListener('click', () => {
      if (el.systemPromptDrawer) el.systemPromptDrawer.style.display = 'none';
    });
  }

  if (el.systemPromptInput) {
    el.systemPromptInput.addEventListener('change', () => {
      state.systemPrompt = el.systemPromptInput.value;
      if (state.currentSessionId) {
        fetch(`/api/sessions/${state.currentSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system_prompt: state.systemPrompt })
        });
      }
    });
  }

  // Session search
  if (el.sessionSearchInput) {
    el.sessionSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      renderSessionList(query);
    });
  }

  // Rename session
  if (el.renameSessionBtn) {
    el.renameSessionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startRenamingSession();
    });
  }
  if (el.activeSessionTitle) {
    el.activeSessionTitle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startRenamingSession();
    });
  }
  if (el.saveSessionTitleBtn) {
    el.saveSessionTitleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveSessionTitle();
    });
  }
  if (el.cancelSessionTitleBtn) {
    el.cancelSessionTitleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelRenamingSession();
    });
  }
  if (el.sessionTitleInput) {
    el.sessionTitleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveSessionTitle();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRenamingSession();
      }
    });
  }

  // Export session
  if (el.exportSessionBtn) el.exportSessionBtn.addEventListener('click', exportSessionTranscript);

  // Clear session (header trash can button)
  if (el.clearSessionBtn) {
    el.clearSessionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentSessionId) {
        showDeleteSessionModal(state.currentSessionId);
      }
    });
  }

  // Delete Conversation Modal
  if (el.closeDeleteSessionModalBtn) el.closeDeleteSessionModalBtn.addEventListener('click', hideDeleteSessionModal);
  if (el.cancelDeleteSessionBtn) el.cancelDeleteSessionBtn.addEventListener('click', hideDeleteSessionModal);
  if (el.confirmDeleteSessionBtn) el.confirmDeleteSessionBtn.addEventListener('click', executeDeleteSession);
  if (el.deleteSessionModal) {
    el.deleteSessionModal.addEventListener('click', (e) => {
      if (e.target === el.deleteSessionModal) hideDeleteSessionModal();
    });
  }

  // Vault drawer toggle
  if (el.openVaultBtn) el.openVaultBtn.addEventListener('click', openVault);
  if (el.closeVaultBtn) el.closeVaultBtn.addEventListener('click', closeVault);
  if (el.vaultBackdrop) el.vaultBackdrop.addEventListener('click', closeVault);

  // Settings Modal
  if (el.openSettingsBtn) el.openSettingsBtn.addEventListener('click', openSettings);
  if (el.closeSettingsModalBtn) el.closeSettingsModalBtn.addEventListener('click', closeSettings);
  if (el.cancelSettingsBtn) el.cancelSettingsBtn.addEventListener('click', closeSettings);
  if (el.saveSettingsBtn) el.saveSettingsBtn.addEventListener('click', saveSettings);
  if (el.testConnectionBtn) el.testConnectionBtn.addEventListener('click', testDeepSeekConnection);
  if (el.toggleApiKeyVisibility) el.toggleApiKeyVisibility.addEventListener('click', toggleApiKeyVisibility);

  // Settings Tabs
  if (el.tabBtnDeepSeek) el.tabBtnDeepSeek.addEventListener('click', () => switchSettingsTab('tabDeepSeek'));
  if (el.tabBtnProviders) el.tabBtnProviders.addEventListener('click', () => switchSettingsTab('tabProviders'));
  if (el.tabBtnGitHub) el.tabBtnGitHub.addEventListener('click', () => switchSettingsTab('tabGitHub'));
  if (el.toggleGhKeyVisibility) el.toggleGhKeyVisibility.addEventListener('click', toggleGhKeyVisibility);

  // Studio Drawer listeners
  if (el.openEditorBtn) el.openEditorBtn.addEventListener('click', toggleStudio);
  if (el.openEditorSidebarBtn) el.openEditorSidebarBtn.addEventListener('click', toggleStudio);
  if (el.openEditorChatBtn) el.openEditorChatBtn.addEventListener('click', toggleStudio);
  if (el.closeStudioBtn) el.closeStudioBtn.addEventListener('click', closeStudio);
  if (el.studioBackdrop) el.studioBackdrop.addEventListener('click', closeStudio);
  if (el.studioTabBtnFiles) el.studioTabBtnFiles.addEventListener('click', () => switchStudioTab('files'));
  if (el.studioTabBtnGit) el.studioTabBtnGit.addEventListener('click', () => switchStudioTab('git'));
  if (el.treeRefreshBtn) el.treeRefreshBtn.addEventListener('click', () => loadFileTree(state.studio.currentPath));
  if (el.treeNewFileBtn) el.treeNewFileBtn.addEventListener('click', createNewFilePrompt);
  if (el.fileTreeFilter) el.fileTreeFilter.addEventListener('input', () => loadFileTree(state.studio.currentPath));

  // Workspace folder & project creation listeners
  if (el.studioRootBadge) el.studioRootBadge.addEventListener('click', pickWorkspaceFolder);
  if (el.studioOpenFolderBtn) el.studioOpenFolderBtn.addEventListener('click', pickWorkspaceFolder);
  if (el.treeOpenFolderBtn) el.treeOpenFolderBtn.addEventListener('click', pickWorkspaceFolder);
  if (el.studioNewProjectBtn) el.studioNewProjectBtn.addEventListener('click', openNewProjectModal);
  if (el.treeNewProjectBtn) el.treeNewProjectBtn.addEventListener('click', openNewProjectModal);
  if (el.closeNewProjectModalBtn) el.closeNewProjectModalBtn.addEventListener('click', closeNewProjectModal);
  if (el.cancelNewProjectBtn) el.cancelNewProjectBtn.addEventListener('click', closeNewProjectModal);
  if (el.newProjectModal) {
    el.newProjectModal.addEventListener('click', (e) => {
      if (e.target === el.newProjectModal) closeNewProjectModal();
    });
  }
  if (el.browseNewProjectLocationBtn) el.browseNewProjectLocationBtn.addEventListener('click', browseNewProjectLocation);
  if (el.confirmNewProjectBtn) el.confirmNewProjectBtn.addEventListener('click', submitCreateProject);
  if (el.newProjectNameInput) {
    el.newProjectNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCreateProject();
      if (e.key === 'Escape') closeNewProjectModal();
    });
  }

  // Template cards click selection
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.selectedProjectTemplate = card.dataset.template || 'web';
    });
  });

  // Open folder modal listeners
  if (el.nativePickFolderModalBtn) el.nativePickFolderModalBtn.addEventListener('click', pickWorkspaceFolder);
  if (el.closeOpenFolderModalBtn) el.closeOpenFolderModalBtn.addEventListener('click', closeOpenFolderModal);
  if (el.cancelOpenFolderBtn) el.cancelOpenFolderBtn.addEventListener('click', closeOpenFolderModal);
  if (el.openFolderModal) {
    el.openFolderModal.addEventListener('click', (e) => {
      if (e.target === el.openFolderModal) closeOpenFolderModal();
    });
  }
  if (el.confirmCustomFolderBtn) el.confirmCustomFolderBtn.addEventListener('click', submitCustomFolder);
  if (el.customFolderPathInput) {
    el.customFolderPathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCustomFolder();
      if (e.key === 'Escape') closeOpenFolderModal();
    });
  }

  // Quota Exhausted Modal Listeners
  if (el.closeQuotaModalBtn) el.closeQuotaModalBtn.addEventListener('click', closeQuotaExhaustedModal);
  if (el.cancelQuotaModalBtn) el.cancelQuotaModalBtn.addEventListener('click', closeQuotaExhaustedModal);
  if (el.quotaExhaustedModal) {
    el.quotaExhaustedModal.addEventListener('click', (e) => {
      if (e.target === el.quotaExhaustedModal) closeQuotaExhaustedModal();
    });
  }
  if (el.confirmSwitchAndResumeBtn) {
    el.confirmSwitchAndResumeBtn.addEventListener('click', () => {
      if (state.selectedQuotaModel) {
        resumeTurnWithModel(state.selectedQuotaModel);
      }
    });
  }
  if (el.saveQuickKeyBtn) el.saveQuickKeyBtn.addEventListener('click', saveQuickKeyFromQuotaModal);
  // View Mode Selectors (Editor, Split, Preview, Diff)
  if (el.svmEditorBtn) el.svmEditorBtn.addEventListener('click', () => setStudioViewMode('editor'));
  if (el.svmSplitBtn) el.svmSplitBtn.addEventListener('click', () => setStudioViewMode('split'));
  if (el.svmPreviewBtn) el.svmPreviewBtn.addEventListener('click', () => setStudioViewMode('preview'));
  if (el.svmDiffBtn) el.svmDiffBtn.addEventListener('click', () => setStudioViewMode('diff'));

  // Live Web Preview Controls
  if (el.previewRefreshBtn) el.previewRefreshBtn.addEventListener('click', reloadPreview);
  if (el.previewUrlInput) el.previewUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') reloadPreview(); });
  if (el.previewDeviceDesktop) el.previewDeviceDesktop.addEventListener('click', () => setPreviewDevice('desktop'));
  if (el.previewDeviceTablet) el.previewDeviceTablet.addEventListener('click', () => setPreviewDevice('tablet'));
  if (el.previewDeviceMobile) el.previewDeviceMobile.addEventListener('click', () => setPreviewDevice('mobile'));
  if (el.previewExternalBtn) el.previewExternalBtn.addEventListener('click', openPreviewExternal);
  if (el.previewMobileQrBtn) el.previewMobileQrBtn.addEventListener('click', () => {
    if (window.DeepHarnessMobilePreview) window.DeepHarnessMobilePreview.showMobilePreviewQR();
  });

  // Terminal Runner Controls
  if (el.studioTabBtnTerminal) el.studioTabBtnTerminal.addEventListener('click', () => switchStudioTab('terminal'));
  if (el.btnRunDevServer) el.btnRunDevServer.addEventListener('click', handleQuickDevServer);
  if (el.btnRunInstall) el.btnRunInstall.addEventListener('click', () => runTerminalCommand('npm install'));
  if (el.btnRunTest) el.btnRunTest.addEventListener('click', () => runTerminalCommand('npm test'));
  if (el.btnKillProcess) el.btnKillProcess.addEventListener('click', killTerminalProcess);
  if (el.btnClearTerminal) el.btnClearTerminal.addEventListener('click', clearTerminalConsole);
  if (el.btnTerminalSubmit) el.btnTerminalSubmit.addEventListener('click', handleTerminalInputSubmit);
  if (el.terminalInputCmd) el.terminalInputCmd.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleTerminalInputSubmit(); });
  if (el.btnAutoFixWithAi) el.btnAutoFixWithAi.addEventListener('click', handleTerminalAutoFix);

  // Context Tagging (@file) Autocomplete Controls
  if (el.attachFileContextBtn) el.attachFileContextBtn.addEventListener('click', () => openFileAutocomplete(''));
  if (el.promptTextarea) {
    el.promptTextarea.addEventListener('input', () => {
      const val = el.promptTextarea.value;
      const match = val.match(/@([a-zA-Z0-9_\-./]*)$/);
      if (match) {
        openFileAutocomplete(match[1]);
      } else {
        closeFileAutocomplete();
      }
    });

    el.promptTextarea.addEventListener('keydown', (e) => {
      if (el.fileAutocompleteDropdown && el.fileAutocompleteDropdown.style.display !== 'none') {
        const items = el.fadList ? Array.from(el.fadList.querySelectorAll('.fad-item')) : [];
        let activeIdx = items.findIndex(item => item.classList.contains('active'));
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (items.length > 0) {
            if (activeIdx >= 0) items[activeIdx].classList.remove('active');
            activeIdx = (activeIdx + 1) % items.length;
            items[activeIdx].classList.add('active');
            items[activeIdx].scrollIntoView({ block: 'nearest' });
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (items.length > 0) {
            if (activeIdx >= 0) items[activeIdx].classList.remove('active');
            activeIdx = (activeIdx - 1 + items.length) % items.length;
            items[activeIdx].classList.add('active');
            items[activeIdx].scrollIntoView({ block: 'nearest' });
          }
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          if (items.length > 0 && activeIdx >= 0) {
            e.preventDefault();
            items[activeIdx].click();
          }
        } else if (e.key === 'Escape') {
          closeFileAutocomplete();
        }
      }
    });
  }

  if (el.studioSaveFileBtn) el.studioSaveFileBtn.addEventListener('click', saveCurrentFile);
  if (el.studioHeaderGithubBtn) {
    el.studioHeaderGithubBtn.addEventListener('click', () => switchStudioTab('git'));
  }
  if (el.studioArchVisBtn) el.studioArchVisBtn.addEventListener('click', () => {
    if (window.DeepHarnessArchVisualizer) window.DeepHarnessArchVisualizer.showArchitectureVisualizer();
  });
  if (el.studioSecurityScanBtn) el.studioSecurityScanBtn.addEventListener('click', () => {
    if (window.DeepHarnessSecurityScanner) window.DeepHarnessSecurityScanner.showScanReport();
    if (window.DeepHarnessSecurityScanner) window.DeepHarnessSecurityScanner.scanForSecrets();
  });
  if (el.gitRefreshBtn) el.gitRefreshBtn.addEventListener('click', loadGitStatus);
  if (el.gitBranchSelect) el.gitBranchSelect.addEventListener('change', (e) => switchBranch(e.target.value));
  if (el.gitNewBranchBtn) el.gitNewBranchBtn.addEventListener('click', toggleInlineNewBranch);
  if (el.closeInlineNewBranchBtn) el.closeInlineNewBranchBtn.addEventListener('click', closeInlineNewBranch);
  if (el.confirmInlineBranchBtn) el.confirmInlineBranchBtn.addEventListener('click', submitInlineBranch);
  if (el.inlineBranchNameInput) {
    el.inlineBranchNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitInlineBranch();
      if (e.key === 'Escape') closeInlineNewBranch();
    });
  }
  if (el.gitDeleteBranchBtn) el.gitDeleteBranchBtn.addEventListener('click', toggleInlineDeleteBranch);
  if (el.closeInlineDeleteBranchBtn) el.closeInlineDeleteBranchBtn.addEventListener('click', closeInlineDeleteBranch);
  if (el.confirmInlineDeleteBranchBtn) el.confirmInlineDeleteBranchBtn.addEventListener('click', submitInlineDeleteBranch);

  if (el.toggleInlineCreateRepoBtn) el.toggleInlineCreateRepoBtn.addEventListener('click', openInlineCreateRepo);
  if (el.closeInlineCreateRepoBtn) el.closeInlineCreateRepoBtn.addEventListener('click', closeInlineCreateRepo);
  if (el.inlineVisPillPublic) el.inlineVisPillPublic.addEventListener('click', () => setInlineRepoVisibility('public'));
  if (el.inlineVisPillPrivate) el.inlineVisPillPrivate.addEventListener('click', () => setInlineRepoVisibility('private'));
  if (el.toggleInlineGhKeyVisibility) {
    el.toggleInlineGhKeyVisibility.addEventListener('click', () => {
      if (el.inlineRepoTokenInput) {
        el.inlineRepoTokenInput.type = el.inlineRepoTokenInput.type === 'password' ? 'text' : 'password';
      }
    });
  }
  if (el.confirmInlineCreateRepoBtn) el.confirmInlineCreateRepoBtn.addEventListener('click', submitInlineCreateRepo);

  if (el.toggleInlineLinkRemoteBtn) el.toggleInlineLinkRemoteBtn.addEventListener('click', openInlineLinkRemote);
  if (el.closeInlineLinkRemoteBtn) el.closeInlineLinkRemoteBtn.addEventListener('click', closeInlineLinkRemote);
  if (el.confirmInlineLinkRemoteBtn) el.confirmInlineLinkRemoteBtn.addEventListener('click', submitInlineLinkRemote);
  if (el.inlineRemoteUrlInput) {
    el.inlineRemoteUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitInlineLinkRemote();
      if (e.key === 'Escape') closeInlineLinkRemote();
    });
  }

  if (el.gitPullBtn) el.gitPullBtn.addEventListener('click', pullFromRemote);
  if (el.gitAiCommitBtn) el.gitAiCommitBtn.addEventListener('click', generateAiCommitMessage);
  if (el.gitCommitBtn) el.gitCommitBtn.addEventListener('click', commitGitChanges);
  if (el.gitCommitInput) {
    el.gitCommitInput.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        commitGitChanges();
      }
    });
  }
  if (el.gitPushBtn) el.gitPushBtn.addEventListener('click', pushGitBranch);
  if (el.gitCreatePrBtn) el.gitCreatePrBtn.addEventListener('click', createGitHubPullRequest);

  // GitHub Account Session Listeners
  if (el.openGhSignInBtn) el.openGhSignInBtn.addEventListener('click', toggleInlineGhSignIn);
  if (el.inlinePromptSignInBtn) el.inlinePromptSignInBtn.addEventListener('click', toggleInlineGhSignIn);
  if (el.closeInlineGhSignInBtn) el.closeInlineGhSignInBtn.addEventListener('click', closeInlineGhSignIn);
  if (el.inlineOpenGhTokenBtn) el.inlineOpenGhTokenBtn.addEventListener('click', openGhTokenPage);
  if (el.confirmInlineGhSignInBtn) el.confirmInlineGhSignInBtn.addEventListener('click', submitInlineGhSignIn);
  if (el.toggleInlineGhSignInVisibility) {
    el.toggleInlineGhSignInVisibility.addEventListener('click', () => {
      if (el.inlineGhSignInTokenInput) {
        el.inlineGhSignInTokenInput.type = el.inlineGhSignInTokenInput.type === 'password' ? 'text' : 'password';
      }
    });
  }
  if (el.inlineGhSignInTokenInput) {
    el.inlineGhSignInTokenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitInlineGhSignIn();
      if (e.key === 'Escape') closeInlineGhSignIn();
    });
  }

  // Modal fallbacks
  if (el.closeGhSignInModalBtn) el.closeGhSignInModalBtn.addEventListener('click', closeGhSignInModal);
  if (el.cancelGhSignInBtn) el.cancelGhSignInBtn.addEventListener('click', closeGhSignInModal);
  if (el.confirmGhSignInBtn) el.confirmGhSignInBtn.addEventListener('click', submitGhSignIn);
  if (el.openGhTokenPageBtn) el.openGhTokenPageBtn.addEventListener('click', openGhTokenPage);
  if (el.ghSignOutBtn) el.ghSignOutBtn.addEventListener('click', submitGhSignOut);
  if (el.toggleGhSignInTokenVisibility) {
    el.toggleGhSignInTokenVisibility.addEventListener('click', () => {
      if (el.ghSignInTokenInput) {
        el.ghSignInTokenInput.type = el.ghSignInTokenInput.type === 'password' ? 'text' : 'password';
      }
    });
  }
  if (el.ghSignInTokenInput) {
    el.ghSignInTokenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitGhSignIn();
      if (e.key === 'Escape') closeGhSignInModal();
    });
  }

  // GitHub Publisher & Remote Modals (also retained)
  if (el.openCreateRepoModalBtn) el.openCreateRepoModalBtn.addEventListener('click', openCreateRepoModal);
  if (el.closeCreateRepoModalBtn) el.closeCreateRepoModalBtn.addEventListener('click', closeCreateRepoModal);
  if (el.cancelCreateRepoBtn) el.cancelCreateRepoBtn.addEventListener('click', closeCreateRepoModal);
  if (el.confirmCreateRepoBtn) el.confirmCreateRepoBtn.addEventListener('click', submitCreateRepo);
  if (el.visPillPublic) el.visPillPublic.addEventListener('click', () => setRepoVisibilityPill('public'));
  if (el.visPillPrivate) el.visPillPrivate.addEventListener('click', () => setRepoVisibilityPill('private'));
  if (el.toggleModalGhKeyVisibility) {
    el.toggleModalGhKeyVisibility.addEventListener('click', () => {
      if (el.modalGhTokenInput) {
        el.modalGhTokenInput.type = el.modalGhTokenInput.type === 'password' ? 'text' : 'password';
      }
    });
  }

  if (el.closeCreateBranchModalBtn) el.closeCreateBranchModalBtn.addEventListener('click', closeCreateBranchModal);
  if (el.cancelCreateBranchBtn) el.cancelCreateBranchBtn.addEventListener('click', closeCreateBranchModal);
  if (el.confirmCreateBranchBtn) el.confirmCreateBranchBtn.addEventListener('click', submitCreateBranch);

  if (el.closeDeleteBranchModalBtn) el.closeDeleteBranchModalBtn.addEventListener('click', closeDeleteBranchModal);
  if (el.cancelDeleteBranchBtn) el.cancelDeleteBranchBtn.addEventListener('click', closeDeleteBranchModal);
  if (el.confirmDeleteBranchBtn) el.confirmDeleteBranchBtn.addEventListener('click', submitDeleteBranch);

  if (el.gitEditRemoteBtn) el.gitEditRemoteBtn.addEventListener('click', openEditRemoteModal);
  if (el.closeEditRemoteModalBtn) el.closeEditRemoteModalBtn.addEventListener('click', closeEditRemoteModal);
  if (el.cancelEditRemoteBtn) el.cancelEditRemoteBtn.addEventListener('click', closeEditRemoteModal);
  if (el.confirmEditRemoteBtn) el.confirmEditRemoteBtn.addEventListener('click', submitEditRemote);

  // Header Auto-Fetch Models Button
  if (el.fetchModelsBtn) {
    el.fetchModelsBtn.addEventListener('click', () => {
      // Determine provider for current model or default to deepseek
      if (el.modelSelector && el.modelSelector.options && el.modelSelector.selectedIndex >= 0) {
        const selectedOpt = el.modelSelector.options[el.modelSelector.selectedIndex];
        const provId = selectedOpt?.dataset?.provider || 'deepseek';
        fetchModelsForProvider(provId);
      } else {
        fetchModelsForProvider('deepseek');
      }
    });
  }

  // Add Custom Provider Button
  if (el.addProviderBtn) el.addProviderBtn.addEventListener('click', addNewProvider);

  // Image / Screenshot Attachment (⌘+V Paste, Drop, File Dialog)
  window.addEventListener('paste', handleGlobalPaste);

  if (el.attachImageBtn && el.imageFileInput) {
    el.attachImageBtn.addEventListener('click', () => el.imageFileInput.click());
    el.imageFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processImageFile(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  if (el.removeAttachmentBtn) {
    el.removeAttachmentBtn.addEventListener('click', clearAttachedImage);
  }

  setupImageDragAndDrop();
}

// ==========================================================================
// Image & Screenshot Attachment Helpers
// ==========================================================================

function handleGlobalPaste(e) {
  const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      if (blob) {
        processImageFile(blob);
        showToast('📸 Screenshot pasted successfully!', 'success');
        e.preventDefault();
        break;
      }
    }
  }
}

function processImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please attach a valid image file', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    state.attachedImage = {
      name: file.name || `screenshot_${Date.now()}.png`,
      size: (file.size / 1024).toFixed(1) + ' KB',
      dataUrl: dataUrl
    };
    renderAttachmentPreview();
    el.promptTextarea.focus();
  };
  reader.readAsDataURL(file);
}

function renderAttachmentPreview() {
  if (!state.attachedImage) {
    if (el.attachmentPreviewContainer) el.attachmentPreviewContainer.style.display = 'none';
    return;
  }
  if (el.attachmentPreviewContainer) {
    el.attachmentPreviewContainer.style.display = 'flex';
    el.attachmentThumbImg.src = state.attachedImage.dataUrl;
    el.attachmentName.textContent = state.attachedImage.name;
    el.attachmentSize.textContent = `(${state.attachedImage.size})`;
  }
}

function clearAttachedImage() {
  state.attachedImage = null;
  renderAttachmentPreview();
}

function setupImageDragAndDrop() {
  const dropZone = el.floatingInputCard || document.body;
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        processImageFile(file);
        showToast('📸 Screenshot dropped successfully!', 'success');
      }
    }
  });
}

function switchSettingsTab(tabId) {
  el.tabBtnDeepSeek.classList.toggle('active', tabId === 'tabDeepSeek');
  el.tabBtnProviders.classList.toggle('active', tabId === 'tabProviders');
  if (el.tabBtnGitHub) el.tabBtnGitHub.classList.toggle('active', tabId === 'tabGitHub');
  el.tabDeepSeek.style.display = tabId === 'tabDeepSeek' ? 'block' : 'none';
  el.tabProviders.style.display = tabId === 'tabProviders' ? 'block' : 'none';
  if (el.tabGitHub) el.tabGitHub.style.display = tabId === 'tabGitHub' ? 'block' : 'none';
  if (tabId === 'tabProviders') {
    loadProviders();
  }
}

// ==========================================================================
// Dynamic Model Discovery & Provider Management
// ==========================================================================

async function loadModels() {
  try {
    const res = await fetch('/api/models');
    const models = await res.json();

    const defaultFallbackModels = [
      { id: 'deepseek-reasoner', provider_id: 'deepseek', provider_name: 'DeepSeek', name: 'deepseek-reasoner (R1 Thinking)' },
      { id: 'deepseek-chat', provider_id: 'deepseek', provider_name: 'DeepSeek', name: 'deepseek-chat (V4.1 Coder)' },
      { id: 'deepseek/deepseek-r1', provider_id: 'openrouter', provider_name: 'OpenRouter', name: 'OpenRouter: DeepSeek R1' },
      { id: 'deepseek/deepseek-chat', provider_id: 'openrouter', provider_name: 'OpenRouter', name: 'OpenRouter: DeepSeek V3' },
      { id: 'anthropic/claude-3.5-sonnet', provider_id: 'openrouter', provider_name: 'OpenRouter', name: 'OpenRouter: Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', provider_id: 'openrouter', provider_name: 'OpenRouter', name: 'OpenRouter: OpenAI GPT-4o' },
      { id: 'meta-llama/llama-3.3-70b-instruct', provider_id: 'openrouter', provider_name: 'OpenRouter', name: 'OpenRouter: Llama 3.3 70B' },
      { id: 'glm-4-plus', provider_id: 'zai', provider_name: 'Z.ai (GLM)', name: 'Z.ai: GLM-4-Plus (Flagship)' },
      { id: 'glm-4-flash', provider_id: 'zai', provider_name: 'Z.ai (GLM)', name: 'Z.ai: GLM-4-Flash (Free)' },
      { id: 'glm-4-long', provider_id: 'zai', provider_name: 'Z.ai (GLM)', name: 'Z.ai: GLM-4-Long (1M Context)' },
      { id: 'codegeex-4', provider_id: 'zai', provider_name: 'Z.ai (GLM)', name: 'Z.ai: CodeGeeX-4 (Coding Expert)' }
    ];

    const modelList = Array.isArray(models) ? [...models] : [];
    for (const dfm of defaultFallbackModels) {
      if (!modelList.find(m => m.id === dfm.id)) {
        modelList.push(dfm);
      }
    }
    state.models = modelList;

    if (modelList.length === 0) return;

    // Group models by provider
    const grouped = {};
    for (const m of modelList) {
      const pName = m.provider_name || (m.provider_id ? m.provider_id.toUpperCase() : 'DEEPSEEK');
      if (!grouped[pName]) grouped[pName] = [];
      grouped[pName].push(m);
    }

    if (el.modelSelector) {
      el.modelSelector.innerHTML = '';
      for (const [providerName, provModels] of Object.entries(grouped)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = providerName;
        for (const m of provModels) {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.dataset.provider = m.provider_id || 'deepseek';
          let prefix = '⚡ ';
          let priceTag = '';
          const pId = m.provider_id || '';
          if (pId === 'deepseek') {
            if (m.id.includes('reasoner') || m.id.includes('r1')) {
              prefix = '🧠 ';
              priceTag = ' — [In ¥1.00 • Out ¥2.19/M]';
            } else {
              prefix = '⚡ ';
              priceTag = ' — [In ¥1.00 • Out ¥2.00/M]';
            }
          } else if (pId === 'openrouter') {
            prefix = '🌐 ';
            priceTag = ' — [OpenRouter]';
          } else if (pId === 'zai') {
            prefix = '⚡ ';
            priceTag = ' — [Z.ai GLM]';
          } else if (pId === 'openai') {
            prefix = '🤖 ';
            priceTag = ' — [OpenAI]';
          } else if (pId === 'groq') {
            prefix = '⚡ ';
            priceTag = ' — [Groq]';
          } else if (pId === 'ollama') {
            prefix = '🦙 ';
            priceTag = ' — [Local]';
          } else if (m.id.includes('gpt-4o')) {
            prefix = '🌐 ';
            priceTag = ' — [In $2.50 • Out $10/M]';
          }
          opt.textContent = `${prefix}${m.name || m.id}${priceTag}`;
          if (m.id === state.activeModel) opt.selected = true;
          optgroup.appendChild(opt);
        }
        el.modelSelector.appendChild(optgroup);
      }

      // Ensure active model is selected if present
      if (state.activeModel) {
        el.modelSelector.value = state.activeModel;
      }
    }
    updateModelRateBadge(state.activeModel);
  } catch (err) {
    console.error('Failed to load models:', err);
  }
}

function updateModelRateBadge(modelId) {
  if (!el.activeModelRatePill) return;
  const m = (modelId || state.activeModel || '').toLowerCase();
  if (m.includes('reasoner') || m.includes('r1')) {
    el.activeModelRatePill.innerHTML = `<span>In: ¥1.00/M</span><span class="rate-sep">•</span><span>Out: ¥2.19/M</span>`;
    el.activeModelRatePill.title = 'DeepSeek-R1 (Reasoner): Cache Miss ¥1.00/M, Hit ¥0.14/M, Output ¥2.19/M';
  } else if (m.includes('chat') || m.includes('v4') || m.includes('v3') || m.includes('flash')) {
    el.activeModelRatePill.innerHTML = `<span>In: ¥1.00/M</span><span class="rate-sep">•</span><span>Out: ¥2.00/M</span>`;
    el.activeModelRatePill.title = 'DeepSeek-V4.1 (Chat): Cache Miss ¥1.00/M, Hit ¥0.14/M, Output ¥2.00/M';
  } else if (m.includes('/') || m.includes('openrouter')) {
    el.activeModelRatePill.innerHTML = `<span>🌐 OpenRouter</span>`;
    el.activeModelRatePill.title = 'OpenRouter Multi-Provider Cloud Model';
  } else if (m.startsWith('glm') || m.startsWith('codegeex')) {
    el.activeModelRatePill.innerHTML = `<span>⚡ Z.ai GLM</span>`;
    el.activeModelRatePill.title = 'Z.ai (Zhipu AI) GLM Model';
  } else if (m.includes('gpt-4o')) {
    el.activeModelRatePill.innerHTML = `<span>In: $2.50/M</span><span class="rate-sep">•</span><span>Out: $10.00/M</span>`;
    el.activeModelRatePill.title = 'OpenAI GPT-4o Pricing';
  } else {
    el.activeModelRatePill.innerHTML = `<span>${escapeHtml(modelId)}</span>`;
  }
}

async function fetchModelsForProvider(providerId) {
  showToast(`Querying ${providerId} API for available models...`, 'info');
  try {
    const res = await fetch('/api/models/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_id: providerId })
    });
    const data = await res.json();

    if (!data.success) {
      showToast(data.error || 'Failed to fetch models', 'error');
      return;
    }

    showToast(`✅ Auto-fetched ${data.count} models from ${providerId}!`, 'success');
    await loadModels();
    await loadProviders();
  } catch (err) {
    showToast(`Model fetch error: ${err.message}`, 'error');
  }
}

async function loadProviders() {
  try {
    const res = await fetch('/api/providers');
    const provs = await res.json();
    state.providers = Array.isArray(provs) ? [...provs] : [];

    // Ensure default providers (openrouter, zai, deepseek, etc.) are present in state
    const knownDefaults = [
      { id: 'deepseek', name: 'DeepSeek', base_url: 'https://api.deepseek.com' },
      { id: 'openrouter', name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1' },
      { id: 'zai', name: 'Z.ai (GLM)', base_url: 'https://api.z.ai/api/coding/paas/v4' },
      { id: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1' },
      { id: 'groq', name: 'Groq', base_url: 'https://api.groq.com/openai/v1' },
      { id: 'ollama', name: 'Ollama (Local)', base_url: 'http://localhost:11434/v1' }
    ];
    for (const kd of knownDefaults) {
      if (!state.providers.find(p => p.id === kd.id)) {
        state.providers.push({
          id: kd.id,
          name: kd.name,
          base_url: kd.base_url,
          api_key: '',
          model_count: 0
        });
      }
    }

    renderProvidersList();
  } catch (err) {
    console.error('Failed to load providers:', err);
  }
}

function renderProvidersList() {
  if (!el.providersList) return;
  el.providersList.innerHTML = '';

  const providerMeta = {
    'openrouter': {
      icon: '🌐',
      displayName: 'OpenRouter',
      badge: 'All-in-One Cloud',
      defaultUrl: 'https://openrouter.ai/api/v1',
      keyPlaceholder: 'Paste OpenRouter Key (sk-or-v1-...)',
      keyLink: 'https://openrouter.ai/keys',
      keyLinkLabel: 'Get OpenRouter Key ↗'
    },
    'zai': {
      icon: '⚡',
      displayName: 'Z.ai (GLM)',
      badge: 'Zhipu AI GLM Coding Plan',
      defaultUrl: 'https://api.z.ai/api/coding/paas/v4',
      keyPlaceholder: 'Paste Z.ai API Key (e.g. 1a2b3c4d...)',
      keyLink: 'https://z.ai/manage-apikey/coding-plan/personal/usage',
      keyLinkLabel: 'GLM Coding Plan ↗',
      planToggle: true
    },
    'deepseek': {
      icon: '🧠',
      displayName: 'DeepSeek',
      badge: 'Official API',
      defaultUrl: 'https://api.deepseek.com',
      keyPlaceholder: 'Paste DeepSeek Key (sk-...)',
      keyLink: 'https://platform.deepseek.com/api_keys',
      keyLinkLabel: 'Get DeepSeek Key ↗'
    },
    'openai': {
      icon: '🤖',
      displayName: 'OpenAI',
      badge: 'Official API',
      defaultUrl: 'https://api.openai.com/v1',
      keyPlaceholder: 'Paste OpenAI Key (sk-...)',
      keyLink: 'https://platform.openai.com/api-keys',
      keyLinkLabel: 'Get OpenAI Key ↗'
    },
    'groq': {
      icon: '⚡',
      displayName: 'Groq',
      badge: 'Ultra-Fast LPU',
      defaultUrl: 'https://api.groq.com/openai/v1',
      keyPlaceholder: 'Paste Groq Key (gsk_...)',
      keyLink: 'https://console.groq.com/keys',
      keyLinkLabel: 'Get Groq Key ↗'
    },
    'ollama': {
      icon: '🦙',
      displayName: 'Ollama',
      badge: 'Local Offline Engine',
      defaultUrl: 'http://localhost:11434/v1',
      keyPlaceholder: 'No API Key required for local Ollama',
      keyLink: 'https://ollama.com',
      keyLinkLabel: 'Ollama Website ↗',
      isLocal: true
    }
  };

  const priorityOrder = ['deepseek', 'openrouter', 'zai', 'openai', 'groq', 'ollama'];
  const sorted = [...(state.providers || [])].sort((a, b) => {
    const idxA = priorityOrder.indexOf(a.id);
    const idxB = priorityOrder.indexOf(b.id);
    const orderA = idxA === -1 ? 99 : idxA;
    const orderB = idxB === -1 ? 99 : idxB;
    return orderA - orderB;
  });

  sorted.forEach(p => {
    const meta = providerMeta[p.id] || {
      icon: '🔌',
      displayName: p.name || p.id,
      badge: 'Custom Provider',
      defaultUrl: p.base_url,
      keyPlaceholder: 'API Key (Bearer Token)',
      keyLink: '',
      keyLinkLabel: ''
    };

    const hasKey = Boolean(p.api_key && p.api_key.trim());
    const isLocal = meta.isLocal || p.id === 'ollama';

    const card = document.createElement('div');
    card.className = `provider-item-card ${hasKey ? 'is-configured' : ''}`;
    card.setAttribute('data-prov-id', p.id);

    card.innerHTML = `
      <div class="pic-header">
        <div class="pic-title-row">
          <span class="pic-icon">${meta.icon}</span>
          <span class="pic-name">${escapeHtml(meta.displayName)}</span>
          <span class="pic-badge">${meta.badge}</span>
          <span class="pic-count-badge">${p.model_count || 0} models</span>
          ${isLocal 
            ? '<span class="prov-status-pill local">🦙 Local Engine</span>'
            : hasKey 
              ? '<span class="prov-status-pill configured">✅ Key Saved</span>'
              : '<span class="prov-status-pill unconfigured">⚠️ Key Needed</span>'
          }
        </div>
        <div class="pic-actions">
          <button class="btn-fetch-prov" data-prov-id="${p.id}" title="Save and auto-fetch all models from ${escapeHtml(meta.displayName)}">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            <span>Auto-Fetch Models</span>
          </button>
        </div>
      </div>

      <div class="pic-body-new">
        <!-- API Key Row -->
        <div class="prov-input-row">
          <div class="prov-key-wrapper">
            <span class="prov-key-label">API Key:</span>
            <input 
              type="password" 
              class="prov-key-input" 
              value="${escapeHtml(p.api_key || '')}" 
              placeholder="${escapeHtml(meta.keyPlaceholder)}" 
              data-id="${p.id}"
              ${isLocal ? 'disabled' : ''}
              autocomplete="off"
            >
            ${!isLocal ? `
              <button type="button" class="btn-toggle-prov-pw" title="Show/Hide API Key">👁️</button>
              <button type="button" class="btn-save-prov-key" title="Save Key">Save</button>
            ` : ''}
          </div>
        </div>

        <!-- URL & Extra Options Row -->
        <div class="prov-sub-row">
          <div class="prov-endpoint-info">
            <span class="prov-endpoint-label">Endpoint:</span>
            <span class="prov-endpoint-val" title="Click pencil to edit custom URL">${escapeHtml(p.base_url)}</span>
            <button type="button" class="btn-edit-url-toggle" title="Edit Endpoint URL">✏️</button>
            <input type="text" class="prov-url-input" value="${escapeHtml(p.base_url)}" style="display: none;" data-id="${p.id}">
          </div>

          ${p.id === 'zai' ? `
            <div class="zai-plan-switch">
              <button type="button" class="zai-plan-btn ${p.base_url.includes('coding') ? '' : 'active'}" data-url="https://api.z.ai/api/paas/v4" title="General OpenAI compatible endpoint">General Plan</button>
              <button type="button" class="zai-plan-btn ${p.base_url.includes('coding') ? 'active' : ''}" data-url="https://api.z.ai/api/coding/paas/v4" title="Specialized coding plan endpoint">Coding Plan</button>
            </div>
          ` : ''}

          ${meta.keyLink ? `
            <a href="${meta.keyLink}" target="_blank" class="prov-link">${meta.keyLinkLabel}</a>
          ` : ''}
        </div>
      </div>
    `;

    // Toggle password visibility
    const pwInput = card.querySelector('.prov-key-input');
    const togglePwBtn = card.querySelector('.btn-toggle-prov-pw');
    if (togglePwBtn && pwInput) {
      togglePwBtn.addEventListener('click', () => {
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
      });
    }

    // Toggle URL editing
    const editUrlBtn = card.querySelector('.btn-edit-url-toggle');
    const urlDisplay = card.querySelector('.prov-endpoint-val');
    const urlInput = card.querySelector('.prov-url-input');
    if (editUrlBtn && urlDisplay && urlInput) {
      editUrlBtn.addEventListener('click', () => {
        const isHidden = urlInput.style.display === 'none';
        urlInput.style.display = isHidden ? 'inline-block' : 'none';
        urlDisplay.style.display = isHidden ? 'none' : 'inline';
        if (isHidden) urlInput.focus();
      });
      urlInput.addEventListener('change', () => {
        urlDisplay.textContent = urlInput.value.trim() || p.base_url;
      });
    }

    // Z.ai plan switch buttons
    card.querySelectorAll('.zai-plan-btn').forEach(planBtn => {
      planBtn.addEventListener('click', async () => {
        const targetUrl = planBtn.getAttribute('data-url');
        if (urlInput) urlInput.value = targetUrl;
        if (urlDisplay) urlDisplay.textContent = targetUrl;
        card.querySelectorAll('.zai-plan-btn').forEach(b => b.classList.remove('active'));
        planBtn.classList.add('active');
        await saveProviderData(p.id);
        showToast(`Switched Z.ai to ${planBtn.textContent}!`, 'info');
      });
    });

    // Save helper
    async function saveProviderData(provId) {
      const u = urlInput ? urlInput.value.trim() : p.base_url;
      const k = pwInput ? pwInput.value.trim() : (p.api_key || '');
      try {
        const res = await fetch('/api/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: provId, name: p.name, base_url: u, api_key: k })
        });
        if (res.ok) {
          if (provId === 'deepseek' && el.settingApiKey) {
            el.settingApiKey.value = k;
          }
          const statusPill = card.querySelector('.prov-status-pill');
          if (statusPill && !isLocal) {
            if (k) {
              statusPill.className = 'prov-status-pill configured';
              statusPill.textContent = '✅ Key Saved';
              card.classList.add('is-configured');
            } else {
              statusPill.className = 'prov-status-pill unconfigured';
              statusPill.textContent = '⚠️ Key Needed';
              card.classList.remove('is-configured');
            }
          }
          const provInState = state.providers.find(x => x.id === provId);
          if (provInState) {
            provInState.base_url = u;
            provInState.api_key = k;
          }
        }
      } catch (err) {
        console.error('Save provider error:', err);
      }
    }

    // Save button
    const saveKeyBtn = card.querySelector('.btn-save-prov-key');
    if (saveKeyBtn) {
      saveKeyBtn.addEventListener('click', async () => {
        await saveProviderData(p.id);
        showToast(`Saved ${meta.displayName} API Key!`, 'success');
      });
    }

    // Auto-save on blur / change
    if (pwInput) {
      pwInput.addEventListener('change', async () => {
        await saveProviderData(p.id);
      });
    }
    if (urlInput) {
      urlInput.addEventListener('change', async () => {
        await saveProviderData(p.id);
      });
    }

    // Fetch models button
    const fetchBtn = card.querySelector('.btn-fetch-prov');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', async () => {
        await saveProviderData(p.id);
        fetchModelsForProvider(p.id);
      });
    }

    el.providersList.appendChild(card);
  });
}

async function addNewProvider() {
  const id = el.newProvId.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const name = el.newProvName.value.trim();
  const url = el.newProvUrl.value.trim();
  const key = el.newProvKey.value.trim();

  if (!id || !name || !url) {
    showToast('Please provide Provider ID, Name, and Base URL', 'error');
    return;
  }

  try {
    const res = await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, base_url: url, api_key: key })
    });
    if (res.ok) {
      showToast(`Added ${name}! Fetching models...`, 'success');
      el.newProvId.value = '';
      el.newProvName.value = '';
      el.newProvUrl.value = '';
      el.newProvKey.value = '';
      await loadProviders();
      fetchModelsForProvider(id);
    }
  } catch (err) {
    showToast('Failed to add provider: ' + err.message, 'error');
  }
}

// ==========================================================================
// Settings & Balance Management
// ==========================================================================

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    state.settings = await res.json();
    if (state.settings.active_model) {
      state.activeModel = state.settings.active_model;
      el.modelSelector.value = state.activeModel;
    }
    if (state.settings.deepseek_api_key) {
      el.settingApiKey.value = state.settings.deepseek_api_key;
    }
    if (state.settings.deepseek_endpoint) {
      el.settingEndpoint.value = state.settings.deepseek_endpoint;
    }
    if (state.settings.currency_display) {
      el.settingCurrency.value = state.settings.currency_display;
    }
    if (state.settings.workspace_root && el.settingWorkspaceRoot) {
      el.settingWorkspaceRoot.value = state.settings.workspace_root;
    }
    if (state.settings.github_token && el.settingGitHubToken) {
      el.settingGitHubToken.value = state.settings.github_token;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function fetchBalance(showFeedback = false) {
  try {
    el.refreshBalanceBtn.style.animation = 'pulseBrain 0.8s infinite';
    const res = await fetch('/api/balance');
    const data = await res.json();
    state.balance = data;

    if (!data.configured) {
      el.balanceDisplay.textContent = 'API Key Needed';
      el.balanceDisplay.style.color = 'var(--amber-reason)';
      el.balanceStatusDot.className = 'status-dot offline';
      if (showFeedback) openSettings();
      return;
    }

    if (!data.is_available) {
      el.balanceDisplay.textContent = 'Auth Error';
      el.balanceDisplay.style.color = 'var(--red-danger)';
      el.balanceStatusDot.className = 'status-dot offline';
      if (showFeedback) showToast(data.error || 'DeepSeek Balance Check Failed', 'error');
      return;
    }

    // Success
    el.balanceStatusDot.className = 'status-dot online';
    const infos = data.raw?.balance_infos || [];
    const cnyObj = infos.find(i => i.currency === 'CNY') || { total_balance: data.total_balance || '0.00' };
    const usdObj = infos.find(i => i.currency === 'USD');

    const cnyVal = parseFloat(cnyObj.total_balance || '0.00').toFixed(2);
    const usdVal = usdObj ? parseFloat(usdObj.total_balance || '0.00').toFixed(2) : (parseFloat(cnyVal) * 0.138).toFixed(2);

    const currPref = state.settings.currency_display || 'both';
    if (currPref === 'usd') {
      el.balanceDisplay.textContent = `$${usdVal}`;
    } else if (currPref === 'cny') {
      el.balanceDisplay.textContent = `¥${cnyVal}`;
    } else {
      el.balanceDisplay.textContent = `¥${cnyVal} / $${usdVal}`;
    }
    el.balanceDisplay.style.color = '#38bdf8';

    if (showFeedback) {
      showToast(`DeepSeek Balance: ¥${cnyVal} CNY / $${usdVal} USD`, 'success');
    }
  } catch (err) {
    el.balanceDisplay.textContent = 'Offline';
    el.balanceStatusDot.className = 'status-dot offline';
  } finally {
    el.refreshBalanceBtn.style.animation = 'none';
  }
}

function openSettings() {
  el.settingsModal.style.display = 'flex';
  if (state.settings.deepseek_api_key) {
    el.settingApiKey.value = state.settings.deepseek_api_key;
  }
  if (state.settings.workspace_root && el.settingWorkspaceRoot) {
    el.settingWorkspaceRoot.value = state.settings.workspace_root;
  }
  if (state.settings.github_token && el.settingGitHubToken) {
    el.settingGitHubToken.value = state.settings.github_token;
  }
}

function closeSettings() {
  el.settingsModal.style.display = 'none';
}

function toggleApiKeyVisibility() {
  if (el.settingApiKey.type === 'password') {
    el.settingApiKey.type = 'text';
    el.toggleApiKeyVisibility.textContent = '🔒';
  } else {
    el.settingApiKey.type = 'password';
    el.toggleApiKeyVisibility.textContent = '👁️';
  }
}

function toggleGhKeyVisibility() {
  if (!el.settingGitHubToken) return;
  if (el.settingGitHubToken.type === 'password') {
    el.settingGitHubToken.type = 'text';
    if (el.toggleGhKeyVisibility) el.toggleGhKeyVisibility.textContent = '🔒';
  } else {
    el.settingGitHubToken.type = 'password';
    if (el.toggleGhKeyVisibility) el.toggleGhKeyVisibility.textContent = '👁️';
  }
}

async function testDeepSeekConnection() {
  const key = el.settingApiKey.value.trim();
  if (!key) {
    el.diagnosticBox.innerHTML = '<span style="color: var(--red-danger);">Please enter an API key first.</span>';
    return;
  }

  el.diagnosticBox.innerHTML = '<span style="color: var(--amber-reason);">Connecting to https://api.deepseek.com/user/balance...</span>';
  try {
    const res = await fetch('/api/balance', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json();
    if (data.is_available) {
      el.diagnosticBox.innerHTML = `
        <span style="color: var(--emerald-save); font-weight: 600;">✅ Connection Verified!</span><br>
        Currency: <strong>${data.currency}</strong> | Total Balance: <strong>¥${data.total_balance}</strong> (Paid: ¥${data.topped_up_balance}, Granted: ¥${data.granted_balance})
      `;
    } else {
      el.diagnosticBox.innerHTML = `<span style="color: var(--red-danger);">❌ Connection Failed:</span> ${data.error || 'Invalid API Key'}`;
    }
  } catch (e) {
    el.diagnosticBox.innerHTML = `<span style="color: var(--red-danger);">❌ Network Error:</span> ${e.message}`;
  }
}

async function saveSettings() {
  const apiKey = el.settingApiKey.value.trim();
  const endpoint = el.settingEndpoint.value.trim() || 'https://api.deepseek.com';
  const currency = el.settingCurrency.value;
  const workspaceRoot = el.settingWorkspaceRoot ? el.settingWorkspaceRoot.value.trim() : undefined;
  const githubToken = el.settingGitHubToken ? el.settingGitHubToken.value.trim() : undefined;

  const payload = {
    deepseek_api_key: apiKey,
    deepseek_endpoint: endpoint,
    currency_display: currency,
    active_model: state.activeModel
  };
  if (workspaceRoot) payload.workspace_root = workspaceRoot;
  if (githubToken !== undefined) payload.github_token = githubToken;

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('Settings saved successfully', 'success');
      closeSettings();
      await loadSettings();
      fetchBalance(true);
      loadWorkspaceConfig();
    }
  } catch (err) {
    showToast('Failed to save settings: ' + err.message, 'error');
  }
}

// ==========================================================================
// Presets & Roles
// ==========================================================================

function setPreset(key) {
  state.activePresetKey = key;
  state.systemPrompt = SYSTEM_PRESETS[key] || '';
  el.systemPromptInput.value = state.systemPrompt;

  document.querySelectorAll('.preset-pill, .role-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-preset') === key);
  });

  const names = {
    'r1-architect': 'Deep Architect',
    'v3-coder': 'Fast Coder (V4.1)',
    'bug-hunter': 'Bug Hunter',
    'token-saver': 'Token Saver'
  };
  const icons = {
    'r1-architect': '🧠',
    'v3-coder': '⚡',
    'bug-hunter': '🛡️',
    'token-saver': '🪙'
  };

  if (el.personaBtnIcon) el.personaBtnIcon.textContent = icons[key] || '🧠';
  if (el.personaBtnLabel) el.personaBtnLabel.textContent = names[key] || 'Deep Architect';
  if (el.activePersonaDisplay) {
    el.activePersonaDisplay.textContent = (icons[key] || '') + ' ' + (names[key] || 'Custom');
  }
  // Note: We deliberately do NOT override the user's chosen model here.
  // The user's selection in the model dropdown is always respected 100%!
}

function setExecutionMode(mode) {
  state.executionMode = mode;
  [el.modeFastBtn, el.modeDeepBtn, el.modeAutoBtn].forEach(b => {
    if (b) b.classList.toggle('active', b.dataset.mode === mode);
  });

  if (mode === 'fast') {
    state.activeModel = 'deepseek-chat';
    if (el.autoModeLabel) el.autoModeLabel.textContent = '🎯 Auto';
    updateSessionModel('deepseek-chat');
    showToast('⚡ Fast Mode (V4.1): deepseek-chat (Instant speed, 0 reasoning tokens)', 'info');
  } else if (mode === 'deep') {
    state.activeModel = 'deepseek-reasoner';
    if (el.autoModeLabel) el.autoModeLabel.textContent = '🎯 Auto';
    updateSessionModel('deepseek-reasoner');
    showToast('🧠 Deep Mode: deepseek-reasoner (Exhaustive reasoning active)', 'info');
  } else if (mode === 'auto') {
    showToast('🎯 Auto-Router enabled: Dynamically evaluates prompt complexity', 'info');
    evaluateAutoRoute(el.promptTextarea.value);
  }

  if (el.modelSelector) el.modelSelector.value = state.activeModel;
  updateModelRateBadge(state.activeModel);
  updatePromptTokenEstimate();
}

function evaluateAutoRoute(text) {
  if (state.executionMode !== 'auto') return;
  const lower = (text || '').toLowerCase();
  const reasoningKeywords = [
    'why', 'prove', 'architect', 'algorithm', 'edge case', 'concurrency',
    'race condition', 'security audit', 'tradeoff', 'math', 'derive',
    'memory leak', 'deadlock', 'compare architecture', 'deep reasoning'
  ];
  const needsReasoning = reasoningKeywords.some(kw => lower.includes(kw));
  const targetModel = needsReasoning ? 'deepseek-reasoner' : 'deepseek-chat';
  if (state.activeModel !== targetModel) {
    state.activeModel = targetModel;
    if (el.modelSelector) el.modelSelector.value = targetModel;
    updateModelRateBadge(targetModel);
  }
  if (el.autoModeLabel) {
    el.autoModeLabel.textContent = needsReasoning ? '🎯 Auto (R1)' : '🎯 Auto (V4.1)';
  }
}

// ==========================================================================
// Session Management
// ==========================================================================

async function loadSessions() {
  try {
    const res = await fetch('/api/sessions');
    state.sessions = await res.json();
    el.sessionCountBadge.textContent = state.sessions.length;
    renderSessionList();
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
}

function renderSessionList(filter = '') {
  el.sessionList.innerHTML = '';
  const filtered = state.sessions.filter(s => s.title.toLowerCase().includes(filter));

  if (filtered.length === 0) {
    el.sessionList.innerHTML = '<div style="padding: 12px; font-size: 11px; color: var(--text-dim); text-align: center;">No conversations found</div>';
    return;
  }

  filtered.forEach(session => {
    const item = document.createElement('div');
    item.className = `session-item ${session.id === state.currentSessionId ? 'active' : ''}`;
    item.setAttribute('data-id', session.id);

    const totalTok = (session.total_prompt_tokens + session.total_completion_tokens) || 0;
    const dateStr = formatRelativeTime(session.updated_at);

    item.innerHTML = `
      <div class="session-item-info">
        <span class="session-item-title" title="Double-click to rename">${escapeHtml(session.title)}</span>
        <div class="session-item-meta">
          <span>${totalTok > 0 ? totalTok.toLocaleString() + ' tok' : 'New'}</span>
          <span>•</span>
          <span>${dateStr}</span>
        </div>
      </div>
      <div class="session-item-actions">
        <button class="session-action-btn session-rename-btn" title="Rename conversation" data-rename="${session.id}">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>
        <button class="session-action-btn session-del-btn" title="Delete conversation" data-del="${session.id}">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
          </svg>
        </button>
      </div>
    `;

    const delBtn = item.querySelector('.session-del-btn');
    if (delBtn) {
      delBtn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        deleteSessionImmediately(session.id);
      };
    }

    const renameBtn = item.querySelector('.session-rename-btn');
    if (renameBtn) {
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startRenamingSession(session.id);
      });
    }

    item.addEventListener('click', (e) => {
      if (e.target.closest('.session-rename-btn') || e.target.closest('.session-del-btn')) {
        return;
      }
      selectSession(session.id);
    });

    const titleSpan = item.querySelector('.session-item-title');
    if (titleSpan) {
      titleSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        startRenamingSession(session.id);
      });
    }

    el.sessionList.appendChild(item);
  });
}

async function selectSession(sessionId) {
  if (state.isStreaming) return;
  state.currentSessionId = sessionId;

  document.querySelectorAll('.session-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-id') === sessionId);
  });

  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.session) return;
    state.currentSession = data.session;
    if (el.activeSessionTitle) el.activeSessionTitle.textContent = data.session.title || 'Conversation';

    if (data.session.model) {
      state.activeModel = data.session.model;
      if (el.modelSelector) el.modelSelector.value = data.session.model;
    }
    if (data.session.system_prompt) {
      state.systemPrompt = data.session.system_prompt.replace(/You are DeepSeek R1 acting as/gi, 'You are');
      if (el.systemPromptInput) el.systemPromptInput.value = state.systemPrompt;
    }

    renderMessages(data.messages || []);
    updateSessionTelemetry(data.session);
    updateModelRateBadge(state.activeModel);

    // Sync execution mode buttons
    const isReasoner = state.activeModel.includes('reasoner') || state.activeModel.includes('r1');
    state.executionMode = isReasoner ? 'deep' : 'fast';
    if (el.modeFastBtn) el.modeFastBtn.classList.toggle('active', !isReasoner);
    if (el.modeDeepBtn) el.modeDeepBtn.classList.toggle('active', isReasoner);
    if (el.modeAutoBtn) el.modeAutoBtn.classList.remove('active');

    updatePromptTokenEstimate();
  } catch (err) {
    console.error('Failed to select session:', err);
  }
}

async function createNewSession() {
  if (state.isStreaming) return;
  const currentPrompt = (SYSTEM_PRESETS[state.activePresetKey] || state.systemPrompt || '').replace(/You are DeepSeek R1 acting as/gi, 'You are');
  state.systemPrompt = currentPrompt;
  if (el.systemPromptInput) el.systemPromptInput.value = currentPrompt;
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New DeepSeek Session',
        model: state.activeModel,
        system_prompt: currentPrompt
      })
    });
    const newSession = await res.json();
    state.sessions.unshift(newSession);
    el.sessionCountBadge.textContent = state.sessions.length;
    renderSessionList();
    selectSession(newSession.id);
    el.promptTextarea.focus();
  } catch (err) {
    showToast('Failed to create session: ' + err.message, 'error');
  }
}

// ==========================================================================
// Session Deletion Modal & Handlers
// ==========================================================================

let sessionPendingDeletion = null;

function showDeleteSessionModal(sessionId) {
  sessionPendingDeletion = sessionId || state.currentSessionId;
  if (!sessionPendingDeletion) return;
  const sess = state.sessions.find(s => s.id === sessionPendingDeletion);
  const title = sess ? sess.title : 'this conversation';
  if (el.deleteSessionModalTitle) {
    el.deleteSessionModalTitle.textContent = `"${title}"`;
  }
  if (el.deleteSessionModal) {
    el.deleteSessionModal.style.display = 'flex';
  }
}

function hideDeleteSessionModal() {
  sessionPendingDeletion = null;
  if (el.deleteSessionModal) {
    el.deleteSessionModal.style.display = 'none';
  }
}

async function executeDeleteSession() {
  const idToDelete = sessionPendingDeletion;
  hideDeleteSessionModal();
  if (idToDelete) {
    await deleteSessionImmediately(idToDelete);
  }
}

async function deleteSessionImmediately(sessionId) {
  if (!sessionId) return;

  const sess = state.sessions.find(s => s.id === sessionId);
  const title = sess ? sess.title : 'Conversation';

  // Optimistically remove from state and UI immediately for instant feedback
  state.sessions = state.sessions.filter(s => s.id !== sessionId);
  if (el.sessionCountBadge) el.sessionCountBadge.textContent = state.sessions.length;
  renderSessionList();

  // If this was the active session, switch to first remaining or create a new session
  if (state.currentSessionId === sessionId) {
    if (state.sessions.length > 0) {
      selectSession(state.sessions[0].id);
    } else {
      createNewSession();
    }
  }

  showToast(`Deleted "${title}"`, 'info');

  try {
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Server returned ' + res.status);
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete on server: ' + err.message, 'error');
    loadSessions();
  }
}

async function deleteSessionById(sessionId) {
  showDeleteSessionModal(sessionId);
}

async function deleteCurrentSession() {
  if (state.currentSessionId) {
    showDeleteSessionModal(state.currentSessionId);
  }
}

function startRenamingSession(targetId) {
  // Ensure targetId is a valid string session ID (ignore event objects)
  const sessionId = (typeof targetId === 'string' && targetId) ? targetId : state.currentSessionId;

  if (sessionId && sessionId !== state.currentSessionId) {
    selectSession(sessionId).then(() => {
      startRenamingSession();
    });
    return;
  }

  if (!state.currentSessionId || typeof state.currentSessionId !== 'string') return;
  const currentTitle = (state.currentSession && state.currentSession.title)
    ? state.currentSession.title
    : (el.activeSessionTitle ? el.activeSessionTitle.textContent : '');

  if (el.activeSessionTitle) el.activeSessionTitle.style.display = 'none';
  if (el.renameSessionBtn) el.renameSessionBtn.style.display = 'none';
  if (el.sessionTitleInputWrapper) el.sessionTitleInputWrapper.style.display = 'flex';

  if (el.sessionTitleInput) {
    el.sessionTitleInput.value = currentTitle;
    el.sessionTitleInput.focus();
    el.sessionTitleInput.select();
  }
}

async function saveSessionTitle() {
  const currentId = state.currentSessionId;
  if (!currentId || typeof currentId !== 'string') {
    cancelRenamingSession();
    return;
  }

  const newTitle = el.sessionTitleInput ? el.sessionTitleInput.value.trim() : '';
  const currentTitle = (state.currentSession && state.currentSession.title)
    ? state.currentSession.title
    : (el.activeSessionTitle ? el.activeSessionTitle.textContent : '');

  if (!newTitle) {
    showToast('Session title cannot be empty', 'warning');
    if (el.sessionTitleInput) el.sessionTitleInput.focus();
    return;
  }

  if (newTitle !== currentTitle) {
    if (state.currentSession) state.currentSession.title = newTitle;
    if (el.activeSessionTitle) el.activeSessionTitle.textContent = newTitle;

    // 1. Immediately update matching session in state.sessions array
    const sessionObj = state.sessions.find(s => String(s.id) === String(currentId));
    if (sessionObj) sessionObj.title = newTitle;

    // 2. Immediately update sidebar DOM title element in-place
    const sidebarTitle = document.querySelector(`.session-item[data-id="${CSS.escape ? CSS.escape(currentId) : currentId}"] .session-item-title`);
    if (sidebarTitle) sidebarTitle.textContent = newTitle;

    // 3. Re-render session list to ensure complete UI sync
    renderSessionList();

    // 4. Persist change to SQLite database via API
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(currentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (res.ok) {
        showToast(`Session renamed: "${newTitle}"`, 'success');
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('Failed to rename session:', err);
      showToast('Failed to save session title: ' + err.message, 'error');
    }
  }

  cancelRenamingSession();
}

function cancelRenamingSession() {
  if (el.sessionTitleInputWrapper) el.sessionTitleInputWrapper.style.display = 'none';
  if (el.activeSessionTitle) el.activeSessionTitle.style.display = '';
  if (el.renameSessionBtn) el.renameSessionBtn.style.display = '';
}

function promptRenameSession() {
  startRenamingSession();
}

function updateSessionModel(model) {
  state.activeModel = model;
  if (state.currentSession) {
    state.currentSession.model = model;
  }
  if (state.currentSessionId) {
    fetch(`/api/sessions/${state.currentSessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model })
    }).catch(console.error);
  }
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active_model: model })
  }).catch(console.error);
  updateModelRateBadge(model);
}

function updateSessionTelemetry(session) {
  const totalTok = (session.total_prompt_tokens + session.total_completion_tokens) || 0;
  const costCny = (session.total_cost_cny || 0).toFixed(4);
  const costUsd = (session.total_cost_usd || 0).toFixed(4);

  el.sessionTokensDisplay.innerHTML = `${totalTok.toLocaleString()} tok <span class="cost-sub">(¥${costCny} / $${costUsd})</span>`;

  // Cache efficiency calculation
  const hit = session.total_cache_hit_tokens || 0;
  const miss = session.total_cache_miss_tokens || 0;
  const promptSum = hit + miss;
  const hitRate = promptSum > 0 ? Math.round((hit / promptSum) * 100) : 0;

  el.cacheRatePercent.textContent = `${hitRate}%`;

  // Savings in CNY
  const savedCny = (hit * (1.00 - 0.14) / 1_000_000).toFixed(4);
  el.cacheSavingsDisplay.textContent = `Saved: ¥${savedCny}`;

  // Update Context Gauge (assuming 64k window for deepseek)
  const maxContext = 64000;
  const gaugePercent = Math.min(100, Math.round((totalTok / maxContext) * 100));
  el.contextGaugeFill.style.width = `${Math.max(2, gaugePercent)}%`;
  el.contextGaugeText.textContent = `${(totalTok / 1000).toFixed(1)}k / 64k tok (${gaugePercent}%)`;

  if (gaugePercent > 80) {
    el.contextGaugeFill.style.background = 'var(--red-danger)';
  } else if (gaugePercent > 50) {
    el.contextGaugeFill.style.background = 'var(--amber-reason)';
  } else {
    el.contextGaugeFill.style.background = 'var(--ds-cyan)';
  }
}

async function loadLifetimeStats() {
  try {
    const res = await fetch('/api/stats/overview');
    const data = await res.json();
    el.ltTotalTokens.textContent = (data.total_tokens || 0).toLocaleString();
    el.ltTotalCost.textContent = `¥${(data.total_cost_cny || 0).toFixed(2)}`;
    el.ltTotalSaved.textContent = `¥${(data.saved_cny || 0).toFixed(2)}`;
  } catch (err) {
    console.error('Failed to load lifetime stats:', err);
  }
}

// ==========================================================================
// Rendering Messages & Markdown
// ==========================================================================

function renderMessages(messages) {
  el.messagesFlow.innerHTML = '';
  if (!messages || messages.length === 0) {
    el.welcomeScreen.style.display = 'flex';
    return;
  }

  el.welcomeScreen.style.display = 'none';
  messages.forEach(msg => appendMessageElement(msg));
  scrollToBottom();
}

function appendMessageElement(msg) {
  const row = document.createElement('div');
  row.className = `message-row ${msg.role}`;
  row.id = `msg-${msg.id}`;

  if (msg.role === 'user') {
    let bubbleHtml = '';
    let parsedContent = msg.content;
    try {
      if (typeof parsedContent === 'string' && (parsedContent.startsWith('[') || parsedContent.startsWith('{'))) {
        parsedContent = JSON.parse(parsedContent);
      }
    } catch (_) {}

    if (Array.isArray(parsedContent)) {
      let textContent = '';
      let imgHtml = '';
      for (const part of parsedContent) {
        if (part.type === 'text') {
          textContent += (textContent ? '\n' : '') + part.text;
        } else if (part.type === 'image_url' && part.image_url?.url) {
          imgHtml += `<div class="msg-img-preview"><img src="${part.image_url.url}" alt="Screenshot" onclick="window.open('${part.image_url.url}')" title="Click to view full image" /></div>`;
        }
      }
      bubbleHtml = imgHtml + (textContent ? `<div>${escapeHtml(textContent)}</div>` : '');
    } else {
      bubbleHtml = escapeHtml(msg.content);
    }

    row.dataset.rawContent = typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content;

    row.innerHTML = `
      <div class="msg-header">
        <span class="msg-sender">You</span>
        <span>•</span>
        <span>${formatTime(msg.created_at)}</span>
      </div>
      <div class="user-bubble">${bubbleHtml}</div>
    `;
  } else {
    // Assistant message
    const body = document.createElement('div');
    body.className = 'assistant-body';

    // R1 Reasoning Accordion (if reasoning_content exists)
    let reasoningHtml = '';
    if (msg.reasoning_content && msg.reasoning_content.trim()) {
      reasoningHtml = `
        <div class="reasoning-box">
          <div class="reasoning-header" onclick="this.parentElement.classList.toggle('collapsed');">
            <div class="rh-left">
              <span class="pulse-brain">🧠</span>
              <span class="reasoning-title">${escapeHtml(msg.model || state.activeModel)} Thinking Process</span>
            </div>
            <span class="reasoning-toggle-icon">▼</span>
          </div>
          <div class="reasoning-content">${escapeHtml(msg.reasoning_content)}</div>
        </div>
      `;
    }

    // Main Answer Content
    const contentHtml = `
      <div class="assistant-content">${renderMarkdown(msg.content)}</div>
    `;

    // Telemetry Footer
    let telemetryHtml = '';
    if (msg.total_tokens > 0) {
      const hit = msg.prompt_cache_hit_tokens || 0;
      const miss = msg.prompt_cache_miss_tokens || 0;
      const comp = msg.completion_tokens || 0;
      const costCny = (msg.cost_cny || 0).toFixed(4);
      const costUsd = (msg.cost_usd || 0).toFixed(4);
      const latencySec = (msg.latency_ms / 1000).toFixed(2);
      const savedCny = (hit * (1.00 - 0.14) / 1_000_000).toFixed(4);

      telemetryHtml = `
        <div class="telemetry-bar">
          <div class="tel-item" title="Cache hit tokens (cheaper)">
            <span class="tel-label">Cache Hit:</span>
            <span class="tel-val hit">${hit.toLocaleString()}</span>
          </div>
          <span class="tel-sep">|</span>
          <div class="tel-item" title="Cache miss tokens">
            <span class="tel-label">Miss:</span>
            <span class="tel-val">${miss.toLocaleString()}</span>
          </div>
          <span class="tel-sep">|</span>
          <div class="tel-item" title="Generated completion tokens">
            <span class="tel-label">Gen:</span>
            <span class="tel-val">${comp.toLocaleString()}</span>
          </div>
          <span class="tel-sep">|</span>
          <div class="tel-item" title="Total tokens">
            <span class="tel-label">Total:</span>
            <span class="tel-val">${msg.total_tokens.toLocaleString()} tok</span>
          </div>
          <span class="tel-sep">|</span>
          <div class="tel-item" title="Cost of this message">
            <span class="tel-label">Cost:</span>
            <span class="tel-val cost">¥${costCny} ($${costUsd})</span>
          </div>
          ${parseFloat(savedCny) > 0 ? `
            <span class="tel-sep">|</span>
            <div class="tel-item" title="Money saved via DeepSeek prefix caching">
              <span class="tel-val saved">⚡ +¥${savedCny} saved</span>
            </div>
          ` : ''}
          <span class="tel-sep">|</span>
          <div class="tel-item" title="Latency">
            <span class="tel-label">${latencySec}s</span>
          </div>
        </div>
      `;
    }

    row.innerHTML = `
      <div class="msg-header">
        <span class="msg-sender">DeepSeek</span>
        <span class="msg-model-badge">${escapeHtml(msg.model || state.activeModel)}</span>
        <span>•</span>
        <span>${formatTime(msg.created_at)}</span>
      </div>
      <div class="assistant-body">
        ${reasoningHtml}
        ${contentHtml}
        ${telemetryHtml}
      </div>
    `;
  }

  el.messagesFlow.appendChild(row);
  bindCodeBlockActions(row);
}

// ==========================================================================
// Streaming Chat Execution (Zero Token Wastage + Live Telemetry)
// ==========================================================================

async function handleSendMessage() {
  const textContent = el.promptTextarea.value.trim();
  const hasAttachment = Boolean(state.attachedImage);
  if ((!textContent && !hasAttachment) || state.isStreaming) return;

  // Inject attached context files if any (@file tags)
  let effectiveText = textContent;
  if (state.attachedContextFiles && state.attachedContextFiles.length > 0) {
    const contextPrefix = state.attachedContextFiles.map(f => `--- File Context: ${f.path} ---\n${f.content}\n--- End of ${f.path} ---`).join('\n\n');
    effectiveText = `${contextPrefix}\n\nUser Question:\n${textContent}`;
    state.attachedContextFiles = [];
    renderContextTags();
  }

  // Clear input and attachment
  let userPayload;
  if (hasAttachment) {
    userPayload = [
      { type: 'text', text: effectiveText || 'Analyze this error screenshot and provide the diagnosis and fix.' },
      { type: 'image_url', image_url: { url: state.attachedImage.dataUrl } }
    ];
    clearAttachedImage();
  } else {
    userPayload = effectiveText;
  }

  el.promptTextarea.value = '';
  autoResizeTextarea(el.promptTextarea);
  updatePromptTokenEstimate();

  // Hide welcome screen
  el.welcomeScreen.style.display = 'none';

  // Append user message immediately
  const userMsgId = 'u-' + Date.now();
  appendMessageElement({
    id: userMsgId,
    role: 'user',
    content: userPayload,
    created_at: Date.now()
  });

  // Setup assistant streaming message placeholder
  const assistantMsgId = 'a-' + Date.now();
  const streamRow = document.createElement('div');
  streamRow.className = 'message-row assistant';
  streamRow.id = `msg-${assistantMsgId}`;

  streamRow.innerHTML = `
    <div class="msg-header">
      <span class="msg-sender">DeepSeek</span>
      <span class="msg-model-badge">${state.activeModel}</span>
      <span>•</span>
      <span class="streaming-status">Thinking...</span>
    </div>
    <div class="assistant-body">
      <!-- R1 Reasoning Container -->
      <div class="reasoning-box thinking-active" style="display: none;">
        <div class="reasoning-header" onclick="this.parentElement.classList.toggle('collapsed');">
          <div class="rh-left">
            <span class="pulse-brain">🧠</span>
            <span class="reasoning-title">${escapeHtml(state.activeModel)} Thinking Process</span>
            <span class="reasoning-timer">(0.0s)</span>
          </div>
          <span class="reasoning-toggle-icon">▼</span>
        </div>
        <div class="reasoning-content"></div>
      </div>

      <!-- Live Answer Content -->
      <div class="assistant-content">
        <span style="color: var(--text-dim); font-style: italic;">Processing tokens...</span>
      </div>

      <!-- Live Telemetry Badge Container -->
      <div class="telemetry-container"></div>
    </div>
  `;

  el.messagesFlow.appendChild(streamRow);
  scrollToBottom();

  // Set streaming state
  state.isStreaming = true;
  el.sendBtn.disabled = true;
  el.abortFloatingBar.style.display = 'block';

  // Gather conversation messages from DOM / session
  const historyMessages = [];
  const messageRows = el.messagesFlow.querySelectorAll('.message-row');
  messageRows.forEach(row => {
    if (row.classList.contains('user')) {
      let raw = row.dataset.rawContent;
      if (raw) {
        try {
          if (raw.startsWith('[') || raw.startsWith('{')) {
            raw = JSON.parse(raw);
          }
        } catch (_) {}
        historyMessages.push({ role: 'user', content: raw });
      } else {
        const bubble = row.querySelector('.user-bubble');
        if (bubble) historyMessages.push({ role: 'user', content: bubble.innerText.trim() });
      }
    } else if (row !== streamRow) {
      const contentEl = row.querySelector('.assistant-content');
      if (contentEl) historyMessages.push({ role: 'assistant', content: contentEl.innerText.trim() });
    }
  });

  // Ensure last user message is present
  if (historyMessages.length === 0) {
    historyMessages.push({ role: 'user', content: userPayload });
  }
  // Check if Arena mode is active — run dual model comparison
  if (window.DeepHarnessArena && window.DeepHarnessArena.isActive()) {
    const prompt = historyMessages[historyMessages.length - 1]?.content || userPayload;
    const history = historyMessages.slice(0, -1);
    await window.DeepHarnessArena.runArena(prompt, history);
    state.isStreaming = false;
    return;
  }

  await executeChatStream(streamRow, historyMessages);
}

// ==========================================================================
// Central Chat Stream Executor (supports live streaming, R1 reasoning & auto-resume)
// ==========================================================================

async function executeChatStream(streamRow, historyMessages) {
  if (!streamRow) return;

  // Set streaming state
  state.isStreaming = true;
  if (el.sendBtn) el.sendBtn.disabled = true;
  if (el.abortFloatingBar) el.abortFloatingBar.style.display = 'block';

  // Scoped references to elements inside streamRow (prevents ID collisions across turns!)
  let liveReasoningText = '';
  let liveContentText = '';
  const liveReasoningBox = streamRow.querySelector('.reasoning-box');
  const liveReasoningContent = streamRow.querySelector('.reasoning-content');
  const liveAssistantContent = streamRow.querySelector('.assistant-content');
  const liveThinkingTimer = streamRow.querySelector('.reasoning-timer');
  const streamingStatusText = streamRow.querySelector('.streaming-status');
  const telContainer = streamRow.querySelector('.telemetry-container');

  state.thinkingStartTime = Date.now();
  state.thinkingTimerInterval = setInterval(() => {
    const elapsed = ((Date.now() - state.thinkingStartTime) / 1000).toFixed(1);
    if (liveThinkingTimer) liveThinkingTimer.textContent = `(${elapsed}s)`;
  }, 100);

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: state.currentSessionId,
        model: state.activeModel,
        messages: historyMessages,
        system_prompt: state.systemPrompt
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errText = errData.error || `Server returned HTTP ${response.status}`;
      const errObj = new Error(errText);
      errObj.isQuotaExhausted = errData.isQuotaExhausted || isQuotaOrModelError(errText, response.status);
      errObj.statusCode = response.status;
      errObj.failedModel = errData.failedModel || state.activeModel;
      throw errObj;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') continue;

        try {
          const payload = JSON.parse(jsonStr);

          if (payload.type === 'start') {
            state.activeStreamId = payload.streamId;
          } else if (payload.type === 'reasoning') {
            // R1 Reasoning phase
            if (liveReasoningBox && liveReasoningBox.style.display === 'none') {
              liveReasoningBox.style.display = 'block';
            }
            liveReasoningText += payload.delta;
            if (liveReasoningContent) liveReasoningContent.textContent = liveReasoningText;
            if (streamingStatusText) streamingStatusText.textContent = 'Reasoning...';
            scrollToBottom();
          } else if (payload.type === 'content') {
            // Answer phase: if we were thinking, stop timer
            if (state.thinkingTimerInterval) {
              clearInterval(state.thinkingTimerInterval);
              state.thinkingTimerInterval = null;
              if (liveReasoningBox) liveReasoningBox.classList.remove('thinking-active');
            }
            if (streamingStatusText) streamingStatusText.textContent = 'Generating...';

            liveContentText += payload.delta;
            if (liveAssistantContent) {
              liveAssistantContent.innerHTML = renderMarkdown(liveContentText);
              bindCodeBlockActions(streamRow);
            }
            scrollToBottom();
          } else if (payload.type === 'done') {
            // Finished successfully
            if (streamingStatusText) streamingStatusText.textContent = formatTime(Date.now());
            if (state.thinkingTimerInterval) clearInterval(state.thinkingTimerInterval);

            // Render final telemetry into scoped container
            const usage = payload.usage;
            const costs = payload.costs;
            const latencySec = (payload.latencyMs / 1000).toFixed(2);

            if (telContainer) {
              telContainer.innerHTML = `
                <div class="telemetry-bar">
                  <div class="tel-item"><span class="tel-label">Cache Hit:</span><span class="tel-val hit">${usage.prompt_cache_hit_tokens.toLocaleString()}</span></div>
                  <span class="tel-sep">|</span>
                  <div class="tel-item"><span class="tel-label">Miss:</span><span class="tel-val">${usage.prompt_cache_miss_tokens.toLocaleString()}</span></div>
                  <span class="tel-sep">|</span>
                  <div class="tel-item"><span class="tel-label">Gen:</span><span class="tel-val">${usage.completion_tokens.toLocaleString()}</span></div>
                  <span class="tel-sep">|</span>
                  <div class="tel-item"><span class="tel-label">Total:</span><span class="tel-val">${usage.total_tokens.toLocaleString()} tok</span></div>
                  <span class="tel-sep">|</span>
                  <div class="tel-item"><span class="tel-label">Cost:</span><span class="tel-val cost">¥${costs.costCny} ($${costs.costUsd})</span></div>
                  ${costs.savedCny > 0 ? `
                    <span class="tel-sep">|</span>
                    <div class="tel-item"><span class="tel-val saved">⚡ +¥${costs.savedCny} saved</span></div>
                  ` : ''}
                  <span class="tel-sep">|</span>
                  <div class="tel-item"><span class="tel-label">${latencySec}s</span></div>
                </div>
              `;
            }

            // Refresh account balance & lifetime stats
            fetchBalance();
            loadLifetimeStats();
            loadSessions();
          } else if (payload.type === 'aborted') {
            if (streamingStatusText) streamingStatusText.textContent = 'Aborted';
            showToast('Generation halted to preserve tokens', 'info');
          } else if (payload.type === 'error') {
            const isQuota = payload.isQuotaExhausted || isQuotaOrModelError(payload.error, payload.statusCode);
            if (streamingStatusText) streamingStatusText.textContent = isQuota ? 'Quota Limit' : 'Error';

            if (isQuota) {
              state.pendingTurnRetry = {
                streamRow,
                historyMessages,
                failedModel: state.activeModel,
                error: payload.error
              };

              if (liveAssistantContent) {
                liveAssistantContent.innerHTML = `
                  <div class="quota-exhausted-alert">
                    <div class="qea-header">
                      <span class="qea-icon">⚡</span>
                      <div class="qea-text">
                        <div class="qea-title">AI Quota / Usage Exhausted (${escapeHtml(state.activeModel)})</div>
                        <div class="qea-msg">${escapeHtml(payload.error)}</div>
                      </div>
                    </div>
                    <div class="qea-actions">
                      <button type="button" class="qea-switch-btn" id="inlineSwitchResumeBtn">
                        <span>⚡ Switch Model & Resume Work</span>
                      </button>
                      <button type="button" class="qea-settings-btn" id="inlineManageProvidersBtn">
                        <span>⚙️ Manage Providers ↗</span>
                      </button>
                    </div>
                  </div>
                `;

                const resumeBtn = liveAssistantContent.querySelector('#inlineSwitchResumeBtn');
                if (resumeBtn) {
                  resumeBtn.onclick = () => openQuotaExhaustedModal({
                    failedModel: state.activeModel,
                    error: payload.error,
                    statusCode: payload.statusCode
                  });
                }
                const settingsBtn = liveAssistantContent.querySelector('#inlineManageProvidersBtn');
                if (settingsBtn) {
                  settingsBtn.onclick = () => {
                    openSettings();
                    const provTab = document.getElementById('tabBtnProviders');
                    if (provTab) provTab.click();
                  };
                }
              }

              showToast(`Quota exhausted on ${state.activeModel}. Select backup model to resume!`, 'error');

              // Automatically pop up model selector dialog smoothly!
              setTimeout(() => {
                openQuotaExhaustedModal({
                  failedModel: state.activeModel,
                  error: payload.error,
                  statusCode: payload.statusCode
                });
              }, 220);

            } else {
              if (liveAssistantContent) liveAssistantContent.innerHTML = `<span style="color: var(--red-danger);">⚠️ ${escapeHtml(payload.error)}</span>`;
              showToast(payload.error, 'error');
            }
          }
        } catch (e) {
          // ignore chunk parse issues
        }
      }
    }
  } catch (err) {
    const isQuota = err.isQuotaExhausted || isQuotaOrModelError(err.message, err.statusCode);
    if (streamingStatusText) streamingStatusText.textContent = isQuota ? 'Quota Limit' : 'Failed';

    if (isQuota) {
      state.pendingTurnRetry = {
        streamRow,
        historyMessages,
        failedModel: state.activeModel,
        error: err.message
      };

      if (liveAssistantContent) {
        liveAssistantContent.innerHTML = `
          <div class="quota-exhausted-alert">
            <div class="qea-header">
              <span class="qea-icon">⚡</span>
              <div class="qea-text">
                <div class="qea-title">AI Quota / Usage Exhausted (${escapeHtml(state.activeModel)})</div>
                <div class="qea-msg">${escapeHtml(err.message)}</div>
              </div>
            </div>
            <div class="qea-actions">
              <button type="button" class="qea-switch-btn" id="inlineSwitchResumeBtnCatch">
                <span>⚡ Switch Model & Resume Work</span>
              </button>
              <button type="button" class="qea-settings-btn" id="inlineManageProvidersBtnCatch">
                <span>⚙️ Manage Providers ↗</span>
              </button>
            </div>
          </div>
        `;

        const resumeBtn = liveAssistantContent.querySelector('#inlineSwitchResumeBtnCatch');
        if (resumeBtn) {
          resumeBtn.onclick = () => openQuotaExhaustedModal({
            failedModel: state.activeModel,
            error: err.message,
            statusCode: err.statusCode
          });
        }
        const settingsBtn = liveAssistantContent.querySelector('#inlineManageProvidersBtnCatch');
        if (settingsBtn) {
          settingsBtn.onclick = () => {
            openSettings();
            const provTab = document.getElementById('tabBtnProviders');
            if (provTab) provTab.click();
          };
        }
      }

      showToast(`Quota limit reached on ${state.activeModel}. Please select backup model!`, 'error');

      setTimeout(() => {
        openQuotaExhaustedModal({
          failedModel: state.activeModel,
          error: err.message,
          statusCode: err.statusCode
        });
      }, 220);

    } else {
      if (liveAssistantContent) liveAssistantContent.innerHTML = `<span style="color: var(--red-danger);">⚠️ Error: ${escapeHtml(err.message)}</span>`;
      showToast(err.message, 'error');
    }
  } finally {
    if (state.thinkingTimerInterval) clearInterval(state.thinkingTimerInterval);
    state.isStreaming = false;
    state.activeStreamId = null;
    if (el.sendBtn) el.sendBtn.disabled = false;
    if (el.abortFloatingBar) el.abortFloatingBar.style.display = 'none';
  }
}

// ==========================================================================
// AI Quota / Limit Exhaustion & Seamless Auto-Resume Model Switcher
// ==========================================================================

function isQuotaOrModelError(errorMsg, statusCode) {
  if (statusCode === 429 || statusCode === 402 || statusCode === 403 || statusCode === 401) return true;
  if (!errorMsg) return false;
  const lower = String(errorMsg).toLowerCase();
  const quotaKeywords = [
    'quota', 'balance', 'insufficient', 'credit', 'exceeded',
    'rate limit', 'too many requests', 'exhaust', '1113', '1114', '1301', '1302',
    'payment required', 'plan limit', 'billing', 'usage limit',
    'tokens per minute', 'out of credits', 'key is required',
    'invalid api key', 'unauthorized', '401', '402', '429'
  ];
  return quotaKeywords.some(kw => lower.includes(kw));
}

function openQuotaExhaustedModal(details = {}) {
  const failedModel = details.failedModel || state.activeModel || 'Unknown Model';
  const errorMsg = details.error || 'Usage limit or balance exhausted on this model';

  if (el.quotaFailedModelName) el.quotaFailedModelName.textContent = failedModel;
  if (el.quotaFailedErrorDetail) el.quotaFailedErrorDetail.textContent = errorMsg;

  renderQuotaModelsGrid(failedModel);

  if (el.quotaExhaustedModal) {
    el.quotaExhaustedModal.style.display = 'flex';
  }
}

function closeQuotaExhaustedModal() {
  if (el.quotaExhaustedModal) {
    el.quotaExhaustedModal.style.display = 'none';
  }
}

function renderQuotaModelsGrid(failedModel) {
  if (!el.quotaModelsGrid) return;
  el.quotaModelsGrid.innerHTML = '';

  // 1. Determine key availability per provider from state.providers
  const providerKeyMap = {};
  for (const p of state.providers || []) {
    providerKeyMap[p.id] = Boolean(p.api_key && p.api_key.trim().length > 0);
  }
  if (state.settings?.deepseek_api_key) {
    providerKeyMap['deepseek'] = true;
  }

  // 2. Candidate models from state.models or fallbacks
  let models = [...(state.models || [])];
  if (models.length === 0) {
    models = [
      { id: 'glm-5.3-flash', provider_id: 'zai', provider_name: 'Z.ai (GLM)', name: 'Z.ai: GLM-5.3-Flash (Coding Plan)' },
      { id: 'deepseek-chat', provider_id: 'deepseek', provider_name: 'DeepSeek', name: 'deepseek-chat (V4.1 Coder)' },
      { id: 'deepseek-reasoner', provider_id: 'deepseek', provider_name: 'DeepSeek', name: 'deepseek-reasoner (R1 Thinking)' },
      { id: 'deepseek/deepseek-r1', provider_id: 'openrouter', provider_name: 'OpenRouter', name: 'OpenRouter: DeepSeek R1' },
      { id: 'anthropic/claude-3.5-sonnet', provider_id: 'openrouter', provider_name: 'OpenRouter', name: 'OpenRouter: Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', provider_id: 'openrouter', provider_name: 'OpenRouter', name: 'OpenRouter: GPT-4o' }
    ];
  }

  // Calculate readiness & priority
  const enriched = models.map(m => {
    const pId = m.provider_id || (m.id.startsWith('glm') ? 'zai' : (m.id.startsWith('deepseek') ? 'deepseek' : 'openrouter'));
    const isReady = pId === 'ollama' || Boolean(providerKeyMap[pId]) || (m.has_key === 1);
    const isFailed = (m.id === failedModel);
    return { ...m, resolvedProviderId: pId, isReady, isFailed };
  });

  // Sort: Ready & not failed first, then ready & failed, then not ready
  enriched.sort((a, b) => {
    if (a.isFailed && !b.isFailed) return 1;
    if (!a.isFailed && b.isFailed) return -1;
    if (a.isReady && !b.isReady) return -1;
    if (!a.isReady && b.isReady) return 1;
    return a.id.localeCompare(b.id);
  });

  // Choose default selected model: first ready, non-failed model
  let bestCandidate = enriched.find(m => m.isReady && !m.isFailed)?.id;
  if (!bestCandidate) {
    bestCandidate = enriched.find(m => !m.isFailed)?.id || enriched[0]?.id;
  }
  state.selectedQuotaModel = bestCandidate;
  if (el.targetResumeModelName) {
    el.targetResumeModelName.textContent = bestCandidate || 'Model';
  }

  const getProviderIcon = (pId, modelId) => {
    if (pId === 'zai') return '⚡';
    if (pId === 'deepseek') return modelId.includes('reasoner') || modelId.includes('r1') ? '🧠' : '⚡';
    if (pId === 'openrouter') return '🌐';
    if (pId === 'openai') return '🤖';
    if (pId === 'groq') return '⚡';
    if (pId === 'ollama') return '🦙';
    return '🤖';
  };

  const getCapabilityTag = (modelId) => {
    if (modelId.includes('reasoner') || modelId.includes('r1')) return '🧠 Reasoning';
    if (modelId.includes('flash') || modelId.includes('chat') || modelId.includes('turbo')) return '⚡ Ultra Fast';
    if (modelId.includes('sonnet') || modelId.includes('4o')) return '🌐 Flagship';
    return '💻 Coding';
  };

  enriched.forEach(m => {
    const card = document.createElement('div');
    card.className = `qmg-card ${m.id === state.selectedQuotaModel ? 'active' : ''}`;
    card.dataset.modelId = m.id;

    const icon = getProviderIcon(m.resolvedProviderId, m.id);
    const capTag = getCapabilityTag(m.id);

    let statusBadgeHtml = '';
    if (m.isFailed) {
      statusBadgeHtml = `<span class="qmg-badge-exhausted">⚠️ Quota Exhausted</span>`;
    } else if (m.isReady) {
      statusBadgeHtml = `<span class="qmg-badge-ready">● Ready (Configured)</span>`;
    } else {
      statusBadgeHtml = `<span class="qmg-badge-no-key">○ Key Required</span>`;
    }

    const providerDisplay = m.provider_name || (m.resolvedProviderId ? m.resolvedProviderId.toUpperCase() : 'AI');

    card.innerHTML = `
      <div class="qmg-left">
        <span class="qmg-icon">${icon}</span>
        <div class="qmg-info">
          <div class="qmg-name">${escapeHtml(m.name || m.id)}</div>
          <div class="qmg-sub">${escapeHtml(providerDisplay)} • <span class="qmg-badge-type">${capTag}</span></div>
        </div>
      </div>
      <div class="qmg-right">
        ${statusBadgeHtml}
      </div>
    `;

    // Click to select
    card.addEventListener('click', () => {
      document.querySelectorAll('.qmg-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.selectedQuotaModel = m.id;
      if (el.targetResumeModelName) el.targetResumeModelName.textContent = m.id;
    });

    // Double-click to instant switch and resume!
    card.addEventListener('dblclick', () => {
      state.selectedQuotaModel = m.id;
      resumeTurnWithModel(m.id);
    });

    el.quotaModelsGrid.appendChild(card);
  });
}

async function resumeTurnWithModel(newModelId) {
  if (!newModelId) return;

  closeQuotaExhaustedModal();

  // 1. Update state & UI
  state.activeModel = newModelId;
  if (el.modelSelector) el.modelSelector.value = newModelId;
  updateModelRateBadge(newModelId);
  updateSessionModel(newModelId);

  // Sync execution mode buttons
  const isReasoner = newModelId.includes('reasoner') || newModelId.includes('r1');
  state.executionMode = isReasoner ? 'deep' : 'fast';
  if (el.modeFastBtn) el.modeFastBtn.classList.toggle('active', !isReasoner);
  if (el.modeDeepBtn) el.modeDeepBtn.classList.toggle('active', isReasoner);

  // 2. Check if we have a pending turn to retry
  if (!state.pendingTurnRetry) {
    showToast(`Active model switched to ${newModelId}`, 'success');
    return;
  }

  const { streamRow, historyMessages } = state.pendingTurnRetry;
  state.pendingTurnRetry = null; // Clear so it doesn't double-trigger

  showToast(`⚡ Switched to ${newModelId}! Resuming response...`, 'success');

  // Reset streamRow header & content for fresh response
  if (streamRow) {
    const badge = streamRow.querySelector('.msg-model-badge');
    if (badge) badge.textContent = newModelId;
    const statusText = streamRow.querySelector('.streaming-status');
    if (statusText) statusText.textContent = isReasoner ? 'Reasoning...' : 'Generating...';

    const reasoningBox = streamRow.querySelector('.reasoning-box');
    const reasoningTitle = streamRow.querySelector('.reasoning-title');
    const reasoningContent = streamRow.querySelector('.reasoning-content');
    if (reasoningTitle) reasoningTitle.textContent = `${newModelId} Thinking Process`;
    if (reasoningContent) reasoningContent.textContent = '';
    if (reasoningBox) {
      reasoningBox.style.display = isReasoner ? 'block' : 'none';
      reasoningBox.classList.add('thinking-active');
    }

    const assistantContent = streamRow.querySelector('.assistant-content');
    if (assistantContent) {
      assistantContent.innerHTML = `<span style="color: var(--text-dim); font-style: italic;">Resuming generation with ${escapeHtml(newModelId)}...</span>`;
    }
  }

  // 3. Resume streaming seamlessly!
  await executeChatStream(streamRow, historyMessages);
}

async function saveQuickKeyFromQuotaModal() {
  const providerId = el.quickKeyProviderSelect?.value;
  const apiKey = el.quickKeyInput?.value?.trim();
  if (!providerId || !apiKey) {
    showToast('Please enter an API Key', 'error');
    return;
  }

  showToast(`Saving API Key for ${providerId}...`, 'info');
  try {
    const provDefaults = {
      'deepseek': { name: 'DeepSeek', base_url: 'https://api.deepseek.com' },
      'zai': { name: 'Z.ai (GLM)', base_url: 'https://api.z.ai/api/coding/paas/v4' },
      'openrouter': { name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1' },
      'openai': { name: 'OpenAI', base_url: 'https://api.openai.com/v1' },
      'groq': { name: 'Groq', base_url: 'https://api.groq.com/openai/v1' }
    };
    const def = provDefaults[providerId] || { name: providerId, base_url: '' };

    const res = await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: providerId,
        name: def.name,
        base_url: def.base_url,
        api_key: apiKey
      })
    });
    const data = await res.json();
    if (data.success) {
      if (el.quickKeyInput) el.quickKeyInput.value = '';
      showToast(`✅ API Key saved for ${def.name}!`, 'success');
      await loadProviders();
      await loadModels();
      renderQuotaModelsGrid(state.pendingTurnRetry?.failedModel || state.activeModel);
    } else {
      showToast(data.error || 'Failed to save key', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function abortCurrentStream() {
  if (!state.isStreaming || !state.activeStreamId) return;
  try {
    await fetch('/api/chat/abort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamId: state.activeStreamId })
    });
    showToast('Aborted stream immediately — zero additional tokens wasted!', 'success');
  } catch (err) {
    console.error('Abort request failed:', err);
  }
}

// ==========================================================================
// Code Vault & Disk Export (Never Lose Code)
// ==========================================================================

function bindCodeBlockActions(container) {
  const blocks = container.querySelectorAll('.code-block-wrapper');
  blocks.forEach(block => {
    const copyBtn = block.querySelector('.copy-btn');
    const saveBtn = block.querySelector('.save-btn');
    const codePre = block.querySelector('pre code');
    const langTag = block.querySelector('.code-lang-tag');

    // Agentic 1-Click Apply to Workspace Button
    let applyBtn = block.querySelector('.btn-apply-agent-code');
    if (!applyBtn) {
      applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn-apply-agent-code';
      const actionsWrapper = block.querySelector('.code-header-actions') || block;
      actionsWrapper.insertBefore(applyBtn, actionsWrapper.firstChild);
    }
    if (!applyBtn.dataset.bound) {
      applyBtn.dataset.bound = 'true';
      const codeText = codePre ? codePre.textContent : '';
      let detectedFilename = null;
      const firstLines = codeText.split('\n').slice(0, 4);
      for (const line of firstLines) {
        const match = line.match(/(?:(?:filename|file|filepath):\s*|(?:\/\/|#|\/\*|<!--)\s*)([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i);
        if (match && match[1]) {
          detectedFilename = match[1].trim();
          break;
        }
      }
      const activePath = typeof state.studio.activeFile === 'string' ? state.studio.activeFile : state.studio.activeFile?.path;
      const targetFilename = detectedFilename || activePath || null;

      if (targetFilename) {
        applyBtn.innerHTML = `<span>⚡ Apply to ${targetFilename.split('/').pop()}</span>`;
        applyBtn.style.display = 'inline-flex';
        applyBtn.addEventListener('click', async () => {
          applyBtn.disabled = true;
          applyBtn.innerHTML = `<span>⏳ Writing...</span>`;
          try {
            const res = await fetch('/api/workspace/file', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: targetFilename, content: codeText })
            });
            const data = await res.json();
            if (data.success) {
              applyBtn.innerHTML = `<span>✓ Applied!</span>`;
              showToast(`⚡ Applied changes to ${targetFilename}!`, 'success');
              if (activePath === targetFilename && el.studioCodeEditor) {
                el.studioCodeEditor.value = codeText;
              }
              loadFileTree(state.studio.currentPath);
              loadGitStatus();
            } else {
              applyBtn.disabled = false;
              applyBtn.innerHTML = `<span>❌ Error</span>`;
              showToast(data.error || 'Failed to apply', 'error');
            }
          } catch (err) {
            applyBtn.disabled = false;
            applyBtn.innerHTML = `<span>❌ Error</span>`;
            showToast(err.message, 'error');
          }
        });
      } else {
        applyBtn.style.display = 'none';
      }
    }

    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.dataset.bound = 'true';
      copyBtn.addEventListener('click', () => {
        const codeText = codePre ? codePre.textContent : '';
        navigator.clipboard.writeText(codeText).then(() => {
          copyBtn.innerHTML = '<span>✓ Copied!</span>';
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>Copy</span>
            `;
          }, 2000);
        });
      });
    }

    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = 'true';
      saveBtn.title = 'Save directly into workspace (./exported_code/). Hold Shift to customize filename.';
      saveBtn.addEventListener('click', async (e) => {
        const codeText = codePre ? codePre.textContent : '';
        const lang = (langTag ? langTag.textContent : 'txt').toLowerCase();
        const ext = getExtensionForLang(lang);

        // Smart filename extraction from first 4 lines of code:
        // Matches: // filename: app.js, // app.js, # script.py, /* style.css */
        let detectedFilename = null;
        const firstLines = codeText.split('\n').slice(0, 4);
        for (const line of firstLines) {
          const match = line.match(/(?:(?:filename|file):\s*|(?:\/\/|#|\/\*|<!--)\s*)([a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]+)/i);
          if (match && match[1]) {
            detectedFilename = match[1].trim();
            break;
          }
        }

        let filename = detectedFilename || `snippet_${Date.now()}.${ext}`;
        // If Shift or Option key held, allow customizing filename
        if (e.shiftKey || e.altKey) {
          const custom = prompt('Custom filename for ./exported_code/:', filename);
          if (!custom) return;
          filename = custom.trim();
        }

        try {
          saveBtn.innerHTML = '<span>Saving...</span>';
          const res = await fetch('/api/snippets/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: state.currentSessionId,
              filename: filename,
              language: lang,
              code: codeText
            })
          });
          const result = await res.json();
          if (result.success) {
            saveBtn.innerHTML = '<span>✓ Saved!</span>';
            saveBtn.style.color = 'var(--emerald-save)';
            showToast(`💾 Saved to ./exported_code/${result.filename} (${result.size_bytes}B)`, 'success');
            loadSnippets();
            setTimeout(() => {
              saveBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/>
                </svg>
                <span>Save</span>
              `;
              saveBtn.style.color = '';
            }, 2500);
          } else {
            showToast('Save failed: ' + result.error, 'error');
            saveBtn.innerHTML = '<span>Save</span>';
          }
        } catch (e) {
          showToast('Failed to save code: ' + e.message, 'error');
          saveBtn.innerHTML = '<span>Save</span>';
        }
      });
    }

    const studioBtn = block.querySelector('.studio-btn');
    if (studioBtn && !studioBtn.dataset.bound) {
      studioBtn.dataset.bound = 'true';
      studioBtn.addEventListener('click', () => {
        const codeText = codePre ? codePre.textContent : '';
        const lang = (langTag ? langTag.textContent : 'txt').toLowerCase();
        const ext = getExtensionForLang(lang);
        let detectedFilename = null;
        const firstLines = codeText.split('\n').slice(0, 4);
        for (const line of firstLines) {
          const match = line.match(/(?:(?:filename|file):\s*|(?:\/\/|#|\/\*|<!--)\s*)([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i);
          if (match && match[1]) {
            detectedFilename = match[1].trim();
            break;
          }
        }
        const targetFilename = detectedFilename || `snippet_${Date.now()}.${ext}`;
        openStudio();
        state.studio.activeFile = {
          path: targetFilename,
          content: codeText,
          originalContent: codeText,
          isDirty: true
        };
        if (el.afbName) el.afbName.textContent = targetFilename;
        if (el.studioCodeEditor) {
          el.studioCodeEditor.value = codeText;
          updateLineNumbers(codeText);
          updateEditorStatusBar(codeText, '.' + ext, true);
        }
        setStudioViewMode('editor');
        showToast(`Opened in Studio: ${targetFilename}`, 'info');
      });
    }
  });
}

function getExtensionForLang(lang) {
  const map = {
    javascript: 'js', js: 'js',
    typescript: 'ts', ts: 'ts',
    python: 'py', py: 'py',
    go: 'go', golang: 'go',
    rust: 'rs', rs: 'rs',
    c: 'c', cpp: 'cpp', 'c++': 'cpp',
    html: 'html', css: 'css', json: 'json',
    sql: 'sql', sh: 'sh', bash: 'sh',
    yaml: 'yaml', yml: 'yaml', markdown: 'md', md: 'md'
  };
  return map[lang] || 'txt';
}

async function loadSnippets() {
  try {
    const res = await fetch('/api/snippets');
    const snippets = await res.json();
    el.vaultCountBadge.textContent = snippets.length;

    el.vaultList.innerHTML = '';
    if (snippets.length === 0) {
      el.vaultList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-dim); font-size: 12px;">No code snippets saved yet.<br>Click "Save to Disk" on any code block in chat to persist it!</div>';
      return;
    }

    snippets.forEach(s => {
      const item = document.createElement('div');
      item.className = 'vault-item';
      item.innerHTML = `
        <div class="vi-top">
          <span class="vi-filename">${escapeHtml(s.filename)}</span>
          <span class="vi-lang">${escapeHtml(s.language)}</span>
        </div>
        <div class="vi-path">${escapeHtml(s.saved_path)}</div>
        <div class="vi-actions">
          <button class="btn-ghost-sm copy-snippet-btn" data-code="${escapeHtml(s.code)}">Copy</button>
          <button class="btn-ghost-sm download-snippet-btn" data-name="${escapeHtml(s.filename)}" data-code="${escapeHtml(s.code)}">Download</button>
        </div>
      `;

      item.querySelector('.copy-snippet-btn').addEventListener('click', (e) => {
        navigator.clipboard.writeText(s.code).then(() => showToast('Copied to clipboard', 'success'));
      });

      item.querySelector('.download-snippet-btn').addEventListener('click', (e) => {
        downloadFile(s.filename, s.code);
      });

      el.vaultList.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load snippets:', err);
  }
}

function openVault() {
  loadSnippets();
  el.vaultBackdrop.style.display = 'block';
  el.vaultDrawer.style.display = 'flex';
}

function closeVault() {
  el.vaultBackdrop.style.display = 'none';
  el.vaultDrawer.style.display = 'none';
}

function downloadFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportSessionTranscript() {
  if (!state.currentSession) return;
  const messages = el.messagesFlow.querySelectorAll('.message-row');
  let md = `# ${state.currentSession.title}\n\n`;
  md += `**Model**: ${state.activeModel}\n`;
  md += `**Date**: ${new Date(state.currentSession.created_at).toLocaleString()}\n\n---\n\n`;

  messages.forEach(row => {
    if (row.classList.contains('user')) {
      const text = row.querySelector('.user-bubble')?.textContent || '';
      md += `### 👤 User\n\n${text}\n\n`;
    } else {
      const reasoning = row.querySelector('.reasoning-content')?.textContent || '';
      const content = row.querySelector('.assistant-content')?.innerText || '';
      md += `### 🧠 DeepSeek\n\n`;
      if (reasoning.trim()) {
        md += `<details><summary>Thinking Process</summary>\n\n${reasoning}\n\n</details>\n\n`;
      }
      md += `${content}\n\n---\n\n`;
    }
  });

  const safeTitle = state.currentSession.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadFile(`${safeTitle}.md`, md);
  showToast('Session exported as Markdown!', 'success');
}

// ==========================================================================
// Helpers: Markdown Parser, Token Estimator, Utilities
// ==========================================================================

function renderMarkdown(text) {
  if (!text) return '';

  // 1. Extract and safeguard code blocks
  const codeBlocks = [];
  let processed = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: lang.trim() || 'text', code });
    return id;
  });

  // 2. Escape standard HTML in the remaining text
  processed = escapeHtml(processed);

  // 3. Headers
  processed = processed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  processed = processed.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  processed = processed.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // 4. Bold and Italic
  processed = processed.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 5. Inline Code
  processed = processed.replace(/`([^`]+)`/g, '<inline-code>$1</inline-code>');

  // 6. Blockquotes
  processed = processed.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // 7. Bullet lists
  processed = processed.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  processed = processed.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');

  // 8. Paragraphs and Line Breaks
  const paragraphs = processed.split(/\n\s*\n/);
  processed = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<blockquote') || p.startsWith('__CODE_BLOCK_')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  // 9. Reinsert code blocks
  codeBlocks.forEach((b, index) => {
    const placeholder = `__CODE_BLOCK_${index}__`;
    const blockHtml = `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span class="code-lang-tag">${escapeHtml(b.lang)}</span>
          <div class="code-actions">
            <button class="code-btn copy-btn" title="Copy code snippet">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>Copy</span>
            </button>
            <button class="code-btn save-btn" title="Save file to workspace (exported_code/)">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              <span>Save</span>
            </button>
            <button class="code-btn studio-btn" title="Open and edit directly in Studio">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span>Studio</span>
            </button>
          </div>
        </div>
        <pre class="code-pre"><code>${escapeHtml(b.code)}</code></pre>
      </div>
    `;
    processed = processed.replace(placeholder, blockHtml);
  });

  return processed;
}

function updatePromptTokenEstimate() {
  const text = el.promptTextarea.value || '';
  evaluateAutoRoute(text);

  // Estimate draft tokens
  const draftTextTokens = text.trim() ? Math.ceil(text.length / 3.8) : 0;
  const imageTokens = state.attachedImage ? 250 : 0;
  const draftTotal = draftTextTokens + imageTokens;

  // Calculate session history tokens
  const sessionHistoryTokens = (state.currentSession?.total_prompt_tokens || 0) + (state.currentSession?.total_completion_tokens || 0);

  const totalFlightTokens = draftTotal + sessionHistoryTokens;
  if (totalFlightTokens === 0) {
    el.promptTokenMeter.textContent = 'Est: ~0 tok';
    el.promptTokenMeter.title = 'Pre-Flight: Ready for input';
    el.promptTokenMeter.classList.remove('heavy-warning');
    return;
  }

  // Cache discount calculation:
  // History is prefix cached at ¥0.14/Mtok (86% discount)
  // New draft is cache miss at ¥1.00/Mtok
  const hitRate = 0.14;
  const missRate = 1.00;

  const estCostCny = ((sessionHistoryTokens * hitRate) + (draftTotal * missRate)) / 1_000_000;
  const estCostUsd = estCostCny / 7.2;
  const cachePct = totalFlightTokens > 0 ? Math.round((sessionHistoryTokens / totalFlightTokens) * 100) : 0;

  const isHeavy = totalFlightTokens > 15000;
  el.promptTokenMeter.classList.toggle('heavy-warning', isHeavy);

  const formatTok = totalFlightTokens >= 1000 ? `${(totalFlightTokens / 1000).toFixed(1)}k` : totalFlightTokens;
  el.promptTokenMeter.textContent = `${isHeavy ? '⚠️ ' : ''}Est: ~${formatTok} tok (≈ ¥${estCostCny.toFixed(4)}) • ⚡ ${cachePct}% Cache`;
  el.promptTokenMeter.title = `Pre-Flight Breakdown:\n• Draft: ~${draftTotal} tokens\n• History: ~${sessionHistoryTokens} tokens\n• Active Model: ${state.activeModel}\n• Cache Hit Rate: ${cachePct}%\n• Estimated Cost: ¥${estCostCny.toFixed(5)} ($${estCostUsd.toFixed(6)})`;
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(200, textarea.scrollHeight) + 'px';
}

function scrollToBottom() {
  el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
  `;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// ==========================================================================
// Workspace Studio: File Tree, Code Editor, Git & Pull Requests
// ==========================================================================

function openStudio() {
  if (!el.studioDrawer) return;
  state.studio.isOpen = true;
  el.studioBackdrop.style.display = 'block';
  el.studioDrawer.style.display = 'flex';
  loadWorkspaceConfig();
  loadFileTree(state.studio.currentPath);
  loadGitStatus();
  setupCodeEditorEvents();
}

function closeStudio() {
  if (!el.studioDrawer) return;
  state.studio.isOpen = false;
  el.studioBackdrop.style.display = 'none';
  el.studioDrawer.style.display = 'none';
}

function toggleStudio() {
  if (state.studio.isOpen) {
    closeStudio();
  } else {
    openStudio();
  }
}

function switchStudioTab(tab) {
  state.studio.activeTab = tab;
  if (el.studioTabBtnFiles) el.studioTabBtnFiles.classList.toggle('active', tab === 'files');
  if (el.studioTabBtnGit) el.studioTabBtnGit.classList.toggle('active', tab === 'git');
  if (el.studioTabBtnTerminal) el.studioTabBtnTerminal.classList.toggle('active', tab === 'terminal');
  if (el.studioPanelFiles) el.studioPanelFiles.style.display = tab === 'files' ? 'flex' : 'none';
  if (el.studioPanelGit) el.studioPanelGit.style.display = tab === 'git' ? 'flex' : 'none';
  if (el.studioPanelTerminal) el.studioPanelTerminal.style.display = tab === 'terminal' ? 'flex' : 'none';
  if (tab === 'git') {
    loadGitStatus();
  } else if (tab === 'files') {
    loadFileTree(state.studio.currentPath);
  }
}

async function loadWorkspaceConfig() {
  try {
    const res = await fetch('/api/workspace/config');
    const data = await res.json();
    state.studio.root = data.root;
    if (el.studioRootDisplay) {
      el.studioRootDisplay.textContent = data.root ? (data.root.split('/').pop() || data.root) : '/workspace';
      el.studioRootBadge.title = `Root: ${data.root} (Click to open folder)`;
    }
  } catch (err) {
    console.error('Failed to load workspace config:', err);
  }
}

function applyNewWorkspaceRoot(newRoot) {
  state.studio.root = newRoot;
  state.studio.currentPath = '';
  state.studio.activeFile = null;
  const folderName = newRoot.split('/').pop() || newRoot;
  if (el.studioRootDisplay) {
    el.studioRootDisplay.textContent = folderName;
    el.studioRootBadge.title = `Root: ${newRoot} (Click to open folder)`;
  }
  if (el.afbName) el.afbName.textContent = 'No file selected';
  if (el.studioCodeEditor) el.studioCodeEditor.value = '';
  showToast(`📁 Workspace switched to: ${folderName}`, 'success');
  loadFileTree('');
  loadGitStatus();
}

async function pickWorkspaceFolder() {
  showToast('Opening macOS folder picker...', 'info');
  try {
    const res = await fetch('/api/workspace/pick-folder', { method: 'POST' });
    const data = await res.json();
    if (data.canceled) {
      return;
    }
    if (data.success && data.root) {
      applyNewWorkspaceRoot(data.root);
      closeOpenFolderModal();
    } else {
      showToast(data.error || 'Failed to select folder', 'error');
    }
  } catch (err) {
    openOpenFolderModal();
  }
}

function openOpenFolderModal() {
  if (el.openFolderModal) {
    if (el.customFolderPathInput) el.customFolderPathInput.value = state.studio.root || '';
    if (el.openFolderStatusNotice) el.openFolderStatusNotice.style.display = 'none';
    el.openFolderModal.style.display = 'flex';
    setTimeout(() => el.customFolderPathInput?.focus(), 50);
  }
}

function closeOpenFolderModal() {
  if (el.openFolderModal) el.openFolderModal.style.display = 'none';
}

async function submitCustomFolder() {
  const targetPath = el.customFolderPathInput?.value?.trim();
  if (!targetPath) {
    showOpenFolderNotice('Please enter a folder path', 'error');
    return;
  }
  showOpenFolderNotice('Switching workspace...', 'info');
  try {
    const res = await fetch('/api/workspace/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: targetPath })
    });
    const data = await res.json();
    if (data.success) {
      closeOpenFolderModal();
      applyNewWorkspaceRoot(data.root);
    } else {
      showOpenFolderNotice(data.error || 'Failed to switch workspace', 'error');
    }
  } catch (err) {
    showOpenFolderNotice(err.message, 'error');
  }
}

function showOpenFolderNotice(msg, type) {
  if (!el.openFolderStatusNotice) return;
  el.openFolderStatusNotice.textContent = msg;
  el.openFolderStatusNotice.className = `pr-result-notice ${type}`;
  el.openFolderStatusNotice.style.display = 'block';
}

function openNewProjectModal() {
  if (el.newProjectModal) {
    if (el.newProjectNameInput) el.newProjectNameInput.value = '';
    const currentRoot = state.studio.root || '';
    const parentDir = currentRoot.split('/').slice(0, -1).join('/') || currentRoot;
    if (el.newProjectParentInput) el.newProjectParentInput.value = parentDir;
    if (el.newProjectStatusNotice) el.newProjectStatusNotice.style.display = 'none';
    if (el.newProjectInitGit) el.newProjectInitGit.checked = true;

    // Default template: web
    state.selectedProjectTemplate = 'web';
    document.querySelectorAll('.template-card').forEach(card => {
      card.classList.toggle('active', card.dataset.template === 'web');
    });

    el.newProjectModal.style.display = 'flex';
    setTimeout(() => el.newProjectNameInput?.focus(), 50);
  }
}

function closeNewProjectModal() {
  if (el.newProjectModal) el.newProjectModal.style.display = 'none';
}

async function browseNewProjectLocation() {
  try {
    const res = await fetch('/api/workspace/pick-folder', { method: 'POST' });
    const data = await res.json();
    if (data.success && data.root && el.newProjectParentInput) {
      el.newProjectParentInput.value = data.root;
    }
  } catch (e) {}
}

async function submitCreateProject() {
  const name = el.newProjectNameInput?.value?.trim();
  const parentDir = el.newProjectParentInput?.value?.trim();
  const template = state.selectedProjectTemplate || 'web';
  const initGit = el.newProjectInitGit ? el.newProjectInitGit.checked : true;

  if (!name) {
    showNewProjectNotice('Please enter a project name', 'error');
    if (el.newProjectNameInput) el.newProjectNameInput.focus();
    return;
  }

  showNewProjectNotice('🚀 Scaffolding project files & initializing...', 'info');
  if (el.confirmNewProjectBtn) el.confirmNewProjectBtn.disabled = true;

  try {
    const res = await fetch('/api/workspace/create-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentDir, template, initGit })
    });
    const data = await res.json();
    if (el.confirmNewProjectBtn) el.confirmNewProjectBtn.disabled = false;

    if (data.success) {
      closeNewProjectModal();
      showToast(`🎉 Project "${data.name}" created!`, 'success');
      applyNewWorkspaceRoot(data.root);
    } else {
      showNewProjectNotice(data.error || 'Failed to create project', 'error');
    }
  } catch (err) {
    if (el.confirmNewProjectBtn) el.confirmNewProjectBtn.disabled = false;
    showNewProjectNotice(err.message, 'error');
  }
}

function showNewProjectNotice(msg, type) {
  if (!el.newProjectStatusNotice) return;
  el.newProjectStatusNotice.textContent = msg;
  el.newProjectStatusNotice.className = `pr-result-notice ${type}`;
  el.newProjectStatusNotice.style.display = 'block';
}

async function loadFileTree(dirPath = '') {
  state.studio.currentPath = dirPath;
  if (!el.fileTreeContainer) return;

  el.fileTreeContainer.innerHTML = '<div style="padding: 10px; font-size: 11px; color: var(--text-dim);">Loading files...</div>';

  try {
    const res = await fetch(`/api/workspace/tree?path=${encodeURIComponent(dirPath)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    el.fileTreeContainer.innerHTML = '';

    if (dirPath) {
      const parentDir = dirPath.split('/').slice(0, -1).join('/');
      const upItem = document.createElement('div');
      upItem.className = 'tree-item';
      upItem.innerHTML = `<span class="tree-item-icon">📁</span><span class="tree-item-name">.. (Back)</span>`;
      upItem.addEventListener('click', () => loadFileTree(parentDir));
      el.fileTreeContainer.appendChild(upItem);
    }

    if (!data.items || data.items.length === 0) {
      el.fileTreeContainer.innerHTML += '<div style="padding: 12px; font-size: 11px; color: var(--text-dim); text-align: center;">Empty folder</div>';
      return;
    }

    const filter = (el.fileTreeFilter?.value || '').toLowerCase();

    data.items.forEach(item => {
      if (filter && !item.name.toLowerCase().includes(filter)) return;

      const div = document.createElement('div');
      div.className = `tree-item ${state.studio.activeFile?.path === item.path ? 'active' : ''}`;
      div.setAttribute('data-path', item.path);

      let icon = '📄';
      if (item.isDirectory) icon = '📁';
      else if (item.ext === '.js') icon = '⚡';
      else if (item.ext === '.html') icon = '🌐';
      else if (item.ext === '.css') icon = '🎨';
      else if (item.ext === '.json') icon = '📦';
      else if (item.ext === '.md') icon = '📝';
      else if (item.ext === '.py') icon = '🐍';
      else if (item.ext === '.sh') icon = '🐚';

      const sizeStr = item.isDirectory ? '' : formatBytes(item.size);

      div.innerHTML = `
        <span class="tree-item-icon">${icon}</span>
        <span class="tree-item-name">${escapeHtml(item.name)}</span>
        <span class="tree-item-size">${sizeStr}</span>
      `;

      div.addEventListener('click', () => {
        if (item.isDirectory) {
          loadFileTree(item.path);
        } else {
          openFileInEditor(item.path);
        }
      });

      el.fileTreeContainer.appendChild(div);
    });
  } catch (err) {
    el.fileTreeContainer.innerHTML = `<div style="padding: 12px; font-size: 11px; color: var(--red-danger);">Error reading directory: ${escapeHtml(err.message)}</div>`;
  }
}

async function openFileInEditor(relPath) {
  try {
    const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(relPath)}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();

    state.studio.activeFile = {
      path: relPath,
      content: data.content,
      originalContent: data.content,
      isDirty: false
    };

    if (el.afbName) el.afbName.textContent = relPath;
    document.querySelectorAll('.tree-item').forEach(it => {
      it.classList.toggle('active', it.getAttribute('data-path') === relPath);
    });

    if (el.studioCodeEditor) el.studioCodeEditor.value = data.content;
    updateLineNumbers(data.content);
    updateEditorStatusBar(data.content, data.ext, false);

    setStudioViewMode('editor');
  } catch (err) {
    showToast(`Failed to open file: ${err.message}`, 'error');
  }
}

function updateLineNumbers(text) {
  if (!el.editorLineNumbers) return;
  const lineCount = (text || '').split('\n').length;
  let nums = '';
  for (let i = 1; i <= lineCount; i++) {
    nums += i + '\n';
  }
  el.editorLineNumbers.textContent = nums;
}

function updateEditorStatusBar(text, ext = '', isDirty = false) {
  const charCount = (text || '').length;
  const bytes = new Blob([text || '']).size;

  if (el.editorCharCount) el.editorCharCount.textContent = `${charCount.toLocaleString()} chars`;
  if (el.editorFileSize) el.editorFileSize.textContent = formatBytes(bytes);
  if (el.editorDirtyIndicator) {
    el.editorDirtyIndicator.className = `dirty-badge ${isDirty ? 'unsaved' : 'clean'}`;
    el.editorDirtyIndicator.textContent = isDirty ? '● Unsaved' : 'Saved';
  }
  if (el.editorFileLang) {
    const langMap = {
      '.js': 'JavaScript', '.html': 'HTML', '.css': 'CSS',
      '.json': 'JSON', '.md': 'Markdown', '.py': 'Python',
      '.sh': 'Shell', '.ts': 'TypeScript'
    };
    el.editorFileLang.textContent = langMap[ext] || (ext ? ext.toUpperCase() : 'Plain Text');
  }
}

async function saveCurrentFile() {
  if (!state.studio.activeFile) {
    showToast('No active file to save', 'warning');
    return;
  }

  const filePath = state.studio.activeFile.path;
  const content = el.studioCodeEditor ? el.studioCodeEditor.value : '';

  try {
    const res = await fetch('/api/workspace/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    state.studio.activeFile.content = content;
    state.studio.activeFile.originalContent = content;
    state.studio.activeFile.isDirty = false;

    const ext = '.' + filePath.split('.').pop();
    updateEditorStatusBar(content, ext, false);
    showToast(`💾 Saved ${filePath}`, 'success');

    loadGitStatus();
  } catch (err) {
    showToast(`Failed to save file: ${err.message}`, 'error');
  }
}

function createNewFilePrompt() {
  const defaultDir = state.studio.currentPath ? state.studio.currentPath + '/' : '';
  const input = prompt('New File relative path:', defaultDir + 'untitled.js');
  if (!input || !input.trim()) return;

  const targetPath = input.trim();
  fetch('/api/workspace/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: targetPath, type: 'file' })
  }).then(res => res.json()).then(data => {
    if (data.success) {
      showToast(`Created ${targetPath}`, 'success');
      loadFileTree(state.studio.currentPath);
      openFileInEditor(targetPath);
    } else {
      showToast(data.error || 'Failed to create file', 'error');
    }
  });
}

function setStudioViewMode(mode) {
  state.studio.viewMode = mode;
  if (el.svmEditorBtn) el.svmEditorBtn.classList.toggle('active', mode === 'editor');
  if (el.svmSplitBtn) el.svmSplitBtn.classList.toggle('active', mode === 'split');
  if (el.svmPreviewBtn) el.svmPreviewBtn.classList.toggle('active', mode === 'preview');
  if (el.svmDiffBtn) el.svmDiffBtn.classList.toggle('active', mode === 'diff');

  if (el.studioEditorArea) {
    el.studioEditorArea.classList.toggle('split-mode', mode === 'split');
  }

  if (mode === 'editor') {
    if (el.editorViewContainer) el.editorViewContainer.style.display = 'flex';
    if (el.diffViewContainer) el.diffViewContainer.style.display = 'none';
    if (el.previewViewContainer) el.previewViewContainer.style.display = 'none';
  } else if (mode === 'preview') {
    if (el.editorViewContainer) el.editorViewContainer.style.display = 'none';
    if (el.diffViewContainer) el.diffViewContainer.style.display = 'none';
    if (el.previewViewContainer) el.previewViewContainer.style.display = 'flex';
    reloadPreview();
  } else if (mode === 'split') {
    if (el.editorViewContainer) el.editorViewContainer.style.display = 'flex';
    if (el.diffViewContainer) el.diffViewContainer.style.display = 'none';
    if (el.previewViewContainer) el.previewViewContainer.style.display = 'flex';
    reloadPreview();
  } else if (mode === 'diff') {
    if (el.editorViewContainer) el.editorViewContainer.style.display = 'none';
    if (el.diffViewContainer) el.diffViewContainer.style.display = 'flex';
    if (el.previewViewContainer) el.previewViewContainer.style.display = 'none';
  }
}

function reloadPreview() {
  if (!el.studioPreviewIframe) return;
  let targetUrl = el.previewUrlInput?.value?.trim() || '/api/workspace/preview/';
  if (!targetUrl.startsWith('http') && !targetUrl.startsWith('/')) {
    targetUrl = 'http://' + targetUrl;
  }
  el.studioPreviewIframe.src = targetUrl;
}

function setPreviewDevice(device) {
  if (!el.previewFrameWrapper) return;
  el.previewDeviceDesktop?.classList.toggle('active', device === 'desktop');
  el.previewDeviceTablet?.classList.toggle('active', device === 'tablet');
  el.previewDeviceMobile?.classList.toggle('active', device === 'mobile');
  el.previewFrameWrapper.className = `preview-frame-wrapper ${device === 'desktop' ? '' : device}`;
}

function openPreviewExternal() {
  let targetUrl = el.previewUrlInput?.value?.trim() || '/api/workspace/preview/';
  if (targetUrl.startsWith('/')) {
    targetUrl = window.location.origin + targetUrl;
  } else if (!targetUrl.startsWith('http')) {
    targetUrl = 'http://' + targetUrl;
  }
  window.open(targetUrl, '_blank');
}

// Integrated Terminal Runner & Autonomous Fixer
async function runTerminalCommand(cmd) {
  if (!cmd || !cmd.trim()) return;
  switchStudioTab('terminal');

  if (el.btnKillProcess) el.btnKillProcess.disabled = false;
  if (el.studioTermBadge) el.studioTermBadge.style.display = 'inline';
  if (el.terminalAutoFixBanner) el.terminalAutoFixBanner.style.display = 'none';

  if (state.terminal.eventSource) {
    state.terminal.eventSource.close();
    state.terminal.eventSource = null;
  }

  appendTerminalLog('info', `\n$ ${cmd}\n`);

  try {
    const res = await fetch('/api/terminal/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    const data = await res.json();
    if (!data.id) {
      appendTerminalLog('error', `Failed to start process: ${data.error || 'Unknown error'}\n`);
      if (el.btnKillProcess) el.btnKillProcess.disabled = true;
      if (el.studioTermBadge) el.studioTermBadge.style.display = 'none';
      return;
    }

    state.terminal.currentId = data.id;
    state.terminal.isRunning = true;
    state.terminal.lastCommand = cmd;
    state.terminal.lastError = '';

    const evtSource = new EventSource(`/api/terminal/stream?id=${data.id}`);
    state.terminal.eventSource = evtSource;

    evtSource.onmessage = (event) => {
      try {
        const item = JSON.parse(event.data);
        appendTerminalLog(item.type, item.text);

        if (item.type === 'stderr') {
          state.terminal.lastError += item.text;
        }

        if (item.text.includes('Process finished (code 0)')) {
          state.terminal.isRunning = false;
          if (el.btnKillProcess) el.btnKillProcess.disabled = true;
          if (el.studioTermBadge) el.studioTermBadge.style.display = 'none';
          evtSource.close();
        } else if (item.text.includes('Process exited with code')) {
          state.terminal.isRunning = false;
          if (el.btnKillProcess) el.btnKillProcess.disabled = true;
          if (el.studioTermBadge) el.studioTermBadge.style.display = 'none';
          evtSource.close();
          showTerminalAutoFixBanner(state.terminal.lastError || item.text);
        }
      } catch (e) {}
    };

    evtSource.onerror = () => {
      evtSource.close();
      if (el.btnKillProcess) el.btnKillProcess.disabled = true;
      if (el.studioTermBadge) el.studioTermBadge.style.display = 'none';
    };

  } catch (err) {
    appendTerminalLog('error', `Execution error: ${err.message}\n`);
    if (el.btnKillProcess) el.btnKillProcess.disabled = true;
    if (el.studioTermBadge) el.studioTermBadge.style.display = 'none';
  }
}

function appendTerminalLog(type, text) {
  if (!el.terminalConsole) return;
  const span = document.createElement('span');
  span.className = `terminal-log-line ${type}`;
  span.textContent = text;
  el.terminalConsole.appendChild(span);
  el.terminalConsole.scrollTop = el.terminalConsole.scrollHeight;
}

function clearTerminalConsole() {
  if (el.terminalConsole) {
    el.terminalConsole.innerHTML = '<div class="terminal-log-line info">Console cleared.</div>';
  }
  if (el.terminalAutoFixBanner) el.terminalAutoFixBanner.style.display = 'none';
}

async function killTerminalProcess() {
  if (!state.terminal.currentId) return;
  try {
    await fetch('/api/terminal/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: state.terminal.currentId })
    });
    appendTerminalLog('info', '\n⏹ Process termination requested.\n');
    if (el.btnKillProcess) el.btnKillProcess.disabled = true;
    if (el.studioTermBadge) el.studioTermBadge.style.display = 'none';
  } catch (e) {}
}

function handleTerminalInputSubmit() {
  const cmd = el.terminalInputCmd?.value?.trim();
  if (!cmd) return;
  el.terminalInputCmd.value = '';
  runTerminalCommand(cmd);
}

function handleQuickDevServer() {
  fetch('/api/workspace/file?path=package.json').then(res => {
    if (res.ok) {
      runTerminalCommand('npm run dev || npm start');
    } else {
      fetch('/api/workspace/file?path=main.py').then(pyRes => {
        if (pyRes.ok) {
          runTerminalCommand('python3 main.py');
        } else {
          setStudioViewMode('split');
          showToast('Live static preview opened in Studio', 'info');
        }
      });
    }
  }).catch(() => {
    setStudioViewMode('split');
  });
}

function showTerminalAutoFixBanner(errorSnippet) {
  if (!el.terminalAutoFixBanner) return;
  if (el.terminalErrorSnippet) {
    const lines = (errorSnippet || 'Process exited with error').trim().split('\n').filter(Boolean);
    el.terminalErrorSnippet.textContent = (lines[lines.length - 1] || 'Process exited with errors').slice(0, 90);
  }
  el.terminalAutoFixBanner.style.display = 'flex';
}

function handleTerminalAutoFix() {
  const errorText = state.terminal.lastError || 'Command failed with error';
  const lastCmd = state.terminal.lastCommand || 'process';

  closeStudio();

  const prompt = `I ran the command:
\`\`\`bash
${lastCmd}
\`\`\`
It failed with the following error output:
\`\`\`
${errorText.slice(-1500)}
\`\`\`

Please analyze the root cause and provide the exact fixed files in standard format (e.g. "// File: path/to/file") so I can apply them with one click.`;

  if (el.promptTextarea) {
    el.promptTextarea.value = prompt;
    adjustTextareaHeight(el.promptTextarea);
    el.promptTextarea.focus();
    showToast('🤖 Error context loaded! Press ⌘+Enter to send to DeepSeek.', 'info');
  }
}

// @File Context Tagging System
async function loadWorkspaceFilesList() {
  try {
    const res = await fetch('/api/workspace/files-list');
    const data = await res.json();
    state.cachedFilesList = data.files || [];
  } catch (e) {}
}

function openFileAutocomplete(query = '') {
  if (!state.cachedFilesList || state.cachedFilesList.length === 0) {
    loadWorkspaceFilesList().then(() => renderFileAutocomplete(query));
  } else {
    renderFileAutocomplete(query);
  }
}

function renderFileAutocomplete(query = '') {
  if (!el.fileAutocompleteDropdown || !el.fadList) return;
  const q = query.toLowerCase().replace(/^@/, '');
  const matches = (state.cachedFilesList || [])
    .filter(f => !f.isDirectory && (!q || f.path.toLowerCase().includes(q)))
    .slice(0, 15);

  el.fadList.innerHTML = '';
  if (matches.length === 0) {
    el.fadList.innerHTML = '<div style="padding: 10px; font-size: 11px; color: var(--text-dim); text-align: center;">No matching files in workspace</div>';
  } else {
    matches.forEach((f, idx) => {
      const item = document.createElement('div');
      item.className = `fad-item ${idx === 0 ? 'active' : ''}`;
      item.dataset.path = f.path;
      item.dataset.name = f.name;
      item.innerHTML = `
        <span class="fad-item-icon">📄</span>
        <span class="fad-item-name">${f.name}</span>
        <span class="fad-item-path">${f.path}</span>
      `;
      item.addEventListener('click', () => {
        attachFileContext(f.path, f.name);
        closeFileAutocomplete();
        if (el.promptTextarea) {
          // Replace trailing @query with empty or tag
          el.promptTextarea.value = el.promptTextarea.value.replace(/@[a-zA-Z0-9._/-]*$/, '').trim() + ' ';
          el.promptTextarea.focus();
        }
      });
      el.fadList.appendChild(item);
    });
  }

  el.fileAutocompleteDropdown.style.display = 'block';
}

function closeFileAutocomplete() {
  if (el.fileAutocompleteDropdown) el.fileAutocompleteDropdown.style.display = 'none';
}

async function attachFileContext(filePath, fileName = '') {
  const name = fileName || filePath.split('/').pop();
  if (state.attachedContextFiles.some(f => f.path === filePath)) return;

  try {
    const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.content !== undefined) {
      state.attachedContextFiles.push({
        name,
        path: filePath,
        content: data.content
      });
      renderContextTags();
      showToast(`📎 Attached @${name} to prompt context`, 'info');
    }
  } catch (e) {
    showToast(`Failed to read file ${name}`, 'error');
  }
}

function removeContextFile(filePath) {
  state.attachedContextFiles = state.attachedContextFiles.filter(f => f.path !== filePath);
  renderContextTags();
}

function renderContextTags() {
  if (!el.contextTagsContainer) return;
  el.contextTagsContainer.innerHTML = '';
  if (state.attachedContextFiles.length === 0) {
    el.contextTagsContainer.style.display = 'none';
    return;
  }
  el.contextTagsContainer.style.display = 'flex';
  state.attachedContextFiles.forEach(f => {
    const chip = document.createElement('div');
    chip.className = 'context-tag-chip';
    chip.innerHTML = `<span>📄 @${f.name}</span><span class="ctc-remove" title="Remove attachment">✕</span>`;
    chip.querySelector('.ctc-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeContextFile(f.path);
    });
    el.contextTagsContainer.appendChild(chip);
  });
}

// Agentic Multi-File Diff Applier on Chat Responses
function enhanceCodeBlocksWithApplyButtons(container = el.messagesContainer) {
  if (!container) return;
  const codeBlocks = container.querySelectorAll('pre');
  codeBlocks.forEach(pre => {
    if (pre.dataset.hasApplyBtn) return;

    const code = pre.querySelector('code');
    if (!code) return;
    const text = code.innerText || '';

    // Detect target file comment
    const fileMatch = text.match(/(?:\/\/|\/\*|#|<!--)\s*(?:File|filepath|Filename):\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i);
    if (!fileMatch) return;

    pre.dataset.hasApplyBtn = 'true';
    const targetFilePath = fileMatch[1].trim();

    let header = pre.querySelector('.code-block-header');
    if (!header) {
      header = document.createElement('div');
      header.className = 'code-block-header';
      header.style.display = 'flex';
      header.style.justifyContent = 'flex-end';
      header.style.padding = '4px 8px';
      header.style.borderBottom = '1px solid var(--border-subtle)';
      pre.insertBefore(header, pre.firstChild);
    }

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'btn-apply-agent-code';
    applyBtn.innerHTML = `<span>⚡ Apply to ${targetFilePath.split('/').pop()}</span>`;
    applyBtn.title = `Apply this code block directly to ${targetFilePath} in your workspace`;

    applyBtn.addEventListener('click', async () => {
      applyBtn.disabled = true;
      applyBtn.innerHTML = `<span>⏳ Applying...</span>`;

      try {
        const res = await fetch('/api/workspace/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: targetFilePath,
            content: text
          })
        });
        const data = await res.json();
        if (data.success) {
          applyBtn.innerHTML = `<span>✓ Applied!</span>`;
          applyBtn.style.borderColor = '#10b981';
          applyBtn.style.color = '#10b981';
          showToast(`⚡ Applied changes to ${targetFilePath}!`, 'success');
          if (state.studio.activeFile === targetFilePath && el.studioCodeEditor) {
            el.studioCodeEditor.value = text;
          }
          loadFileTree(state.studio.currentPath);
          loadGitStatus();
        } else {
          applyBtn.disabled = false;
          applyBtn.innerHTML = `<span>❌ Error</span>`;
          showToast(data.error || 'Failed to apply file', 'error');
        }
      } catch (err) {
        applyBtn.disabled = false;
        applyBtn.innerHTML = `<span>❌ Error</span>`;
        showToast(err.message, 'error');
      }
    });

    header.appendChild(applyBtn);
  });
}

function openDiffViewer(filePath, diffText) {
  setStudioViewMode('diff');
  if (el.diffViewerTitle) el.diffViewerTitle.textContent = `Diff: ${filePath || 'Working Tree'}`;

  if (!el.diffCodeDisplay) return;
  el.diffCodeDisplay.innerHTML = '';

  const lines = (diffText || '').split('\n');
  if (lines.length === 0 || !diffText.trim()) {
    el.diffCodeDisplay.innerHTML = '<span style="color: var(--text-dim);">(No diff differences detected)</span>';
    return;
  }

  lines.forEach(line => {
    const span = document.createElement('span');
    if (line.startsWith('+') && !line.startsWith('+++')) {
      span.className = 'diff-line-add';
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      span.className = 'diff-line-del';
    } else if (line.startsWith('@@')) {
      span.className = 'diff-line-hunk';
    }
    span.textContent = line;
    el.diffCodeDisplay.appendChild(span);
  });
}

async function loadGitStatus() {
  try {
    const res = await fetch('/api/git/status');
    const data = await res.json();
    state.studio.gitStatus = data;

    if (!data.isRepo) {
      if (el.gitBranchSelect) {
        el.gitBranchSelect.innerHTML = '<option value="">(Not a repo)</option>';
        el.gitBranchSelect.disabled = true;
      }
      if (el.gitLinkedState) el.gitLinkedState.style.display = 'none';
      if (el.gitUnlinkedState) el.gitUnlinkedState.style.display = 'block';
      if (el.gitChangedCount) el.gitChangedCount.textContent = '0';
      if (el.gitChangesList) {
        el.gitChangesList.innerHTML = `
          <div style="padding: 20px 12px; text-align: center;">
            <p style="font-size: 11px; color: var(--text-dim); margin-bottom: 12px;">Workspace is not initialized as a Git repository.</p>
            <div style="display: flex; flex-direction: column; gap: 8px; max-width: 220px; margin: 0 auto;">
              <button class="btn-studio-action" id="gitInitNowBtn" style="font-size: 11px;">⚡ Initialize Git Repo</button>
              <button class="btn-publish-github" id="gitPublishNowBtn" style="font-size: 11px;">🐙 Create & Push to GitHub</button>
            </div>
          </div>
        `;
        document.getElementById('gitInitNowBtn')?.addEventListener('click', initializeGitRepo);
        document.getElementById('gitPublishNowBtn')?.addEventListener('click', openCreateRepoModal);
      }
      return;
    }

    // Is a git repo
    if (el.gitBranchSelect) el.gitBranchSelect.disabled = false;
    await loadGitBranches(data.branch);

    if (el.gitPrBaseDisplay) el.gitPrBaseDisplay.textContent = 'main';

    // Remote link status
    if (data.remoteUrl) {
      if (el.gitLinkedState) el.gitLinkedState.style.display = 'flex';
      if (el.gitUnlinkedState) el.gitUnlinkedState.style.display = 'none';
      if (el.gitRepoLink) {
        if (data.githubRepo) {
          el.gitRepoLink.textContent = `${data.githubRepo.owner}/${data.githubRepo.repo}`;
          el.gitRepoLink.href = `https://github.com/${data.githubRepo.owner}/${data.githubRepo.repo}`;
        } else {
          el.gitRepoLink.textContent = data.remoteUrl;
          el.gitRepoLink.href = data.remoteUrl;
        }
      }
    } else {
      if (el.gitLinkedState) el.gitLinkedState.style.display = 'none';
      if (el.gitUnlinkedState) el.gitUnlinkedState.style.display = 'block';
    }

    const files = data.files || [];
    if (el.gitChangedCount) el.gitChangedCount.textContent = files.length;
    if (el.studioGitBadge) {
      el.studioGitBadge.style.display = files.length > 0 ? 'inline-block' : 'none';
      el.studioGitBadge.textContent = files.length;
    }

    if (el.gitChangesList) {
      el.gitChangesList.innerHTML = '';
      if (files.length === 0) {
        el.gitChangesList.innerHTML = '<div class="git-clean-msg">Workspace is clean. No uncommitted changes.</div>';
      } else {
        files.forEach(f => {
          const item = document.createElement('div');
          item.className = 'git-change-item';
          const badgeClass = f.status.includes('?') ? 'untracked' : f.status;
          const parts = f.path.split('/');
          const fileName = parts.pop() || f.path;
          const dirPath = parts.length > 0 ? parts.join('/') + '/' : '';
          item.title = f.path;
          item.innerHTML = `
            <span class="git-badge ${badgeClass}">${escapeHtml(f.status)}</span>
            <span class="gci-path" title="${escapeHtml(f.path)}">
              <span class="gci-dir">${escapeHtml(dirPath)}</span><span class="gci-name">${escapeHtml(fileName)}</span>
            </span>
          `;
          item.addEventListener('click', async () => {
            // Load file directly in the editor for instant viewing and editing
            await loadWorkspaceFile(f.path);
          });
          el.gitChangesList.appendChild(item);
        });
      }
    }
  } catch (err) {
    console.error('Failed to load git status:', err);
  }
}

async function loadGitBranches(currentBranch) {
  try {
    const res = await fetch('/api/git/branches');
    const data = await res.json();
    state.studio.branches = data.branches || [currentBranch || 'main'];
    state.studio.currentBranch = data.current || currentBranch || 'main';

    if (el.gitBranchSelect) {
      el.gitBranchSelect.innerHTML = '';
      state.studio.branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = `🌿 ${b}`;
        if (b === state.studio.currentBranch) opt.selected = true;
        el.gitBranchSelect.appendChild(opt);
      });
    }

    // Also populate inline delete branch select
    if (el.inlineDeleteBranchSelect) {
      el.inlineDeleteBranchSelect.innerHTML = '';
      const otherBranches = state.studio.branches.filter(b => b !== state.studio.currentBranch);
      if (otherBranches.length === 0) {
        el.inlineDeleteBranchSelect.innerHTML = '<option value="">(No other branches)</option>';
      } else {
        otherBranches.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b;
          opt.textContent = `🌿 ${b}`;
          el.inlineDeleteBranchSelect.appendChild(opt);
        });
      }
    }
  } catch (e) {
    console.error('Failed to load branches:', e);
  }
}

async function switchBranch(branchName) {
  if (!branchName || branchName === state.studio.currentBranch) return;
  showToast(`Switching to branch "${branchName}"...`, 'info');
  try {
    const res = await fetch('/api/git/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch: branchName })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Switched to branch "${branchName}"!`, 'success');
      loadGitStatus();
      loadFileTree(state.studio.currentPath);
    } else {
      showToast(data.error || 'Failed to switch branch', 'error');
      loadGitStatus();
    }
  } catch (e) {
    showToast(e.message, 'error');
    loadGitStatus();
  }
}

// INLINE: New Branch Drawer
function toggleInlineNewBranch() {
  if (!el.inlineNewBranchCard) {
    createNewBranchPrompt();
    return;
  }
  const isHidden = el.inlineNewBranchCard.style.display === 'none';
  if (isHidden) {
    if (el.inlineBranchNameInput) el.inlineBranchNameInput.value = '';
    if (el.inlineBranchNotice) el.inlineBranchNotice.style.display = 'none';
    if (el.inlineDeleteBranchCard) el.inlineDeleteBranchCard.style.display = 'none';
    el.inlineNewBranchCard.style.display = 'block';
    setTimeout(() => el.inlineBranchNameInput?.focus(), 50);
  } else {
    el.inlineNewBranchCard.style.display = 'none';
  }
}

function closeInlineNewBranch() {
  if (el.inlineNewBranchCard) el.inlineNewBranchCard.style.display = 'none';
}

async function submitInlineBranch() {
  const name = el.inlineBranchNameInput?.value?.trim();
  if (!name) {
    showInlineBranchNotice('Please enter a branch name', 'error');
    return;
  }
  showInlineBranchNotice('Creating and switching to branch...', 'info');
  try {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, checkout: true })
    });
    const data = await res.json();
    if (data.success) {
      closeInlineNewBranch();
      showToast(`Branch "${data.branch}" created & checked out!`, 'success');
      loadGitStatus();
      loadFileTree(state.studio.currentPath);
    } else {
      showInlineBranchNotice(data.error || 'Failed to create branch', 'error');
    }
  } catch (e) {
    showInlineBranchNotice(e.message, 'error');
  }
}

function showInlineBranchNotice(msg, type) {
  if (!el.inlineBranchNotice) return;
  el.inlineBranchNotice.textContent = msg;
  el.inlineBranchNotice.className = `pr-result-notice ${type}`;
  el.inlineBranchNotice.style.display = 'block';
}

// INLINE: Delete Branch Drawer
function toggleInlineDeleteBranch() {
  if (!el.inlineDeleteBranchCard) {
    deleteBranchPrompt();
    return;
  }
  const isHidden = el.inlineDeleteBranchCard.style.display === 'none';
  if (isHidden) {
    const otherBranches = (state.studio.branches || []).filter(b => b !== state.studio.currentBranch);
    if (otherBranches.length === 0) {
      showToast('No other branches available to delete.', 'info');
      return;
    }
    if (el.inlineDeleteBranchForce) el.inlineDeleteBranchForce.checked = false;
    if (el.inlineDeleteBranchNotice) el.inlineDeleteBranchNotice.style.display = 'none';
    if (el.inlineNewBranchCard) el.inlineNewBranchCard.style.display = 'none';
    el.inlineDeleteBranchCard.style.display = 'block';
  } else {
    el.inlineDeleteBranchCard.style.display = 'none';
  }
}

function closeInlineDeleteBranch() {
  if (el.inlineDeleteBranchCard) el.inlineDeleteBranchCard.style.display = 'none';
}

async function submitInlineDeleteBranch() {
  const name = el.inlineDeleteBranchSelect?.value;
  const force = el.inlineDeleteBranchForce?.checked || false;
  if (!name) return;

  try {
    const res = await fetch('/api/git/branch/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, force })
    });
    const data = await res.json();
    if (data.success) {
      closeInlineDeleteBranch();
      showToast(`Deleted branch "${name}"!`, 'success');
      loadGitStatus();
    } else {
      if (el.inlineDeleteBranchNotice) {
        el.inlineDeleteBranchNotice.textContent = data.error || 'Failed to delete branch';
        el.inlineDeleteBranchNotice.className = 'pr-result-notice error';
        el.inlineDeleteBranchNotice.style.display = 'block';
      }
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// INLINE: GitHub Repository Publisher
function openInlineCreateRepo() {
  if (el.inlineCreateRepoCard) {
    const root = state.studio.root || '';
    const defaultName = root.split('/').filter(Boolean).pop() || 'personal-harness';
    if (el.inlineRepoNameInput) el.inlineRepoNameInput.value = defaultName;
    if (el.inlineRepoDescInput) el.inlineRepoDescInput.value = '';
    // Token is auto-loaded from DB when user is signed in — no need to pre-fill input
    setInlineRepoVisibility('public');
    if (el.inlineRepoStatusNotice) el.inlineRepoStatusNotice.style.display = 'none';
    if (el.inlineLinkRemoteCard) el.inlineLinkRemoteCard.style.display = 'none';
    el.inlineCreateRepoCard.style.display = 'block';
    setTimeout(() => el.inlineRepoNameInput?.focus(), 50);
  } else {
    openCreateRepoModal();
  }
}

function closeInlineCreateRepo() {
  if (el.inlineCreateRepoCard) el.inlineCreateRepoCard.style.display = 'none';
}

function setInlineRepoVisibility(val) {
  state.studio.newRepoVisibility = val;
  if (el.inlineVisPillPublic) el.inlineVisPillPublic.classList.toggle('active', val === 'public');
  if (el.inlineVisPillPrivate) el.inlineVisPillPrivate.classList.toggle('active', val === 'private');
}

// GitHub Account Session Management
async function checkGitHubAccount() {
  try {
    const res = await fetch('/api/github/account');
    const data = await res.json();
    if (data.authenticated && data.user) {
      state.githubUser = data.user;
      state.githubToken = true;

      if (el.ghAccountUnauth) el.ghAccountUnauth.style.display = 'none';
      if (el.ghAccountAuth) el.ghAccountAuth.style.display = 'flex';
      if (el.ghUsername) el.ghUsername.textContent = `@${data.user.login}`;
      if (el.ghUserAvatar) {
        if (data.user.avatar_url) {
          el.ghUserAvatar.src = data.user.avatar_url;
          el.ghUserAvatar.style.display = 'block';
        } else {
          el.ghUserAvatar.style.display = 'none';
        }
      }

      // Update inline publisher to be 100% tokenless
      if (el.inlineRepoAuthBadge) el.inlineRepoAuthBadge.style.display = 'flex';
      if (el.inlineRepoAuthPrompt) el.inlineRepoAuthPrompt.style.display = 'none';
      if (el.inlinePublishAsUser) el.inlinePublishAsUser.textContent = `@${data.user.login}`;
      if (el.inlineRepoTokenGroup) el.inlineRepoTokenGroup.style.display = 'none';
      if (el.inlineGhSignInCard) el.inlineGhSignInCard.style.display = 'none';
    } else {
      state.githubUser = null;
      if (el.ghAccountUnauth) el.ghAccountUnauth.style.display = 'flex';
      if (el.ghAccountAuth) el.ghAccountAuth.style.display = 'none';
      if (el.inlineRepoAuthBadge) el.inlineRepoAuthBadge.style.display = 'none';
      if (el.inlineRepoAuthPrompt) el.inlineRepoAuthPrompt.style.display = 'flex';
      if (el.inlineRepoTokenGroup) el.inlineRepoTokenGroup.style.display = 'block';
    }
  } catch (e) {
    console.error('Failed to check GitHub account:', e);
  }
}

// INLINE: Zero-Modal GitHub Sign-In Drawer
function toggleInlineGhSignIn() {
  if (!el.inlineGhSignInCard) return;
  const isHidden = el.inlineGhSignInCard.style.display === 'none';
  if (isHidden) {
    if (el.inlineGhSignInTokenInput) el.inlineGhSignInTokenInput.value = '';
    if (el.inlineGhSignInNotice) el.inlineGhSignInNotice.style.display = 'none';
    if (el.inlineCreateRepoCard) el.inlineCreateRepoCard.style.display = 'none';
    if (el.inlineLinkRemoteCard) el.inlineLinkRemoteCard.style.display = 'none';
    if (el.inlineNewBranchCard) el.inlineNewBranchCard.style.display = 'none';
    if (el.inlineDeleteBranchCard) el.inlineDeleteBranchCard.style.display = 'none';
    el.inlineGhSignInCard.style.display = 'block';
    setTimeout(() => el.inlineGhSignInTokenInput?.focus(), 50);
  } else {
    el.inlineGhSignInCard.style.display = 'none';
  }
}

function closeInlineGhSignIn() {
  if (el.inlineGhSignInCard) el.inlineGhSignInCard.style.display = 'none';
}

function showInlineGhSignInNotice(msg, type) {
  if (!el.inlineGhSignInNotice) return;
  el.inlineGhSignInNotice.textContent = msg;
  el.inlineGhSignInNotice.className = `pr-result-notice ${type}`;
  el.inlineGhSignInNotice.style.display = 'block';
}

async function submitInlineGhSignIn() {
  const token = el.inlineGhSignInTokenInput?.value?.trim();
  if (!token) {
    showInlineGhSignInNotice('Please enter or paste your GitHub Personal Access Token', 'error');
    if (el.inlineGhSignInTokenInput) el.inlineGhSignInTokenInput.focus();
    return;
  }

  showInlineGhSignInNotice('Verifying token with GitHub & saving...', 'info');
  if (el.confirmInlineGhSignInBtn) el.confirmInlineGhSignInBtn.disabled = true;

  try {
    const res = await fetch('/api/github/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (el.confirmInlineGhSignInBtn) el.confirmInlineGhSignInBtn.disabled = false;

    if (data.success && data.user) {
      showToast(`🎉 Signed in as @${data.user.login}! Token saved permanently.`, 'success');
      closeInlineGhSignIn();
      await checkGitHubAccount();
      loadGitStatus();
    } else {
      showInlineGhSignInNotice(data.error || 'Failed to authenticate with GitHub.', 'error');
    }
  } catch (e) {
    if (el.confirmInlineGhSignInBtn) el.confirmInlineGhSignInBtn.disabled = false;
    showInlineGhSignInNotice(e.message, 'error');
  }
}

function openGhSignInModal() {
  toggleInlineGhSignIn();
}

function closeGhSignInModal() {
  closeInlineGhSignIn();
  if (el.ghSignInModal) el.ghSignInModal.style.display = 'none';
}

function openGhTokenPage() {
  const url = 'https://github.com/settings/tokens/new?description=DeepHarness%20Personal%20Mac&scopes=repo,read:user,workflow';
  fetch('/api/system/open-external', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  }).catch(() => {});
  window.open(url, '_blank');
  showInlineGhSignInNotice('Opening GitHub in browser. Generate token, copy it, and paste below!', 'info');
  showGhSignInNotice('Opening GitHub in browser. Generate token, copy it, and paste below!', 'info');
  setTimeout(() => {
    el.inlineGhSignInTokenInput?.focus();
    el.ghSignInTokenInput?.focus();
  }, 100);
}

async function submitGhSignIn() {
  return submitInlineGhSignIn();
}

function showGhSignInNotice(msg, type) {
  showInlineGhSignInNotice(msg, type);
  if (!el.ghSignInNotice) return;
  el.ghSignInNotice.textContent = msg;
  el.ghSignInNotice.className = `pr-result-notice ${type}`;
  el.ghSignInNotice.style.display = 'block';
}

async function submitGhSignOut() {
  try {
    await fetch('/api/github/logout', { method: 'POST' });
    showToast('GitHub account disconnected.', 'info');
    await checkGitHubAccount();
    loadGitStatus();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function submitInlineCreateRepo() {
  const name = el.inlineRepoNameInput?.value?.trim();
  const desc = el.inlineRepoDescInput?.value?.trim() || '';
  const manualToken = el.inlineRepoTokenInput?.value?.trim();
  const isPrivate = state.studio.newRepoVisibility === 'private';
  const autoPush = el.inlineRepoAutoPush?.checked !== false;

  if (!name) {
    showInlineRepoNotice('Please enter a repository name', 'error');
    return;
  }

  if (!state.githubUser && !manualToken) {
    showInlineRepoNotice('Please sign in with GitHub or enter a token below', 'error');
    toggleInlineGhSignIn();
    return;
  }

  showInlineRepoNotice('🚀 Creating GitHub repository & syncing code...', 'info');
  if (el.confirmInlineCreateRepoBtn) el.confirmInlineCreateRepoBtn.disabled = true;

  try {
    const res = await fetch('/api/github/create-repo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: desc,
        isPrivate,
        autoPush,
        token: manualToken || undefined
      })
    });
    const data = await res.json();
    if (el.confirmInlineCreateRepoBtn) el.confirmInlineCreateRepoBtn.disabled = false;

    if (data.success) {
      showToast(`🎉 GitHub repo "${data.fullName}" created & published!`, 'success');
      closeInlineCreateRepo();
      loadGitStatus();
      loadFileTree(state.studio.currentPath);
    } else {
      showInlineRepoNotice(data.error || 'Failed to create GitHub repository.', 'error');
    }
  } catch (e) {
    if (el.confirmInlineCreateRepoBtn) el.confirmInlineCreateRepoBtn.disabled = false;
    showInlineRepoNotice(e.message, 'error');
  }
}

function showInlineRepoNotice(msg, type) {
  if (!el.inlineRepoStatusNotice) return;
  el.inlineRepoStatusNotice.textContent = msg;
  el.inlineRepoStatusNotice.className = `pr-result-notice ${type}`;
  el.inlineRepoStatusNotice.style.display = 'block';
}

// INLINE: Link Remote URL
function openInlineLinkRemote() {
  if (el.inlineLinkRemoteCard) {
    if (el.inlineRemoteUrlInput) {
      el.inlineRemoteUrlInput.value = state.studio.gitStatus?.remoteUrl || '';
    }
    if (el.inlineRemoteNotice) el.inlineRemoteNotice.style.display = 'none';
    if (el.inlineCreateRepoCard) el.inlineCreateRepoCard.style.display = 'none';
    el.inlineLinkRemoteCard.style.display = 'block';
    setTimeout(() => el.inlineRemoteUrlInput?.focus(), 50);
  } else {
    openEditRemoteModal();
  }
}

function closeInlineLinkRemote() {
  if (el.inlineLinkRemoteCard) el.inlineLinkRemoteCard.style.display = 'none';
}

async function submitInlineLinkRemote() {
  const url = el.inlineRemoteUrlInput?.value?.trim();
  if (!url) return;
  try {
    const res = await fetch('/api/git/remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (data.success) {
      closeInlineLinkRemote();
      showToast('Remote origin linked successfully!', 'success');
      loadGitStatus();
    } else {
      if (el.inlineRemoteNotice) {
        el.inlineRemoteNotice.textContent = data.error || 'Failed to update remote';
        el.inlineRemoteNotice.className = 'pr-result-notice error';
        el.inlineRemoteNotice.style.display = 'block';
      }
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// Modal Fallbacks for Git Branch & Repo
function createNewBranchPrompt() {
  toggleInlineNewBranch();
}
function closeCreateBranchModal() {
  if (el.createBranchModal) el.createBranchModal.style.display = 'none';
}
async function submitCreateBranch() {
  submitInlineBranch();
}
function showBranchNotice(msg, type) {
  showInlineBranchNotice(msg, type);
}
function deleteBranchPrompt() {
  toggleInlineDeleteBranch();
}
function closeDeleteBranchModal() {
  if (el.deleteBranchModal) el.deleteBranchModal.style.display = 'none';
}
async function submitDeleteBranch() {
  submitInlineDeleteBranch();
}
function openCreateRepoModal() {
  openInlineCreateRepo();
}
function closeCreateRepoModal() {
  if (el.createRepoModal) el.createRepoModal.style.display = 'none';
}
function setRepoVisibilityPill(val) {
  setInlineRepoVisibility(val);
}
async function submitCreateRepo() {
  submitInlineCreateRepo();
}
function showCreateRepoNotice(msg, type) {
  showInlineRepoNotice(msg, type);
}
function openEditRemoteModal() {
  openInlineLinkRemote();
}
function closeEditRemoteModal() {
  if (el.editRemoteModal) el.editRemoteModal.style.display = 'none';
}
async function submitEditRemote() {
  submitInlineLinkRemote();
}

async function initializeGitRepo() {
  try {
    const res = await fetch('/api/git/init', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Initialized Git repository!', 'success');
      loadGitStatus();
    } else {
      showToast(data.error || 'Failed to initialize Git', 'error');
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function pullFromRemote() {
  showToast('Pulling latest commits from remote...', 'info');
  try {
    const res = await fetch('/api/git/pull', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Git Pull completed!', 'success');
      loadGitStatus();
      loadFileTree(state.studio.currentPath);
    } else {
      showToast(data.error || 'Git Pull failed', 'error');
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function generateAiCommitMessage() {
  if (!el.gitCommitInput) return;
  el.gitCommitInput.value = 'Generating commit message with DeepSeek...';
  try {
    const res = await fetch('/api/git/ai-commit', { method: 'POST' });
    const data = await res.json();
    el.gitCommitInput.value = data.commitMessage || 'feat: update workspace files';
    showToast('✨ AI commit message generated!', 'success');
  } catch (e) {
    el.gitCommitInput.value = 'feat: update workspace files';
  }
}

async function commitGitChanges() {
  const msg = el.gitCommitInput ? el.gitCommitInput.value.trim() : '';
  if (!msg) {
    showToast('Please enter a commit message', 'warning');
    if (el.gitCommitInput) el.gitCommitInput.focus();
    return;
  }

  try {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Committed changes successfully!', 'success');
      if (el.gitCommitInput) el.gitCommitInput.value = '';
      loadGitStatus();
    } else {
      showToast(data.error || 'Commit failed', 'error');
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function pushGitBranch() {
  if (!state.studio.gitStatus?.remoteUrl) {
    showToast('No GitHub repository linked yet! Please create or link a repo below.', 'warning');
    openInlineCreateRepo();
    return;
  }
  showToast('Pushing branch to remote origin...', 'info');
  try {
    const res = await fetch('/api/git/push', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('Pushed to origin successfully!', 'success');
      loadGitStatus();
    } else {
      showToast(data.error || 'Push failed (check remote origin credentials)', 'error');
      if (data.error && (data.error.includes('origin') || data.error.includes('credentials') || data.error.includes('Authentication') || data.error.includes('fatal:'))) {
        openInlineCreateRepo();
      }
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function createGitHubPullRequest() {
  const title = el.gitPrTitleInput ? el.gitPrTitleInput.value.trim() : '';
  const body = el.gitPrBodyInput ? el.gitPrBodyInput.value.trim() : '';
  const head = state.studio.gitStatus?.branch;
  const owner = state.studio.gitStatus?.githubRepo?.owner;
  const repo = state.studio.gitStatus?.githubRepo?.repo;

  if (!title) {
    showToast('Please provide a Pull Request title', 'warning');
    if (el.gitPrTitleInput) el.gitPrTitleInput.focus();
    return;
  }

  if (!owner || !repo) {
    const customRepo = prompt('Enter GitHub repository (owner/repo):');
    if (!customRepo) return;
    const parts = customRepo.trim().split('/');
    if (parts.length !== 2) {
      showToast('Invalid format. Use owner/repo (e.g. facebook/react)', 'error');
      return;
    }
    return submitPR(title, body, head, parts[0], parts[1]);
  }

  submitPR(title, body, head, owner, repo);
}

async function submitPR(title, body, head, owner, repo) {
  showToast('Submitting Pull Request to GitHub...', 'info');
  try {
    const res = await fetch('/api/github/pr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, head, owner, repo, base: 'main' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Pull Request #${data.number} created!`, 'success');
      if (el.gitPrResultNotice) {
        const prDetails = document.getElementById('gitPrDetails');
        if (prDetails) prDetails.open = true;
        el.gitPrResultNotice.style.display = 'block';
        el.gitPrResultNotice.innerHTML = `
          🎉 PR #${data.number} Created! <a href="${data.prUrl}" target="_blank" style="color: #38bdf8; text-decoration: underline;">View on GitHub ↗</a>
        `;
      }
    } else {
      showToast(data.error || 'Failed to create Pull Request', 'error');
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function setupCodeEditorEvents() {
  if (!el.studioCodeEditor || el.studioCodeEditor.dataset.eventsBound) return;
  el.studioCodeEditor.dataset.eventsBound = 'true';

  el.studioCodeEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = el.studioCodeEditor.selectionStart;
      const end = el.studioCodeEditor.selectionEnd;
      el.studioCodeEditor.value = el.studioCodeEditor.value.substring(0, start) + '  ' + el.studioCodeEditor.value.substring(end);
      el.studioCodeEditor.selectionStart = el.studioCodeEditor.selectionEnd = start + 2;
      onEditorContentChanged();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentFile();
    }
  });

  el.studioCodeEditor.addEventListener('input', onEditorContentChanged);

  el.studioCodeEditor.addEventListener('scroll', () => {
    if (el.editorLineNumbers) {
      el.editorLineNumbers.scrollTop = el.studioCodeEditor.scrollTop;
    }
  });
}

function onEditorContentChanged() {
  if (!el.studioCodeEditor) return;
  const text = el.studioCodeEditor.value;
  updateLineNumbers(text);
  const isDirty = state.studio.activeFile ? (text !== state.studio.activeFile.originalContent) : false;
  if (state.studio.activeFile) state.studio.activeFile.isDirty = isDirty;
  const ext = state.studio.activeFile ? '.' + state.studio.activeFile.path.split('.').pop() : '';
  updateEditorStatusBar(text, ext, isDirty);
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Start Application on Load
window.addEventListener('DOMContentLoaded', init);
