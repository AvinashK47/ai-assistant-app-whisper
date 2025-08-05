"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");

  const [modelStatus, setModelStatus] = useState({
    loaded: false,
    progress: 0,
    file: "Initializing...",
  });

  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
          setTranscript(output.text);
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
    workerRef.current.postMessage(null); // Kick off model loading

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
      // --- STOP RECORDING ---
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // --- START RECORDING ---
      setTranscript("");
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

        <div className="mt-8 p-4 border rounded-lg w-full min-h-[150px] bg-white shadow-inner">
          <p className="text-gray-600 whitespace-pre-wrap">
            {transcript || "Your transcript will appear here..."}
          </p>
        </div>
      </div>
    </main>
  );
}
