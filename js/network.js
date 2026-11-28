// Cross-Network 1v1 Multiplayer over Secure WebSockets (MQTT over WSS)
// Port-443 first (firewall-proof across 5G cellular, Wi-Fi, corporate networks & VPNs),
// with automatic multi-relay failover, retained presence, app-switch recovery, and seamless mid-match reconnect.

const TOPIC_ROOT = 'wifebun-husbun-v3';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const MQTT_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js',
  'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js',
];

// Verified live WSS MQTT brokers ordered by firewall survivability & speed:
// 1. Shiftr Cloud over standard HTTPS port 443 (works behind strict firewalls & cellular NATs)
// 2. EMQX over port 8084 (fast low-latency fallback)
// 3. Eclipse Mosquitto over port 8081 (independent fallback)
// 4. HiveMQ over port 8884 (independent fallback)
const BROKERS = [
  {
    prefix: 'S',
    name: 'Shiftr (443)',
    url: 'wss://public.cloud.shiftr.io:443/mqtt',
    port: 443,
    isPort443: true,
    timeoutMs: 6500,
    options: { username: 'public', password: 'public' },
  },
  {
    prefix: 'E',
    name: 'EMQX (8084)',
    url: 'wss://broker.emqx.io:8084/mqtt',
    port: 8084,
    isPort443: false,
    timeoutMs: 6500,
    options: {},
  },
  {
    prefix: 'M',
    name: 'Mosquitto (8081)',
    url: 'wss://test.mosquitto.org:8081/mqtt',
    port: 8081,
    isPort443: false,
    timeoutMs: 9500,
    options: {},
  },
  {
    prefix: 'H',
    name: 'HiveMQ (8884)',
    url: 'wss://broker.hivemq.com:8884/mqtt',
    port: 8884,
    isPort443: false,
    timeoutMs: 15000,
    options: {},
  },
];

const JOIN_RETRY_MS = 1200;
const JOIN_TIMEOUT_MS = 60000;
const HOST_HEARTBEAT_MS = 20000;
const PING_INTERVAL_MS = 2000;
const PEER_LAG_WARN_MS = 9000;
const PEER_DEAD_MS = 45000;
const OFFLINE_GRACE_MS = 35000;
const STALE_GUEST_PRESENCE_MS = 90000;
const SUBACK_PROBE_TIMEOUT_MS = 2500;

