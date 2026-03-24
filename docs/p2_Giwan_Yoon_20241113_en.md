# Project 02 — Cave Explorer: Audio-Reactive Interactive Shading

| **Title**   | Cave Explorer: Audio-Reactive Interactive Shading    |
| ----------- | ---------------------------------------------------- |
| **Student** | Giwan Yoon                                           |
| **ID**      | 20241113                                             |
| **Course**  | Computer Graphics L2                                 |
| **Tool**    | p5.js (WEBGL), MediaPipe FaceLandmarker, Claude Code |

---

## Target Users

- Audiences interacting with a web-based multimedia art piece
- Users exploring a 3D interactive environment that reacts to audio and physical movement

---

## Concept

Where Project 01 presented the shading history of the Utah Teapot as a static loop, **Cave Explorer** transforms it into a fully interactive experience. The user flies through a procedurally generated 3D cave tunnel; at its center, the Utah Teapot rotates continuously and cycles through shading modes in sync with the beat of the music.

The camera is controlled by real-time eye-position tracking via MediaPipe FaceLandmarker through the webcam, with mouse movement as a fallback. Audio FFT analysis extracts bass, mid, and treble energy each frame, feeding them directly into lighting, travel speed, color hue, and beat detection.

---

## Features

| Feature                        | Description                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audio-Reactive Environment** | FFT analysis extracts bass/mid/treble energy (0–1). Cave travel speed, lighting intensity, and background brightness all respond in real time to the beat                  |
| **Beat-Triggered Shading**     | When bass energy exceeds 0.999, `beat` spikes to 1 and decays exponentially (×0.92/frame). Each spike triggers a shading mode change, limited by a 1967 ms cooldown       |
| **Procedural 3D Cave Walls**   | Four walls built from Perlin-noise-displaced vertices connected by TRIANGLE_STRIPs. Sliding the noise sampling position via `zOff` creates an infinite tunnel with no memory growth |
| **Face/Eye Position Tracking** | MediaPipe FaceLandmarker averages the iris center landmarks (468 & 473) and maps the result to camera target coordinates. Falls back to mouse when no face is detected     |
| **HSB Color Mood Cycle**       | `hueBase = (frameCount × 0.3) % 360` slowly rotates the hue. Background, lighting, teapot, and cave walls all derive their color from the same hue with different offsets |
| **Dynamic Lighting**           | Three-light setup: ambientLight + directionalLight (hueBase) + pointLight (hueBase+60°). Treble energy controls the pointLight brightness                                 |
| **DOM UI Overlay**             | Current shading mode name and historical context are displayed in an HTML element floating above the WebGL canvas. Resets `labelAlpha` to 0 on each mode change and fades in at +15/frame |

---

## Visual Concept

```
        ┌─────────────────────────────────┐
        │  Procedural Cave (4-sided)      │
        │  ─────────────────────────────  │
        │                                 │   ← vertices displaced by Perlin noise
        │         [TEAPOT]                │       shading mode changes on beat
        │     ↺ rotateZ(angle)            │
        │  ─────────────────────────────  │   ← zOff sliding → infinite forward movement
        └─────────────────────────────────┘
              ↕ camera follows eye position

        PHONG SHADING    1975             ← DOM overlay (fade-in)
        Specular highlights — why Newell built this model
```

### Rendering Modes (in cycle order)

| # | Mode | Era | Visual |
|---|------|-----|--------|
| 0 | **WIREFRAME** | 1960s | No lighting — edges rendered with stroke only |
| 1 | **FLAT SHADING** | 1970s | `noLights()` + uniform fill, no interpolation |
| 2 | **PHONG SHADING** | 1975 | `specularMaterial` + `shininess(60)`, specular highlight |
| 3 | **DIFFUSE** | present | `ambientMaterial`, smooth diffuse shading |

---

## Core Logic

### 1. Audio-Reactive Logic

Three stages: FFT analysis → beat detection → exponential decay.

```javascript
// Stage 1: extract per-band energy from FFT (0–1)
fft.analyze();
bassEnergy   = fft.getEnergy("bass")   / 255;
midEnergy    = fft.getEnergy("mid")    / 255;
trebleEnergy = fft.getEnergy("treble") / 255;

// Stage 2: beat detection and exponential decay
if (bassEnergy > 0.999) {
  beat = 1;                   // spike
  if (!beatTriggered) {
    beatTriggered = true;
    // switch shading mode if cooldown (1967 ms) has elapsed
    if (millis() - lastModeChangeTime > MODE_COOLDOWN) {
      changeMode();
    }
  }
} else {
  beat *= 0.92;               // exponential decay (~56 frames to reach ~0)
  beatTriggered = false;
}

// Stage 3: use beat as the t value in lerp calls
ambientLight(lerp(30, 80, beat));                        // light intensity
zOff += lerp(Z_SPEED * 0.5, Z_SPEED * 2, beat);         // travel speed
background(hueBase, 30, lerp(4, 12, beat));              // background brightness
```

`beat *= 0.92` is **exponential decay** — the scene flashes bright on impact and smoothly returns to its resting state. The coefficient 0.92 gives a decay time of roughly 0.9 seconds at 60 fps (56 frames to reach < 0.01).

---

### 2. Cave Wall Generation Logic

#### Mesh Structure

