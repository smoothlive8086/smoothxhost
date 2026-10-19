/**
 * SMOOTH x HOST - Core Frontend Controller
 */

class SmoothHostApp {
  constructor() {
    this.currentView = 'servers'; // 'servers' | 'server-detail' | 'admin'
    this.activeServerId = null;
    this.activeTab = 'console';
    this.servers = [];
    this.nodes = [];
    this.eggs = [];
    this.system = null;
    this.currentPath = '/';
    this.commandHistory = [];
    this.historyIndex = -1;
    this.charts = {};
    this.terminal = null;
    this.filter = 'all';
    this.searchQuery = '';
    this.soundEnabled = true;

    this.init();
  }

  async init() {
    this.bindGlobalEvents();
    await this.loadInitialData();
    this.handleRoute();
    window.addEventListener('hashchange', () => this.handleRoute());

    // Listen to WebSocket broadcasts
    window.api.on('stats', (data) => this.onServerStats(data));
    window.api.on('console', (data) => this.onServerConsole(data));
    window.api.on('status', (data) => this.onServerStatus(data));
    window.api.on('backlog', (data) => this.onServerBacklog(data));
  }

  // Audio SFX synthesis
  playSound(type = 'click') {
    if (!this.soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (type === 'click') {
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'power') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'notify') {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch (e) {
      // Audio playback restrictions fallback
    }
  }

  // Toast System
  showToast(message, type = 'info') {
    this.playSound('notify');
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
      success: 'fa-circle-check',
      info: 'fa-circle-info',
      error: 'fa-circle-xmark',
      warn: 'fa-triangle-exclamation'
    };

    toast.innerHTML = `
      <i class="fa-solid ${icons[type] || 'fa-bell'}" style="font-size: 1.1rem;"></i>
      <div style="flex:1;">${message}</div>
      <i class="fa-solid fa-xmark" style="cursor:pointer; opacity:0.6;" onclick="this.parentElement.remove()"></i>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 4000);
  }

  async loadInitialData() {
    try {
      const [system, servers, nodes, eggs] = await Promise.all([
        window.api.getSystem(),
        window.api.getServers(),
        window.api.getNodes(),
        window.api.getEggs()
      ]);
      this.system = system;
      this.servers = servers;
      this.nodes = nodes;
      this.eggs = eggs;
      this.renderClusterMetrics();
    } catch (err) {
      this.showToast('Failed to connect to host backend', 'error');
    }
  }

  // Global Keybindings & Navigation Events
  bindGlobalEvents() {
    // Quick Command Palette (Ctrl+K or Cmd+K)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openCommandPalette();
      }
      if (e.key === 'Escape') {
        this.closeModals();
      }
    });

    // Brand click
    const brand = document.getElementById('nav-brand');
    if (brand) brand.onclick = () => this.navigate('#servers');

    // Nav Links
    const navServers = document.getElementById('nav-servers');
    if (navServers) navServers.onclick = () => this.navigate('#servers');

    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.onclick = () => this.navigate('#admin');

    const searchBtn = document.getElementById('search-palette-btn');
    if (searchBtn) searchBtn.onclick = () => this.openCommandPalette();
  }

  navigate(hash) {
    this.playSound('click');
    window.location.hash = hash;
  }

  // Router
  async handleRoute() {
    const hash = window.location.hash || '#servers';
    const parts = hash.replace(/^#\/?/, '').split('/');
    const route = parts[0] || 'servers';

    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    if (route === 'servers') {
      this.currentView = 'servers';
      if (this.activeServerId) {
        window.api.unsubscribeServer(this.activeServerId);
        this.activeServerId = null;
      }
      document.getElementById('nav-servers')?.classList.add('active');
      await this.refreshServersList();
      this.renderServersView();
    } else if (route === 'server') {
      this.currentView = 'server-detail';
      const serverId = parts[1];
      const tab = parts[2] || 'console';
      document.getElementById('nav-servers')?.classList.add('active');
      await this.openServerDetail(serverId, tab);
    } else if (route === 'admin') {
      this.currentView = 'admin';
      if (this.activeServerId) {
        window.api.unsubscribeServer(this.activeServerId);
        this.activeServerId = null;
      }
      document.getElementById('nav-admin')?.classList.add('active');
      this.renderAdminView();
    }
  }

  // ======================== DASHBOARD VIEW ======================== //

  async refreshServersList() {
    try {
      this.servers = await window.api.getServers();
      this.system = await window.api.getSystem();
      this.renderClusterMetrics();
    } catch (e) {}
  }

  renderClusterMetrics() {
    const el = document.getElementById('cluster-metrics-container');
    if (!el || !this.system) return;

    const running = this.servers.filter(s => s.status === 'running').length;
    const totalMemGB = (this.servers.reduce((a, s) => a + s.limits.memory, 0) / 1024).toFixed(1);
    const usedMemGB = (this.servers.reduce((a, s) => a + (s.status === 'running' ? s.stats.memory : 0), 0) / 1024).toFixed(1);
    const totalDiskGB = (this.servers.reduce((a, s) => a + s.limits.disk, 0) / 1024).toFixed(1);

    el.innerHTML = `
      <div class="metrics-ribbon">
        <div class="metric-card">
          <div class="metric-icon-box cyan"><i class="fa-solid fa-server"></i></div>
          <div class="metric-data">
            <span class="metric-label">Active Instances</span>
            <span class="metric-value">${running} <span style="font-size: 0.9rem; color: var(--text-dim); font-weight:400;">/ ${this.servers.length}</span></span>
            <span class="metric-sub">${this.nodes.length} Wings Nodes Connected</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box green"><i class="fa-solid fa-microchip"></i></div>
          <div class="metric-data">
            <span class="metric-label">Memory Allocation</span>
            <span class="metric-value">${usedMemGB} <span style="font-size: 0.9rem; color: var(--text-dim); font-weight:400;">/ ${totalMemGB} GB</span></span>
            <span class="metric-sub">Dedicated ECC DDR5</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box purple"><i class="fa-solid fa-hard-drive"></i></div>
          <div class="metric-data">
            <span class="metric-label">NVMe Storage</span>
            <span class="metric-value">${totalDiskGB} GB</span>
            <span class="metric-sub">Enterprise Gen4 Arrays</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon-box amber"><i class="fa-solid fa-network-wired"></i></div>
          <div class="metric-data">
            <span class="metric-label">Network Throughput</span>
            <span class="metric-value">10 Gbps</span>
            <span class="metric-sub">DDoS Protected Anycast</span>
          </div>
        </div>
      </div>
    `;
  }

  renderServersView() {
    const mainView = document.getElementById('main-content-view');
    if (!mainView) return;

    let filtered = this.servers.filter(s => {
      if (this.filter === 'running' && s.status !== 'running') return false;
      if (this.filter === 'offline' && s.status !== 'offline') return false;
      if (this.filter === 'minecraft' && s.eggId !== 'minecraft-paper') return false;
      if (this.filter === 'nodejs' && s.eggId !== 'nodejs-app') return false;
      if (this.filter === 'games' && !['rust-dedicated', 'fivem-server'].includes(s.eggId)) return false;

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) ||
               s.allocation.alias.toLowerCase().includes(q) ||
               s.id.toLowerCase().includes(q);
      }
      return true;
    });

    mainView.innerHTML = `
      <div id="cluster-metrics-container"></div>

      <div class="dashboard-toolbar">
        <div class="search-filter-group">
          <div class="input-search-box">
            <i class="fa-solid fa-magnifying-glass" style="color: var(--text-dim);"></i>
            <input type="text" id="server-search-input" placeholder="Search servers by name, ID, or IP..." value="${this.escapeHtml(this.searchQuery)}">
          </div>

          <div class="filter-pills">
            <button class="filter-pill ${this.filter === 'all' ? 'active' : ''}" data-filter="all">All</button>
            <button class="filter-pill ${this.filter === 'running' ? 'active' : ''}" data-filter="running">Running</button>
            <button class="filter-pill ${this.filter === 'offline' ? 'active' : ''}" data-filter="offline">Offline</button>
            <button class="filter-pill ${this.filter === 'minecraft' ? 'active' : ''}" data-filter="minecraft">Minecraft</button>
            <button class="filter-pill ${this.filter === 'nodejs' ? 'active' : ''}" data-filter="nodejs">Node.js</button>
            <button class="filter-pill ${this.filter === 'games' ? 'active' : ''}" data-filter="games">Games</button>
          </div>
        </div>

        <button class="btn-primary" id="btn-deploy-server">
          <i class="fa-solid fa-plus"></i> Deploy Server
        </button>
      </div>

      <div class="servers-grid" id="servers-grid-container">
        ${filtered.map(server => this.renderServerCardHTML(server)).join('')}
      </div>

      ${filtered.length === 0 ? `
        <div style="text-align:center; padding: 4rem 1rem; color: var(--text-dim);">
          <i class="fa-solid fa-cubes-stacked" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.4;"></i>
          <h3 style="color: var(--text-muted); margin-bottom: 0.5rem;">No servers match your filter</h3>
          <p style="font-size: 0.88rem;">Try clearing your search query or click "Deploy Server" to create one.</p>
        </div>
      ` : ''}
    `;

    this.renderClusterMetrics();

    // Attach search input handler
    const searchInput = document.getElementById('server-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.renderServersView();
        // Restore focus
        const newInp = document.getElementById('server-search-input');
        if (newInp) {
          newInp.focus();
          newInp.selectionStart = newInp.selectionEnd = newInp.value.length;
        }
      };
    }

    // Attach filter clicks
    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.onclick = () => {
        this.playSound('click');
        this.filter = btn.getAttribute('data-filter');
        this.renderServersView();
      };
    });

    // Deploy Server button
    const deployBtn = document.getElementById('btn-deploy-server');
    if (deployBtn) deployBtn.onclick = () => this.openCreateServerModal();

    // Attach card power actions & card clicks
    document.querySelectorAll('.server-card').forEach(card => {
      const serverId = card.getAttribute('data-id');
      card.onclick = (e) => {
        if (e.target.closest('.card-power-footer') || e.target.closest('.copy-icon-btn')) return;
        this.navigate(`#server/${serverId}/console`);
      };
    });

    document.querySelectorAll('.copy-icon-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const text = btn.getAttribute('data-copy');
        navigator.clipboard.writeText(text);
        this.showToast(`Copied to clipboard: ${text}`, 'success');
      };
    });

    document.querySelectorAll('.power-btn-mini').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const sId = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        await this.triggerPowerAction(sId, action);
      };
    });
  }

  renderServerCardHTML(s) {
    const egg = this.eggs.find(e => e.id === s.eggId) || { name: 'Custom Egg', icon: 'fa-cube', color: '#00e5ff' };
    const node = this.nodes.find(n => n.id === s.nodeId) || { name: 'Default Node' };

    const cpuPct = Math.min(100, Math.round((s.stats.cpu / (s.limits.cpu || 100)) * 100)) || 0;
    const memPct = Math.min(100, Math.round((s.stats.memory / s.limits.memory) * 100)) || 0;
    const diskPct = Math.min(100, Math.round((s.stats.disk / s.limits.disk) * 100)) || 0;

    return `
      <div class="server-card" data-id="${s.id}">
        <div>
          <div class="card-top">
            <div class="egg-icon-pill" style="color: ${egg.color}; border-color: ${egg.color}33;">
              <i class="fa-solid ${egg.icon}"></i>
            </div>
            <div class="server-meta">
              <h3 class="server-title" title="${this.escapeHtml(s.name)}">${this.escapeHtml(s.name)}</h3>
              <p class="server-subdesc">${egg.name} &bull; ${s.uuid.substring(0, 8)}</p>
            </div>
            <div class="status-badge ${s.status}">
              <div class="status-dot-indicator"></div>
              <span>${s.status}</span>
            </div>
          </div>

          <div class="server-address-box">
            <span><i class="fa-solid fa-network-wired" style="margin-right: 6px; opacity:0.6;"></i>${s.allocation.alias}</span>
            <button class="copy-icon-btn" data-copy="${s.allocation.alias}" title="Copy Address">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>

          <div class="resource-meters">
            <div class="meter-row">
              <div class="meter-header">
                <span class="meter-title"><i class="fa-solid fa-microchip"></i> CPU Usage</span>
                <span class="meter-value-txt" id="card-cpu-${s.id}">${s.stats.cpu}% / ${s.limits.cpu}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill cyan" id="card-cpubar-${s.id}" style="width: ${cpuPct}%;"></div>
              </div>
            </div>

            <div class="meter-row">
              <div class="meter-header">
                <span class="meter-title"><i class="fa-solid fa-memory"></i> Memory</span>
                <span class="meter-value-txt" id="card-mem-${s.id}">${s.stats.memory} MB / ${s.limits.memory} MB</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill purple" id="card-membar-${s.id}" style="width: ${memPct}%;"></div>
              </div>
            </div>

            <div class="meter-row">
              <div class="meter-header">
                <span class="meter-title"><i class="fa-solid fa-hard-drive"></i> Disk</span>
                <span class="meter-value-txt">${s.stats.disk} MB / ${s.limits.disk} MB</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill amber" style="width: ${diskPct}%;"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card-power-footer">
          <div class="node-label">
            <i class="fa-solid fa-location-dot"></i> ${node.name}
          </div>
          <div class="power-quick-actions">
            <button class="power-btn-mini start" data-id="${s.id}" data-action="start" title="Start">
              <i class="fa-solid fa-play"></i>
            </button>
            <button class="power-btn-mini restart" data-id="${s.id}" data-action="restart" title="Restart">
              <i class="fa-solid fa-rotate-right"></i>
            </button>
            <button class="power-btn-mini stop" data-id="${s.id}" data-action="stop" title="Stop">
              <i class="fa-solid fa-stop"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ======================== SERVER MANAGEMENT VIEW ======================== //

  async openServerDetail(serverId, tab = 'console') {
    this.activeServerId = serverId;
    this.activeTab = tab;

    let server = this.servers.find(s => s.id === serverId);
    if (!server) {
      try {
        server = await window.api.getServer(serverId);
        this.servers.push(server);
      } catch (err) {
        this.showToast('Server not found', 'error');
        this.navigate('#servers');
        return;
      }
    }

    // Subscribe to live websocket
    window.api.subscribeServer(serverId);

    this.renderServerDetailLayout(server);
    this.renderActiveTabContent(server);
  }

  renderServerDetailLayout(server) {
    const mainView = document.getElementById('main-content-view');
    if (!mainView) return;

    const egg = this.eggs.find(e => e.id === server.eggId) || { name: 'Server', icon: 'fa-cube', color: '#00e5ff' };
    const node = this.nodes.find(n => n.id === server.nodeId) || { name: 'Node' };

    mainView.innerHTML = `
      <div class="server-detail-header">
        <div class="server-hero-left">
          <div class="server-hero-avatar" style="color: ${egg.color}; border-color: ${egg.color}40;">
            <i class="fa-solid ${egg.icon}"></i>
          </div>
          <div class="server-hero-info">
            <div class="server-breadcrumbs">
              <a class="breadcrumb-link" href="#servers"><i class="fa-solid fa-arrow-left"></i> Servers</a>
              <span>/</span>
              <span>${this.escapeHtml(server.name)}</span>
            </div>
            <h1 class="server-hero-title">
              ${this.escapeHtml(server.name)}
              <span class="status-badge ${server.status}" id="hero-status-badge">
                <span class="status-dot-indicator"></span>
                <span id="hero-status-text">${server.status}</span>
              </span>
            </h1>
            <div class="server-meta-tags">
              <span class="meta-tag"><i class="fa-solid fa-network-wired"></i> ${server.allocation.alias}</span>
              <span class="meta-tag"><i class="fa-solid fa-server"></i> ${node.name}</span>
              <span class="meta-tag"><i class="fa-solid fa-fingerprint"></i> ${server.uuid.substring(0, 8)}</span>
              <span class="meta-tag" id="hero-uptime-tag"><i class="fa-regular fa-clock"></i> Uptime: ${this.formatUptime(server.uptime)}</span>
            </div>
          </div>
        </div>

        <div class="master-power-controls">
          <button class="power-act-btn start" id="btn-hero-start"><i class="fa-solid fa-play"></i> Start</button>
          <button class="power-act-btn restart" id="btn-hero-restart"><i class="fa-solid fa-rotate-right"></i> Restart</button>
          <button class="power-act-btn stop" id="btn-hero-stop"><i class="fa-solid fa-stop"></i> Stop</button>
          <button class="power-act-btn kill" id="btn-hero-kill"><i class="fa-solid fa-bolt"></i> Kill</button>
        </div>
      </div>

      <!-- Sub Navigation Tabs -->
      <div class="sub-nav-tabs">
        <button class="sub-tab-btn ${this.activeTab === 'console' ? 'active' : ''}" data-tab="console"><i class="fa-solid fa-terminal"></i> Console</button>
        <button class="sub-tab-btn ${this.activeTab === 'files' ? 'active' : ''}" data-tab="files"><i class="fa-regular fa-folder-open"></i> File Manager</button>
        <button class="sub-tab-btn ${this.activeTab === 'databases' ? 'active' : ''}" data-tab="databases"><i class="fa-solid fa-database"></i> Databases</button>
        <button class="sub-tab-btn ${this.activeTab === 'schedules' ? 'active' : ''}" data-tab="schedules"><i class="fa-regular fa-calendar-check"></i> Schedules</button>
        <button class="sub-tab-btn ${this.activeTab === 'users' ? 'active' : ''}" data-tab="users"><i class="fa-solid fa-users"></i> Users</button>
        <button class="sub-tab-btn ${this.activeTab === 'backups' ? 'active' : ''}" data-tab="backups"><i class="fa-solid fa-box-archive"></i> Backups</button>
        <button class="sub-tab-btn ${this.activeTab === 'network' ? 'active' : ''}" data-tab="network"><i class="fa-solid fa-network-wired"></i> Network</button>
        <button class="sub-tab-btn ${this.activeTab === 'startup' ? 'active' : ''}" data-tab="startup"><i class="fa-solid fa-sliders"></i> Startup</button>
        <button class="sub-tab-btn ${this.activeTab === 'settings' ? 'active' : ''}" data-tab="settings"><i class="fa-solid fa-gear"></i> Settings</button>
      </div>

      <div id="tab-content-area"></div>
    `;

    // Power handlers
    document.getElementById('btn-hero-start').onclick = () => this.triggerPowerAction(server.id, 'start');
    document.getElementById('btn-hero-restart').onclick = () => this.triggerPowerAction(server.id, 'restart');
    document.getElementById('btn-hero-stop').onclick = () => this.triggerPowerAction(server.id, 'stop');
    document.getElementById('btn-hero-kill').onclick = () => this.triggerPowerAction(server.id, 'kill');

    // Tab buttons
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        this.navigate(`#server/${server.id}/${tab}`);
      };
    });
  }

  async renderActiveTabContent(server) {
    const tabArea = document.getElementById('tab-content-area');
    if (!tabArea) return;

    if (this.activeTab === 'console') {
      this.renderConsoleTab(tabArea, server);
    } else if (this.activeTab === 'files') {
      this.renderFileManagerTab(tabArea, server);
    } else if (this.activeTab === 'databases') {
      this.renderDatabasesTab(tabArea, server);
    } else if (this.activeTab === 'schedules') {
      this.renderSchedulesTab(tabArea, server);
    } else if (this.activeTab === 'users') {
      this.renderUsersTab(tabArea, server);
    } else if (this.activeTab === 'backups') {
      this.renderBackupsTab(tabArea, server);
    } else if (this.activeTab === 'network') {
      this.renderNetworkTab(tabArea, server);
    } else if (this.activeTab === 'startup') {
      this.renderStartupTab(tabArea, server);
    } else if (this.activeTab === 'settings') {
      this.renderSettingsTab(tabArea, server);
    }
  }

  // ======================== TAB: CONSOLE ======================== //

  renderConsoleTab(container, server) {
    container.innerHTML = `
      <div class="live-stats-row">
        <div class="live-stat-card">
          <div class="live-stat-top">
            <div>
              <div class="live-stat-title"><i class="fa-solid fa-microchip" style="color: var(--brand-cyan);"></i> CPU Usage</div>
              <div class="live-stat-num" id="stat-cpu-num">${server.stats.cpu}%</div>
            </div>
            <span class="live-stat-limit">Limit: ${server.limits.cpu}%</span>
          </div>
          <canvas class="sparkline-canvas" id="chart-cpu"></canvas>
        </div>

        <div class="live-stat-card">
          <div class="live-stat-top">
            <div>
              <div class="live-stat-title"><i class="fa-solid fa-memory" style="color: #a855f7;"></i> Memory</div>
              <div class="live-stat-num" id="stat-mem-num">${(server.stats.memory / 1024).toFixed(2)} GB</div>
            </div>
            <span class="live-stat-limit">Limit: ${(server.limits.memory / 1024).toFixed(2)} GB</span>
          </div>
          <canvas class="sparkline-canvas" id="chart-mem"></canvas>
        </div>

        <div class="live-stat-card">
          <div class="live-stat-top">
            <div>
              <div class="live-stat-title"><i class="fa-solid fa-hard-drive" style="color: #f59e0b;"></i> Disk Space</div>
              <div class="live-stat-num" id="stat-disk-num">${(server.stats.disk / 1024).toFixed(2)} GB</div>
            </div>
            <span class="live-stat-limit">Limit: ${(server.limits.disk / 1024).toFixed(2)} GB</span>
          </div>
          <canvas class="sparkline-canvas" id="chart-disk"></canvas>
        </div>

        <div class="live-stat-card">
          <div class="live-stat-top">
            <div>
              <div class="live-stat-title"><i class="fa-solid fa-arrow-down-up-lock" style="color: #10b981;"></i> Network I/O</div>
              <div class="live-stat-num" id="stat-net-num">${server.stats.netRx} KB/s</div>
            </div>
            <span class="live-stat-limit">TX: ${server.stats.netTx} KB/s</span>
          </div>
          <canvas class="sparkline-canvas" id="chart-net"></canvas>
        </div>
      </div>

      <div class="terminal-wrapper">
        <div class="terminal-header">
          <div class="terminal-title-left">
            <span class="term-dot red"></span>
            <span class="term-dot yellow"></span>
            <span class="term-dot green"></span>
            <span style="margin-left: 8px;"><i class="fa-solid fa-terminal"></i> container@wings:~# (SMOOTH x HOST Daemon)</span>
          </div>
          <div class="terminal-actions-right">
            <button class="term-btn" id="btn-term-clear" title="Clear output"><i class="fa-solid fa-trash-can"></i> Clear</button>
            <button class="term-btn" id="btn-term-scroll" title="Auto-scroll toggle"><i class="fa-solid fa-arrow-down"></i> Auto-Scroll</button>
            <button class="term-btn" id="btn-term-download" title="Download log file"><i class="fa-solid fa-download"></i> Download</button>
          </div>
        </div>

        <div class="terminal-output" id="terminal-screen"></div>

        <div class="terminal-command-bar">
          <span class="prompt-symbol">&gt;</span>
          <input type="text" class="command-input" id="terminal-cmd-input" placeholder="Type a command to send to server (e.g. help, tps, op Steve, say Hello)..." autocomplete="off" spellcheck="false">
          <button class="btn-primary" id="btn-send-cmd" style="padding: 6px 14px; font-size: 0.8rem;">
            <i class="fa-solid fa-paper-plane"></i> Send
          </button>
        </div>

        <div class="quick-commands-bar">
          <span style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase; font-weight:600;">Quick:</span>
          <button class="quick-cmd-chip" data-cmd="help">/help</button>
          <button class="quick-cmd-chip" data-cmd="tps">/tps</button>
          <button class="quick-cmd-chip" data-cmd="status">/status</button>
          <button class="quick-cmd-chip" data-cmd="say Server announcement from SMOOTH x HOST">/say Announcement</button>
          <button class="quick-cmd-chip" data-cmd="op AdminPlayer">/op Admin</button>
          <button class="quick-cmd-chip" data-cmd="whitelist on">/whitelist on</button>
        </div>
      </div>
    `;

    // Initialize charts
    this.charts.cpu = new LiveChart('chart-cpu', { color: '#00e5ff', fillColor: 'rgba(0, 229, 255, 0.15)', maxValue: server.limits.cpu });
    this.charts.mem = new LiveChart('chart-mem', { color: '#a855f7', fillColor: 'rgba(168, 85, 247, 0.15)', maxValue: server.limits.memory });
    this.charts.disk = new LiveChart('chart-disk', { color: '#f59e0b', fillColor: 'rgba(245, 158, 11, 0.15)', maxValue: server.limits.disk });
    this.charts.net = new LiveChart('chart-net', { color: '#10b981', fillColor: 'rgba(16, 185, 129, 0.15)', autoScale: true });

    // Initialize Terminal
    this.terminal = new TerminalManager('terminal-screen');

    // Terminal button actions
    document.getElementById('btn-term-clear').onclick = () => this.terminal.clear();
    document.getElementById('btn-term-download').onclick = () => this.terminal.downloadLogs(server.name);
    
    const scrollBtn = document.getElementById('btn-term-scroll');
    scrollBtn.onclick = () => {
      this.terminal.autoScroll = !this.terminal.autoScroll;
      scrollBtn.style.color = this.terminal.autoScroll ? 'var(--brand-cyan)' : 'var(--text-dim)';
      this.showToast(`Auto-scroll ${this.terminal.autoScroll ? 'enabled' : 'disabled'}`, 'info');
    };

    // Command Input
    const cmdInput = document.getElementById('terminal-cmd-input');
    const sendBtn = document.getElementById('btn-send-cmd');

    const executeCmd = async () => {
      const val = cmdInput.value.trim();
      if (!val) return;
      this.playSound('click');
      this.commandHistory.push(val);
      this.historyIndex = this.commandHistory.length;
      cmdInput.value = '';
      try {
        await window.api.sendCommand(server.id, val);
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    };

    sendBtn.onclick = executeCmd;

    cmdInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        executeCmd();
      } else if (e.key === 'ArrowUp') {
        if (this.historyIndex > 0) {
          this.historyIndex--;
          cmdInput.value = this.commandHistory[this.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
          cmdInput.value = this.commandHistory[this.historyIndex] || '';
        } else {
          this.historyIndex = this.commandHistory.length;
          cmdInput.value = '';
        }
      }
    };

    // Quick Command chips
    document.querySelectorAll('.quick-cmd-chip').forEach(chip => {
      chip.onclick = () => {
        cmdInput.value = chip.getAttribute('data-cmd');
        cmdInput.focus();
      };
    });
  }

  // ======================== TAB: FILE MANAGER ======================== //

  async renderFileManagerTab(container, server) {
    container.innerHTML = `
      <div class="file-manager-container">
        <div class="file-toolbar">
          <div class="file-breadcrumbs" id="file-crumbs-container"></div>
          <div class="file-actions-group">
            <button class="btn-secondary" id="btn-new-file"><i class="fa-solid fa-file-circle-plus"></i> New File</button>
            <button class="btn-secondary" id="btn-new-folder"><i class="fa-solid fa-folder-plus"></i> New Folder</button>
            <button class="btn-secondary" id="btn-refresh-files"><i class="fa-solid fa-arrows-rotate"></i> Refresh</button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="file-table">
            <thead>
              <tr>
                <th style="width: 45%;">Name</th>
                <th style="width: 15%;">Size</th>
                <th style="width: 25%;">Last Modified</th>
                <th style="width: 15%; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="files-tbody">
              <tr><td colspan="4" style="text-align:center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading directory contents...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btn-new-file').onclick = () => this.openCreateFileModal(server);
    document.getElementById('btn-new-folder').onclick = () => this.openCreateFolderModal(server);
    document.getElementById('btn-refresh-files').onclick = () => this.loadDirectoryFiles(server, this.currentPath);

    await this.loadDirectoryFiles(server, this.currentPath || '/');
  }

  async loadDirectoryFiles(server, dirPath) {
    this.currentPath = dirPath;
    const tbody = document.getElementById('files-tbody');
    const crumbsContainer = document.getElementById('file-crumbs-container');
    if (!tbody || !crumbsContainer) return;

    // Render breadcrumbs
    const parts = dirPath.split('/').filter(Boolean);
    let breadcrumbHTML = `<span class="file-crumb" data-path="/"><i class="fa-solid fa-house"></i> root</span>`;
    let accum = '';
    parts.forEach(p => {
      accum += `/${p}`;
      breadcrumbHTML += `<span>/</span><span class="file-crumb" data-path="${accum}">${p}</span>`;
    });
    crumbsContainer.innerHTML = breadcrumbHTML;

    crumbsContainer.querySelectorAll('.file-crumb').forEach(c => {
      c.onclick = () => this.loadDirectoryFiles(server, c.getAttribute('data-path'));
    });

    try {
      const res = await window.api.listFiles(server.id, dirPath);
      if (res.files.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 3rem; color: var(--text-dim);">Directory is empty</td></tr>`;
        return;
      }

      tbody.innerHTML = res.files.map(f => {
        const fullRel = pathJoin(dirPath, f.name);
        const iconClass = f.isDirectory ? 'fa-folder folder' : this.getFileIcon(f.name);
        const sizeFormatted = f.isDirectory ? '-' : this.formatBytes(f.size);
        const dateFormatted = new Date(f.modified).toLocaleString();

        return `
          <tr class="file-row" data-name="${this.escapeHtml(f.name)}" data-is-dir="${f.isDirectory}">
            <td>
              <div class="file-name-cell">
                <i class="fa-solid ${iconClass} file-icon"></i>
                <span>${this.escapeHtml(f.name)}</span>
              </div>
            </td>
            <td><span style="font-family: var(--font-mono); font-size: 0.8rem;">${sizeFormatted}</span></td>
            <td><span style="font-size: 0.8rem; color: var(--text-dim);">${dateFormatted}</span></td>
            <td>
              <div class="file-row-actions">
                ${!f.isDirectory ? `
                  <button class="file-action-btn edit" data-path="${fullRel}" title="Edit File">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                ` : ''}
                <button class="file-action-btn delete" data-path="${fullRel}" title="Delete">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Attach row clicks
      tbody.querySelectorAll('.file-row').forEach(row => {
        row.onclick = (e) => {
          if (e.target.closest('.file-row-actions')) return;
          const isDir = row.getAttribute('data-is-dir') === 'true';
          const name = row.getAttribute('data-name');
          const next = pathJoin(dirPath, name);
          if (isDir) {
            this.loadDirectoryFiles(server, next);
          } else {
            this.openCodeEditor(server, next);
          }
        };
      });

      // Actions
      tbody.querySelectorAll('.file-action-btn.edit').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const target = btn.getAttribute('data-path');
          this.openCodeEditor(server, target);
        };
      });

      tbody.querySelectorAll('.file-action-btn.delete').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const target = btn.getAttribute('data-path');
          if (confirm(`Are you sure you want to delete "${target}"?`)) {
            try {
              await window.api.deleteFile(server.id, target);
              this.showToast(`Deleted ${target}`, 'success');
              this.loadDirectoryFiles(server, this.currentPath);
            } catch (err) {
              this.showToast(err.message, 'error');
            }
          }
        };
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" style="color: #ef4444; padding: 2rem; text-align:center;">Failed to list files: ${err.message}</td></tr>`;
    }
  }

  // File In-Browser Code Editor Modal
  async openCodeEditor(server, filePath) {
    try {
      const res = await window.api.getFileContent(server.id, filePath);
      const modal = document.createElement('div');
      modal.className = 'code-editor-modal';
      modal.id = 'active-editor-modal';

      modal.innerHTML = `
        <div class="editor-window">
          <div class="editor-header">
            <div class="editor-filename">
              <i class="fa-solid fa-code"></i> ${this.escapeHtml(filePath)}
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn-primary" id="btn-editor-save"><i class="fa-solid fa-floppy-disk"></i> Save Content</button>
              <button class="btn-secondary" id="btn-editor-close"><i class="fa-solid fa-xmark"></i> Close</button>
            </div>
          </div>
          <textarea class="editor-textarea" id="editor-text-content" spellcheck="false">${this.escapeHtml(res.content)}</textarea>
          <div class="editor-footer">
            <span style="font-size: 0.78rem; color: var(--text-dim); font-family: var(--font-mono);">UTF-8 | Lines: <span id="line-counter">0</span></span>
            <span style="font-size: 0.78rem; color: var(--brand-cyan);">SMOOTH x HOST Monaco-Core IDE</span>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const textarea = document.getElementById('editor-text-content');
      const counter = document.getElementById('line-counter');
      const updateLines = () => {
        counter.textContent = textarea.value.split('\n').length;
      };
      textarea.oninput = updateLines;
      updateLines();

      document.getElementById('btn-editor-save').onclick = async () => {
        this.playSound('click');
        try {
          await window.api.saveFileContent(server.id, filePath, textarea.value);
          this.showToast(`Saved ${filePath} successfully`, 'success');
        } catch (err) {
          this.showToast(`Failed to save: ${err.message}`, 'error');
        }
      };

      document.getElementById('btn-editor-close').onclick = () => modal.remove();
    } catch (err) {
      this.showToast(`Cannot open file: ${err.message}`, 'error');
    }
  }

  // Create file modal
  openCreateFileModal(server) {
    const filename = prompt('Enter new file name (e.g. config.json, bot.js):');
    if (!filename) return;
    window.api.createFileOrFolder(server.id, this.currentPath, filename, false)
      .then(() => {
        this.showToast(`Created file: ${filename}`, 'success');
        this.loadDirectoryFiles(server, this.currentPath);
      })
      .catch(err => this.showToast(err.message, 'error'));
  }

  // Create folder modal
  openCreateFolderModal(server) {
    const foldername = prompt('Enter new folder name:');
    if (!foldername) return;
    window.api.createFileOrFolder(server.id, this.currentPath, foldername, true)
      .then(() => {
        this.showToast(`Created directory: ${foldername}`, 'success');
        this.loadDirectoryFiles(server, this.currentPath);
      })
      .catch(err => this.showToast(err.message, 'error'));
  }

  // ======================== TAB: DATABASES ======================== //

  async renderDatabasesTab(container, server) {
    container.innerHTML = `
      <div class="panel-section-box">
        <div class="section-head-row">
          <div>
            <h2 class="section-title"><i class="fa-solid fa-database" style="color: #38bdf8;"></i> MySQL Databases</h2>
            <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 4px;">Dedicated MariaDB/MySQL instances with remote root access</p>
          </div>
          <button class="btn-primary" id="btn-new-db"><i class="fa-solid fa-plus"></i> New Database</button>
        </div>

        <div class="items-grid" id="db-list-grid">
          <div style="padding: 2rem; text-align:center; color: var(--text-dim);"><i class="fa-solid fa-spinner fa-spin"></i> Loading databases...</div>
        </div>
      </div>
    `;

    document.getElementById('btn-new-db').onclick = () => this.openCreateDatabaseModal(server);
    await this.loadDatabases(server);
  }

  async loadDatabases(server) {
    const grid = document.getElementById('db-list-grid');
    if (!grid) return;
    try {
      const dbs = await window.api.getDatabases(server.id);
      if (dbs.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: var(--text-dim);">
            <i class="fa-solid fa-database" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 0.8rem;"></i>
            <p>No databases provisioned for this server yet.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = dbs.map(db => `
        <div class="item-card">
          <div>
            <div class="item-card-title">
              <span><i class="fa-solid fa-database" style="color: var(--brand-cyan); margin-right: 6px;"></i> ${this.escapeHtml(db.name)}</span>
              <button class="file-action-btn delete" data-db-id="${db.id}" title="Delete Database"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            <div class="item-field-list" style="margin-top: 10px;">
              <div class="item-field"><span class="field-label">Endpoint</span><span class="field-val">${db.host}</span></div>
              <div class="item-field"><span class="field-label">Username</span><span class="field-val">${db.user}</span></div>
              <div class="item-field">
                <span class="field-label">Password</span>
                <span class="field-val" style="cursor: pointer;" title="Click to copy" onclick="navigator.clipboard.writeText('${db.pass}'); app.showToast('Password copied!', 'success');">
                  •••••••••••• <i class="fa-regular fa-copy" style="font-size: 0.7rem; margin-left: 4px;"></i>
                </span>
              </div>
              <div class="item-field"><span class="field-label">Connections</span><span class="field-val">0 / ${db.maxConnections}</span></div>
            </div>
          </div>
        </div>
      `).join('');

      grid.querySelectorAll('.file-action-btn.delete').forEach(btn => {
        btn.onclick = async () => {
          const dbId = btn.getAttribute('data-db-id');
          if (confirm('Delete this database? All stored tables and data will be permanently wiped.')) {
            await window.api.deleteDatabase(server.id, dbId);
            this.showToast('Database removed', 'success');
            this.loadDatabases(server);
          }
        };
      });
    } catch (err) {
      grid.innerHTML = `<div style="color: #ef4444;">${err.message}</div>`;
    }
  }

  openCreateDatabaseModal(server) {
    const name = prompt('Enter database identifier name (e.g. luckperms, botdata):');
    if (!name) return;
    window.api.createDatabase(server.id, name)
      .then(() => {
        this.showToast(`Database created: ${name}`, 'success');
        this.loadDatabases(server);
      })
      .catch(err => this.showToast(err.message, 'error'));
  }

  // ======================== TAB: SCHEDULES ======================== //

  async renderSchedulesTab(container, server) {
    container.innerHTML = `
      <div class="panel-section-box">
        <div class="section-head-row">
          <div>
            <h2 class="section-title"><i class="fa-regular fa-calendar-check" style="color: #a855f7;"></i> Automated Schedules (Cron)</h2>
            <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 4px;">Execute automated power restarts, console broadcasts, and backups</p>
          </div>
          <button class="btn-primary" id="btn-new-schedule"><i class="fa-solid fa-plus"></i> New Schedule</button>
        </div>

        <div class="items-grid" id="schedules-grid">
          <div style="padding: 2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading schedules...</div>
        </div>
      </div>
    `;

    document.getElementById('btn-new-schedule').onclick = () => this.openCreateScheduleModal(server);
    await this.loadSchedules(server);
  }

  async loadSchedules(server) {
    const grid = document.getElementById('schedules-grid');
    if (!grid) return;
    try {
      const schs = await window.api.getSchedules(server.id);
      if (schs.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: var(--text-dim);">
            <i class="fa-regular fa-calendar-xmark" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 0.8rem;"></i>
            <p>No cron schedules configured.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = schs.map(sc => `
        <div class="item-card">
          <div>
            <div class="item-card-title">
              <span><i class="fa-solid fa-clock" style="color: #a855f7; margin-right: 6px;"></i> ${this.escapeHtml(sc.name)}</span>
              <button class="file-action-btn delete" data-sc-id="${sc.id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            <div class="item-field-list" style="margin-top: 10px;">
              <div class="item-field"><span class="field-label">Cron Syntax</span><span class="field-val">${sc.cron}</span></div>
              <div class="item-field"><span class="field-label">Last Executed</span><span class="field-val" style="color: var(--text-muted);">${sc.lastRun || 'Never'}</span></div>
              <div class="item-field"><span class="field-label">Status</span><span class="field-val" style="color: #34d399;">Active</span></div>
            </div>
          </div>
          <button class="btn-secondary" style="width: 100%; justify-content: center;" onclick="app.showToast('Schedule trigger executed', 'success')">
            <i class="fa-solid fa-bolt"></i> Run Now
          </button>
        </div>
      `).join('');

      grid.querySelectorAll('.file-action-btn.delete').forEach(btn => {
        btn.onclick = async () => {
          const scId = btn.getAttribute('data-sc-id');
          await window.api.deleteSchedule(server.id, scId);
          this.showToast('Schedule removed', 'success');
          this.loadSchedules(server);
        };
      });
    } catch (err) {
      grid.innerHTML = `<div>${err.message}</div>`;
    }
  }

  openCreateScheduleModal(server) {
    const name = prompt('Schedule name (e.g. Daily Restart at 4am):');
    if (!name) return;
    const cron = prompt('Cron expression (e.g. 0 4 * * *):', '0 4 * * *');
    if (!cron) return;

    window.api.createSchedule(server.id, name, cron)
      .then(() => {
        this.showToast('Schedule created', 'success');
        this.loadSchedules(server);
      })
      .catch(err => this.showToast(err.message, 'error'));
  }

  // ======================== TAB: USERS ======================== //

  async renderUsersTab(container, server) {
    container.innerHTML = `
      <div class="panel-section-box">
        <div class="section-head-row">
          <div>
            <h2 class="section-title"><i class="fa-solid fa-users" style="color: #10b981;"></i> Sub-User Access Management</h2>
            <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 4px;">Grant teammates granular control over console, files, and backups</p>
          </div>
          <button class="btn-primary" id="btn-invite-user"><i class="fa-solid fa-user-plus"></i> Invite User</button>
        </div>

        <div class="items-grid" id="users-grid">
          <div style="padding: 2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading sub-users...</div>
        </div>
      </div>
    `;

    document.getElementById('btn-invite-user').onclick = () => this.openInviteUserModal(server);
    await this.loadUsers(server);
  }

  async loadUsers(server) {
    const grid = document.getElementById('users-grid');
    if (!grid) return;
    try {
      const users = await window.api.getUsers(server.id);
      if (users.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: var(--text-dim);">
            <i class="fa-solid fa-user-shield" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 0.8rem;"></i>
            <p>No sub-users have been invited yet. Only root administrators have access.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = users.map(u => `
        <div class="item-card">
          <div>
            <div class="item-card-title">
              <span><i class="fa-solid fa-circle-user" style="color: #10b981; margin-right: 6px;"></i> ${this.escapeHtml(u.email)}</span>
              <button class="file-action-btn delete" data-user-id="${u.id}"><i class="fa-solid fa-user-xmark"></i></button>
            </div>
            <div class="item-field-list" style="margin-top: 10px;">
              <div class="item-field"><span class="field-label">Role</span><span class="field-val">${u.role || 'Operator'}</span></div>
              <div class="item-field"><span class="field-label">Permissions</span><span class="field-val">${(u.permissions || []).length} assigned</span></div>
              <div class="item-field"><span class="field-label">2FA Enforced</span><span class="field-val" style="color:#10b981;">Yes</span></div>
            </div>
          </div>
        </div>
      `).join('');

      grid.querySelectorAll('.file-action-btn.delete').forEach(btn => {
        btn.onclick = async () => {
          const uId = btn.getAttribute('data-user-id');
          await window.api.deleteUser(server.id, uId);
          this.showToast('Sub-user revoked', 'success');
          this.loadUsers(server);
        };
      });
    } catch (err) {
      grid.innerHTML = `<div>${err.message}</div>`;
    }
  }

  openInviteUserModal(server) {
    const email = prompt('Enter staff or co-owner email:');
    if (!email) return;

    window.api.inviteUser(server.id, email, ['control.start', 'control.restart', 'console.read', 'console.send', 'files.read'])
      .then(() => {
        this.showToast(`Invitation sent to ${email}`, 'success');
        this.loadUsers(server);
      })
      .catch(err => this.showToast(err.message, 'error'));
  }

  // ======================== TAB: BACKUPS ======================== //

  async renderBackupsTab(container, server) {
    container.innerHTML = `
      <div class="panel-section-box">
        <div class="section-head-row">
          <div>
            <h2 class="section-title"><i class="fa-solid fa-box-archive" style="color: #f59e0b;"></i> Server Backups & Snapshots</h2>
            <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 4px;">Point-in-time full server disk archives with 1-click restore</p>
          </div>
          <button class="btn-primary" id="btn-create-backup"><i class="fa-solid fa-plus"></i> Create Backup</button>
        </div>

        <div class="items-grid" id="backups-grid">
          <div style="padding: 2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading backups...</div>
        </div>
      </div>
    `;

    document.getElementById('btn-create-backup').onclick = () => this.openCreateBackupModal(server);
    await this.loadBackups(server);
  }

  async loadBackups(server) {
    const grid = document.getElementById('backups-grid');
    if (!grid) return;
    try {
      const bks = await window.api.getBackups(server.id);
      if (bks.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: var(--text-dim);">
            <i class="fa-solid fa-box-archive" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 0.8rem;"></i>
            <p>No backup snapshots saved yet.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = bks.map(b => `
        <div class="item-card">
          <div>
            <div class="item-card-title">
              <span><i class="fa-solid ${b.isLocked ? 'fa-lock' : 'fa-file-zipper'}" style="color: #f59e0b; margin-right: 6px;"></i> ${this.escapeHtml(b.name)}</span>
              <button class="file-action-btn delete" data-bk-id="${b.id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            <div class="item-field-list" style="margin-top: 10px;">
              <div class="item-field"><span class="field-label">Archive Size</span><span class="field-val">${b.size}</span></div>
              <div class="item-field"><span class="field-label">Created At</span><span class="field-val" style="color: var(--text-muted);">${new Date(b.createdAt).toLocaleDateString()}</span></div>
              <div class="item-field"><span class="field-label">Integrity Status</span><span class="field-val" style="color:#10b981;">Verified SHA256</span></div>
            </div>
          </div>
          <div style="display:flex; gap: 8px;">
            <button class="btn-secondary" style="flex:1; justify-content:center;" onclick="app.showToast('Restore sequence started', 'info')"><i class="fa-solid fa-rotate-left"></i> Restore</button>
            <button class="btn-secondary" style="flex:1; justify-content:center;" onclick="app.showToast('Generating download archive...', 'info')"><i class="fa-solid fa-download"></i> Download</button>
          </div>
        </div>
      `).join('');

      grid.querySelectorAll('.file-action-btn.delete').forEach(btn => {
        btn.onclick = async () => {
          const bkId = btn.getAttribute('data-bk-id');
          await window.api.deleteBackup(server.id, bkId);
          this.showToast('Backup deleted', 'success');
          this.loadBackups(server);
        };
      });
    } catch (err) {
      grid.innerHTML = `<div>${err.message}</div>`;
    }
  }

  openCreateBackupModal(server) {
    const name = prompt('Backup snapshot title (e.g. Pre-Update Snapshot):', `Snapshot-${new Date().toLocaleDateString()}`);
    if (!name) return;
    window.api.createBackup(server.id, name, false)
      .then(() => {
        this.showToast('Backup snapshot initiated successfully', 'success');
        this.loadBackups(server);
      })
      .catch(err => this.showToast(err.message, 'error'));
  }

  // ======================== TAB: NETWORK ======================== //

  renderNetworkTab(container, server) {
    container.innerHTML = `
      <div class="panel-section-box">
        <div class="section-head-row">
          <div>
            <h2 class="section-title"><i class="fa-solid fa-network-wired" style="color: var(--brand-cyan);"></i> Port Allocations & IP Networking</h2>
            <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 4px;">Assigned public endpoints and reverse proxies</p>
          </div>
        </div>

        <div class="items-grid">
          <div class="item-card">
            <div class="item-card-title">
              <span><i class="fa-solid fa-star" style="color: #f59e0b; margin-right: 6px;"></i> Primary Allocation</span>
              <span class="status-badge running" style="font-size: 0.7rem;">Primary</span>
            </div>
            <div class="item-field-list" style="margin-top: 10px;">
              <div class="item-field"><span class="field-label">IPv4 Address</span><span class="field-val">${server.allocation.ip}</span></div>
              <div class="item-field"><span class="field-label">Port</span><span class="field-val">${server.allocation.port}</span></div>
              <div class="item-field"><span class="field-label">Public Hostname</span><span class="field-val">${server.allocation.alias}</span></div>
            </div>
            <button class="btn-secondary" style="width:100%; justify-content:center;" onclick="navigator.clipboard.writeText('${server.allocation.alias}'); app.showToast('Copied address!', 'success');">
              <i class="fa-regular fa-copy"></i> Copy Direct Connect
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ======================== TAB: STARTUP ======================== //

  renderStartupTab(container, server) {
    const egg = this.eggs.find(e => e.id === server.eggId) || { variables: [] };

    container.innerHTML = `
      <div class="panel-section-box">
        <div class="section-head-row">
          <div>
            <h2 class="section-title"><i class="fa-solid fa-sliders" style="color: #38bdf8;"></i> Startup Parameters & Egg Config</h2>
            <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 4px;">Edit container startup command and environment variables</p>
          </div>
          <button class="btn-primary" id="btn-save-startup"><i class="fa-solid fa-floppy-disk"></i> Save Variables</button>
        </div>

        <div class="settings-group">
          <div class="form-group">
            <label class="form-label">Startup Command</label>
            <textarea class="form-input form-textarea" id="startup-command-input" style="font-family: var(--font-mono); font-size: 0.85rem;">${this.escapeHtml(server.startup)}</textarea>
            <span style="font-size: 0.75rem; color: var(--text-dim);">Available template variables: {{SERVER_MEMORY}}, {{SERVER_PORT}}, {{SERVER_JARFILE}}</span>
          </div>

          <div style="margin-top: 1rem;">
            <h3 style="font-size: 1rem; color: var(--text-main); margin-bottom: 1rem;">Egg Environment Variables</h3>
            <div class="items-grid">
              ${(egg.variables || []).map(v => `
                <div class="item-card">
                  <div class="form-group">
                    <label class="form-label">${this.escapeHtml(v.label)} <span style="font-family: var(--font-mono); color: var(--brand-cyan);">(${v.name})</span></label>
                    <input type="text" class="form-input egg-var-input" data-var="${v.name}" value="${this.escapeHtml(server.variables[v.name] || v.defaultValue)}">
                    <span style="font-size: 0.75rem; color: var(--text-dim);">${v.description}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-save-startup').onclick = async () => {
      this.playSound('click');
      const startup = document.getElementById('startup-command-input').value;
      const variables = {};
      document.querySelectorAll('.egg-var-input').forEach(inp => {
        variables[inp.getAttribute('data-var')] = inp.value;
      });

      try {
        await window.api.updateSettings(server.id, { startup, variables });
        this.showToast('Startup parameters updated successfully', 'success');
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    };
  }

  // ======================== TAB: SETTINGS ======================== //

  renderSettingsTab(container, server) {
    container.innerHTML = `
      <div class="panel-section-box">
        <h2 class="section-title"><i class="fa-solid fa-sliders" style="color: #38bdf8;"></i> Server Information</h2>
        <div class="settings-group" style="margin-top: 1rem;">
          <div class="form-group">
            <label class="form-label">Server Display Name</label>
            <input type="text" class="form-input" id="setting-server-name" value="${this.escapeHtml(server.name)}">
          </div>
          <div class="form-group">
            <label class="form-label">Server Description</label>
            <input type="text" class="form-input" id="setting-server-desc" value="${this.escapeHtml(server.description || '')}">
          </div>
          <button class="btn-primary" id="btn-save-general-settings" style="width: fit-content;">Save General Settings</button>
        </div>
      </div>

      <div class="panel-section-box">
        <h2 class="section-title"><i class="fa-solid fa-network-wired" style="color: #10b981;"></i> SFTP Connection Details</h2>
        <p style="font-size: 0.85rem; color: var(--text-dim); margin: 6px 0 1rem 0;">Connect using FileZilla, Cyberduck, or WinSCP</p>
        <div class="item-field-list">
          <div class="item-field"><span class="field-label">SFTP Host</span><span class="field-val">${server.sftp.host}</span></div>
          <div class="item-field"><span class="field-label">Port</span><span class="field-val">${server.sftp.port}</span></div>
          <div class="item-field"><span class="field-label">Username</span><span class="field-val">${server.sftp.username}</span></div>
        </div>
      </div>

      <div class="danger-zone-box">
        <div class="danger-title"><i class="fa-solid fa-triangle-exclamation"></i> Danger Zone</div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
          These operations are destructive. Reinstalling will wipe all current files and reload the clean egg template. Deleting will permanently remove this instance and all associated databases and snapshots.
        </p>
        <div style="display:flex; gap: 12px; flex-wrap:wrap;">
          <button class="btn-danger" id="btn-reinstall-server"><i class="fa-solid fa-rotate"></i> Reinstall Server</button>
          <button class="btn-danger" id="btn-delete-server" style="background:#ef4444; color:#fff;"><i class="fa-solid fa-trash-can"></i> Delete Server</button>
        </div>
      </div>
    `;

    document.getElementById('btn-save-general-settings').onclick = async () => {
      const name = document.getElementById('setting-server-name').value;
      const description = document.getElementById('setting-server-desc').value;
      try {
        await window.api.updateSettings(server.id, { name, description });
        server.name = name;
        server.description = description;
        this.showToast('Server settings updated', 'success');
        this.renderServerDetailLayout(server);
        this.renderActiveTabContent(server);
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    };

    document.getElementById('btn-reinstall-server').onclick = async () => {
      if (confirm(`Are you sure you want to REINSTALL "${server.name}"? All files will be reset.`)) {
        await window.api.reinstallServer(server.id);
        this.showToast('Reinstall initiated', 'warn');
        this.navigate(`#server/${server.id}/console`);
      }
    };

    document.getElementById('btn-delete-server').onclick = async () => {
      const confirmation = prompt(`Type "${server.name}" to confirm permanent deletion:`);
      if (confirmation === server.name) {
        await window.api.deleteServer(server.id);
        this.showToast(`Server "${server.name}" was deleted`, 'success');
        this.navigate('#servers');
      } else if (confirmation !== null) {
        this.showToast('Server name did not match. Deletion cancelled.', 'warn');
      }
    };
  }

  // ======================== ADMIN AREA ======================== //

  renderAdminView() {
    const mainView = document.getElementById('main-content-view');
    if (!mainView) return;

    mainView.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <h1 style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">
          <i class="fa-solid fa-shield-halved" style="color: var(--brand-cyan); margin-right: 8px;"></i> Administrator Control Center
        </h1>
        <p style="font-size: 0.9rem; color: var(--text-dim);">SMOOTH x HOST Cluster Infrastructure, Wings Daemons, and Eggs</p>
      </div>

      <div class="panel-section-box">
        <div class="section-head-row">
          <h2 class="section-title"><i class="fa-solid fa-server" style="color: var(--brand-cyan);"></i> Active Wings Nodes (${this.nodes.length})</h2>
          <button class="btn-primary" id="btn-create-node"><i class="fa-solid fa-plus"></i> Create Node</button>
        </div>

        <div class="items-grid">
          ${this.nodes.map(n => {
            const memPct = Math.round((n.memoryAllocated / n.memoryTotal) * 100) || 0;
            const diskPct = Math.round((n.diskAllocated / n.diskTotal) * 100) || 0;
            return `
              <div class="item-card">
                <div>
                  <div class="item-card-title">
                    <span><i class="fa-solid fa-cube" style="color: var(--brand-cyan); margin-right: 6px;"></i> ${this.escapeHtml(n.name)}</span>
                    <span class="system-status-pill"><span class="pulse-dot"></span> ${n.status}</span>
                  </div>
                  <div class="item-field-list" style="margin-top: 10px;">
                    <div class="item-field"><span class="field-label">FQDN</span><span class="field-val">${n.fqdn}</span></div>
                    <div class="item-field"><span class="field-label">Location</span><span class="field-val">${n.location}</span></div>
                    <div class="item-field"><span class="field-label">Wings Engine</span><span class="field-val">${n.wingsVersion}</span></div>
                    <div class="item-field"><span class="field-label">Latency</span><span class="field-val" style="color:#10b981;">${n.ping} ms</span></div>
                    <div class="item-field"><span class="field-label">Memory Allocated</span><span class="field-val">${(n.memoryAllocated/1024).toFixed(1)} / ${(n.memoryTotal/1024).toFixed(1)} GB (${memPct}%)</span></div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="panel-section-box">
        <div class="section-head-row">
          <h2 class="section-title"><i class="fa-solid fa-egg" style="color: #f59e0b;"></i> Supported Nests & Egg Templates (${this.eggs.length})</h2>
        </div>

        <div class="items-grid">
          ${this.eggs.map(e => `
            <div class="item-card">
              <div class="item-card-title">
                <span><i class="fa-solid ${e.icon}" style="color: ${e.color}; margin-right: 6px;"></i> ${this.escapeHtml(e.name)}</span>
                <span class="status-badge running" style="font-size: 0.7rem;">${e.nest}</span>
              </div>
              <div class="item-field-list" style="margin-top: 10px;">
                <div class="item-field"><span class="field-label">Docker Image</span><span class="field-val" style="font-size: 0.72rem;">${e.dockerImage}</span></div>
                <div class="item-field"><span class="field-label">Environment Vars</span><span class="field-val">${e.variables.length} configured</span></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-create-node').onclick = () => this.openCreateNodeModal();
  }

  openCreateNodeModal() {
    const name = prompt('Node Name (e.g. EU-West-02 London):');
    if (!name) return;
    const fqdn = prompt('Node FQDN / IP:', 'eu-west-02.smoothhost.cloud');
    if (!fqdn) return;

    window.api.createNode({ name, fqdn })
      .then(async () => {
        this.showToast('Node created successfully', 'success');
        this.nodes = await window.api.getNodes();
        this.renderAdminView();
      })
      .catch(err => this.showToast(err.message, 'error'));
  }

  // ======================== MODAL: CREATE SERVER WIZARD ======================== //

  openCreateServerModal() {
    this.playSound('click');
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'modal-create-server';

    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">
            <i class="fa-solid fa-server" style="color: var(--brand-cyan);"></i> Deploy New Server Instance
          </div>
          <button class="modal-close-btn" id="btn-close-create-modal">&times;</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Server Name</label>
            <input type="text" class="form-input" id="new-srv-name" placeholder="e.g. Pixelmon Adventure, Production Bot" value="Survival Network #1">
          </div>

          <div class="form-group">
            <label class="form-label">Select Node / Cluster</label>
            <select class="form-input" id="new-srv-node">
              ${this.nodes.map(n => `<option value="${n.id}">${n.name} (${n.location})</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Game / Application Egg</label>
            <select class="form-input" id="new-srv-egg">
              ${this.eggs.map(e => `<option value="${e.id}">${e.nest} - ${e.name}</option>`).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Memory Limit (MB)</label>
              <input type="number" class="form-input" id="new-srv-mem" value="4096" step="512">
            </div>
            <div class="form-group">
              <label class="form-label">CPU Limit (%)</label>
              <input type="number" class="form-input" id="new-srv-cpu" value="200" step="50">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Disk Storage (MB)</label>
            <input type="number" class="form-input" id="new-srv-disk" value="15360" step="1024">
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" id="btn-cancel-create">Cancel</button>
          <button class="btn-primary" id="btn-submit-create"><i class="fa-solid fa-rocket"></i> Deploy Instance</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-close-create-modal').onclick = () => modal.remove();
    document.getElementById('btn-cancel-create').onclick = () => modal.remove();

    document.getElementById('btn-submit-create').onclick = async () => {
      const name = document.getElementById('new-srv-name').value.trim();
      const nodeId = document.getElementById('new-srv-node').value;
      const eggId = document.getElementById('new-srv-egg').value;
      const memory = Number(document.getElementById('new-srv-mem').value);
      const cpu = Number(document.getElementById('new-srv-cpu').value);
      const disk = Number(document.getElementById('new-srv-disk').value);

      if (!name) {
        this.showToast('Please specify a server name', 'warn');
        return;
      }

      this.playSound('power');
      modal.remove();
      this.showToast(`Deploying ${name}...`, 'info');

      try {
        const created = await window.api.createServer({ name, nodeId, eggId, memory, cpu, disk });
        this.servers.push(created);
        this.showToast(`Server "${created.name}" deployed successfully!`, 'success');
        this.navigate(`#server/${created.id}/console`);
      } catch (err) {
        this.showToast(`Deployment error: ${err.message}`, 'error');
      }
    };
  }

  // ======================== COMMAND PALETTE (CTRL+K) ======================== //

  openCommandPalette() {
    this.playSound('click');
    const existing = document.getElementById('command-palette-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'command-palette-modal';

    modal.innerHTML = `
      <div class="modal-card" style="max-width: 650px;">
        <div style="padding: 1.25rem 1.5rem; display: flex; align-items:center; gap: 12px; border-bottom: 1px solid var(--border-subtle);">
          <i class="fa-solid fa-magnifying-glass" style="color: var(--brand-cyan); font-size: 1.1rem;"></i>
          <input type="text" id="palette-search-input" placeholder="Type a server name, navigate, or action..." style="flex:1; background:transparent; border:none; outline:none; color: var(--text-main); font-size: 1.05rem;" autofocus>
          <span class="search-shortcut-pill">ESC</span>
        </div>
        <div id="palette-results" style="max-height: 380px; overflow-y:auto; padding: 0.5rem;"></div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = document.getElementById('palette-search-input');
    const results = document.getElementById('palette-results');
    input.focus();

    const renderResults = (query) => {
      const q = query.toLowerCase();
      const matchedServers = this.servers.filter(s => s.name.toLowerCase().includes(q) || s.allocation.alias.includes(q));

      let html = '';
      if (matchedServers.length > 0) {
        html += `<div style="padding: 6px 12px; font-size: 0.72rem; color: var(--text-dim); text-transform:uppercase; font-weight:700;">Servers</div>`;
        matchedServers.forEach(s => {
          html += `
            <div class="palette-item" data-hash="#server/${s.id}/console" style="display:flex; align-items:center; justify-content:space-between; padding: 10px 14px; border-radius: 8px; cursor:pointer; color: var(--text-main); transition: background var(--trans-fast);">
              <div style="display:flex; align-items:center; gap: 10px;">
                <i class="fa-solid fa-server" style="color: var(--brand-cyan);"></i>
                <div>
                  <div style="font-weight:600; font-size:0.9rem;">${this.escapeHtml(s.name)}</div>
                  <div style="font-size:0.75rem; color: var(--text-dim);">${s.allocation.alias}</div>
                </div>
              </div>
              <span class="status-badge ${s.status}" style="font-size: 0.7rem;">${s.status}</span>
            </div>
          `;
        });
      }

      html += `
        <div style="padding: 6px 12px; font-size: 0.72rem; color: var(--text-dim); text-transform:uppercase; font-weight:700; margin-top:8px;">Navigation</div>
        <div class="palette-item" data-hash="#servers" style="display:flex; align-items:center; gap: 10px; padding: 10px 14px; border-radius: 8px; cursor:pointer; color: var(--text-main);">
          <i class="fa-solid fa-grip" style="color: #38bdf8;"></i> All Servers Dashboard
        </div>
        <div class="palette-item" data-hash="#admin" style="display:flex; align-items:center; gap: 10px; padding: 10px 14px; border-radius: 8px; cursor:pointer; color: var(--text-main);">
          <i class="fa-solid fa-shield-halved" style="color: #a855f7;"></i> Admin Wings Control
        </div>
      `;

      results.innerHTML = html;

      results.querySelectorAll('.palette-item').forEach(item => {
        item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.06)';
        item.onmouseleave = () => item.style.background = 'transparent';
        item.onclick = () => {
          modal.remove();
          this.navigate(item.getAttribute('data-hash'));
        };
      });
    };

    renderResults('');
    input.oninput = (e) => renderResults(e.target.value);
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  }

  closeModals() {
    document.querySelectorAll('.modal-backdrop, .code-editor-modal').forEach(m => m.remove());
  }

  // ======================== POWER ACTIONS ======================== //

  async triggerPowerAction(serverId, action) {
    this.playSound('power');
    this.showToast(`Server action "${action.toUpperCase()}" triggered`, 'info');
    try {
      await window.api.sendPowerAction(serverId, action);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ======================== WEBSOCKET HANDLERS ======================== //

  onServerStats(data) {
    // Update server instance in array
    const target = this.servers.find(s => s.id === data.serverId);
    if (target) {
      target.stats = data.stats;
      target.uptime = data.uptime;
    }

    // Update active console view if open
    if (this.activeServerId === data.serverId && this.activeTab === 'console') {
      const cpuNum = document.getElementById('stat-cpu-num');
      const memNum = document.getElementById('stat-mem-num');
      const diskNum = document.getElementById('stat-disk-num');
      const netNum = document.getElementById('stat-net-num');

      if (cpuNum) cpuNum.textContent = `${data.stats.cpu}%`;
      if (memNum) memNum.textContent = `${(data.stats.memory / 1024).toFixed(2)} GB`;
      if (diskNum) diskNum.textContent = `${(data.stats.disk / 1024).toFixed(2)} GB`;
      if (netNum) netNum.textContent = `${data.stats.netRx} KB/s`;

      if (this.charts.cpu) this.charts.cpu.push(data.stats.cpu);
      if (this.charts.mem) this.charts.mem.push(data.stats.memory);
      if (this.charts.disk) this.charts.disk.push(data.stats.disk);
      if (this.charts.net) this.charts.net.push(data.stats.netRx);

      const upTag = document.getElementById('hero-uptime-tag');
      if (upTag) upTag.innerHTML = `<i class="fa-regular fa-clock"></i> Uptime: ${this.formatUptime(data.uptime)}`;
    }

    // Update dashboard card if rendered
    const cardCpu = document.getElementById(`card-cpu-${data.serverId}`);
    const cardCpuBar = document.getElementById(`card-cpubar-${data.serverId}`);
    const cardMem = document.getElementById(`card-mem-${data.serverId}`);
    const cardMemBar = document.getElementById(`card-membar-${data.serverId}`);

    if (cardCpu && target) cardCpu.textContent = `${data.stats.cpu}% / ${target.limits.cpu}%`;
    if (cardCpuBar && target) cardCpuBar.style.width = `${Math.min(100, Math.round((data.stats.cpu / target.limits.cpu) * 100))}%`;
    if (cardMem && target) cardMem.textContent = `${data.stats.memory} MB / ${target.limits.memory} MB`;
    if (cardMemBar && target) cardMemBar.style.width = `${Math.min(100, Math.round((data.stats.memory / target.limits.memory) * 100))}%`;
  }

  onServerConsole(data) {
    if (this.activeServerId === data.serverId && this.terminal) {
      this.terminal.appendLine(data.line);
    }
  }

  onServerBacklog(data) {
    if (this.activeServerId === data.serverId && this.terminal) {
      this.terminal.clear();
      (data.logs || []).forEach(line => this.terminal.appendLine(line));
    }
  }

  onServerStatus(data) {
    const target = this.servers.find(s => s.id === data.serverId);
    if (target) target.status = data.status;

    if (this.activeServerId === data.serverId) {
      const heroBadge = document.getElementById('hero-status-badge');
      const heroText = document.getElementById('hero-status-text');
      if (heroBadge && heroText) {
        heroBadge.className = `status-badge ${data.status}`;
        heroText.textContent = data.status;
      }
    }

    // Update dashboard card if present
    const card = document.querySelector(`.server-card[data-id="${data.serverId}"] .status-badge`);
    if (card) {
      card.className = `status-badge ${data.status}`;
      card.querySelector('span').textContent = data.status;
    }
  }

  // ======================== UTILITIES ======================== //

  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'json':
      case 'yml':
      case 'yaml':
      case 'properties':
      case 'cfg':
      case 'conf':
      case 'env':
        return 'fa-file-lines config';
      case 'js':
      case 'ts':
      case 'py':
      case 'sh':
      case 'bat':
        return 'fa-file-code code';
      case 'jar':
      case 'zip':
      case 'tar':
      case 'gz':
        return 'fa-file-zipper archive';
      default:
        return 'fa-file code';
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatUptime(seconds = 0) {
    if (!seconds) return 'Offline';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

function pathJoin(base, sub) {
  let joined = `${base}/${sub}`.replace(/\/+/g, '/');
  if (!joined.startsWith('/')) joined = '/' + joined;
  return joined;
}

// Instantiate App
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SmoothHostApp();
});
