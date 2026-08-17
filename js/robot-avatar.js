/**
 * robot-avatar.js
 * Renders an animated SVG robot face.
 * States: idle (slow blink loop), thinking (eyes darting), speaking (mouth moves).
 *
 * Usage:
 *   RobotAvatar.buildHero(containerEl)   — large hero on empty state
 *   RobotAvatar.buildInline(containerEl) — small 24px avatar on message row
 *   RobotAvatar.setState(el, 'idle' | 'thinking' | 'speaking')
 */
(function () {
  'use strict';

  /* ── palette pulled from CSS vars at call time ── */
  function getAccent() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6366f1';
  }

  /* ── SVG builder ── */
  function makeSVG(opts) {
    const { size, eyeR, eyeY, mouthW, mouthY, antH, earW, earH } = opts;
    const cx = size / 2;
    const eyeLx = cx - size * 0.18;
    const eyeRx = cx + size * 0.18;
    const bodyX = size * 0.12;
    const bodyY = size * 0.30;
    const bodyW = size * 0.76;
    const bodyH = size * 0.50;
    const bodyRx = size * 0.10;
    const accent = getAccent();

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"
      width="${size}" height="${size}" role="img" aria-label="AI robot" class="robot-svg">
      <!-- antenna -->
      <line x1="${cx}" y1="${bodyY}" x2="${cx}" y2="${bodyY - antH}"
        stroke="${accent}" stroke-width="${size * 0.04}" stroke-linecap="round" class="r-antenna"/>
      <circle cx="${cx}" cy="${bodyY - antH - size * 0.04}" r="${size * 0.05}"
        fill="${accent}" class="r-antenna-dot"/>
      <!-- ears -->
      <rect x="${bodyX - earW}" y="${bodyY + bodyH * 0.25}" width="${earW}" height="${earH}"
        rx="${earW * 0.4}" fill="${accent}" opacity="0.7" class="r-ear r-ear-l"/>
      <rect x="${bodyX + bodyW}" y="${bodyY + bodyH * 0.25}" width="${earW}" height="${earH}"
        rx="${earW * 0.4}" fill="${accent}" opacity="0.7" class="r-ear r-ear-r"/>
      <!-- head body -->
      <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}"
        rx="${bodyRx}" fill="${accent}" class="r-head"/>
      <!-- eyes (white sclera) -->
      <ellipse cx="${eyeLx}" cy="${eyeY}" rx="${eyeR * 1.2}" ry="${eyeR}" fill="white" class="r-eye-bg r-eye-l-bg"/>
      <ellipse cx="${eyeRx}" cy="${eyeY}" rx="${eyeR * 1.2}" ry="${eyeR}" fill="white" class="r-eye-bg r-eye-r-bg"/>
      <!-- pupils -->
      <circle cx="${eyeLx}" cy="${eyeY}" r="${eyeR * 0.55}" fill="${accent}" class="r-pupil r-pupil-l"/>
      <circle cx="${eyeRx}" cy="${eyeY}" r="${eyeR * 0.55}" fill="${accent}" class="r-pupil r-pupil-r"/>
      <!-- shine dots -->
      <circle cx="${eyeLx + eyeR * 0.3}" cy="${eyeY - eyeR * 0.3}" r="${eyeR * 0.2}" fill="white" opacity="0.8" class="r-shine"/>
      <circle cx="${eyeRx + eyeR * 0.3}" cy="${eyeY - eyeR * 0.3}" r="${eyeR * 0.2}" fill="white" opacity="0.8" class="r-shine"/>
      <!-- blink overlay (closed eye lines) — hidden by default -->
      <line x1="${eyeLx - eyeR * 1.1}" y1="${eyeY}" x2="${eyeLx + eyeR * 1.1}" y2="${eyeY}"
        stroke="white" stroke-width="${eyeR * 0.35}" stroke-linecap="round"
        class="r-blink r-blink-l" style="display:none"/>
      <line x1="${eyeRx - eyeR * 1.1}" y1="${eyeY}" x2="${eyeRx + eyeR * 1.1}" y2="${eyeY}"
        stroke="white" stroke-width="${eyeR * 0.35}" stroke-linecap="round"
        class="r-blink r-blink-r" style="display:none"/>
      <!-- mouth (smile arc) -->
      <path d="M ${cx - mouthW/2} ${mouthY} Q ${cx} ${mouthY + size*0.06} ${cx + mouthW/2} ${mouthY}"
        stroke="white" stroke-width="${size * 0.035}" fill="none" stroke-linecap="round"
        class="r-mouth r-mouth-smile"/>
      <!-- mouth open (speaking) — hidden by default -->
      <ellipse cx="${cx}" cy="${mouthY + size*0.025}" rx="${mouthW*0.38}" ry="${size*0.04}"
        fill="white" class="r-mouth-open" style="display:none"/>
      <!-- forehead LED strip -->
      <rect x="${cx - size*0.18}" y="${bodyY + size*0.06}" width="${size*0.36}" height="${size*0.04}"
        rx="${size*0.02}" fill="white" opacity="0.25" class="r-led"/>
    </svg>`;
  }

  /* ── presets ── */
  function heroOpts() {
    const s = 90;
    return { size: s, eyeR: s*0.095, eyeY: s*0.52, mouthW: s*0.32, mouthY: s*0.68, antH: s*0.14, earW: s*0.05, earH: s*0.18 };
  }
  function inlineOpts() {
    const s = 24;
    return { size: s, eyeR: s*0.10, eyeY: s*0.52, mouthW: s*0.30, mouthY: s*0.70, antH: s*0.14, earW: s*0.055, earH: s*0.18 };
  }

  /* ── state machine ── */
  function setState(container, state) {
    if (!container) return;
    container.dataset.robotState = state;
    const svgEl = container.querySelector('.robot-svg');
    if (!svgEl) return;

    const blinkL = svgEl.querySelector('.r-blink-l');
    const blinkR = svgEl.querySelector('.r-blink-r');
    const pupilL = svgEl.querySelector('.r-pupil-l');
    const pupilR = svgEl.querySelector('.r-pupil-r');
    const smile  = svgEl.querySelector('.r-mouth-smile');
    const open   = svgEl.querySelector('.r-mouth-open');
    const antDot = svgEl.querySelector('.r-antenna-dot');

    // Clear existing state classes
    svgEl.classList.remove('state-idle', 'state-thinking', 'state-speaking');
    svgEl.classList.add('state-' + state);

    if (state === 'idle') {
      if (blinkL) blinkL.style.display = 'none';
      if (blinkR) blinkR.style.display = 'none';
      if (smile)  smile.style.display  = '';
      if (open)   open.style.display   = 'none';
      if (pupilL) { pupilL.style.transform = ''; pupilL.style.transformOrigin = ''; }
      if (pupilR) { pupilR.style.transform = ''; pupilR.style.transformOrigin = ''; }
    } else if (state === 'thinking') {
      if (smile) smile.style.display  = '';
      if (open)  open.style.display   = 'none';
    } else if (state === 'speaking') {
      if (smile) smile.style.display  = 'none';
      if (open)  open.style.display   = '';
    }
  }

  /* ── auto-blink loop ── */
  function startBlinkLoop(container) {
    if (!container) return;
    let handle = null;

    function doBlink() {
      const state = container.dataset.robotState || 'idle';
      const svgEl = container.querySelector('.robot-svg');
      if (!svgEl) return;
      const blinkL = svgEl.querySelector('.r-blink-l');
      const blinkR = svgEl.querySelector('.r-blink-r');
      if (!blinkL || !blinkR) return;

      // Only blink during idle/speaking, not mid-pupil-dart
      if (state === 'thinking') {
        scheduleNext();
        return;
      }

      blinkL.style.display = '';
      blinkR.style.display = '';
      setTimeout(() => {
        blinkL.style.display = 'none';
        blinkR.style.display = 'none';
      }, 120);

      scheduleNext();
    }

    function scheduleNext() {
      const min = 2200, max = 5500;
      const delay = min + Math.random() * (max - min);
      handle = setTimeout(doBlink, delay);
    }

    scheduleNext();
    container._stopBlink = () => { if (handle) clearTimeout(handle); };
  }

  /* ── thinking pupil dart loop ── */
  function startThinkingLoop(container) {
    if (!container) return;
    let handle = null;

    function dartPupils() {
      const state = container.dataset.robotState || 'idle';
      if (state !== 'thinking') { scheduleNext(); return; }

      const svgEl = container.querySelector('.robot-svg');
      if (!svgEl) { scheduleNext(); return; }
      const pupilL = svgEl.querySelector('.r-pupil-l');
      const pupilR = svgEl.querySelector('.r-pupil-r');
      if (!pupilL || !pupilR) { scheduleNext(); return; }

      const dx = (Math.random() - 0.5) * 3.5;
      const dy = (Math.random() - 0.5) * 2;
      [pupilL, pupilR].forEach(p => {
        p.style.transition = 'transform 0.18s ease';
        p.style.transform = `translate(${dx}px, ${dy}px)`;
      });

      setTimeout(() => {
        [pupilL, pupilR].forEach(p => {
          p.style.transition = 'transform 0.22s ease';
          p.style.transform = '';
        });
      }, 320);

      scheduleNext();
    }

    function scheduleNext() {
      handle = setTimeout(dartPupils, 350 + Math.random() * 600);
    }

    scheduleNext();
    container._stopThinking = () => { if (handle) clearTimeout(handle); };
  }

  /* ── speaking mouth animation ── */
  function startSpeakingLoop(container) {
    if (!container) return;
    let handle = null;

    function cycle() {
      const state = container.dataset.robotState || 'idle';
      if (state !== 'speaking') { scheduleNext(400); return; }

      const svgEl = container.querySelector('.robot-svg');
      if (!svgEl) { scheduleNext(400); return; }
      const openMouth = svgEl.querySelector('.r-mouth-open');
      if (!openMouth) { scheduleNext(400); return; }

      // Pulse ry between small and large
      const isOpen = openMouth.getAttribute('ry') > 1;
      const targetRy = isOpen ? '0.8' : String(parseFloat(openMouth.getAttribute('ry') || '1') * 1.6 + Math.random());
      openMouth.setAttribute('ry', Math.min(parseFloat(targetRy), 5).toFixed(1));

      scheduleNext(80 + Math.random() * 120);
    }

    function scheduleNext(ms) {
      handle = setTimeout(cycle, ms || 120);
    }

    scheduleNext(80);
    container._stopSpeaking = () => { if (handle) clearTimeout(handle); };
  }

  /* ── public build functions ── */
  function buildHero(container) {
    if (!container) return;
    container.innerHTML = makeSVG(heroOpts());
    container.classList.add('robot-container', 'robot-hero');
    setState(container, 'idle');
    startBlinkLoop(container);
    startThinkingLoop(container);
    startSpeakingLoop(container);
  }

  function buildInline(container) {
    if (!container) return;
    container.innerHTML = makeSVG(inlineOpts());
    container.classList.add('robot-container', 'robot-inline');
    setState(container, 'idle');
    startBlinkLoop(container);
    startThinkingLoop(container);
    startSpeakingLoop(container);
  }

  window.RobotAvatar = { buildHero, buildInline, setState };
})();
