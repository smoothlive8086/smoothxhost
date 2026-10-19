const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SERVERS_DIR = path.join(DATA_DIR, 'servers_files');

// Ensure directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SERVERS_DIR)) fs.mkdirSync(SERVERS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Default Datasets
const DEFAULT_NODES = [
  {
    id: 'node-us-east',
    name: 'US-East-01 (Virginia Core)',
    location: 'North America / US East',
    fqdn: 'us-east-01.smoothhost.cloud',
    daemonPort: 8080,
    sftpPort: 2022,
    memoryTotal: 65536, // 64 GB
    memoryAllocated: 24576,
    diskTotal: 2048000, // 2 TB
    diskAllocated: 450000,
    status: 'online',
    ping: 18,
    wingsVersion: 'v1.11.12 (Wings Engine)'
  },
  {
    id: 'node-eu-central',
    name: 'EU-Central-01 (Frankfurt Edge)',
    location: 'Europe / Germany',
    fqdn: 'eu-central-01.smoothhost.cloud',
    daemonPort: 8080,
    sftpPort: 2022,
    memoryTotal: 131072, // 128 GB
    memoryAllocated: 49152,
    diskTotal: 4096000, // 4 TB
    diskAllocated: 1120000,
    status: 'online',
    ping: 28,
    wingsVersion: 'v1.11.12 (Wings Engine)'
  },
  {
    id: 'node-ap-south',
    name: 'AP-South-01 (Singapore Turbo)',
    location: 'Asia Pacific / Singapore',
    fqdn: 'ap-south-01.smoothhost.cloud',
    daemonPort: 8080,
    sftpPort: 2022,
    memoryTotal: 65536,
    memoryAllocated: 16384,
    diskTotal: 2048000,
    diskAllocated: 320000,
    status: 'online',
    ping: 52,
    wingsVersion: 'v1.11.12 (Wings Engine)'
  }
];

const DEFAULT_EGGS = [
  {
    id: 'minecraft-paper',
    nest: 'Minecraft',
    name: 'Paper 1.20.4 (High Performance)',
    author: 'support@smoothhost.cloud',
    dockerImage: 'ghcr.io/pterodactyl/yolks:java_17',
    startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}} nogui',
    icon: 'fa-cube',
    color: '#10b981',
    variables: [
      { name: 'SERVER_JARFILE', label: 'Server Jar File', defaultValue: 'paper.jar', description: 'The name of the executable jar' },
      { name: 'MINECRAFT_VERSION', label: 'Minecraft Version', defaultValue: '1.20.4', description: 'Target game version' },
      { name: 'BUILD_NUMBER', label: 'Paper Build', defaultValue: 'latest', description: 'Target build number or latest' }
    ]
  },
  {
    id: 'nodejs-app',
    nest: 'JavaScript',
    name: 'Node.js 20 (Discord Bot & APIs)',
    author: 'support@smoothhost.cloud',
    dockerImage: 'ghcr.io/pterodactyl/yolks:nodejs_20',
    startup: 'npm start',
    icon: 'fa-brands fa-node-js',
    color: '#22c55e',
    variables: [
      { name: 'MAIN_FILE', label: 'Entry Point', defaultValue: 'index.js', description: 'The script file to execute' },
      { name: 'NODE_ENV', label: 'Node Environment', defaultValue: 'production', description: 'Environment execution mode' }
    ]
  },
  {
    id: 'rust-dedicated',
    nest: 'Rust',
    name: 'Rust Dedicated Server',
    author: 'support@smoothhost.cloud',
    dockerImage: 'ghcr.io/pterodactyl/games:rust',
    startup: './RustDedicated -batchmode +server.port {{SERVER_PORT}} +server.identity "smooth_rust" +server.seed 1337',
    icon: 'fa-radiation',
    color: '#ef4444',
    variables: [
      { name: 'SERVER_HOSTNAME', label: 'Server Hostname', defaultValue: 'SMOOTH x HOST | 2x Vanilla Rust', description: 'Public server title' },
      { name: 'MAX_PLAYERS', label: 'Max Players', defaultValue: '150', description: 'Player slot limit' }
    ]
  },
  {
    id: 'fivem-server',
    nest: 'Grand Theft Auto',
    name: 'FiveM FXServer (Vanilla/QBCore)',
    author: 'support@smoothhost.cloud',
    dockerImage: 'ghcr.io/pterodactyl/games:fivem',
    startup: 'bash ./run.sh +exec server.cfg',
    icon: 'fa-car-side',
    color: '#f59e0b',
    variables: [
      { name: 'SV_LICENSEKEY', label: 'FiveM License Key', defaultValue: 'cfxk_smoothhost_demo_key', description: 'FiveM Keymaster License' },
      { name: 'SERVER_HOSTNAME', label: 'Server Name', defaultValue: 'SMOOTH x HOST FiveM Roleplay', description: 'Public server name' }
    ]
  },
  {
    id: 'python-app',
    nest: 'Python',
    name: 'Python 3.11 (AI & Web Workers)',
    author: 'support@smoothhost.cloud',
    dockerImage: 'ghcr.io/pterodactyl/yolks:python_3.11',
    startup: 'python3 -u {{MAIN_FILE}}',
    icon: 'fa-brands fa-python',
    color: '#3b82f6',
    variables: [
      { name: 'MAIN_FILE', label: 'Script File', defaultValue: 'main.py', description: 'Python script to run' }
    ]
  }
];

