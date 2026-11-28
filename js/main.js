import { sound } from './audio.js';
import { getGoogleClientId } from './config.js';
import { AuthManager } from './auth.js';
import { NetworkManager } from './network.js';
import { GameEngine, FIGHTER_MOVES } from './engine.js';
import { AirHockeyGame } from './games/air-hockey.js';
import { QuickDrawGame } from './games/quick-draw.js';
import { HeartCatchGame } from './games/heart-catch.js';
import { ConnectFourGame } from './games/connect-four.js';

const $ = (id) => document.getElementById(id);

const GAME_ORDER = ['fighter', 'air-hockey', 'quick-draw', 'heart-catch', 'connect-four'];

const GAME_META = {
  lobby: { title: '🏠 Room Lobby', short: 'Room Lobby' },
  fighter: { title: '🥊 Beatdown Sesh', short: 'Beatdown Sesh' },
  'air-hockey': { title: '🏓 Neon Air Hockey', short: 'Air Hockey', Ctor: AirHockeyGame },
  'quick-draw': { title: '⚡ Quick-Draw Smooch', short: 'Quick-Draw', Ctor: QuickDrawGame },
  'heart-catch': { title: '🎯 Heart Catch Rush', short: 'Heart Catch', Ctor: HeartCatchGame },
  'connect-four': { title: '🔴 Bunny Connect 4', short: 'Connect 4', Ctor: ConnectFourGame },
};

const els = {
  brandHome: $('brand-home'),
  roomStatusChip: $('room-status-chip'),
  roomChipDot: $('room-chip-dot'),
  roomChipText: $('room-chip-text'),
  gameTabs: $('game-tabs'),

  userAvatar: $('user-avatar'),
  userName: $('user-name'),
  userSub: $('user-sub'),
  btnAuthModal: $('btn-auth-modal'),
  btnSound: $('btn-sound'),
  iconSoundOn: $('icon-sound-on'),
  iconSoundOff: $('icon-sound-off'),

  screenLobby: $('screen-lobby'),
  screenGame: $('screen-game'),
  screenMinigame: $('screen-minigame'),
  cardOnline: $('card-online'),

  // Room Panel & Live Roster
  waitingRelayBadge: $('waiting-relay-badge'),
  roomOccupancyPill: $('room-occupancy-pill'),
  rosterHusbunAvatar: $('roster-husbun-avatar'),
  rosterHusbunName: $('roster-husbun-name'),
  rosterHusbunYou: $('roster-husbun-you'),
  rosterHusbunWins: $('roster-husbun-wins'),
  rosterHusbunStatus: $('roster-husbun-status'),
  rosterHusbunStatusText: $('roster-husbun-status-text'),
  emotePopBlue: $('emote-pop-blue'),

  rosterWifebunAvatar: $('roster-wifebun-avatar'),
  rosterWifebunName: $('roster-wifebun-name'),
  rosterWifebunYou: $('roster-wifebun-you'),
  rosterWifebunWins: $('roster-wifebun-wins'),
  rosterWifebunStatus: $('roster-wifebun-status'),
  rosterWifebunStatusText: $('roster-wifebun-status-text'),
  rosterWifebunInvitedEmail: $('roster-wifebun-invited-email'),
  emotePopRed: $('emote-pop-red'),

  sessionScoreRed: $('session-score-red'),
  sessionScoreBlue: $('session-score-blue'),
  roomEmotesBar: $('room-emotes-bar'),
  btnLeaveRoom: $('btn-leave-room'),

  onlineIdle: $('online-idle'),
  onlineWaiting: $('online-waiting'),
  onlineJoining: $('online-joining'),
  onlineConnected: $('online-connected'),
  connectedRoomCode: $('connected-room-code'),
  connectedPingBadge: $('connected-ping-badge'),

  btnCreateRoom: $('btn-create-room'),
  formJoinRoom: $('form-join-room'),
  inputRoomCode: $('input-room-code'),
  inputInviteLink: $('input-invite-link'),
  displayRoomCode: $('display-room-code'),
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

  // Arcade Launcher
  arcadeLauncher: $('arcade-launcher'),
  arcadeHeading: $('arcade-heading'),
  arcadeModeHint: $('arcade-mode-hint'),
  soloModeGroup: $('solo-mode-group'),
  lobbySoloSelector: $('lobby-solo-selector'),
  roundsSelector: $('rounds-selector'),

  // Beatdown Sesh Screen
  arenaModeBar: $('arena-mode-bar'),
  arenaOnlinePill: $('arena-online-pill'),
  arenaOnlineLabel: $('arena-online-label'),
  arenaSoloControls: $('arena-solo-controls'),
  arenaPlaymodeSelector: $('arena-playmode-selector'),
  arenaDiffSelector: $('arena-diff-selector'),
  btnArenaSwitchBunny: $('btn-arena-switch-bunny'),
  btnArenaInvite: $('btn-arena-invite'),
  btnArenaRoomLobby: $('btn-arena-room-lobby'),

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
  btnFighterNextGame: $('btn-fighter-next-game'),
  btnBackLobby: $('btn-back-lobby'),
  rematchStatus: $('rematch-status'),

  // Shared Minigame Screen
  mgTitle: $('mg-title'),
  mgOnlinePill: $('mg-online-pill'),
  mgOnlineLabel: $('mg-online-label'),
  mgSoloControls: $('mg-solo-controls'),
  mgPlaymodeSelector: $('mg-playmode-selector'),
  mgBtnInvite: $('mg-btn-invite'),
  mgBtnRestart: $('mg-btn-restart'),
  mgBtnLobby: $('mg-btn-lobby'),
  minigameMount: $('minigame-mount'),
  minigameOverlay: $('minigame-overlay'),
  mgResultBadge: $('mg-result-badge'),
  mgWinnerTitle: $('mg-winner-title'),
  mgWinnerSub: $('mg-winner-sub'),
  mgSessionScore: $('mg-session-score'),
  mgBtnRematch: $('mg-btn-rematch'),
  mgBtnNextGame: $('mg-btn-next-game'),
  mgBtnOverlayLobby: $('mg-btn-overlay-lobby'),
  mgRematchStatus: $('mg-rematch-status'),

  // Auth Modal
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

// ==========================
// APPLICATION STATE
// ==========================
let activeGameId = 'lobby'; // 'lobby' | 'fighter' | 'air-hockey' | 'quick-draw' | 'heart-catch' | 'connect-four'
let roomState = 'idle';     // 'idle' | 'waiting' | 'joining' | 'connected'
let soloPlayMode = 'cpu';   // 'cpu' | 'local'
let selectedBestOf = 3;
let warmupSide = 'wifebun'; // 'wifebun' | 'husbun' for Beatdown Sesh vs CPU
let mySide = 'red';         // 'red' (Wifebun) | 'blue' (Husbun)
let currentMode = 'cpu';    // 'cpu' | 'local' | 'online-host' | 'online-guest'
let currentCpuDiff = 'medium';

let opponentProfile = { name: '', email: '', picture: '' };
let invitedEmail = '';
let sessionScore = { red: 0, blue: 0 };
let scoredCurrentMatch = false;
let lastPingMs = null;

let activeMinigame = null;
let activeMinigameId = null;

let myRematchReady = false;
let oppRematchReady = false;
let lastJoinCode = '';
let toastTimer = null;
let onlineGlowTimer = null;

// ==========================
// HELPERS & UI SYNC
// ==========================
function showToast(msg, duration = 2600) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), duration);
}

