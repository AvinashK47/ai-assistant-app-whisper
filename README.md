# Offline-First AI Voice Assistant

A real-time, privacy-focused voice assistant that runs speech-to-text and text-to-speech directly in the browser, using a cloud-based LLM for intelligence.

---

## 🚀 Core Features

* **Offline-First Architecture:** Built as a Progressive Web App (PWA). After the first visit, the entire application interface and all AI models load instantly, even without an internet connection.
* **Local, In-Browser Speech-to-Text:** User's voice is transcribed directly on their device using a WASM-powered Whisper model. No audio data ever leaves the browser, ensuring maximum privacy and low latency.
* **Real-time LLM Integration:** Seamlessly connects to OpenAI's API via a secure backend proxy to provide intelligent, conversational responses.
* **[IN PROGRESS] Local, In-Browser Text-to-Speech:** Generates audio responses directly on the user's device for instant playback, completing the private, low-latency interaction loop.
* **Performance Monitoring:** Real-time logging of latencies for each stage of the process (STT, LLM, TTS) to measure and optimize performance.

## 🛠️ Tech Stack

| Category              | Technology                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Framework** | [Next.js](https://nextjs.org/) 15                                                                   |
| **Language** | [TypeScript](https://www.typescriptlang.org/)                                                               |
| **PWA & Offline** | [next-pwa](https://www.npmjs.com/package/next-pwa)                                                          |
| **Local AI Models** | [Transformers.js](https://huggingface.co/docs/transformers.js/index) (@xenova/transformers) for Whisper & TTS |
| **Cloud AI** | [OpenAI API](https://openai.com/blog/openai-api) (Chat Completion)                                          |
| **Concurrency** | [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)                             |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/)                                                                    |

## 🏛️ Architecture & Design Decisions

This project was built with a specific set of modern architectural patterns.

### 1. Why an Offline-First PWA?

The application is architected as a PWA to ensure reliability and a native-app-like experience.

* **The Butler Analogy:** The **Service Worker** acts like a personal butler for the app. On the first visit, it is "hired" (installed) and immediately fetches and stores all critical assets—including the heavy AI models—in a local cache. On subsequent visits, even if the internet is down, the butler can instantly serve the app from this cache without needing to go to the network.
* **Benefit:** This fulfills the core "runs offline" requirement and provides a vastly superior user experience with instant load times.

### 2. Why Local, In-Browser AI (STT/TTS)?

Handling audio on the device was a deliberate choice driven by three key factors:

* **Latency:** Sending audio files to a server for processing is slow. By running Whisper and TTS models locally, we eliminate the upload/download time for audio, reducing the total response time significantly. The only network request is for tiny packets of text to the OpenAI API.
* **Privacy:** The user's voice is sensitive data. In this architecture, raw audio never leaves the user's machine. This is a massive privacy win and a critical feature for a modern application.
* **Cost:** Server-side audio processing can be expensive. Offloading this computation to the client's browser reduces server load and operational costs to nearly zero for these tasks.

### 3. Why Web Workers?

Running an AI model is computationally intensive. If run on the main browser thread, it would freeze the UI, leading to a terrible user experience.

* **The Back Room Analogy:** **Web Workers** are like a back room for our application's shop. We send the heavy audio processing task to an "assistant" (the worker) in the back room. While the assistant is working hard, the main storefront (the UI) remains completely responsive, allowing for smooth animations and user interaction.

### 4. Why a Backend-for-Frontend (BFF) API Route?

Calling the OpenAI API directly from the frontend would expose the secret API key, which is a major security vulnerability.

* **The Waiter Analogy:** Our Next.js API route (`/api/chat`) acts as a trusted **waiter**. The frontend (the customer) gives its order (the prompt) to the waiter. The waiter then goes to the kitchen (OpenAI), which is a secure, restricted area, and places the order using its own credentials (the secret API key). This way, the customer never needs to know the kitchen's secrets.

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

* Node.js (v24.5.0 or later)
* npm
* An OpenAI/Google GEMINI API key (for LLM functionality)

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/AvinashK47/ai-assistant-app-whisper](https://github.com/AvinashK47/ai-assistant-app-whisper)
    cd ai-assistant-app-whisper
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    * Create a new file named `.env.local` in the root of the project.
    * Add your OpenAI API key to this file:
        ```
        OPENAI_API_KEY="your-secret-api-key-here"
        //GOOGLE_API_KEY="your-google-api-key-here"
        ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. |

## ⏭️ Future Improvements

* Implement streaming transcription for a more real-time feel.
* Allow the user to select different TTS voices.
* Cache previous LLM responses in `localStorage` to provide instant answers to repeated questions while offline.

---