const DEFAULT_SERVERS = [
  {
    id: 's-9b4f21',
    uuid: '9b4f21e0-6391-4e78-98e6-e41712ba1192',
    name: 'SMP Survival Core (Paper 1.20)',
    description: 'High-performance Minecraft survival world with EssentialsX & CoreProtect',
    nodeId: 'node-us-east',
    eggId: 'minecraft-paper',
    status: 'running',
    uptime: 86420,
    allocation: { ip: '198.51.100.24', port: 25565, alias: 'play.smoothsurvival.net:25565' },
    limits: { memory: 4096, cpu: 200, disk: 15360, io: 500 },
    stats: { cpu: 32.4, memory: 2840, disk: 4210, netRx: 24.5, netTx: 58.2 },
    startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}} nogui',
    variables: { SERVER_JARFILE: 'paper.jar', MINECRAFT_VERSION: '1.20.4', BUILD_NUMBER: 'latest' },
    sftp: { host: 'us-east-01.smoothhost.cloud', port: 2022, username: 'smooth_s9b4f21' },
    databases: [
      { id: 'db-1', name: 's1_luckperms', host: '127.0.0.1:3306', user: 'u1_luckperms', pass: 'sm00th_MySQL_P@ss99', maxConnections: 50 }
    ],
    backups: [
      { id: 'bk-1', name: 'Automated Nightly Backup', size: '1.82 GB', createdAt: '2026-10-18T04:00:00Z', isLocked: true, status: 'completed' },
      { id: 'bk-2', name: 'Pre-Plugin Update Snapshot', size: '1.79 GB', createdAt: '2026-10-17T18:22:15Z', isLocked: false, status: 'completed' }
    ],
    schedules: [
      { id: 'sch-1', name: 'Daily 04:00 Restart', cron: '0 4 * * *', isActive: true, lastRun: 'Today at 04:00 AM', actions: ['send_command: say [Server] Scheduled restart in 60s', 'wait: 60', 'restart'] },
      { id: 'sch-2', name: 'Auto Backup Every 12h', cron: '0 */12 * * *', isActive: true, lastRun: 'Today at 12:00 PM', actions: ['create_backup'] }
    ],
    subusers: [
      { id: 'usr-1', email: 'moderator@smoothhost.net', role: 'Staff Member', permissions: ['control.start', 'control.restart', 'console.read', 'console.send', 'files.read'] }
    ]
  },
  {
    id: 's-6c1a89',
    uuid: '6c1a891f-0e42-4fbc-b531-bc6e52c8091a',
    name: 'Aether Bot (Discord.js v14)',
    description: 'Production Discord bot managing 40+ guilds with music and moderation',
    nodeId: 'node-eu-central',
    eggId: 'nodejs-app',
    status: 'running',
    uptime: 142100,
    allocation: { ip: '198.51.100.88', port: 8080, alias: 'bot.aethernet.cloud:8080' },
    limits: { memory: 1024, cpu: 100, disk: 5120, io: 500 },
    stats: { cpu: 8.7, memory: 412, disk: 620, netRx: 12.1, netTx: 19.8 },
    startup: 'npm start',
    variables: { MAIN_FILE: 'index.js', NODE_ENV: 'production' },
    sftp: { host: 'eu-central-01.smoothhost.cloud', port: 2022, username: 'smooth_s6c1a89' },
    databases: [
      { id: 'db-2', name: 's2_bot_data', host: '127.0.0.1:3306', user: 'u2_aetherbot', pass: 'bot_auth_token_secret', maxConnections: 20 }
    ],
    backups: [
      { id: 'bk-3', name: 'Weekly Bot State', size: '120 MB', createdAt: '2026-10-15T00:00:00Z', isLocked: true, status: 'completed' }
    ],
    schedules: [],
    subusers: []
  },
  {
    id: 's-4d8e33',
    uuid: '4d8e332c-7b19-482f-8cd0-aa1e912f91bb',
    name: 'Rust 2x Solo/Duo/Trio',
    description: 'Custom map high-action Rust server with weekly wipes',
    nodeId: 'node-eu-central',
    eggId: 'rust-dedicated',
    status: 'offline',
    uptime: 0,
    allocation: { ip: '198.51.100.91', port: 28015, alias: 'rust.smoothhost.net:28015' },
    limits: { memory: 8192, cpu: 300, disk: 30720, io: 500 },
    stats: { cpu: 0, memory: 0, disk: 8900, netRx: 0, netTx: 0 },
    startup: './RustDedicated -batchmode +server.port {{SERVER_PORT}} +server.identity "smooth_rust"',
    variables: { SERVER_HOSTNAME: 'SMOOTH x HOST | 2x Vanilla Rust', MAX_PLAYERS: '150' },
    sftp: { host: 'eu-central-01.smoothhost.cloud', port: 2022, username: 'smooth_s4d8e33' },
    databases: [],
    backups: [],
    schedules: [],
    subusers: []
  }
];

