import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import "../assets/Style/style.css";

/* ---------- background dots (three.js) ---------- */
const DOT_COUNT = 420; // number of dots
const DOT_MIN = 3; // smallest dot (px)
const DOT_MAX = 10; // biggest dot (px)
const DOT_SPEED = 0.5; // drift speed (higher = dots move faster)
const MOUSE_PARALLAX = 0.8; // how much the dots shift with the mouse (0 = off)
const CAM_Z = 10; // camera distance
const DEPTH = 6; // how deep the dot cloud is (front/back)
const DOT_COLORS = ["#ffffff", "#ffffff", "#ffffff", "#22d3ee", "#8b5cf6", "#ff4fa3"];

/* ---------- flower scene (svg units, viewBox 0 0 800 580) ---------- */
const CX = 400; // centre of the bouquet
const BASE_Y = 552; // ground line where leaves start
const STEM_Y = 545; // point where all coloured stems meet

// timeline (seconds) - change these to speed things up / slow things down
const T_LEAF = 0.3; // leaves start
const T_STEM = 4.3; // stems start
const T_BERRY = 5.0; // berry clusters start
const T_FLOWER = 7.4; // first flower starts blooming
const T_GLOW = 14.0; // first flower starts glowing
const FLOWER_GAP = 1.0; // gap between flowers blooming
const GLOW_GAP = 0.8; // gap between flowers glowing / un-glowing

// leaves on the left side (right side is mirrored)
const LEFT_LEAVES = [
  { bx: 262, tx: 158, ty: 62, w: 9 },
  { bx: 252, tx: 192, ty: 96, w: 8 },
  { bx: 244, tx: 172, ty: 172, w: 8 },
  { bx: 232, tx: 150, ty: 278, w: 9 },
  { bx: 222, tx: 140, ty: 372, w: 8 },
  { bx: 272, tx: 214, ty: 238, w: 7 },
  { bx: 285, tx: 232, ty: 330, w: 6 },
  { bx: 300, tx: 252, ty: 400, w: 6 },
  { bx: 345, tx: 290, ty: 488, w: 5 },
  { bx: 352, tx: 306, ty: 480, w: 5 },
  { bx: 358, tx: 324, ty: 490, w: 4 },
];

const mirrorLeaf = (l) => ({ bx: 800 - l.bx, tx: 800 - l.tx, ty: l.ty, w: l.w });

const leafPath = ({ bx, tx, ty, w }) => {
  const cy = BASE_Y - (BASE_Y - ty) * 0.55;
  const cx = bx + (tx - bx) * 0.12;
  return `M ${bx - w} ${BASE_Y} Q ${cx - w * 1.1} ${cy} ${tx} ${ty} Q ${cx + w * 1.1} ${cy} ${bx + w} ${BASE_Y} Z`;
};

// the 5 coloured stems + the flower on top of each one (left -> right)
const STEMS = [
  { tip: [232, 268], ctrl: [318, 440], color: "#8b5cf6", tilt: -28, scale: 0.92 },
  { tip: [312, 192], ctrl: [378, 430], color: "#7c5cff", tilt: -14, scale: 0.96 },
  { tip: [400, 100], ctrl: [400, 330], color: "#38d6ff", tilt: 0, scale: 1.05, center: true },
  { tip: [488, 192], ctrl: [422, 430], color: "#ff3d7f", tilt: 14, scale: 0.96 },
  { tip: [568, 268], ctrl: [482, 440], color: "#ff3d7f", tilt: 28, scale: 0.92 },
];

// flower shape (petals point "up", then get rotated)
const WIDE_ANGLES = [-150, -105, -62, 62, 105, 150, 180];
const NARROW_ANGLES = [-34, -12, 12, 34];
const WIDE_D = "M0 0 C -24 -16 -24 -50 0 -64 C 24 -50 24 -16 0 0 Z";
const NARROW_D = "M0 0 C -9 -20 -9 -46 0 -60 C 9 -46 9 -20 0 0 Z";
const STAMEN_ANGLES = [-30, -15, 0, 15, 30];
const STAMEN_LEN = [38, 48, 56, 48, 38];

