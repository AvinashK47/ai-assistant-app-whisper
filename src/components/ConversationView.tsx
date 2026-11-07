"use client";

import React, { useState } from "react";

export interface MessageTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  sttLatency?: number;
  llmLatency?: number;
  audioUrl?: string | null;
}

interface ConversationViewProps {
  turns: MessageTurn[];
  onReplayTTS: (turn: MessageTurn) => void;
  onStopAudio?: () => void;
  activePlayingId?: string | null;
  onClearHistory: () => void;
  onSelectPrompt: (promptText: string) => void;
  isLoading: boolean;
}

const SAMPLE_PROMPTS = [
  "Explain WebAssembly in one sentence.",
  "How does offline Whisper privacy work?",
  "Compare WebSockets with Server-Sent Events.",
  "What is the difference between TCP and UDP?",
];

export default function ConversationView({
  turns,
  onReplayTTS,
  onStopAudio,
  activePlayingId,
  onClearHistory,
  onSelectPrompt,
  isLoading,
}: ConversationViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full max-w-2xl flex flex-col gap-3 my-4">
      {/* Sample Prompts Row */}
      {turns.length === 0 && !isLoading && (
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            TRY A TEST QUERY:
          </span>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(prompt)}
                className="px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-750/70 hover:border-cyan-500/50 text-xs text-zinc-300 hover:text-white transition-all text-left cursor-pointer"
              >
                &ldquo;{prompt}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transcript Header */}
      {turns.length > 0 && (
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              SESSION LOG ({turns.length} {turns.length === 1 ? "TURN" : "TURNS"})
            </span>
            {activePlayingId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                PLAYING AUDIO
              </span>
            )}
          </div>
          <button
            onClick={onClearHistory}
            className="text-xs text-zinc-400 hover:text-rose-400 font-mono transition-colors cursor-pointer"
          >
            [Clear History]
          </button>
        </div>
      )}

      {/* Message Turns Reel */}
      <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
        {turns.map((turn) => {
          const isUser = turn.role === "user";
          const isPlaying = activePlayingId === turn.id;

          return (
            <div
              key={turn.id}
              className={`flex flex-col p-4 rounded-2xl border transition-all ${
                isUser
                  ? "bg-zinc-900/90 border-zinc-800 text-zinc-200 ml-4 sm:ml-8"
                  : isPlaying
                  ? "bg-gradient-to-b from-cyan-950/40 to-emerald-950/30 border-emerald-500/50 text-zinc-100 mr-4 sm:mr-8 shadow-lg shadow-emerald-950/20"
                  : "bg-cyan-950/20 border-cyan-900/40 text-cyan-50 mr-4 sm:mr-8 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isUser
                        ? "bg-cyan-400"
                        : isPlaying
                        ? "bg-emerald-400 animate-ping"
                        : "bg-emerald-400"
                    }`}
                  />
                  <span className="font-semibold tracking-tight text-zinc-200 text-xs">
                    {isUser ? "You" : "Gemini Voice Assistant"}
                  </span>
                  {!isUser && isPlaying && (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1 h-2 bg-emerald-400 animate-pulse" />
                      <span className="w-1 h-3.5 bg-emerald-400 animate-pulse delay-75" />
                      <span className="w-1 h-2 bg-emerald-400 animate-pulse delay-150" />
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-zinc-400">
                  {turn.timestamp}
                </span>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans text-zinc-200">
                {turn.text}
              </p>

              {/* Turn Action Footer */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-800/60 text-xs">
                <div className="flex items-center gap-3">
                  {!isUser && (
                    isPlaying ? (
                      <button
                        onClick={onStopAudio}
                        className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                        Stop Audio
                      </button>
                    ) : (
                      <button
                        onClick={() => onReplayTTS(turn)}
                        className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Play Audio
                      </button>
                    )
                  )}

                  <button
                    onClick={() => handleCopy(turn.text, turn.id)}
                    className="text-zinc-400 hover:text-zinc-200 text-[11px] font-mono transition-colors cursor-pointer"
                  >
                    {copiedId === turn.id ? "✓ Copied" : "Copy"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {turn.llmLatency && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      LLM: {turn.llmLatency}ms
                    </span>
                  )}
                  {turn.sttLatency !== undefined && turn.sttLatency > 0 && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      STT: {turn.sttLatency}ms
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Dynamic Loading State - Only shown when waiting for LLM */}
        {isLoading && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-cyan-950/20 border border-cyan-900/40 text-cyan-200 mr-8 animate-pulse">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <span className="text-xs font-mono tracking-wide">
              Gemini Flash Lite is synthesizing response...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
