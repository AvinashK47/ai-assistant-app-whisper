// File: src/app/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");

  // --- 1. ADDED NEW STATE FOR THE LLM ---
  const [llmResponse, setLlmResponse] = useState("");
  const [isLoadingLlm, setIsLoadingLlm] = useState(false);
  const [llmError, setLlmError] = useState("");
  // --- END OF NEW STATE ---

  const [modelStatus, setModelStatus] = useState({
    loaded: false,
    progress: 0,
    file: "Initializing...",
  });

  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- 2. ADDED THE NEW FUNCTION TO CALL OUR API ROUTE ---
  const handleSendToLlm = async (text: string) => {
    setIsLoadingLlm(true);
    setLlmError("");
    setLlmResponse("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "API request failed");
      }

      const data = await response.json();
      setLlmResponse(data.response);
      // NEXT STAGE: We will trigger TTS from here
    } catch (err: unknown) {
      // <-- THE FIX: 'any' is replaced with 'unknown'
      console.error("Error calling LLM API:", err);
      // We now check if it's a real Error object before accessing .message
      if (err instanceof Error) {
        setLlmError(err.message);
      } else {
        setLlmError("An unknown error occurred.");
      }
    } finally {
      setIsLoadingLlm(false);
    }
  };
  // --- END OF NEW FUNCTION ---

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker("/whisper-worker.js", {
        type: "module",
      });
    }

    const onMessageReceived = (e: MessageEvent) => {
      const { status, output, file, progress, error } = e.data;
      switch (status) {
        case "initiate":
          setModelStatus({ loaded: false, progress: 0, file });
          break;
        case "progress":
          setModelStatus((prev) => ({ ...prev, progress, file }));
          break;
        case "ready":
          setModelStatus((prev) => ({ ...prev, loaded: true }));
          break;
        case "complete":
          // --- 3. KEY CHANGE: TRIGGER THE LLM CALL HERE ---
          const transcriptText = output.text;
          setTranscript(transcriptText);
          // When transcription is done, immediately send the text to the LLM
          handleSendToLlm(transcriptText);
          // --- END OF KEY CHANGE ---
          break;
        case "error":
          console.error("Worker error:", error);
          alert(
            "An error occurred during transcription. Please check the console."
          );
          break;
        default:
          break;
      }
    };

    workerRef.current.addEventListener("message", onMessageReceived);
    workerRef.current.postMessage(null);

    return () =>
      workerRef.current?.removeEventListener("message", onMessageReceived);
  }, []);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (!workerRef.current) return;
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const float32Array = audioBuffer.getChannelData(0);
      workerRef.current.postMessage(float32Array);
    } catch (error) {
      console.error("Error processing audio:", error);
      alert("Failed to process audio. Please try again.");
    }
  }, []);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      setTranscript("");
      // --- Also reset the LLM state on new recording ---
      setLlmResponse("");
      setLlmError("");
      // ---
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          processAudio(audioBlob);
        };
        recorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Error starting microphone:", error);
        alert("Could not start microphone. Please check permissions.");
      }
    }
  }, [isRecording, processAudio]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-24 bg-gray-50">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-gray-800">
        AI Assistant
      </h1>
      <div className="w-full max-w-2xl text-center">
        <button
          onClick={handleToggleRecording}
          disabled={!modelStatus.loaded}
          className={`px-6 py-3 rounded-full text-lg font-semibold text-white transition-all duration-300 ease-in-out shadow-md hover:shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed ${
            isRecording
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>

        {!modelStatus.loaded && (
          <div className="w-full max-w-sm mx-auto mt-4">
            <p className="text-sm text-gray-600 mb-1">
              {modelStatus.file} ({Math.round(modelStatus.progress)}%)
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-200"
                style={{ width: `${modelStatus.progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 border rounded-lg w-full min-h-[100px] bg-white shadow-inner">
          <p className="font-semibold text-gray-700">You said:</p>
          <p className="text-gray-600 whitespace-pre-wrap">
            {transcript || "..."}
          </p>
        </div>

        {/* --- 4. ADDED UI FOR THE LLM RESPONSE --- */}
        <div className="mt-4 p-4 border rounded-lg w-full min-h-[100px] bg-blue-50 shadow-inner">
          <p className="font-semibold text-gray-700">AI Assistant says:</p>
          {isLoadingLlm && <p className="text-gray-500">Thinking...</p>}
          {llmError && <p className="text-red-500">Error: {llmError}</p>}
          <p className="text-gray-800 whitespace-pre-wrap">
            {llmResponse || "..."}
          </p>
        </div>
        {/* --- END OF UI ADDITIONS --- */}
      </div>
    </main>
  );
}
