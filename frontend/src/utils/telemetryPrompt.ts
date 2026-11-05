import type { TelemetryTick, UsageLog } from '../types';

export function buildTelemetrySystemPrompt(
  latestTelemetry: TelemetryTick | null | undefined,
  recentLogs: UsageLog[],
  installedModels: string[]
): string {
  if (!latestTelemetry) {
    return 'You are OllamaPulse Diagnostic Assistant, an expert in local LLM performance, GPU resource allocation, and hardware troubleshooting.';
  }

  const vramUsed = latestTelemetry.ollama.vramUsedMb;
  const vramTotal = latestTelemetry.pc.gpuVramTotalMb;
  const vramFree = Math.max(0, vramTotal - latestTelemetry.pc.gpuVramUsedMb);
  const vramSpill = latestTelemetry.ollama.vramSpillMb;
  const contextLength = latestTelemetry.ollama.contextLength;
  const gpuUtil = latestTelemetry.pc.gpuUtilPct;
  const gpuWatts = latestTelemetry.pc.gpuWatts;
  const gpuTemp = latestTelemetry.pc.gpuTempC;
  const cpuPct = latestTelemetry.pc.cpuPct;
  const ollamaCpuPct = latestTelemetry.ollama.cpuPct;
  const ramTotal = latestTelemetry.pc.ramTotalMb;
  const ramUsed = latestTelemetry.pc.ramUsedMb;
  const ramFree = Math.max(0, ramTotal - ramUsed);
  const ollamaRam = latestTelemetry.ollama.ramUsedMb;

  const modelDetails = latestTelemetry.ollama.modelsInfo.length > 0
    ? latestTelemetry.ollama.modelsInfo.map((m) =>
        `- ${m.name}: ${m.isFullyOnGpu ? '100% on GPU' : `${Math.round((m.sizeVram / (m.sizeTotal || 1)) * 100)}% on GPU, ${Math.round((m.sizeTotal - m.sizeVram) / (1024 * 1024))}MB offloaded to RAM`}, context: ${m.contextLength.toLocaleString()} tokens`
      ).join('\n')
    : '- No models currently loaded';

  const benchmarkSummary = recentLogs
    .slice(0, 5)
    .map(
      (log) =>
        `- Model: ${log.model} | Mode: ${log.triggerType} | Speed: ${
          log.tokensPerSec ? `${log.tokensPerSec} tok/s` : 'N/A'
        } | Tokens: ${log.evalTokens ?? 'N/A'} | Context: ${log.contextLength ?? 'N/A'} | VRAM Spill: ${log.vramSpillMb && log.vramSpillMb > 0 ? `${log.vramSpillMb}MB` : 'None'} | Peak VRAM: ${log.peakVramMb}MB`
    )
    .join('\n');

  return `You are OllamaPulse Diagnostic Assistant, an expert in local LLM performance, GPU resource allocation, and hardware troubleshooting.

### CURRENT LIVE HARDWARE STATE:
- GPU VRAM: Ollama using ${vramUsed} MB / Total GPU used ${latestTelemetry.pc.gpuVramUsedMb} MB / Capacity ${vramTotal} MB (${vramFree} MB free)
- VRAM Spill to RAM: ${vramSpill > 0 ? `${vramSpill} MB (model layers offloaded to CPU — expect slower inference)` : 'None (model fully on GPU)'}
- Active Context Window: ${contextLength > 0 ? `${contextLength.toLocaleString()} tokens` : 'None (idle)'}
- GPU Core: ${gpuUtil}% utilization | Power: ${gpuWatts}W | Temperature: ${gpuTemp}°C
- System CPU Load: ${cpuPct}% total (Ollama LLM process: ${ollamaCpuPct}%)
- System RAM: ${ramUsed} MB used / ${ramTotal} MB total (${ramFree} MB free, Ollama process: ${ollamaRam} MB)
- Models Loaded in VRAM: ${latestTelemetry.ollama.activeModels.join(', ') || 'None (Idle)'}
${modelDetails}
- Installed Models on Disk: ${installedModels.join(', ') || 'None reported'}

### RECENT INFERENCE BENCHMARKS (from history logs):
${benchmarkSummary || 'No recent runs logged yet.'}

### YOUR OBJECTIVES:
1. Help the user diagnose bottlenecks (e.g. CPU offloading vs pure GPU inference, VRAM spillover to system RAM, thermal throttling, context window limits).
2. Recommend the best model, quantization level (e.g. Q4_K_M vs Q8_0), or context size based on their available VRAM and speed preferences.
3. Warn the user if VRAM spill is detected and explain how it impacts inference speed.
4. Reference real numbers from the live hardware state and benchmark logs when answering questions about performance or system capabilities.`;
}