function isRoomConnected() {
  return roomState === 'connected' && Boolean(net && net.isConnected());
}

function getMyRoomSide() {
  if (net && net.role === 'guest') return 'red';
  return 'blue';
}

function renderAvatar(el, profile, fallbackEmoji) {
  if (!el) return;
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

function setActiveTab(gameId) {
  if (!els.gameTabs) return;
  els.gameTabs.querySelectorAll('.game-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.game === gameId);
  });
}

function syncSoloPlayModeUI(mode) {
  soloPlayMode = mode === 'local' ? 'local' : 'cpu';
  document.querySelectorAll('[data-solomode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.solomode === soloPlayMode);
  });
  document.querySelectorAll('.btn-arena-playmode, .btn-mg-playmode').forEach((b) => {
    b.classList.toggle('active', b.dataset.playmode === soloPlayMode);
  });
  if (els.arenaDiffSelector) {
    els.arenaDiffSelector.classList.toggle('hidden', soloPlayMode !== 'cpu');
  }
  if (els.btnArenaSwitchBunny) {
    els.btnArenaSwitchBunny.classList.toggle('hidden', soloPlayMode !== 'cpu');
  }
  renderArcadeLauncherCopy();
}

function syncCpuDiffUI(diff) {
  currentCpuDiff = diff || 'medium';
  document.querySelectorAll('.btn-arena-diff').forEach((b) => {
    b.classList.toggle('active', b.dataset.diff === currentCpuDiff);
  });
}

function syncRoundsUI(bestOf) {
  selectedBestOf = Number(bestOf) || 3;
  if (els.roundsSelector) {
    els.roundsSelector.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.rounds) === selectedBestOf);
    });
  }
}

