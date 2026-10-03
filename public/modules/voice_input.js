// ==========================================================================
// DeepHarness — Offline Voice-to-Code (Web Speech API, 100% Free & Local)
// ==========================================================================
(function () {
  'use strict';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('[VoiceInput] Web Speech API not supported in this browser.');
    return;
  }

  let recognition = null;
  let isListening = false;
  let micBtn = null;
  let pulseIndicator = null;

  function init() {
    const inputToolbar = document.querySelector('.prompt-toolbar, .input-actions, .input-bar-actions');
    const promptTextarea = document.getElementById('promptTextarea');
    if (!promptTextarea) return;

    // Create mic button
    micBtn = document.createElement('button');
    micBtn.type = 'button';
    micBtn.className = 'voice-mic-btn';
    micBtn.id = 'voiceMicBtn';
    micBtn.title = 'Voice-to-Text (Offline — Free)';
    micBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

    // Pulse indicator (hidden by default)
    pulseIndicator = document.createElement('span');
    pulseIndicator.className = 'voice-pulse-indicator';
    pulseIndicator.textContent = '● REC';
    pulseIndicator.style.display = 'none';

    // Insert mic button near textarea
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn && sendBtn.parentElement) {
      sendBtn.parentElement.insertBefore(micBtn, sendBtn);
      sendBtn.parentElement.insertBefore(pulseIndicator, sendBtn);
    } else if (inputToolbar) {
      inputToolbar.appendChild(micBtn);
      inputToolbar.appendChild(pulseIndicator);
    } else {
      // Fallback: put near textarea
      promptTextarea.parentElement.appendChild(micBtn);
      promptTextarea.parentElement.appendChild(pulseIndicator);
    }

    micBtn.addEventListener('click', toggleVoice);

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      const curValue = promptTextarea.value.replace(/\[🎙️ listening...\]$/i, '').trimEnd();
      const baseText = curValue.endsWith(finalTranscript.trimEnd())
        ? curValue
        : (curValue ? curValue + ' ' : '') + finalTranscript;
      promptTextarea.value = baseText + (interim ? interim : '');
      autoResize(promptTextarea);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.warn('[VoiceInput] Recognition error:', event.error);
      stopListening();
      if (typeof showToast === 'function') {
        showToast(`Voice error: ${event.error}`, 'error');
      }
    };

    recognition.onend = () => {
      if (isListening) {
        // Auto-restart if still in listening mode (continuous)
        try { recognition.start(); } catch (_) { stopListening(); }
      }
    };
  }

  function toggleVoice() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    if (!recognition) return;
    isListening = true;
    try {
      recognition.start();
    } catch (_) {}
    if (micBtn) {
      micBtn.classList.add('recording');
      micBtn.title = 'Stop Recording';
    }
    if (pulseIndicator) pulseIndicator.style.display = 'inline-flex';
    if (typeof showToast === 'function') {
      showToast('🎙️ Voice recording started (offline — free!)', 'info');
    }
  }

  function stopListening() {
    isListening = false;
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
    if (micBtn) {
      micBtn.classList.remove('recording');
      micBtn.title = 'Voice-to-Text (Offline — Free)';
    }
    if (pulseIndicator) pulseIndicator.style.display = 'none';
  }

  function autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(200, textarea.scrollHeight) + 'px';
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DeepHarnessVoice = { init, startListening, stopListening, toggleVoice };
})();
