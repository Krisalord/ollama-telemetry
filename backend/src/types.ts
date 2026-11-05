export interface OllamaModelInfo {
    name: string;
    contextLength: number;
    sizeVram: number;        // Model bytes resident in VRAM
    sizeTotal: number;       // Total model bytes on disk
    isFullyOnGpu: boolean;   // true if sizeVram >= sizeTotal (no CPU offload)
}

export interface TelemetryTick {
    timestamp: number;
    pc: {
        cpuPct: number;
        ramUsedMb: number;
        ramTotalMb: number;
        gpuUtilPct: number;
        gpuVramUsedMb: number;
        gpuVramTotalMb: number;
        gpuTempC: number;
        gpuWatts: number;
    };
    ollama: {
        isRunning: boolean;
        isInferencing: boolean;
        activeModels: string[];
        cpuPct: number;
        ramUsedMb: number;
        vramUsedMb: number;
        modelsInfo: OllamaModelInfo[];
        vramSpillMb: number;     // MB spilled from VRAM to system RAM (0 if fully on GPU)
        contextLength: number;   // Sum of active context windows
    };
}

export interface UsageLog {
    id?: number;
    model: string;
    triggerType: 'proxy' | 'passive_spike';
    startTime: string;
    endTime: string;
    durationMs: number;
    avgOllamaCpuPct: number;
    peakOllamaCpuPct: number;
    peakVramMb: number;
    avgGpuUtilPct: number;
    peakGpuWatts: number;
    promptTokens: number | null;
    evalTokens: number | null;
    tokensPerSec: number | null;
    contextLength: number | null;
    modelContextWindow: number | null;
    vramSpillMb: number | null;
}