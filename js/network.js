// Bulletproof 1v1 Multiplayer over Secure WebSockets (MQTT over WSS)
// Works across all browsers, iOS Safari, Android, cellular 5G, Wi-Fi, VPNs, and strict NATs!

const TOPIC_ROOT = 'wifebun-husbun-v2';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const BROKERS = [
  { prefix: 'E', name: 'EMQX',   url: 'wss://broker.emqx.io:8084/mqtt' },
  { prefix: 'H', name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
];

export function generateRoomCode(brokerPrefix = 'E', len = 5) {
  let suffix = '';
  for (let i = 0; i < len; i++) {
    suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return brokerPrefix + suffix;
}

function getBrokerForCode(code) {
  const first = (code || '').charAt(0).toUpperCase();
  return BROKERS.find((b) => b.prefix === first) || BROKERS[0];
}

function waitForMqtt(timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    if (window.mqtt && typeof window.mqtt.connect === 'function') {
      resolve(window.mqtt);
      return;
    }
    const start = performance.now();
    const timer = setInterval(() => {
      if (window.mqtt && typeof window.mqtt.connect === 'function') {
        clearInterval(timer);
        resolve(window.mqtt);
      } else if (performance.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Multiplayer library failed to load. Please refresh and check your internet connection.'));
      }
    }, 100);
  });
}

export class NetworkManager {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.client = null;
    this.role = null; // 'host' | 'guest'
    this.roomCode = null;
    this.connected = false;
    this.clientId = 'wbhb_' + Math.random().toString(16).slice(2, 10);
    this.peerId = null;

