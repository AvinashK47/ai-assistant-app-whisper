/**
 * Resamples an AudioBuffer or Float32Array to 16,000 Hz, which is the required
 * input sampling rate for Whisper models.
 */
export async function resampleAudioBlobTo16kHz(audioBlob: Blob): Promise<Float32Array> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  
  // Create an AudioContext at native hardware sample rate to decode the compressed stream (webm/ogg/mp4)
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  
  try {
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // If already 16kHz and single channel, return directly
    if (decodedBuffer.sampleRate === 16000 && decodedBuffer.numberOfChannels === 1) {
      return decodedBuffer.getChannelData(0);
    }
    
    // Use OfflineAudioContext for high-fidelity resampling to 16000Hz mono
    const targetSampleRate = 16000;
    const duration = decodedBuffer.duration;
    const offlineContext = new OfflineAudioContext(
      1,
      Math.ceil(duration * targetSampleRate),
      targetSampleRate
    );
    
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = decodedBuffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);
    
    const renderedBuffer = await offlineContext.startRendering();
    return renderedBuffer.getChannelData(0);
  } finally {
    if (audioContext.state !== "closed") {
      await audioContext.close();
    }
  }
}
