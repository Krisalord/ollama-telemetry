export interface OllamaModelInfo {
  name: string;
  contextLength: number;
  sizeVram: number;
  sizeTotal: number;
  isFullyOnGpu: boolean;
}

export interface TelemetryTick {
  timestamp: number;
  timeLabel?: string;
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
    vramSpillMb: number;
    contextLength: number;
  };
}

export interface UsageLog {
  id: number;
  model: string;
  triggerType: 'proxy' | 'passive_spike';
  startTime: string;
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  thinking?: string;
  stats?: {
    evalTokens?: number;
    evalDurationSec?: number;
    tokensPerSec?: number;
  };
}
