import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest';

// Disable local model checks
env.allowLocalModels = false;

// Use a Singleton pattern to ensure the pipeline is only created once.
class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en'; // Using the more accurate model
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

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    // 1. Retrieve the transcription pipeline.
    const transcriber = await PipelineSingleton.getInstance(x => {
        self.postMessage(x);
    });

    const audioData = event.data;

    // 2. We only want to process Float32Array data.
    if (!(audioData instanceof Float32Array)) {
        return;
    }

    try {
        // 3. The transcriber will now receive the correct format.
        const output = await transcriber(audioData, {
            // chunk_length_s: 30,
            // stride_length_s: 5,
        });

        // Send the final transcript back to the main thread
        if (output) {
            self.postMessage({ status: 'complete', output });
        }

    } catch (error) {
        self.postMessage({ status: 'error', error: `Transcription failed: ${error.message}` });
    }
});