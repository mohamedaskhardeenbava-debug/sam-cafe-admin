/**
 * PageLoader.jsx  —  Sam Cafe Admin Panel
 *
 * Single reusable full-page loader. Replaces every ad-hoc spinner
 * (.co-spinner, .ts-spinner, plain "Loading…" divs) across the project.
 *
 * The full-page variant is a top-down ("flat lay") vegetable cutter scene:
 * a chef's knife chops a carrot into coin-shaped slices on a wooden board,
 * loops forever. Ported 1:1 from the standalone SVG/vanilla-JS build —
 * same constants, easing, and phase machine — just re-homed onto React
 * refs instead of document.getElementById, and started/stopped from a
 * useEffect so it can't leak rAF loops across route changes.
 *
 * ─────────────────────────────────────────────────────────────────
 * USAGE
 *
 *   import PageLoader from "../components/PageLoader";
 *   // or "../../components/PageLoader" for deeper folders
 *
 *   // 1. Simple — show while data isn't ready yet (fill the page, not
 *   //    the viewport — this is a per-page state, not the initial load)
 *   if (!adminData.staff?.length) return <PageLoader fill />;
 *
 *   // 2. With a custom label
 *   if (loading) return <PageLoader fill label="Loading theme settings…" />;
 *
 *   // 3. Inline (inside a section, not full-page) — shows simple spinner
 *   if (loading) return <PageLoader inline />;
 *
 *   // 4. Wrap the whole page so the shell (header) still shows
 *   return (
 *     <div className="dishes-page">
 *       {loading ? <PageLoader fill label="Loading dishes…" /> : <YourContent />}
 *     </div>
 *   );
 *
 *   // 5. The ONE exception: the true initial app load, before the app
 *   //    shell (sidebar/topbar) has rendered at all — omit `fill` so it
 *   //    covers the full viewport, since there's no page container yet.
 *   if (isAuthLoading) return <PageLoader label="Checking session…" />;
 *
 * ─────────────────────────────────────────────────────────────────
 * Props
 *
 * @prop {string}  [label]   — Custom loading text.
 *                             Default: "Loading…"
 * @prop {boolean} [inline]  — When true, renders a compact centred row
 *                             with a simple spinner ring instead of the
 *                             cooking animation. Use inside cards/panels.
 *                             Default: false
 * @prop {boolean} [fill]    — When true, fills the nearest positioned
 *                             ancestor (the page/content container) instead
 *                             of the whole viewport. Use this for anything
 *                             that isn't the very first app load — a
 *                             per-page loading state, a venue switch, a
 *                             re-fetch — so the sidebar/topbar stay visible
 *                             instead of being blanked out along with the
 *                             content. Reserve the default (viewport-fixed)
 *                             behavior for the one true full-page loader:
 *                             the initial session check before the app
 *                             shell has rendered at all.
 *                             Default: false
 */

import React, { useEffect, useRef } from "react";
import "./PageLoader.css";

/* ==========================================================================
   Scene constants — identical values/meaning to the standalone build.
   ========================================================================== */
const CHOP_X = 520; // fixed world x where the blade meets the carrot
const CARROT_Y = 230; // the actual cut line — the carrot's centreline
const BLADE_CENTER_OFFSET = 60; // distance from the blade's tip to its visual centre, along its length
const KNIFE_ANCHOR_Y = CARROT_Y - BLADE_CENTER_OFFSET; // world Y of the knife's local origin (its tip)
const TAIL_HEIGHT = 64; // carrot's full width at the thick tail end
const TIP_HEIGHT = 34; // carrot's full width at the thin original tip
const SLICE_WIDTH = 44; // horizontal width removed per chop
const TOTAL_SLICES = 6; // slices consumed before the carrot resets
const FULL_LENGTH = SLICE_WIDTH * TOTAL_SLICES;

const LIGHT_DX = 0.5;
const LIGHT_DY = 0.82;

const Z_GRAVITY = 900;
const SLICE_SETTLE_ANGLE = 70;
const SLICE_ROW_SPACING = 17;
const SWEEP_DISTANCE = 380;

const KNIFE_TILT = -4;
const BACK_AMOUNT = 40;
const IDLE_SCALE = 1;
const PEAK_SCALE = 1.17;
const CONTACT_SCALE = 0.9;

