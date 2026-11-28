import { sound } from './audio.js';
import { getGoogleClientId } from './config.js';
import { AuthManager } from './auth.js';
import { NetworkManager } from './network.js';
import { GameEngine, FIGHTER_MOVES } from './engine.js';

const $ = (id) => document.getElementById(id);

const els = {
  brandHome: $('brand-home'),
  modeSwitcher: $('mode-switcher'),
  navOnlineDot: $('nav-online-dot'),
  userAvatar: $('user-avatar'),
  userName: $('user-name'),
  userSub: $('user-sub'),
  btnAuthModal: $('btn-auth-modal'),
  btnSound: $('btn-sound'),
  iconSoundOn: $('icon-sound-on'),
  iconSoundOff: $('icon-sound-off'),

  screenLobby: $('screen-lobby'),
  screenGame: $('screen-game'),
  cardOnline: $('card-online'),

  roundsSelector: $('rounds-selector'),
  onlineIdle: $('online-idle'),
  onlineWaiting: $('online-waiting'),
  onlineJoining: $('online-joining'),
  btnCreateRoom: $('btn-create-room'),
  formJoinRoom: $('form-join-room'),
  inputRoomCode: $('input-room-code'),
  inputInviteLink: $('input-invite-link'),
  displayRoomCode: $('display-room-code'),
  waitingRelayBadge: $('waiting-relay-badge'),
  btnCopyLink: $('btn-copy-link'),
  btnShareNative: $('btn-share-native'),
  waitingStatus: $('waiting-status'),
  joiningStatus: $('joining-status'),
  joiningDot: $('joining-dot'),
  btnRetryJoin: $('btn-retry-join'),
  inputFriendEmail: $('input-friend-email'),
  btnSendGmail: $('btn-send-gmail'),
  btnCancelRoom: $('btn-cancel-room'),
  btnCancelJoin: $('btn-cancel-join'),
  btnLocal2p: $('btn-local-2p'),

  arenaWarmupBar: $('arena-warmup-bar'),
  arenaDiffSelector: $('arena-diff-selector'),
  btnArenaSwitchBunny: $('btn-arena-switch-bunny'),

  canvas: $('game-canvas'),
  stageBanner: $('stage-banner'),
  stageBannerMain: $('stage-banner-main'),
  stageBannerSub: $('stage-banner-sub'),

  hudRedAvatar: $('hud-red-avatar'),
  hudRedName: $('hud-red-name'),
  hudRedTag: $('hud-red-tag'),
  hudRedRounds: $('hud-red-rounds'),
  hudRedHp: $('hud-red-hp'),
  hudRedHpTrail: $('hud-red-hp-trail'),
  hudRedHpVal: $('hud-red-hp-val'),
  hudRedSuper: $('hud-red-super'),
  hudRedSuperVal: $('hud-red-super-val'),

  hudBlueAvatar: $('hud-blue-avatar'),
  hudBlueName: $('hud-blue-name'),
  hudBlueTag: $('hud-blue-tag'),
  hudBlueRounds: $('hud-blue-rounds'),
  hudBlueHp: $('hud-blue-hp'),
  hudBlueHpTrail: $('hud-blue-hp-trail'),
  hudBlueHpVal: $('hud-blue-hp-val'),
  hudBlueSuper: $('hud-blue-super'),
  hudBlueSuperVal: $('hud-blue-super-val'),

  hudRoundLabel: $('hud-round-label'),
  hudTimer: $('hud-timer'),
  hudNetBadge: $('hud-net-badge'),
  hudPing: $('hud-ping'),

  controlsP1: $('controls-p1'),
  btnSuperMove: $('btn-super-move'),
  superChargeBg: $('super-charge-bg'),
  superBadge: $('super-badge'),
  btnExitMatch: $('btn-exit-match'),

  matchOverlay: $('match-overlay'),
  matchResultBadge: $('match-result-badge'),
  matchWinnerTitle: $('match-winner-title'),
  matchWinnerSub: $('match-winner-sub'),
  btnRematch: $('btn-rematch'),
  btnSwitchBunny: $('btn-switch-bunny'),
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
let warmupSide = 'wifebun'; // 'wifebun' | 'husbun' for solo warmup vs CPU
let mySide = 'red';         // 'red' (Wifebun) | 'blue' (Husbun)
let currentMode = 'cpu';    // 'cpu' | 'local' | 'online-host' | 'online-guest'
let currentCpuDiff = 'medium';
let opponentProfile = { name: 'Opponent', email: '', picture: '' };
let myRematchReady = false;
let oppRematchReady = false;
let lastJoinCode = '';
let toastTimer = null;
let onlineGlowTimer = null;

function showToast(msg, duration = 2600) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), duration);
}