const sd = (v) => ({ "--d": `${v}s` });

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- one flower ---------- */
function Flower({ cx, cy, tilt, scale, start, glowStart }) {
  return (
    <g
      className="fl-flower"
      transform={`translate(${cx} ${cy}) rotate(${tilt}) scale(${scale})`}
      style={{ "--g": `${glowStart}s` }}
    >
      {/* soft glow behind the flower */}
      <circle className="fl-glow" cx="0" cy="-30" r="80" fill="url(#flGlowGrad)" style={{ "--g": `${glowStart}s` }} />

      {/* wide petals */}
      {WIDE_ANGLES.map((a, k) => (
        <g key={`w${a}`} transform={`rotate(${a})`}>
          <path className="fl-petal" d={WIDE_D} style={sd(start + k * 0.09)} />
          <path className="fl-lit" d={WIDE_D} style={{ "--g": `${glowStart}s` }} />
        </g>
      ))}

      {/* narrow upper petals */}
      {NARROW_ANGLES.map((a, k) => (
        <g key={`n${a}`} transform={`rotate(${a})`}>
          <path className="fl-petal" d={NARROW_D} style={sd(start + 0.55 + k * 0.08)} />
          <path className="fl-lit" d={NARROW_D} style={{ "--g": `${glowStart}s` }} />
        </g>
      ))}

      {/* centre buds */}
      {STAMEN_ANGLES.map((a, k) => (
        <g key={`s${a}`} transform={`rotate(${a})`}>
          <g className="fl-stamen" style={sd(start + 0.95 + k * 0.12)}>
            <line x1="0" y1="-6" x2="0" y2={-STAMEN_LEN[k]} />
            <ellipse className="fl-bud" cx="0" cy={-STAMEN_LEN[k] - 6} rx="5" ry="11" />
            <circle className="fl-bud-dot" cx="0" cy={-STAMEN_LEN[k] - 4} r="2.4" />
          </g>
        </g>
      ))}

      <circle className="fl-core" cx="0" cy="0" r="4" style={sd(start + 0.3)} />
    </g>
  );
}

