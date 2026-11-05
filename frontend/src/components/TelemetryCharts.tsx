import { Cpu, Zap, Database } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { TelemetryTick } from '../types';

interface TelemetryChartsProps {
  history: TelemetryTick[];
}

export function TelemetryCharts({ history }: TelemetryChartsProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
      <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155', minHeight: '260px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={16} color="#38bdf8" />
          Real-Time CPU Load: Total PC vs. Ollama (%)
        </h3>
        <div style={{ flex: 1, minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Legend />
              <Area type="monotone" dataKey="pc.cpuPct" name="Total PC CPU %" stroke="#38bdf8" fill="#38bdf830" isAnimationActive={false} />
              <Area type="monotone" dataKey="ollama.cpuPct" name="Ollama LLM CPU %" stroke="#f43f5e" fill="#f43f5e60" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155', minHeight: '260px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={16} color="#a855f7" />
          GPU Compute (%) & Ollama VRAM (MB)
        </h3>
        <div style={{ flex: 1, minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={11} />
              <YAxis yAxisId="left" domain={[0, 100]} stroke="#22c55e" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#a855f7" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="pc.gpuUtilPct" name="GPU Core %" stroke="#22c55e" fill="#22c55e25" isAnimationActive={false} />
              <Area yAxisId="right" type="monotone" dataKey="ollama.vramUsedMb" name="Ollama VRAM (MB)" stroke="#a855f7" fill="#a855f740" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155', minHeight: '260px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} color="#f97316" />
          VRAM Headroom & Spill Detection (MB)
        </h3>
        <div style={{ flex: 1, minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history.map((h) => ({
              ...h,
              vramFree: Math.max(0, h.pc.gpuVramTotalMb - h.pc.gpuVramUsedMb),
              vramSpillMb: h.ollama.vramSpillMb,
            }))}>
              <XAxis dataKey="timeLabel" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Legend />
              <Area type="monotone" dataKey="vramFree" name="VRAM Free (MB)" stroke="#22c55e" fill="#22c55e25" isAnimationActive={false} />
              <Area type="monotone" dataKey="vramSpillMb" name="VRAM Spill to RAM (MB)" stroke="#f97316" fill="#f9731640" isAnimationActive={false} />
              <Area type="monotone" dataKey="ollama.ramUsedMb" name="Ollama System RAM (MB)" stroke="#eab308" fill="#eab30820" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