function setActiveNav(navId) {
  if (!els.modeSwitcher) return;
  els.modeSwitcher.querySelectorAll('.nav-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === navId);
  });
}

function updateOnlineLiveDot() {
  if (!els.navOnlineDot) return;
  const live = Boolean(net && (net.roomCode || net.isConnected()));
  els.navOnlineDot.classList.toggle('hidden', !live);
}

function syncCpuDiffUI(diff) {
  currentCpuDiff = diff || 'medium';
  document.querySelectorAll('.btn-diff, .btn-arena-diff').forEach((b) => {
    b.classList.toggle('active', b.dataset.diff === currentCpuDiff);
  });
}

function syncSwitchBunnyLabels() {
  const nextLabel = warmupSide === 'wifebun' ? '⇄ Play Husbun' : '⇄ Play Wifebun';
  if (els.btnArenaSwitchBunny) els.btnArenaSwitchBunny.textContent = nextLabel;
  if (els.btnSwitchBunny) {
    els.btnSwitchBunny.textContent = warmupSide === 'wifebun' ? '💪 Switch to Husbun' : '🎀 Switch to Wifebun';
  }
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

function clearMoveDeckSpoilers() {
  const defaults = [
    { emoji: '✨', label: 'MOVE 1' },
    { emoji: '✨', label: 'MOVE 2' },
    { emoji: '✨', label: 'MOVE 3' },
    { emoji: '🌟', label: 'SPECIAL SUPER' },
  ];
  defaults.forEach((d, idx) => {
    const emojiEl = $(`move${idx}-emoji`);
    const labelEl = $(`move${idx}-label`);
    if (emojiEl) emojiEl.textContent = d.emoji;
    if (labelEl) labelEl.textContent = d.label;
  });
}

function setJoiningState(text, isError = false) {
  els.joiningStatus.textContent = text;
  const pulseWrap = els.joiningStatus.closest('.status-pulse');
  if (pulseWrap) pulseWrap.classList.toggle('is-error', isError);
  els.btnRetryJoin.classList.toggle('hidden', !isError || !lastJoinCode);
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
    const redSuper = Math.min(100, Math.max(0, Math.round(hud.red.superMeter || 0)));
    const blueSuper = Math.min(100, Math.max(0, Math.round(hud.blue.superMeter || 0)));

    els.hudRedHp.style.width = `${redPct}%`;
    els.hudRedHpTrail.style.width = `${redPct}%`;
    els.hudRedHpVal.textContent = `${redPct}%`;
    els.hudRedSuper.style.width = `${redSuper}%`;
    els.hudRedSuper.classList.toggle('super-max', redSuper >= 100);
    els.hudRedSuperVal.textContent = redSuper >= 100 ? 'MAX ★' : `${redSuper}%`;

    els.hudBlueHp.style.width = `${bluePct}%`;
    els.hudBlueHpTrail.style.width = `${bluePct}%`;
    els.hudBlueHpVal.textContent = `${bluePct}%`;
    els.hudBlueSuper.style.width = `${blueSuper}%`;
    els.hudBlueSuper.classList.toggle('super-max', blueSuper >= 100);
    els.hudBlueSuperVal.textContent = blueSuper >= 100 ? 'MAX ★' : `${blueSuper}%`;

    const activeSide = currentMode === 'local' ? 'red' : mySide;
    const mySuper = activeSide === 'red' ? redSuper : blueSuper;
    els.superChargeBg.style.width = `${mySuper}%`;
    els.btnSuperMove.classList.toggle('ready', mySuper >= 100);
    els.superBadge.textContent = mySuper >= 100 ? '★ READY! ★' : `SUPER ${mySuper}%`;

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

    const isWarmup = currentMode === 'cpu';
    els.btnSwitchBunny.classList.toggle('hidden', !isWarmup);
    if (isWarmup) syncSwitchBunnyLabels();

    const winnerName = winner === 'red' ? 'WIFEBUN' : 'HUSBUN';
    els.matchResultBadge.textContent = '💕 BEATDOWN SESH COMPLETE! 💕';
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
// NETWORKING (ONLINE 1v1 — Host is ALWAYS Husbun, Invited Guest is ALWAYS Wifebun!)
// ==========================
const net = new NetworkManager({
  onStatus: (statusMsg, meta = {}) => {
    if (!statusMsg) return;
    if (els.waitingRelayBadge && meta.relay) {
      els.waitingRelayBadge.textContent = `⚡ ${meta.relay}`;
      els.waitingRelayBadge.classList.remove('hidden');
    }
    if (els.screenGame.classList.contains('active') && (currentMode === 'online-host' || currentMode === 'online-guest')) {
      if (meta.reconnecting) {
        els.hudNetBadge.classList.add('is-reconnecting');
        els.hudPing.textContent = 'Reconnecting...';
      } else if (meta.connected) {
        els.hudNetBadge.classList.remove('is-reconnecting');
        if (els.hudPing.textContent === 'Reconnecting...') {
          els.hudPing.textContent = 'Online';
        }
      }
      return;
    }
    if (!els.onlineWaiting.classList.contains('hidden')) {
      els.waitingStatus.textContent = statusMsg;
    } else if (!els.onlineJoining.classList.contains('hidden')) {
      setJoiningState(statusMsg, false);
    } else if (els.btnCreateRoom && els.btnCreateRoom.disabled) {
      els.btnCreateRoom.textContent = statusMsg;
    }
  },

  onConnect: (role) => {
    updateOnlineLiveDot();
    els.hudNetBadge.classList.remove('is-reconnecting');
    if (role === 'host') {
      els.waitingStatus.textContent = 'Wifebun connected! Starting beatdown sesh...';
    } else {
      setJoiningState('Connected! Stepping in as Wifebun...', false);
    }
  },

  onPing: (ms) => {
    els.hudNetBadge.classList.remove('is-reconnecting');
    els.hudPing.textContent = `${ms} ms`;
  },

  onMessage: (msg) => {
    switch (msg.type) {
      case 'hello':
        opponentProfile = msg.profile || { name: 'Wifebun', email: '', picture: '' };
        if (net.role === 'host') {
          const alreadyPlaying = currentMode === 'online-host' && els.screenGame.classList.contains('active');
          net.send({
            type: 'start',
            bestOf: selectedBestOf,
            hostProfile: auth.getProfile(),
          });
          if (!alreadyPlaying) {
            launchMatch('online-host');
          } else {
            net.send({ type: 'state', state: engine.exportState() });
          }
        }
        break;

      case 'start':
        if (msg.hostProfile) opponentProfile = msg.hostProfile;
        selectedBestOf = msg.bestOf || 3;
        if (!(currentMode === 'online-guest' && els.screenGame.classList.contains('active') && engine.phase !== 'match_over')) {
          launchMatch('online-guest');
        }
        break;

      case 'input':
        // Guest is ALWAYS Wifebun ('red')!
        if (currentMode === 'online-host') {
          if (typeof msg.moveIndex === 'number') {
            engine.triggerMove('red', msg.moveIndex);
          } else if (msg.action === 'jump') {
            engine.triggerJump('red');
          } else if (msg.action === 'dodge') {
            engine.triggerDodge('red');
          } else if (msg.action === 'left' || msg.action === 'right' || msg.action === 'block') {
            engine.setInput('red', msg.action, msg.active);
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
    updateOnlineLiveDot();
    if (currentMode === 'online-host' || currentMode === 'online-guest') {
      showToast('Opponent left the match.', 3500);
      returnToLobby();
    }
  },

  onError: (err) => {
    showToast(err.message || 'Network connection error.', 3500);
  },
});

// ==========================
// SCREEN FLOW & QUICK MODE NAVIGATION
// ==========================
function setOnlinePanel(panel) {
  els.onlineIdle.classList.toggle('hidden', panel !== 'idle');
  els.onlineWaiting.classList.toggle('hidden', panel !== 'waiting');
  els.onlineJoining.classList.toggle('hidden', panel !== 'joining');
  updateOnlineLiveDot();
}

function clearRoomQueryParam() {
  const url = new URL(window.location.href);
  if (url.searchParams.has('room')) {
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }
}

function disconnectIfOnline() {
  if (net.roomCode || net.isConnected() || currentMode === 'online-host' || currentMode === 'online-guest') {
    net.disconnect(true);
    setOnlinePanel('idle');
    clearRoomQueryParam();
  }
}

function launchMatch(mode, cpuDiff = currentCpuDiff) {
  sound.init();
  releaseAllHeldInputs();
  currentMode = mode;
  syncCpuDiffUI(cpuDiff);
  myRematchReady = false;
  oppRematchReady = false;

  const me = auth.getProfile();
  let redProfile, blueProfile;

  if (mode === 'cpu') {
    mySide = warmupSide === 'husbun' ? 'blue' : 'red';
    if (mySide === 'red') {
      redProfile = { name: 'WIFEBUN', picture: me.picture };
      blueProfile = { name: 'HUSBUN (CPU)', picture: '' };
    } else {
      redProfile = { name: 'WIFEBUN (CPU)', picture: '' };
      blueProfile = { name: 'HUSBUN', picture: me.picture };
    }
    setActiveNav(warmupSide === 'husbun' ? 'husbun' : 'wifebun');
  } else if (mode === 'local') {
    mySide = 'red';
    redProfile = { name: 'WIFEBUN', picture: '' };
    blueProfile = { name: 'HUSBUN', picture: '' };
    setActiveNav('local');
  } else if (mode === 'online-host') {
    // Host is ALWAYS Husbun ('blue'), Invited player is ALWAYS Wifebun ('red')!
    mySide = 'blue';
    redProfile = { name: `WIFEBUN (${opponentProfile.name})`, picture: opponentProfile.picture };
    blueProfile = { name: `HUSBUN (${me.name})`, picture: me.picture };
    setActiveNav('online');
  } else {
    // Invited guest is ALWAYS Wifebun ('red')!
    mySide = 'red';
    redProfile = { name: `WIFEBUN (${me.name})`, picture: me.picture };
    blueProfile = { name: `HUSBUN (${opponentProfile.name})`, picture: opponentProfile.picture };
    setActiveNav('online');
  }

  renderAvatar(els.hudRedAvatar, redProfile, '🎀');
  els.hudRedName.textContent = redProfile.name;
  renderAvatar(els.hudBlueAvatar, blueProfile, '💪');
  els.hudBlueName.textContent = blueProfile.name;

  els.hudRedTag.classList.toggle('hidden', mode === 'local' || mySide !== 'red');
  els.hudBlueTag.classList.toggle('hidden', mode === 'local' || mySide !== 'blue');
  els.hudNetBadge.classList.toggle('hidden', !(mode === 'online-host' || mode === 'online-guest'));

  const isWarmup = mode === 'cpu';
  els.arenaWarmupBar.classList.toggle('hidden', !isWarmup);
  els.screenGame.classList.toggle('has-warmup-bar', isWarmup);
  if (isWarmup) syncSwitchBunnyLabels();

  updateMoveDeckForSide(mySide);
  updateOnlineLiveDot();

  els.matchOverlay.classList.add('hidden');
  els.screenLobby.classList.remove('active');
  els.screenGame.classList.add('active');

  engine.startMatch({ mode, bestOf: selectedBestOf, cpuDifficulty: currentCpuDiff, humanSide: mySide });
}

function returnToLobby({ keepOnlineRoom = false, navTarget = 'lobby' } = {}) {
  releaseAllHeldInputs();
  if (!keepOnlineRoom) {
    net.disconnect(true);
    setOnlinePanel('idle');
    clearRoomQueryParam();
  }
  els.matchOverlay.classList.add('hidden');
  els.screenGame.classList.remove('active');
  els.screenGame.classList.remove('has-warmup-bar');
  els.screenLobby.classList.add('active');
  engine.phase = 'idle';
  clearMoveDeckSpoilers();
  setActiveNav(navTarget);
  updateOnlineLiveDot();
}

function focusOnlineCard() {
  if (!els.cardOnline) return;
  els.cardOnline.classList.add('card-focus-glow');
  els.cardOnline.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  clearTimeout(onlineGlowTimer);
  onlineGlowTimer = setTimeout(() => {
    els.cardOnline.classList.remove('card-focus-glow');
  }, 1600);
}

// Quick Mode Switcher Handler (1-Click Navigation from ANY Screen!)
if (els.modeSwitcher) {
  els.modeSwitcher.addEventListener('click', (e) => {
    const pill = e.target.closest('.nav-pill');
    if (!pill) return;
    const nav = pill.dataset.nav;
    sound.init();

    if (nav === 'lobby') {
      returnToLobby({ keepOnlineRoom: false, navTarget: 'lobby' });
      return;
    }

    if (nav === 'online') {
      const inOnlineMatch =
        (currentMode === 'online-host' || currentMode === 'online-guest') &&
        els.screenGame.classList.contains('active');
      if (inOnlineMatch) {
        setActiveNav('online');
        return;
      }
      const hasWaitingRoom = Boolean(net.roomCode && !els.onlineWaiting.classList.contains('hidden'));
      returnToLobby({ keepOnlineRoom: hasWaitingRoom, navTarget: 'online' });
      focusOnlineCard();
      return;
    }

    if (nav === 'wifebun') {
      disconnectIfOnline();
      warmupSide = 'wifebun';
      launchMatch('cpu', currentCpuDiff);
      return;
    }

    if (nav === 'husbun') {
      disconnectIfOnline();
      warmupSide = 'husbun';
      launchMatch('cpu', currentCpuDiff);
      return;
    }

    if (nav === 'local') {
      disconnectIfOnline();
      launchMatch('local');
      return;
    }
  });
}

function switchWarmupBunny() {
  warmupSide = warmupSide === 'wifebun' ? 'husbun' : 'wifebun';
  launchMatch('cpu', currentCpuDiff);
}

if (els.btnArenaSwitchBunny) {
  els.btnArenaSwitchBunny.addEventListener('click', switchWarmupBunny);
}

if (els.btnSwitchBunny) {
  els.btnSwitchBunny.addEventListener('click', switchWarmupBunny);
}

if (els.arenaDiffSelector) {
  els.arenaDiffSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-arena-diff');
    if (!btn) return;
    const diff = btn.dataset.diff || 'medium';
    if (diff === currentCpuDiff) return;
    syncCpuDiffUI(diff);
    if (currentMode === 'cpu' && els.screenGame.classList.contains('active')) {
      launchMatch('cpu', currentCpuDiff);
      showToast(`CPU set to ${diff.charAt(0).toUpperCase() + diff.slice(1)}!`);
    }
  });
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
    els.waitingStatus.textContent = 'Waiting for Wifebun to hop in...';

    if (els.waitingRelayBadge) {
      const relayName = typeof net.getRelayName === 'function' ? net.getRelayName() : '';
      els.waitingRelayBadge.textContent = relayName ? `⚡ ${relayName}` : '';
      els.waitingRelayBadge.classList.toggle('hidden', !relayName);
    }

    setOnlinePanel('waiting');
    setActiveNav('online');
  } catch (err) {
    showToast(err.message || 'Could not create match.', 3500);
  } finally {
    els.btnCreateRoom.disabled = false;
    els.btnCreateRoom.innerHTML = '<span class="btn-icon">💌</span> Create 1v1 Match &amp; Invite Link';
  }
});

async function copyInviteLink() {
  if (!net.roomCode) return;
  const link = auth.buildInviteUrl(net.roomCode);
  try {
    await navigator.clipboard.writeText(link);
    showToast('Invite link copied! She joins automatically as Wifebun 🎀');
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
  const text = `🐰💕 Come play Wifebun vs Husbun Beatdown Sesh with me! Click to join as Wifebun: ${link}`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Wifebun ♥ Husbun — Beatdown Sesh',
        text: '🐰💕 Join me in Wifebun vs Husbun Beatdown Sesh!',
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
  setActiveNav('lobby');
});

els.btnCancelJoin.addEventListener('click', () => {
  net.disconnect();
  lastJoinCode = '';
  clearRoomQueryParam();
  setOnlinePanel('idle');
  setActiveNav('lobby');
});

els.btnRetryJoin.addEventListener('click', async () => {
  const code = lastJoinCode || (typeof net.getLastJoinCode === 'function' ? net.getLastJoinCode() : '');
  if (!code) return;
  if (typeof net.retry === 'function') {
    sound.init();
    setOnlinePanel('joining');
    setActiveNav('online');
    setJoiningState(`Retrying match ${code} as Wifebun...`, false);
    try {
      await net.retry();
    } catch (err) {
      const msg = err?.message || 'Could not reach Husbun. Tap Retry once he opens the match.';
      setJoiningState(msg, true);
      showToast(msg, 3800);
    }
  } else {
    handleJoinCode(code);
  }
});

async function handleJoinCode(code) {
  const clean = (code || '').trim().toUpperCase();
  if (!clean) return;
  lastJoinCode = clean;
  sound.init();
  setOnlinePanel('joining');
  setActiveNav('online');
  setJoiningState(`Joining match ${clean} as Wifebun...`, false);
  try {
    await net.joinRoom(clean, auth.getProfile());
  } catch (err) {
    const msg = err?.message || 'Could not reach Husbun. Tap Retry once he opens the match.';
    setJoiningState(msg, true);
    showToast(msg, 3800);
  }
}

els.formJoinRoom.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = els.inputRoomCode.value.trim();
  if (!code) {
    showToast('Enter a match code first.');
    return;
  }
  handleJoinCode(code);
});

