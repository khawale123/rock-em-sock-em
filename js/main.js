import { sound } from './audio.js';
import { getGoogleClientId } from './config.js';
import { AuthManager } from './auth.js';
import { NetworkManager } from './network.js';
import { GameEngine } from './engine.js';

const $ = (id) => document.getElementById(id);

const els = {
  brandHome: $('brand-home'),
  userAvatar: $('user-avatar'),
  userName: $('user-name'),
  userSub: $('user-sub'),
  btnAuthModal: $('btn-auth-modal'),
  btnSound: $('btn-sound'),
  iconSoundOn: $('icon-sound-on'),
  iconSoundOff: $('icon-sound-off'),

  screenLobby: $('screen-lobby'),
  screenGame: $('screen-game'),

  roundsSelector: $('rounds-selector'),
  onlineIdle: $('online-idle'),
  onlineWaiting: $('online-waiting'),
  onlineJoining: $('online-joining'),
  btnCreateRoom: $('btn-create-room'),
  formJoinRoom: $('form-join-room'),
  inputRoomCode: $('input-room-code'),
  inputInviteLink: $('input-invite-link'),
  displayRoomCode: $('display-room-code'),
  btnCopyLink: $('btn-copy-link'),
  btnShareNative: $('btn-share-native'),
  waitingStatus: $('waiting-status'),
  joiningStatus: $('joining-status'),
  inputFriendEmail: $('input-friend-email'),
  btnSendGmail: $('btn-send-gmail'),
  btnCancelRoom: $('btn-cancel-room'),
  btnCancelJoin: $('btn-cancel-join'),
  btnLocal2p: $('btn-local-2p'),

  canvas: $('game-canvas'),
  stageBanner: $('stage-banner'),
  stageBannerMain: $('stage-banner-main'),
  stageBannerSub: $('stage-banner-sub'),

  hudRedAvatar: $('hud-red-avatar'),
  hudRedName: $('hud-red-name'),
  hudRedTag: $('hud-red-tag'),
  hudRedRounds: $('hud-red-rounds'),
  hudRedHp: $('hud-red-hp'),
  hudRedHpVal: $('hud-red-hp-val'),
  hudRedStam: $('hud-red-stam'),

  hudBlueAvatar: $('hud-blue-avatar'),
  hudBlueName: $('hud-blue-name'),
  hudBlueTag: $('hud-blue-tag'),
  hudBlueRounds: $('hud-blue-rounds'),
  hudBlueHp: $('hud-blue-hp'),
  hudBlueHpVal: $('hud-blue-hp-val'),
  hudBlueStam: $('hud-blue-stam'),

  hudRoundLabel: $('hud-round-label'),
  hudTimer: $('hud-timer'),
  hudNetBadge: $('hud-net-badge'),
  hudPing: $('hud-ping'),

  controlsP1: $('controls-p1'),
  btnExitMatch: $('btn-exit-match'),

  matchOverlay: $('match-overlay'),
  matchResultBadge: $('match-result-badge'),
  matchWinnerTitle: $('match-winner-title'),
  matchWinnerSub: $('match-winner-sub'),
  btnRematch: $('btn-rematch'),
  btnBackLobby: $('btn-back-lobby'),
  rematchStatus: $('rematch-status'),

  modalAuth: $('modal-auth'),
  btnCloseAuth: $('btn-close-auth'),
  googleBtnWrap: $('google-btn-wrap'),
  googleSignedInInfo: $('google-signed-in-info'),
  modalGooglePic: $('modal-google-pic'),
  modalGoogleName: $('modal-google-name'),
  modalGoogleEmail: $('modal-google-email'),
  btnGoogleSignout: $('btn-google-signout'),
  formProfile: $('form-profile'),
  inputPlayerName: $('input-player-name'),
  inputPlayerEmail: $('input-player-email'),
  inputGoogleClientId: $('input-google-client-id'),
  btnSaveClientId: $('btn-save-client-id'),

  toast: $('toast'),
};

let selectedBestOf = 3;
let currentMode = 'cpu'; // 'cpu' | 'local' | 'online-host' | 'online-guest'
let currentCpuDiff = 'medium';
let opponentProfile = { name: 'Opponent', email: '', picture: '' };
let myRematchReady = false;
let oppRematchReady = false;
let toastTimer = null;

function showToast(msg, duration = 2600) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), duration);
}

function renderAvatar(el, profile, fallbackLetter) {
  el.innerHTML = '';
  if (profile && profile.picture) {
    const img = document.createElement('img');
    img.src = profile.picture;
    img.alt = profile.name || '';
    img.referrerPolicy = 'no-referrer';
    el.appendChild(img);
  } else {
    const letter = ((profile && profile.name) || fallbackLetter || 'P').trim().charAt(0).toUpperCase();
    el.textContent = letter;
  }
}

