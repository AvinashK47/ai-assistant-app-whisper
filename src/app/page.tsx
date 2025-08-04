"use client";

import { useState, useRef } from "react";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");

  // Use a ref to hold the MediaRecorder instance
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const handleToggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            // In the next step, we will send this audio data to the Web Worker
            console.log("Audio data available:", event.data);
          }
        };

        mediaRecorder.start(500); // Collect audio in 0.5-second chunks
        setIsRecording(true);
      } catch (error) {
        console.error("Error accessing microphone:", error);
        alert(
          "Microphone access denied. Please allow microphone access in your browser settings."
        );
      }
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">AI Assistant</h1>

      <button
        onClick={handleToggleRecording}
        className={`px-6 py-3 rounded-full text-lg font-semibold ${
          isRecording
            ? "bg-red-500 hover:bg-red-600"
            : "bg-blue-500 hover:bg-blue-600"
        } text-white transition-colors`}
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>

      <div className="mt-8 p-4 border rounded-lg w-full max-w-2xl min-h-[100px] bg-gray-50">
        <p className="text-gray-800">
          {transcript || "Your transcript will appear here..."}
        </p>
      </div>
    </main>
  );
}
