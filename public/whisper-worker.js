import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest';

env.allowLocalModels = false;

class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, {
                quantized: true,
                progress_callback,
            });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {

    const transcriber = await PipelineSingleton.getInstance(x => {
        self.postMessage(x);
    });

    const audioData = event.data;

    if (!(audioData instanceof Float32Array)) {
        return;
    }

    try {
        const output = await transcriber(audioData);
        if (output) {
            self.postMessage({ status: 'complete', output });
        }

    } catch (error) {
        self.postMessage({ status: 'error', error: `Transcription failed: ${error.message}` });
    }
});