// ==========================
// AUTH / PROFILE
// ==========================
const auth = new AuthManager((profile) => {
  syncProfileUI(profile);
});

function syncProfileUI(profile) {
  renderAvatar(els.userAvatar, profile, 'P');
  els.userName.textContent = profile.name || 'Player';
  els.userSub.textContent = profile.isGoogle
    ? 'Google Account'
    : profile.email
    ? profile.email
    : 'Guest Profile';

  els.inputPlayerName.value = profile.name || '';
  els.inputPlayerEmail.value = profile.email || '';
  els.inputGoogleClientId.value = getGoogleClientId();

  if (profile.isGoogle) {
    els.googleSignedInInfo.classList.remove('hidden');
    els.googleBtnWrap.classList.add('hidden');
    els.modalGooglePic.src = profile.picture || '';
    els.modalGoogleName.textContent = profile.name;
    els.modalGoogleEmail.textContent = profile.email;
  } else {
    els.googleSignedInInfo.classList.add('hidden');
    els.googleBtnWrap.classList.remove('hidden');
    auth.initGoogleSignIn(els.googleBtnWrap);
  }
}

syncProfileUI(auth.getProfile());

// ==========================
// GAME ENGINE
// ==========================
const engine = new GameEngine(els.canvas, {
  onBanner: (main, sub) => {
    if (!main) {
      els.stageBanner.classList.add('hidden');
      return;
    }
    els.stageBannerMain.textContent = main;
    els.stageBannerSub.textContent = sub || '';
    els.stageBanner.classList.remove('hidden');
  },

  onHud: (hud) => {
    els.hudRoundLabel.textContent = `ROUND ${hud.round}`;
    els.hudTimer.textContent = String(hud.roundTimer).padStart(2, '0');

    const redPct = Math.max(0, Math.round(hud.red.hp));
    const bluePct = Math.max(0, Math.round(hud.blue.hp));
    els.hudRedHp.style.width = `${redPct}%`;
    els.hudRedHpVal.textContent = `${redPct}%`;
    els.hudRedStam.style.width = `${Math.round(hud.red.stamina)}%`;

    els.hudBlueHp.style.width = `${bluePct}%`;
    els.hudBlueHpVal.textContent = `${bluePct}%`;
    els.hudBlueStam.style.width = `${Math.round(hud.blue.stamina)}%`;

    renderRoundPips(els.hudRedRounds, hud.roundsToWin, hud.red.roundsWon, 'won-red');
    renderRoundPips(els.hudBlueRounds, hud.roundsToWin, hud.blue.roundsWon, 'won-blue');
  },

  onNetEvent: (ev) => {
    if (currentMode === 'online-host' && net.isConnected()) {
      net.send({ type: 'event', event: ev });
    }
  },

  onMatchOver: (winner, redWins, blueWins) => {
    myRematchReady = false;
    oppRematchReady = false;
    els.rematchStatus.classList.add('hidden');
    els.btnRematch.disabled = false;

    const winnerName = winner === 'red' ? els.hudRedName.textContent : els.hudBlueName.textContent;
    els.matchResultBadge.textContent = 'KNOCKED THEIR BLOCK OFF!';
    els.matchWinnerTitle.textContent = `${winnerName} WINS!`;
    els.matchWinnerTitle.style.color = winner === 'red' ? 'var(--red)' : 'var(--blue)';
    els.matchWinnerSub.textContent = `Final Score: ${redWins} - ${blueWins}`;
    els.matchOverlay.classList.remove('hidden');
  },
});

function renderRoundPips(container, total, won, wonClass) {
  if (container.childElementCount !== total) {
    container.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip';
      container.appendChild(pip);
    }
  }
  Array.from(container.children).forEach((pip, idx) => {
    pip.className = idx < won ? `pip ${wonClass}` : 'pip';
  });
}