document.querySelectorAll('.btn-diff').forEach((btn) => {
  btn.addEventListener('click', () => {
    syncCpuDiffUI(btn.dataset.diff || 'medium');
  });
});

document.querySelectorAll('.btn-warmup-side').forEach((btn) => {
  btn.addEventListener('click', () => {
    disconnectIfOnline();
    warmupSide = btn.dataset.side || 'wifebun';
    launchMatch('cpu', currentCpuDiff);
  });
});

els.btnLocal2p.addEventListener('click', () => {
  disconnectIfOnline();
  launchMatch('local');
});

els.brandHome.addEventListener('click', () => {
  returnToLobby({ keepOnlineRoom: false, navTarget: 'lobby' });
});

els.btnExitMatch.addEventListener('click', () => returnToLobby({ keepOnlineRoom: false, navTarget: 'lobby' }));
els.btnBackLobby.addEventListener('click', () => returnToLobby({ keepOnlineRoom: false, navTarget: 'lobby' }));

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
// 2D SIDE-SCROLLING FIGHTER CONTROLS (KEYBOARD + ON-SCREEN PAD)
// ==========================
function sendPlayerAction(action, active = true) {
  if (!els.screenGame.classList.contains('active')) return;
  sound.init();

  const moveMatch = /^move([0-3])$/.exec(action);

  if (currentMode === 'online-guest') {
    if (moveMatch) {
      net.send({ type: 'input', moveIndex: Number(moveMatch[1]) });
    } else if (action === 'jump' || action === 'dodge') {
      if (active) net.send({ type: 'input', action });
    } else if (action === 'left' || action === 'right' || action === 'block') {
      net.send({ type: 'input', action, active });
    }
    return;
  }

  const side = currentMode === 'local' ? 'red' : mySide;
  if (moveMatch) {
    engine.triggerMove(side, Number(moveMatch[1]));
  } else if (action === 'jump') {
    if (active) engine.triggerJump(side);
  } else if (action === 'dodge') {
    if (active) engine.triggerDodge(side);
  } else if (action === 'left' || action === 'right' || action === 'block') {
    engine.setInput(side, action, active);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (!els.screenGame.classList.contains('active')) return;

  const key = e.key.toLowerCase();

  // Local 2P splits keyboard between Wifebun (WASD + 1-4 + Q) and Husbun (Arrows + JKLU + Shift)
  if (currentMode === 'local') {
    if (key === 'a') { engine.setInput('red', 'left', true); flashArcadeBtn('left', true); }
    else if (key === 'd') { engine.setInput('red', 'right', true); flashArcadeBtn('right', true); }
    else if (key === 'w') { engine.triggerJump('red'); flashArcadeBtn('jump', true); }
    else if (key === 's') { engine.setInput('red', 'block', true); flashArcadeBtn('block', true); }
    else if (key === 'q') { engine.triggerDodge('red'); flashArcadeBtn('dodge', true); }
    else if (key === '1') { engine.triggerMove('red', 0); flashArcadeBtn('move0', true); }
    else if (key === '2') { engine.triggerMove('red', 1); flashArcadeBtn('move1', true); }
    else if (key === '3') { engine.triggerMove('red', 2); flashArcadeBtn('move2', true); }
    else if (key === '4') { engine.triggerMove('red', 3); flashArcadeBtn('move3', true); }

    else if (key === 'arrowleft') { e.preventDefault(); engine.setInput('blue', 'left', true); }
    else if (key === 'arrowright') { e.preventDefault(); engine.setInput('blue', 'right', true); }
    else if (key === 'arrowup') { e.preventDefault(); engine.triggerJump('blue'); }
    else if (key === 'arrowdown') { e.preventDefault(); engine.setInput('blue', 'block', true); }
    else if (key === 'shift') { engine.triggerDodge('blue'); }
    else if (key === 'j') { engine.triggerMove('blue', 0); }
    else if (key === 'k') { engine.triggerMove('blue', 1); }
    else if (key === 'l') { engine.triggerMove('blue', 2); }
    else if (key === 'u') { engine.triggerMove('blue', 3); }
    return;
  }

  // Solo Warmup & Online 1v1: BOTH WASD & Arrows move/jump/guard; BOTH JKLU & 1-4 trigger moves!
  if (key === 'a' || key === 'arrowleft') {
    if (key === 'arrowleft') e.preventDefault();
    sendPlayerAction('left', true);
    flashArcadeBtn('left', true);
  } else if (key === 'd' || key === 'arrowright') {
    if (key === 'arrowright') e.preventDefault();
    sendPlayerAction('right', true);
    flashArcadeBtn('right', true);
  } else if (key === 'w' || key === 'arrowup') {
    if (key === 'arrowup') e.preventDefault();
    sendPlayerAction('jump', true);
    flashArcadeBtn('jump', true);
  } else if (key === 's' || key === 'arrowdown') {
    if (key === 'arrowdown') e.preventDefault();
    sendPlayerAction('block', true);
    flashArcadeBtn('block', true);
  } else if (key === ' ' || key === 'shift' || key === 'q') {
    if (key === ' ') e.preventDefault();
    sendPlayerAction('dodge', true);
    flashArcadeBtn('dodge', true);
  } else if (key === 'j' || key === '1') {
    sendPlayerAction('move0', true);
    flashArcadeBtn('move0', true);
  } else if (key === 'k' || key === '2') {
    sendPlayerAction('move1', true);
    flashArcadeBtn('move1', true);
  } else if (key === 'l' || key === '3') {
    sendPlayerAction('move2', true);
    flashArcadeBtn('move2', true);
  } else if (key === 'u' || key === '4') {
    sendPlayerAction('move3', true);
    flashArcadeBtn('move3', true);
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();

  if (currentMode === 'local') {
    if (key === 'a') { engine.setInput('red', 'left', false); flashArcadeBtn('left', false); }
    else if (key === 'd') { engine.setInput('red', 'right', false); flashArcadeBtn('right', false); }
    else if (key === 'w') flashArcadeBtn('jump', false);
    else if (key === 's') { engine.setInput('red', 'block', false); flashArcadeBtn('block', false); }
    else if (key === 'q') flashArcadeBtn('dodge', false);
    else if (key === '1') flashArcadeBtn('move0', false);
    else if (key === '2') flashArcadeBtn('move1', false);
    else if (key === '3') flashArcadeBtn('move2', false);
    else if (key === '4') flashArcadeBtn('move3', false);
    else if (key === 'arrowleft') engine.setInput('blue', 'left', false);
    else if (key === 'arrowright') engine.setInput('blue', 'right', false);
    else if (key === 'arrowdown') engine.setInput('blue', 'block', false);
    return;
  }

  if (key === 'a' || key === 'arrowleft') { sendPlayerAction('left', false); flashArcadeBtn('left', false); }
  else if (key === 'd' || key === 'arrowright') { sendPlayerAction('right', false); flashArcadeBtn('right', false); }
  else if (key === 'w' || key === 'arrowup') flashArcadeBtn('jump', false);
  else if (key === 's' || key === 'arrowdown') { sendPlayerAction('block', false); flashArcadeBtn('block', false); }
  else if (key === ' ' || key === 'shift' || key === 'q') flashArcadeBtn('dodge', false);
  else if (key === 'j' || key === '1') flashArcadeBtn('move0', false);
  else if (key === 'k' || key === '2') flashArcadeBtn('move1', false);
  else if (key === 'l' || key === '3') flashArcadeBtn('move2', false);
  else if (key === 'u' || key === '4') flashArcadeBtn('move3', false);
});

function flashArcadeBtn(action, pressed) {
  const btn = els.controlsP1.querySelector(`[data-action="${action}"]`);
  if (btn) btn.classList.toggle('pressed', pressed);
}

function releaseAllHeldInputs() {
  engine.clearInputs();
  els.controlsP1.querySelectorAll('.arcade-btn.pressed').forEach((btn) => btn.classList.remove('pressed'));
  if (currentMode === 'online-guest' && net.isConnected()) {
    ['left', 'right', 'block'].forEach((action) => {
      net.send({ type: 'input', action, active: false });
    });
  }
}

window.addEventListener('blur', releaseAllHeldInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAllHeldInputs();
});

// On-screen fighter pad (touch + mouse)
els.controlsP1.querySelectorAll('.arcade-btn').forEach((btn) => {
  const action = btn.dataset.action;
  const isHold = action === 'left' || action === 'right' || action === 'block';

  const onDown = (e) => {
    e.preventDefault();
    if (btn.classList.contains('pressed')) return;
    btn.classList.add('pressed');
    sendPlayerAction(action, true);
  };
  const onUp = (e) => {
    if (!btn.classList.contains('pressed')) return;
    e.preventDefault();
    btn.classList.remove('pressed');
    if (isHold) sendPlayerAction(action, false);
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

window.addEventListener('beforeunload', () => {
  net.disconnect(true);
});

// ==========================
// AUTO-JOIN FROM ?room= INVITE LINK (Invited player is ALWAYS Wifebun!)
// ==========================
const urlParams = new URLSearchParams(window.location.search);
const inviteRoom = urlParams.get('room');
if (inviteRoom) {
  els.inputRoomCode.value = inviteRoom.toUpperCase();
  handleJoinCode(inviteRoom);
}
