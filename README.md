# OllamaPulse Telemetry & Chat Dashboard

A real-time monitoring and chat dashboard for local LLM inference with [Ollama](https://ollama.com). OllamaPulse tracks total PC hardware utilization alongside exact per-process Ollama CPU, RAM, GPU compute, and VRAM consumption, logging token generation speeds (TPS) and inference metrics.

---

## Features

- **Real-Time Hardware Telemetry**: Live 1-second sampling of system CPU, RAM, GPU core utilization, temperature, power draw (watts), and VRAM.
- **Process-Level LLM Attribution**: Distinguishes overall system load from Ollama's specific CPU and VRAM usage.
- **VRAM Spill Detection**: Automatically detects when a model exceeds GPU VRAM and spills layers to system RAM (CPU offload), showing the exact spill amount and per-model GPU residency percentage.
- **Context Window Monitoring**: Displays the active context window size (in tokens) for each loaded model, pulled directly from Ollama's runtime state.
- **Reverse Proxy & Exact TPS Tracking**: Transparent reverse proxy on port `11435` intercepts `/api/generate` and `/api/chat` requests to capture exact token speeds (Tokens Per Second) and generation metrics.
- **Passive Spike Detection**: Automatically logs background inference sessions when interacting with Ollama directly (e.g., via CLI on port `11434`).
- **Interactive Chat Playground**: Built-in chat client with model picker, real-time token streaming, thinking process visualization (`<think>` blocks / reasoning models), and generation statistics.
- **Hardware Diagnostic Specialist Mode**: Toggleable system prompt injection that provides the model with live VRAM, spill status, context window, GPU core load, temperature, power, RAM, and historical TPS logs, turning the local model into an AI load & performance troubleshooting specialist.
- **Markdown (.md) Benchmark Report Export**: One-click download of comprehensive inference benchmark reports in formatted Markdown, containing hardware environments, executive summary metrics, per-model breakdowns, and detailed run logs. Also supports downloading individual run reports directly from the table.
- **History Management**: One-click "Clear History" button to purge previous inference runs from the SQLite database and UI in real time.
- **SQLite Historical Logging**: Persistent storage of inference history using SQLite (WAL mode).

---

## Architecture & Project Structure

The project is structured with separation of concerns between telemetry collection, database persistence, HTTP/WebSocket streaming, and UI components:

```
ollama-telemetry/
├── backend/
│   ├── src/
│   │   ├── config.ts            # Environment and server configuration
│   │   ├── types.ts             # TypeScript definitions for metrics and logs
│   │   ├── db.ts                # SQLite database schema and query helpers
│   │   ├── telemetry.ts         # Hardware stats (si & nvidia-smi) and Ollama status
│   │   ├── telemetryEngine.ts   # Real-time sampling loop and passive spike state
│   │   ├── ws.ts                # WebSocket server and live broadcasting
│   │   ├── routes.ts            # REST handlers and Ollama reverse proxy
│   │   └── server.ts            # Express server initialization and entry point
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    ├── src/
    │   ├── types.ts             # Frontend TypeScript models
    │   ├── components/
    │   │   ├── MetricCard.tsx      # Top summary metric cards
    │   │   ├── TelemetryCharts.tsx # Recharts real-time CPU & GPU area graphs
    │   │   ├── ChatPlayground.tsx  # Interactive chat and model selector
    │   │   ├── UsageLogTable.tsx   # LLM inference history table
    │   │   └── index.ts            # Component exports
    │   ├── App.tsx              # Main dashboard view
    │   └── main.tsx             # React entry point
    ├── package.json
    └── vite.config.ts
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Ollama](https://ollama.com/) running locally on `http://127.0.0.1:11434`
- (Optional) NVIDIA GPU with `nvidia-smi` accessible for GPU power and temperature tracking

---

### Installation

1. Clone or open the repository.
2. Install all dependencies from the project root:

```bash
npm run install:all
```
   This installs dependencies for the root, backend, and frontend in one step.

---

### Running the Application

**Single Command (Recommended)** — Start both the backend proxy and frontend dashboard together:

```bash
npm run dev
```
   - Backend reverse proxy starts on `http://localhost:11435`.
   - Frontend dashboard starts on `http://localhost:5173`.

**Individual Services** — If you only need one service:

```bash
npm run dev:backend    # Backend only
npm run dev:frontend   # Frontend only
```

---

## Usage

### 1. In-Dashboard Chat
Use the built-in chat window to select any installed model and start prompting. Responses will stream in real time, displaying performance metrics (TPS, token counts, duration) and logging the session into the history table.

### 2. External Clients & SDKs (Proxy Mode)
Point external applications, scripts, or Web UIs to the OllamaPulse proxy on port `11435` instead of Ollama's default `11434` to capture exact token metrics:

```powershell
Invoke-RestMethod -Uri "http://localhost:11435/api/generate" -Method Post -ContentType "application/json" -Body '{"model": "qwen3.5:4b", "prompt": "Hello world!", "stream": false}'
```

### 3. CLI / Native Usage (Passive Spike Mode)
Interactions directly with Ollama on port `11434` (such as `ollama run <model>`) are automatically detected via hardware spikes and logged with peak CPU, GPU, and VRAM utilization.

---

## Build

To compile both services for production:

```bash
npm run build
```

---

## Deployment

### Option 1: Production on a Local Server (Always-On Homelab)

Build the frontend once, then serve it statically while running the backend:

```bash
npm run build
npm start          # Starts the backend on port 11435
```

Point a reverse proxy (e.g., Nginx, Caddy) to:
- **Backend API**: `http://localhost:11435`
- **Frontend static files**: `frontend/dist/`

Example Nginx config snippet:

```nginx
server {
    listen 80;
    server_name ollama.yourdomain.com;

    # Serve the frontend
    location / {
        root /path/to/ollama-telemetry/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API and WebSocket traffic to the backend
    location /api/ {
        proxy_pass http://localhost:11435;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Option 2: Docker Deployment

Package both services in a single Docker Compose setup. Create `docker-compose.yml` at the project root:

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "11435:11435"
    environment:
      - OLLAMA_HOST=http://host.docker.internal:11434
    extra_hosts:
      - "host.docker.internal:host-gateway"

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

### Option 3: PM2 Process Manager (Linux / Always-On)

For a Linux homelab server, use PM2 to keep the backend running persistently:

```bash
npm install -g pm2
npm run build
pm2 start backend/dist/server.js --name ollama-telemetry
pm2 save
pm2 startup   # Auto-start on system boot
```

### Option 4: Cloud VPS Deployment

Deploy on any cloud provider (AWS EC2, DigitalOcean, Hetzner, etc.):

1. Install Node.js, Ollama, and NVIDIA drivers (if GPU-enabled).
2. Clone the repository and run `npm run install:all`.
3. Build and start with PM2 or systemd for persistence.
4. Use a domain name with SSL (via Let's Encrypt / Caddy) for remote access.

> **Note:** The frontend connects to the backend at `http://localhost:11435`. For remote deployments, update the backend URL in the frontend or use a reverse proxy so both services share the same domain.
