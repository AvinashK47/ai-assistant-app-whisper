/**
 * Browser-native Speech Recognition (Web Speech API) wrapper.
 * Provides instant, zero-download, zero-latency speech-to-text.
 */

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export class WebSpeechRecognizer {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening = false;
  private onResultCallback?: (text: string, isFinal: boolean) => void;
  private onErrorCallback?: (err: string) => void;
  private onEndCallback?: () => void;

  constructor() {
    if (typeof window !== "undefined") {
      const SpeechRecognitionClass =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";

        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = "";
          let interimTranscript = "";

          // Iterate through the full result list to build complete sentence
          for (let i = 0; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + " ";
            } else {
              interimTranscript += transcript;
            }
          }

          const fullText = (finalTranscript + interimTranscript).trim();
          if (fullText) {
            this.onResultCallback?.(fullText, !!finalTranscript);
          }
        };

        this.recognition.onerror = (event: { error: string }) => {
          console.warn("WebSpeech recognition error:", event.error);
          this.onErrorCallback?.(event.error);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          this.onEndCallback?.();
        };
      }
    }
  }

  public isSupported(): boolean {
    return !!this.recognition;
  }

  public start(callbacks: {
    onResult: (text: string, isFinal: boolean) => void;
    onError?: (err: string) => void;
    onEnd?: () => void;
  }) {
    if (!this.recognition) return;
    this.onResultCallback = callbacks.onResult;
    this.onErrorCallback = callbacks.onError;
    this.onEndCallback = callbacks.onEnd;

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (err) {
      console.warn("Recognition already started or error:", err);
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn("Error stopping recognition:", err);
      }
      this.isListening = false;
    }
  }

  public abort() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (err) {
        console.warn("Error aborting recognition:", err);
      }
      this.isListening = false;
    }
  }
}
