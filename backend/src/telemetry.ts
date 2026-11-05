import si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CONFIG } from './config.js';
import type { TelemetryTick, OllamaModelInfo } from './types.js';

const execAsync = promisify(exec);

async function getNvidiaGpuStats() {
    try {
        const { stdout } = await execAsync(
            'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits'
        );
        const parts = stdout.trim().split(',').map((s) => parseFloat(s.trim()));
        const p0 = parts[0];
        const p1 = parts[1];
        const p2 = parts[2];
        const p3 = parts[3];
        const p4 = parts[4];
        if (parts.length >= 5 && p0 !== undefined && !isNaN(p0)) {
            return {
                gpuUtilPct: p0,
                gpuVramUsedMb: p1 ?? 0,
                gpuVramTotalMb: p2 ?? 0,
                gpuTempC: p3 ?? 0,
                gpuWatts: p4 ?? 0,
            };
        }
    } catch {
        // Fallback to systeminformation when nvidia-smi is unavailable
    }

    const gfx = await si.graphics();
    const mainGpu = gfx.controllers[0];
    return {
        gpuUtilPct: mainGpu?.utilizationGpu ?? 0,
        gpuVramUsedMb: mainGpu?.memoryUsed ?? 0,
        gpuVramTotalMb: mainGpu?.memoryTotal ?? 0,
        gpuTempC: mainGpu?.temperatureGpu ?? 0,
        gpuWatts: mainGpu?.powerDraw ?? 0,
    };
}

async function getOllamaPs() {
    try {
        const res = await fetch(`${CONFIG.OLLAMA_HOST}/api/ps`);
        if (!res.ok) return { activeModels: [], vramUsedMb: 0, modelsInfo: [], vramSpillMb: 0, contextLength: 0 };
        const data = (await res.json()) as {
            models?: Array<{
                name: string;
                size: number;
                size_vram: number;
                context_length: number;
            }>;
        };
        const models = data.models || [];
        const activeModels = models.map((m) => m.name);
        const vramUsedMb = models.reduce((acc, m) => acc + (m.size_vram || 0), 0) / (1024 * 1024);

        const modelsInfo: OllamaModelInfo[] = models.map((m) => {
            const sizeTotal = m.size || 0;
            const sizeVram = m.size_vram || 0;
            return {
                name: m.name,
                contextLength: m.context_length || 0,
                sizeVram,
                sizeTotal,
                isFullyOnGpu: sizeVram >= sizeTotal,
            };
        });

        const vramSpillMb = models.reduce((acc, m) => {
            const spilled = Math.max(0, (m.size || 0) - (m.size_vram || 0));
            return acc + spilled;
        }, 0) / (1024 * 1024);

        const contextLength = models.reduce((acc, m) => acc + (m.context_length || 0), 0);

        return {
            activeModels,
            vramUsedMb: Math.round(vramUsedMb),
            modelsInfo,
            vramSpillMb: Math.round(vramSpillMb),
            contextLength,
        };
    } catch {
        return { activeModels: [], vramUsedMb: 0, modelsInfo: [], vramSpillMb: 0, contextLength: 0 };
    }
}

export async function collectTelemetryTick(activeProxyRequests: number): Promise<TelemetryTick> {
    const [cpuLoad, mem, procs, gpuStats, ollamaPs] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.processes(),
        getNvidiaGpuStats(),
        getOllamaPs(),
    ]);

    const ollamaProcs = procs.list.filter((p) =>
        p.name.toLowerCase().includes('ollama') ||
        p.command.toLowerCase().includes('ollama')
    );

    const ollamaCpuPct = ollamaProcs.reduce((sum, p) => sum + (p.cpu || 0), 0);
    const ollamaRamMb = ollamaProcs.reduce((sum, p) => sum + (p.memRss || 0), 0) / 1024;

    const isInferencing =
        activeProxyRequests > 0 ||
        (ollamaPs.activeModels.length > 0 && (ollamaCpuPct > 4.0 || gpuStats.gpuUtilPct > 15));

    return {
        timestamp: Date.now(),
        pc: {
            cpuPct: Number(cpuLoad.currentLoad.toFixed(1)),
            ramUsedMb: Math.round(mem.active / (1024 * 1024)),
            ramTotalMb: Math.round(mem.total / (1024 * 1024)),
            gpuUtilPct: Number(gpuStats.gpuUtilPct.toFixed(1)),
            gpuVramUsedMb: Math.round(gpuStats.gpuVramUsedMb),
            gpuVramTotalMb: Math.round(gpuStats.gpuVramTotalMb),
            gpuTempC: Math.round(gpuStats.gpuTempC),
            gpuWatts: Number(gpuStats.gpuWatts.toFixed(1)),
        },
        ollama: {
            isRunning: ollamaProcs.length > 0 || ollamaPs.activeModels.length > 0,
            isInferencing,
            activeModels: ollamaPs.activeModels,
            cpuPct: Number(Math.min(ollamaCpuPct, 100).toFixed(1)),
            ramUsedMb: Math.round(ollamaRamMb),
            vramUsedMb: ollamaPs.vramUsedMb,
            modelsInfo: ollamaPs.modelsInfo,
            vramSpillMb: ollamaPs.vramSpillMb,
            contextLength: ollamaPs.contextLength,
        },
    };
}