import type { Request, Response } from 'express';
import { CONFIG } from './config.js';
import { saveUsageLog, getRecentLogs, clearAllLogs } from './db.js';
import { broadcast } from './ws.js';
import { getRecentTicks, getActiveProxyRequests, incrementActiveProxyRequests, decrementActiveProxyRequests } from './telemetryEngine.js';

export async function handleGetLogs(_req: Request, res: Response) {
    res.json(getRecentLogs());
}

export async function handleClearLogs(_req: Request, res: Response) {
    try {
        clearAllLogs();
        broadcast({ type: 'LOGS_UPDATED', data: [] });
        res.json({ success: true, message: 'All inference logs cleared' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear logs' });
    }
}

export async function handleGetTags(_req: Request, res: Response) {
    try {
        const upstream = await fetch(`${CONFIG.OLLAMA_HOST}/api/tags`);
        const data = await upstream.json();
        res.status(upstream.status).json(data);
    } catch {
        res.status(502).json({ error: 'Failed to reach Ollama on 11434' });
    }
}

export async function handleProxyRequest(req: Request, res: Response) {
    const startTime = Date.now();
    const model = req.body?.model || 'unknown';
    incrementActiveProxyRequests();

    try {
        const upstreamRes = await fetch(`${CONFIG.OLLAMA_HOST}${req.path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
        });

        res.status(upstreamRes.status);
        upstreamRes.headers.forEach((val, key) => res.setHeader(key, val));

        let promptEvalCount = 0;
        let evalCount = 0;
        let evalDurationNs = 0;
        const decoder = new TextDecoder();

        if (upstreamRes.body) {
            for await (const chunk of upstreamRes.body as any) {
                res.write(chunk);
                const text = decoder.decode(chunk, { stream: true });
                for (const line of text.split('\n')) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.done) {
                            promptEvalCount = parsed.prompt_eval_count || 0;
                            evalCount = parsed.eval_count || 0;
                            evalDurationNs = parsed.eval_duration || 0;
                        }
                    } catch {
                        // Partial JSON chunk
                    }
                }
            }
        }
        res.end();

        const endTime = Date.now();
        const recentTicks = getRecentTicks();
        const sessionTicks = recentTicks.filter((t) => t.timestamp >= startTime && t.timestamp <= endTime);
        const ticksToUse = sessionTicks.length > 0 ? sessionTicks : recentTicks.slice(-1);

        const tps = evalDurationNs > 0 ? Number((evalCount / (evalDurationNs / 1e9)).toFixed(2)) : null;

        // Get model context window from telemetry ticks
        const modelCtxWindow = ticksToUse.find((t) => t.ollama.contextLength > 0)?.ollama.contextLength ?? null;

        saveUsageLog({
            model,
            triggerType: 'proxy',
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            durationMs: endTime - startTime,
            avgOllamaCpuPct: Number(
                (ticksToUse.reduce((s, x) => s + x.ollama.cpuPct, 0) / (ticksToUse.length || 1)).toFixed(1)
            ),
            peakOllamaCpuPct: Number(Math.max(0, ...ticksToUse.map((x) => x.ollama.cpuPct)).toFixed(1)),
            peakVramMb: Math.max(0, ...ticksToUse.map((x) => x.ollama.vramUsedMb)),
            avgGpuUtilPct: Number(
                (ticksToUse.reduce((s, x) => s + x.pc.gpuUtilPct, 0) / (ticksToUse.length || 1)).toFixed(1)
            ),
            peakGpuWatts: Number(Math.max(0, ...ticksToUse.map((x) => x.pc.gpuWatts)).toFixed(1)),
            promptTokens: promptEvalCount || null,
            evalTokens: evalCount || null,
            tokensPerSec: tps,
            contextLength: (promptEvalCount + evalCount) || null,
            modelContextWindow: modelCtxWindow,
            vramSpillMb: Math.max(0, ...ticksToUse.map((t) => t.ollama.vramSpillMb)) || null,
        });

        broadcast({ type: 'LOGS_UPDATED', data: getRecentLogs() });
    } catch (err) {
        console.error('Proxy error:', err);
        if (!res.headersSent) res.status(502).json({ error: 'Failed to reach Ollama on 11434' });
    } finally {
        decrementActiveProxyRequests(model);
    }
}