// Helper to read/write JSON files safely
function loadJSON(filename, defaultData) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
  }
  fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
  return defaultData;
}

function saveJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// In-memory runtime data with persistence
let nodes = loadJSON('nodes.json', DEFAULT_NODES);
let eggs = loadJSON('eggs.json', DEFAULT_EGGS);
let servers = loadJSON('servers.json', DEFAULT_SERVERS);

// Initialize server demo files if not present
function initializeServerFiles(serverId, eggId) {
  const sDir = path.join(SERVERS_DIR, serverId);
  if (fs.existsSync(sDir)) return;
  fs.mkdirSync(sDir, { recursive: true });

  if (eggId === 'minecraft-paper') {
    fs.mkdirSync(path.join(sDir, 'plugins'), { recursive: true });
    fs.mkdirSync(path.join(sDir, 'logs'), { recursive: true });
    fs.mkdirSync(path.join(sDir, 'world'), { recursive: true });

    fs.writeFileSync(path.join(sDir, 'eula.txt'), '# By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true\n');
    fs.writeFileSync(path.join(sDir, 'server.properties'), `# Minecraft server properties - SMOOTH x HOST
server-port=25565
motd=\\u00A7b\\u00A7lSMOOTH x HOST \\u00A77| \\u00A7aHigh Performance Paper Server
max-players=100
online-mode=true
difficulty=hard
gamemode=survival
pvp=true
view-distance=10
simulation-distance=8
enable-command-block=false
network-compression-threshold=256
spawn-protection=0
level-name=world
`);
    fs.writeFileSync(path.join(sDir, 'paper-global.yml'), `# SMOOTH x HOST Paper Global Optimization Config
proxies:
  velocity:
    enabled: false
    online-mode: false
timings:
  enabled: true
  verbose: false
`);
    fs.writeFileSync(path.join(sDir, 'ops.json'), '[\n  {\n    "uuid": "4566e5f4-c083-4a1f-84e3-d730a6921234",\n    "name": "SmoothAdmin",\n    "level": 4,\n    "bypassesPlayerLimit": true\n  }\n]');
    fs.writeFileSync(path.join(sDir, 'plugins', 'EssentialsX.jar'), '[Binary JAR file placeholder - EssentialsX v2.20.1]');
    fs.writeFileSync(path.join(sDir, 'plugins', 'LuckPerms.jar'), '[Binary JAR file placeholder - LuckPerms v5.4.102]');
    fs.writeFileSync(path.join(sDir, 'plugins', 'Vault.jar'), '[Binary JAR file placeholder - Vault v1.7.3]');
    fs.writeFileSync(path.join(sDir, 'logs', 'latest.log'), `[${new Date().toISOString()}] [Server thread/INFO]: Starting minecraft server version 1.20.4
[${new Date().toISOString()}] [Server thread/INFO]: Loading properties
[${new Date().toISOString()}] [Server thread/INFO]: Default game type: SURVIVAL
[${new Date().toISOString()}] [Server thread/INFO]: Generating keypair
[${new Date().toISOString()}] [Server thread/INFO]: Starting Minecraft server on *:25565
[${new Date().toISOString()}] [Server thread/INFO]: [EssentialsX] Enabling EssentialsX v2.20.1
[${new Date().toISOString()}] [Server thread/INFO]: [LuckPerms] Enabling LuckPerms v5.4.102
[${new Date().toISOString()}] [Server thread/INFO]: [LuckPerms] Connected to MySQL storage [s1_luckperms]
[${new Date().toISOString()}] [Server thread/INFO]: Preparing level "world"
[${new Date().toISOString()}] [Server thread/INFO]: Preparing start region for dimension minecraft:overworld
[${new Date().toISOString()}] [Server thread/INFO]: Time elapsed: 1420 ms
[${new Date().toISOString()}] [Server thread/INFO]: Done (2.891s)! For help, type "help"
`);
  } else if (eggId === 'nodejs-app') {
    fs.mkdirSync(path.join(sDir, 'commands'), { recursive: true });
    fs.writeFileSync(path.join(sDir, 'package.json'), JSON.stringify({
      name: "aether-bot",
      version: "2.4.0",
      description: "Discord Bot powered by SMOOTH x HOST",
      main: "index.js",
      scripts: {
        start: "node index.js"
      },
      dependencies: {
        "discord.js": "^14.14.1",
        "dotenv": "^16.4.5"
      }
    }, null, 2));

    fs.writeFileSync(path.join(sDir, 'index.js'), `// SMOOTH x HOST - Discord Bot Template
const { Client, GatewayIntentBits } = require('discord.js');
console.log('[SMOOTH x HOST] Starting Node.js Discord Client...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('ready', () => {
  console.log(\`[AetherBot] Logged in as \${client.user ? client.user.tag : 'Aether#9999'}!\`);
  console.log('[AetherBot] Monitoring 42 Discord servers and 15,200 members.');
});

client.on('messageCreate', msg => {
  if (msg.content === '!ping') {
    msg.reply('Pong! Latency: 18ms | Hosted on SMOOTH x HOST');
  }
});

console.log('[AetherBot] Ready and listening for socket events.');
setInterval(() => {
  // heartbeat
}, 60000);
`);
    fs.writeFileSync(path.join(sDir, '.env'), `DISCORD_TOKEN=MTE5OTk4ODg3NzY2NTU0NDMzMg.Gz...
CLIENT_ID=1199988877665544332
GUILD_ID=987654321012345678
PORT=8080
`);
  } else {
    // Default server files
    fs.writeFileSync(path.join(sDir, 'server.cfg'), `# Server configuration\nhostname "SMOOTH x HOST Server"\nmaxplayers 64\n`);
    fs.writeFileSync(path.join(sDir, 'readme.txt'), `Server initialized on SMOOTH x HOST.\nReady for deployment.\n`);
  }
}

