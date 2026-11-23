# Sonolume — Progress

This document summarizes what has been implemented so far in this repository/workspace.

## Initial build
- Created a static web app (`index.html`, `style.css`, `app.js`) for browser-based visualization.
- **Audio loading**: local file via drag-and-drop or file picker; playback through Web Audio API (`AudioContext`, `MediaElementSource`, `AnalyserNode`).
- **Analysis**:
  - FFT-based frequency data.
  - Band levels for **bass**, **mids**, **treble** (mapped from frequency bins).
  - Simple **beat detection** using bass energy history/threshold with cooldown.
- **Visual effects (Canvas 2D)**:
  - Particles
  - Frequency bars
  - Tunnel effect
- **Mappings UI**: dropdowns to assign audio sources (bass/mids/treble/beat) to effect parameters (particle size/energy, bars height, tunnel speed/glow, etc.).
- **Controls**: effect toggles, sensitivity and smoothing sliders, play/pause, time display.
- **Export**: canvas capture + mixed audio via `MediaStreamDestination` recorded with `MediaRecorder` to a downloadable WebM (browser-dependent).

## Rebrand and customization
- Renamed the app to **Sonolume** (title, header, tagline) and updated docs.
- **Themes**: Modern, Retro, Disco (CSS variables / body classes).
- **Color controls**: global/theme-aware styling plus user-selectable **bar color** (later expanded to per-effect colors).

## Lyrics
- **Lyrics panel**: textarea + display area for pasted lyrics.
- **Canvas overlay**: optional “show lyrics on canvas” toggle; lyrics drawn on the visualization (included in export).
- **LRC support**: parse timestamped LRC lines and show **synced current line** (with nearby context) on canvas during playback.
- **MP3 embedded lyrics (best effort)**: attempt to read ID3v2 **USLT** frames from loaded `.mp3` files and populate the lyrics box.
- **YouTube note**: UI/docs clarify that YouTube links cannot be analyzed/visualized in-browser due to audio access restrictions; automatic transcription from audio is not available.

## More visuals and randomization
- Added **Radial** spectrum effect with its own toggle and mapping (radial intensity from a chosen source).
- **Per-effect colors**: separate color pickers for particles, bars, tunnel, and radial.
- **Randomize All**: randomizes theme, effect colors, toggles, mappings, sensitivity, and smoothing (and related UI state).

## Fixes and tooling
- Fixed runtime issues caused by incorrect variable usage in radial/tunnel drawing (restored effect rendering).
- Added repo-friendly files: `.gitignore`, `README.md`, and initialized a local git repository with commits documenting major steps.
- Created a distributable zip export of the project (excluding `.git`) for easy sharing/GitHub upload.

## Current state (high level)
- Sonolume runs as a static frontend app with real-time audio-reactive visuals, customizable mappings/themes/colors, lyrics helpers (paste/LRC/canvas overlay + limited MP3 tag reading), and in-browser WebM export (where supported by the browser).
