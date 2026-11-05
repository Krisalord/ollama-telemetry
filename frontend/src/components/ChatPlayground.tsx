import React, { useRef, useEffect } from 'react';
import { MessageSquare, RefreshCw, Trash2, Bot, User, Sparkles, ChevronUp, ChevronDown, StopCircle, Send, Cpu } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { ChatMessage } from '../types';

interface ChatPlaygroundProps {
  models: string[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  messages: ChatMessage[];
  prompt: string;
  setPrompt: (prompt: string) => void;
  isGenerating: boolean;
  showThinkingMap: Record<string, boolean>;
  toggleThinking: (id: string) => void;
  fetchModels: () => void;
  handleSendMessage: (e?: React.FormEvent) => void;
  handleStop: () => void;
  handleClearChat: () => void;
  enableDiagnosticMode: boolean;
  setEnableDiagnosticMode: (enabled: boolean | ((prev: boolean) => boolean)) => void;
}

export function ChatPlayground({
  models,
  selectedModel,
  setSelectedModel,
  messages,
  prompt,
  setPrompt,
  isGenerating,
  showThinkingMap,
  toggleThinking,
  fetchModels,
  handleSendMessage,
  handleStop,
  handleClearChat,
  enableDiagnosticMode,
  setEnableDiagnosticMode,
}: ChatPlaygroundProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '12px',
      border: '1px solid #334155',
      display: 'flex',
      flexDirection: 'column',
      height: '520px',
      maxHeight: '520px',
      overflow: 'hidden'
    }}>
      {/* Chat Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #334155',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#0f172a80',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="#38bdf8" />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Dashboard Chat & Prompt</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setEnableDiagnosticMode((prev) => !prev)}
            title="Toggle Hardware Diagnostic Mode (injects live GPU/VRAM/CPU stats & history logs into system prompt)"
            style={{
              background: enableDiagnosticMode ? '#0284c720' : 'transparent',
              color: enableDiagnosticMode ? '#38bdf8' : '#94a3b8',
              border: `1px solid ${enableDiagnosticMode ? '#0284c7' : '#475569'}`,
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Cpu size={14} color={enableDiagnosticMode ? '#38bdf8' : '#94a3b8'} />
            <span>Diagnostic Specialist {enableDiagnosticMode ? 'ON' : 'OFF'}</span>
          </button>

          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {models.length === 0 && <option value="">Loading models...</option>}
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchModels}
            title="Refresh installed models"
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#94a3b8',
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <RefreshCw size={13} />
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            disabled={messages.length === 0}
            title="Clear conversation"
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: messages.length === 0 ? '#475569' : '#f43f5e',
              padding: '4px 6px',
              cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: '#0b1329'
        }}
      >
        {messages.length === 0 && (
          <div style={{
            margin: 'auto',
            textAlign: 'center',
            color: '#64748b',
            maxWidth: '320px',
            fontSize: '13px'
          }}>
            <Bot size={36} color="#334155" style={{ marginBottom: '8px' }} />
            <p style={{ margin: 0, fontWeight: 500, color: '#94a3b8' }}>No messages yet</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
              Ask questions directly here. Requests run through the telemetry proxy and log live TPS and hardware metrics!
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '4px'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: '#94a3b8'
            }}>
              {msg.role === 'user' ? (
                <>
                  <span>You</span>
                  <User size={12} color="#38bdf8" />
                </>
              ) : (
                <>
                  <Bot size={12} color="#4ade80" />
                  <span>{msg.model || 'Assistant'}</span>
                </>
              )}
            </div>

            <div style={{
              maxWidth: '85%',
              background: msg.role === 'user' ? '#0284c7' : '#1e293b',
              color: '#f8fafc',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              fontSize: '13px',
              lineHeight: '1.5',
              wordBreak: 'break-word',
              textAlign: 'left',
              border: msg.role === 'user' ? 'none' : '1px solid #334155'
            }}>
              {msg.thinking && (
                <div style={{
                  marginBottom: '8px',
                  background: '#0f172a',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  overflow: 'hidden'
                }}>
                  <button
                    type="button"
                    onClick={() => toggleThinking(msg.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={12} color="#eab308" />
                      Thinking Process
                    </span>
                    {showThinkingMap[msg.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showThinkingMap[msg.id] && (
                    <div style={{
                      padding: '8px 10px',
                      fontSize: '11px',
                      color: '#cbd5e1',
                      borderTop: '1px solid #334155',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '140px',
                      overflowY: 'auto'
                    }}>
                      {msg.thinking}
                    </div>
                  )}
                </div>
              )}

              {msg.content ? (
                <div className="chat-markdown">
                  <Markdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {msg.content}
                  </Markdown>
                </div>
              ) : isGenerating && msg.role === 'assistant' ? (
                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Generating...</span>
              ) : null}

              {msg.stats?.tokensPerSec && (
                <div style={{
                  marginTop: '8px',
                  paddingTop: '6px',
                  borderTop: '1px solid #33415580',
                  display: 'flex',
                  gap: '10px',
                  fontSize: '11px',
                  color: '#4ade80'
                }}>
                  <span>⚡ {msg.stats.tokensPerSec} tok/s</span>
                  <span style={{ color: '#94a3b8' }}>• {msg.stats.evalTokens} tokens</span>
                  <span style={{ color: '#94a3b8' }}>• {msg.stats.evalDurationSec}s</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input Box */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '12px',
          borderTop: '1px solid #334155',
          display: 'flex',
          gap: '8px',
          background: '#0f172a'
        }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder={models.length ? `Message ${selectedModel || 'model'}... (Enter to send, Shift+Enter for newline)` : 'Connecting to Ollama...'}
          disabled={isGenerating}
          rows={1}
          style={{
            flex: 1,
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #475569',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '13px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            maxHeight: '80px'
          }}
        />

        {isGenerating ? (
          <button
            type="button"
            onClick={handleStop}
            style={{
              background: '#f43f5e',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <StopCircle size={15} />
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!prompt.trim()}
            style={{
              background: prompt.trim() ? '#0284c7' : '#334155',
              color: prompt.trim() ? '#fff' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: prompt.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            <Send size={15} />
            Send
          </button>
        )}
      </form>
    </div>
  );
}
