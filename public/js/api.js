/**
 * SMOOTH x HOST - API & Real-Time Sync Client
 * Supports both persistent WebSocket (VPS/Local) and High-Speed Serverless Polling (Vercel)
 */

class ApiService {
  constructor() {
    this.ws = null;
    this.wsSubscribers = new Set();
    this.pollingTimers = new Map();
    this.isPollingMode = false;
    this.eventListeners = {
      console: [],
      stats: [],
      status: [],
      backlog: []
    };
    this.initSync();
  }

  // REST API Client
  async request(endpoint, options = {}) {
    const url = `/api${endpoint}`;
    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        ...options
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API Error on ${url}:`, err);
      throw err;
    }
  }

  // REST endpoints
  getSystem() { return this.request('/system'); }
  getNodes() { return this.request('/nodes'); }
  createNode(data) { return this.request('/nodes', { method: 'POST', body: JSON.stringify(data) }); }
  getEggs() { return this.request('/eggs'); }
  getServers() { return this.request('/servers'); }
  getServer(id) { return this.request(`/servers/${id}`); }
  getServerLive(id) { return this.request(`/servers/${id}/live`); }
  createServer(data) { return this.request('/servers', { method: 'POST', body: JSON.stringify(data) }); }
  deleteServer(id) { return this.request(`/servers/${id}`, { method: 'DELETE' }); }
  
  sendPowerAction(id, action) {
    return this.request(`/servers/${id}/power`, { method: 'POST', body: JSON.stringify({ action }) });
  }

  sendCommand(id, command) {
    return this.request(`/servers/${id}/command`, { method: 'POST', body: JSON.stringify({ command }) });
  }

  // Files
  listFiles(id, path = '/') {
    return this.request(`/servers/${id}/files?path=${encodeURIComponent(path)}`);
  }

  getFileContent(id, path) {
    return this.request(`/servers/${id}/files/content?path=${encodeURIComponent(path)}`);
  }

  saveFileContent(id, path, content) {
    return this.request(`/servers/${id}/files/content`, {
      method: 'POST',
      body: JSON.stringify({ path, content })
    });
  }

  createFileOrFolder(id, path, name, isDirectory) {
    return this.request(`/servers/${id}/files/create`, {
      method: 'POST',
      body: JSON.stringify({ path, name, isDirectory })
    });
  }

  deleteFile(id, path) {
    return this.request(`/servers/${id}/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
  }

  // Databases
  getDatabases(id) { return this.request(`/servers/${id}/databases`); }
  createDatabase(id, name) {
    return this.request(`/servers/${id}/databases`, { method: 'POST', body: JSON.stringify({ name }) });
  }
  deleteDatabase(id, dbId) {
    return this.request(`/servers/${id}/databases/${dbId}`, { method: 'DELETE' });
  }

  // Backups
  getBackups(id) { return this.request(`/servers/${id}/backups`); }
  createBackup(id, name, isLocked) {
    return this.request(`/servers/${id}/backups`, { method: 'POST', body: JSON.stringify({ name, isLocked }) });
  }
  deleteBackup(id, backupId) {
    return this.request(`/servers/${id}/backups/${backupId}`, { method: 'DELETE' });
  }

  // Schedules
  getSchedules(id) { return this.request(`/servers/${id}/schedules`); }
  createSchedule(id, name, cron) {
    return this.request(`/servers/${id}/schedules`, { method: 'POST', body: JSON.stringify({ name, cron }) });
  }
  deleteSchedule(id, schedId) {
    return this.request(`/servers/${id}/schedules/${schedId}`, { method: 'DELETE' });
  }

  // Subusers
  getUsers(id) { return this.request(`/servers/${id}/users`); }
  inviteUser(id, email, permissions) {
    return this.request(`/servers/${id}/users`, { method: 'POST', body: JSON.stringify({ email, permissions }) });
  }
  deleteUser(id, userId) {
    return this.request(`/servers/${id}/users/${userId}`, { method: 'DELETE' });
  }

  // Settings & Reinstall
  updateSettings(id, data) {
    return this.request(`/servers/${id}/settings`, { method: 'POST', body: JSON.stringify(data) });
  }

  reinstallServer(id) {
    return this.request(`/servers/${id}/reinstall`, { method: 'POST' });
  }

  // Dual-mode Sync: WebSocket with seamless Serverless Polling Fallback
  initSync() {
    const isVercelHost = window.location.hostname.endsWith('vercel.app') || window.location.hostname.includes('vercel');

    if (isVercelHost) {
      this.enablePollingMode('Wings Online (Cloud Edge)');
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.wsSubscribers.forEach(serverId => {
          this.ws.send(JSON.stringify({ type: 'subscribe', serverId }));
        });
        const el = document.getElementById('ws-status-text');
        if (el) el.textContent = 'Wings Online';
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'console') {
            this.emit('console', data);
          } else if (data.type === 'stats') {
            this.emit('stats', data);
          } else if (data.type === 'status') {
            this.emit('status', data);
          } else if (data.type === 'log_backlog') {
            this.emit('backlog', data);
          }
        } catch (err) {}
      };

      this.ws.onerror = () => {
        // Fallback to Serverless polling if WS fails
        this.enablePollingMode('Wings Online (Cloud Sync)');
      };

      this.ws.onclose = () => {
        if (!this.isPollingMode) {
          this.enablePollingMode('Wings Online (Edge Sync)');
        }
      };
    } catch (e) {
      this.enablePollingMode('Wings Online');
    }
  }

  enablePollingMode(statusLabel = 'Wings Online') {
    this.isPollingMode = true;
    const el = document.getElementById('ws-status-text');
    if (el) el.textContent = statusLabel;

    // Start polling for any already subscribed server
    this.wsSubscribers.forEach(serverId => {
      this.startPolling(serverId);
    });
  }

  startPolling(serverId) {
    if (this.pollingTimers.has(serverId)) return;

    // Immediate first fetch
    const poll = async () => {
      try {
        const live = await this.getServerLive(serverId);
        this.emit('status', { serverId, status: live.status, uptime: live.uptime });
        this.emit('stats', { serverId, stats: live.stats, uptime: live.uptime });
        if (live.logs) {
          this.emit('backlog', { serverId, logs: live.logs });
        }
      } catch (e) {}
    };

    poll();
    const interval = setInterval(poll, 1500);
    this.pollingTimers.set(serverId, interval);
  }

  stopPolling(serverId) {
    const timer = this.pollingTimers.get(serverId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(serverId);
    }
  }

  subscribeServer(serverId) {
    this.wsSubscribers.add(serverId);
    if (!this.isPollingMode && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', serverId }));
    } else {
      this.startPolling(serverId);
    }
  }

  unsubscribeServer(serverId) {
    this.wsSubscribers.delete(serverId);
    if (!this.isPollingMode && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', serverId }));
    }
    this.stopPolling(serverId);
  }

  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }
}

window.api = new ApiService();
