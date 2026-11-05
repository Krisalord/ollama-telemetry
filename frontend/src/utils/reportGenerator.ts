import type { UsageLog, TelemetryTick } from '../types';

export function generateMarkdownReport(
  logs: UsageLog[],
  systemTelemetry?: TelemetryTick | null
): string {
  const timestamp = new Date().toLocaleString();
  const totalRuns = logs.length;
  const proxyRuns = logs.filter((l) => l.triggerType === 'proxy');
  const passiveRuns = logs.filter((l) => l.triggerType === 'passive_spike');

  const totalTokens = logs.reduce((acc, l) => acc + (l.evalTokens || 0), 0);
  const runsWithTps = logs.filter((l) => l.tokensPerSec !== null && l.tokensPerSec > 0);
  const avgTps = runsWithTps.length > 0
    ? (runsWithTps.reduce((acc, l) => acc + (l.tokensPerSec || 0), 0) / runsWithTps.length).toFixed(1)
    : 'N/A';
  const maxTps = runsWithTps.length > 0
    ? Math.max(...runsWithTps.map((l) => l.tokensPerSec || 0)).toFixed(1)
    : 'N/A';

  const peakVram = logs.length > 0 ? Math.max(...logs.map((l) => l.peakVramMb)) : 0;
  const peakWatts = logs.length > 0 ? Math.max(...logs.map((l) => l.peakGpuWatts)) : 0;
  const peakSpill = logs.length > 0 ? Math.max(...logs.map((l) => l.vramSpillMb || 0)) : 0;
  const totalDurationSec = (logs.reduce((acc, l) => acc + l.durationMs, 0) / 1000).toFixed(1);

  // Group by model
  const modelStats: Record<string, {
    count: number;
    tokens: number;
    tpsList: number[];
    peakVram: number;
    peakWatts: number;
    totalDurationMs: number;
  }> = {};

  for (const log of logs) {
    if (!modelStats[log.model]) {
      modelStats[log.model] = {
        count: 0,
        tokens: 0,
        tpsList: [],
        peakVram: 0,
        peakWatts: 0,
        totalDurationMs: 0,
      };
    }
    const stat = modelStats[log.model];
    stat.count += 1;
    stat.tokens += log.evalTokens || 0;
    if (log.tokensPerSec) stat.tpsList.push(log.tokensPerSec);
    if (log.peakVramMb > stat.peakVram) stat.peakVram = log.peakVramMb;
    if (log.peakGpuWatts > stat.peakWatts) stat.peakWatts = log.peakGpuWatts;
    stat.totalDurationMs += log.durationMs;
  }

  let md = `# Ollama LLM Inference & Telemetry Benchmark Report\n\n`;
  md += `> Generated on **${timestamp}** by **OllamaPulse Telemetry**\n\n`;

  // System Hardware Context
  if (systemTelemetry) {
    md += `### 🖥️ Hardware Environment\n\n`;
    md += `- **GPU VRAM Capacity:** ${systemTelemetry.pc.gpuVramTotalMb} MB\n`;
    md += `- **System RAM Capacity:** ${systemTelemetry.pc.ramTotalMb} MB\n`;
    if (systemTelemetry.pc.gpuTempC) {
      md += `- **GPU Temperature at generation:** ${systemTelemetry.pc.gpuTempC}°C\n`;
    }
    md += `\n`;
  }

  // Summary Metrics
  md += `### 📊 Executive Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Total Inference Runs** | ${totalRuns} (${proxyRuns.length} proxy, ${passiveRuns.length} passive spike) |\n`;
  md += `| **Total Tokens Generated** | ${totalTokens.toLocaleString()} tokens |\n`;
  md += `| **Average Generation Speed** | ${avgTps} tok/s |\n`;
  md += `| **Peak Generation Speed** | ${maxTps} tok/s |\n`;
  md += `| **Total Active Compute Time** | ${totalDurationSec}s |\n`;
  md += `| **Peak Ollama VRAM Footprint** | ${peakVram} MB |\n`;
  md += `| **Peak VRAM Spill to RAM** | ${peakSpill > 0 ? `${peakSpill} MB` : 'None (fully on GPU)'} |\n`;
  md += `| **Peak GPU Power Draw** | ${peakWatts} W |\n\n`;

  // Model-level Breakdown
  if (Object.keys(modelStats).length > 0) {
    md += `### 🤖 Model Performance Breakdown\n\n`;
    md += `| Model | Runs | Total Tokens | Avg TPS | Peak TPS | Peak VRAM | Spill | Peak Power |\n`;
    md += `| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
    for (const [modelName, stat] of Object.entries(modelStats)) {
      const modelAvgTps = stat.tpsList.length > 0
        ? (stat.tpsList.reduce((a, b) => a + b, 0) / stat.tpsList.length).toFixed(1) + ' tok/s'
        : 'N/A';
      const modelPeakTps = stat.tpsList.length > 0
        ? Math.max(...stat.tpsList).toFixed(1) + ' tok/s'
        : 'N/A';
      const modelLogs = logs.filter((l) => l.model === modelName);
      const modelSpill = Math.max(...modelLogs.map((l) => l.vramSpillMb || 0));
      md += `| **${modelName}** | ${stat.count} | ${stat.tokens.toLocaleString()} | ${modelAvgTps} | ${modelPeakTps} | ${stat.peakVram} MB | ${modelSpill > 0 ? `${modelSpill} MB` : 'None'} | ${stat.peakWatts} W |\n`;
    }
    md += `\n`;
  }

  // Detailed Runs Table
  md += `### 📜 Detailed Inference Run Logs\n\n`;
  if (logs.length === 0) {
    md += `*No inference runs logged yet.*\n\n`;
  } else {
    md += `| # | Timestamp | Model | Mode | Duration | Speed (TPS) | Tokens | Context | Spill | LLM CPU (Avg/Peak) | Peak VRAM | Avg GPU % | Peak Power |\n`;
    md += `| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;
    logs.forEach((log, idx) => {
      const timeStr = new Date(log.startTime).toLocaleString();
      const durSec = (log.durationMs / 1000).toFixed(1) + 's';
      const tpsStr = log.tokensPerSec ? `${log.tokensPerSec} tok/s` : 'N/A';
      const tokensStr = log.evalTokens !== null ? log.evalTokens.toString() : 'N/A';
      const cpuStr = `${log.avgOllamaCpuPct}% / ${log.peakOllamaCpuPct}%`;
      const vramStr = `${log.peakVramMb} MB`;
      const gpuStr = `${log.avgGpuUtilPct}%`;
      const wattsStr = `${log.peakGpuWatts} W`;

      const contextStr = log.contextLength ? `${log.contextLength.toLocaleString()} tok` : '—';
      const spillStr = log.vramSpillMb && log.vramSpillMb > 0 ? `${log.vramSpillMb} MB` : 'None';
      md += `| ${idx + 1} | ${timeStr} | **${log.model}** | \`${log.triggerType}\` | ${durSec} | ${tpsStr} | ${tokensStr} | ${contextStr} | ${spillStr} | ${cpuStr} | ${vramStr} | ${gpuStr} | ${wattsStr} |\n`;
    });
    md += `\n`;
  }

  md += `---\n`;
  md += `*Report automatically generated by OllamaPulse Telemetry.*\n`;

  return md;
}

