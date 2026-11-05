export const CONFIG = {
    PORT: Number(process.env.PORT) || 11435,
    OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    TICK_INTERVAL_MS: 1000,
    MAX_RECENT_TICKS: 120,
    MIN_PASSIVE_SPIKE_MS: 1500,
};