// Initialize all default server directories
servers.forEach(s => initializeServerFiles(s.id, s.eggId));

// Real-Time Log Buffers per server
const serverLogs = {};
servers.forEach(s => {
  serverLogs[s.id] = [
    `\x1b[36m[Wings Daemon]\x1b[0m Container configuration validated. Starting Wings runtime for container [${s.uuid}]`,
    `\x1b[32m[SMOOTH x HOST]\x1b[0m Allocating port ${s.allocation.ip}:${s.allocation.port}`,
    `\x1b[33m[Environment]\x1b[0m Server Memory limit: ${s.limits.memory}MB | CPU limit: ${s.limits.cpu}%`,
    `\x1b[32m[System]\x1b[0m Server instance is currently \x1b[1m${s.status.toUpperCase()}\x1b[0m`
  ];
  if (s.status === 'running') {
    serverLogs[s.id].push(`\x1b[32m[Server thread/INFO]\x1b[0m Server is listening on port ${s.allocation.port}. Ready for incoming connections!`);
  }
});

// WebSocket Clients Management
const subscribers = new Map(); // ws -> Set(serverId)

wss.on('connection', (ws) => {
  subscribers.set(ws, new Set());

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'subscribe') {
        const subs = subscribers.get(ws);
        if (subs) {
          subs.add(data.serverId);
          // Send initial backlog
          const logs = serverLogs[data.serverId] || [];
          ws.send(JSON.stringify({
            type: 'log_backlog',
            serverId: data.serverId,
            logs
          }));
          const target = servers.find(s => s.id === data.serverId);
          if (target) {
            ws.send(JSON.stringify({
              type: 'status',
              serverId: target.id,
              status: target.status,
              uptime: target.uptime
            }));
            ws.send(JSON.stringify({
              type: 'stats',
              serverId: target.id,
              stats: target.stats
            }));
          }
        }
      } else if (data.type === 'unsubscribe') {
        const subs = subscribers.get(ws);
        if (subs) subs.delete(data.serverId);
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  });

  ws.on('close', () => {
    subscribers.delete(ws);
  });
});

// Broadcast helper
function broadcastToServer(serverId, payload) {
  const jsonStr = JSON.stringify(payload);
  for (const [ws, serverIds] of subscribers.entries()) {
    if (serverIds.has(serverId) && ws.readyState === WebSocket.OPEN) {
      ws.send(jsonStr);
    }
  }
}

function appendServerLog(serverId, line) {
  if (!serverLogs[serverId]) serverLogs[serverId] = [];
  serverLogs[serverId].push(line);
  if (serverLogs[serverId].length > 1000) serverLogs[serverId].shift();
  broadcastToServer(serverId, { type: 'console', serverId, line });
}

// Background Simulation Engine (Wings Daemon Simulation)
setInterval(() => {
  servers.forEach(srv => {
    if (srv.status === 'running') {
      srv.uptime = (srv.uptime || 0) + 1;
      
      // Realistically fluctuate CPU & RAM
      const cpuBase = srv.limits.cpu * 0.15;
      const cpuJitter = (Math.random() - 0.5) * 8;
      srv.stats.cpu = Math.max(1.2, Math.min(srv.limits.cpu, +(cpuBase + cpuJitter).toFixed(1)));

      const ramBase = srv.limits.memory * 0.65;
      const ramJitter = (Math.random() - 0.5) * 45;
      srv.stats.memory = Math.max(128, Math.min(srv.limits.memory - 100, Math.round(ramBase + ramJitter)));

      srv.stats.netRx = +(srv.stats.netRx + (Math.random() * 2.5)).toFixed(1);
      srv.stats.netTx = +(srv.stats.netTx + (Math.random() * 5.2)).toFixed(1);

      broadcastToServer(srv.id, {
        type: 'stats',
        serverId: srv.id,
        stats: srv.stats,
        uptime: srv.uptime
      });

      // Occasional realistic game logs
      if (Math.random() < 0.08) {
        if (srv.eggId === 'minecraft-paper') {
          const samplePlayers = ['Steve', 'Alex', 'Notch', 'Herobrine', 'ShadowRider', 'PixelKnight'];
          const p = samplePlayers[Math.floor(Math.random() * samplePlayers.length)];
          const events = [
            `[${new Date().toLocaleTimeString()}] [Server thread/INFO]: ${p} issued server command: /tps`,
            `[${new Date().toLocaleTimeString()}] [Server thread/INFO]: [Paper] TPS from last 1m, 5m, 15m: 20.0, 20.0, 19.98`,
            `[${new Date().toLocaleTimeString()}] [Server thread/INFO]: Saving chunks for level 'ServerLevel[world]'...`,
            `[${new Date().toLocaleTimeString()}] [Server thread/INFO]: Autosave completed (0.012s). World state saved to disk.`
          ];
          appendServerLog(srv.id, events[Math.floor(Math.random() * events.length)]);
        } else if (srv.eggId === 'nodejs-app') {
          const events = [
            `[${new Date().toLocaleTimeString()}] [Discord Gateway] Heartbeat acknowledged (latency: 18ms)`,
            `[${new Date().toLocaleTimeString()}] [Router] GET /api/v1/health 200 OK - 2.14ms`,
            `[${new Date().toLocaleTimeString()}] [CacheManager] Flushed 14 expired guild cache keys.`
          ];
          appendServerLog(srv.id, events[Math.floor(Math.random() * events.length)]);
        }
      }
    }
  });
}, 1000);

