const CACHE_NAME = 'offline-ai-assets-v1';
const MODEL_ASSETS_TO_CACHE = [
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/config.json',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/generation_config.json',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/preprocessor_config.json',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/tokenizer.json',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/merges.txt',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/vocab.json',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/encoder_model.onnx',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/decoder_model_merged.onnx',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest/dist/ort-wasm-simd-threaded.jsep.mjs',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest/dist/ort-wasm-simd-threaded.jsep.wasm',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(MODEL_ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (MODEL_ASSETS_TO_CACHE.includes(url.href)) {
    event.respondWith(
      caches.match(event.request).then((response) => response || fetch(event.request))
    );
  }
});