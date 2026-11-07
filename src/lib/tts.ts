/**
 * Studio Web Audio DSP Engine:
 * 1. Primary: Decodes 24kHz/44.1kHz WAV from Gemini 3.8 Flash Neural TTS directly through
 *    an unlocked Web Audio AudioContext connected to the visualizer AnalyserNode.
 * 2. Visualizer integration: Feeds real-time frequency data into the AcousticCore oscilloscope.
 * 3. Graceful fallback: If neural audio is unavailable, tests browser SpeechSynthesis with
 *    immediate safety watchdog so Linux/headless environments never freeze.
 */

export interface TTSState {
  isPlaying: boolean;
  currentText: string | null;
}

export class TTSController {
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private synth: SpeechSynthesis | null = null;
  private onStateChange?: (state: TTSState) => void;
  private analyserNode: AnalyserNode | null = null;

  constructor(
    onStateChange?: (state: TTSState) => void,
    analyserNode?: AnalyserNode | null
  ) {
    this.onStateChange = onStateChange;
    this.analyserNode = analyserNode || null;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public setAnalyser(analyser: AnalyserNode | null) {
    this.analyserNode = analyser;
  }

  /**
   * Unlock AudioContext on direct user interaction (click / keydown)
   * to comply with browser autoplay policies.
   */
  public async ensureAudioContext(): Promise<AudioContext | null> {
    if (typeof window === "undefined") return null;

    if (!this.audioCtx || this.audioCtx.state === "closed") {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === "suspended") {
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.warn("[TTS] Failed to resume AudioContext:", err);
      }
    }

    return this.audioCtx;
  }

  /**
   * Play high-fidelity base64 WAV audio via Web Audio API
   */
  public async playAudio(
    audioDataUrl: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    }
  ): Promise<number> {
    this.stop();
    const startTime = performance.now();

    try {
      const audioCtx = await this.ensureAudioContext();

      // Extract base64 payload from data URL
      const base64Index = audioDataUrl.indexOf(",");
      const base64String = base64Index !== -1 ? audioDataUrl.substring(base64Index + 1) : audioDataUrl;

      // Decode base64 to binary buffer
      const binaryString = atob(base64String);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (audioCtx) {
        // Decode audio buffer via Web Audio API
        const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        this.currentSource = source;

        // Route: Source -> Analyser (for visualizer) -> Destination (speakers)
        if (this.analyserNode) {
          source.connect(this.analyserNode);
          try {
            this.analyserNode.connect(audioCtx.destination);
          } catch {
            // Already connected
          }
        } else {
          source.connect(audioCtx.destination);
        }

        const latency = Math.round(performance.now() - startTime);

        source.onended = () => {
          this.currentSource = null;
          this.notifyState(false, null);
          options?.onEnd?.();
        };

        source.start(0);
        this.notifyState(true, "Playing AI voice");
        options?.onStart?.();

        return latency;
      } else {
        // Fallback to HTMLAudioElement if Web Audio is unsupported
        return this.playViaAudioElement(audioDataUrl, options);
      }
    } catch (err) {
      console.warn("[TTS] Web Audio decoding failed, attempting HTML5 Audio fallback:", err);
      return this.playViaAudioElement(audioDataUrl, options);
    }
  }

  /**
   * Fallback using standard HTML5 Audio element
   */
  private playViaAudioElement(
    audioDataUrl: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    }
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const audio = new Audio(audioDataUrl);
      this.currentAudioElement = audio;

      let started = false;

      const cleanup = () => {
        this.currentAudioElement = null;
        this.notifyState(false, null);
      };

      const safetyTimer = setTimeout(() => {
        cleanup();
        options?.onEnd?.();
      }, 15000);

      audio.onplay = () => {
        started = true;
        clearTimeout(safetyTimer);
        const latency = Math.round(performance.now() - startTime);
        this.notifyState(true, "Playing AI voice");
        options?.onStart?.();
        resolve(latency);
      };

      audio.onended = () => {
        clearTimeout(safetyTimer);
        cleanup();
        options?.onEnd?.();
      };

      audio.onerror = (err) => {
        clearTimeout(safetyTimer);
        cleanup();
        options?.onError?.(err);
        if (!started) reject(err);
      };

      audio.play().catch((err) => {
        clearTimeout(safetyTimer);
        cleanup();
        options?.onError?.(err);
        reject(err);
      });
    });
  }

  /**
   * Fallback text-to-speech using browser Web Speech synthesis with aggressive watchdog
   */
  public speakText(
    text: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    }
  ): Promise<number> {
    return new Promise((resolve) => {
      if (!this.synth) {
        options?.onEnd?.();
        resolve(0);
        return;
      }

      this.stop();

      const startTime = performance.now();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      let hasStarted = false;

      // Aggressive safety watchdog: Linux Chrome often queues indefinitely if speech-dispatcher is absent.
      const watchdog = setTimeout(() => {
        if (!hasStarted) {
          console.warn("[TTS] SpeechSynthesis did not start within 800ms. Aborting to prevent UI freeze.");
          this.stop();
          this.notifyState(false, null);
          options?.onEnd?.();
          resolve(0);
        }
      }, 800);

      utterance.onstart = () => {
        hasStarted = true;
        clearTimeout(watchdog);
        const latency = Math.round(performance.now() - startTime);
        this.notifyState(true, text);
        options?.onStart?.();
        resolve(latency);
      };

      utterance.onend = () => {
        clearTimeout(watchdog);
        this.notifyState(false, null);
        options?.onEnd?.();
      };

      utterance.onerror = (e) => {
        clearTimeout(watchdog);
        this.notifyState(false, null);
        options?.onError?.(e);
        resolve(0);
      };

      this.synth.speak(utterance);
    });
  }

  /**
   * Speak either neural audio (preferred) or text fallback
   */
  public async speak(
    payload: { audioUrl?: string | null; text: string },
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    }
  ): Promise<number> {
    if (payload.audioUrl) {
      try {
        return await this.playAudio(payload.audioUrl, options);
      } catch (err) {
        console.warn("[TTS] Neural audio failed, attempting speech fallback:", err);
      }
    }
    return await this.speakText(payload.text, options);
  }

  public stop() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Ignore if already stopped
      }
      this.currentSource = null;
    }

    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch {
        // Ignore
      }
      this.currentAudioElement = null;
    }

    if (this.synth && this.synth.speaking) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore
      }
    }

    this.notifyState(false, null);
  }

  private notifyState(isPlaying: boolean, currentText: string | null) {
    if (this.onStateChange) {
      this.onStateChange({
        isPlaying,
        currentText,
      });
    }
  }
}