// ======================== REST API ROUTES ======================== //

// System Overview
app.get('/api/system', (req, res) => {
  const totalServers = servers.length;
  const runningServers = servers.filter(s => s.status === 'running').length;
  const totalMem = servers.reduce((acc, s) => acc + s.limits.memory, 0);
  const usedMem = servers.reduce((acc, s) => acc + (s.status === 'running' ? s.stats.memory : 0), 0);
  const totalDisk = servers.reduce((acc, s) => acc + s.limits.disk, 0);

  res.json({
    brand: 'SMOOTH x HOST',
    version: '2.4.0 (Enterprise)',
    wingsVersion: 'v1.11.12',
    uptime: process.uptime(),
    stats: {
      totalServers,
      runningServers,
      totalMem,
      usedMem,
      totalDisk,
      nodesCount: nodes.length
    }
  });
});

// Nodes
app.get('/api/nodes', (req, res) => {
  res.json(nodes);
});

app.post('/api/nodes', (req, res) => {
  const { name, location, fqdn, memoryTotal, diskTotal } = req.body;
  if (!name || !fqdn) {
    return res.status(400).json({ error: 'Name and FQDN are required.' });
  }
  const newNode = {
    id: `node-${Date.now().toString(36)}`,
    name,
    location: location || 'Global Cloud',
    fqdn,
    daemonPort: 8080,
    sftpPort: 2022,
    memoryTotal: Number(memoryTotal) || 32768,
    memoryAllocated: 0,
    diskTotal: Number(diskTotal) || 1024000,
    diskAllocated: 0,
    status: 'online',
    ping: Math.floor(Math.random() * 30) + 15,
    wingsVersion: 'v1.11.12 (Wings Engine)'
  };
  nodes.push(newNode);
  saveJSON('nodes.json', nodes);
  res.json(newNode);
});

// Eggs & Nests
app.get('/api/eggs', (req, res) => {
  res.json(eggs);
});

// Servers List
app.get('/api/servers', (req, res) => {
  res.json(servers);
});

// Single Server
app.get('/api/servers/:id', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(server);
});

