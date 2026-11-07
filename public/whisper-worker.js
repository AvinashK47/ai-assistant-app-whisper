import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1';

env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static task = 'automatic-speech-recognition';
  // Use official ONNX Community model for transformers.js v3
  static model = 'onnx-community/whisper-tiny.en';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      try {
        this.instance = await pipeline(this.task, this.model, {
          dtype: 'q8',
          device: 'wasm',
          progress_callback,
        });
      } catch (err) {
        console.warn(`[WhisperWorker] Failed with ${this.model}, falling back to Xenova/whisper-tiny.en`, err);
        this.model = 'Xenova/whisper-tiny.en';
        this.instance = await pipeline(this.task, this.model, {
          quantized: true,
          progress_callback,
        });
      }
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data) return;

  // 1. Initial preload / readiness check
  if (data.type === 'init') {
    try {
      console.log('[WhisperWorker] Preloading model in background...');
      await PipelineSingleton.getInstance((x) => {
        self.postMessage(x);
      });
      console.log('[WhisperWorker] Model ready!');
      self.postMessage({ status: 'ready', model: PipelineSingleton.model });
    } catch (error) {
      console.error('[WhisperWorker] Preload error:', error);
      self.postMessage({
        status: 'error',
        error: `Model load failed: ${error?.message || error}`,
      });
    }
    return;
  }

  // 2. Audio transcription
  if (data instanceof Float32Array) {
    const startTime = performance.now();
    try {
      const transcriber = await PipelineSingleton.getInstance((x) => {
        self.postMessage(x);
      });

      // NOTE: whisper-tiny.en is an English-only model.
      // Do NOT pass `language` or `task` parameters here as that throws an error in Transformers.js v3.
      const output = await transcriber(data, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });

      const elapsedMs = Math.round(performance.now() - startTime);

      if (output) {
        self.postMessage({
          status: 'complete',
          output,
          elapsedMs,
        });
      }
    } catch (error) {
      console.error('[WhisperWorker] Transcription error:', error);
      self.postMessage({
        status: 'error',
        error: `Transcription failed: ${error?.message || error}`,
      });
    }
  }
});
