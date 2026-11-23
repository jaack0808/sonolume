# Waveform — Browser Music Visualizer

A browser-based music visualizer: drop in a song and watch visuals react to **bass**, **mids**, and **treble**, with simple **beat** detection driving effects. Customize what controls what, then export the canvas as a **WebM** video.

## Features

- Load local audio files (drag-and-drop or file picker)
- Audio analysis with the Web Audio API (FFT)
  - Bands: bass (~20–250 Hz), mids (~250–2000 Hz), treble (~2000–8000 Hz)
  - Smoothed levels + adjustable sensitivity/smoothing
  - Lightweight beat detection from bass energy
- Visual effects (Canvas 2D): **Particles**, **Bars**, **Tunnel**
- Mappings: choose which source (**bass / mids / treble / beat**) drives:
  - Particle size
  - Particle energy
  - Bars height
  - Tunnel speed
  - Tunnel glow
- Export: record the visualization to **WebM** via `MediaRecorder` (canvas + audio)

## Tech stack

- HTML, CSS, vanilla JavaScript
- Web Audio API, Canvas 2D, MediaRecorder API

No build step required.

## Run locally

Because browsers apply security rules to some media APIs, serve the folder over HTTP (not `file://`).

### Option A: Python

```bash
cd music-visualizer-app
python3 -m http.server 8080
```

Open: http://localhost:8080

### Option B: Node (npx)

```bash
cd music-visualizer-app
npx serve .
```

Then open the URL printed in the terminal.

## Usage

1. Open the app in your browser.
2. Drop an audio file onto the canvas area (or click to browse).
3. Press **Play**.
4. Toggle effects and adjust **Mappings** and sliders.
5. Click **Export Video** to record a WebM (recording stops at the end of the track).

## Export notes

- Output format is typically **WebM** (codec support depends on your browser).
- For best results, use a relatively short track while testing export.

## Project structure

```
music-visualizer-app/
  index.html
  style.css
  app.js
  .gitignore
  README.md
```

## License

Add a license file (e.g. MIT) if you plan to publish publicly.