// ==========================
// NETWORKING (ONLINE 1v1)
// ==========================
const net = new NetworkManager({
  onConnect: (role) => {
    if (role === 'host') {
      els.waitingStatus.textContent = 'Opponent connected! Starting match...';
    } else {
      els.joiningStatus.textContent = 'Connected! Entering the ring...';
    }
  },

  onPing: (ms) => {
    els.hudPing.textContent = `${ms} ms`;
  },

  onMessage: (msg) => {
    switch (msg.type) {
      case 'hello':
        opponentProfile = msg.profile || { name: 'Opponent', email: '', picture: '' };
        if (net.role === 'host') {
          // Host launches the match for both players
          net.send({ type: 'start', bestOf: selectedBestOf, hostProfile: auth.getProfile() });
          launchMatch('online-host');
        }
        break;

      case 'start':
        if (msg.hostProfile) opponentProfile = msg.hostProfile;
        selectedBestOf = msg.bestOf || 3;
        launchMatch('online-guest');
        break;

      case 'input':
        if (currentMode === 'online-host') {
          if (msg.action === 'left' || msg.action === 'right') {
            engine.triggerPunch('blue', msg.action);
          } else if (msg.action === 'block') {
            engine.setBlock('blue', msg.active);
          }
        }
        break;

      case 'state':
        if (currentMode === 'online-guest') {
          engine.applyState(msg.state);
        }
        break;

      case 'event':
        if (currentMode === 'online-guest') {
          engine.applyNetEvent(msg.event);
        }
        break;

      case 'rematch':
        oppRematchReady = true;
        if (myRematchReady && currentMode === 'online-host') {
          net.send({ type: 'start', bestOf: selectedBestOf, hostProfile: auth.getProfile() });
          launchMatch('online-host');
        } else {
          els.rematchStatus.textContent = `${opponentProfile.name} wants a rematch! Click Rematch to go again.`;
          els.rematchStatus.classList.remove('hidden');
        }
        break;
    }
  },

  onDisconnect: () => {
    if (currentMode === 'online-host' || currentMode === 'online-guest') {
      showToast('Opponent disconnected from the match.', 3500);
      returnToLobby();
    }
  },

  onError: (err) => {
    showToast(err.message || 'Network connection error.', 3500);
  },
});

// ==========================
// SCREEN FLOW
// ==========================
function setOnlinePanel(panel) {
  els.onlineIdle.classList.toggle('hidden', panel !== 'idle');
  els.onlineWaiting.classList.toggle('hidden', panel !== 'waiting');
  els.onlineJoining.classList.toggle('hidden', panel !== 'joining');
}

function launchMatch(mode, cpuDiff = currentCpuDiff) {
  sound.init();
  currentMode = mode;
  currentCpuDiff = cpuDiff;
  myRematchReady = false;
  oppRematchReady = false;

  const me = auth.getProfile();
  let redProfile, blueProfile;

  if (mode === 'cpu') {
    redProfile = me;
    blueProfile = { name: `CPU (${cpuDiff.toUpperCase()})`, picture: '' };
  } else if (mode === 'local') {
    redProfile = { name: me.name || 'RED ROCKER', picture: me.picture };
    blueProfile = { name: 'BLUE BOMBER', picture: '' };
  } else if (mode === 'online-host') {
    redProfile = me;
    blueProfile = opponentProfile;
  } else {
    redProfile = opponentProfile;
    blueProfile = me;
  }

  renderAvatar(els.hudRedAvatar, redProfile, 'R');
  els.hudRedName.textContent = redProfile.name || 'RED ROCKER';
  renderAvatar(els.hudBlueAvatar, blueProfile, 'B');
  els.hudBlueName.textContent = blueProfile.name || 'BLUE BOMBER';

  // "YOU" badges & control pod theme
  els.hudRedTag.classList.toggle('hidden', mode === 'online-guest' || mode === 'local');
  els.hudBlueTag.classList.toggle('hidden', mode !== 'online-guest');
  els.hudNetBadge.classList.toggle('hidden', !(mode === 'online-host' || mode === 'online-guest'));
  els.controlsP1.classList.toggle('theme-blue', mode === 'online-guest');

  els.matchOverlay.classList.add('hidden');
  els.screenLobby.classList.remove('active');
  els.screenGame.classList.add('active');

  engine.startMatch({ mode, bestOf: selectedBestOf, cpuDifficulty: cpuDiff });
}

function returnToLobby() {
  net.disconnect();
  setOnlinePanel('idle');
  els.matchOverlay.classList.add('hidden');
  els.screenGame.classList.remove('active');
  els.screenLobby.classList.add('active');
  engine.phase = 'idle';

  // Clean ?room= from URL so refresh doesn't auto-rejoin old room
  const url = new URL(window.location.href);
  if (url.searchParams.has('room')) {
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }
}

// ==========================
// LOBBY EVENTS
// ==========================
els.roundsSelector.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  selectedBestOf = Number(btn.dataset.rounds) || 3;
  els.roundsSelector.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
});

