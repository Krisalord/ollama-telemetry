import Database from 'better-sqlite3';
import type { UsageLog } from './types.js';

const db = new Database('telemetry.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    triggerType TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    durationMs INTEGER NOT NULL,
    avgOllamaCpuPct REAL NOT NULL,
    peakOllamaCpuPct REAL NOT NULL,
    peakVramMb REAL NOT NULL,
    avgGpuUtilPct REAL NOT NULL,
    peakGpuWatts REAL NOT NULL,
    evalTokens INTEGER,
    tokensPerSec REAL,
    contextLength INTEGER,
    vramSpillMb REAL
  )
`);

// Add columns if table already existed before schema update
try {
    db.exec('ALTER TABLE usage_logs ADD COLUMN contextLength INTEGER');
} catch { /* column already exists */ }
try {
    db.exec('ALTER TABLE usage_logs ADD COLUMN vramSpillMb REAL');
} catch { /* column already exists */ }
try {
    db.exec('ALTER TABLE usage_logs ADD COLUMN promptTokens INTEGER');
} catch { /* column already exists */ }
try {
    db.exec('ALTER TABLE usage_logs ADD COLUMN modelContextWindow INTEGER');
} catch { /* column already exists */ }

const insertStmt = db.prepare(`
  INSERT INTO usage_logs (
    model, triggerType, startTime, endTime, durationMs,
    avgOllamaCpuPct, peakOllamaCpuPct, peakVramMb,
    avgGpuUtilPct, peakGpuWatts, promptTokens, evalTokens, tokensPerSec,
    contextLength, modelContextWindow, vramSpillMb
  ) VALUES (
    @model, @triggerType, @startTime, @endTime, @durationMs,
    @avgOllamaCpuPct, @peakOllamaCpuPct, @peakVramMb,
    @avgGpuUtilPct, @peakGpuWatts, @promptTokens, @evalTokens, @tokensPerSec,
    @contextLength, @modelContextWindow, @vramSpillMb
  )
`);

export function saveUsageLog(log: UsageLog) {
    return insertStmt.run(log);
}

export function getRecentLogs(limit = 50): UsageLog[] {
    return db.prepare(`SELECT * FROM usage_logs ORDER BY id DESC LIMIT ?`).all(limit) as UsageLog[];
}

export function hasRecentProxyLog(model: string, lookbackMs: number): boolean {
    const cutoff = new Date(Date.now() - lookbackMs).toISOString();
    const row = db.prepare(
        `SELECT 1 FROM usage_logs WHERE model = ? AND triggerType = 'proxy' AND startTime >= ? LIMIT 1`
    ).get(model, cutoff) as { 1: number } | undefined;
    return !!row;
}

export function clearAllLogs() {
    return db.prepare(`DELETE FROM usage_logs`).run();
}