Each wall is a grid of `(rows-1) × cols` quads connected as a TRIANGLE_STRIP.

```
U axis (-1 → +1)
 col0  col1  col2  ...  col24
  ●─────●─────●─────●─────●   ← row i   (di=0)
  │╲    │╲    │╲    │╲    │
  │  ╲  │  ╲  │  ╲  │  ╲  │
  ●─────●─────●─────●─────●   ← row i+1 (di=1)

Repeated rows=50 times along the Z axis to cover full depth
```

Loop order: `i (row) → j (col) → di (0|1)`
TRIANGLE_STRIP vertex order: `(i,j), (i+1,j), (i,j+1), (i+1,j+1) ...`

#### Infinite Tunnel via zOff Sliding

No geometry is stored or re-allocated. Instead, the **Perlin noise sampling position slides forward** each frame.

```javascript
function drawWall(cols, rows, noiseScale, getXY) {
  const segLen    = DEPTH / rows;             // Z length of one segment
  const baseIndex = floor(zOff / segLen);     // which "tile" we are on
  const frac      = (zOff % segLen) / segLen; // fractional offset within the tile (0–1)

  for (let i = 0; i < rows - 1; i++) {
    beginShape(TRIANGLE_STRIP);
    for (let j = 0; j <= cols; j++) {
      const u = map(j, 0, cols, -1, 1);
      for (let di = 0; di <= 1; di++) {
        const ri     = i + di;
        const z      = -(ri - frac) * segLen;           // screen-space Z coordinate
        const nz     = (baseIndex + ri) * segLen * noiseScale; // noise input
        const [x, y] = getXY(u, nz);
        vertex(x, y, z);
      }
    }
    endShape();
  }
}
```

- `nz` incorporates `baseIndex`, so as `zOff` grows the function samples **further ahead** in noise space — new terrain continuously appears at the far end.
- `frac` interpolates between segments so movement is perfectly smooth with no popping.

#### Per-Wall Coordinate Transform (getXY)

Each wall uses a different noise offset so all four surfaces have independent shapes.

```javascript
// Top:    x moves horizontally, y protrudes downward by noise
(u, nz) => [u * hw,  hh - noise(u*2 + 5,  nz) * amp]

// Bottom: x moves horizontally, y protrudes upward by noise
(u, nz) => [u * hw, -hh + noise(u*2 + 10, nz) * amp]

// Left:   y moves vertically, x protrudes rightward by noise
(u, nz) => [-hw + noise(u*2 + 15, nz) * amp, u * hh]

// Right:  y moves vertically, x protrudes leftward by noise
(u, nz) => [ hw - noise(u*2 + 20, nz) * amp, u * hh]
```

Without the offsets (+5, +10, +15, +20) all four walls would share the same noise pattern and appear as a perfectly symmetric tube.

---

## Code Structure

**Multifile Structure:** `index.html`, `style.css`, `face-tracker.js`, `sketch.js`

| Function / File             | Role |
|-----------------------------|------|
| `index.html` & `style.css`  | Onboarding UI overlay and fullscreen layout |
| `face-tracker.js`           | Loads MediaPipe, tracks iris landmarks → writes `window.eyePosition` |
| `preload()`                 | Loads `teapot.obj` and `Need For Speed.mp3` before first frame |
| `setup()`                   | Creates WEBGL canvas, initializes FFT, builds DOM label overlay |
| `draw()`                    | Main loop: FFT analysis → beat decay → background, lighting, teapot, cave, label |
| `drawTeapot()`              | Applies one of four shading configurations based on `renderMode`, then renders the model |
| `drawCave()`                | Sets wall color, then calls `drawWall` with four direction-specific `getXY` functions |
| `drawWall()`                | Builds the TRIANGLE_STRIP mesh; slides `zOff` through noise space for the infinite tunnel |
| `changeMode()`              | Advances `renderMode` cyclically, resets `labelAlpha` to trigger fade-in |
| `drawLabel()`               | Updates DOM overlay text and increments `labelAlpha` for fade-in effect |
| `hsbToRgb()`                | Utility wrapper: converts HSB to RGB via p5's `colorMode` switch |

**Key variables (in `sketch.js`):**

```javascript
const DEPTH   = 3000;       // total Z depth of the cave
const Z_SPEED = 10;         // base travel speed

let zOff = 0;               // cumulative travel offset (noise sampling position)
let beat = 0;               // beat intensity 0–1, exponentially decays (×0.92/frame)
let bassEnergy   = 0;       // FFT bass energy (0–1)
let midEnergy    = 0;       // FFT mid energy (0–1)
let trebleEnergy = 0;       // FFT treble energy (0–1)

let renderMode = 0;         // 0=wireframe  1=flat  2=phong  3=diffuse
let beatTriggered = false;  // prevents multiple mode changes per beat
const MODE_COOLDOWN = 1967; // minimum ms between mode changes (122 BPM × 4 beats)
```

---

## Screenshots
![[Screenshot 2026-03-24 at 10.05.05 AM.png]]
![[Screenshot 2026-03-24 at 10.05.11 AM.png]]
![[Screenshot 2026-03-24 at 10.05.40 AM.png]]
![[Screenshot 2026-03-24 at 10.05.44 AM.png]]
![[Screenshot 2026-03-24 at 10.05.49 AM.png]]