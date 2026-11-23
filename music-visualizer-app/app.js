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

  const fxParticlesEl = document.getElementById('fxParticles');
  const fxBarsEl = document.getElementById('fxBars');
  const fxTunnelEl = document.getElementById('fxTunnel');

  const mapParticleSizeEl = document.getElementById('mapParticleSize');
  const mapParticleCountEl = document.getElementById('mapParticleCount');
  const mapBarsEl = document.getElementById('mapBars');
  const mapTunnelSpeedEl = document.getElementById('mapTunnelSpeed');
  const mapTunnelGlowEl = document.getElementById('mapTunnelGlow');

  const sensitivityEl = document.getElementById('sensitivity');
  const smoothnessEl = document.getElementById('smoothness');

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

  // Resize canvas
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }
  // Better resize handling
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

    if (particles.length === 0) initParticles();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      p.x += p.vx * speedMult * 2;
      p.y += p.vy * speedMult * 2;
      // wrap
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      const r = p.baseR * sizeMult;
      const alpha = 0.4 + energyVal * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 245, 96, ${alpha})`;
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

    ctx.save();
    for (let i = 0; i < barCount; i++) {
      const val = freqArray[i * step] / 255;
      const barH = val * h * 0.6 * (0.5 + trebleVal * 1.5);
      const x = i * barWidth;
      const y = h - barH;
      const grad = ctx.createLinearGradient(x, h, x, y);
      grad.addColorStop(0, 'rgba(200, 245, 96, 0.1)');
      grad.addColorStop(1, `rgba(200, 245, 96, ${0.3 + val * 0.7})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y, barWidth - 2, barH);
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

    ctx.save();
    ctx.translate(cx, cy);
    const rings = 18;
    for (let i = 0; i < rings; i++) {
      const t = (i * 60 + tunnelOffset) % (rings * 60);
      const r = (t / (rings * 60)) * maxR;
      const alpha = (1 - t / (rings * 60)) * (0.15 + glowVal * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 245, 96, ${alpha})`;
      ctx.lineWidth = 1 + glowVal * 2;
      ctx.stroke();
    }
    // radial lines
    const lines = 24;
    for (let i = 0; i < lines; i++) {
      const angle = (i / lines) * Math.PI * 2 + tunnelOffset * 0.01;
      const innerR = maxR * 0.1;
      const outerR = maxR * (0.6 + glowVal * 0.4);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      ctx.strokeStyle = `rgba(232, 168, 124, ${0.1 + glowVal * 0.3})`;
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
      // idle subtle animation
      ctx.save();
      ctx.fillStyle = 'rgba(200, 245, 96, 0.03)';
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

    if (fxTunnelEl.checked) {
      drawTunnel(getSourceValue(tunnelSpeedSrc), getSourceValue(tunnelGlowSrc));
    }
    if (fxBarsEl.checked) {
      drawBars(getSourceValue(barsSrc));
    }
    if (fxParticlesEl.checked) {
      drawParticles(getSourceValue(pSizeSrc), getSourceValue(pCountSrc));
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