// Create Server
app.post('/api/servers', (req, res) => {
  const { name, description, nodeId, eggId, memory, cpu, disk } = req.body;
  if (!name || !nodeId || !eggId) {
    return res.status(400).json({ error: 'Server name, Node, and Egg are required' });
  }

  const selectedNode = nodes.find(n => n.id === nodeId) || nodes[0];
  const selectedEgg = eggs.find(e => e.id === eggId) || eggs[0];
  const randomHex = Math.random().toString(16).substring(2, 8);
  const id = `s-${randomHex}`;
  const uuid = `${randomHex}e0-4a8b-49fc-912a-${Date.now().toString(16).substring(4)}`;
  const port = Math.floor(Math.random() * 20000) + 20000;

  const newServer = {
    id,
    uuid,
    name,
    description: description || `Deployed via SMOOTH x HOST Quick Deploy`,
    nodeId: selectedNode.id,
    eggId: selectedEgg.id,
    status: 'offline',
    uptime: 0,
    allocation: {
      ip: selectedNode.fqdn.replace(/^[a-z0-9-]+\./, '198.51.'),
      port,
      alias: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.smoothhost.net:${port}`
    },
    limits: {
      memory: Number(memory) || 2048,
      cpu: Number(cpu) || 100,
      disk: Number(disk) || 10240,
      io: 500
    },
    stats: { cpu: 0, memory: 0, disk: 120, netRx: 0, netTx: 0 },
    startup: selectedEgg.startup,
    variables: selectedEgg.variables.reduce((acc, v) => {
      acc[v.name] = v.defaultValue;
      return acc;
    }, {}),
    sftp: {
      host: selectedNode.fqdn,
      port: 2022,
      username: `smooth_${id}`
    },
    databases: [],
    backups: [],
    schedules: [],
    subusers: []
  };

  servers.push(newServer);
  saveJSON('servers.json', servers);
  initializeServerFiles(newServer.id, newServer.eggId);

  serverLogs[newServer.id] = [
    `\x1b[36m[Wings Daemon]\x1b[0m Provisioning container [${uuid}] on node ${selectedNode.name}`,
    `\x1b[32m[SMOOTH x HOST]\x1b[0m Created file tree for ${selectedEgg.name}`,
    `\x1b[33m[Installer]\x1b[0m Environment configured with ${newServer.limits.memory}MB RAM / ${newServer.limits.cpu}% CPU`,
    `\x1b[32m[SMOOTH x HOST]\x1b[0m Server ready for initial boot!`
  ];

  res.status(201).json(newServer);
});

// Delete Server
app.delete('/api/servers/:id', (req, res) => {
  const index = servers.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Server not found' });
  const [removed] = servers.splice(index, 1);
  saveJSON('servers.json', servers);

  // remove server files safely
  const sDir = path.join(SERVERS_DIR, removed.id);
  if (fs.existsSync(sDir)) {
    fs.rmSync(sDir, { recursive: true, force: true });
  }
  delete serverLogs[removed.id];

  res.json({ success: true, message: 'Server deleted successfully' });
});

// Server Power Actions (start, restart, stop, kill)
app.post('/api/servers/:id/power', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const { action } = req.body;

  if (action === 'start') {
    if (server.status === 'running') {
      return res.status(400).json({ error: 'Server is already running' });
    }
    server.status = 'starting';
    broadcastToServer(server.id, { type: 'status', serverId: server.id, status: 'starting' });
    appendServerLog(server.id, `\x1b[36m[Wings Daemon]\x1b[0m Connecting to container [${server.uuid}]...`);
    appendServerLog(server.id, `\x1b[33m[Wings Daemon]\x1b[0m Running boot command: ${server.startup.replace('{{SERVER_MEMORY}}', server.limits.memory)}`);

    setTimeout(() => {
      if (server.eggId === 'minecraft-paper') {
        appendServerLog(server.id, `[Server thread/INFO]: Starting minecraft server version 1.20.4`);
        appendServerLog(server.id, `[Server thread/INFO]: Loading plugins and world chunks...`);
        appendServerLog(server.id, `[Server thread/INFO]: Done! Server listening on port ${server.allocation.port}`);
      } else if (server.eggId === 'nodejs-app') {
        appendServerLog(server.id, `> node index.js`);
        appendServerLog(server.id, `[Node.js Engine] Connected to runtime!`);
        appendServerLog(server.id, `[App] Service operational on port ${server.allocation.port}`);
      } else {
        appendServerLog(server.id, `[Service] Dedicated server initialized on port ${server.allocation.port}`);
      }

      server.status = 'running';
      server.uptime = 1;
      saveJSON('servers.json', servers);
      broadcastToServer(server.id, { type: 'status', serverId: server.id, status: 'running' });
    }, 1500);

    return res.json({ success: true, status: 'starting' });
  }

  if (action === 'stop') {
    if (server.status === 'offline') {
      return res.status(400).json({ error: 'Server is already offline' });
    }
    server.status = 'stopping';
    broadcastToServer(server.id, { type: 'status', serverId: server.id, status: 'stopping' });
    appendServerLog(server.id, `\x1b[31m[Wings Daemon]\x1b[0m Sending SIGTERM to process group...`);
    appendServerLog(server.id, `[Server thread/INFO]: Stopping server. Saving players and worlds...`);

    setTimeout(() => {
      server.status = 'offline';
      server.uptime = 0;
      server.stats.cpu = 0;
      server.stats.memory = 0;
      saveJSON('servers.json', servers);
      appendServerLog(server.id, `\x1b[32m[Wings Daemon]\x1b[0m Container stopped cleanly. Code 0`);
      broadcastToServer(server.id, { type: 'status', serverId: server.id, status: 'offline' });
    }, 1200);

    return res.json({ success: true, status: 'stopping' });
  }

  if (action === 'restart') {
    server.status = 'stopping';
    broadcastToServer(server.id, { type: 'status', serverId: server.id, status: 'stopping' });
    appendServerLog(server.id, `\x1b[33m[Wings Daemon]\x1b[0m Restart initiated by user...`);

    setTimeout(() => {
      server.status = 'starting';
      broadcastToServer(server.id, { type: 'status', serverId: server.id, status: 'starting' });
      appendServerLog(server.id, `\x1b[36m[Wings Daemon]\x1b[0m Starting clean container instance...`);
      setTimeout(() => {
        server.status = 'running';
        server.uptime = 1;
        saveJSON('servers.json', servers);
        appendServerLog(server.id, `\x1b[32m[Wings Daemon]\x1b[0m Server successfully restarted and operational.`);
        broadcastToServer(server.id, { type: 'status', serverId: server.id, status: 'running' });
      }, 1500);
    }, 1000);

    return res.json({ success: true, status: 'restarting' });
  }

  if (action === 'kill') {
    server.status = 'offline';
    server.uptime = 0;
    server.stats.cpu = 0;
    server.stats.memory = 0;
    saveJSON('servers.json', servers);
    appendServerLog(server.id, `\x1b[1;31m[Wings Daemon]\x1b[0m SENT SIGKILL (-9)! Immediate process termination.`);
    broadcastToServer(server.id, { type: 'status', serverId: server.id, status: 'offline' });
    return res.json({ success: true, status: 'offline' });
  }

  res.status(400).json({ error: 'Invalid power action' });
});

// Console Command Execution
app.post('/api/servers/:id/command', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const { command } = req.body;
  if (!command || !command.trim()) return res.status(400).json({ error: 'Empty command' });

  const cleanCmd = command.trim();
  appendServerLog(server.id, `\x1b[37;1m> ${cleanCmd}\x1b[0m`);

  if (server.status !== 'running') {
    appendServerLog(server.id, `\x1b[31m[Wings Daemon] Cannot send command: Server container is not running.\x1b[0m`);
    return res.json({ success: false, message: 'Server is not running' });
  }

  // Handle game command responses
  setTimeout(() => {
    const cmdLower = cleanCmd.toLowerCase();
    if (cmdLower === 'help') {
      appendServerLog(server.id, `[Server thread/INFO]: Available commands: /help, /tps, /op <player>, /say <msg>, /whitelist <on|off|add>, /stop, /reload, /status`);
    } else if (cmdLower === 'tps') {
      appendServerLog(server.id, `[Server thread/INFO]: TPS from last 1m, 5m, 15m: 20.0, 19.98, 20.0`);
    } else if (cmdLower.startsWith('op ')) {
      const target = cleanCmd.substring(3).trim();
      appendServerLog(server.id, `[Server thread/INFO]: Made ${target} a server operator`);
    } else if (cmdLower.startsWith('say ')) {
      const msg = cleanCmd.substring(4).trim();
      appendServerLog(server.id, `[Server thread/INFO]: [Server] ${msg}`);
    } else if (cmdLower === 'whitelist on') {
      appendServerLog(server.id, `[Server thread/INFO]: Whitelist is now turned on`);
    } else if (cmdLower === 'status') {
      appendServerLog(server.id, `[Server thread/INFO]: Memory: ${server.stats.memory}MB / ${server.limits.memory}MB | CPU: ${server.stats.cpu}% | Uptime: ${server.uptime}s`);
    } else {
      appendServerLog(server.id, `[Server thread/INFO]: Executed command: "${cleanCmd}"`);
    }
  }, 100);

  res.json({ success: true });
});

// File Manager: List Files
app.get('/api/servers/:id/files', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  
  const relPath = req.query.path || '/';
  const targetDir = path.join(SERVERS_DIR, server.id, relPath);

  // Security check
  if (!targetDir.startsWith(path.join(SERVERS_DIR, server.id))) {
    return res.status(403).json({ error: 'Access denied: Directory traversal detected' });
  }

  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: 'Directory does not exist' });
  }

  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = entries.map(entry => {
      const fullPath = path.join(targetDir, entry.name);
      let stat = {};
      try { stat = fs.statSync(fullPath); } catch (e) {}
      return {
        name: entry.name,
        isDirectory: entry.isDirectory(),
        size: stat.size || 0,
        modified: stat.mtime || new Date(),
        mode: stat.mode ? (stat.mode & parseInt('777', 8)).toString(8) : '644'
      };
    });

    // Sort folders first, then alphabetical
    files.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });

    res.json({ currentPath: relPath, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// File Manager: Get File Content
app.get('/api/servers/:id/files/content', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });

  const targetFile = path.join(SERVERS_DIR, server.id, filePath);
  if (!targetFile.startsWith(path.join(SERVERS_DIR, server.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!fs.existsSync(targetFile)) return res.status(404).json({ error: 'File not found' });

  try {
    const stat = fs.statSync(targetFile);
    if (stat.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File is too large to open in web editor (>5MB)' });
    }
    const content = fs.readFileSync(targetFile, 'utf-8');
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// File Manager: Save File Content
app.post('/api/servers/:id/files/content', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'File path required' });

  const targetFile = path.join(SERVERS_DIR, server.id, filePath);
  if (!targetFile.startsWith(path.join(SERVERS_DIR, server.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetFile, content || '', 'utf-8');
    appendServerLog(server.id, `\x1b[34m[File Manager]\x1b[0m Saved file: ${filePath}`);
    res.json({ success: true, message: 'File saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// File Manager: Create File or Directory
app.post('/api/servers/:id/files/create', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { path: relPath, name, isDirectory } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const targetPath = path.join(SERVERS_DIR, server.id, relPath || '', name);
  if (!targetPath.startsWith(path.join(SERVERS_DIR, server.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    if (isDirectory) {
      fs.mkdirSync(targetPath, { recursive: true });
    } else {
      fs.writeFileSync(targetPath, '', 'utf-8');
    }
    appendServerLog(server.id, `\x1b[34m[File Manager]\x1b[0m Created ${isDirectory ? 'directory' : 'file'}: ${name}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// File Manager: Delete File or Directory
app.delete('/api/servers/:id/files', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });

  const targetPath = path.join(SERVERS_DIR, server.id, filePath);
  if (!targetPath.startsWith(path.join(SERVERS_DIR, server.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      appendServerLog(server.id, `\x1b[34m[File Manager]\x1b[0m Deleted: ${filePath}`);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Databases API
app.get('/api/servers/:id/databases', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(server.databases || []);
});

app.post('/api/servers/:id/databases', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Database name required' });

  const dbId = `db-${Date.now().toString(36)}`;
  const cleanDbName = `s${server.id.replace('s-', '')}_${name.replace(/[^a-z0-9_]/gi, '')}`;
  const newDb = {
    id: dbId,
    name: cleanDbName,
    host: '127.0.0.1:3306',
    user: `u_${cleanDbName.substring(0, 12)}`,
    pass: `SmoothPass_${Math.random().toString(36).substring(2, 10)}!`,
    maxConnections: 50
  };

  server.databases = server.databases || [];
  server.databases.push(newDb);
  saveJSON('servers.json', servers);
  res.status(201).json(newDb);
});

app.delete('/api/servers/:id/databases/:dbId', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  server.databases = (server.databases || []).filter(d => d.id !== req.params.dbId);
  saveJSON('servers.json', servers);
  res.json({ success: true });
});

// Backups API
app.get('/api/servers/:id/backups', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(server.backups || []);
});

app.post('/api/servers/:id/backups', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const { name, isLocked } = req.body;

  const backupId = `bk-${Date.now().toString(36)}`;
  const newBackup = {
    id: backupId,
    name: name || `Backup-${new Date().toLocaleDateString()}`,
    size: `${(Math.random() * 2 + 0.8).toFixed(2)} GB`,
    createdAt: new Date().toISOString(),
    isLocked: !!isLocked,
    status: 'completed'
  };

  server.backups = server.backups || [];
  server.backups.unshift(newBackup);
  saveJSON('servers.json', servers);
  appendServerLog(server.id, `\x1b[35m[Backup Manager]\x1b[0m Created snapshot: ${newBackup.name}`);
  res.status(201).json(newBackup);
});

app.delete('/api/servers/:id/backups/:backupId', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  server.backups = (server.backups || []).filter(b => b.id !== req.params.backupId);
  saveJSON('servers.json', servers);
  res.json({ success: true });
});

// Schedules API
app.get('/api/servers/:id/schedules', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(server.schedules || []);
});

app.post('/api/servers/:id/schedules', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const { name, cron } = req.body;
  if (!name || !cron) return res.status(400).json({ error: 'Name and cron required' });

  const sched = {
    id: `sch-${Date.now().toString(36)}`,
    name,
    cron,
    isActive: true,
    lastRun: 'Never',
    actions: ['restart']
  };

  server.schedules = server.schedules || [];
  server.schedules.push(sched);
  saveJSON('servers.json', servers);
  res.status(201).json(sched);
});

app.delete('/api/servers/:id/schedules/:schedId', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  server.schedules = (server.schedules || []).filter(s => s.id !== req.params.schedId);
  saveJSON('servers.json', servers);
  res.json({ success: true });
});

// Subusers API
app.get('/api/servers/:id/users', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(server.subusers || []);
});

app.post('/api/servers/:id/users', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  const { email, permissions } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const subuser = {
    id: `usr-${Date.now().toString(36)}`,
    email,
    role: 'Co-Owner',
    permissions: permissions || ['control.start', 'control.restart', 'console.read']
  };

  server.subusers = server.subusers || [];
  server.subusers.push(subuser);
  saveJSON('servers.json', servers);
  res.status(201).json(subuser);
});

app.delete('/api/servers/:id/users/:userId', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  server.subusers = (server.subusers || []).filter(u => u.id !== req.params.userId);
  saveJSON('servers.json', servers);
  res.json({ success: true });
});

// Update Server Settings & Variables
app.post('/api/servers/:id/settings', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  const { name, description, startup, variables } = req.body;
  if (name) server.name = name;
  if (description !== undefined) server.description = description;
  if (startup) server.startup = startup;
  if (variables) server.variables = { ...server.variables, ...variables };

  saveJSON('servers.json', servers);
  appendServerLog(server.id, `\x1b[33m[Settings]\x1b[0m Server settings and environment variables updated.`);
  res.json(server);
});

// Reinstall Server
app.post('/api/servers/:id/reinstall', (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  server.status = 'offline';
  server.uptime = 0;
  
  // Clean files and reinitialize
  const sDir = path.join(SERVERS_DIR, server.id);
  if (fs.existsSync(sDir)) {
    fs.rmSync(sDir, { recursive: true, force: true });
  }
  initializeServerFiles(server.id, server.eggId);

  appendServerLog(server.id, `\x1b[1;31m[Installer]\x1b[0m REINSTALL INITIATED. Files reset to default egg template.`);
  broadcastToServer(server.id, { type: 'status', serverId: server.id, status: 'offline' });
  saveJSON('servers.json', servers);

  res.json({ success: true, message: 'Server reinstalled successfully' });
});

// Wildcard fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`   🚀 SMOOTH x HOST - PTERODACTYL STYLE PANEL       `);
  console.log(`   Running on http://localhost:${PORT}             `);
  console.log(`   WebSocket live on ws://localhost:${PORT}/ws      `);
  console.log(`====================================================`);
});
