"use client";

import React, { useEffect, useRef } from "react";

export type AssistantState =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking";

interface AcousticCoreProps {
  state: AssistantState;
  audioLevel: number; // 0 to 1
  onClick: () => void;
  disabled?: boolean;
  engineName?: string;
  analyserNode?: AnalyserNode | null;
}

export default function AcousticCore({
  state,
  audioLevel = 0,
  onClick,
  disabled = false,
  engineName = "Web Speech",
  analyserNode = null,
}: AcousticCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render circular oscilloscope / frequency waveform on canvas when listening or speaking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const numBars = 32;
    const dataArray = new Uint8Array(numBars);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 64;

      if (state === "listening" && analyserNode) {
        analyserNode.getByteFrequencyData(dataArray);

        for (let i = 0; i < numBars; i++) {
          const angle = (i / numBars) * Math.PI * 2;
          const val = dataArray[i] / 255;
          const barHeight = Math.max(val * 34, 4);

          const x1 = centerX + Math.cos(angle) * baseRadius;
          const y1 = centerY + Math.sin(angle) * baseRadius;
          const x2 = centerX + Math.cos(angle) * (baseRadius + barHeight);
          const y2 = centerY + Math.sin(angle) * (baseRadius + barHeight);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 + val * 0.6})`;
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      } else if (state === "speaking") {
        let hasActiveSignal = false;
        if (analyserNode) {
          analyserNode.getByteFrequencyData(dataArray);
          for (let i = 0; i < numBars; i++) {
            if (dataArray[i] > 10) {
              hasActiveSignal = true;
              break;
            }
          }
        }

        const time = Date.now() * 0.006;
        for (let i = 0; i < numBars; i++) {
          const angle = (i / numBars) * Math.PI * 2;
          let barHeight = 4;

          if (hasActiveSignal && analyserNode) {
            const val = dataArray[i] / 255;
            barHeight = Math.max(val * 38, 4);
          } else {
            // Harmonic rhythmic fallback wave
            const wave = Math.sin(angle * 4 + time) * 0.5 + 0.5;
            barHeight = 4 + wave * 16;
          }

          const x1 = centerX + Math.cos(angle) * baseRadius;
          const y1 = centerY + Math.sin(angle) * baseRadius;
          const x2 = centerX + Math.cos(angle) * (baseRadius + barHeight);
          const y2 = centerY + Math.sin(angle) * (baseRadius + barHeight);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(16, 185, 129, ${0.5 + (barHeight / 40) * 0.5})`;
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, analyserNode]);

  const getStatusLabel = () => {
    switch (state) {
      case "listening":
        return "Listening • Tap or press Space to finish";
      case "transcribing":
        return `Transcribing audio with ${engineName}...`;
      case "thinking":
        return "Gemini synthesizing response...";
      case "speaking":
        return "Assistant speaking • Tap to interrupt";
      case "idle":
      default:
        return disabled ? "Initializing DSP core..." : "Ready • Tap to speak";
    }
  };

  const getSubBadge = () => {
    switch (state) {
      case "listening":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            LIVE MIC • {Math.round(audioLevel * 100)}%
          </span>
        );
      case "transcribing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-amber-950/80 text-amber-400 border border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-spin" />
            ONNX WASM INFERENCE
          </span>
        );
      case "thinking":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
            GEMINI LLM STREAM
          </span>
        );
      case "speaking":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            NEURAL AUDIO PLAYBACK
          </span>
        );
      case "idle":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            READY • [SPACE]
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center my-6 select-none">
      <div className="relative flex items-center justify-center w-64 h-64">
        {/* Dynamic Canvas Oscilloscope Ring */}
        <canvas
          ref={canvasRef}
          width={256}
          height={256}
          className="absolute inset-0 pointer-events-none z-0"
        />

        {/* Ambient Backlight Glow */}
        <div
          className={`absolute inset-4 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
            state === "listening"
              ? "bg-cyan-500/25 scale-110"
              : state === "transcribing"
              ? "bg-amber-500/20 scale-105"
              : state === "thinking"
              ? "bg-indigo-500/25 scale-110"
              : state === "speaking"
              ? "bg-emerald-500/25 scale-115"
              : "bg-cyan-600/10 scale-95"
          }`}
        />

        {/* Outer Machined Ring */}
        <div className="absolute inset-8 rounded-full border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm shadow-inner pointer-events-none" />

        {/* Central Core Push Trigger */}
        <button
          onClick={onClick}
          disabled={disabled && state === "idle"}
          aria-label={getStatusLabel()}
          className={`relative z-10 w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500/40 cursor-pointer active:scale-95 disabled:cursor-not-allowed ${
            state === "listening"
              ? "bg-gradient-to-b from-cyan-500 to-cyan-700 text-zinc-950 shadow-cyan-500/30 scale-105"
              : state === "transcribing"
              ? "bg-gradient-to-b from-amber-400 to-amber-600 text-zinc-950 shadow-amber-500/30 animate-pulse"
              : state === "thinking"
              ? "bg-gradient-to-b from-indigo-500 to-purple-600 text-white shadow-indigo-500/30"
              : state === "speaking"
              ? "bg-gradient-to-b from-emerald-500 to-teal-700 text-zinc-950 shadow-emerald-500/30 scale-105"
              : "bg-gradient-to-b from-zinc-800 to-zinc-900 text-zinc-100 hover:from-zinc-750 hover:to-zinc-850 shadow-black/60 border border-zinc-700/60"
          }`}
        >
          {/* Central Visual Icon */}
          {state === "listening" && (
            <div className="flex flex-col items-center gap-1">
              <span className="w-5 h-5 rounded-sm bg-zinc-950 animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-tight uppercase">STOP</span>
            </div>
          )}

          {state === "transcribing" && (
            <div className="flex flex-col items-center gap-1">
              <svg className="w-6 h-6 animate-spin text-zinc-950" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-[9px] font-mono font-bold tracking-tight uppercase">WASM</span>
            </div>
          )}

          {state === "thinking" && (
            <div className="flex flex-col items-center gap-1">
              <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[9px] font-mono font-bold tracking-tight uppercase">THINK</span>
            </div>
          )}

          {state === "speaking" && (
            <div className="flex flex-col items-center gap-1">
              <svg className="w-6 h-6 text-zinc-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <span className="text-[9px] font-mono font-bold tracking-tight uppercase">MUTE</span>
            </div>
          )}

          {state === "idle" && (
            <div className="flex flex-col items-center gap-1 text-zinc-300 hover:text-white">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
              </svg>
              <span className="text-[10px] font-mono font-medium tracking-wider uppercase text-zinc-400">MIC</span>
            </div>
          )}
        </button>
      </div>

      {/* Sub-badge Status Indicator */}
      <div className="mt-3 flex flex-col items-center gap-1.5">
        {getSubBadge()}
        <p className="text-xs text-zinc-400 font-sans tracking-tight">
          {getStatusLabel()}
        </p>
      </div>
    </div>
  );
}
