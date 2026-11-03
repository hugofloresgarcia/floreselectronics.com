// player for "hugo @ whpk" (unlisted // wip).
// trimmed from aguante-tacuazin: monospace transport with a garden-colored
// waveform (peaks precomputed into waveform.json). while playing, a WebAudio
// analyser publishes a smoothed loudness to window.__gardenLevel so the
// garden (garden.js) can dance along. no polaroids, no map, no liner.

(function () {
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- transport ----

  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('play');
  const seek = document.getElementById('seek');
  const cur = document.getElementById('cur');
  const dur = document.getElementById('dur');
  let scrubbing = false;

  function fmt(s) {
    if (!isFinite(s)) return '–:––';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function setGlyph() {
    playBtn.classList.toggle('playing', !audio.paused);
    playBtn.setAttribute('aria-label', audio.paused ? 'play' : 'pause');
    // keep the lock-screen / control-center card in sync so background
    // resume works on phones
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
    }
  }

  function syncDuration() {
    if (!isFinite(audio.duration)) return;
    seek.max = audio.duration;
    dur.textContent = fmt(audio.duration);
  }
  audio.addEventListener('loadedmetadata', syncDuration);
  syncDuration(); // in case metadata beat us to it

  playBtn.addEventListener('click', function () {
    if (audio.paused) {
      initAnalyser();
      audio.play();
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play', function () {
    window.__gardenPlaying = true;
    setGlyph();
  });
  audio.addEventListener('pause', function () {
    window.__gardenPlaying = false;
    setGlyph();
  });
  audio.addEventListener('ended', function () {
    window.__gardenPlaying = false;
    setGlyph();
  });

  audio.addEventListener('timeupdate', function () {
    if (!scrubbing) seek.value = audio.currentTime;
    cur.textContent = fmt(audio.currentTime);
  });

  // all seek paths clamp just shy of the end: landing exactly on duration
  // fires `ended` and silently stops playback mid-scrub.
  function safeTime(t) {
    const d = audio.duration;
    if (!isFinite(d)) return Math.max(0, t);
    return Math.min(Math.max(0, t), Math.max(0, d - 0.25));
  }
  window.__safeSeek = function (t) { audio.currentTime = safeTime(t); };

  // coalesce rapid scrub writes to one currentTime set per frame
  let pendingSeek = null;
  function commitSeek() {
    if (pendingSeek === null) return;
    audio.currentTime = safeTime(pendingSeek);
    pendingSeek = null;
  }

  seek.addEventListener('pointerdown', function () { scrubbing = true; });
  seek.addEventListener('pointerup', function () { scrubbing = false; commitSeek(); });
  // touch scrolls can steal the gesture — never leave scrubbing wedged on
  seek.addEventListener('pointercancel', function () { scrubbing = false; commitSeek(); });
  seek.addEventListener('lostpointercapture', function () { scrubbing = false; });
  seek.addEventListener('input', function () {
    pendingSeek = Number(seek.value);
    cur.textContent = fmt(Number(seek.value));
    requestAnimationFrame(commitSeek);
  });

  // arrows on the seek bar: jump 10s, not one range-step
  seek.addEventListener('keydown', function (e) {
    if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
    e.preventDefault();
    const d = e.code === 'ArrowLeft' ? -10 : 10;
    audio.currentTime = safeTime(audio.currentTime + d);
  });

  // space anywhere = play/pause (unless a control already has focus)
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'Space') return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'button' || tag === 'input') return;
    e.preventDefault();
    playBtn.click();
  });

  // ---- waveform (soundcloud style, garden colors) ----
  // pale bars bloom into full color as they're played; a daisy rides the
  // waveform as the playhead, spinning with the music.

  const waveBox = document.querySelector('.wave');
  const wavecv = document.getElementById('wavecv');
  const wctx = wavecv.getContext('2d');
  let peaks = null;   // raw 1000-bucket peaks from waveform.json
  let bars = null;    // rebinned to one value per drawn bar
  let hues = null;
  let waveW = 0, waveH = 0;
  let daisyRot = 0;

  const BAR_W = 3, GAP = 1;

  fetch('waveform.json')
    .then(function (r) { return r.json(); })
    .then(function (a) { peaks = a; sizeWave(); })
    .catch(function () { peaks = null; sizeWave(); }); // no data -> flat bars

  function frac(x) { return x - Math.floor(x); }
  // deterministic per-bar hue: mostly greens, sprinkled accents (vines.js odds)
  function barHue(i) {
    const r = frac(Math.sin((i + 1) * 127.1) * 43758.5453);
    const r2 = frac(Math.sin((i + 1) * 269.5) * 21758.55);
    return r < 0.7 ? 95 + r2 * 55 : r2 * 360;
  }

  function sizeWave() {
    const rect = waveBox.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    waveW = rect.width; waveH = rect.height;
    wavecv.width = Math.round(waveW * dpr);
    wavecv.height = Math.round(waveH * dpr);
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(10, Math.floor(waveW / (BAR_W + GAP)));
    bars = new Array(n);
    hues = new Array(n);
    for (let i = 0; i < n; i++) {
      if (peaks && peaks.length) {
        const a = Math.floor(i / n * peaks.length);
        const b = Math.max(a + 1, Math.floor((i + 1) / n * peaks.length));
        let mx = 0;
        for (let k = a; k < b; k++) mx = Math.max(mx, peaks[k]);
        bars[i] = Math.max(0.04, mx);
      } else {
        bars[i] = 0.5;
      }
      hues[i] = barHue(i);
    }
  }
  window.addEventListener('resize', sizeWave);

  function drawWave() {
    if (!bars) return;
    const lvl = window.__gardenLevel || 0;
    const playing = !audio.paused && !audio.ended;
    const progress = (audio.currentTime || 0) / (audio.duration || 1);
    const px = progress * waveW;
    const y0 = waveH * 0.64;

    wctx.clearRect(0, 0, waveW, waveH);
    for (let i = 0; i < bars.length; i++) {
      const x = i * (BAR_W + GAP);
      const cx = x + BAR_W / 2;
      let k = 1;
      if (playing && !reduceMotion) {
        const d = Math.abs(cx - px);
        if (d < 26) k = 1 + 0.55 * lvl * (1 - d / 26);
      }
      const played = cx <= px;
      const h = hues[i];
      wctx.fillStyle = played
        ? 'hsl(' + h + ' 82% 40%)'
        : 'hsl(' + h + ' 50% 84%)';
      const hm = Math.max(2, bars[i] * y0 * 0.94 * k);
      wctx.fillRect(x, y0 - hm, BAR_W, hm);
      // reflection below (soundcloud style)
      wctx.globalAlpha = 0.45;
      const hr = Math.max(1, bars[i] * (waveH - y0) * 0.8 * k);
      wctx.fillRect(x, y0 + 2, BAR_W, hr);
      wctx.globalAlpha = 1;
    }

    // the daisy playhead
    if (playing && !reduceMotion) daisyRot += 0.05 * (1 + 2 * lvl);
    wctx.save();
    wctx.translate(Math.max(8, Math.min(waveW - 8, px)), y0);
    wctx.rotate(daisyRot);
    wctx.fillStyle = 'black';
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      wctx.beginPath();
      wctx.arc(Math.cos(a) * 5.4, Math.sin(a) * 5.4, 2.3, 0, Math.PI * 2);
      wctx.fill();
    }
    wctx.beginPath();
    wctx.arc(0, 0, 2.9, 0, Math.PI * 2);
    wctx.fillStyle = 'yellow';
    wctx.fill();
    wctx.strokeStyle = 'black';
    wctx.lineWidth = 1;
    wctx.stroke();
    wctx.restore();
  }

  (function waveLoop() {
    requestAnimationFrame(waveLoop);
    drawWave();
  })();

  // ---- debug overlay (?debug=1): media element state machine, on screen ----

  if (/[?&]debug=1/.test(location.search)) {
    const box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;background:rgba(255,255,255,.92);' +
      'border:thin solid black;padding:6px;margin:0;font-size:10px;line-height:1.3;max-width:80vw;' +
      'max-height:40vh;overflow:hidden;pointer-events:none;text-align:left;';
    document.body.appendChild(box);
    const lines = [];
    function dbg(msg) {
      const b = [];
      for (let i = 0; i < audio.buffered.length; i++) {
        b.push(audio.buffered.start(i).toFixed(0) + '-' + audio.buffered.end(i).toFixed(0));
      }
      lines.push('[' + (audio.currentTime || 0).toFixed(1) + 's rs=' + audio.readyState +
        ' ns=' + audio.networkState + ' buf=' + (b.join(',') || 'none') + '] ' + msg);
      if (lines.length > 16) lines.shift();
      box.textContent = lines.join('\n');
      console.log('[player-debug]', msg, 'rs=' + audio.readyState, 'ns=' + audio.networkState);
    }
    ['loadstart', 'loadedmetadata', 'durationchange', 'canplay', 'canplaythrough',
     'play', 'playing', 'pause', 'seeking', 'seeked', 'waiting', 'stalled',
     'suspend', 'abort', 'emptied', 'ended', 'error'].forEach(function (ev) {
      audio.addEventListener(ev, function () {
        dbg(ev + (ev === 'error' && audio.error ? ' code=' + audio.error.code : ''));
      });
    });
    dbg('debug overlay on · src=' + audio.currentSrc);
  }

  // ---- loudness -> garden ----

  let analyser = null;
  let data = null;
  let started = false;
  let lvl = 0;

  // iOS: routing the element through WebAudio (createMediaElementSource)
  // puts playback under the ringer/silent switch — audio "plays" but the
  // speaker stays silent. skip the analyser there; the garden still runs
  // at full speed while playing, just without loudness modulation.
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function initAnalyser() {
    if (started || IOS) return;
    started = true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      if (ctx.state === 'suspended') ctx.resume();
      data = new Float32Array(analyser.fftSize);
      meter();
    } catch (err) {
      analyser = null; // garden still sways at base speed while playing
    }
  }

  function meter() {
    requestAnimationFrame(meter);
    if (!analyser) return;
    if (audio.paused) {
      lvl *= 0.94; // let it breathe out
    } else if (typeof analyser.getFloatTimeDomainData === 'function') {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      const target = Math.min(1, rms * 3.4);
      // fast attack, slow release — reads as "dancing", not flickering
      lvl += (target - lvl) * (target > lvl ? 0.35 : 0.08);
    }
    window.__gardenLevel = lvl;
  }

  // ---- lock screen / media keys ----

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'hugo @ whpk · 18 sep 2026',
      artist: 'hugo flores garcía',
    });
    navigator.mediaSession.setActionHandler('play', function () { playBtn.click(); });
    navigator.mediaSession.setActionHandler('pause', function () { playBtn.click(); });
    navigator.mediaSession.setActionHandler('seekbackward', function () {
      window.__safeSeek(audio.currentTime - 10);
    });
    navigator.mediaSession.setActionHandler('seekforward', function () {
      window.__safeSeek(audio.currentTime + 10);
    });
    try {
      navigator.mediaSession.setActionHandler('seekto', function (d) {
        window.__safeSeek(d.seekTime);
      });
    } catch (e) { /* older browsers don't know seekto */ }
  }

  setGlyph();
})();
