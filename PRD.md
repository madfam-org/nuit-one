# Product Requirements Document (PRD): Nuit One

## 1. Executive Summary & Product Vision

Nuit One (hosted at `nuit.one`) is a pioneering, cross-platform software ecosystem designed to bridge the gap between high-end digital audio workstations (DAWs) and interactive rhythm gaming. Targeted specifically at multi-instrumentalists and musicians collaborating across multiple ensembles, the platform acts as the single, definitive hub for all their musical identities. By combining low-latency audio capture, real-time AI music analysis, and robust project compartmentalization, Nuit One offers an engaging, "real-to-life Guitar Hero-like" practice and performance environment that natively exports to professional, industry-standard audio formats.

## 2. Target Audience & Personas

* **Persona A (The Session Multi-Instrumentalist):** A musician who plays guitar, bass, and drums for three different bands. They need a fast way to receive a backing track, isolate and learn their specific part in a gamified environment, record their live take with zero noticeable latency, and upload the final asset without navigating complex routing matrices.
* **Persona B (The Producer / Band Leader):** An organizer who tracks the recording progress of an entire album across multiple remote members. They require a high-level overview of which stems have been delivered, unified commenting, and the ability to shape the final multitrack arrangement.

## 3. Core Feature Specifications

### 3.1 Gamified "Performance Mode" (Instrumental Karaoke)

This module transforms standard multitrack playback into a highly visual, interactive rhythm game experience, utilizing live input rather than pre-programmed game controllers.

* **Visual Note Highway:** The UI must feature a dynamic, scrolling "highway" of notes—similar to the open-source rhythm game *Clone Hero*—but algorithmically generated in real-time based on the project's MIDI data or AI-transcribed stems.
* **Hardware Audio Interface Integration:** The platform must capture the raw audio feed from the user's hardware audio unit (e.g., a Focusrite Scarlett or Universal Audio Apollo).
* **Real-Time Pitch & Note Detection:** Analog audio from the user must be converted into digital performance data instantaneously. The system will leverage fast monophonic pitch tracking and integrate Spotify's open-source *Basic Pitch* model for robust, real-time polyphonic audio-to-MIDI transcription directly within the user's browser or desktop environment.


* **Latency Calibration Matrix:** Because the application involves real hardware, it must include a mandatory onboarding sequence allowing users to tune out audio buffering delays, visual display lag, and hardware input latency. This ensures the "0 ms" baseline accurately reflects their specific setup.


* **Performance Scoring & Export:** Instead of merely accumulating arbitrary points, the user's "score" directly correlates to timing accuracy, dynamics, and pitch matching. Once a performance is approved by the user, the actual recorded audio stem and its derived MIDI data are saved directly to the project timeline.

### 3.2 Workspace & Multi-Identity Management (The "One" Hub)

To support musicians active in several projects, the platform must reject the concept of a "single global identity" in favor of project-scoped boundaries, unifying all work under one roof without data leakage.

* **Account / Profile Switcher:** Users must be able to seamlessly switch contexts from the main dashboard using a visual "Account Switcher" pattern. Switching into "Band A" will completely reconfigure the UI to only show assets, tasks, and communications for that ensemble.


* **Role-Based Permissions:** A user can act as an "Admin" (full DAW editing and mix routing) in their solo project, while simultaneously acting as a "Collaborator" (read-only stem viewing and limited recording permissions) in another.


* **Granular Project Tracking:** The platform must natively support tracking up to 10 distinct instruments per track. The dashboard must indicate which instruments still "need parts" and which have been "delivered," providing instant visibility into a project's completion status without forcing users to open chat threads.



### 3.3 AI-Assisted Production & Stem Manipulation

Artificial Intelligence is deeply integrated as a functional tool for practice and arrangement.

* **On-Demand Stem Splitting:** Users can upload any mixed audio file, and the platform will use state-of-the-art models like *Demucs v4* or the highly optimized *Moises-Light* to isolate vocals, drums, bass, and melody. This enables the "instrumental-karaoke" feature, allowing the user to mute the original bassist and play the part themselves.


* **Zero-Latency AI Accompaniment:** For improvisational sessions, the platform will support generative accompaniment models (such as *SongDriver*) capable of tracking the human player's tempo and generating responsive backing tracks utilizing a parallel mechanism to achieve zero logical latency.



## 4. Technical & Engineering Architecture

* **Low-Latency Web Execution:** For web-based deployment, the platform must entirely bypass the standard JavaScript main thread for audio processing. All DSP must be written in C/C++ and compiled to WebAssembly (WASM), utilizing the `AudioWorklet` interface and `SharedArrayBuffer` to guarantee lock-free, native-level rendering speeds.


* **Native Cross-Platform Frameworks:** Desktop and mobile environments will be built utilizing the JUCE framework or the Superpowered SDK to ensure direct, low-latency access to kernel-level audio drivers.


* **Local Inference for AI Models:** To avoid round-trip network latency during live performance, machine learning models (like Basic Pitch and Moises-Light) must be exported to ONNX format and executed on the user's local hardware accelerators whenever possible.