function syncSwitchBunnyLabels() {
  const nextLabel = warmupSide === 'wifebun' ? '⇄ Play Husbun' : '⇄ Play Wifebun';
  if (els.btnArenaSwitchBunny) els.btnArenaSwitchBunny.textContent = nextLabel;
  if (els.btnSwitchBunny) {
    els.btnSwitchBunny.textContent = warmupSide === 'wifebun' ? '💪 Switch to Husbun' : '🎀 Switch to Wifebun';
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

function renderArcadeLauncherCopy() {
  const connected = isRoomConnected();
  if (els.arcadeHeading) {
    els.arcadeHeading.textContent = connected
      ? `Launch Together · Room ${net.roomCode}`
      : 'Pick a Game to Play';
  }
  if (els.arcadeModeHint) {
    els.arcadeModeHint.textContent = connected
      ? 'Click any game — both bunnies switch together!'
      : soloPlayMode === 'cpu'
      ? 'Instant Solo vs CPU · Create a room for Online 1v1'
      : 'Instant Local 2P · Create a room for Online 1v1';
  }
  if (els.soloModeGroup) {
    els.soloModeGroup.classList.toggle('hidden', connected);
  }
  document.querySelectorAll('[data-cta-text]').forEach((el) => {
    el.textContent = connected ? 'Play Together 💕' : 'Play ▶';
  });
}

function renderRoomUI() {
  const me = auth.getProfile();
  const connected = isRoomConnected();
  const isGuest = net && net.role === 'guest';
  const isHost = net && net.role === 'host';
  const code = (net && net.roomCode) || lastJoinCode || '';
  const pingTxt = lastPingMs ? ` · ${lastPingMs} ms` : '';

  // 1. Top Bar Live Room Status Chip
  if (els.roomStatusChip) {
    els.roomStatusChip.classList.remove('state-idle', 'state-waiting', 'state-connected');
    if (connected) {
      els.roomStatusChip.classList.add('state-connected');
      els.roomChipDot.classList.remove('hidden');
      els.roomChipText.textContent = `Room ${code} · 2/2 Online${pingTxt}`;
    } else if (roomState === 'waiting') {
      els.roomStatusChip.classList.add('state-waiting');
      els.roomChipDot.classList.remove('hidden');
      els.roomChipText.textContent = `Room ${code} · 1/2 Waiting`;
    } else if (roomState === 'joining') {
      els.roomStatusChip.classList.add('state-waiting');
      els.roomChipDot.classList.remove('hidden');
      els.roomChipText.textContent = `Joining ${code}...`;
    } else {
      els.roomStatusChip.classList.add('state-idle');
      els.roomChipDot.classList.add('hidden');
      els.roomChipText.textContent = '💌 Create Room';
    }
  }

  // 2. Occupancy Pill
  if (els.roomOccupancyPill) {
    els.roomOccupancyPill.classList.toggle('is-live', connected);
    els.roomOccupancyPill.classList.toggle('is-waiting', roomState === 'waiting' || roomState === 'joining');
    if (connected) els.roomOccupancyPill.textContent = '● 2/2 Online';
    else if (roomState === 'waiting') els.roomOccupancyPill.textContent = '⏳ 1/2 Waiting';
    else if (roomState === 'joining') els.roomOccupancyPill.textContent = '⏳ Joining...';
    else els.roomOccupancyPill.textContent = 'Solo Mode';
  }

  // 3. Husbun Slot (Host)
  if (!isGuest) {
    renderAvatar(els.rosterHusbunAvatar, me, '💪');
    els.rosterHusbunName.textContent = me.name || 'Husbun';
    els.rosterHusbunYou.classList.remove('hidden');
    els.rosterHusbunStatus.className = 'roster-status ' + (isHost ? 'status-online' : 'status-ready');
    els.rosterHusbunStatusText.textContent = isHost ? 'Online' : 'Ready to Host';
  } else {
    const hostProf = opponentProfile.name ? opponentProfile : { name: 'Husbun', picture: '' };
    renderAvatar(els.rosterHusbunAvatar, hostProf, '💪');
    els.rosterHusbunName.textContent = hostProf.name || 'Husbun';
    els.rosterHusbunYou.classList.add('hidden');
    if (connected) {
      els.rosterHusbunStatus.className = 'roster-status status-online';
      els.rosterHusbunStatusText.textContent = `Online${pingTxt}`;
    } else {
      els.rosterHusbunStatus.className = 'roster-status status-waiting';
      els.rosterHusbunStatusText.textContent = 'Connecting to Host...';
    }
  }

  // 4. Wifebun Slot (Invited Partner)
  if (isGuest) {
    renderAvatar(els.rosterWifebunAvatar, me, '🎀');
    els.rosterWifebunName.textContent = me.name || 'Wifebun';
    els.rosterWifebunYou.classList.remove('hidden');
    els.rosterWifebunInvitedEmail.classList.add('hidden');
    if (connected) {
      els.rosterWifebunStatus.className = 'roster-status status-online';
      els.rosterWifebunStatusText.textContent = 'Online';
    } else {
      els.rosterWifebunStatus.className = 'roster-status status-waiting';
      els.rosterWifebunStatusText.textContent = 'Joining room...';
    }
  } else if (connected) {
    const guestProf = opponentProfile.name ? opponentProfile : { name: 'Wifebun', picture: '' };
    renderAvatar(els.rosterWifebunAvatar, guestProf, '🎀');
    els.rosterWifebunName.textContent = guestProf.name || 'Wifebun';
    els.rosterWifebunYou.classList.add('hidden');
    els.rosterWifebunStatus.className = 'roster-status status-online';
    els.rosterWifebunStatusText.textContent = `Online${pingTxt}`;
    els.rosterWifebunInvitedEmail.classList.add('hidden');
  } else if (roomState === 'waiting') {
    renderAvatar(els.rosterWifebunAvatar, null, '🎀');
    els.rosterWifebunName.textContent = 'Wifebun';
    els.rosterWifebunYou.classList.add('hidden');
    els.rosterWifebunStatus.className = 'roster-status status-waiting';
    els.rosterWifebunStatusText.textContent = '⏳ Invited — Waiting to join...';
    if (invitedEmail) {
      els.rosterWifebunInvitedEmail.textContent = `Invited: ${invitedEmail}`;
      els.rosterWifebunInvitedEmail.classList.remove('hidden');
    } else {
      els.rosterWifebunInvitedEmail.classList.add('hidden');
    }
  } else {
    renderAvatar(els.rosterWifebunAvatar, null, '🎀');
    els.rosterWifebunName.textContent = 'Wifebun';
    els.rosterWifebunYou.classList.add('hidden');
    els.rosterWifebunStatus.className = 'roster-status status-empty';
    els.rosterWifebunStatusText.textContent = 'Not invited yet — create a room!';
    els.rosterWifebunInvitedEmail.classList.add('hidden');
  }

  // 5. Session Scoreboard
  els.sessionScoreRed.textContent = String(sessionScore.red);
  els.sessionScoreBlue.textContent = String(sessionScore.blue);
  els.rosterWifebunWins.textContent = `🏆 ${sessionScore.red}`;
  els.rosterHusbunWins.textContent = `🏆 ${sessionScore.blue}`;
  if (els.mgSessionScore) {
    els.mgSessionScore.textContent = `Session Score: 🎀 Wifebun ${sessionScore.red} ♥ ${sessionScore.blue} Husbun 💪`;
  }

  // 6. Emotes & Room State Panels
  els.roomEmotesBar.classList.toggle('hidden', !connected);
  els.onlineIdle.classList.toggle('hidden', roomState !== 'idle');
  els.onlineWaiting.classList.toggle('hidden', roomState !== 'waiting');
  els.onlineJoining.classList.toggle('hidden', roomState !== 'joining');
  els.onlineConnected.classList.toggle('hidden', roomState !== 'connected');

  if (connected) {
    els.connectedRoomCode.textContent = code;
    els.connectedPingBadge.textContent = lastPingMs ? `● ${lastPingMs} ms` : '● Online';
  }

  if (roomState === 'idle' && els.waitingRelayBadge) {
    els.waitingRelayBadge.classList.add('hidden');
  }

  // 7. In-Game Mode Bars (Online vs Solo)
  const onlineLabelText = `Online 1v1 · ${code}${pingTxt}`;
  if (els.arenaOnlinePill) {
    els.arenaOnlinePill.classList.toggle('hidden', !connected);
    els.arenaOnlineLabel.textContent = onlineLabelText;
  }
  if (els.arenaSoloControls) els.arenaSoloControls.classList.toggle('hidden', connected);
  if (els.btnArenaInvite) els.btnArenaInvite.classList.toggle('hidden', connected);
  if (els.btnArenaRoomLobby) els.btnArenaRoomLobby.classList.toggle('hidden', !connected);

  if (els.mgOnlinePill) {
    els.mgOnlinePill.classList.toggle('hidden', !connected);
    els.mgOnlineLabel.textContent = onlineLabelText;
  }
  if (els.mgSoloControls) els.mgSoloControls.classList.toggle('hidden', connected);

  renderArcadeLauncherCopy();
}

function showFloatingEmote(emoji, targetSide) {
  const anchor = targetSide === 'red' ? els.emotePopRed : els.emotePopBlue;
  if (!anchor) return;
  const bubble = document.createElement('span');
  bubble.className = 'emote-bubble';
  bubble.textContent = emoji;
  anchor.appendChild(bubble);
  setTimeout(() => bubble.remove(), 1450);
}

function recordSessionWin(winnerSide) {
  if (scoredCurrentMatch) return;
  if (winnerSide !== 'red' && winnerSide !== 'blue') return;
  scoredCurrentMatch = true;
  sessionScore[winnerSide] += 1;
  renderRoomUI();
  if (isRoomConnected() && net.role === 'host') {
    net.send({ type: 'session_score', red: sessionScore.red, blue: sessionScore.blue });
  }
}

function clearRoomQueryParam() {
  const url = new URL(window.location.href);
  if (url.searchParams.has('room')) {
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }
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

// ==========================
// AUTH / PROFILE
// ==========================
const auth = new AuthManager((profile) => {
  syncProfileUI(profile);
  renderRoomUI();
  if (isRoomConnected()) {
    net.send({ type: 'profile_update', profile });
  }
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

// ==========================
// BEATDOWN SESH ENGINE
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
    if (currentMode === 'online-host' && isRoomConnected()) {
      net.send({ type: 'event', event: ev });
    }
  },

  onMatchOver: (winner, redWins, blueWins) => {
    myRematchReady = false;
    oppRematchReady = false;
    els.rematchStatus.classList.add('hidden');
    els.btnRematch.disabled = false;

    recordSessionWin(winner);

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
// NETWORKING (PERSISTENT MULTI-GAME ROOM)
// ==========================
const net = new NetworkManager({
  onStatus: (statusMsg, meta = {}) => {
    if (!statusMsg) return;
    if (els.waitingRelayBadge && meta.relay) {
      els.waitingRelayBadge.textContent = `⚡ ${meta.relay}`;
      els.waitingRelayBadge.classList.remove('hidden');
    }
    if (activeGameId === 'fighter' && (currentMode === 'online-host' || currentMode === 'online-guest')) {
      if (meta.reconnecting) {
        els.hudNetBadge.classList.add('is-reconnecting');
        els.hudPing.textContent = 'Reconnecting...';
      } else if (meta.connected) {
        els.hudNetBadge.classList.remove('is-reconnecting');
        if (els.hudPing.textContent === 'Reconnecting...') {
          els.hudPing.textContent = lastPingMs ? `${lastPingMs} ms` : 'Online';
        }
      }
      return;
    }
    if (roomState === 'waiting') {
      els.waitingStatus.textContent = statusMsg;
    } else if (roomState === 'joining') {
      setJoiningState(statusMsg, false);
    } else if (els.btnCreateRoom && els.btnCreateRoom.disabled) {
      els.btnCreateRoom.textContent = statusMsg;
    }
  },

  onConnect: (role) => {
    roomState = 'connected';
    els.hudNetBadge.classList.remove('is-reconnecting');
    if (role === 'host') {
      els.waitingStatus.textContent = 'Wifebun joined the room!';
    } else {
      setJoiningState('Connected to room!', false);
    }
    renderRoomUI();
  },

  onPing: (ms) => {
    lastPingMs = ms;
    els.hudNetBadge.classList.remove('is-reconnecting');
    els.hudPing.textContent = `${ms} ms`;
    renderRoomUI();
  },

  onMessage: (msg) => {
    switch (msg.type) {
      case 'hello': {
        opponentProfile = msg.profile || { name: 'Wifebun', email: '', picture: '' };
        roomState = 'connected';
        invitedEmail = '';
        if (net.role === 'host') {
          const inOnlineGame =
            activeGameId !== 'lobby' &&
            (currentMode === 'online-host');
          const targetGame = inOnlineGame ? activeGameId : 'lobby';

          net.send({
            type: 'room_joined',
            hostProfile: auth.getProfile(),
            currentGame: targetGame,
            bestOf: selectedBestOf,
            sessionScore: { ...sessionScore },
          });

          if (activeGameId !== targetGame) {
            switchGame(targetGame, { broadcast: false });
          } else if (targetGame === 'fighter') {
            net.send({ type: 'state', state: engine.exportState() });
          }
          renderRoomUI();
          showToast(`🎀 ${opponentProfile.name || 'Wifebun'} joined your room!`, 3200);
        }
        break;
      }

      case 'room_joined': {
        if (msg.hostProfile) opponentProfile = msg.hostProfile;
        if (msg.bestOf) syncRoundsUI(msg.bestOf);
        if (msg.sessionScore) {
          sessionScore = {
            red: Number(msg.sessionScore.red) || 0,
            blue: Number(msg.sessionScore.blue) || 0,
          };
        }
        roomState = 'connected';
        const targetGame = msg.currentGame && GAME_META[msg.currentGame] ? msg.currentGame : 'lobby';
        switchGame(targetGame, { broadcast: false });
        renderRoomUI();
        showToast(`💕 Joined ${opponentProfile.name || 'Husbun'}'s room!`, 3000);
        break;
      }

      case 'select_game': {
        if (msg.hostProfile && net.role === 'guest') {
          opponentProfile = msg.hostProfile;
        }
        if (msg.bestOf) syncRoundsUI(msg.bestOf);
        const nextGame = msg.gameId && GAME_META[msg.gameId] ? msg.gameId : 'lobby';
        switchGame(nextGame, { broadcast: false });
        if (nextGame === 'lobby') {
          showToast('🏠 Partner returned to Room Lobby');
        } else {
          showToast(`💕 Partner launched ${GAME_META[nextGame].short}!`);
        }
        break;
      }

      case 'mg': {
        if (
          activeMinigame &&
          activeMinigameId === msg.gameId &&
          typeof activeMinigame.handleNet === 'function'
        ) {
          activeMinigame.handleNet(msg.payload);
        }
        break;
      }

      case 'mg_rematch': {
        if (activeMinigame && activeMinigameId === msg.gameId) {
          els.minigameOverlay.classList.add('hidden');
          els.mgRematchStatus.classList.add('hidden');
          scoredCurrentMatch = false;
          if (typeof activeMinigame.restart === 'function') {
            activeMinigame.restart();
          } else {
            mountMinigame(msg.gameId);
          }
          showToast('🔄 Rematch!');
        }
        break;
      }

      case 'emote': {
        const emoji = msg.emoji || '💕';
        const senderSide = msg.fromSide === 'blue' ? 'blue' : 'red';
        showFloatingEmote(emoji, senderSide);
        sound.playJump();
        if (activeGameId !== 'lobby') {
          showToast(`${emoji} ${opponentProfile.name || 'Partner'} sent ${emoji}`, 2200);
        }
        break;
      }

      case 'session_score': {
        sessionScore = {
          red: Number(msg.red) || 0,
          blue: Number(msg.blue) || 0,
        };
        renderRoomUI();
        break;
      }

      case 'profile_update': {
        if (msg.profile) {
          opponentProfile = msg.profile;
          renderRoomUI();
        }
        break;
      }

      // Beatdown Sesh Fighter Protocol
      case 'start': {
        if (msg.hostProfile) opponentProfile = msg.hostProfile;
        if (msg.bestOf) syncRoundsUI(msg.bestOf);
        roomState = 'connected';
        const alreadyPlaying =
          activeGameId === 'fighter' &&
          currentMode === 'online-guest' &&
          engine.phase !== 'match_over';
        if (!alreadyPlaying) {
          switchGame('fighter', { broadcast: false });
        }
        renderRoomUI();
        break;
      }

      case 'input': {
        if (activeGameId === 'fighter' && currentMode === 'online-host') {
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
      }

      case 'state': {
        if (activeGameId === 'fighter' && currentMode === 'online-guest') {
          engine.applyState(msg.state);
        }
        break;
      }

      case 'event': {
        if (activeGameId === 'fighter' && currentMode === 'online-guest') {
          engine.applyNetEvent(msg.event);
        }
        break;
      }

      case 'rematch': {
        if (activeGameId !== 'fighter') break;
        oppRematchReady = true;
        if (myRematchReady && currentMode === 'online-host') {
          net.send({
            type: 'start',
            bestOf: selectedBestOf,
            hostProfile: auth.getProfile(),
          });
          launchFighter('online-host');
        } else {
          els.rematchStatus.textContent = `${opponentProfile.name || 'Partner'} wants a rematch! Click Rematch to go again.`;
          els.rematchStatus.classList.remove('hidden');
        }
        break;
      }
    }
  },

  onDisconnect: () => {
    const wasConnected = roomState === 'connected';
    leaveRoomCompletely(false);
    if (wasConnected) {
      showToast('Partner left the room.', 3500);
    }
  },

  onError: (err) => {
    showToast(err.message || 'Network connection error.', 3500);
  },
});

// ==========================
// MULTI-GAME ROUTER & MINIGAME LIFECYCLE
// ==========================
function destroyActiveMinigame() {
  if (activeMinigame) {
    try {
      if (typeof activeMinigame.destroy === 'function') {
        activeMinigame.destroy();
      }
    } catch (err) {
      console.error('Error destroying minigame:', err);
    }
    activeMinigame = null;
  }
  activeMinigameId = null;
  if (els.minigameMount) els.minigameMount.innerHTML = '';
  if (els.minigameOverlay) els.minigameOverlay.classList.add('hidden');
  if (els.mgRematchStatus) els.mgRematchStatus.classList.add('hidden');
}

function stopFighter() {
  releaseAllHeldInputs();
  els.matchOverlay.classList.add('hidden');
  els.stageBanner.classList.add('hidden');
  engine.phase = 'idle';
  clearMoveDeckSpoilers();
}

function showScreen(screenName) {
  els.screenLobby.classList.toggle('active', screenName === 'lobby');
  els.screenGame.classList.toggle('active', screenName === 'fighter');
  els.screenMinigame.classList.toggle('active', screenName === 'minigame');
}

function switchGame(gameId, { broadcast = true } = {}) {
  const target = GAME_META[gameId] ? gameId : 'lobby';
  sound.init();

  // Broadcast FIRST so partner mounts before receiving any game-start network packets!
  if (broadcast && isRoomConnected()) {
    net.send({
      type: 'select_game',
      gameId: target,
      bestOf: selectedBestOf,
      hostProfile: net.role === 'host' ? auth.getProfile() : undefined,
    });
  }

  destroyActiveMinigame();
  if (activeGameId === 'fighter' && target !== 'fighter') {
    stopFighter();
  }

  activeGameId = target;
  setActiveTab(target);

  if (target === 'lobby') {
    stopFighter();
    showScreen('lobby');
    renderRoomUI();
    return;
  }

  if (target === 'fighter') {
    const mode = isRoomConnected()
      ? (net.role === 'host' ? 'online-host' : 'online-guest')
      : soloPlayMode;
    launchFighter(mode, currentCpuDiff);
    return;
  }

  mountMinigame(target);
}

function launchFighter(mode, cpuDiff = currentCpuDiff) {
  sound.init();
  releaseAllHeldInputs();
  currentMode = mode;
  scoredCurrentMatch = false;
  syncCpuDiffUI(cpuDiff);
  myRematchReady = false;
  oppRematchReady = false;

  const me = auth.getProfile();
  let redProfile;
  let blueProfile;

  if (mode === 'cpu') {
    mySide = warmupSide === 'husbun' ? 'blue' : 'red';
    if (mySide === 'red') {
      redProfile = { name: 'WIFEBUN', picture: me.picture };
      blueProfile = { name: 'HUSBUN (CPU)', picture: '' };
    } else {
      redProfile = { name: 'WIFEBUN (CPU)', picture: '' };
      blueProfile = { name: 'HUSBUN', picture: me.picture };
    }
  } else if (mode === 'local') {
    mySide = 'red';
    redProfile = { name: 'WIFEBUN', picture: '' };
    blueProfile = { name: 'HUSBUN', picture: '' };
  } else if (mode === 'online-host') {
    mySide = 'blue';
    redProfile = {
      name: `WIFEBUN (${opponentProfile.name || 'Partner'})`,
      picture: opponentProfile.picture,
    };
    blueProfile = { name: `HUSBUN (${me.name || 'Host'})`, picture: me.picture };
  } else {
    mySide = 'red';
    redProfile = { name: `WIFEBUN (${me.name || 'Guest'})`, picture: me.picture };
    blueProfile = {
      name: `HUSBUN (${opponentProfile.name || 'Host'})`,
      picture: opponentProfile.picture,
    };
  }

  renderAvatar(els.hudRedAvatar, redProfile, '🎀');
  els.hudRedName.textContent = redProfile.name;
  renderAvatar(els.hudBlueAvatar, blueProfile, '💪');
  els.hudBlueName.textContent = blueProfile.name;

  els.hudRedTag.classList.toggle('hidden', mode === 'local' || mySide !== 'red');
  els.hudBlueTag.classList.toggle('hidden', mode === 'local' || mySide !== 'blue');
  els.hudNetBadge.classList.toggle('hidden', !(mode === 'online-host' || mode === 'online-guest'));
  if (lastPingMs && (mode === 'online-host' || mode === 'online-guest')) {
    els.hudPing.textContent = `${lastPingMs} ms`;
  }

  syncSwitchBunnyLabels();
  syncSoloPlayModeUI(mode === 'local' ? 'local' : 'cpu');
  updateMoveDeckForSide(mySide);

  els.matchOverlay.classList.add('hidden');
  showScreen('fighter');
  renderRoomUI();

  engine.startMatch({
    mode,
    bestOf: selectedBestOf,
    cpuDifficulty: currentCpuDiff,
    humanSide: mySide,
  });
}

function mountMinigame(gameId) {
  const entry = GAME_META[gameId];
  if (!entry || !entry.Ctor) return;

  destroyActiveMinigame();
  scoredCurrentMatch = false;

  const connected = isRoomConnected();
  const mode = connected
    ? (net.role === 'host' ? 'online-host' : 'online-guest')
    : soloPlayMode;
  currentMode = mode;

  const me = auth.getProfile();
  let redName = 'Wifebun';
  let blueName = 'Husbun';

  if (mode === 'online-host') {
    mySide = 'blue';
    redName = opponentProfile.name ? `Wifebun (${opponentProfile.name})` : 'Wifebun';
    blueName = me.name ? `Husbun (${me.name})` : 'Husbun';
  } else if (mode === 'online-guest') {
    mySide = 'red';
    redName = me.name ? `Wifebun (${me.name})` : 'Wifebun';
    blueName = opponentProfile.name ? `Husbun (${opponentProfile.name})` : 'Husbun';
  } else if (mode === 'cpu') {
    mySide = 'red';
    redName = 'Wifebun';
    blueName = 'Husbun (CPU)';
  } else {
    mySide = 'red';
    redName = 'Wifebun';
    blueName = 'Husbun';
  }

  els.mgTitle.textContent = entry.title;
  els.minigameOverlay.classList.add('hidden');
  showScreen('minigame');
  renderRoomUI();

  activeMinigameId = gameId;
  activeMinigame = new entry.Ctor(els.minigameMount, {
    mode,
    mySide,
    redName,
    blueName,
    sendNet: (payload) => {
      if (isRoomConnected()) {
        net.send({ type: 'mg', gameId, payload });
      }
    },
    onGameOver: (winnerSide, summaryText) => {
      handleMinigameOver(gameId, winnerSide, summaryText);
    },
    sound,
  });

  activeMinigame.start();
}

function handleMinigameOver(gameId, winnerSide, summaryText) {
  if (activeGameId !== gameId) return;
  recordSessionWin(winnerSide);

  const entry = GAME_META[gameId] || { short: 'GAME' };
  els.mgResultBadge.textContent = `💕 ${entry.short.toUpperCase()} COMPLETE! 💕`;

  if (winnerSide === 'red') {
    els.mgWinnerTitle.textContent = 'WIFEBUN WINS! 🎀';
    els.mgWinnerTitle.style.color = 'var(--pink)';
  } else if (winnerSide === 'blue') {
    els.mgWinnerTitle.textContent = 'HUSBUN WINS! 💪';
    els.mgWinnerTitle.style.color = 'var(--blue)';
  } else {
    els.mgWinnerTitle.textContent = "IT'S A TIE! 💕";
    els.mgWinnerTitle.style.color = 'var(--gold)';
  }

  els.mgWinnerSub.textContent = summaryText || 'What a close match!';
  els.mgSessionScore.textContent = `Session Score: 🎀 Wifebun ${sessionScore.red} ♥ ${sessionScore.blue} Husbun 💪`;
  els.mgRematchStatus.classList.add('hidden');
  els.minigameOverlay.classList.remove('hidden');
}

function getNextGameId(currentId) {
  const idx = GAME_ORDER.indexOf(currentId);
  if (idx === -1) return GAME_ORDER[0];
  return GAME_ORDER[(idx + 1) % GAME_ORDER.length];
}

function leaveRoomCompletely(notifyPeer = true) {
  net.disconnect(notifyPeer);
  roomState = 'idle';
  lastPingMs = null;
  lastJoinCode = '';
  invitedEmail = '';
  opponentProfile = { name: '', email: '', picture: '' };
  clearRoomQueryParam();
  if (activeGameId !== 'lobby') {
    switchGame('lobby', { broadcast: false });
  } else {
    renderRoomUI();
  }
}

// ==========================
// NAVIGATION & TAB EVENTS
// ==========================
if (els.gameTabs) {
  els.gameTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.game-tab');
    if (!tab) return;
    const targetGame = tab.dataset.game;
    if (!targetGame) return;
    if (targetGame === activeGameId) return;
    switchGame(targetGame, { broadcast: true });
  });
}

if (els.brandHome) {
  els.brandHome.addEventListener('click', () => {
    switchGame('lobby', { broadcast: true });
  });
}

if (els.roomStatusChip) {
  els.roomStatusChip.addEventListener('click', () => {
    if (activeGameId !== 'lobby') {
      switchGame('lobby', { broadcast: true });
    }
    focusOnlineCard();
  });
}

if (els.arcadeLauncher) {
  els.arcadeLauncher.addEventListener('click', (e) => {
    const card = e.target.closest('[data-launch-game]');
    if (!card) return;
    const gameId = card.dataset.launchGame;
    if (gameId) switchGame(gameId, { broadcast: true });
  });
}

// ==========================
// ROOM LOBBY CONTROLS
// ==========================
if (els.roundsSelector) {
  els.roundsSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    syncRoundsUI(Number(btn.dataset.rounds) || 3);
  });
}

if (els.lobbySoloSelector) {
  els.lobbySoloSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-solomode]');
    if (!btn) return;
    syncSoloPlayModeUI(btn.dataset.solomode);
  });
}

