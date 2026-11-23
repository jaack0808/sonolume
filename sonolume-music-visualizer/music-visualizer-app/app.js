(() => {
  // --- Elements ---
  const canvas = document.getElementById('visualizer');
  const ctx = canvas.getContext('2d');
  const dropZone = document.getElementById('dropZone');
  const dropOverlay = document.getElementById('dropOverlay');
  const audioFileInput = document.getElementById('audioFile');
  const playBtn = document.getElementById('playBtn');
  const playIcon = document.getElementById('playIcon');
  const playLabel = document.getElementById('playLabel');
  const trackNameEl = document.getElementById('trackName');
  const timeDisplay = document.getElementById('timeDisplay');
  const exportBtn = document.getElementById('exportBtn');
  const exportLabel = document.getElementById('exportLabel');
  const exportNote = document.getElementById('exportNote');

  const themeSelectEl = document.getElementById('themeSelect');
  const particleColorEl = document.getElementById('particleColor');
  const barColorEl = document.getElementById('barColor');
  const tunnelColorEl = document.getElementById('tunnelColor');
  const radialColorEl = document.getElementById('radialColor');
  const showLyricsCanvasEl = document.getElementById('showLyricsCanvas');
  const randomizeBtnEl = document.getElementById('randomizeBtn');

  const fxParticlesEl = document.getElementById('fxParticles');
  const fxBarsEl = document.getElementById('fxBars');
  const fxTunnelEl = document.getElementById('fxTunnel');
  const fxRadialEl = document.getElementById('fxRadial');

  const mapParticleSizeEl = document.getElementById('mapParticleSize');
  const mapParticleCountEl = document.getElementById('mapParticleCount');
  const mapBarsEl = document.getElementById('mapBars');
  const mapTunnelSpeedEl = document.getElementById('mapTunnelSpeed');
  const mapTunnelGlowEl = document.getElementById('mapTunnelGlow');
  const mapRadialEl = document.getElementById('mapRadial');

  const sensitivityEl = document.getElementById('sensitivity');
  const smoothnessEl = document.getElementById('smoothness');
  const lyricsInputEl = document.getElementById('lyricsInput');
  const lyricsDisplayEl = document.getElementById('lyricsDisplay');

  let parsedLyrics = []; // {time: seconds, text: string}
  function parseLRC(text) {
    const lines = text.split('\n');
    const result = [];
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    for (const line of lines) {
      const matches = [...line.matchAll(timeRegex)];
      if (matches.length === 0) continue;
      const lyricText = line.replace(timeRegex, '').trim();
      for (const m of matches) {
        const min = parseInt(m[1], 10);
        const sec = parseInt(m[2], 10);
        const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
        const time = min * 60 + sec + ms / 1000;
        result.push({ time, text: lyricText });
      }
    }
    result.sort((a, b) => a.time - b.time);
    return result;
  }
  if (lyricsInputEl && lyricsDisplayEl) {
    lyricsInputEl.addEventListener('input', () => {
      const txt = lyricsInputEl.value.trim();
      lyricsDisplayEl.textContent = txt || 'No lyrics loaded.';
      parsedLyrics = parseLRC(txt);
    });
  }

  // --- Audio state ---
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let audioEl = null;
  let dataArray = null;
  let freqArray = null;
  let audioBufferUrl = null;

  // Smoothed values
  let smoothBass = 0, smoothMids = 0, smoothTreble = 0;
  let beatPulse = 0;
  // Beat detection
  let bassHistory = [];
  const BASS_HISTORY_SIZE = 43; // ~1 second at 60fps
  let lastBeatTime = 0;

  // Particles
  let particles = [];

  // Tunnel
  let tunnelOffset = 0;

  // Theme colors
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1],16), g: parseInt(result[2],16), b: parseInt(result[3],16) } : {r:200,g:245,b:96};
  }
  function applyTheme(theme) {
    document.body.classList.remove('theme-modern', 'theme-retro', 'theme-disco');
    document.body.classList.add('theme-' + theme);
  }
  function randomHex() {
    return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
  }
  function randomizeAll() {
    // theme
    const themes = ['modern','retro','disco'];
    if (themeSelectEl) { themeSelectEl.value = themes[Math.floor(Math.random()*themes.length)]; applyTheme(themeSelectEl.value); }
    // colors
    if (particleColorEl) particleColorEl.value = randomHex();
    if (barColorEl) barColorEl.value = randomHex();
    if (tunnelColorEl) tunnelColorEl.value = randomHex();
    if (radialColorEl) radialColorEl.value = randomHex();
    // toggles
    if (fxParticlesEl) fxParticlesEl.checked = Math.random() > 0.3;
    if (fxBarsEl) fxBarsEl.checked = Math.random() > 0.3;
    if (fxTunnelEl) fxTunnelEl.checked = Math.random() > 0.3;
    if (fxRadialEl) fxRadialEl.checked = Math.random() > 0.3;
    if (showLyricsCanvasEl) showLyricsCanvasEl.checked = Math.random() > 0.5;
    // mappings
    const sources = ['bass','mids','treble','beat'];
    const randSrc = () => sources[Math.floor(Math.random()*sources.length)];
    if (mapParticleSizeEl) mapParticleSizeEl.value = randSrc();
    if (mapParticleCountEl) mapParticleCountEl.value = randSrc();
    if (mapBarsEl) mapBarsEl.value = randSrc();
    if (mapTunnelSpeedEl) mapTunnelSpeedEl.value = randSrc();
    if (mapTunnelGlowEl) mapTunnelGlowEl.value = randSrc();
    if (mapRadialEl) mapRadialEl.value = randSrc();
    // sliders
    if (sensitivityEl) sensitivityEl.value = (0.5 + Math.random()*2.5).toFixed(1);
    if (smoothnessEl) smoothnessEl.value = (Math.random()*0.9).toFixed(2);
  }
  if (randomizeBtnEl) randomizeBtnEl.addEventListener('click', randomizeAll);

  if (themeSelectEl) {
    themeSelectEl.addEventListener('change', () => applyTheme(themeSelectEl.value));
    applyTheme(themeSelectEl.value);
  }

  // Resize canvas
  function setupCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
  window.addEventListener('resize', () => {
    setupCanvasSize();
  });
  setupCanvasSize();

  // --- Audio setup ---
  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Minimal ID3v2 USLT extractor
  function extractUSLTLyrics(arrayBuffer) {
    try {
      const view = new DataView(arrayBuffer);
      // Check for "ID3"
      if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) return null;
      const version = view.getUint8(3);
      const size = (view.getUint8(6) & 0x7f) << 21 | (view.getUint8(7) & 0x7f) << 14 | (view.getUint8(8) & 0x7f) << 7 | (view.getUint8(9) & 0x7f);
      let offset = 10;
      const end = 10 + size;
      while (offset + 10 < end && offset + 10 < arrayBuffer.byteLength) {
        const frameId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
        const frameSize = version >= 4
          ? (view.getUint8(offset+4)&0x7f)<<21 | (view.getUint8(offset+5)&0x7f)<<14 | (view.getUint8(offset+6)&0x7f)<<7 | (view.getUint8(offset+7)&0x7f)
          : view.getUint32(offset+4);
        offset += 10;
        if (frameSize <= 0 || offset + frameSize > arrayBuffer.byteLength) break;
        if (frameId === 'USLT') {
          const enc = view.getUint8(offset);
          // skip lang (3 bytes) + description (null-terminated) - simplify: read rest as text
          let textStart = offset + 1 + 3;
          // find null terminator for description depending on encoding
          if (enc === 0 || enc === 3) { // ISO-8859-1 or UTF-8
            // skip description
            while (textStart < offset + frameSize && view.getUint8(textStart) !== 0) textStart++;
            textStart++; // skip null
            const bytes = new Uint8Array(arrayBuffer, textStart, offset + frameSize - textStart);
            return new TextDecoder(enc === 3 ? 'utf-8' : 'iso-8859-1').decode(bytes).replace(/\0/g, '').trim();
          } else { // UTF-16
            while (textStart + 1 < offset + frameSize) {
              if (view.getUint8(textStart) === 0 && view.getUint8(textStart+1) === 0) { textStart += 2; break; }
              textStart += 2;
            }
            const bytes = new Uint8Array(arrayBuffer, textStart, offset + frameSize - textStart);
            return new TextDecoder('utf-16').decode(bytes).replace(/\0/g, '').trim();
          }
        }
        offset += frameSize;
      }
    } catch (e) { /* ignore parse errors */ }
    return null;
  }

  function loadAudioFile(file) {
    initAudioContext();
    if (audioBufferUrl) {
      URL.revokeObjectURL(audioBufferUrl);
    }
    audioBufferUrl = URL.createObjectURL(file);
    if (audioEl) {
      audioEl.pause();
      audioEl.src = '';
    }
    audioEl = new Audio();
    audioEl.src = audioBufferUrl;
    audioEl.crossOrigin = 'anonymous';

    audioEl.onloadedmetadata = () => {
      trackNameEl.textContent = file.name.replace(/\.[^/.]+$/, '');
      playBtn.disabled = false;
      exportBtn.disabled = false;
      dropOverlay.classList.add('hidden');
      updateTimeDisplay();
    };

    audioEl.ontimeupdate = updateTimeDisplay;
    audioEl.onended = () => {
      playLabel.textContent = 'Play';
      playIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"></polygon></svg>';
    };

    // Try to extract embedded lyrics from MP3 (ID3v2 USLT)
    if (file.name.toLowerCase().endsWith('.mp3')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const lyrics = extractUSLTLyrics(ev.target.result);
        if (lyrics && lyricsInputEl && lyricsDisplayEl) {
          lyricsInputEl.value = lyrics;
          lyricsDisplayEl.textContent = lyrics;
          parsedLyrics = parseLRC(lyrics);
        }
      };
      reader.readAsArrayBuffer(file.slice(0, 256 * 1024)); // read first 256KB for tags
    }

    // Setup analyser
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch(e) {}
    }
    sourceNode = audioCtx.createMediaElementSource(audioEl);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = parseFloat(smoothnessEl.value);
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    freqArray = new Uint8Array(bufferLength);

    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function updateTimeDisplay() {
    if (!audioEl) return;
    const cur = formatTime(audioEl.currentTime || 0);
    const dur = formatTime(audioEl.duration || 0);
    timeDisplay.textContent = `${cur} / ${dur}`;
  }

  function formatTime(s) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  // --- Frequency analysis ---
  function getBandLevels() {
    if (!analyser || !freqArray) return { bass: 0, mids: 0, treble: 0 };
    analyser.getByteFrequencyData(freqArray);
    const sampleRate = audioCtx.sampleRate;
    const binCount = analyser.frequencyBinCount;
    const binHz = sampleRate / (analyser.fftSize);

    // Define ranges
    const bassRange = [20, 250];
    const midsRange = [250, 2000];
    const trebleRange = [2000, 8000];

    function avgInRange(lowHz, highHz) {
      const startBin = Math.max(1, Math.floor(lowHz / binHz));
      const endBin = Math.min(binCount - 1, Math.ceil(highHz / binHz));
      let sum = 0, count = 0;
      for (let i = startBin; i <= endBin; i++) {
        sum += freqArray[i];
        count++;
      }
      return count > 0 ? (sum / count) / 255 : 0;
    }

    return {
      bass: avgInRange(bassRange[0], bassRange[1]),
      mids: avgInRange(midsRange[0], midsRange[1]),
      treble: avgInRange(trebleRange[0], trebleRange[1])
    };
  }

  function detectBeat(bassLevel) {
    bassHistory.push(bassLevel);
    if (bassHistory.length > BASS_HISTORY_SIZE) bassHistory.shift();
    const avg = bassHistory.reduce((a, b) => a + b, 0) / bassHistory.length;
    const threshold = avg * 1.35 + 0.02;
    const now = performance.now();
    if (bassLevel > threshold && bassLevel > 0.15 && (now - lastBeatTime) > 180) {
      lastBeatTime = now;
      return 1.0;
    }
    return 0.0;
  }

  function getSourceValue(source) {
    const sens = parseFloat(sensitivityEl.value);
    switch (source) {
      case 'bass': return smoothBass * sens;
      case 'mids': return smoothMids * sens;
      case 'treble': return smoothTreble * sens;
      case 'beat': return beatPulse * sens;
      default: return 0;
    }
  }

  // --- Particles ---
  function initParticles() {
    particles = [];
    const count = 80;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        baseR: 1 + Math.random() * 2
      });
    }
  }

  function drawParticles(bassVal, energyVal) {
    const w = canvas.width;
    const h = canvas.height;
    const sizeMult = 1 + bassVal * 2.5;
    const speedMult = 0.3 + energyVal * 2;
    const col = hexToRgb(particleColorEl ? particleColorEl.value : (barColorEl ? barColorEl.value : '#c8f560'));

    if (particles.length === 0) initParticles();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      p.x += p.vx * speedMult * 2;
      p.y += p.vy * speedMult * 2;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      const r = p.baseR * sizeMult;
      const alpha = 0.4 + energyVal * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha})`;
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Bars ---
  function drawBars(trebleVal) {
    if (!analyser || !freqArray) return;
    analyser.getByteFrequencyData(freqArray);
    const w = canvas.width;
    const h = canvas.height;
    const barCount = 64;
    const barWidth = w / barCount;
    const step = Math.floor(freqArray.length / barCount);
    const barCol = hexToRgb(barColorEl ? barColorEl.value : '#c8f560');

    ctx.save();
    for (let i = 0; i < barCount; i++) {
      const val = freqArray[i * step] / 255;
      const barH = val * h * 0.6 * (0.5 + trebleVal * 1.5);
      const x = i * barWidth;
      const y = h - barH;
      const grad = ctx.createLinearGradient(x, h, x, y);
      grad.addColorStop(0, `rgba(${barCol.r}, ${barCol.g}, ${barCol.b}, 0.1)`);
      grad.addColorStop(1, `rgba(${barCol.r}, ${barCol.g}, ${barCol.b}, ${0.3 + val * 0.7})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y, barWidth - 2, barH);
    }
    ctx.restore();
  }
  // --- Radial ---
  function drawRadial(intensityVal) {
    if (!analyser || !freqArray) return;
    analyser.getByteFrequencyData(freqArray);
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const col = hexToRgb(radialColorEl ? radialColorEl.value : (barColorEl ? barColorEl.value : '#c8f560'));
    const bars = 80;
    const step = Math.floor(freqArray.length / bars);
    const baseR = Math.min(w, h) * 0.15;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < bars; i++) {
      const val = freqArray[i * step] / 255;
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const len = (20 + val * 120) * (0.5 + intensityVal);
      const x1 = Math.cos(angle) * baseR;
      const y1 = Math.sin(angle) * baseR;
      const x2 = Math.cos(angle) * (baseR + len);
      const y2 = Math.sin(angle) * (baseR + len);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${0.4 + val * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Tunnel ---
  function drawTunnel(speedVal, glowVal) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);

    tunnelOffset += 0.5 + speedVal * 4;
    if (tunnelOffset > 60) tunnelOffset = 0;

    const col = hexToRgb(tunnelColorEl ? tunnelColorEl.value : (barColorEl ? barColorEl.value : '#c8f560'));
    ctx.save();
    ctx.translate(cx, cy);
    const rings = 18;
    for (let i = 0; i < rings; i++) {
      const t = (i * 60 + tunnelOffset) % (rings * 60);
      const r = (t / (rings * 60)) * maxR;
      const alpha = (1 - t / (rings * 60)) * (0.15 + glowVal * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha})`;
      ctx.lineWidth = 1 + glowVal * 2;
      ctx.stroke();
    }
    const lines = 24;
    for (let i = 0; i < lines; i++) {
      const angle = (i / lines) * Math.PI * 2 + tunnelOffset * 0.01;
      const innerR = maxR * 0.1;
      const outerR = maxR * (0.6 + glowVal * 0.4);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      ctx.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${0.1 + glowVal * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Main animation loop ---
  function animate() {
    requestAnimationFrame(animate);
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = 'rgba(10, 10, 11, 0.25)';
    ctx.fillRect(0, 0, w, h);

    if (!analyser || !audioEl) {
      const barCol = hexToRgb(barColorEl ? barColorEl.value : '#c8f560');
      ctx.save();
      ctx.fillStyle = `rgba(${barCol.r}, ${barCol.g}, ${barCol.b}, 0.06)`;
      ctx.beginPath();
      ctx.arc(w/2, h/2, 80 + Math.sin(Date.now()*0.001)*10, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const levels = getBandLevels();
    const smoothFactor = parseFloat(smoothnessEl.value);
    smoothBass += (levels.bass - smoothBass) * (1 - smoothFactor);
    smoothMids += (levels.mids - smoothMids) * (1 - smoothFactor);
    smoothTreble += (levels.treble - smoothTreble) * (1 - smoothFactor);

    const beatDetected = detectBeat(levels.bass);
    if (beatDetected > 0) beatPulse = 1.0;
    beatPulse *= 0.92; // decay

    // Read mappings
    const pSizeSrc = mapParticleSizeEl.value;
    const pCountSrc = mapParticleCountEl.value;
    const barsSrc = mapBarsEl.value;
    const tunnelSpeedSrc = mapTunnelSpeedEl.value;
    const tunnelGlowSrc = mapTunnelGlowEl.value;
    const radialSrc = mapRadialEl ? mapRadialEl.value : 'bass';

    if (fxTunnelEl.checked) {
      drawTunnel(getSourceValue(tunnelSpeedSrc), getSourceValue(tunnelGlowSrc));
    }
    if (fxRadialEl && fxRadialEl.checked) {
      drawRadial(getSourceValue(radialSrc));
    }
    if (fxBarsEl.checked) {
      drawBars(getSourceValue(barsSrc));
    }
    if (fxParticlesEl.checked) {
      drawParticles(getSourceValue(pSizeSrc), getSourceValue(pCountSrc));
    }

    // Draw lyrics overlay
    if (showLyricsCanvasEl && showLyricsCanvasEl.checked && lyricsInputEl) {
      const lyricsText = lyricsInputEl.value.trim();
      if (lyricsText) {
        ctx.save();
        ctx.font = '16px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lineH = 26;
        if (parsedLyrics.length > 0 && audioEl) {
          const t = audioEl.currentTime || 0;
          // find current index
          let idx = 0;
          for (let i = 0; i < parsedLyrics.length; i++) {
            if (parsedLyrics[i].time <= t) idx = i;
            else break;
          }
          const start = Math.max(0, idx - 2);
          const end = Math.min(parsedLyrics.length, idx + 3);
          const totalH = (end - start) * lineH;
          let y = h - 40 - totalH / 2;
          for (let i = start; i < end; i++) {
            const isCurrent = (i === idx);
            ctx.fillStyle = isCurrent ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.45)';
            ctx.font = isCurrent ? 'bold 18px "DM Sans", sans-serif' : '16px "DM Sans", sans-serif';
            const txt = parsedLyrics[i].text || '...';
            ctx.fillText(txt.slice(0, 90), w / 2, y + (i - start) * lineH + lineH / 2);
          }
        } else {
          // plain text fallback
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          const lines = lyricsText.split('\n').slice(0, 6);
          const startY = h - 30 - (lines.length - 1) * lineH;
          lines.forEach((line, i) => {
            const text = line.length > 90 ? line.slice(0, 90) + '…' : line;
            ctx.fillText(text, w / 2, startY + i * lineH);
          });
        }
        ctx.restore();
      }
    }
  }

  // --- Event handlers ---
  dropZone.addEventListener('click', () => audioFileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      loadAudioFile(file);
    }
  });

  audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadAudioFile(file);
  });

  playBtn.addEventListener('click', async () => {
    if (!audioEl) return;
    initAudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    if (audioEl.paused) {
      audioEl.play();
      playLabel.textContent = 'Pause';
      playIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    } else {
      audioEl.pause();
      playLabel.textContent = 'Play';
      playIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"></polygon></svg>';
    }
  });

  // --- Export (MediaRecorder) ---
  let mediaRecorder = null;
  let recordedChunks = [];

  exportBtn.addEventListener('click', async () => {
    if (!audioEl || !audioCtx) return;
    if (mediaRecorder && mediaRecorder.state === 'recording') return;

    // Setup recording
    initAudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const canvasStream = canvas.captureStream(30);
    // Create a destination to capture audio
    const dest = audioCtx.createMediaStreamDestination();
    // Reconnect: sourceNode -> analyser -> destination AND sourceNode -> dest
    // Easier: disconnect and reconnect graph for recording? Or just connect sourceNode to dest too (it fans out)
    try { sourceNode.connect(dest); } catch(e) { /* may already be connected */ }

    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    try {
      mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
    } catch (err) {
      alert('MediaRecorder not supported or failed: ' + err.message);
      return;
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'visualizer-export.webm';
      a.click();
      URL.revokeObjectURL(url);
      exportLabel.textContent = 'Export Video';
      exportBtn.disabled = false;
      exportNote.textContent = 'Export complete. Download started.';
      exportNote.classList.remove('recording');
      // Stop audio playback
      if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
      playLabel.textContent = 'Play';
      playIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"></polygon></svg>';
    };

    // Start
    audioEl.currentTime = 0;
    mediaRecorder.start();
    await audioEl.play();
    playLabel.textContent = 'Pause';
    playIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

    exportLabel.textContent = 'Recording...';
    exportBtn.disabled = true;
    exportNote.textContent = 'Recording in progress. It will stop when the song ends.';
    exportNote.classList.add('recording');

    audioEl.onended = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      playLabel.textContent = 'Play';
      playIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"></polygon></svg>';
    };
  });

  // Init
  initParticles();
  animate();
})();
