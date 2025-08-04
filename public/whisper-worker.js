// public/whisper-worker.js

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest';

// Disable local model checks to prevent any potential request storms.
env.allowLocalModels = false;

// Use a Singleton pattern to ensure the pipeline is only created once.
class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'distil-whisper/distil-small.en';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, {
                quantized: true, // Use the smaller, memory-efficient quantized model
                progress_callback,
            });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    // 1. Retrieve the transcription pipeline.
    // This will load the model on the first message (sent on page load).
    const transcriber = await PipelineSingleton.getInstance(x => {
        self.postMessage(x);
    });

    const audioData = event.data;

    // 2. We only want to process the final audio Blob, not the initial null message.
    if (!(audioData instanceof Blob)) {
        return;
    }

    try {
        // 3. The library can process the complete audio Blob.
        // We convert it to an ArrayBuffer, which is a universal format.
        const arrayBuffer = await audioData.arrayBuffer();
        
        // 4. Pass the complete audio data to the transcriber.
        const output = await transcriber(arrayBuffer);

        // Send the final transcript back to the main thread
        if (output) {
            self.postMessage({ status: 'complete', output });
        }

    } catch (error) {
        self.postMessage({ status: 'error', error: `Transcription failed: ${error.message}` });
    }
});
