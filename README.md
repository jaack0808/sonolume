# Sonolume — Goal

## Overview
Sonolume is a browser-based music visualizer. Users load a local audio track and see real-time visuals driven by the audio.

## Core goals
- **Load music in the browser**: drag-and-drop or file picker for local audio files (e.g. MP3, WAV, OGG depending on browser support). YouTube links are not supported for in-browser analysis due to cross-origin/audio access restrictions.
- **Audio analysis**: use the Web Audio API to analyze playback:
  - Split energy into **bass**, **mids**, and **treble** (via FFT / frequency band averaging).
  - Perform simple **beat detection** from bass energy to drive punchy reactions.
- **Visual effects**: render on an HTML canvas, including (at minimum) effects such as:
  - **Particles**
  - **Frequency bars**
  - **Tunnel / radial-style motion**
  - **Radial spectrum** (circular frequency visualization)
- **User control (mappings)**: let users choose what audio feature drives what (examples):
  - Bass controls particle size
  - Mids/treble or beat controls other parameters (e.g. bar height, tunnel speed/glow, radial intensity)
- **Customization**:
  - Multiple **themes** (e.g. Modern, Retro, Disco) affecting the app/UI look.
  - **Per-effect colors** (particles, bars, tunnel, radial) plus a global/quick color workflow.
  - Toggles for effects, sensitivity/smoothing controls, and a **randomize** option for quick experimentation.
- **Lyrics support (best effort)**:
  - Paste lyrics (plain text) or **LRC** (timestamped) for synced display on the canvas when enabled.
  - Attempt to read **embedded lyrics** from MP3 files (ID3v2 USLT) when present.
  - Note: automatic lyric transcription from audio is not performed in-browser.
- **Export**: record the visualization (canvas + audio) to a downloadable video file in the browser (e.g. WebM via `MediaRecorder`), when supported.

## Non-goals / constraints (current)
- No server-side processing required for the core visualizer (runs as static files).
- No guaranteed YouTube playback+analysis in-browser.
- No built-in AI transcription of song lyrics from audio.
