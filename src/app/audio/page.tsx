"use client";

import { useRef, useState } from "react";

export default function AudioRecorder() {
  const [micPermission, setmicPermission] = useState(false);
  const [recordStatus, setRecordStatus] = useState(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  async function getMicPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setmicPermission(true);
      console.log("Permission for mic granted.");
      return stream;
    } catch (error) {
      console.error(
        "Permission Denied , user denied/blocked the request. ",
        error
      );
      alert("You must allow the microphone access to record audio");
      return null;
    }
  }
  const startRecording = async () => {
    const stream = await getMicPermission();
    if (stream) {
      setRecordStatus(true);
      const recorder = new MediaRecorder(stream);

      mediaRecorder.current = recorder;
      mediaRecorder.current.start();

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };
    }
  };

  const stopRecording = async () => {
    if (mediaRecorder.current) {
      setRecordStatus(false);

      mediaRecorder.current.stop();

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log("FINAL AUDIO URL : ", audioUrl);
        audioChunks.current = [];
      };
      mediaRecorder.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  return (
    <div>
      <h2>Audio recorder</h2>
      <button onClick={getMicPermission}>get user permission</button>
      <div>
        <h2>Audio Recorder</h2>
        <main>
          {!micPermission ? (
            <button onClick={getMicPermission}>Get Mic Permission</button>
          ) : null}

          {micPermission && recordStatus === false ? (
            <button onClick={startRecording}>Start Recording</button>
          ) : null}

          {recordStatus === true ? (
            <button onClick={stopRecording}>Stop Recording</button>
          ) : null}
        </main>
      </div>
    </div>
  );
}