els.btnCreateRoom.addEventListener('click', async () => {
  sound.init();
  els.btnCreateRoom.disabled = true;
  els.btnCreateRoom.textContent = 'Creating match...';
  try {
    const code = await net.hostRoom(auth.getProfile());
    els.displayRoomCode.textContent = code;
    els.inputInviteLink.value = auth.buildInviteUrl(code);
    els.waitingStatus.textContent = 'Waiting for opponent to join...';
    setOnlinePanel('waiting');
  } catch (err) {
    showToast(err.message || 'Could not create match.', 3500);
  } finally {
    els.btnCreateRoom.disabled = false;
    els.btnCreateRoom.innerHTML = '<span class="btn-icon">🥊</span> Create 1v1 Match &amp; Invite';
  }
});

async function copyInviteLink() {
  if (!net.roomCode) return;
  const link = auth.buildInviteUrl(net.roomCode);
  try {
    await navigator.clipboard.writeText(link);
    showToast('Invite link copied! Paste it anywhere to invite a friend.');
  } catch (_) {
    els.inputInviteLink.select();
    window.prompt('Copy this invite link:', link);
  }
}

els.btnCopyLink.addEventListener('click', copyInviteLink);
els.inputInviteLink.addEventListener('click', () => {
  els.inputInviteLink.select();
  copyInviteLink();
});

els.btnShareNative.addEventListener('click', async () => {
  if (!net.roomCode) return;
  const link = auth.buildInviteUrl(net.roomCode);
  const text = `🥊 Fight me 1v1 in Rock 'Em Sock 'Em! Click to join my match: ${link}`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Rock 'Em Sock 'Em 1v1 Invite",
        text: "🥊 Fight me 1v1 in Rock 'Em Sock 'Em!",
        url: link,
      });
      return;
    } catch (_) {}
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Invite message copied! Paste it in a text, chat, or email.');
  } catch (_) {
    window.prompt('Copy this invite message:', text);
  }
});

els.btnSendGmail.addEventListener('click', () => {
  if (!net.roomCode) return;
  const friendEmail = els.inputFriendEmail.value.trim();
  const gmailUrl = auth.buildGmailInviteUrl(friendEmail, net.roomCode);
  window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  showToast(friendEmail ? `Opening Gmail invite to ${friendEmail}...` : 'Opening Gmail invite...');
});

els.btnCancelRoom.addEventListener('click', () => {
  net.disconnect();
  setOnlinePanel('idle');
});

els.btnCancelJoin.addEventListener('click', () => {
  net.disconnect();
  setOnlinePanel('idle');
});

async function handleJoinCode(code) {
  sound.init();
  setOnlinePanel('joining');
  els.joiningStatus.textContent = `Connecting to match ${code.toUpperCase()}...`;
  try {
    await net.joinRoom(code, auth.getProfile());
  } catch (err) {
    showToast(err.message || 'Could not join match.', 3600);
    setOnlinePanel('idle');
  }
}

els.formJoinRoom.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = els.inputRoomCode.value.trim();
  if (!code) {
    showToast('Enter a 6-character match code first.');
    return;
  }
  handleJoinCode(code);
});

document.querySelectorAll('.btn-cpu').forEach((btn) => {
  btn.addEventListener('click', () => {
    launchMatch('cpu', btn.dataset.diff || 'medium');
  });
});

els.btnLocal2p.addEventListener('click', () => {
  launchMatch('local');
});

els.brandHome.addEventListener('click', () => {
  if (els.screenGame.classList.contains('active')) {
    returnToLobby();
  }
});

els.btnExitMatch.addEventListener('click', returnToLobby);
els.btnBackLobby.addEventListener('click', returnToLobby);

els.btnRematch.addEventListener('click', () => {
  if (currentMode === 'cpu' || currentMode === 'local') {
    launchMatch(currentMode, currentCpuDiff);
    return;
  }

  myRematchReady = true;
  els.btnRematch.disabled = true;
  net.send({ type: 'rematch' });

  if (oppRematchReady && currentMode === 'online-host') {
    net.send({ type: 'start', bestOf: selectedBestOf, hostProfile: auth.getProfile() });
    launchMatch('online-host');
  } else {
    els.rematchStatus.textContent = `Waiting for ${opponentProfile.name} to accept rematch...`;
    els.rematchStatus.classList.remove('hidden');
  }
});

// ==========================
// AUTH MODAL EVENTS
// ==========================
els.btnAuthModal.addEventListener('click', () => {
  syncProfileUI(auth.getProfile());
  els.modalAuth.classList.remove('hidden');
});

els.btnCloseAuth.addEventListener('click', () => {
  els.modalAuth.classList.add('hidden');
});

els.modalAuth.addEventListener('click', (e) => {
  if (e.target === els.modalAuth) els.modalAuth.classList.add('hidden');
});