const BOARD_RIGHT_EDGE = 840; // matches the board rect's x + width in the SVG below

const SVGNS = "http://www.w3.org/2000/svg";

/* ----------------------------- easing toolbox ----------------------------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

const createSVG = (tag, attrs = {}) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  return el;
};

/** Runs the whole vegetable-cutter loop against a set of DOM refs. Returns
 *  a cleanup function that cancels the rAF loop — called from useEffect. */
function startVegetableCutterLoop(refs) {
  const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOTION = REDUCE_MOTION ? 1.6 : 1;
  const CRUMB_COUNT = REDUCE_MOTION ? 3 : 7;

  const D = {
    ANTICIPATE: 300 * MOTION,
    STRIKE: 110 * MOTION,
    RECOIL: 190 * MOTION,
    ADVANCE: 300 * MOTION,
    PAUSE: 190 * MOTION,
    SWEEP: 480 * MOTION,
    SWEEP_RETURN: 260 * MOTION,
    RESET: 420 * MOTION,
  };

  const {
    carrotGroup,
    carrotBody,
    carrotHighlight,
    carrotShadow,
    carrotGreen,
    knifeSwing,
    knifeShadow,
    bladeSpineShine,
    bladeEdgeShine,
    fxLayer,
  } = refs;

  if (!carrotGroup || !carrotBody || !knifeSwing || !fxLayer) {
    // Refs not mounted (e.g. unmounted before first paint) — no-op.
    return () => { };
  }

  function positionShadow(el, x, y, elevation, rx, ry, opts = {}) {
    const baseOff = opts.baseOff ?? 4;
    const liftOff = opts.liftOff ?? 20;
    const growAmt = opts.growAmt ?? 0.35;
    const baseOpacity = opts.baseOpacity ?? 0.34;
    const liftFade = opts.liftFade ?? 0.14;

    const off = baseOff + elevation * liftOff;
    const grow = 1 + elevation * growAmt;

    el.setAttribute("cx", x + off * LIGHT_DX);
    el.setAttribute("cy", y + off * LIGHT_DY);
    el.setAttribute("rx", rx * grow);
    el.setAttribute("ry", ry * grow);
    el.style.opacity = Math.max(0.06, baseOpacity - elevation * liftFade);
  }

  /* ==========================================================================
     Carrot geometry
     ========================================================================== */
  function heightAtLocalS(s) {
    const t = clamp(s / FULL_LENGTH, 0, 1);
    return lerp(TIP_HEIGHT, TAIL_HEIGHT, t);
  }

  function renderCoin(parent, r) {
    while (parent.firstChild) parent.removeChild(parent.firstChild);
    parent.appendChild(createSVG("ellipse", { rx: r, ry: r * 0.96, fill: "url(#gradCoinOuter)" }));
    parent.appendChild(
      createSVG("circle", { r: r * 0.66, fill: "none", stroke: "var(--carrot-ring)", "stroke-width": 1.3, opacity: 0.8 })
    );
    parent.appendChild(
      createSVG("circle", { r: r * 0.38, fill: "none", stroke: "var(--carrot-ring)", "stroke-width": 1.1, opacity: 0.65 })
    );
    parent.appendChild(createSVG("circle", { r: r * 0.15, fill: "var(--carrot-core)" }));
    parent.appendChild(
      createSVG("ellipse", {
        cx: -r * 0.28,
        cy: -r * 0.32,
        rx: r * 0.22,
        ry: r * 0.12,
        fill: "#ffffff",
        opacity: 0.32,
      })
    );
  }

  const carrot = {
    sliceCount: 0,
    worldTipX: CHOP_X,
  };

  function remainingLength() {
    return FULL_LENGTH - carrot.sliceCount * SLICE_WIDTH;
  }
  function tipHeight() {
    return heightAtLocalS(carrot.sliceCount * SLICE_WIDTH);
  }

  function updateCarrotGeometry() {
    const tipX = carrot.worldTipX;
    const remLen = remainingLength();
    const tailX = tipX - remLen;
    const hTip = tipHeight();
    const hTail = TAIL_HEIGHT;
    const cy = CARROT_Y;
    const midX = (tailX + tipX) / 2;
    const bulge = Math.max(hTail, hTip) * 0.2;

    const topTail = cy - hTail / 2;
    const topTip = cy - hTip / 2;
    const botTail = cy + hTail / 2;
    const botTip = cy + hTip / 2;

    const d =
      `M ${tailX} ${topTail} ` +
      `Q ${midX} ${topTail - bulge} ${tipX} ${topTip} ` +
      `L ${tipX} ${botTip} ` +
      `Q ${midX} ${botTail + bulge} ${tailX} ${botTail} Z`;
    carrotBody.setAttribute("d", d);

    const hlD = `M ${tailX + 10} ${topTail + 5} Q ${midX} ${topTail - bulge + 7} ${tipX - 6} ${topTip + 4}`;
    carrotHighlight.setAttribute("d", hlD);

    positionShadow(carrotShadow, midX, cy, 0, Math.max(18, remLen * 0.48), hTail * 0.56, {
      baseOff: 5,
      baseOpacity: 0.3,
    });

    carrotGreen.setAttribute("transform", `translate(${tailX - 2}, ${cy})`);
  }

  let carrotOpacityOverride = -1;
  function applyCarrotOpacity(v) {
    carrotOpacityOverride = v;
  }

  let wobble = null;
  function triggerCarrotWobble() {
    wobble = { start: performance.now() };
  }
  function applyCarrotWobble(now) {
    let jolt = 0;
    if (wobble) {
      const p = clamp((now - wobble.start) / 220, 0, 1);
      if (p >= 1) {
        wobble = null;
      } else {
        const decay = Math.exp(-p * 7);
        const osc = Math.sin(p * Math.PI * 3);
        jolt = decay * osc * 2.6;
      }
    }

    carrotGroup.style.transform = `translate(${sweepOffsetX + jolt}px, ${jolt * 0.35}px)`;

    if (carrotOpacityOverride >= 0) {
      carrotGroup.style.opacity = carrotOpacityOverride;
    } else {
      const renderTipX = carrot.worldTipX + sweepOffsetX;
      const FADE_MARGIN = 60;
      const opacity = 1 - clamp((renderTipX - (BOARD_RIGHT_EDGE - FADE_MARGIN)) / FADE_MARGIN, 0, 1);
      carrotGroup.style.opacity = opacity;
    }
  }

  /* ==========================================================================
     Knife
     ========================================================================== */
  function applyKnife(xOffset, yOffset, scale) {
    knifeSwing.setAttribute(
      "transform",
      `translate(${CHOP_X + xOffset}, ${KNIFE_ANCHOR_Y + yOffset}) rotate(${KNIFE_TILT}) scale(${scale})`
    );
  }

  let impactPulse = null;
  function triggerImpactPulse(now) {
    impactPulse = { start: now };
  }
  function impactPulseScale(now) {
    if (!impactPulse) return 1;
    const p = clamp((now - impactPulse.start) / 170, 0, 1);
    if (p >= 1) {
      impactPulse = null;
      return 1;
    }
    return 1 + Math.exp(-p * 8) * 0.05;
  }

  let bladeFlash = null;
  function triggerBladeFlash(now) {
    bladeFlash = { start: now };
  }
  function applyBladeFlash(now) {
    let opacity = 0.45;
    if (bladeFlash) {
      const p = clamp((now - bladeFlash.start) / 220, 0, 1);
      if (p >= 1) {
        bladeFlash = null;
      } else {
        opacity = lerp(1, 0.45, p);
      }
    }
    if (bladeSpineShine) bladeSpineShine.style.opacity = opacity;
    if (bladeEdgeShine) bladeEdgeShine.style.opacity = opacity;
  }

  function updateKnifeShadow(xOffset, yOffset, elevation) {
    positionShadow(knifeShadow, CHOP_X + xOffset, KNIFE_ANCHOR_Y + yOffset + 88, elevation, 22, 104, {
      baseOff: 5,
      liftOff: 24,
      growAmt: 0.28,
      baseOpacity: 0.32,
      liftFade: 0.1,
    });
  }

  /* ==========================================================================
     Falling slice + crumb physics
     ========================================================================== */
  const slices = [];
  const crumbs = [];
  let sweepOffsetX = 0;

  function spawnSlice(cutX, cutY, targetX, targetY, r) {
    const shadowEl = createSVG("ellipse", { class: "fx-slice-shadow", cx: cutX, cy: cutY, rx: r * 0.92, ry: r * 0.92 });
    const g = createSVG("g", { class: "fx-slice", transform: `translate(${cutX}, ${cutY})` });
    renderCoin(g, r);
    fxLayer.appendChild(shadowEl);
    fxLayer.appendChild(g);

    slices.push({
      el: g,
      shadowEl,
      x: cutX,
      y: cutY,
      startX: cutX,
      startY: cutY,
      targetX,
      targetY,
      r,
      rot: 0,
      z: 0,
      vz: 210 + Math.random() * 70,
      bounced: false,
      landed: false,
      squashAt: null,
      moveStart: performance.now(),
      born: performance.now(),
    });
  }

  function crumbPoints(s) {
    return `${-s},${s * 0.6} ${s * 0.85},${-s} ${s},${s * 0.65}`;
  }

  function spawnCrumbs(x, y, count) {
    for (let i = 0; i < count; i++) {
      const size = 2 + Math.random() * 2.6;
      const el = createSVG("polygon", {
        class: "fx-crumb",
        points: crumbPoints(size),
        transform: `translate(${x}, ${y})`,
        style: Math.random() < 0.5 ? "" : "fill:var(--carrot-dark)",
      });
      fxLayer.appendChild(el);
      crumbs.push({
        el,
        x,
        y,
        rot: Math.random() * 360,
        vx: (Math.random() - 0.3) * 210,
        vy: (Math.random() - 0.5) * 210,
        vr: (Math.random() - 0.5) * 760,
        born: performance.now(),
      });
    }
  }

  function updateParticles(dtSec, now) {
    const CRUMB_FRICTION = 2.6;

    for (let i = slices.length - 1; i >= 0; i--) {
      const s = slices[i];

      if (!s.landed) {
        s.vz -= Z_GRAVITY * dtSec;
        s.z += s.vz * dtSec;
        if (s.z <= 0) {
          s.z = 0;
          if (!s.bounced) {
            s.vz *= -0.3;
            s.bounced = true;
            s.squashAt = now;
          } else {
            s.vz = 0;
            s.landed = true;
            s.squashAt = now;
          }
        }
      }

      const mp = clamp((now - s.moveStart) / 380, 0, 1);
      const me = easeOutCubic(mp);
      s.x = lerp(s.startX, s.targetX, me);
      s.y = lerp(s.startY, s.targetY, me);
      s.rot = lerp(0, SLICE_SETTLE_ANGLE, me);

      const elevNorm = clamp(s.z / 45, 0, 1);
      const popScale = 1 + elevNorm * 0.05;

      let squashX = 1;
      let squashY = 1;
      if (s.squashAt !== null) {
        const p = clamp((now - s.squashAt) / 150, 0, 1);
        const sq = (1 - p) * 0.26;
        squashY = 1 - sq;
        squashX = 1 + sq * 0.5;
      }

      const renderX = s.x + sweepOffsetX;
      const FADE_MARGIN = 60;
      const opacity = 1 - clamp((renderX - (BOARD_RIGHT_EDGE - FADE_MARGIN)) / FADE_MARGIN, 0, 1);

      s.el.setAttribute(
        "transform",
        `translate(${renderX}, ${s.y}) rotate(${s.rot}) scale(${popScale * squashX}, ${popScale * squashY})`
      );
      s.el.style.opacity = opacity;

      positionShadow(s.shadowEl, renderX, s.y, elevNorm, s.r * 0.92, s.r * 0.92, {
        baseOff: 3,
        liftOff: 16,
        growAmt: 0.25,
        baseOpacity: 0.3,
        liftFade: 0.12,
      });
      s.shadowEl.style.opacity = parseFloat(s.shadowEl.style.opacity) * opacity;
    }

    for (let i = crumbs.length - 1; i >= 0; i--) {
      const c = crumbs[i];
      c.vx -= c.vx * CRUMB_FRICTION * dtSec;
      c.vy -= c.vy * CRUMB_FRICTION * dtSec;
      c.x += c.vx * dtSec;
      c.y += c.vy * dtSec;
      c.rot += c.vr * dtSec;

      const age = now - c.born;
      const opacity = clamp(1 - age / 520, 0, 1);

      c.el.setAttribute("transform", `translate(${c.x}, ${c.y}) rotate(${c.rot})`);
      c.el.style.opacity = opacity;

      if (age > 520) {
        c.el.remove();
        crumbs.splice(i, 1);
      }
    }
  }

  /* ==========================================================================
     Chop cycle — finite-state machine driven off elapsed phase time.
     ========================================================================== */
  const state = {
    phase: "pause",
    phaseStart: 0,
  };

  function setPhase(phase, now) {
    state.phase = phase;
    state.phaseStart = now;
  }

  function clearAllSlices() {
    for (const s of slices) {
      s.el.remove();
      s.shadowEl.remove();
    }
    slices.length = 0;
  }

  function performImpact(now) {
    const preCutCount = carrot.sliceCount;
    const sliceMidS = (preCutCount + 0.5) * SLICE_WIDTH;
    const sliceRadius = (heightAtLocalS(sliceMidS) / 2) * 0.92;

    const slotX = CHOP_X + 4 + preCutCount * SLICE_ROW_SPACING;
    const wobbleY = (Math.random() - 0.5) * 12;
    spawnSlice(CHOP_X + 4, CARROT_Y, slotX, CARROT_Y + wobbleY, sliceRadius);
    spawnCrumbs(CHOP_X, CARROT_Y, CRUMB_COUNT);
    triggerCarrotWobble();
    triggerImpactPulse(now);
    triggerBladeFlash(now);

    carrot.sliceCount = preCutCount + 1;
    carrot.worldTipX = CHOP_X - SLICE_WIDTH;
    updateCarrotGeometry();
  }

  function runChopCycle(now) {
    const t = now - state.phaseStart;

    switch (state.phase) {
      case "anticipate": {
        const p = clamp(t / D.ANTICIPATE, 0, 1);
        const e = easeInOutSine(p);
        const angle = e * (Math.PI / 2);
        const yOffset = BACK_AMOUNT * Math.sin(angle);
        const elevation = 1 - Math.cos(angle);
        const scale = lerp(IDLE_SCALE, PEAK_SCALE, e);
        applyKnife(0, yOffset, scale);
        updateKnifeShadow(0, yOffset, elevation);
        if (p >= 1) setPhase("strike", now);
        break;
      }

      case "strike": {
        const p = clamp(t / D.STRIKE, 0, 1);
        const e = easeInCubic(p);
        const angle = (1 - e) * (Math.PI / 2);
        const yOffset = BACK_AMOUNT * Math.sin(angle);
        const elevation = 1 - Math.cos(angle);
        const scale = lerp(PEAK_SCALE, CONTACT_SCALE, e);
        applyKnife(0, yOffset, scale);
        updateKnifeShadow(0, yOffset, elevation);
        if (p >= 1) {
          performImpact(now);
          setPhase("settle", now);
        }
        break;
      }

      case "settle": {
        const pk = clamp(t / D.RECOIL, 0, 1);
        const scale = lerp(CONTACT_SCALE, IDLE_SCALE, easeOutCubic(pk)) * impactPulseScale(now);
        applyKnife(0, 0, scale);
        updateKnifeShadow(0, 0, 0);

        const pa = clamp(t / D.ADVANCE, 0, 1);
        carrot.worldTipX = lerp(CHOP_X - SLICE_WIDTH, CHOP_X, easeOutCubic(pa));
        updateCarrotGeometry();

        if (t >= Math.max(D.RECOIL, D.ADVANCE)) {
          carrot.worldTipX = CHOP_X;
          updateCarrotGeometry();
          setPhase("pause", now);
        }
        break;
      }

      case "pause": {
        applyKnife(0, 0, IDLE_SCALE * impactPulseScale(now));
        updateKnifeShadow(0, 0, 0);
        if (t >= D.PAUSE) {
          if (carrot.sliceCount >= TOTAL_SLICES) {
            setPhase("sweepOut", now);
          } else {
            setPhase("anticipate", now);
          }
        }
        break;
      }

      case "sweepOut": {
        applyCarrotOpacity(-1);

        const p = clamp(t / D.SWEEP, 0, 1);
        const e = easeInCubic(p);
        const xOffset = SWEEP_DISTANCE * e;
        applyKnife(xOffset, 0, IDLE_SCALE);
        updateKnifeShadow(xOffset, 0, 0);
        sweepOffsetX = xOffset;
        if (p >= 1) {
          clearAllSlices();
          carrot.sliceCount = 0;
          carrot.worldTipX = CHOP_X;
          updateCarrotGeometry();
          applyCarrotOpacity(0);
          setPhase("sweepReturn", now);
        }
        break;
      }

      case "sweepReturn": {
        const p = clamp(t / D.SWEEP_RETURN, 0, 1);
        const e = easeOutCubic(p);
        const xOffset = lerp(SWEEP_DISTANCE, 0, e);
        applyKnife(xOffset, 0, IDLE_SCALE);
        updateKnifeShadow(xOffset, 0, 0);
        sweepOffsetX = xOffset;
        if (p >= 1) {
          sweepOffsetX = 0;
          setPhase("resetIn", now);
        }
        break;
      }

      case "resetIn": {
        const p = clamp(t / D.RESET, 0, 1);
        applyCarrotOpacity(easeInOutSine(p));
        if (p >= 1) {
          applyCarrotOpacity(1);
          setPhase("anticipate", now);
        }
        break;
      }

      default:
        break;
    }
  }

  /* ==========================================================================
     Main loop
     ========================================================================== */
  let lastTime = null;
  let rafId = null;
  let cancelled = false;

  function tick(now) {
    if (cancelled) return;
    if (lastTime === null) lastTime = now;
    let dtMs = now - lastTime;
    lastTime = now;
    if (dtMs > 50) dtMs = 50;
    const dtSec = dtMs / 1000;

    updateParticles(dtSec, now);
    runChopCycle(now);
    applyCarrotWobble(now);
    applyBladeFlash(now);

    rafId = requestAnimationFrame(tick);
  }

  updateCarrotGeometry();
  applyKnife(0, 0, IDLE_SCALE);
  updateKnifeShadow(0, 0, 0);
  state.phase = "pause";
  state.phaseStart = performance.now();
  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}

