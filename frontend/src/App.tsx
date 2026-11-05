import React, { useEffect, useState, useRef } from 'react';
import { Cpu, HardDrive, Zap, Activity, Sparkles, AlertTriangle } from 'lucide-react';
import type { TelemetryTick, UsageLog, ChatMessage } from './types';
import { MetricCard, TelemetryCharts, UsageLogTable, ChatPlayground } from './components';
import { buildTelemetrySystemPrompt } from './utils/telemetryPrompt';

export default function App() {
  const [history, setHistory] = useState<TelemetryTick[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const latest = history[history.length - 1];

  // Chat State
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showThinkingMap, setShowThinkingMap] = useState<Record<string, boolean>>({});
  const [enableDiagnosticMode, setEnableDiagnosticMode] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchModels = async () => {
    const parseAndSet = (data: any) => {
      if (data?.models && Array.isArray(data.models)) {
        const names = data.models.map((m: { name: string }) => m.name);
        if (names.length > 0) {
          setModels(names);
          setSelectedModel((prev) => (prev && names.includes(prev) ? prev : names[0]));
          return true;
        }
      }
      return false;
    };

    try {
      const res = await fetch('http://localhost:11435/api/tags');
      if (res.ok) {
        const data = await res.json();
        if (parseAndSet(data)) return;
      }
    } catch {
      // Fallback to direct Ollama port
    }

    try {
      const directRes = await fetch('http://localhost:11434/api/tags');
      if (directRes.ok) {
        const data = await directRes.json();
        parseAndSet(data);
      }
    } catch (err) {
      console.error('Failed to fetch installed models:', err);
    }
  };

  useEffect(() => {
    fetch('http://localhost:11435/api/telemetry/logs')
      .then((r) => r.json())
      .then(setLogs)
      .catch(console.error);

    fetchModels();

    const ws = new WebSocket('ws://localhost:11435');
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'TELEMETRY_TICK') {
        const tick: TelemetryTick = {
          ...msg.data,
          timeLabel: new Date(msg.data.timestamp).toLocaleTimeString(),
        };
        setHistory((prev) => [...prev.slice(-59), tick]);
      } else if (msg.type === 'LOGS_UPDATED') {
        setLogs(msg.data);
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (latest?.ollama.activeModels.length) {
      setModels((prev) => Array.from(new Set([...prev, ...latest.ollama.activeModels])));
      if (!selectedModel) {
        setSelectedModel(latest.ollama.activeModels[0] || '');
      }
    }
  }, [latest?.ollama.activeModels, selectedModel]);

  const ollamaShareOfCpuLoad =
    latest && latest.pc.cpuPct > 0
      ? Math.min(100, Math.round((latest.ollama.cpuPct / latest.pc.cpuPct) * 100))
      : 0;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;

    const modelToUse = selectedModel || models[0] || 'qwen3.5:4b';
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      model: modelToUse,
      thinking: '',
    };

    const newMessages = [...messages, userMessage];
    setMessages([...newMessages, initialAssistantMessage]);
    setPrompt('');
    setIsGenerating(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const apiMessages: Array<{ role: string; content: string }> = [];

      if (enableDiagnosticMode) {
        const systemPrompt = buildTelemetrySystemPrompt(latest, logs, models);
        apiMessages.push({
          role: 'system',
          content: systemPrompt,
        });
      }

      for (const m of newMessages) {
        apiMessages.push({
          role: m.role,
          content: m.content,
        });
      }

      const res = await fetch('http://localhost:11435/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          messages: apiMessages,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`Ollama returned status ${res.status}`);
      }

      if (!res.body) throw new Error('No response body received');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let accumulatedThinking = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);

            if (parsed.message?.content) {
              accumulatedContent += parsed.message.content;
            }
            if (parsed.message?.thinking) {
              accumulatedThinking += parsed.message.thinking;
            } else if (parsed.thinking) {
              accumulatedThinking += parsed.thinking;
            }

            let displayContent = accumulatedContent;
            let displayThinking = accumulatedThinking;

            const thinkMatch = displayContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
            if (thinkMatch && thinkMatch[1]) {
              displayThinking = (displayThinking ? displayThinking + '\n' : '') + thinkMatch[1].trim();
              displayContent = displayContent.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trimStart();
            }

            let statsObj: ChatMessage['stats'] | undefined;
            if (parsed.done && parsed.eval_duration) {
              const evalDurationSec = parsed.eval_duration / 1e9;
              const evalTokens = parsed.eval_count || 0;
              const tokensPerSec = evalDurationSec > 0 ? Number((evalTokens / evalDurationSec).toFixed(2)) : undefined;
              statsObj = {
                evalTokens,
                evalDurationSec: Number(evalDurationSec.toFixed(2)),
                tokensPerSec,
              };
            }

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      content: displayContent,
                      thinking: displayThinking || undefined,
                      stats: statsObj || msg.stats,
                    }
                  : msg
              )
            );
          } catch {
            // Partial JSON chunk
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Chat error:', err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: msg.content || `❌ Error: ${err.message || 'Failed to generate response'}`,
                }
              : msg
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleClearChat = () => {
    if (isGenerating) handleStop();
    setMessages([]);
  };

  const toggleThinking = (id: string) => {
    setShowThinkingMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleClearLogs = async () => {
    try {
      setLogs([]);
      await fetch('http://localhost:11435/api/telemetry/logs', { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  return (
    <div style={{ background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '28px 32px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1360px', margin: '0 auto', width: '100%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={24} color="#38bdf8" />
              OllamaPulse Telemetry & Chat
            </h1>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>
              Real-time PC vs. Local LLM Hardware Load, Interactive Chat & Proxy Inference Logs
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              background: latest?.ollama.isInferencing ? '#22c55e20' : '#334155',
              color: latest?.ollama.isInferencing ? '#4ade80' : '#cbd5e1',
              border: `1px solid ${latest?.ollama.isInferencing ? '#22c55e' : '#475569'}`
            }}>
              {latest?.ollama.isInferencing
                ? `⚡ INFERENCING (${latest.ollama.activeModels.join(', ') || selectedModel || 'Active'})`
                : latest?.ollama.activeModels.length
                  ? `🟢 Loaded in VRAM: ${latest.ollama.activeModels.join(', ')}`
                  : '⚪ Ollama Idle'}
            </span>
          </div>
        </header>

        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <MetricCard title="CPU Load (Total vs LLM)" icon={<Cpu size={18} color="#38bdf8" />}>
            <div style={{ fontSize: '26px', fontWeight: 700 }}>
              {latest ? `${latest.pc.cpuPct}%` : '--'}
              <span style={{ fontSize: '15px', color: '#f43f5e', marginLeft: '8px' }}>
                (LLM: {latest ? `${latest.ollama.cpuPct}%` : '--'})
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Ollama accounts for <strong>{ollamaShareOfCpuLoad}%</strong> of current CPU usage
            </div>
          </MetricCard>

          <MetricCard title="VRAM Allocation" icon={<Zap size={18} color="#a855f7" />}>
            <div style={{ fontSize: '26px', fontWeight: 700 }}>
              {latest ? `${latest.ollama.vramUsedMb} MB` : '--'}
              <span style={{ fontSize: '14px', color: '#94a3b8', marginLeft: '6px' }}>
                / {latest ? `${latest.pc.gpuVramTotalMb} MB` : '--'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              Total GPU VRAM Used: {latest ? `${latest.pc.gpuVramUsedMb} MB` : '--'}
            </div>
            {latest && latest.ollama.contextLength > 0 && (
              <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '2px' }}>
                Context Window: {latest.ollama.contextLength.toLocaleString()} tokens
              </div>
            )}
          </MetricCard>

          <MetricCard title="VRAM Spill Status" icon={latest?.ollama.vramSpillMb > 0 ? <AlertTriangle size={18} color="#f97316" /> : <Activity size={18} color="#22c55e" />}>
            <div style={{ fontSize: '26px', fontWeight: 700, color: latest?.ollama.vramSpillMb > 0 ? '#f97316' : '#22c55e' }}>
              {latest?.ollama.vramSpillMb > 0 ? `${latest.ollama.vramSpillMb} MB` : 'None'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              {latest?.ollama.vramSpillMb > 0
                ? 'Model layers spilled to system RAM — expect slower inference'
                : latest?.ollama.activeModels.length
                  ? 'Model fully loaded on GPU — optimal performance'
                  : 'No active models'}
            </div>
            {latest && latest.ollama.modelsInfo.length > 0 && latest.ollama.modelsInfo.map((m) => (
              <div key={m.name} style={{ fontSize: '11px', color: m.isFullyOnGpu ? '#4ade80' : '#fbbf24', marginTop: '2px' }}>
                {m.name}: {m.isFullyOnGpu ? '100% GPU' : `${Math.round((m.sizeVram / (m.sizeTotal || 1)) * 100)}% GPU`}
              </div>
            ))}
          </MetricCard>

          <MetricCard title="GPU Core & Power" icon={<Activity size={18} color="#22c55e" />}>
            <div style={{ fontSize: '26px', fontWeight: 700 }}>
              {latest ? `${latest.pc.gpuUtilPct}%` : '--'}
              <span style={{ fontSize: '15px', color: '#eab308', marginLeft: '8px' }}>
                {latest ? `${latest.pc.gpuWatts}W` : '--'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              GPU Temp: {latest ? `${latest.pc.gpuTempC}°C` : '--'}
            </div>
          </MetricCard>

          <MetricCard title="System RAM (Total vs LLM)" icon={<HardDrive size={18} color="#f97316" />}>
            <div style={{ fontSize: '26px', fontWeight: 700 }}>
              {latest ? `${latest.ollama.ramUsedMb} MB` : '--'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              PC Total Used: {latest ? `${latest.pc.ramUsedMb} / ${latest.pc.ramTotalMb} MB` : '--'}
            </div>
          </MetricCard>
        </div>

        {/* Telemetry Charts Row */}
        <div style={{ marginBottom: '24px' }}>
          <TelemetryCharts history={history} />
        </div>

        {/* Interactive Chat Playground Row */}
        <div style={{ marginBottom: '24px' }}>
          <ChatPlayground
            models={models}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            messages={messages}
            prompt={prompt}
            setPrompt={setPrompt}
            isGenerating={isGenerating}
            showThinkingMap={showThinkingMap}
            toggleThinking={toggleThinking}
            fetchModels={fetchModels}
            handleSendMessage={handleSendMessage}
            handleStop={handleStop}
            handleClearChat={handleClearChat}
            enableDiagnosticMode={enableDiagnosticMode}
            setEnableDiagnosticMode={setEnableDiagnosticMode}
          />
        </div>

        {/* Historical Usage Log Table */}
        <UsageLogTable logs={logs} systemTelemetry={latest} onClearLogs={handleClearLogs} />
      </div>
    </div>
  );
}
