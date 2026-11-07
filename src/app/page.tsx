"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import AcousticCore, { AssistantState } from "@/components/AcousticCore";
import TelemetryDeck, { LatencyTelemetry } from "@/components/TelemetryBar";
import ConversationView, { MessageTurn } from "@/components/ConversationView";
import { TTSController } from "@/lib/tts";
import { resampleAudioBlobTo16kHz } from "@/lib/audio-utils";
import { WebSpeechRecognizer } from "@/lib/web-speech";

type STTEngine = "web-speech" | "whisper-wasm";
type VoicePersona = "Aoede" | "Fenrir" | "Puck" | "Kore";

const VOICE_PERSONAS: { id: VoicePersona; label: string; desc: string }[] = [
  { id: "Aoede", label: "Aoede", desc: "Studio Clear" },
  { id: "Fenrir", label: "Fenrir", desc: "Deep Male" },
  { id: "Puck", label: "Puck", desc: "Energetic" },
  { id: "Kore", label: "Kore", desc: "Warm Female" },
];

export default function Home() {
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [selectedEngine, setSelectedEngine] = useState<STTEngine>("web-speech");
  const [selectedVoice, setSelectedVoice] = useState<VoicePersona>("Aoede");
  const [liveInterimText, setLiveInterimText] = useState("");
  const [textInput, setTextInput] = useState("");
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);

  const [modelStatus, setModelStatus] = useState({
    loaded: false,
    progress: 0,
    file: "Background Whisper WASM: Idle",
  });

  const [telemetry, setTelemetry] = useState<LatencyTelemetry>({
    sttMs: null,
    llmMs: null,
    ttsMs: null,
    totalMs: null,
  });

  const [conversation, setConversation] = useState<MessageTurn[]>([]);
  const [isLlmLoading, setIsLlmLoading] = useState(false);

  // References
  const workerRef = useRef<Worker | null>(null);
  const webSpeechRef = useRef<WebSpeechRecognizer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const ttsRef = useRef<TTSController | null>(null);
  const turnStartTimeRef = useRef<number>(0);
  const spokenTextRef = useRef<string>("");

  // Initialize shared Web Audio Analyser
  const getOrCreateAnalyser = useCallback((): AnalyserNode | null => {
    if (analyserRef.current) return analyserRef.current;
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;
      const ctx = audioContextRef.current || new AudioCtxClass();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      return analyser;
    } catch {
      return null;
    }
  }, []);

  // Initialize TTS & WebSpeech
  useEffect(() => {
    const analyser = getOrCreateAnalyser();
    const tts = new TTSController((state) => {
      if (!state.isPlaying) {
        setAssistantState("idle");
        setActivePlayingId(null);
      }
    }, analyser);

    ttsRef.current = tts;
    webSpeechRef.current = new WebSpeechRecognizer();

    return () => {
      tts.stop();
      webSpeechRef.current?.stop();
    };
  }, [getOrCreateAnalyser]);

  // Audio level monitoring during recording
  const startAudioMeter = useCallback((stream: MediaStream) => {
    try {
      const analyser = getOrCreateAnalyser();
      if (!analyser || !audioContextRef.current) return;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setAudioLevel(Math.min(average / 128, 1));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.warn("Could not start audio level visualizer:", err);
    }
  }, [getOrCreateAnalyser]);

  const stopAudioMeter = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Play Neural Audio or SpeechSynthesis
  const playAudioTurn = useCallback(
    async (turn: MessageTurn) => {
      if (!ttsRef.current) return;

      // Ensure audio context is running
      await ttsRef.current.ensureAudioContext();

      setAssistantState("speaking");
      setActivePlayingId(turn.id);
      const ttsStartTime = performance.now();

      try {
        const timeToFirstSound = await ttsRef.current.speak(
          { text: turn.text, audioUrl: turn.audioUrl },
          {
            onEnd: () => {
              setAssistantState("idle");
              setActivePlayingId(null);
            },
            onError: () => {
              setAssistantState("idle");
              setActivePlayingId(null);
            },
          }
        );

        const latency = timeToFirstSound || Math.round(performance.now() - ttsStartTime);
        setTelemetry((prev) => {
          const total = (prev.sttMs || 0) + (prev.llmMs || 0) + latency;
          return { ...prev, ttsMs: latency, totalMs: total };
        });
      } catch (err) {
        console.warn("Audio playback ended/interrupted:", err);
        setAssistantState("idle");
        setActivePlayingId(null);
      }
    },
    []
  );

  // Stop currently playing audio
  const handleStopAudio = useCallback(() => {
    ttsRef.current?.stop();
    setAssistantState("idle");
    setActivePlayingId(null);
  }, []);

  // Send prompt to Gemini API
  const handleSendToLlm = useCallback(
    async (promptText: string, sttDuration: number) => {
      // Warm up audio context on user action
      ttsRef.current?.ensureAudioContext().catch(() => {});

      setIsLlmLoading(true);
      setAssistantState("thinking");
      setLiveInterimText("");
      const llmStartTime = performance.now();

      // Add user turn to conversation
      const userTurnId = crypto.randomUUID();
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      setConversation((prev) => [
        ...prev,
        {
          id: userTurnId,
          role: "user",
          text: promptText,
          timestamp,
          sttLatency: sttDuration,
        },
      ]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            voice: selectedVoice,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "LLM request failed");
        }

        const data = await response.json();
        const llmDuration = Math.round(performance.now() - llmStartTime);

        setTelemetry((prev) => ({
          ...prev,
          llmMs: llmDuration,
        }));

        const assistantReply = data.response;
        const neuralAudioUrl = data.audio || null;
        const assistantTurnId = crypto.randomUUID();

        // Release loading indicator immediately so it never hangs
        setIsLlmLoading(false);

        const assistantTurn: MessageTurn = {
          id: assistantTurnId,
          role: "assistant",
          text: assistantReply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          llmLatency: llmDuration,
          audioUrl: neuralAudioUrl,
        };

        // Add assistant turn to conversation
        setConversation((prev) => [...prev, assistantTurn]);

        // Trigger Audio Playback directly
        await playAudioTurn(assistantTurn);
      } catch (err: unknown) {
        console.error("Error generating LLM response:", err);
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred with Gemini.";
        setConversation((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: `⚠️ Error: ${errorMessage}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setAssistantState("idle");
        setIsLlmLoading(false);
      }
    },
    [playAudioTurn, selectedVoice]
  );

  // Initialize Whisper Web Worker in background
  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker("/whisper-worker.js", {
        type: "module",
      });
    }

    const onMessageReceived = (e: MessageEvent) => {
      const data = e.data;
      if (!data) return;

      switch (data.status) {
        case "initiate":
          setModelStatus({ loaded: false, progress: 0, file: data.file || "Downloading..." });
          break;
        case "progress":
          setModelStatus((prev) => ({
            ...prev,
            progress: data.progress || 0,
            file: data.file || prev.file,
          }));
          break;
        case "ready":
        case "done":
          setModelStatus({ loaded: true, progress: 100, file: "Whisper WASM Ready" });
          break;
        case "complete": {
          const transcriptText = data.output?.text?.trim() || "";
          const sttDuration = data.elapsedMs || Math.round(performance.now() - turnStartTimeRef.current);

          setTelemetry((prev) => ({
            ...prev,
            sttMs: sttDuration,
          }));

          if (transcriptText.length > 0) {
            handleSendToLlm(transcriptText, sttDuration);
          } else {
            alert("No speech detected. Please speak closer to your microphone.");
            setAssistantState("idle");
          }
          break;
        }
        case "error":
          console.warn("Worker error:", data.error);
          setModelStatus((prev) => ({ ...prev, file: "Whisper Offline Error" }));
          alert(`Whisper transcription error: ${data.error || "Unknown error"}`);
          setAssistantState("idle");
          break;
        default:
          break;
      }
    };

    workerRef.current.addEventListener("message", onMessageReceived);

    return () => {
      workerRef.current?.removeEventListener("message", onMessageReceived);
    };
  }, [handleSendToLlm]);

  // Audio processing pipeline for Whisper WASM
  const processAudioWhisper = useCallback(async (audioBlob: Blob) => {
    if (!workerRef.current) return;
    setAssistantState("transcribing");
    turnStartTimeRef.current = performance.now();

    try {
      const float32Array = await resampleAudioBlobTo16kHz(audioBlob);
      workerRef.current.postMessage(float32Array);
    } catch (error) {
      console.error("Audio resampling / processing error:", error);
      alert("Failed to decode audio from microphone. Please try again.");
      setAssistantState("idle");
    }
  }, []);

  // Start or Stop Voice Recording
  const handleOrbClick = useCallback(async () => {
    // Warm up audio context on click
    ttsRef.current?.ensureAudioContext().catch(() => {});

    // 1. If currently speaking, interrupt speech immediately
    if (assistantState === "speaking") {
      handleStopAudio();
      return;
    }

    // 2. If listening, stop listening and finalize
    if (assistantState === "listening") {
      if (selectedEngine === "web-speech") {
        webSpeechRef.current?.stop();
        stopAudioMeter();
        const text = spokenTextRef.current.trim();
        const sttDuration = Math.round(performance.now() - turnStartTimeRef.current);

        setTelemetry((prev) => ({ ...prev, sttMs: sttDuration }));

        if (text) {
          handleSendToLlm(text, sttDuration);
        } else {
          alert("No speech detected. You can speak into your microphone or type below.");
          setAssistantState("idle");
        }
      } else {
        // Whisper WASM stop
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        stopAudioMeter();
      }
      return;
    }

    // 3. Start Listening
    if (assistantState === "idle") {
      spokenTextRef.current = "";
      setLiveInterimText("");
      turnStartTimeRef.current = performance.now();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        mediaStreamRef.current = stream;
        startAudioMeter(stream);

        if (selectedEngine === "web-speech") {
          if (webSpeechRef.current?.isSupported()) {
            webSpeechRef.current.start({
              onResult: (text) => {
                spokenTextRef.current = text;
                setLiveInterimText(text);
              },
              onError: (err) => {
                console.warn("WebSpeech error:", err);
                stopAudioMeter();
                setAssistantState("idle");
                if (err === "not-allowed") {
                  alert("Microphone permission was denied. Please allow microphone access.");
                } else if (err === "network") {
                  alert("Web Speech API network error. Switching automatically to Whisper WASM.");
                  setSelectedEngine("whisper-wasm");
                  if (!modelStatus.loaded) {
                    workerRef.current?.postMessage({ type: "init" });
                  }
                }
              },
              onEnd: () => {},
            });
            setAssistantState("listening");
          } else {
            alert("Web Speech API is not supported in this browser. Switching to Whisper WASM.");
            setSelectedEngine("whisper-wasm");
            if (!modelStatus.loaded) {
              workerRef.current?.postMessage({ type: "init" });
            }
          }
        } else {
          // Whisper WASM recording
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          recorder.onstop = () => {
            stopAudioMeter();
            const audioBlob = new Blob(audioChunksRef.current, {
              type: recorder.mimeType || "audio/webm",
            });
            processAudioWhisper(audioBlob);
          };

          recorder.start();
          setAssistantState("listening");
        }
      } catch (err) {
        console.error("Microphone access error:", err);
        alert("Please grant microphone permissions to talk to the AI Assistant.");
        setAssistantState("idle");
      }
    }
  }, [
    assistantState,
    handleSendToLlm,
    handleStopAudio,
    modelStatus.loaded,
    processAudioWhisper,
    selectedEngine,
    startAudioMeter,
    stopAudioMeter,
  ]);

  // Handle Manual Text Submission
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isLlmLoading) return;
    const prompt = textInput.trim();
    setTextInput("");
    setTelemetry((prev) => ({ ...prev, sttMs: 0 }));
    handleSendToLlm(prompt, 0);
  };

  // Keyboard shortcut (Spacebar toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        handleOrbClick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOrbClick]);

  return (
    <main className="min-h-screen bg-[#090b10] text-zinc-100 flex flex-col items-center justify-between p-4 sm:p-8 font-sans selection:bg-cyan-500 selection:text-zinc-950">
      {/* Top Header */}
      <header className="w-full max-w-2xl flex flex-wrap items-center justify-between gap-3 py-3 border-b border-zinc-850/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-700/60 flex items-center justify-center shadow-lg shadow-black/40">
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
                Acoustic AI Voice Studio
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-medium">
                PWA v1.0
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              WASM Whisper • Web Audio DSP • Gemini Flash Lite • Neural TTS
            </p>
          </div>
        </div>

        {/* Engine Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs">
          <button
            onClick={() => setSelectedEngine("web-speech")}
            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              selectedEngine === "web-speech"
                ? "bg-cyan-500 text-zinc-950 font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ⚡ Web Speech
          </button>
          <button
            onClick={() => {
              setSelectedEngine("whisper-wasm");
              if (!modelStatus.loaded) {
                workerRef.current?.postMessage({ type: "init" });
              }
            }}
            className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedEngine === "whisper-wasm"
                ? "bg-indigo-600 text-white font-semibold shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>🛡️ Whisper WASM</span>
            {modelStatus.loaded ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>
      </header>

      {/* Whisper Download Progress (if loading) */}
      {selectedEngine === "whisper-wasm" && !modelStatus.loaded && (
        <div className="w-full max-w-md my-3 p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl">
          <div className="flex justify-between text-xs text-zinc-400 mb-1.5 font-mono">
            <span>{modelStatus.file}</span>
            <span className="text-cyan-400">{Math.round(modelStatus.progress)}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-cyan-400 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(modelStatus.progress, 5)}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-400 mt-2 text-center font-mono">
            Caching quantized ONNX model weights into browser IndexedDB...
          </p>
        </div>
      )}

      {/* Voice Persona Selector Pill Deck */}
      <div className="w-full max-w-2xl flex items-center justify-between gap-2 mt-4 px-1 text-xs">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
          AI VOICE PERSONA:
        </span>
        <div className="flex items-center gap-1.5">
          {VOICE_PERSONAS.map((voice) => (
            <button
              key={voice.id}
              onClick={() => setSelectedVoice(voice.id)}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all cursor-pointer ${
                selectedVoice === voice.id
                  ? "bg-zinc-800 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-950"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800/60"
              }`}
            >
              {voice.label}{" "}
              <span className="text-[9px] text-zinc-400 opacity-80">({voice.desc})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Acoustic Core Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <AcousticCore
          state={assistantState}
          audioLevel={audioLevel}
          onClick={handleOrbClick}
          disabled={false}
          engineName={selectedEngine === "web-speech" ? "Web Speech" : "Whisper WASM"}
          analyserNode={analyserRef.current}
        />

        {/* Live Interim Speech Preview */}
        {assistantState === "listening" && liveInterimText && (
          <div className="w-full max-w-md my-2 px-4 py-2 rounded-xl bg-zinc-900/90 border border-cyan-500/40 text-center animate-pulse">
            <span className="text-xs text-zinc-400 font-mono">LIVE: </span>
            <span className="text-sm font-medium text-cyan-200 italic">&ldquo;{liveInterimText}&rdquo;</span>
          </div>
        )}

        {/* Real-Time DSP Telemetry Deck */}
        <TelemetryDeck
          telemetry={telemetry}
          modelLoaded={selectedEngine === "web-speech" ? true : modelStatus.loaded}
          engineName={selectedEngine === "web-speech" ? "Web Speech API (Browser)" : "Whisper-tiny.en (ONNX WASM)"}
        />

        {/* Studio Command Bar / Text Input Fallback */}
        <form onSubmit={handleTextSubmit} className="w-full max-w-2xl flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your question or tap microphone above..."
              disabled={isLlmLoading}
              className="w-full bg-zinc-900/90 border border-zinc-800/90 focus:border-cyan-500/80 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none transition-all pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500 pointer-events-none">
              [ENTER]
            </span>
          </div>
          <button
            type="submit"
            disabled={!textInput.trim() || isLlmLoading}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-850 disabled:text-zinc-600 text-zinc-950 text-xs font-semibold transition-all cursor-pointer shadow-md shadow-cyan-500/20"
          >
            Ask
          </button>
        </form>
      </div>

      {/* Conversation Log & Replay View */}
      <ConversationView
        turns={conversation}
        onReplayTTS={playAudioTurn}
        onStopAudio={handleStopAudio}
        activePlayingId={activePlayingId}
        onClearHistory={() => setConversation([])}
        onSelectPrompt={(prompt) => {
          setTelemetry((prev) => ({ ...prev, sttMs: 0 }));
          handleSendToLlm(prompt, 0);
        }}
        isLoading={isLlmLoading}
      />

      {/* Footer */}
      <footer className="w-full max-w-2xl py-3 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-850/80 font-mono">
        <span>Acoustic AI Voice Assistant • Avinash Kushwaha</span>
        <span className="hidden sm:inline">Shortcuts: [Space] Mic • [Enter] Submit</span>
      </footer>
    </main>
  );
}
