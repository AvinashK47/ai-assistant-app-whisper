# Brag Plan: Offline-First AI Voice Assistant

## Planning Rubric
1. **What is it?**
   A real-time, privacy-first AI voice studio combining in-browser Whisper WASM speech recognition, low-latency LLM intelligence, and Gemini 3.8 Neural Speech synthesis with custom DSP playback.
2. **Who is it for?**
   Users, developers, and privacy advocates who want a conversational voice AI without sacrificing privacy by uploading unencrypted microphone audio to third-party cloud servers.
3. **What sets it apart?**
   WASM-powered on-device speech transcription running in parallel Web Workers, complete offline PWA caching, and real-time sub-second pipeline telemetry.
4. **Visual hook:**
   An electric emerald radial oscilloscope pulsing in an ultra-clean dark studio cockpit.
5. **Key UI to show:**
   The live Acoustic Voice Studio cockpit, showing active telemetry (STT 1505ms, LLM 1858ms, DSP playback) and interactive speech transcripts.
6. **Tone:**
   Polished, cinematic-tech, authoritative.
7. **Format & Duration:**
   Landscape 1920x1080 @ 30fps, 18.0 seconds.
8. **Audio Arc:**
   Punchy modern electronic groove (`happy-beats-business-moves-vol-11`) with crisp UI tactile clicks on state changes and a gentle fade-out at the outro.
9. **Share Caption:**
   "A voice assistant that runs speech models directly on your device. Zero audio uploaded. 100% private."

## Scene Storyboard (18.0s Total)
- **Scene 1 (0.0s - 3.2s) - The Hook:**
  - Dark cinematic background (#030712) with subtle radial grid.
  - Giant glowing headline: "WHAT IF YOUR VOICE ASSISTANT NEVER SENT AUDIO TO THE CLOUD?"
  - Badge entrance: `[ 100% Client-Side Privacy ]`
- **Scene 2 (3.2s - 8.5s) - The Acoustic Studio Reveal:**
  - 3D perspective transition into the real web application cockpit.
  - Floating illuminated device frame showcasing the glowing radial oscilloscope and real-time audio playback status.
  - Highlights: `Whisper ONNX WASM in Web Workers` • `Zero Main-Thread Freezes`.
- **Scene 3 (8.5s - 13.8s) - Live Telemetry & Conversation:**
  - Smooth camera zoom into the live pipeline metrics deck:
    - STT Inference: 1505ms (Local WASM)
    - LLM Generation: 1858ms (Gemini Flash Lite)
    - Voice Synth: 24kHz Studio WAV (Web Audio DSP)
  - Interactive transcript exchange:
    - User: "Hello, hello. What is Linux?"
    - AI: "Linux is an open-source operating system that powers everything..."
- **Scene 4 (13.8s - 18.0s) - Outro & GitHub CTA:**
  - Seamless pull-back to branded outro card.
  - Title: "Acoustic AI Voice Studio"
  - Tech badges: `Next.js 15` • `Transformers.js WASM` • `Gemini 3.8 Neural Speech`
  - GitHub repo link: `github.com/AvinashK47/ai-assistant-app-whisper`