export function downloadAllRunsMarkdownReport(
  logs: UsageLog[],
  systemTelemetry?: TelemetryTick | null
): void {
  const content = generateMarkdownReport(logs, systemTelemetry);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const filename = `ollama-telemetry-report-${dateStr}_${timeStr}.md`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const downloadMarkdownReport = downloadAllRunsMarkdownReport;

export function downloadSingleRunMarkdownReport(
  log: UsageLog,
  systemTelemetry?: TelemetryTick | null
): void {
  const content = generateSingleRunMarkdownReport(log, systemTelemetry);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanModel = log.model.replace(/[^a-zA-Z0-9._-]/g, '_');
  const now = new Date(log.startTime);
  const dateStr = !isNaN(now.getTime()) ? now.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const timeStr = !isNaN(now.getTime()) ? now.toTimeString().slice(0, 8).replace(/:/g, '-') : 'log';
  const filename = `ollama-run-${cleanModel}-${dateStr}_${timeStr}.md`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateSingleRunMarkdownReport(
  log: UsageLog,
  systemTelemetry?: TelemetryTick | null
): string {
  const startTimeDate = new Date(log.startTime);
  const startTimeStr = startTimeDate.toLocaleString();
  const endTimeStr = !isNaN(startTimeDate.getTime())
    ? new Date(startTimeDate.getTime() + log.durationMs).toLocaleString()
    : 'N/A';
  const durSec = (log.durationMs / 1000).toFixed(2);
  const tpsStr = log.tokensPerSec ? `${log.tokensPerSec} tok/s` : 'N/A (Passive Spike)';
  const tokensStr = log.evalTokens !== null ? `${log.evalTokens.toLocaleString()} tokens` : 'N/A';

  let md = `# Ollama Single Inference Run Report: ${log.model}\n\n`;
  md += `> Generated on **${new Date().toLocaleString()}** by **OllamaPulse Telemetry**\n\n`;

  // Hardware specs if present
  if (systemTelemetry) {
    md += `### 🖥️ Hardware Environment\n\n`;
    md += `- **GPU VRAM Capacity:** ${systemTelemetry.pc.gpuVramTotalMb} MB\n`;
    md += `- **System RAM Capacity:** ${systemTelemetry.pc.ramTotalMb} MB\n`;
    if (systemTelemetry.pc.gpuTempC) {
      md += `- **GPU Current Temperature:** ${systemTelemetry.pc.gpuTempC}°C\n`;
    }
    md += `\n`;
  }

  md += `### ⚡ Run Performance & Metrics\n\n`;
  md += `| Parameter | Value |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Model** | **${log.model}** |\n`;
  md += `| **Capture Trigger Mode** | \`${log.triggerType}\` |\n`;
  md += `| **Start Time** | ${startTimeStr} |\n`;
  md += `| **End Time** | ${endTimeStr} |\n`;
  md += `| **Total Duration** | ${durSec} seconds (${log.durationMs} ms) |\n`;
  md += `| **Generation Speed (TPS)** | **${tpsStr}** |\n`;
  md += `| **Generated Tokens** | ${tokensStr} |\n`;
  md += `| **Peak Ollama VRAM** | ${log.peakVramMb} MB |\n`;
  md += `| **Context Window** | ${log.contextLength ? `${log.contextLength.toLocaleString()} tokens` : 'N/A'} |\n`;
  md += `| **VRAM Spill to RAM** | ${log.vramSpillMb && log.vramSpillMb > 0 ? `${log.vramSpillMb} MB (CPU offload detected)` : 'None (fully on GPU)'} |\n`;
  md += `| **Avg / Peak Ollama CPU** | ${log.avgOllamaCpuPct}% / ${log.peakOllamaCpuPct}% |\n`;
  md += `| **Average GPU Core Load** | ${log.avgGpuUtilPct}% |\n`;
  md += `| **Peak GPU Power Draw** | ${log.peakGpuWatts} W |\n\n`;

  md += `---\n`;
  md += `*Report automatically generated by OllamaPulse Telemetry.*\n`;

  return md;
}
