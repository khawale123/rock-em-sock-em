import { sound } from './audio.js';
import { getGoogleClientId } from './config.js';
import { AuthManager } from './auth.js';
import { NetworkManager } from './network.js';
import { GameEngine, FIGHTER_MOVES } from './engine.js';

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

  fighterSelector: $('fighter-selector'),
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
let selectedFighter = 'wifebun'; // 'wifebun' ('red') | 'husbun' ('blue')
let mySide = 'red'; // 'red' (Wifebun) | 'blue' (Husbun)
let hostSide = 'red';
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

function renderAvatar(el, profile, fallbackEmoji) {
  el.innerHTML = '';
  if (profile && profile.picture) {
    const img = document.createElement('img');
    img.src = profile.picture;
    img.alt = profile.name || '';
    img.referrerPolicy = 'no-referrer';
    el.appendChild(img);
  } else {
    el.textContent = fallbackEmoji || '🐰';
  }
}

function updateMoveDeckForSide(side) {
  const moves = FIGHTER_MOVES[side] || FIGHTER_MOVES.red;
  moves.forEach((m, idx) => {
    const emojiEl = $(`move${idx}-emoji`);
    const labelEl = $(`move${idx}-label`);
    if (emojiEl) emojiEl.textContent = m.emoji;
    if (labelEl) labelEl.textContent = m.label;
  });
  els.controlsP1.classList.toggle('theme-blue', side === 'blue');
}

// ==========================
// AUTH / PROFILE
// ==========================
const auth = new AuthManager((profile) => {
  syncProfileUI(profile);
});

function syncProfileUI(profile) {
  renderAvatar(els.userAvatar, profile, '🐰');
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

    const winnerName = winner === 'red' ? 'WIFEBUN' : 'HUSBUN';
    els.matchResultBadge.textContent = 'BEATDOWN SESH COMPLETE!';
    els.matchWinnerTitle.textContent = `${winnerName} WINS!`;
    els.matchWinnerTitle.style.color = winner === 'red' ? 'var(--pink)' : 'var(--blue)';
    els.matchWinnerSub.textContent = `Final Score: Wifebun ${redWins} - ${blueWins} Husbun`;
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
      els.waitingStatus.textContent = 'Opponent connected! Starting beatdown sesh...';
    } else {
      els.joiningStatus.textContent = 'Connected! Hopping into the ring...';
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
          hostSide = selectedFighter === 'husbun' ? 'blue' : 'red';
          net.send({
            type: 'start',
            bestOf: selectedBestOf,
            hostSide,
            hostProfile: auth.getProfile(),
          });
          launchMatch('online-host');
        }
        break;

      case 'start':
        if (msg.hostProfile) opponentProfile = msg.hostProfile;
        selectedBestOf = msg.bestOf || 3;
        hostSide = msg.hostSide || 'red';
        launchMatch('online-guest');
        break;

      case 'input':
        if (currentMode === 'online-host') {
          const guestSide = hostSide === 'red' ? 'blue' : 'red';
          if (typeof msg.moveIndex === 'number') {
            engine.triggerMove(guestSide, msg.moveIndex);
          } else if (msg.action === 'block') {
            engine.setBlock(guestSide, msg.active);
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
          net.send({
            type: 'start',
            bestOf: selectedBestOf,
            hostSide,
            hostProfile: auth.getProfile(),
          });
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
      showToast('Opponent left the ring.', 3500);
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
    mySide = selectedFighter === 'husbun' ? 'blue' : 'red';
    if (mySide === 'red') {
      redProfile = { name: `WIFEBUN`, picture: me.picture };
      blueProfile = { name: `HUSBUN (CPU)`, picture: '' };
    } else {
      redProfile = { name: `WIFEBUN (CPU)`, picture: '' };
      blueProfile = { name: `HUSBUN`, picture: me.picture };
    }
  } else if (mode === 'local') {
    mySide = 'red';
    redProfile = { name: 'WIFEBUN', picture: '' };
    blueProfile = { name: 'HUSBUN', picture: '' };
  } else if (mode === 'online-host') {
    mySide = hostSide;
    if (hostSide === 'red') {
      redProfile = { name: `WIFEBUN (${me.name})`, picture: me.picture };
      blueProfile = { name: `HUSBUN (${opponentProfile.name})`, picture: opponentProfile.picture };
    } else {
      redProfile = { name: `WIFEBUN (${opponentProfile.name})`, picture: opponentProfile.picture };
      blueProfile = { name: `HUSBUN (${me.name})`, picture: me.picture };
    }
  } else {
    mySide = hostSide === 'red' ? 'blue' : 'red';
    if (mySide === 'red') {
      redProfile = { name: `WIFEBUN (${me.name})`, picture: me.picture };
      blueProfile = { name: `HUSBUN (${opponentProfile.name})`, picture: opponentProfile.picture };
    } else {
      redProfile = { name: `WIFEBUN (${opponentProfile.name})`, picture: opponentProfile.picture };
      blueProfile = { name: `HUSBUN (${me.name})`, picture: me.picture };
    }
  }

  renderAvatar(els.hudRedAvatar, redProfile, '🎀');
  els.hudRedName.textContent = redProfile.name;
  renderAvatar(els.hudBlueAvatar, blueProfile, '💪');
  els.hudBlueName.textContent = blueProfile.name;

  els.hudRedTag.classList.toggle('hidden', mode === 'local' || mySide !== 'red');
  els.hudBlueTag.classList.toggle('hidden', mode === 'local' || mySide !== 'blue');
  els.hudNetBadge.classList.toggle('hidden', !(mode === 'online-host' || mode === 'online-guest'));

  updateMoveDeckForSide(mySide);

  els.matchOverlay.classList.add('hidden');
  els.screenLobby.classList.remove('active');
  els.screenGame.classList.add('active');

  engine.startMatch({ mode, bestOf: selectedBestOf, cpuDifficulty: cpuDiff, humanSide: mySide });
}

