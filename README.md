# SMOOTH x HOST &bull; Enterprise Game Server Management Panel

A high-performance, modern Pterodactyl-inspired game and application server management panel engineered with a sleek cybernetic dark aesthetic, real-time WebSocket console streaming, dynamic canvas resource sparklines, in-browser code editor, and complete daemon simulation engine.

---

## ⚡ Features

### 1. Brand & Design
- **Branding**: **SMOOTH x HOST** Enterprise Panel
- **Aesthetic**: Pterodactyl dark palette (`#0a0d14`, `#0f1420`), cyan (`#00e5ff`) and violet neon accents, glassmorphic card containers, and smooth CSS micro-animations.
- **Typography**: Inter for UI controls and JetBrains Mono for monospace code & terminal output.
- **Audio Feedback**: Built-in sound effects via Web Audio API for mechanical button clicks, power actions, and toast alerts.

### 2. Live Cluster Dashboard
- **Resource Ribbon**: Live aggregate metrics for Active Instances, Memory Allocated, NVMe Storage, and Anycast Network Throughput across all connected Wings nodes.
- **Dynamic Search & Filters**: Instant fuzzy search across server names, IDs, and IP addresses. Quick filter pills (`All`, `Running`, `Offline`, `Minecraft`, `Node.js`, `Games`).
- **Server Cards**:
  - Live pulsing status dots (`Running`, `Starting`, `Stopping`, `Offline`).
  - Real-time animated CPU, Memory, and Disk usage meters.
  - 1-click IP and direct connect copy.
  - Hover power controls (▶ Start, 🔄 Restart, ⏹ Stop).
- **Deploy Server Wizard**: Interactive modal to deploy new game/app servers with custom egg templates, node assignment, and resource quotas.

### 3. Server Management Interface
- **Interactive Terminal / Console**:
  - Live ANSI color rendering (`[Wings Daemon]`, `[Server thread/INFO]`, `[WARN]`, `[ERROR]`).
  - Working command execution (e.g. `/help`, `/tps`, `/op <player>`, `/say <message>`, `/status`, `/whitelist on`).
  - Command history navigation with Up/Down arrow keys.
  - Quick command chips for 1-click execution.
  - Auto-scroll lock toggle, console clear, and `.log` file download.
- **Real-Time Canvas Charts**:
  - 4 real-time animated line charts: CPU load, Memory usage, Disk space, and Network I/O RX/TX.
- **File Manager**:
  - Full directory tree navigation with file type icons, sizes, modified dates, and permissions.
  - Integrated in-browser Code Editor with line numbers and instant save capability.
  - Create file, Create directory, and Delete file operations.
- **Databases**:
  - MySQL/MariaDB database provisioning with password reveal, direct credentials, and connection strings.
- **Schedules (Cron)**:
  - Task scheduler supporting cron expressions (e.g., daily restarts, automated backups).
- **Sub-Users**:
  - Teammate management with granular Pterodactyl permissions (control, console, files, backups).
- **Backups**:
  - Snapshot creation with SHA-256 integrity simulation, locking, download, and restore.
- **Network**:
  - IP and port allocation overview with direct connect copy.
- **Startup Parameters**:
  - Editable startup execution string with variable placeholders (`{{SERVER_MEMORY}}`, `{{SERVER_PORT}}`, `{{SERVER_JARFILE}}`).
  - Configurable egg environment variables.
- **Settings & Danger Zone**:
  - Server rename, SFTP credentials (Host, Port, Username), Reinstall server trigger, and Delete server.

### 4. Admin Control Center
- **Node Infrastructure**:
  - Real-time Wings node health for Virginia (US East), Frankfurt (EU Central), and Singapore (AP South).
  - Memory & Disk allocation commitment vs capacity.
  - "Create Node" wizard.
- **Nests & Eggs Catalog**:
  - Pre-configured game engines: Minecraft Paper 1.20, Node.js 20, Rust Dedicated, FiveM FXServer, and Python 3.11.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)

### Installation
Dependencies are already installed. If running on a new system:
```bash
npm install
```

### Starting the Panel
```bash
npm start
```
Or directly:
```bash
node server.js
```

The panel will be live at:
- **Web UI**: [http://localhost:3000](http://localhost:3000)
- **Live WebSocket**: `ws://localhost:3000/ws`

---

## 📁 Directory Structure
```
e:/PTRO PANEL/
├── package.json            # Scripts and dependencies
├── server.js               # Express + WebSocket backend & Wings simulation engine
├── README.md               # Documentation
├── data/                   # Persistent local storage
│   ├── config.json         # Panel settings
│   ├── nodes.json          # Node cluster definitions
│   ├── eggs.json           # Game templates & variables
│   ├── servers.json        # Server instances database
│   └── servers_files/      # Actual virtual file systems for each server
└── public/                 # Frontend SPA
    ├── index.html          # Panel application shell
    ├── css/
    │   ├── theme.css       # Design tokens, variables, glowing mesh
    │   └── main.css        # Layout, components, terminal, cards, modals
    └── js/
        ├── api.js          # REST & WebSocket client
        ├── charts.js       # Real-time HTML5 Canvas charts
        ├── terminal.js     # ANSI terminal engine & log formatter
        └── app.js          # SPA router, state manager, audio SFX, UI renderer
```