export function generateRoomCode(brokerPrefix = BROKERS[0].prefix, len = 5) {
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

function injectScriptOnce(src) {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return;
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  document.head.appendChild(s);
}

function waitForMqtt(timeoutMs = 10000, onWaitStatus = null) {
  return new Promise((resolve, reject) => {
    if (window.mqtt && typeof window.mqtt.connect === 'function') {
      resolve(window.mqtt);
      return;
    }

    if (onWaitStatus) onWaitStatus('Loading multiplayer relay...');

    const start = performance.now();
    let injectedFirst = false;
    let injectedSecond = false;

    const timer = setInterval(() => {
      if (window.mqtt && typeof window.mqtt.connect === 'function') {
        clearInterval(timer);
        resolve(window.mqtt);
        return;
      }
      const elapsed = performance.now() - start;
      if (!injectedFirst && elapsed > 1400) {
        injectedFirst = true;
        injectScriptOnce(MQTT_CDN_URLS[0]);
      }
      if (!injectedSecond && elapsed > 4200) {
        injectedSecond = true;
        injectScriptOnce(MQTT_CDN_URLS[1]);
      }
      if (elapsed > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Multiplayer library failed to load. Please refresh and check your internet connection.'));
      }
    }, 100);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NetworkManager {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.client = null;
    this.broker = null;
    this.role = null; // 'host' | 'guest'
    this.roomCode = null;
    this.connected = false;
    this.clientId = 'wbhb_' + Math.random().toString(16).slice(2, 10);
    this.peerId = null;
    this.latencyMs = null;

    this._profile = null;
    this._lastProfile = null;
    this._lastJoinCode = null;
    this._lastRole = null;

    this.pingTimer = null;
    this.joinRetryTimer = null;
    this._joinTimeoutId = null;
    this._joinHintTimerId = null;
    this._hostHeartbeatTimer = null;
    this._offlineGraceTimer = null;

    this._onGuestHandshakeAck = null;
    this._intentionalDisconnect = false;
    this._recovering = false;
    this._hiddenAt = null;
    this._hostSeen = false;
    this._hostName = 'Husbun';
    this._lastPeerHeardAt = 0;
    this._peerLagWarned = false;
    this._lastJoinHandledAt = 0;
    this._lastJoinHandledSender = null;
    this._lifecycleBound = false;

    this._handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        this._hiddenAt = Date.now();
        return;
      }
      const hiddenMs = this._hiddenAt ? Date.now() - this._hiddenAt : 0;
      this._hiddenAt = null;
      this._onResumeTrigger('visibility', hiddenMs);
    };

    this._handleOnline = () => {
      this._onResumeTrigger('online', 5000);
    };

    this._handlePageShow = (e) => {
      if (e && e.persisted) {
        this._onResumeTrigger('pageshow', 5000);
      }
    };
  }

  _inTopic() {
    return `${TOPIC_ROOT}/${this.roomCode}/${this.role === 'host' ? 'to-host' : 'to-guest'}`;
  }

  _outTopic() {
    return `${TOPIC_ROOT}/${this.roomCode}/${this.role === 'host' ? 'to-guest' : 'to-host'}`;
  }

  _hostReadyTopic() {
    return `${TOPIC_ROOT}/${this.roomCode}/host-ready`;
  }

  _guestWaitingTopic() {
    return `${TOPIC_ROOT}/${this.roomCode}/guest-waiting`;
  }

  _emitStatus(message, extra = {}) {
    if (typeof this.handlers.onStatus === 'function') {
      this.handlers.onStatus(message, {
        role: this.role,
        roomCode: this.roomCode,
        relay: this.broker ? this.broker.name : '',
        isPort443: Boolean(this.broker && this.broker.isPort443),
        connected: this.connected,
        reconnecting: Boolean(extra.reconnecting),
        phase: extra.phase || (this.connected ? 'playing' : 'waiting'),
        ...extra,
      });
    }
  }

  getRelayName() {
    return this.broker ? this.broker.name : '';
  }

  getRelayInfo() {
    if (!this.broker) return null;
    return {
      prefix: this.broker.prefix,
      name: this.broker.name,
      port: this.broker.port,
      isPort443: this.broker.isPort443,
    };
  }

  getLastJoinCode() {
    return this._lastJoinCode || '';
  }

  _bindLifecycleListeners() {
    if (this._lifecycleBound) return;
    this._lifecycleBound = true;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._handleOnline);
      window.addEventListener('pageshow', this._handlePageShow);
    }
  }

  _unbindLifecycleListeners() {
    if (!this._lifecycleBound) return;
    this._lifecycleBound = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._handleOnline);
      window.removeEventListener('pageshow', this._handlePageShow);
    }
  }

  _connectToBroker(broker) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeoutMs = broker.timeoutMs || 7000;
      const connectOpts = {
        clientId: this.clientId + '_' + Math.floor(Math.random() * 99999),
        protocolVersion: 4, // MQTT 3.1.1 (universally supported across all relays)
        clean: true,
        connectTimeout: timeoutMs,
        reconnectPeriod: 1200,
        keepalive: 20,
        resubscribe: false,
        ...(broker.options || {}),
      };

      const client = window.mqtt.connect(broker.url, connectOpts);

      const failTimeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { client.end(true); } catch (_) {}
          reject(new Error(`Timed out reaching ${broker.name}.`));
        }
      }, timeoutMs + 400);

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
          reject(err || new Error(`Connection error on ${broker.name}.`));
        }
      });
    });
  }

  _subscribeTopics(client, topics) {
    return new Promise((resolve, reject) => {
      client.subscribe(topics, { qos: 0 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  _publishRetained(topic, payloadObj, client = this.client) {
    if (!client || !topic) return;
    try {
      const body = payloadObj == null ? '' : JSON.stringify(payloadObj);
      client.publish(topic, body, { qos: 0, retain: true });
    } catch (_) {}
  }

  _publishHostReady(client = this.client) {
    if (this.role !== 'host' || !this.roomCode) return;
    this._publishRetained(
      this._hostReadyTopic(),
      {
        type: 'host-ready',
        senderId: this.clientId,
        hostName: (this._profile && this._profile.name) || 'Husbun',
        relay: this.broker ? this.broker.name : '',
        ts: Date.now(),
      },
      client
    );
  }

  _publishGuestWaiting(client = this.client) {
    if (this.role !== 'guest' || !this.roomCode) return;
    this._publishRetained(
      this._guestWaitingTopic(),
      {
        type: 'join',
        senderId: this.clientId,
        profile: this._profile || { name: 'Wifebun', email: '', picture: '' },
        ts: Date.now(),
      },
      client
    );
  }

  _clearGuestWaiting(client = this.client) {
    if (!this.roomCode) return;
    this._publishRetained(this._guestWaitingTopic(), null, client);
  }

  _clearHostReady(client = this.client) {
    if (!this.roomCode) return;
    this._publishRetained(this._hostReadyTopic(), null, client);
  }

  _startHostHeartbeat() {
    this._stopHostHeartbeat();
    this._hostHeartbeatTimer = setInterval(() => {
      if (this.role === 'host' && !this.connected && this.client && this.client.connected) {
        this._publishHostReady();
      }
    }, HOST_HEARTBEAT_MS);
  }

  _stopHostHeartbeat() {
    if (this._hostHeartbeatTimer) {
      clearInterval(this._hostHeartbeatTimer);
      this._hostHeartbeatTimer = null;
    }
  }

  _clearOfflineGrace() {
    if (this._offlineGraceTimer) {
      clearTimeout(this._offlineGraceTimer);
      this._offlineGraceTimer = null;
    }
  }

  _startOfflineGrace() {
    if (this._offlineGraceTimer || this._intentionalDisconnect) return;
    this._offlineGraceTimer = setTimeout(() => {
      this._offlineGraceTimer = null;
      if (this._intentionalDisconnect) return;
      if (this.client && this.client.connected) return;
      this._emitStatus('Connection lost.', { reconnecting: false, phase: 'disconnected' });
      if (this.connected) {
        this.connected = false;
        this._stopPing();
        if (this.handlers.onDisconnect) this.handlers.onDisconnect();
      }
    }, OFFLINE_GRACE_MS);
  }

  async hostRoom(profile) {
    await waitForMqtt(10000, (msg) => this._emitStatus(msg, { phase: 'connecting' }));
    this.disconnect(false);
    this._intentionalDisconnect = false;
    this.role = 'host';
    this._profile = profile || { name: 'Husbun', email: '', picture: '' };
    this._lastProfile = this._profile;
    this._lastRole = 'host';

    let client = null;
    let chosenBroker = null;
    let lastErr = null;

    for (let i = 0; i < BROKERS.length; i++) {
      const broker = BROKERS[i];
      this._emitStatus(
        i === 0
          ? `Connecting to secure relay (${broker.name})...`
          : `Trying backup relay (${broker.name})...`,
        { phase: 'connecting' }
      );
      try {
        client = await this._connectToBroker(broker);
        chosenBroker = broker;
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!client || !chosenBroker) {
      throw new Error(
        lastErr?.message || 'Could not reach any multiplayer relay. Please check your internet connection and try again.'
      );
    }

    this.client = client;
    this.broker = chosenBroker;
    this.roomCode = generateRoomCode(chosenBroker.prefix, 5);
    this.connected = false;
    this.peerId = null;
    this._lastJoinHandledAt = 0;
    this._lastJoinHandledSender = null;

    await this._subscribeTopics(client, [this._inTopic(), this._guestWaitingTopic()]);
    this._bindClientListeners(client);
    this._bindLifecycleListeners();
    this._publishHostReady(client);
    this._startHostHeartbeat();

    this._emitStatus(`Waiting for Wifebun to hop in... (${chosenBroker.name})`, { phase: 'waiting' });
    return this.roomCode;
  }

  async joinRoom(code, profile) {
    await waitForMqtt(10000, (msg) => this._emitStatus(msg, { phase: 'connecting' }));

    const cleanCode = (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length < 4) {
      throw new Error('Please enter a valid 6-character match code.');
    }

    this.disconnect(false);
    this._intentionalDisconnect = false;
    this.role = 'guest';
    this.roomCode = cleanCode;
    this.connected = false;
    this.peerId = null;
    this._hostSeen = false;
    this._hostName = 'Husbun';
    this._profile = profile || { name: 'Wifebun', email: '', picture: '' };
    this._lastProfile = this._profile;
    this._lastJoinCode = cleanCode;
    this._lastRole = 'guest';

    const broker = getBrokerForCode(cleanCode);
    this.broker = broker;

    let client = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      this._emitStatus(
        attempt === 1
          ? `Connecting to ${broker.name}...`
          : `Retrying connection to ${broker.name}...`,
        { phase: 'connecting', reconnecting: attempt > 1 }
      );
      try {
        client = await this._connectToBroker(broker);
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await sleep(900);
      }
    }

    if (!client) {
      this.role = null;
      this.roomCode = null;
      if (!broker.isPort443) {
        throw new Error(
          `Could not reach ${broker.name} (port ${broker.port} may be blocked on this network). Ask Husbun to create a fresh match!`
        );
      }
      throw new Error(
        lastErr?.message || `Could not connect to multiplayer relay (${broker.name}). Check your connection and tap Retry.`
      );
    }

    this.client = client;
    await this._subscribeTopics(client, [this._inTopic(), this._hostReadyTopic()]);
    this._bindClientListeners(client);
    this._bindLifecycleListeners();

    this._emitStatus(`Connected (${broker.name}) — waiting for Husbun...`, { phase: 'waiting' });

    // Publish retained guest presence (catches Host right when Host switches back from iMessage/WhatsApp/Gmail!)
    // AND send live join pings every 1.2s for up to 60s.
    return new Promise((resolve, reject) => {
      let settled = false;

      const sendJoin = () => {
        if (!this.client || this.connected || this._intentionalDisconnect) return;
        this._rawPublish({ type: 'join', senderId: this.clientId, profile: this._profile });
      };

      this._onGuestHandshakeAck = () => {
        if (!settled) {
          settled = true;
          this._stopJoinRetry();
          this._clearGuestWaiting();
          resolve(cleanCode);
        }
      };

      this._publishGuestWaiting(client);
      sendJoin();
      this.joinRetryTimer = setInterval(sendJoin, JOIN_RETRY_MS);

      this._joinHintTimerId = setTimeout(() => {
        if (!settled && !this.connected && !this._intentionalDisconnect) {
          if (this._hostSeen) {
            this._emitStatus(
              `Found ${this._hostName}'s match — waiting for him to switch back to the game...`,
              { phase: 'waiting' }
            );
          } else {
            this._emitStatus(
              'Still looking for Husbun — make sure his match screen is open...',
              { phase: 'waiting' }
            );
          }
        }
      }, 10000);

      this._joinTimeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          this._stopJoinRetry();
          const hostWasFound = this._hostSeen;
          const hostName = this._hostName || 'Husbun';
          this.disconnect(false);
          reject(
            new Error(
              hostWasFound
                ? `${hostName}'s match was found, but he hasn't switched back to the game yet. Tap Retry once he's back!`
                : 'Could not find Husbun in this match. Make sure Husbun still has the match screen open, then tap Retry!'
            )
          );
        }
      }, JOIN_TIMEOUT_MS);
    });
  }

  async retry() {
    if (this._lastJoinCode) {
      return this.joinRoom(this._lastJoinCode, this._lastProfile || this._profile);
    }
    if (this._lastRole === 'host') {
      return this.hostRoom(this._lastProfile || this._profile);
    }
    throw new Error('No previous match to retry.');
  }

  async reconnect() {
    if (this.roomCode && this.role && this.broker && !this._intentionalDisconnect) {
      await this._rebuildConnection('Reconnecting to relay...');
      return this.roomCode;
    }
    return this.retry();
  }

  _onResumeTrigger(source, hiddenMs) {
    if (!this.roomCode || !this.role || !this.broker || this._intentionalDisconnect) return;

    const sock = this.client && this.client.stream && this.client.stream.socket;
    const wsOpen = Boolean(sock && sock.readyState === 1);
    const mqttConnected = Boolean(this.client && this.client.connected);

    if (!mqttConnected || !wsOpen) {
      this._rebuildConnection('Reconnecting after app switch...');
      return;
    }

    // On iOS/macOS Safari, sockets backgrounded for >2s can appear OPEN even though the OS killed TCP.
    // Probe with a real MQTT SUBSCRIBE/SUBACK round-trip; if no SUBACK in 2.5s, rebuild immediately!
    if (source === 'online' || source === 'pageshow' || hiddenMs >= 2000) {
      this._probeOrRebuildConnection();
    }
  }

  _probeOrRebuildConnection() {
    if (this._recovering || !this.client || !this.roomCode || !this.role) return;
    const probeClient = this.client;
    let acked = false;

    const timer = setTimeout(() => {
      if (!acked && this.client === probeClient && !this._intentionalDisconnect) {
        this._rebuildConnection('Refreshing connection...');
      }
    }, SUBACK_PROBE_TIMEOUT_MS);

    const topics =
      this.role === 'host'
        ? [this._inTopic(), this._guestWaitingTopic()]
        : [this._inTopic(), this._hostReadyTopic()];

    try {
      probeClient.subscribe(topics, { qos: 0 }, (err) => {
        acked = true;
        clearTimeout(timer);
        if (this.client !== probeClient || this._intentionalDisconnect) return;
        if (err) {
          this._rebuildConnection('Refreshing connection...');
          return;
        }
        this._clearOfflineGrace();
        if (this.role === 'host' && !this.connected) {
          this._publishHostReady(probeClient);
        } else if (this.role === 'guest' && !this.connected) {
          this._publishGuestWaiting(probeClient);
          this._rawPublish({ type: 'join', senderId: this.clientId, profile: this._profile });
        } else if (this.connected) {
          this._rawPublish({ type: 'ping', ts: performance.now() });
        }
      });
    } catch (_) {
      clearTimeout(timer);
      this._rebuildConnection('Refreshing connection...');
    }
  }

  async _rebuildConnection(statusText) {
    if (this._recovering || !this.roomCode || !this.role || !this.broker || this._intentionalDisconnect) {
      return;
    }
    this._recovering = true;
    const savedRoom = this.roomCode;
    const savedRole = this.role;
    const savedBroker = this.broker;

    this._emitStatus(statusText || 'Reconnecting...', { reconnecting: true });

    const staleClient = this.client;
    this.client = null;
    if (staleClient) {
      try {
        staleClient.removeAllListeners();
        staleClient.end(true);
      } catch (_) {}
    }

    try {
      let freshClient = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (this._intentionalDisconnect || this.roomCode !== savedRoom || this.role !== savedRole) {
          return;
        }
        try {
          freshClient = await this._connectToBroker(savedBroker);
          break;
        } catch (_) {
          if (attempt < 2) await sleep(1000);
        }
      }

      if (!freshClient) {
        this._startOfflineGrace();
        this._emitStatus('Still reconnecting — check your internet...', { reconnecting: true });
        return;
      }

      if (this._intentionalDisconnect || this.roomCode !== savedRoom || this.role !== savedRole) {
        try { freshClient.end(true); } catch (_) {}
        return;
      }

      this.client = freshClient;
      const topics =
        savedRole === 'host'
          ? [this._inTopic(), this._guestWaitingTopic()]
          : [this._inTopic(), this._hostReadyTopic()];

      await this._subscribeTopics(freshClient, topics);
      this._bindClientListeners(freshClient);
      this._clearOfflineGrace();

      if (savedRole === 'host' && !this.connected) {
        this._publishHostReady(freshClient);
        this._emitStatus(`Waiting for Wifebun to hop in... (${savedBroker.name})`, {
          phase: 'waiting',
          reconnecting: false,
        });
      } else if (savedRole === 'guest' && !this.connected) {
        this._publishGuestWaiting(freshClient);
        this._rawPublish({ type: 'join', senderId: this.clientId, profile: this._profile });
        this._emitStatus(
          this._hostSeen
            ? `Found ${this._hostName}'s match! Connecting...`
            : `Connected (${savedBroker.name}) — waiting for Husbun...`,
          { phase: 'waiting', reconnecting: false }
        );
      } else if (this.connected) {
        this._rawPublish({ type: 'ping', ts: performance.now() });
        this._emitStatus('Reconnected!', { phase: 'playing', reconnecting: false });
      }
    } finally {
      this._recovering = false;
    }
  }

  _bindClientListeners(client) {
    client.on('connect', () => {
      if (this.client !== client || this._intentionalDisconnect) return;
      this._clearOfflineGrace();
      if (!this.roomCode || !this.role) return;

      const topics =
        this.role === 'host'
          ? [this._inTopic(), this._guestWaitingTopic()]
          : [this._inTopic(), this._hostReadyTopic()];

      client.subscribe(topics, { qos: 0 }, () => {
        if (this.client !== client || this._intentionalDisconnect) return;
        if (this.role === 'host' && !this.connected) {
          this._publishHostReady(client);
          this._emitStatus(`Waiting for Wifebun to hop in... (${this.getRelayName()})`, {
            phase: 'waiting',
            reconnecting: false,
          });
        } else if (this.role === 'guest' && !this.connected) {
          this._publishGuestWaiting(client);
          this._rawPublish({ type: 'join', senderId: this.clientId, profile: this._profile });
          this._emitStatus(
            this._hostSeen
              ? `Found ${this._hostName}'s match! Connecting...`
              : `Connected (${this.getRelayName()}) — waiting for Husbun...`,
            { phase: 'waiting', reconnecting: false }
          );
        } else if (this.connected) {
          this._rawPublish({ type: 'ping', ts: performance.now() });
          this._emitStatus('Connected', { phase: 'playing', reconnecting: false });
        }
      });
    });

    client.on('offline', () => {
      if (this.client !== client || this._intentionalDisconnect) return;
      this._emitStatus('Connection hiccup — reconnecting...', { reconnecting: true });
      this._startOfflineGrace();
    });

    client.on('reconnect', () => {
      if (this.client !== client || this._intentionalDisconnect) return;
      this._emitStatus('Reconnecting to relay...', { reconnecting: true });
      this._startOfflineGrace();
    });

    client.on('close', () => {
      if (this.client !== client || this._intentionalDisconnect) return;
      this._startOfflineGrace();
    });

    client.on('error', () => {
      // Handled gracefully by reconnect/offline grace timer without kicking players out
    });

    client.on('message', (topic, payload) => {
      if (this.client !== client || this._intentionalDisconnect) return;
      if (!payload || payload.length === 0) return;

      let msg;
      try {
        msg = JSON.parse(payload.toString());
      } catch (_) {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      if (msg.senderId === this.clientId) return; // Ignore own echoes if any

      // Retained host presence notification seen by Guest
      if (topic === this._hostReadyTopic() || msg.type === 'host-ready') {
        if (this.role === 'guest' && !this.connected) {
          this._hostSeen = true;
          this._hostName = msg.hostName || 'Husbun';
          this._emitStatus(`Husbun found! Starting match...`, { phase: 'handshake' });
          // Nudge Host immediately
          this._rawPublish({ type: 'join', senderId: this.clientId, profile: this._profile });
        }
        return;
      }

      // Retained guest presence notification seen by Host (e.g., when Host switches back from iMessage!)
      if (topic === this._guestWaitingTopic()) {
        if (this.role === 'host' && msg.type === 'join') {
          if (msg.ts && Date.now() - msg.ts > STALE_GUEST_PRESENCE_MS) {
            return; // Ignore stale presence from an abandoned session
          }
          // Fall through to standard host join handler below
        } else {
          return;
        }
      }

      // Mark peer alive for every genuine peer packet
      this._lastPeerHeardAt = Date.now();
      if (this._peerLagWarned) {
        this._peerLagWarned = false;
        this._emitStatus('Connected', { phase: 'playing', reconnecting: false });
      }

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
        this._emitStatus('Opponent left the match.', { phase: 'disconnected' });
        if (this.handlers.onDisconnect) this.handlers.onDisconnect();
        return;
      }

      if (this.role === 'host' && msg.type === 'join') {
        const now = Date.now();
        // Deduplicate simultaneous retained + live join bursts from the same guest
        if (this._lastJoinHandledSender === msg.senderId && now - this._lastJoinHandledAt < 750) {
          return;
        }
        this._lastJoinHandledSender = msg.senderId;
        this._lastJoinHandledAt = now;

        const firstConnect = !this.connected || this.peerId !== msg.senderId;
        this.peerId = msg.senderId;
        this.connected = true;
        this._lastPeerHeardAt = now;
        this._stopHostHeartbeat();
        this._clearGuestWaiting(client);
        this._startPing();

        if (firstConnect) {
          this._emitStatus('Wifebun connected! Starting match...', { phase: 'playing' });
          if (this.handlers.onConnect) this.handlers.onConnect('host');
        }
        if (this.handlers.onMessage) {
          this.handlers.onMessage({ type: 'hello', profile: msg.profile });
        }
        return;
      }

      if (this.role === 'guest' && msg.type === 'start') {
        const firstConnect = !this.connected;
        this.peerId = msg.senderId;
        this.connected = true;
        this._lastPeerHeardAt = Date.now();
        this._stopJoinRetry();
        this._clearGuestWaiting(client);
        this._startPing();

        if (this._onGuestHandshakeAck) {
          const ack = this._onGuestHandshakeAck;
          this._onGuestHandshakeAck = null;
          ack();
        }
        if (firstConnect) {
          this._emitStatus('Husbun found! Starting match...', { phase: 'playing' });
          if (this.handlers.onConnect) this.handlers.onConnect('guest');
        }
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
    this._lastPeerHeardAt = Date.now();
    this._peerLagWarned = false;

    this.pingTimer = setInterval(() => {
      if (!this.connected || !this.client) return;

      if (this.client.connected) {
        this._rawPublish({ type: 'ping', ts: performance.now() });

        const silentMs = Date.now() - this._lastPeerHeardAt;
        if (silentMs > PEER_DEAD_MS) {
          this.connected = false;
          this._stopPing();
          this._emitStatus('Opponent disconnected.', { phase: 'disconnected' });
          if (this.handlers.onDisconnect) this.handlers.onDisconnect();
          return;
        }
        if (silentMs > PEER_LAG_WARN_MS && !this._peerLagWarned) {
          this._peerLagWarned = true;
          this._emitStatus('Waiting for opponent to reconnect...', { reconnecting: true });
        }
      }
    }, PING_INTERVAL_MS);
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
    if (this._joinTimeoutId) {
      clearTimeout(this._joinTimeoutId);
      this._joinTimeoutId = null;
    }
    if (this._joinHintTimerId) {
      clearTimeout(this._joinHintTimerId);
      this._joinHintTimerId = null;
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
    this._intentionalDisconnect = true;
    this._recovering = false;
    this._stopPing();
    this._stopJoinRetry();
    this._stopHostHeartbeat();
    this._clearOfflineGrace();
    this._unbindLifecycleListeners();
    this._onGuestHandshakeAck = null;

    const oldClient = this.client;
    const oldRole = this.role;
    const oldRoom = this.roomCode;
    const wasConnected = this.connected;

    this.client = null;
    this.broker = null;
    this.connected = false;
    this.role = null;
    this.roomCode = null;
    this.peerId = null;
    this.latencyMs = null;
    this._hostSeen = false;
    this._peerLagWarned = false;

    if (oldClient) {
      try {
        oldClient.removeAllListeners();
        if (oldRoom && oldRole === 'host') {
          oldClient.publish(`${TOPIC_ROOT}/${oldRoom}/host-ready`, '', { qos: 0, retain: true });
        } else if (oldRoom && oldRole === 'guest') {
          oldClient.publish(`${TOPIC_ROOT}/${oldRoom}/guest-waiting`, '', { qos: 0, retain: true });
        }
        if (notifyPeer && wasConnected && oldRoom && oldRole) {
          const outTopic = `${TOPIC_ROOT}/${oldRoom}/${oldRole === 'host' ? 'to-guest' : 'to-host'}`;
          oldClient.publish(outTopic, JSON.stringify({ type: 'leave', senderId: this.clientId }), { qos: 0 });
        }
        // Flush leave/retained-clear packets before closing socket
        setTimeout(() => {
          try { oldClient.end(true); } catch (_) {}
        }, 160);
      } catch (_) {
        try { oldClient.end(true); } catch (_) {}
      }
    }
  }
}
