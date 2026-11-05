import { useState } from 'react';
import { Clock, Download, Trash2, FileText } from 'lucide-react';
import type { UsageLog, TelemetryTick } from '../types';
import { downloadAllRunsMarkdownReport, downloadSingleRunMarkdownReport } from '../utils/reportGenerator';

interface UsageLogTableProps {
  logs: UsageLog[];
  systemTelemetry?: TelemetryTick | null;
  onClearLogs?: () => void;
}

export function UsageLogTable({ logs, systemTelemetry, onClearLogs }: UsageLogTableProps) {
  const [isClearing, setIsClearing] = useState(false);

  const handleDownloadAll = () => {
    if (logs.length === 0) return;
    downloadAllRunsMarkdownReport(logs, systemTelemetry);
  };

  const handleDownloadSingle = (log: UsageLog) => {
    downloadSingleRunMarkdownReport(log, systemTelemetry);
  };

  const handleClear = async () => {
    if (logs.length === 0) return;
    const confirmClear = window.confirm('Are you sure you want to clear all inference history logs? This action cannot be undone.');
    if (!confirmClear) return;

    setIsClearing(true);
    try {
      if (onClearLogs) {
        onClearLogs();
      } else {
        await fetch('http://localhost:11435/api/telemetry/logs', { method: 'DELETE' });
      }
    } catch (err) {
      console.error('Failed to clear logs:', err);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="#38bdf8" />
          <h3 style={{ margin: 0, fontSize: '16px' }}>LLM Inference History Log</h3>
          <span style={{ fontSize: '12px', color: '#94a3b8', background: '#334155', padding: '2px 8px', borderRadius: '999px' }}>
            {logs.length} {logs.length === 1 ? 'run' : 'runs'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleClear}
            disabled={logs.length === 0 || isClearing}
            title={logs.length === 0 ? 'No logs to clear' : 'Clear all previous inference logs'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: logs.length === 0 ? '#33415550' : '#ef444415',
              color: logs.length === 0 ? '#64748b' : '#f87171',
              border: `1px solid ${logs.length === 0 ? '#334155' : '#ef444440'}`,
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: logs.length === 0 || isClearing ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Trash2 size={14} />
            <span>{isClearing ? 'Clearing...' : 'Clear History'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={logs.length === 0}
            title={logs.length === 0 ? 'No inference runs to export' : 'Download formatted Markdown (.md) benchmark report'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: logs.length === 0 ? '#33415550' : '#0284c720',
              color: logs.length === 0 ? '#64748b' : '#38bdf8',
              border: `1px solid ${logs.length === 0 ? '#334155' : '#0284c7'}`,
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={14} />
            <span>Download All (.md)</span>
          </button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
              <th style={{ padding: '10px' }}>Timestamp</th>
              <th style={{ padding: '10px' }}>Model</th>
              <th style={{ padding: '10px' }}>Capture Mode</th>
              <th style={{ padding: '10px' }}>Duration</th>
              <th style={{ padding: '10px' }}>Avg / Peak LLM CPU</th>
              <th style={{ padding: '10px' }}>Ollama VRAM</th>
              <th style={{ padding: '10px' }}>Tokens In / Out</th>
              <th style={{ padding: '10px' }}>Context Used</th>
              <th style={{ padding: '10px' }}>Model Context</th>
              <th style={{ padding: '10px' }}>VRAM Spill</th>
              <th style={{ padding: '10px' }}>Avg GPU / Peak Watts</th>
              <th style={{ padding: '10px' }}>Speed (TPS)</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #1e293b80' }}>
                <td style={{ padding: '10px' }}>{new Date(log.startTime).toLocaleTimeString()}</td>
                <td style={{ padding: '10px', fontWeight: 600, color: '#38bdf8' }}>{log.model}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: log.triggerType === 'proxy' ? '#38bdf820' : '#eab30820',
                    color: log.triggerType === 'proxy' ? '#38bdf8' : '#fde047'
                  }}>
                    {log.triggerType}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>{(log.durationMs / 1000).toFixed(1)}s</td>
                <td style={{ padding: '10px' }}>{log.avgOllamaCpuPct}% / {log.peakOllamaCpuPct}%</td>
                <td style={{ padding: '10px' }}>{log.peakVramMb} MB</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ color: '#fde047' }} title="Input (prompt) tokens">
                    {log.promptTokens != null ? log.promptTokens.toLocaleString() : '—'}
                  </span>
                  <span style={{ color: '#64748b', margin: '0 4px' }}>/</span>
                  <span style={{ color: '#4ade80' }} title="Output (generated) tokens">
                    {log.evalTokens != null ? log.evalTokens.toLocaleString() : '—'}
                  </span>
                </td>
                <td style={{ padding: '10px', color: log.contextLength != null ? '#38bdf8' : '#64748b' }}>
                  {log.contextLength != null ? `${log.contextLength.toLocaleString()} tok` : '—'}
                  {log.modelContextWindow != null && log.contextLength != null && (
                    <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '4px' }}>
                      ({Math.round((log.contextLength / log.modelContextWindow) * 100)}%)
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px', color: log.modelContextWindow != null ? '#38bdf8' : '#64748b' }}>
                  {log.modelContextWindow != null ? `${log.modelContextWindow.toLocaleString()} tok` : '—'}
                  {log.modelContextWindow != null && log.contextLength != null && (
                    <span style={{ color: '#4ade80', fontSize: '11px', marginLeft: '4px' }}>
                      ({(log.modelContextWindow - log.contextLength).toLocaleString()} avail)
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px', color: log.vramSpillMb && log.vramSpillMb > 0 ? '#f97316' : '#4ade80' }}>
                  {log.vramSpillMb && log.vramSpillMb > 0 ? `${log.vramSpillMb} MB` : 'None'}
                </td>
                <td style={{ padding: '10px' }}>{log.avgGpuUtilPct}% ({log.peakGpuWatts}W)</td>
                <td style={{ padding: '10px', color: '#4ade80', fontWeight: 600 }}>
                  {log.tokensPerSec ? `${log.tokensPerSec} tok/s` : 'N/A (Passive)'}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(log)}
                    title={`Download report for this ${log.model} run`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#33415580',
                      color: '#cbd5e1',
                      border: '1px solid #475569',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <FileText size={12} color="#38bdf8" />
                    <span>Report</span>
                  </button>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={14} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                  No LLM sessions recorded yet. Run a prompt in Ollama or use the chat above to see telemetry logs appear!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
