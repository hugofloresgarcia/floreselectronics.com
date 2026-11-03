// garden for "aguante tacuazín — at the lake".
// port of the homepage's vines.js (itself a port of hugo's flowerbeds:
// flower.cpp's noisy turtle spiral + flowerVine + ofApp.cpp's feedback trails),
// with three changes for this page:
//   1. elements ring the viewport border AND the polaroid stage, and a few
//      long vines sprawl right across the photo.
//   2. a new creature: the sun — noisy warm-hued rays + a coil core, after
//      the lens flares in the polaroid scans. suns favor the top of the page.
//   3. the garden listens to the music. while the track plays, time runs at
//      full speed and loudness (window.__gardenLevel, set by player.js) makes
//      vines grow faster and suns flare. paused = slow idle sway.
// each new polaroid ('photochange' event) regrows the elements near the frame.

let gardenSketch = function (p) {
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const BASE_TURN = 0.5 * (Math.PI / 180); // .5 * DEG_TO_RAD
  let t = 0;
  let els = [];
  let unit = 1;

  function rnd(a, b) { return p.random(a, b); }
  function level() { return window.__gardenLevel || 0; }
  function playing() { return !!window.__gardenPlaying; }

  function stageRect() {
    const el = document.getElementById('stage');
    return el ? el.getBoundingClientRect() : null;
  }

  // ---- creature factory (same species as vines.js + the sun) ----
  // sunBias raises sun odds (used near the top of the page).
  function spawn(x, y, alongHeading, zone, sunBias) {
    const s = unit;
    const r = p.random();
    const sunCut = 0.20 + (sunBias || 0);
    let kind;
    if (r < sunCut) kind = 'sun';
    else {
      const q = (r - sunCut) / (1 - sunCut);
      kind = q < 0.32 ? 'vine' : q < 0.46 ? 'flower' : q < 0.62 ? 'daisy' : q < 0.78 ? 'lily' : 'rosette';
    }

    if (kind === 'vine') {
      return {
        kind: 'vine', zone: zone,
        x: x, y: y,
        niter: Math.floor(rnd(70, 220)),
        step: s * rnd(0.004, 0.009),
        wander: rnd(0.12, 0.55),
        noiseIndex: rnd(0, 3),
        seed: rnd(1000),
        heading: alongHeading + rnd(-0.6, 0.6),
        grow: reduceMotion ? 1 : 0,
        growSpeed: rnd(0.004, 0.013),
        hue: p.random() < 0.78 ? rnd(95, 150) : rnd(0, 360), // mostly green
        sat: rnd(60, 92),
        bri: rnd(42, 66),
        weight: p.max(0.8, s * rnd(0.0008, 0.0014)),
        tendrils: p.random() < 0.7,
      };
    } else if (kind === 'flower') {
      return {
        kind: 'flower', zone: zone,
        x: x, y: y,
        numPetals: 2 + Math.floor(rnd(0, 5)),
        niter: Math.floor(rnd(26, 56)),
        step: s * rnd(0.003, 0.0065),
        coil: rnd(0.28, 0.5),
        timeScale: rnd(0.06, 0.18),
        noiseIndex: rnd(0, 3),
        seed: rnd(1000),
        baseRot: rnd(0, p.TWO_PI),
        spin: rnd(-0.04, 0.04),
        hue: p.random() < 0.35 ? rnd(95, 150) : rnd(0, 360),
        sat: rnd(78, 96),
        bri: rnd(70, 88),
        weight: p.max(1, s * rnd(0.0011, 0.0017)),
      };
    } else if (kind === 'daisy') {
      return {
        kind: 'daisy', zone: zone,
        x: x, y: y,
        dots: 5 + Math.floor(rnd(0, 8)),
        rings: 1 + Math.floor(rnd(0, 2)),
        ringR: s * rnd(0.01, 0.03),
        dotR: s * rnd(0.0018, 0.0045),
        seed: rnd(1000),
        baseRot: rnd(0, p.TWO_PI),
        spin: rnd(-0.1, 0.1),
        hue: p.random() < 0.3 ? rnd(95, 150) : rnd(0, 360),
        sat: rnd(70, 92),
        bri: rnd(72, 90),
        weight: p.max(1, s * rnd(0.001, 0.0015)),
      };
    } else if (kind === 'lily') {
      return {
        kind: 'lily', zone: zone,
        x: x, y: y,
        spikes: 5 + Math.floor(rnd(0, 5)),
        len: s * rnd(0.012, 0.04),
        jag: rnd(0.4, 1.1),
        seed: rnd(1000),
        baseRot: rnd(0, p.TWO_PI),
        spin: rnd(-0.14, 0.14),
        hue: p.random() < 0.25 ? rnd(95, 150) : rnd(0, 360),
        sat: rnd(80, 98),
        bri: rnd(66, 86),
        weight: p.max(0.9, s * rnd(0.001, 0.0015)),
      };
    } else if (kind === 'rosette') {
      return {
        kind: 'rosette', zone: zone,
        x: x, y: y,
        angle: rnd(100, 300),
        niter: 8 + Math.floor(rnd(0, 16)),
        size: s * rnd(0.03, 0.075),
        seed: rnd(1000),
        spin: rnd(-0.12, 0.12),
        hue: p.random() < 0.4 ? rnd(95, 150) : rnd(0, 360),
        sat: rnd(72, 96),
        bri: rnd(70, 92),
        weight: p.max(0.8, s * rnd(0.001, 0.0016)),
      };
    }
    // ---- sun: warm noisy rays + coil core (new for this page) ----
    return makeSun(x, y, zone, s * rnd(0.025, 0.055));
  }

  function makeSun(x, y, zone, len) {
    const s = unit;
    return {
      kind: 'sun', zone: zone,
      x: x, y: y,
      rays: 9 + Math.floor(rnd(0, 8)),
      len: len,
      core: s * rnd(0.006, 0.013),
      jag: rnd(0.15, 0.45),
      seed: rnd(1000),
      baseRot: rnd(0, p.TWO_PI),
      spin: rnd(-0.06, 0.06),
      hue: rnd(35, 58),                 // yellows into orange
      sat: rnd(80, 98),
      bri: rnd(72, 94),
      weight: p.max(0.9, s * rnd(0.001, 0.0016)),
    };
  }

  // ---- placement ----

  // viewport border, as on the homepage
  function ringViewport() {
    const s = unit;
    const band = p.max(34, s * 0.08);
    const edgeMin = p.max(8, s * 0.012);

    function place(axis, baseCoord, sign) {
      const len = axis === 'h' ? p.width : p.height;
      const count = p.max(3, Math.floor(len / (s * 0.22)));
      for (let k = 0; k <= count; k++) {
        if (p.random() < 0.18) continue; // gaps -> less organized
        const u = p.constrain((k + rnd(-0.45, 0.45)) / count, 0.02, 0.98);
        const along = u * len;
        const inset = edgeMin + rnd(0, band);
        const x = axis === 'h' ? along : baseCoord + sign * inset;
        const y = axis === 'h' ? baseCoord + sign * inset : along;
        const alongHeading = axis === 'h' ? (p.random() < 0.5 ? 0 : Math.PI)
                                          : (p.random() < 0.5 ? p.HALF_PI : -p.HALF_PI);
        // suns like the sky: more likely in the top third of the page
        const sunBias = y < p.height * 0.33 ? 0.22 : -0.08;
        els.push(spawn(x, y, alongHeading, 'border', sunBias));
      }
    }

    place('h', 0, +1);          // top
    place('h', p.height, -1);   // bottom
    place('v', 0, +1);          // left
    place('v', p.width, -1);    // right

    // two proper suns up in the corners of the sky
    els.push(makeSun(p.width * rnd(0.08, 0.2), p.height * rnd(0.07, 0.16), 'border', unit * rnd(0.05, 0.09)));
    els.push(makeSun(p.width * rnd(0.8, 0.92), p.height * rnd(0.07, 0.16), 'border', unit * rnd(0.05, 0.09)));
  }

  // ring the polaroid frame; negative inset creeps onto the photo itself
  function ringStage(r) {
    const s = unit;
    const band = p.max(26, s * 0.05);
    const perim = 2 * (r.width + r.height);
    const count = p.max(8, Math.floor(perim / (s * 0.16)));
    for (let k = 0; k < count; k++) {
      if (p.random() < 0.22) continue;
      const u = (k + rnd(-0.4, 0.4)) / count * perim;
      let x, y, heading;
      let d = ((u % perim) + perim) % perim;
      if (d < r.width)                       { x = r.left + d; y = r.top; heading = p.random() < 0.5 ? 0 : Math.PI;
        y += rnd(-band * 0.5, band * 0.35); }
      else if ((d -= r.width) < r.height)    { x = r.right; y = r.top + d; heading = p.random() < 0.5 ? p.HALF_PI : -p.HALF_PI;
        x += rnd(-band * 0.35, band * 0.5); }
      else if ((d -= r.height) < r.width)    { x = r.right - d; y = r.bottom; heading = p.random() < 0.5 ? 0 : Math.PI;
        y += rnd(-band * 0.35, band * 0.5); }
      else { d -= r.width;                     x = r.left; y = r.bottom - d; heading = p.random() < 0.5 ? p.HALF_PI : -p.HALF_PI;
        x += rnd(-band * 0.5, band * 0.35); }
      els.push(spawn(x, y, heading, 'stage', -0.05));
    }
  }

  // a few long slow vines that crawl right across the polaroid
  function sprawl(r) {
    const n = 2 + Math.floor(rnd(0, 3));
    for (let i = 0; i < n; i++) {
      const side = Math.floor(rnd(0, 4));
      let x, y;
      if (side === 0)      { x = r.left + rnd(0.1, 0.9) * r.width; y = r.top; }
      else if (side === 1) { x = r.right; y = r.top + rnd(0.1, 0.9) * r.height; }
      else if (side === 2) { x = r.left + rnd(0.1, 0.9) * r.width; y = r.bottom; }
      else                 { x = r.left; y = r.top + rnd(0.1, 0.9) * r.height; }
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const toward = Math.atan2(cy - y, cx - x);
      els.push(Object.assign(
        spawnVineLike(x, y, toward + rnd(-0.5, 0.5)),
        { zone: 'stage' }
      ));
    }
  }

  // a sprawler is a vine with a longer, slower life
  function spawnVineLike(x, y, heading) {
    const s = unit;
    return {
      kind: 'vine', zone: 'stage',
      x: x, y: y,
      niter: Math.floor(rnd(170, 340)),
      step: s * rnd(0.004, 0.007),
      wander: rnd(0.18, 0.5),
      noiseIndex: rnd(0, 3),
      seed: rnd(1000),
      heading: heading,
      grow: reduceMotion ? 1 : 0,
      growSpeed: rnd(0.0015, 0.004),
      hue: p.random() < 0.85 ? rnd(95, 150) : rnd(0, 360),
      sat: rnd(60, 92),
      bri: rnd(42, 66),
      weight: p.max(0.8, s * rnd(0.0008, 0.0014)),
      tendrils: true,
    };
  }

  function buildElements() {
    els = [];
    unit = p.min(p.width, p.height);
    ringViewport();
    const r = stageRect();
    if (r && r.width > 40) {
      ringStage(r);
      sprawl(r);
    }
  }

  // each new polaroid: fresh growth around the frame
  function regrowStage() {
    els = els.filter(function (e) { return e.zone !== 'stage'; });
    const r = stageRect();
    if (r && r.width > 40) {
      ringStage(r);
      sprawl(r);
    }
    if (reduceMotion) p.redraw();
  }

  p.setup = function () {
    const c = p.createCanvas(p.windowWidth, p.windowHeight);
    c.parent('garden');
    p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.frameRate(30);
    p.clear(); // transparent — the page (and the polaroid) shows through
    buildElements();
    window.addEventListener('photochange', regrowStage);
    if (reduceMotion) {
      p.noLoop();
      p.redraw();
    }
  };

  let lastW = window.innerWidth;
  p.windowResized = function () {
    // ignore height-only resizes (mobile address bar show/hide on scroll)
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    p.clear();
    buildElements();
    if (reduceMotion) p.redraw();
  };

  // flower petal: flowerbeds turtle spiral. a = heading, b = turn-rate;
  // b += base + high-freq noise per step -> noisy runaway coil.
  function spiral(f, seedOff, hue) {
    let a = 0, b = 0, x = 0, y = 0;
    p.noFill();
    p.stroke(hue % 360, f.sat, f.bri, 85);
    p.strokeWeight(f.weight);
    p.beginShape();
    p.vertex(0, 0);
    for (let i = 0; i < f.niter; i++) {
      a += b;
      b += BASE_TURN + f.coil * p.noise(i * 0.18 + t * f.timeScale + f.noiseIndex + f.seed + seedOff);
      x += f.step * Math.cos(a);
      y += f.step * Math.sin(a);
      p.vertex(x, y);
    }
    p.endShape();
  }

  function drawFlower(f) {
    p.push();
    p.translate(f.x, f.y);
    p.rotate(f.baseRot + (reduceMotion ? 0 : t * f.spin));
    for (let i = 0; i < f.numPetals; i++) {
      p.push();
      p.rotate(p.TWO_PI / (f.numPetals * (i + 1)));
      spiral(f, i * 7.3, f.hue + i * 11);
      p.pop();
    }
    p.pop();
  }

  // vine: heading random-walk, grows over time (faster when the music is loud)
  function drawVine(v) {
    if (!reduceMotion && v.grow < 1) {
      const rate = playing() ? (1 + 2 * level()) : 0.25;
      v.grow = Math.min(1, v.grow + v.growSpeed * rate);
    }
    const n = Math.max(2, Math.floor(v.niter * v.grow));
    let a = v.heading, x = 0, y = 0;
    const pts = [[0, 0]];
    for (let i = 0; i < n; i++) {
      a += v.wander * (p.noise(i * 0.12 + t * 0.2 * (0.5 + v.noiseIndex) + v.seed) - 0.5);
      x += v.step * Math.cos(a);
      y += v.step * Math.sin(a);
      pts.push([x, y]);
    }
    p.push();
    p.translate(v.x, v.y);
    p.noFill();
    p.stroke(v.hue % 360, v.sat, v.bri, 88);
    p.strokeWeight(v.weight);
    p.beginShape();
    for (const pt of pts) p.vertex(pt[0], pt[1]);
    p.endShape();
    // tendril buds along the strand
    if (v.tendrils) {
      for (let i = 12; i < pts.length; i += 16) {
        p.push();
        p.translate(pts[i][0], pts[i][1]);
        p.rotate((reduceMotion ? 0 : t * 0.6) + v.seed + i);
        p.stroke(v.hue % 360, v.sat, v.bri + 10, 80);
        p.strokeWeight(v.weight * 0.8);
        p.beginShape();
        let aa = 0, bb = 0, xx = 0, yy = 0;
        const R = unit * 0.004;
        for (let j = 0; j < 14; j++) {
          aa += bb;
          bb += 0.18 + 0.5 * p.noise(j * 0.4 + v.seed + i);
          xx += R * Math.cos(aa);
          yy += R * Math.sin(aa);
          p.vertex(xx, yy);
        }
        p.endShape();
        p.pop();
      }
    }
    p.pop();
  }

  // daisy: concentric rings of small circles; pulse deepens with loudness
  function drawDaisy(d) {
    const amp = 0.08 + (playing() ? 0.22 * level() : 0);
    const pulse = reduceMotion ? 1 : 1 + amp * Math.sin(t * 2 + d.seed);
    p.push();
    p.translate(d.x, d.y);
    p.rotate(d.baseRot + (reduceMotion ? 0 : t * d.spin));
    p.noFill();
    p.stroke(d.hue % 360, d.sat, d.bri, 85);
    p.strokeWeight(d.weight);
    for (let ring = 0; ring < d.rings; ring++) {
      const rr = d.ringR * (1 + ring * 0.6) * pulse;
      for (let i = 0; i < d.dots; i++) {
        const a = (p.TWO_PI / d.dots) * i + ring * 0.3;
        p.circle(rr * Math.cos(a), rr * Math.sin(a), d.dotR * 2);
      }
    }
    p.noStroke();
    p.fill(d.hue % 360, d.sat, d.bri, 85);
    p.circle(0, 0, d.dotR * 1.6);
    p.pop();
  }

  // lily: jagged, inharmonic — spikes of uneven length and noisy heading.
  function drawLily(l) {
    p.push();
    p.translate(l.x, l.y);
    p.rotate(l.baseRot + (reduceMotion ? 0 : t * l.spin));
    p.noFill();
    p.stroke(l.hue % 360, l.sat, l.bri, 88);
    p.strokeWeight(l.weight);
    const seg = 5;
    for (let i = 0; i < l.spikes; i++) {
      const len = l.len * (0.4 + p.noise(i * 1.3 + l.seed + t * 0.3));
      let a = (p.TWO_PI / l.spikes) * i;
      let x = 0, y = 0;
      p.beginShape();
      p.vertex(0, 0);
      for (let j = 0; j < seg; j++) {
        a += l.jag * (p.noise(i * 2.1 + j * 0.7 + l.seed + t * 0.2) - 0.5);
        x += (len / seg) * Math.cos(a);
        y += (len / seg) * Math.sin(a);
        p.vertex(x, y);
      }
      p.endShape();
    }
    p.pop();
  }

  // rosette: EYESY flowerbeds spiral — heading i*(360/niter + angle), auto-fit
  function drawRosette(e) {
    const pts = [];
    let x = 0, y = 0, maxd = 0;
    for (let i = 0; i < e.niter; i++) {
      const rad = p.radians(i * (360 / e.niter + e.angle));
      const st = i / e.niter;
      x += Math.cos(rad) * 0.5 * st;
      y += Math.sin(rad) * 0.5 * st;
      pts.push([x, y]);
      const d = Math.hypot(x, y);
      if (d > maxd) maxd = d;
    }
    const sc = maxd > 0 ? e.size / maxd : 1;
    p.push();
    p.translate(e.x, e.y);
    p.rotate(reduceMotion ? e.seed : t * e.spin + e.seed);
    p.noFill();
    p.stroke(e.hue % 360, e.sat, e.bri, 85);
    p.strokeWeight(e.weight);
    p.beginShape();
    for (const pt of pts) p.vertex(pt[0] * sc, pt[1] * sc);
    p.endShape();
    p.pop();
  }

  // sun: alternating long/short noisy rays that flare with the music,
  // around a small turtle-coil core. warm hues only.
  function drawSun(u) {
    const flare = 1 + (reduceMotion ? 0 : (playing() ? 0.9 * level() : 0));
    p.push();
    p.translate(u.x, u.y);
    p.rotate(u.baseRot + (reduceMotion ? 0 : t * u.spin));
    p.noFill();
    p.stroke(u.hue % 360, u.sat, u.bri, 90);
    p.strokeWeight(u.weight);
    const seg = 4;
    for (let i = 0; i < u.rays; i++) {
      const base = (p.TWO_PI / u.rays) * i;
      const L = u.len * (i % 2 ? 0.6 : 1)
        * (0.7 + 0.45 * p.noise(i * 1.7 + u.seed + t * 0.35))
        * flare;
      let a = base;
      let x = Math.cos(base) * u.core * 1.7;
      let y = Math.sin(base) * u.core * 1.7;
      p.beginShape();
      p.vertex(x, y);
      for (let j = 0; j < seg; j++) {
        a += u.jag * (p.noise(i * 2.3 + j * 0.6 + u.seed + t * 0.25) - 0.5);
        x += (L / seg) * Math.cos(a);
        y += (L / seg) * Math.sin(a);
        p.vertex(x, y);
      }
      p.endShape();
    }
    // coil core
    let a = 0, b = 0, x = 0, y = 0;
    p.beginShape();
    p.vertex(0, 0);
    for (let i = 0; i < 22; i++) {
      a += b;
      b += 0.35 + 0.4 * p.noise(i * 0.3 + u.seed + t * 0.1);
      x += u.core * 0.32 * Math.cos(a);
      y += u.core * 0.32 * Math.sin(a);
      p.vertex(x, y);
    }
    p.endShape();
    p.pop();
  }

  p.draw = function () {
    if (reduceMotion) {
      p.clear();
    } else {
      // the garden dances while the music plays; idles softly otherwise
      t += 0.01 * (playing() ? (1 + 2.2 * level()) : 0.15);
      // fade existing pixels toward transparent -> feedback trails
      p.noStroke();
      p.erase(42);
      p.rect(0, 0, p.width, p.height);
      p.noErase();
    }
    for (const e of els) {
      if (e.kind === 'vine') drawVine(e);
      else if (e.kind === 'daisy') drawDaisy(e);
      else if (e.kind === 'lily') drawLily(e);
      else if (e.kind === 'rosette') drawRosette(e);
      else if (e.kind === 'sun') drawSun(e);
      else drawFlower(e);
    }
  };
};

new p5(gardenSketch, 'garden');
