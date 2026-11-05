import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { CONFIG } from './config.js';
import { initWebSocketServer } from './ws.js';
import { startTelemetryLoop } from './telemetryEngine.js';
import { handleGetLogs, handleClearLogs, handleGetTags, handleProxyRequest } from './routes.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const server = createServer(app);
initWebSocketServer(server);
startTelemetryLoop();

// REST Endpoints
app.get('/api/telemetry/logs', handleGetLogs);
app.delete('/api/telemetry/logs', handleClearLogs);
app.get('/api/tags', handleGetTags);

// Ollama Reverse Proxy
app.post(['/api/generate', '/api/chat'], handleProxyRequest);

server.listen(CONFIG.PORT, () => {
    console.log(`🚀 Ollama Telemetry Backend & Proxy running on http://localhost:${CONFIG.PORT}`);
});