function Proj() {
  const bgRef = useRef(null);
  const mouse = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [run, setRun] = useState(0); // click anywhere -> replay the whole animation

  /* ---------- three.js : floating dots in the background ---------- */
  useEffect(() => {
    const host = bgRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (err) {
      return undefined; // no WebGL: the black background still works without dots
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.z = CAM_Z;

    const positions = new Float32Array(DOT_COUNT * 3);
    const speeds = new Float32Array(DOT_COUNT * 3);
    const sizes = new Float32Array(DOT_COUNT);
    const phases = new Float32Array(DOT_COUNT);
    const colors = new Float32Array(DOT_COUNT * 3);
    const bounds = { x: 20, y: 10 };
    const tmp = new THREE.Color();

    for (let i = 0; i < DOT_COUNT; i += 1) {
      speeds[i * 3] = (Math.random() - 0.5) * DOT_SPEED * 2;
      speeds[i * 3 + 1] = (Math.random() - 0.5) * DOT_SPEED * 2;
      speeds[i * 3 + 2] = (Math.random() - 0.5) * DOT_SPEED * 0.4;
      sizes[i] = DOT_MIN + Math.random() * (DOT_MAX - DOT_MIN);
      phases[i] = Math.random() * Math.PI * 2;
      tmp.set(DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)]);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aColor;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (${CAM_Z.toFixed(1)} / -mv.z);
          vAlpha = 0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 1.2 + aPhase));
          vColor = aColor;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float core = smoothstep(0.5, 0.1, d);
          if (core <= 0.0) discard;
          gl_FragColor = vec4(vColor, core * vAlpha);
        }
      `,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    const scatter = () => {
      for (let i = 0; i < DOT_COUNT; i += 1) {
        positions[i * 3] = (Math.random() * 2 - 1) * bounds.x;
        positions[i * 3 + 1] = (Math.random() * 2 - 1) * bounds.y;
        positions[i * 3 + 2] = (Math.random() * 2 - 1) * DEPTH;
      }
      geometry.attributes.position.needsUpdate = true;
    };

    const resize = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * CAM_Z;
      bounds.x = halfH * camera.aspect * 1.6;
      bounds.y = halfH * 1.6;
    };

    const onMove = (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };

    resize();
    scatter();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);

    const clock = new THREE.Clock();
    let raf = 0;
    const target = { x: 0, y: 0 };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      material.uniforms.uTime.value += dt;

      if (!reduceMotion) {
        for (let i = 0; i < DOT_COUNT; i += 1) {
          const ix = i * 3;
          positions[ix] += speeds[ix] * dt;
          positions[ix + 1] += speeds[ix + 1] * dt;
          positions[ix + 2] += speeds[ix + 2] * dt;

          if (positions[ix] > bounds.x) positions[ix] = -bounds.x;
          else if (positions[ix] < -bounds.x) positions[ix] = bounds.x;
          if (positions[ix + 1] > bounds.y) positions[ix + 1] = -bounds.y;
          else if (positions[ix + 1] < -bounds.y) positions[ix + 1] = bounds.y;
          if (positions[ix + 2] > DEPTH) positions[ix + 2] = -DEPTH;
          else if (positions[ix + 2] < -DEPTH) positions[ix + 2] = DEPTH;
        }
        geometry.attributes.position.needsUpdate = true;
      }

      const nx = (mouse.current.x / window.innerWidth - 0.5) * 2;
      const ny = (mouse.current.y / window.innerHeight - 0.5) * 2;
      target.x = -nx * MOUSE_PARALLAX;
      target.y = ny * MOUSE_PARALLAX;
      points.position.x += (target.x - points.position.x) * 0.05;
      points.position.y += (target.y - points.position.y) * 0.05;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  /* ---------- berry clusters (same every render) ---------- */
  const berries = useMemo(() => {
    const rnd = mulberry32(7);
    const out = [];
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 18; i += 1) {
        const t = rnd();
        out.push({
          key: `${side}-${i}`,
          x: CX + side * (40 + t * 130 + (rnd() - 0.5) * 16),
          y: 530 - t * 95 + (rnd() - 0.5) * 26,
          rx: 6 + rnd() * 3,
          ry: 9 + rnd() * 3,
          rot: rnd() * 180,
          color: side < 0 ? "#22d3ee" : "#ff5fa8",
          delay: T_BERRY + (side < 0 ? 0 : 0.5) + i * 0.07,
        });
      }
    });
    return out;
  }, []);

  /* ---------- leaves: left + right appear together, one pair at a time ---------- */
  const leaves = [];
  LEFT_LEAVES.forEach((l, i) => {
    leaves.push({ ...l, key: `l${i}`, delay: T_LEAF + i * 0.28 });
    leaves.push({ ...mirrorLeaf(l), key: `r${i}`, delay: T_LEAF + i * 0.28 + 0.12 });
  });

  return (
    <>
      {/* 1. black background (three.js adds the dots canvas in here) */}
      <div
        className="ch-bg"
        ref={bgRef}
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden", zIndex: 0 }}
      />

      {/* 2. flower scene - click anywhere to replay */}
      <div className="fl-root" onClick={() => setRun((r) => r + 1)}>
        <svg
          key={run}
          className="fl-svg"
          viewBox="0 0 800 580"
          role="img"
          aria-label="Neon flowers growing out of green grass. Click to replay."
        >
          <defs>
            <linearGradient id="flLeafGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#1f8f3d" />
              <stop offset="0.45" stopColor="#62d86f" />
              <stop offset="1" stopColor="#26a64a" />
            </linearGradient>
            <linearGradient id="flPetalGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#b266ff" />
              <stop offset="0.55" stopColor="#6d7bff" />
              <stop offset="1" stopColor="#3fe4ff" />
            </linearGradient>
            <linearGradient id="flPetalLit" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="1" stopColor="#aef4ff" stopOpacity="0.4" />
            </linearGradient>
            <radialGradient id="flGlowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#46d2ff" stopOpacity="0.75" />
              <stop offset="0.6" stopColor="#2fa8ff" stopOpacity="0.3" />
              <stop offset="1" stopColor="#2fa8ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient
              id="flStemCenter"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="100"
              x2="0"
              y2={STEM_Y}
            >
              <stop offset="0" stopColor="#38d6ff" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          {/* green leaves */}
          {leaves.map((l) => (
            <path
              key={l.key}
              className="fl-leaf"
              d={leafPath(l)}
              fill="url(#flLeafGrad)"
              style={{ ...sd(l.delay), transformOrigin: `${l.bx}px ${BASE_Y}px` }}
            />
          ))}

          {/* berry clusters */}
          {berries.map((b) => (
            <g key={b.key} transform={`rotate(${b.rot} ${b.x} ${b.y})`}>
              <ellipse
                className="fl-berry"
                cx={b.x}
                cy={b.y}
                rx={b.rx}
                ry={b.ry}
                style={{ ...sd(b.delay), "--c": b.color }}
              />
            </g>
          ))}

          {/* coloured stems */}
          {STEMS.map((s, i) => (
            <path
              key={`stem${i}`}
              className="fl-stem"
              pathLength="1"
              d={`M ${CX} ${STEM_Y} Q ${s.ctrl[0]} ${s.ctrl[1]} ${s.tip[0]} ${s.tip[1]}`}
              stroke={s.center ? "url(#flStemCenter)" : s.color}
              strokeWidth="5"
              style={{ ...sd(T_STEM + i * 0.6), "--c": s.color }}
            />
          ))}

          {/* flowers (left -> right) */}
          {STEMS.map((s, i) => (
            <Flower
              key={`flower${i}`}
              cx={s.tip[0]}
              cy={s.tip[1]}
              tilt={s.tilt}
              scale={s.scale}
              start={T_FLOWER + i * FLOWER_GAP}
              glowStart={T_GLOW + i * GLOW_GAP}
            />
          ))}
        </svg>

        <p className="fl-hint">Click anywhere to replay</p>
      </div>
    </>
  );
}

export default Proj;