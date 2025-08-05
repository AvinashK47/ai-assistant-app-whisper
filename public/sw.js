// public/sw.js

const CACHE_NAME = 'offline-ai-assets-v5-whisper-tiny'; // New version for the new model
const MODEL_ASSETS_TO_CACHE = [
  // --- URLs for Xenova/whisper-tiny.en (Quantized) ---
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/config.json',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/generation_config.json',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/preprocessor_config.json',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/tokenizer.json',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/merges.txt',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/vocab.json',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/encoder_model_quantized.onnx',
  'https://huggingface.co/Xenova/whisper-tiny.en/resolve/main/onnx/decoder_model_merged_quantized.onnx',

  // --- ONNX Runtime (WASM files) ---
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest/dist/ort-wasm-simd-threaded.jsep.mjs',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest/dist/ort-wasm-simd-threaded.jsep.wasm',
];

// On install, cache all our model assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log(`Service Worker: Caching new model assets in ${CACHE_NAME}`);
      return cache.addAll(MODEL_ASSETS_TO_CACHE);
    })
  );
});

// On fetch, serve from cache if available
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (MODEL_ASSETS_TO_CACHE.includes(url.href)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// Clean up old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`Service Worker: Deleting old cache ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});