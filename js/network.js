import { ROOM_PREFIX } from './config.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(len = 6) {
  let code = '';
  for (let i = 0; i < len; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export class NetworkManager {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.peer = null;
    this.conn = null;
    this.role = null; // 'host' | 'guest'
    this.roomCode = null;
    this.pingTimer = null;
    this.latencyMs = null;
  }

  _ensurePeerJs() {
    if (typeof window.Peer === 'undefined') {
      throw new Error('Multiplayer library (PeerJS) failed to load. Check your internet connection.');
    }
  }

  hostRoom(profile) {
    return new Promise((resolve, reject) => {
      try {
        this._ensurePeerJs();
      } catch (err) {
        reject(err);
        return;
      }

      this.disconnect();
      this.role = 'host';
      this.roomCode = generateRoomCode(6);
      const peerId = ROOM_PREFIX + this.roomCode;

      const peer = new window.Peer(peerId, {
        debug: 1,
      });
      this.peer = peer;

      let opened = false;

      peer.on('open', () => {
        opened = true;
        resolve(this.roomCode);
      });

      peer.on('connection', (conn) => {
        // Accept first opponent only
        if (this.conn && this.conn.open) {
          conn.close();
          return;
        }
        this._attachConnection(conn, profile);
      });

      peer.on('error', (err) => {
        if (!opened) {
          reject(new Error(err.message || 'Could not create room.'));
        } else if (this.handlers.onError) {
          this.handlers.onError(err);
        }
      });
    });
  }

  joinRoom(code, profile) {
    return new Promise((resolve, reject) => {
      try {
        this._ensurePeerJs();
      } catch (err) {
        reject(err);
        return;
      }

      const cleanCode = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleanCode.length < 4) {
        reject(new Error('Please enter a valid match code.'));
        return;
      }

      this.disconnect();
      this.role = 'guest';
      this.roomCode = cleanCode;

      const peer = new window.Peer(undefined, { debug: 1 });
      this.peer = peer;

      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.disconnect();
          reject(new Error('Timed out connecting to match. Check the code and try again.'));
        }
      }, 12000);

      peer.on('open', () => {
        const conn = peer.connect(ROOM_PREFIX + cleanCode, {
          reliable: true,
        });
        this._attachConnection(conn, profile, () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve(cleanCode);
          }
        });
      });

      peer.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          this.disconnect();
          reject(new Error(err.type === 'peer-unavailable'
            ? 'Match not found. Ask your friend to verify the code.'
            : (err.message || 'Connection error.')));
        } else if (this.handlers.onError) {
          this.handlers.onError(err);
        }
      });
    });
  }

  _attachConnection(conn, profile, onOpenExtra) {
    this.conn = conn;

    conn.on('open', () => {
      this.send({ type: 'hello', profile });
      this._startPing();
      if (onOpenExtra) onOpenExtra();
      if (this.handlers.onConnect) this.handlers.onConnect(this.role);
    });

    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ping') {
        this.send({ type: 'pong', ts: msg.ts });
        return;
      }
      if (msg.type === 'pong') {
        this.latencyMs = Math.max(1, Math.round((performance.now() - msg.ts) / 2));
        if (this.handlers.onPing) this.handlers.onPing(this.latencyMs);
        return;
      }
      if (this.handlers.onMessage) {
        this.handlers.onMessage(msg);
      }
    });

    conn.on('close', () => {
      this._stopPing();
      if (this.handlers.onDisconnect) this.handlers.onDisconnect();
    });

    conn.on('error', (err) => {
      if (this.handlers.onError) this.handlers.onError(err);
    });
  }

  _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.conn && this.conn.open) {
        this.send({ type: 'ping', ts: performance.now() });
      }
    }, 2500);
  }

  _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  send(payload) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(payload);
      } catch (_) {}
    }
  }

  isConnected() {
    return Boolean(this.conn && this.conn.open);
  }

  disconnect() {
    this._stopPing();
    if (this.conn) {
      try { this.conn.close(); } catch (_) {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }
    this.role = null;
    this.roomCode = null;
    this.latencyMs = null;
  }
}