if (els.roomEmotesBar) {
  els.roomEmotesBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.emote-btn');
    if (!btn || !isRoomConnected()) return;
    const emoji = btn.dataset.emote || '💕';
    const fromSide = getMyRoomSide();
    const partnerSide = fromSide === 'blue' ? 'red' : 'blue';
    sound.init();
    sound.playJump();
    showFloatingEmote(emoji, partnerSide);
    net.send({ type: 'emote', emoji, fromSide });
  });
}

if (els.btnLeaveRoom) {
  els.btnLeaveRoom.addEventListener('click', () => {
    leaveRoomCompletely(true);
    showToast('Left the gaming room.');
  });
}

els.btnCreateRoom.addEventListener('click', async () => {
  sound.init();
  els.btnCreateRoom.disabled = true;
  els.btnCreateRoom.textContent = 'Creating room...';
  try {
    const code = await net.hostRoom(auth.getProfile());
    roomState = 'waiting';
    invitedEmail = '';
    els.displayRoomCode.textContent = code;
    els.inputInviteLink.value = auth.buildInviteUrl(code);
    els.waitingStatus.textContent = 'Waiting for Wifebun to join...';

    if (els.waitingRelayBadge) {
      const relayName = typeof net.getRelayName === 'function' ? net.getRelayName() : '';
      els.waitingRelayBadge.textContent = relayName ? `⚡ ${relayName}` : '';
      els.waitingRelayBadge.classList.toggle('hidden', !relayName);
    }

    renderRoomUI();
    showToast(`💌 Room ${code} created! Share the link with Wifebun.`);
  } catch (err) {
    showToast(err.message || 'Could not create room.', 3500);
  } finally {
    els.btnCreateRoom.disabled = false;
    els.btnCreateRoom.innerHTML = '<span class="btn-icon">💌</span> Create Gaming Room &amp; Invite Link';
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
  const text = `🐰💕 Come hang out in our Wifebun ♥ Husbun Date Night Arcade room! Click to join as Wifebun: ${link}`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Wifebun ♥ Husbun — Date Night Arcade',
        text: '🐰💕 Join our 1v1 Date Night Arcade room!',
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
  if (friendEmail) {
    invitedEmail = friendEmail;
    renderRoomUI();
  }
  const gmailUrl = auth.buildGmailInviteUrl(friendEmail, net.roomCode);
  window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  showToast(friendEmail ? `Opening Gmail invite to ${friendEmail}...` : 'Opening Gmail invite...');
});

els.btnCancelRoom.addEventListener('click', () => {
  leaveRoomCompletely(false);
  showToast('Room closed.');
});

els.btnCancelJoin.addEventListener('click', () => {
  leaveRoomCompletely(false);
});

els.btnRetryJoin.addEventListener('click', async () => {
  const code = lastJoinCode || (typeof net.getLastJoinCode === 'function' ? net.getLastJoinCode() : '');
  if (!code) return;
  if (typeof net.retry === 'function') {
    sound.init();
    roomState = 'joining';
    renderRoomUI();
    setJoiningState(`Retrying room ${code} as Wifebun...`, false);
    try {
      await net.retry();
    } catch (err) {
      const msg = err?.message || 'Could not reach Husbun. Tap Retry once he opens the room.';
      setJoiningState(msg, true);
      showToast(msg, 3800);
    }
  } else {
    handleJoinCode(code);
  }
});

async function handleJoinCode(code) {
  const clean = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return;
  lastJoinCode = clean;
  sound.init();
  roomState = 'joining';
  if (activeGameId !== 'lobby') {
    switchGame('lobby', { broadcast: false });
  }
  renderRoomUI();
  setJoiningState(`Joining room ${clean} as Wifebun...`, false);
  try {
    await net.joinRoom(clean, auth.getProfile());
  } catch (err) {
    const msg = err?.message || 'Could not reach Husbun. Tap Retry once he opens the room.';
    setJoiningState(msg, true);
    showToast(msg, 3800);
  }
}

els.formJoinRoom.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = els.inputRoomCode.value.trim();
  if (!code) {
    showToast('Enter a room code first.');
    return;
  }
  handleJoinCode(code);
});

