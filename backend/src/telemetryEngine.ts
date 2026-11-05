import { collectTelemetryTick } from './telemetry.js';
import { saveUsageLog, getRecentLogs, hasRecentProxyLog } from './db.js';
import { broadcast } from './ws.js';
import { CONFIG } from './config.js';
import type { TelemetryTick } from './types.js';

let activeProxyRequests = 0;
let recentTicks: TelemetryTick[] = [];

// Track when a proxy request last ended per model to avoid duplicate passive_spike entries
const lastProxyEndByModel = new Map<string, number>();
const PASSIVE_SPIKE_GRACE_MS = 30000; // Suppress passive_spike for 30s after a proxy request ends

let passiveSession: {
    startTime: number;
    model: string;
    ticks: TelemetryTick[];
} | null = null;

export function getRecentTicks(): TelemetryTick[] {
    return recentTicks;
}

export function getActiveProxyRequests(): number {
    return activeProxyRequests;
}

export function incrementActiveProxyRequests() {
    activeProxyRequests++;
}

export function decrementActiveProxyRequests(model?: string) {
    activeProxyRequests = Math.max(0, activeProxyRequests - 1);
    if (model) {
        lastProxyEndByModel.set(model, Date.now());
    }
}

export function startTelemetryLoop(): NodeJS.Timeout {
    return setInterval(async () => {
        try {
            const tick = await collectTelemetryTick(activeProxyRequests);
            recentTicks.push(tick);
            if (recentTicks.length > CONFIG.MAX_RECENT_TICKS) {
                recentTicks.shift();
            }

            broadcast({ type: 'TELEMETRY_TICK', data: tick });

            if (activeProxyRequests === 0) {
                if (tick.ollama.isInferencing && !passiveSession) {
                    passiveSession = {
                        startTime: Date.now(),
                        model: tick.ollama.activeModels[0] || 'unknown-model',
                        ticks: [tick],
                    };
                } else if (tick.ollama.isInferencing && passiveSession) {
                    passiveSession.ticks.push(tick);
                } else if (!tick.ollama.isInferencing && passiveSession) {
                    const endTime = Date.now();
                    const durationMs = endTime - passiveSession.startTime;

                    // Skip passive_spike if a proxy request for this model just ended
                    const lastProxyEnd = lastProxyEndByModel.get(passiveSession.model) || 0;
                    const withinGracePeriod = (endTime - lastProxyEnd) < PASSIVE_SPIKE_GRACE_MS;
                    const hasProxyLog = hasRecentProxyLog(passiveSession.model, PASSIVE_SPIKE_GRACE_MS);

                    if (durationMs >= CONFIG.MIN_PASSIVE_SPIKE_MS && passiveSession.ticks.length > 0 && !withinGracePeriod && !hasProxyLog) {
                        const t = passiveSession.ticks;
                        const modelCtxWindow = t.find((x) => x.ollama.contextLength > 0)?.ollama.contextLength ?? null;
                        saveUsageLog({
                            model: passiveSession.model,
                            triggerType: 'passive_spike',
                            startTime: new Date(passiveSession.startTime).toISOString(),
                            endTime: new Date(endTime).toISOString(),
                            durationMs,
                            avgOllamaCpuPct: Number((t.reduce((s, x) => s + x.ollama.cpuPct, 0) / t.length).toFixed(1)),
                            peakOllamaCpuPct: Number(Math.max(...t.map((x) => x.ollama.cpuPct)).toFixed(1)),
                            peakVramMb: Math.max(...t.map((x) => x.ollama.vramUsedMb)),
                            avgGpuUtilPct: Number((t.reduce((s, x) => s + x.pc.gpuUtilPct, 0) / t.length).toFixed(1)),
                            peakGpuWatts: Number(Math.max(...t.map((x) => x.pc.gpuWatts)).toFixed(1)),
                            promptTokens: null,
                            evalTokens: null,
                            tokensPerSec: null,
                            contextLength: null,
                            modelContextWindow: modelCtxWindow,
                            vramSpillMb: Math.max(...t.map((x) => x.ollama.vramSpillMb)) || null,
                        });
                        broadcast({ type: 'LOGS_UPDATED', data: getRecentLogs() });
                    }
                    passiveSession = null;
                }
            }
        } catch (err) {
            console.error('Telemetry loop error:', err);
        }
    }, CONFIG.TICK_INTERVAL_MS);
}