function returnToLobby() {
  net.disconnect();
  setOnlinePanel('idle');
  els.matchOverlay.classList.add('hidden');
  els.screenGame.classList.remove('active');
  els.screenLobby.classList.add('active');
  engine.phase = 'idle';

  const url = new URL(window.location.href);
  if (url.searchParams.has('room')) {
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }
}

// ==========================
// LOBBY EVENTS
// ==========================
els.fighterSelector.addEventListener('click', (e) => {
  const btn = e.target.closest('.fighter-btn');
  if (!btn) return;
  selectedFighter = btn.dataset.fighter || 'wifebun';
  els.fighterSelector.querySelectorAll('.fighter-btn').forEach((b) => b.classList.toggle('active', b === btn));
});

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
    els.waitingStatus.textContent = 'Waiting for your partner to join...';
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
    showToast('Invite link copied! Send it to start the beatdown sesh.');
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
  const text = `🐰🥊 Join me in Wifebun vs Husbun Beatdown Sesh! Click to fight: ${link}`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Wifebun vs Husbun — Beatdown Sesh',
        text: '🐰🥊 Join me in Wifebun vs Husbun Beatdown Sesh!',
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
    net.send({
      type: 'start',
      bestOf: selectedBestOf,
      hostSide,
      hostProfile: auth.getProfile(),
    });
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
// GAME CONTROLS (4 UNIQUE MOVES + GUARD)
// ==========================
function sendPlayerAction(action, active = true) {
  if (!els.screenGame.classList.contains('active')) return;
  sound.init();

  const moveMatch = /^move([0-3])$/.exec(action);

  if (currentMode === 'online-guest') {
    if (moveMatch) {
      net.send({ type: 'input', moveIndex: Number(moveMatch[1]) });
    } else if (action === 'block') {
      net.send({ type: 'input', action: 'block', active });
    }
    return;
  }

  // Host, CPU, or P1 (Wifebun) in Local 2P
  const side = currentMode === 'local' ? 'red' : mySide;
  if (moveMatch) {
    engine.triggerMove(side, Number(moveMatch[1]));
  } else if (action === 'block') {
    engine.setBlock(side, active);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (!els.screenGame.classList.contains('active')) return;

  const key = e.key.toLowerCase();

  // Primary player controls (A/W/D/E or 1/2/3/4 + S/Space for Guard)
  if (key === 'a' || key === '1') {
    sendPlayerAction('move0');
    flashArcadeBtn('move0', true);
  } else if (key === 'w' || key === '2') {
    sendPlayerAction('move1');
    flashArcadeBtn('move1', true);
  } else if (key === 'd' || key === '3') {
    sendPlayerAction('move2');
    flashArcadeBtn('move2', true);
  } else if (key === 'e' || key === '4') {
    sendPlayerAction('move3');
    flashArcadeBtn('move3', true);
  } else if (key === 's' || key === ' ') {
    e.preventDefault();
    sendPlayerAction('block', true);
    flashArcadeBtn('block', true);
  }

  // Local 2P second player (Husbun: J / I / L / O + K Guard)
  if (currentMode === 'local') {
    if (key === 'j') engine.triggerMove('blue', 0);
    else if (key === 'i') engine.triggerMove('blue', 1);
    else if (key === 'l') engine.triggerMove('blue', 2);
    else if (key === 'o') engine.triggerMove('blue', 3);
    else if (key === 'k') engine.setBlock('blue', true);
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'a' || key === '1') flashArcadeBtn('move0', false);
  if (key === 'w' || key === '2') flashArcadeBtn('move1', false);
  if (key === 'd' || key === '3') flashArcadeBtn('move2', false);
  if (key === 'e' || key === '4') flashArcadeBtn('move3', false);
  if (key === 's' || key === ' ') {
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
  window.addEventListener('load', () => {
    setTimeout(() => handleJoinCode(inviteRoom), 300);
  });
}