// ==========================
// BEATDOWN SESH BAR & OVERLAY EVENTS
// ==========================
function switchWarmupBunny() {
  warmupSide = warmupSide === 'wifebun' ? 'husbun' : 'wifebun';
  launchFighter('cpu', currentCpuDiff);
}

if (els.btnArenaSwitchBunny) els.btnArenaSwitchBunny.addEventListener('click', switchWarmupBunny);
if (els.btnSwitchBunny) els.btnSwitchBunny.addEventListener('click', switchWarmupBunny);

if (els.arenaPlaymodeSelector) {
  els.arenaPlaymodeSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-arena-playmode');
    if (!btn || isRoomConnected()) return;
    const nextMode = btn.dataset.playmode === 'local' ? 'local' : 'cpu';
    if (nextMode === soloPlayMode && currentMode === nextMode) return;
    syncSoloPlayModeUI(nextMode);
    launchFighter(nextMode, currentCpuDiff);
  });
}

if (els.arenaDiffSelector) {
  els.arenaDiffSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-arena-diff');
    if (!btn || isRoomConnected()) return;
    const diff = btn.dataset.diff || 'medium';
    if (diff === currentCpuDiff) return;
    syncCpuDiffUI(diff);
    if (currentMode === 'cpu' && activeGameId === 'fighter') {
      launchFighter('cpu', currentCpuDiff);
      showToast(`CPU set to ${diff.charAt(0).toUpperCase() + diff.slice(1)}!`);
    }
  });
}