/* ==========================================================================
   The scene itself, as JSX — same markup/ids as the standalone build, just
   using refs instead of getElementById and camelCase SVG attrs.
   ========================================================================== */
function VegetableCutterScene() {
  const refs = useRef({}).current;
  const setRef = (key) => (el) => {
    refs[key] = el;
  };

  useEffect(() => {
    const stop = startVegetableCutterLoop(refs);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="loader-visual">
      <svg viewBox="0 0 900 500" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id="gradBoard" cx="42%" cy="38%" r="75%">
            <stop offset="0%" style={{ stopColor: "var(--board-top)" }} />
            <stop offset="60%" style={{ stopColor: "var(--board-mid)" }} />
            <stop offset="100%" style={{ stopColor: "var(--board-shadow)" }} />
          </radialGradient>

          <linearGradient id="gradCarrot" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--carrot-light)" }} />
            <stop offset="55%" style={{ stopColor: "var(--carrot-base)" }} />
            <stop offset="100%" style={{ stopColor: "var(--carrot-dark)" }} />
          </linearGradient>

          <radialGradient id="gradCoinOuter" cx="40%" cy="36%" r="72%">
            <stop offset="0%" style={{ stopColor: "var(--carrot-core)" }} />
            <stop offset="45%" style={{ stopColor: "var(--carrot-ring)" }} />
            <stop offset="78%" style={{ stopColor: "var(--carrot-base)" }} />
            <stop offset="100%" style={{ stopColor: "var(--carrot-dark)" }} />
          </radialGradient>

          <linearGradient id="gradGreen" x1="1" y1="0.2" x2="0" y2="0.8">
            <stop offset="0%" style={{ stopColor: "var(--carrot-green-dark)" }} />
            <stop offset="100%" style={{ stopColor: "var(--carrot-green)" }} />
          </linearGradient>

          <linearGradient id="gradBlade" x1="0.1" y1="0" x2="0.9" y2="0.2">
            <stop offset="0%" style={{ stopColor: "var(--knife-blade-light)" }} />
            <stop offset="55%" style={{ stopColor: "var(--knife-blade-mid)" }} />
            <stop offset="100%" style={{ stopColor: "var(--knife-blade-dark)" }} />
          </linearGradient>

          <linearGradient id="gradHandle" x1="0" y1="0" x2="1" y2="0.15">
            <stop offset="0%" style={{ stopColor: "var(--knife-handle-light)" }} />
            <stop offset="100%" style={{ stopColor: "var(--knife-handle)" }} />
          </linearGradient>
        </defs>

        <rect className="board-ambient-shadow" x="52" y="58" width="784" height="404" rx="30" />

        <g id="board">
          <rect className="board-top" x="60" y="50" width="780" height="400" rx="28" />
          <rect className="board-rim" x="60" y="50" width="780" height="400" rx="28" />
          <g className="board-grain">
            <path d="M96,140  Q400,128 500,140 T828,132" />
            <path d="M90,210  Q380,198 560,212 T820,205" />
            <path d="M96,330  Q360,318 560,332 T824,326" />
            <path d="M92,400  Q400,390 540,402 T818,396" />
          </g>
          <rect className="board-top-highlight" x="70" y="60" width="220" height="120" rx="60" />
        </g>

        <g ref={setRef("carrotGroup")} id="carrot">
          <ellipse ref={setRef("carrotShadow")} id="carrot-shadow" />

          <g ref={setRef("carrotGreen")} id="carrot-green">
            <path className="leaf" d="M0,0 C -14,-6 -28,-14 -38,-26 C -24,-16 -10,-7 0,0 Z" transform="rotate(-40)" />
            <path className="leaf" d="M0,0 C -16,-3 -32,-6 -44,-14 C -28,-9 -12,-3 0,0 Z" transform="rotate(-14)" />
            <path className="leaf" d="M0,0 C -16,3 -32,6 -44,14 C -28,9 -12,3 0,0 Z" transform="rotate(14)" />
            <path className="leaf" d="M0,0 C -14,6 -28,14 -38,26 C -24,16 -10,7 0,0 Z" transform="rotate(40)" />
            <path className="leaf-stem" d="M1,-4 L1,4 L9,2 L9,-2 Z" />
          </g>

          <path ref={setRef("carrotBody")} id="carrot-body" />
          <path ref={setRef("carrotHighlight")} id="carrot-highlight" />
        </g>

        <g ref={setRef("fxLayer")} id="fx-layer" />

        <ellipse ref={setRef("knifeShadow")} id="knife-shadow" />

        <g id="knife-pivot">
          <g ref={setRef("knifeSwing")} id="knife-swing">
            <path
              className="blade"
              d="M 0 0
                 C 3 11, 6 22, 6 36
                 C 8 74, 11 104, 15 124
                 L 15 134 L -14 134 L -15 124
                 C -11 104, -8 74, -6 36
                 C -6 22, -3 11, 0 0 Z"
            />
            <path ref={setRef("bladeSpineShine")} className="blade-spine-shine" d="M -10 40 L -13 120" />
            <path ref={setRef("bladeEdgeShine")} className="blade-edge-shine" d="M 8 40 C 10 74, 13 104, 14 122" />

            <rect className="bolster" x="-16" y="134" width="32" height="14" rx="4" />
            <rect className="handle" x="-13" y="148" width="26" height="64" rx="9" />
            <rect className="handle-highlight" x="-9" y="156" width="5" height="52" rx="2.5" />
            <circle className="rivet" cx="0" cy="162" r="2.6" />
            <circle className="rivet" cx="0" cy="178" r="2.6" />
            <circle className="rivet" cx="0" cy="196" r="2.6" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export default function PageLoader({ label = "Loading…", inline = false, fill = false }) {
  if (inline) {
    return (
      <div className="pl-inline" role="status" aria-label={label}>
        <span className="pl-ring" aria-hidden="true" />
        <span className="pl-label">{label}</span>
      </div>
    );
  }

  return (
    <div className={fill ? "pl-page pl-page-fill" : "pl-page"} role="status" aria-label={label}>
      <div className="loader-card">
        <VegetableCutterScene />
        <p className="pl-label">
          {label}
          <span className="pl-dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      </div>
    </div>
  );
}