    this.pingTimer = null;
    this.joinRetryTimer = null;
    this.latencyMs = null;
  }

  _inTopic() {
    return `${TOPIC_ROOT}/${this.roomCode}/${this.role === 'host' ? 'to-host' : 'to-guest'}`;
  }

  _outTopic() {
    return `${TOPIC_ROOT}/${this.roomCode}/${this.role === 'host' ? 'to-guest' : 'to-host'}`;
  }

  _connectToBroker(brokerUrl) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const client = window.mqtt.connect(brokerUrl, {
        clientId: this.clientId + '_' + Math.floor(Math.random() * 9999),
        clean: true,
        connectTimeout: 6500,
        reconnectPeriod: 1500,
        keepalive: 20,
      });

      const failTimeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { client.end(true); } catch (_) {}
          reject(new Error('Timed out reaching game server.'));
        }
      }, 7000);

      client.once('connect', () => {
        if (!settled) {
          settled = true;
          clearTimeout(failTimeout);
          resolve(client);
        }
      });

      client.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(failTimeout);
          try { client.end(true); } catch (_) {}
          reject(err || new Error('Connection error.'));
        }
      });
    });
  }

  async hostRoom(profile) {
    await waitForMqtt();
    this.disconnect();
    this.role = 'host';

    let client = null;
    let chosenBroker = null;
    let lastErr = null;

    for (const broker of BROKERS) {
      try {
        client = await this._connectToBroker(broker.url);
        chosenBroker = broker;
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!client || !chosenBroker) {
      throw new Error(lastErr?.message || 'Could not connect to multiplayer relay. Please try again.');
    }

    this.client = client;
    this.roomCode = generateRoomCode(chosenBroker.prefix, 5);
    this.connected = false;
    this.peerId = null;

    await new Promise((resolve, reject) => {
      client.subscribe(this._inTopic(), { qos: 0 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    this._bindClientListeners(profile);
    return this.roomCode;
  }

  async joinRoom(code, profile) {
    await waitForMqtt();

    const cleanCode = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length < 4) {
      throw new Error('Please enter a valid 6-character match code.');
    }

    this.disconnect();
    this.role = 'guest';
    this.roomCode = cleanCode;
    this.connected = false;
    this.peerId = null;

    const broker = getBrokerForCode(cleanCode);
    const client = await this._connectToBroker(broker.url);
    this.client = client;

    await new Promise((resolve, reject) => {
      client.subscribe(this._inTopic(), { qos: 0 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    this._bindClientListeners(profile);

    // Send join handshake immediately and retry every 1.2s until Host answers!
    return new Promise((resolve, reject) => {
      let settled = false;

      const sendJoin = () => {
        this._rawPublish({ type: 'join', senderId: this.clientId, profile });
      };

      this._onGuestHandshakeAck = () => {
        if (!settled) {
          settled = true;
          this._stopJoinRetry();
          resolve(cleanCode);
        }
      };

      sendJoin();
      this.joinRetryTimer = setInterval(sendJoin, 1200);

      // Fail gracefully after 22s if host isn't open
      setTimeout(() => {
        if (!settled) {
          settled = true;
          this._stopJoinRetry();
          this.disconnect();
          reject(new Error('Could not find Husbun in this match. Make sure Husbun still has the match screen open!'));
        }
      }, 22000);
    });
  }

  _bindClientListeners(profile) {
    const client = this.client;

    // Resubscribe automatically if mobile browser reconnects after switching apps!
    client.on('connect', () => {
      if (this.roomCode && this.role) {
        client.subscribe(this._inTopic(), { qos: 0 });
      }
    });

    client.on('message', (_topic, payload) => {
      let msg;
      try {
        msg = JSON.parse(payload.toString());
      } catch (_) {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      if (msg.senderId === this.clientId) return; // Ignore own echoes if any

      if (msg.type === 'ping') {
        this._rawPublish({ type: 'pong', ts: msg.ts, senderId: this.clientId });
        return;
      }
      if (msg.type === 'pong') {
        this.latencyMs = Math.max(1, Math.round((performance.now() - msg.ts) / 2));
        if (this.handlers.onPing) this.handlers.onPing(this.latencyMs);
        return;
      }
      if (msg.type === 'leave') {
        this.connected = false;
        this._stopPing();
        if (this.handlers.onDisconnect) this.handlers.onDisconnect();
        return;
      }

      if (this.role === 'host' && msg.type === 'join') {
        this.peerId = msg.senderId;
        this.connected = true;
        this._startPing();
        if (this.handlers.onConnect) this.handlers.onConnect('host');
        if (this.handlers.onMessage) {
          this.handlers.onMessage({ type: 'hello', profile: msg.profile });
        }
        return;
      }

      if (this.role === 'guest' && msg.type === 'start') {
        this.peerId = msg.senderId;
        this.connected = true;
        this._stopJoinRetry();
        this._startPing();
        if (this._onGuestHandshakeAck) {
          this._onGuestHandshakeAck();
          this._onGuestHandshakeAck = null;
        }
        if (this.handlers.onConnect) this.handlers.onConnect('guest');
        if (this.handlers.onMessage) this.handlers.onMessage(msg);
        return;
      }

      if (this.handlers.onMessage) {
        this.handlers.onMessage(msg);
      }
    });
  }

  _rawPublish(payload) {
    if (!this.client || !this.roomCode || !this.role) return;
    try {
      const data = JSON.stringify({ ...payload, senderId: this.clientId });
      this.client.publish(this._outTopic(), data, { qos: 0 });
    } catch (_) {}
  }

  _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.connected && this.client) {
        this._rawPublish({ type: 'ping', ts: performance.now() });
      }
    }, 2000);
  }

  _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  _stopJoinRetry() {
    if (this.joinRetryTimer) {
      clearInterval(this.joinRetryTimer);
      this.joinRetryTimer = null;
    }
  }

  send(payload) {
    if (this.connected && this.client) {
      this._rawPublish(payload);
    }
  }

  isConnected() {
    return Boolean(this.connected && this.client);
  }

  disconnect(notifyPeer = false) {
    if (notifyPeer && this.connected && this.client) {
      this._rawPublish({ type: 'leave' });
    }
    this._stopPing();
    this._stopJoinRetry();
    this._onGuestHandshakeAck = null;
    if (this.client) {
      try { this.client.end(true); } catch (_) {}
      this.client = null;
    }
    this.connected = false;
    this.role = null;
    this.roomCode = null;
    this.peerId = null;
    this.latencyMs = null;
  }
}