if (els.btnArenaInvite) {
  els.btnArenaInvite.addEventListener('click', () => {
    switchGame('lobby', { broadcast: false });
    focusOnlineCard();
  });
}

if (els.btnArenaRoomLobby) {
  els.btnArenaRoomLobby.addEventListener('click', () => switchGame('lobby', { broadcast: true }));
}

els.btnExitMatch.addEventListener('click', () => switchGame('lobby', { broadcast: true }));
els.btnBackLobby.addEventListener('click', () => switchGame('lobby', { broadcast: true }));

if (els.btnFighterNextGame) {
  els.btnFighterNextGame.addEventListener('click', () => {
    switchGame(getNextGameId('fighter'), { broadcast: true });
  });
}

els.btnRematch.addEventListener('click', () => {
  if (currentMode === 'cpu' || currentMode === 'local') {
    launchFighter(currentMode, currentCpuDiff);
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
    launchFighter('online-host');
  } else {
    els.rematchStatus.textContent = `Waiting for ${opponentProfile.name || 'Partner'} to accept rematch...`;
    els.rematchStatus.classList.remove('hidden');
  }
});

// ==========================
// SHARED MINIGAME BAR & OVERLAY EVENTS
// ==========================
function triggerMinigameRestart() {
  if (!activeMinigame || !activeMinigameId) return;
  els.minigameOverlay.classList.add('hidden');
  els.mgRematchStatus.classList.add('hidden');
  scoredCurrentMatch = false;

  if (isRoomConnected()) {
    net.send({ type: 'mg_rematch', gameId: activeMinigameId });
  }
  if (typeof activeMinigame.restart === 'function') {
    activeMinigame.restart();
  } else {
    mountMinigame(activeMinigameId);
  }
}

