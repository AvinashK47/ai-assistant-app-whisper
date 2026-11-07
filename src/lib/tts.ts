/**
 * Client-Side Text-To-Speech (TTS) manager using Web Speech Synthesis API.
 * Provides voice selection, playback controls, and latency measurement.
 */

export interface TTSState {
  isPlaying: boolean;
  isSupported: boolean;
  currentText: string | null;
}

export class TTSController {
  private synth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private onStateChange?: (state: TTSState) => void;

  constructor(onStateChange?: (state: TTSState) => void) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.onStateChange = onStateChange;
      this.loadVoices();

      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    // Prioritize natural English voices
    const preferredVoice = voices.find(
      (v) =>
        (v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Daniel") || v.name.includes("Karen"))) ||
        v.lang === "en-US"
    ) || voices.find((v) => v.lang.startsWith("en")) || voices[0];

    this.selectedVoice = preferredVoice || null;
  }

  public speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    }
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error("Speech synthesis not supported in this browser."));
        return;
      }

      this.stop();

      const startTime = performance.now();
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = options?.rate ?? 1.05;
      utterance.pitch = options?.pitch ?? 1.0;

      utterance.onstart = () => {
        const timeToStart = Math.round(performance.now() - startTime);
        this.notifyState(true, text);
        options?.onStart?.();
        resolve(timeToStart);
      };

      utterance.onend = () => {
        this.notifyState(false, null);
        options?.onEnd?.();
      };

      utterance.onerror = (e) => {
        this.notifyState(false, null);
        options?.onError?.(e);
        reject(e);
      };

      this.synth.speak(utterance);
    });
  }

  public stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
      this.notifyState(false, null);
    }
  }

  public isSpeaking(): boolean {
    return !!this.synth && this.synth.speaking;
  }

  private notifyState(isPlaying: boolean, currentText: string | null) {
    if (this.onStateChange) {
      this.onStateChange({
        isPlaying,
        isSupported: !!this.synth,
        currentText,
      });
    }
  }
}
