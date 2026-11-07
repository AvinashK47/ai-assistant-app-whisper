"use client";

import React from "react";

export interface LatencyTelemetry {
  sttMs: number | null;
  llmMs: number | null;
  ttsMs: number | null;
  totalMs: number | null;
}

interface TelemetryDeckProps {
  telemetry: LatencyTelemetry;
  modelLoaded: boolean;
  engineName: string;
}

export default function TelemetryDeck({
  telemetry,
  modelLoaded,
  engineName,
}: TelemetryDeckProps) {
  const formatTime = (ms: number | null) => (ms !== null ? `${ms}ms` : "—");

  return (
    <div className="w-full max-w-2xl bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-4 my-3 shadow-xl text-xs">
      {/* Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                modelLoaded ? "bg-emerald-400" : "bg-cyan-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                modelLoaded ? "bg-emerald-500" : "bg-cyan-500"
              }`}
            />
          </span>
          <span className="font-mono text-[11px] text-zinc-300 tracking-wide font-medium">
            ACTIVE PIPELINE: <span className="text-zinc-100">{engineName}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
          <span className="px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60">
            16kHz • Mono Float32
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
            Client-Side Privacy
          </span>
        </div>
      </div>

      {/* Grid of Telemetry Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
        {/* STT Metric */}
        <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">STT Inference</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </div>
          <span className="font-mono text-base font-bold text-zinc-100 mt-1">
            {formatTime(telemetry.sttMs)}
          </span>
          <span className="text-[9px] text-zinc-400 font-mono">
            {engineName.includes("Whisper") ? "WASM Local" : "Web Speech API"}
          </span>
        </div>

        {/* LLM Metric */}
        <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">LLM Generation</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          </div>
          <span className="font-mono text-base font-bold text-zinc-100 mt-1">
            {formatTime(telemetry.llmMs)}
          </span>
          <span className="text-[9px] text-zinc-400 font-mono">Gemini Flash Lite</span>
        </div>

        {/* TTS Metric */}
        <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Voice Synth</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <span className="font-mono text-base font-bold text-zinc-100 mt-1">
            {formatTime(telemetry.ttsMs)}
          </span>
          <span className="text-[9px] text-zinc-400 font-mono">Web Audio TTS</span>
        </div>

        {/* Total Turnaround */}
        <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider">Roundtrip</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>
          <span className="font-mono text-base font-bold text-amber-400 mt-1">
            {formatTime(telemetry.totalMs)}
          </span>
          <span className="text-[9px] text-zinc-400 font-mono">End-to-End Latency</span>
        </div>
      </div>
    </div>
  );
}