if (els.mgPlaymodeSelector) {
  els.mgPlaymodeSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-mg-playmode');
    if (!btn || isRoomConnected()) return;
    const nextMode = btn.dataset.playmode === 'local' ? 'local' : 'cpu';
    if (nextMode === soloPlayMode && currentMode === nextMode) return;
    syncSoloPlayModeUI(nextMode);
    if (activeMinigameId) mountMinigame(activeMinigameId);
  });
}

if (els.mgBtnInvite) {
  els.mgBtnInvite.addEventListener('click', () => {
    switchGame('lobby', { broadcast: false });
    focusOnlineCard();
  });
}

if (els.mgBtnRestart) els.mgBtnRestart.addEventListener('click', triggerMinigameRestart);
if (els.mgBtnRematch) els.mgBtnRematch.addEventListener('click', triggerMinigameRestart);

if (els.mgBtnLobby) {
  els.mgBtnLobby.addEventListener('click', () => switchGame('lobby', { broadcast: true }));
}
if (els.mgBtnOverlayLobby) {
  els.mgBtnOverlayLobby.addEventListener('click', () => switchGame('lobby', { broadcast: true }));
}
if (els.mgBtnNextGame) {
  els.mgBtnNextGame.addEventListener('click', () => {
    switchGame(getNextGameId(activeMinigameId || 'air-hockey'), { broadcast: true });
  });
}

