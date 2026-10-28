// OrbitChat Client Logic — Taste v2
(function() {
  'use strict';

  // DOM References
  const authModal = document.getElementById('auth-modal');
  const authForm = document.getElementById('auth-form');
  const usernameInput = document.getElementById('username-input');
  const privateKeyInput = document.getElementById('private-key-input');
  const toggleKeyBtn = document.getElementById('toggle-key-btn');
  const keyInputContainer = document.getElementById('key-input-container');
  const authError = document.getElementById('auth-error');
  const claimBtn = document.getElementById('claim-btn');
  const charNum = document.getElementById('char-num');

  const app = document.getElementById('app');
  const connIndicator = document.getElementById('conn-indicator');
  const connStatus = document.getElementById('conn-status');
  const onlineCount = document.getElementById('online-count');
  const sidebarOnlineCount = document.getElementById('sidebar-online-count');
  const usersList = document.getElementById('users-list');
  const toggleUsersBtn = document.getElementById('toggle-users-btn');
  const sidebar = document.getElementById('sidebar');
  const closeSidebarBtn = document.getElementById('close-sidebar-btn');

  const messagesContainer = document.getElementById('messages-container');
  const messagesList = document.getElementById('messages-list');
  const emptyState = document.getElementById('empty-state');
  const scrollBottomPill = document.getElementById('scroll-bottom-pill');

  const chatForm = document.getElementById('chat-form');
  const messageInput = document.getElementById('message-input');
  const currentUsernameBadge = document.getElementById('current-username-badge');
  const typingIndicator = document.getElementById('typing-indicator');
  const typingText = document.getElementById('typing-text');

  const showKeyBtn = document.getElementById('show-key-btn');
  const keyModal = document.getElementById('key-modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalUsername = document.getElementById('modal-username');
  const modalKeyText = document.getElementById('modal-key-text');
  const copyKeyBtn = document.getElementById('copy-key-btn');
  const copyLabel = document.getElementById('copy-label');
  const closeKeyModalBtn = document.getElementById('close-key-modal-btn');
  const logoutBtn = document.getElementById('logout-btn');

  const toggleSoundBtn = document.getElementById('toggle-sound-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');

  // Application State
  let socket = null;
  let currentUser = localStorage.getItem('orbit_chat_username') || '';
  let currentToken = localStorage.getItem('orbit_chat_token') || '';
  let soundEnabled = localStorage.getItem('orbit_chat_sound') !== 'false';
  let isCurrentlyTyping = false;
  let typingTimeout = null;
  const activeTypers = new Set();

  let unreadCount = 0;
  let lastMessageSender = null;
  let lastMessageTime = 0;
  let lastMessageDateStr = '';

  // Local reaction storage: messageId -> Map<emoji, Set<username>>
  const reactionMap = new Map();

  // Subtle, desaturated border/tint variation for square monogram tiles (NO rainbow)
  const TILE_TINTS = [
    { bg: '#17171A', border: 'rgba(255,255,255,0.12)', text: '#EDEDEF' },
    { bg: '#15171C', border: 'rgba(154,163,178,0.22)', text: '#D8DEE9' },
    { bg: '#171A18', border: 'rgba(163,184,166,0.22)', text: '#D6E2D8' },
    { bg: '#1A1816', border: 'rgba(184,170,154,0.22)', text: '#E2DBD6' },
    { bg: '#191619', border: 'rgba(180,160,180,0.22)', text: '#DFD5DF' }
  ];

  function getMonogramStyle(str) {
    if (!str) return TILE_TINTS[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TILE_TINTS[Math.abs(hash) % TILE_TINTS.length];
  }

  function getFirstChar(str) {
    if (!str) return '?';
    return Array.from(str.trim())[0] || '?';
  }

  function formatTime(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function formatDateHeader(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Synthesized audio chime (Web Audio API)
  function playBeep() {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      // Audio context may require prior user interaction
    }
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function isUserNearBottom() {
    const threshold = 90;
    const pos = messagesContainer.scrollTop + messagesContainer.clientHeight;
    return (messagesContainer.scrollHeight - pos) <= threshold;
  }

  function scrollToBottom(force = false) {
    if (force || isUserNearBottom()) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      unreadCount = 0;
      scrollBottomPill.classList.add('hidden');
    } else {
      unreadCount++;
      scrollBottomPill.querySelector('span').textContent = `${unreadCount} new message${unreadCount > 1 ? 's' : ''}`;
      scrollBottomPill.classList.remove('hidden');
    }
  }

  // Show date divider if calendar day changes
  function checkDateDivider(timestamp) {
    const dateStr = formatDateHeader(timestamp);
    if (dateStr !== lastMessageDateStr) {
      lastMessageDateStr = dateStr;
      const div = document.createElement('div');
      div.className = 'date-divider';
      div.innerHTML = `<span class="date-divider-label font-mono">${escapeHTML(dateStr)}</span>`;
      messagesList.appendChild(div);
    }
  }

  // Render a chat message log entry
  function appendMessage(msg, isOwn = false) {
    emptyState.classList.add('hidden');
    checkDateDivider(msg.timestamp);

    const now = msg.timestamp;
    const isConsecutive = (lastMessageSender === msg.username) && (now - lastMessageTime < 120000); // 2 minutes
    lastMessageSender = msg.username;
    lastMessageTime = now;

    const row = document.createElement('div');
    row.className = `log-row ${isOwn ? 'is-own' : ''} ${isConsecutive ? 'group-cont' : 'group-start'}`;
    row.setAttribute('data-id', msg.id || ('temp_' + Math.random()));
    row.setAttribute('data-time', formatTime(now));

    const tileStyle = getMonogramStyle(msg.username);
    const initial = escapeHTML(getFirstChar(msg.username));
    const safeUser = escapeHTML(msg.username);
    const safeText = escapeHTML(msg.text);
    const timeStr = formatTime(now);

    const msgId = String(msg.id || Date.now());

    row.innerHTML = `
      <div class="log-meta-line">
        <span class="monogram-tile" style="background-color: ${tileStyle.bg}; border-color: ${tileStyle.border}; color: ${tileStyle.text};">
          ${initial}
        </span>
        <span class="log-username font-mono">${safeUser}</span>
        <span class="log-timestamp font-mono">${timeStr}</span>
      </div>
      <div class="log-body">${safeText}</div>
      <div class="log-reactions" data-msg-id="${msgId}">
        <button type="button" class="rx-pill" data-emoji="👍" title="React 👍">👍 <span class="rx-count">0</span></button>
        <button type="button" class="rx-pill" data-emoji="⚡" title="React ⚡">⚡ <span class="rx-count">0</span></button>
        <button type="button" class="btn-add-rx font-mono" title="Add reaction">+</button>
      </div>
    `;

    // Reaction handler for this row
    const reactionsContainer = row.querySelector('.log-reactions');
    reactionsContainer.querySelectorAll('.rx-pill').forEach(btn => {
      const emoji = btn.getAttribute('data-emoji');
      btn.addEventListener('click', () => toggleReaction(msgId, emoji, btn));
    });

    const addRxBtn = reactionsContainer.querySelector('.btn-add-rx');
    addRxBtn.addEventListener('click', () => {
      const extraEmojis = ['❤️', '🔥', '👀'];
      const chosen = extraEmojis[Math.floor(Math.random() * extraEmojis.length)];
      let existingBtn = reactionsContainer.querySelector(`.rx-pill[data-emoji="${chosen}"]`);
      if (!existingBtn) {
        existingBtn = document.createElement('button');
        existingBtn.type = 'button';
        existingBtn.className = 'rx-pill';
        existingBtn.setAttribute('data-emoji', chosen);
        existingBtn.innerHTML = `${chosen} <span class="rx-count">0</span>`;
        existingBtn.addEventListener('click', () => toggleReaction(msgId, chosen, existingBtn));
        reactionsContainer.insertBefore(existingBtn, addRxBtn);
      }
      toggleReaction(msgId, chosen, existingBtn);
    });

    messagesList.appendChild(row);
    scrollToBottom();
  }

  function toggleReaction(msgId, emoji, btn) {
    if (!reactionMap.has(msgId)) {
      reactionMap.set(msgId, new Map());
    }
    const msgReactions = reactionMap.get(msgId);
    if (!msgReactions.has(emoji)) {
      msgReactions.set(emoji, new Set());
    }
    const userSet = msgReactions.get(emoji);

    if (userSet.has(currentUser)) {
      userSet.delete(currentUser);
      btn.classList.remove('reacted');
    } else {
      userSet.add(currentUser);
      btn.classList.add('reacted');
    }

    const count = userSet.size;
    const countSpan = btn.querySelector('.rx-count');
    if (countSpan) countSpan.textContent = count;

    if (count === 0 && !btn.classList.contains('reacted')) {
      // keep basic preset buttons visible
    }
  }

  // Render system log notices
  function appendSystemNotice(text) {
    const entry = document.createElement('div');
    entry.className = 'log-system-entry font-mono';
    entry.innerHTML = `<span class="sys-bullet">■</span><span>${escapeHTML(text)}</span>`;
    messagesList.appendChild(entry);
    scrollToBottom();
  }

  // Update active users in header and sidebar
  function updateUsers(users) {
    const count = users.length;
    onlineCount.textContent = count;
    sidebarOnlineCount.textContent = count;
    usersList.innerHTML = '';

    users.forEach(username => {
      const isSelf = username === currentUser;
      const node = document.createElement('div');
      node.className = `user-node ${isSelf ? 'is-self' : ''}`;
      node.innerHTML = `
        <span class="user-presence-dot"></span>
        <span class="user-node-handle">${escapeHTML(username)}${isSelf ? ' (you)' : ''}</span>
      `;
      usersList.appendChild(node);
    });
  }

  // Show temporary skeleton rows while loading initial history
  function renderSkeletons() {
    messagesList.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const sk = document.createElement('div');
      sk.className = 'skeleton-row';
      sk.innerHTML = `
        <div class="skeleton-meta">
          <div class="skeleton-box" style="width: 20px; height: 20px;"></div>
          <div class="skeleton-box" style="width: 70px; height: 12px;"></div>
          <div class="skeleton-box" style="width: 35px; height: 10px;"></div>
        </div>
        <div class="skeleton-box" style="width: ${60 + (i * 10)}%; height: 14px; margin-left: 26px;"></div>
      `;
      messagesList.appendChild(sk);
    }
  }

  // Initialize Socket.io connection
  function initSocket(username, token) {
    if (socket) {
      socket.disconnect();
    }

    renderSkeletons();
    socket = io();

    socket.on('connect', () => {
      connIndicator.className = 'status-indicator live';
      connStatus.textContent = 'CONNECTED';
      socket.emit('auth:login', { username, token });
    });

    socket.on('auth:success', (data) => {
      currentUser = data.username;
      currentToken = data.token;
      localStorage.setItem('orbit_chat_username', currentUser);
      localStorage.setItem('orbit_chat_token', currentToken);

      currentUsernameBadge.textContent = `@${currentUser}`;

      // Switch views
      authModal.classList.add('hidden');
      app.classList.remove('hidden');

      // Populate recent messages
      messagesList.innerHTML = '';
      lastMessageSender = null;
      lastMessageTime = 0;
      lastMessageDateStr = '';

      if (data.recentMessages && data.recentMessages.length > 0) {
        data.recentMessages.forEach(msg => {
          appendMessage(msg, msg.username === currentUser);
        });
        emptyState.classList.add('hidden');
      } else {
        emptyState.classList.remove('hidden');
      }

      if (data.onlineUsers) {
        updateUsers(data.onlineUsers);
      }

      scrollToBottom(true);
      messageInput.focus();
    });

    socket.on('auth:error', (data) => {
      showError(data.error || 'Authentication rejected.');
      authModal.classList.remove('hidden');
      app.classList.add('hidden');
    });

    socket.on('chat:message', (msg) => {
      const isOwn = msg.username === currentUser;
      appendMessage(msg, isOwn);
      if (!isOwn) {
        playBeep();
      }
    });

    socket.on('chat:system', (data) => {
      appendSystemNotice(data.text);
    });

    socket.on('presence:update', (data) => {
      if (data.onlineUsers) {
        updateUsers(data.onlineUsers);
      }
    });

    socket.on('typing:update', (data) => {
      if (data.username === currentUser) return;

      if (data.isTyping) {
        activeTypers.add(data.username);
      } else {
        activeTypers.delete(data.username);
      }

      if (activeTypers.size > 0) {
        const names = Array.from(activeTypers);
        if (names.length === 1) {
          typingText.textContent = `${names[0]} is typing`;
        } else if (names.length === 2) {
          typingText.textContent = `${names[0]} and ${names[1]} are typing`;
        } else {
          typingText.textContent = `multiple users are typing`;
        }
        typingIndicator.classList.remove('hidden');
      } else {
        typingIndicator.classList.add('hidden');
      }
    });

    socket.on('disconnect', () => {
      connIndicator.className = 'status-indicator offline';
      connStatus.textContent = 'OFFLINE';
    });
  }

  function showError(msg) {
    authError.textContent = msg;
    authError.classList.remove('hidden');
  }

  function clearError() {
    authError.textContent = '';
    authError.classList.add('hidden');
  }

  // Form & Input listeners
  usernameInput.addEventListener('input', () => {
    charNum.textContent = usernameInput.value.length;
    clearError();
  });

  toggleKeyBtn.addEventListener('click', () => {
    keyInputContainer.classList.toggle('collapsed');
    if (!keyInputContainer.classList.contains('collapsed')) {
      privateKeyInput.focus();
    }
  });

  authForm.addEventListener('submit', () => {
    clearError();
    const handle = usernameInput.value.trim();
    const key = privateKeyInput.value.trim();

    if (!handle) {
      showError('Handle is required.');
      return;
    }

    if (handle.length > 20) {
      showError('Handle must be 20 characters or fewer.');
      return;
    }

    claimBtn.disabled = true;
    claimBtn.querySelector('span').textContent = 'Connecting...';

    // Verify through REST endpoint
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: handle,
        token: key || null
      })
    })
    .then(r => r.json())
    .then(res => {
      claimBtn.disabled = false;
      claimBtn.querySelector('span').textContent = 'Join';

      if (!res.success) {
        showError(res.error || 'Claim rejected.');
        // Auto-reveal private key field if username is taken
        if (res.error && res.error.toLowerCase().includes('private key')) {
          keyInputContainer.classList.remove('collapsed');
          privateKeyInput.focus();
        }
        return;
      }

      initSocket(res.username, res.token);
    })
    .catch(() => {
      claimBtn.disabled = false;
      claimBtn.querySelector('span').textContent = 'Join';
      showError('Connection error. Server may be starting.');
    });
  });

  // Auto-grow textarea & Enter-to-send
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 130) + 'px';

    // Broadcast typing state
    if (!socket) return;
    if (!isCurrentlyTyping && messageInput.value.trim().length > 0) {
      isCurrentlyTyping = true;
      socket.emit('typing:start');
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      if (isCurrentlyTyping) {
        isCurrentlyTyping = false;
        socket.emit('typing:stop');
      }
    }, 1500);
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  chatForm.addEventListener('submit', () => {
    const text = messageInput.value.trim();
    if (!text || !socket) return;

    socket.emit('chat:send', { text });
    messageInput.value = '';
    messageInput.style.height = 'auto';

    if (isCurrentlyTyping) {
      isCurrentlyTyping = false;
      clearTimeout(typingTimeout);
      socket.emit('typing:stop');
    }

    messageInput.focus();
  });

  // Scroll bottom pill click
  scrollBottomPill.addEventListener('click', () => {
    scrollToBottom(true);
  });

  messagesContainer.addEventListener('scroll', () => {
    if (isUserNearBottom()) {
      unreadCount = 0;
      scrollBottomPill.classList.add('hidden');
    }
  });

  // Audio Toggle
  toggleSoundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('orbit_chat_sound', soundEnabled);
    updateSoundUI();
  });

  function updateSoundUI() {
    if (soundEnabled) {
      soundIconOn.classList.remove('hidden');
      soundIconOff.classList.add('hidden');
    } else {
      soundIconOn.classList.add('hidden');
      soundIconOff.classList.remove('hidden');
    }
  }
  updateSoundUI();

  // Modal: Private Key Popover
  showKeyBtn.addEventListener('click', () => {
    modalUsername.textContent = `@${currentUser}`;
    modalKeyText.textContent = currentToken;
    copyLabel.textContent = 'Copy';
    copyKeyBtn.classList.remove('copied');
    keyModal.classList.remove('hidden');
  });

  function closeModal() {
    keyModal.classList.add('hidden');
  }

  closeKeyModalBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);

  copyKeyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentToken)
      .then(() => {
        copyLabel.textContent = 'Copied!';
        copyKeyBtn.classList.add('copied');
        setTimeout(() => {
          copyLabel.textContent = 'Copy';
          copyKeyBtn.classList.remove('copied');
        }, 2000);
      })
      .catch(() => {
        // Fallback copy
        const ta = document.createElement('textarea');
        ta.value = currentToken;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copyLabel.textContent = 'Copied!';
        copyKeyBtn.classList.add('copied');
        setTimeout(() => {
          copyLabel.textContent = 'Copy';
          copyKeyBtn.classList.remove('copied');
        }, 2000);
      });
  });

  // Switch Identity / Release
  logoutBtn.addEventListener('click', () => {
    if (confirm('Switch handle? Your handle remains reserved under your private key.')) {
      localStorage.removeItem('orbit_chat_username');
      localStorage.removeItem('orbit_chat_token');
      window.location.reload();
    }
  });

  // Mobile drawer toggle
  toggleUsersBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  closeSidebarBtn.addEventListener('click', () => {
    sidebar.classList.remove('open');
  });

  // Auto-authenticate if credentials already present in browser
  if (currentUser && currentToken) {
    usernameInput.value = currentUser;
    charNum.textContent = currentUser.length;
    initSocket(currentUser, currentToken);
  }
})();
