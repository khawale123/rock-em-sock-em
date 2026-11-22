import { getGoogleClientId, setGoogleClientId } from './config.js';

const STORAGE_PROFILE_KEY = 'rese_player_profile';

export class AuthManager {
  constructor(onChange) {
    this.onChange = onChange;
    this.profile = this._loadProfile();
  }

  _loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_PROFILE_KEY) || 'null');
      if (saved && saved.name) return saved;
    } catch (_) {}
    return {
      name: `Boxer${Math.floor(100 + Math.random() * 900)}`,
      email: '',
      picture: '',
      isGoogle: false,
    };
  }

  _saveProfile() {
    localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(this.profile));
    if (this.onChange) this.onChange(this.profile);
  }

  getProfile() {
    return { ...this.profile };
  }

  updateManualProfile(name, email) {
    this.profile.name = (name || '').trim() || this.profile.name;
    this.profile.email = (email || '').trim();
    if (!this.profile.isGoogle) {
      this.profile.picture = '';
    }
    this._saveProfile();
  }

  signOutGoogle() {
    this.profile.isGoogle = false;
    this.profile.picture = '';
    this._saveProfile();
  }

  initGoogleSignIn(buttonContainerEl) {
    const clientId = getGoogleClientId();
    if (!buttonContainerEl) return false;
    buttonContainerEl.innerHTML = '';

    if (!clientId) {
      return false;
    }

    const tryInit = () => {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        return false;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => this._handleGoogleCredential(response),
      });
      window.google.accounts.id.renderButton(buttonContainerEl, {
        theme: 'filled_blue',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        width: 280,
      });
      return true;
    };

    if (!tryInit()) {
      // Retry shortly in case GSI script is still loading
      setTimeout(tryInit, 800);
    }
    return true;
  }

  saveClientId(clientId, buttonContainerEl) {
    setGoogleClientId(clientId);
    return this.initGoogleSignIn(buttonContainerEl);
  }

  _handleGoogleCredential(response) {
    if (!response || !response.credential) return;
    try {
      const payload = this._decodeJwt(response.credential);
      this.profile = {
        name: payload.given_name || payload.name || 'Google Player',
        email: payload.email || '',
        picture: payload.picture || '',
        isGoogle: true,
      };
      this._saveProfile();
    } catch (err) {
      console.error('Failed to decode Google credential:', err);
    }
  }

  _decodeJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  }

  buildInviteUrl(roomCode) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', roomCode);
    return url.toString();
  }

  buildGmailInviteUrl(friendEmail, roomCode) {
    const inviteUrl = this.buildInviteUrl(roomCode);
    const sender = this.profile.name || 'Your bunny';
    const subject = `🐰🥊 ${sender} invited you to Wifebun vs Husbun Beatdown Sesh!`;
    const body = [
      `Hey!`,
      ``,
      `${sender} wants to throw paws in Wifebun vs Husbun Beatdown Sesh!`,
      ``,
      `Click here to jump straight into the ring:`,
      inviteUrl,
      ``,
      `Or enter Match Code: ${roomCode}`,
      ``,
      `Let's settle this! 🐰🥊`,
    ].join('\n');

    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: (friendEmail || '').trim(),
      su: subject,
      body,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  }
}