els.formProfile.addEventListener('submit', (e) => {
  e.preventDefault();
  auth.updateManualProfile(els.inputPlayerName.value, els.inputPlayerEmail.value);
  els.modalAuth.classList.add('hidden');
  showToast('Profile updated!');
});

els.btnGoogleSignout.addEventListener('click', () => {
  auth.signOutGoogle();
  showToast('Signed out of Google.');
});

els.btnSaveClientId.addEventListener('click', () => {
  const val = els.inputGoogleClientId.value.trim();
  auth.saveClientId(val, els.googleBtnWrap);
  showToast(val ? 'Google Client ID saved!' : 'Google Client ID cleared.');
});

els.btnSound.addEventListener('click', () => {
  const on = sound.toggle();
  els.iconSoundOn.classList.toggle('hidden', !on);
  els.iconSoundOff.classList.toggle('hidden', on);
});

// ==========================
// GAME CONTROLS (KEYBOARD + TOUCH/MOUSE)
// ==========================
function sendPlayerAction(action, active = true) {
  if (!els.screenGame.classList.contains('active')) return;
  sound.init();

  if (currentMode === 'online-guest') {
    net.send({ type: 'input', action, active });
    return;
  }

  // Host, CPU, or P1 in Local
  if (action === 'left' || action === 'right') {
    engine.triggerPunch('red', action);
  } else if (action === 'block') {
    engine.setBlock('red', active);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (!els.screenGame.classList.contains('active')) return;

  const key = e.key.toLowerCase();

  // P1 / Online Player controls
  if (key === 'a' || (currentMode !== 'local' && key === 'arrowleft')) {
    sendPlayerAction('left');
    flashArcadeBtn('left', true);
  } else if (key === 'd' || (currentMode !== 'local' && key === 'arrowright')) {
    sendPlayerAction('right');
    flashArcadeBtn('right', true);
  } else if (key === 's' || key === ' ' || (currentMode !== 'local' && key === 'arrowdown')) {
    e.preventDefault();
    sendPlayerAction('block', true);
    flashArcadeBtn('block', true);
  }

  // Local 2P second player (Blue Bomber: J / K / L)
  if (currentMode === 'local') {
    if (key === 'j') engine.triggerPunch('blue', 'left');
    else if (key === 'l') engine.triggerPunch('blue', 'right');
    else if (key === 'k') engine.setBlock('blue', true);
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'a' || key === 'arrowleft') flashArcadeBtn('left', false);
  if (key === 'd' || key === 'arrowright') flashArcadeBtn('right', false);
  if (key === 's' || key === ' ' || key === 'arrowdown') {
    sendPlayerAction('block', false);
    flashArcadeBtn('block', false);
  }
  if (currentMode === 'local' && key === 'k') {
    engine.setBlock('blue', false);
  }
});

function flashArcadeBtn(action, pressed) {
  const btn = els.controlsP1.querySelector(`[data-action="${action}"]`);
  if (btn) btn.classList.toggle('pressed', pressed);
}

// On-screen tactile buttons (touch + mouse)
els.controlsP1.querySelectorAll('.arcade-btn').forEach((btn) => {
  const action = btn.dataset.action;
  const onDown = (e) => {
    e.preventDefault();
    btn.classList.add('pressed');
    sendPlayerAction(action, true);
  };
  const onUp = (e) => {
    e.preventDefault();
    btn.classList.remove('pressed');
    if (action === 'block') sendPlayerAction('block', false);
  };

  btn.addEventListener('pointerdown', onDown);
  btn.addEventListener('pointerup', onUp);
  btn.addEventListener('pointerleave', onUp);
  btn.addEventListener('pointercancel', onUp);
});

// ==========================
// MAIN GAME LOOP
// ==========================
let lastTime = performance.now();
let lastNetSync = 0;

function tick(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (els.screenGame.classList.contains('active')) {
    engine.update(dt);
    engine.render();

    // Host streams authoritative state at ~30Hz
    if (currentMode === 'online-host' && net.isConnected() && now - lastNetSync >= 33) {
      lastNetSync = now;
      net.send({ type: 'state', state: engine.exportState() });
    }
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

// ==========================
// AUTO-JOIN FROM ?room= INVITE LINK
// ==========================
const urlParams = new URLSearchParams(window.location.search);
const inviteRoom = urlParams.get('room');
if (inviteRoom) {
  els.inputRoomCode.value = inviteRoom.toUpperCase();
  // Slight delay so PeerJS script finishes loading
  window.addEventListener('load', () => {
    setTimeout(() => handleJoinCode(inviteRoom), 300);
  });
}