// ==========================
// AUTH MODAL & SOUND EVENTS
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
// BEATDOWN SESH CONTROLS (ONLY ACTIVE ON #screen-game!)
// ==========================
function sendPlayerAction(action, active = true) {
  if (activeGameId !== 'fighter' || !els.screenGame.classList.contains('active')) return;
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
  if (activeGameId !== 'fighter' || !els.screenGame.classList.contains('active')) return;

  const key = e.key.toLowerCase();

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
  if (activeGameId !== 'fighter' || !els.screenGame.classList.contains('active')) return;
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
  if (activeGameId === 'fighter' && currentMode === 'online-guest' && isRoomConnected()) {
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
// MAIN BEATDOWN SESH LOOP
// ==========================
let lastTime = performance.now();
let lastNetSync = 0;

function tick(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (activeGameId === 'fighter' && els.screenGame.classList.contains('active')) {
    engine.update(dt);
    engine.render();

    if (currentMode === 'online-host' && isRoomConnected() && now - lastNetSync >= 33) {
      lastNetSync = now;
      net.send({ type: 'state', state: engine.exportState() });
    }
  }

  requestAnimationFrame(tick);
}

// Initial UI hydration
syncProfileUI(auth.getProfile());
syncSoloPlayModeUI('cpu');
syncRoundsUI(3);
renderRoomUI();
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
