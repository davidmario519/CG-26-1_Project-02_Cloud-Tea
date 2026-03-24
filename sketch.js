// ── Audio ──────────────────────────────────────────────────────────────────
let song, fft;
let beat        = 0;
let bassEnergy  = 0, midEnergy = 0, trebleEnergy = 0;
let beatTriggered = false;
let started     = false;

// ── Scene ──────────────────────────────────────────────────────────────────
let teapot;
let zOff = 0;
const DEPTH   = 3000;
const Z_SPEED = 10;

// ── Teapot ─────────────────────────────────────────────────────────────────
let teapotAngle = 0;

// ── Render mode ────────────────────────────────────────────────────────────
let renderMode = 0;
const MODE_COUNT      = 4;
const MODE_COOLDOWN   = 3934; // 122 BPM × 4 beats ≈ 1967 ms
let lastModeChangeTime = 0;

const MODE_NAMES = [
  "WIREFRAME — 1960s",
  "FLAT SHADING — 1970s",
  "PHONG SHADING — 1975",
  "DIFFUSE — present",
];
const MODE_DESCS = [
  "Early vector displays — geometry only",
  "Flat-shaded polygons, no interpolation",
  "Specular highlights — why Newell built this model",
  "Smooth diffuse shading",
];

// ── Label overlay ──────────────────────────────────────────────────────────
let labelContainer, labelTitle, labelDesc;
let labelAlpha = 0;

// ──────────────────────────────────────────────────────────────────────────

function preload() {
  teapot = loadModel("data/teapot.obj", false);
  song   = loadSound("data/Need For Speed.mp3");
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  fft = new p5.FFT(0.8, 512);
  createLabelOverlay();
}

function createLabelOverlay() {
  labelContainer = document.createElement("div");
  Object.assign(labelContainer.style, {
    position:      "absolute",
    left:          "0",
    right:         "0",
    bottom:        "52px",
    textAlign:     "center",
    pointerEvents: "none",
    fontFamily:    "sans-serif",
    opacity:       "0",
  });

  labelTitle = document.createElement("div");
  Object.assign(labelTitle.style, { color: "white", fontSize: "22px", marginBottom: "6px" });

  labelDesc = document.createElement("div");
  Object.assign(labelDesc.style, { color: "#B4B4C8", fontSize: "13px" });

  labelContainer.append(labelTitle, labelDesc);
  document.body.appendChild(labelContainer);
}

// 클릭으로 음악 시작 + 온보딩 닫기
function mousePressed() {
  if (started) return;
  song.loop();
  started = true;
  const overlay = document.getElementById("onboarding");
  if (overlay) {
    overlay.classList.add("hidden");
    setTimeout(() => overlay.remove(), 600);
  }
}

function draw() {
  // ── 오디오 분석 ────────────────────────────────────────────────────────
  fft.analyze();
  bassEnergy   = fft.getEnergy("bass")   / 255;
  midEnergy    = fft.getEnergy("mid")    / 255;
  trebleEnergy = fft.getEnergy("treble") / 255;

  // 비트 감지: bass가 임계값을 넘으면 beat=1, 아니면 감쇠
  if (bassEnergy > 0.999) {
    beat = 1;
    if (!beatTriggered) {
      beatTriggered = true;
      const now = millis();
      if (now - lastModeChangeTime > MODE_COOLDOWN) {
        changeMode();
        lastModeChangeTime = now;
      }
    }
  } else {
    beat *= 0.92;
    beatTriggered = false;
  }

  // ── 배경 ───────────────────────────────────────────────────────────────
  // hueBase: 시간에 따라 천천히 회전하는 색조 (0~360)
  const hueBase = (frameCount * 0.3) % 360;
  colorMode(HSB, 360, 100, 100);
  background(hueBase, 30, lerp(4, 12, beat));
  colorMode(RGB, 255);

  // ── 카메라 ─────────────────────────────────────────────────────────────
  let mx, my;
  if (typeof eyePosition !== "undefined" && eyePosition.ready) {
    mx = eyePosition.x;
    my = eyePosition.y;
  } else {
    mx = map(mouseX, 0, width, -1.0, 1.0);
    my = map(mouseY, 0, height, -1.5, 1.5);
  }
  camera(mx * width, my * height, 0, 0, 0, -DEPTH / 2, 0, 1, 0);

  // ── 조명 ───────────────────────────────────────────────────────────────
  ambientLight(lerp(30, 80, beat));

  const dirCol = hsbToRgb(hueBase, lerp(40, 80, beat), lerp(70, 100, beat));
  directionalLight(dirCol[0], dirCol[1], dirCol[2], 0, 0, -1);

  const ptCol = hsbToRgb((hueBase + 60) % 360, 50, lerp(60, 100, trebleEnergy));
  pointLight(ptCol[0], ptCol[1], ptCol[2], 0, 0, -DEPTH * 0.3);

  // ── 티팟 ───────────────────────────────────────────────────────────────
  teapotAngle += 0.02;
  drawTeapot(hueBase);

  // ── 동굴 벽면 ──────────────────────────────────────────────────────────
  zOff += lerp(Z_SPEED * 0.5, Z_SPEED * 2, beat);
  push();
  drawCave(hueBase);
  pop();

  // ── 레이블 오버레이 ────────────────────────────────────────────────────
  drawLabel();
}

// 티팟 렌더링 (renderMode에 따라 셰이딩 전환)
function drawTeapot(hueBase) {
  const tpCol = hsbToRgb(
    (hueBase + 180) % 360,
    lerp(30, 60, midEnergy),
    lerp(70, 100, beat)
  );

  push();
  translate(0, 50, -DEPTH / 2);
  scale(13);
  rotateX(HALF_PI);
  rotateZ(teapotAngle);

  switch (renderMode) {
    case 0: // WIREFRAME
      noFill();
      stroke(tpCol[0], tpCol[1], tpCol[2]);
      strokeWeight(0.3);
      break;
    case 1: // FLAT — 균일 색, 조명 제거
      noLights();
      fill(tpCol[0], tpCol[1], tpCol[2]);
      noStroke();
      break;
    case 2: // PHONG — specular highlight
      noStroke();
      specularMaterial(tpCol[0], tpCol[1], tpCol[2]);
      shininess(60);
      break;
    case 3: // MATTE diffuse
      noStroke();
      ambientMaterial(tpCol[0], tpCol[1], tpCol[2]);
      break;
  }

  model(teapot);
  pop();
}

// 4면 동굴 벽 생성
function drawCave(hueBase) {
  const cols = 48, rows = 100;
  const noiseScale = 0.002, amp = 300;
  const hw = width / 2, hh = height / 2;

  noStroke();
  const wCol = hsbToRgb((hueBase + 30) % 360, lerp(20, 50, beat), lerp(30, 55, beat));
  ambientMaterial(wCol[0], wCol[1], wCol[2]);

  // 위
  drawWall(cols, rows, noiseScale, (u, nz) => [u * hw,  hh - noise(u * 2 + 5,  nz) * amp]);
  // 아래
  drawWall(cols, rows, noiseScale, (u, nz) => [u * hw, -hh + noise(u * 2 + 10, nz) * amp]);
  // 왼쪽
  drawWall(cols, rows, noiseScale, (u, nz) => [-hw + noise(u * 2 + 15, nz) * amp, u * hh]);
  // 오른쪽
  drawWall(cols, rows, noiseScale, (u, nz) => [ hw - noise(u * 2 + 20, nz) * amp, u * hh]);
}

function drawWall(cols, rows, noiseScale, getXY) {
  const segLen    = DEPTH / rows;
  const baseIndex = floor(zOff / segLen);
  const frac      = (zOff % segLen) / segLen;

  for (let i = 0; i < rows - 1; i++) {
    beginShape(TRIANGLE_STRIP);
    for (let j = 0; j <= cols; j++) {
      const u = map(j, 0, cols, -1, 1);
      for (let di = 0; di <= 1; di++) {
        const ri       = i + di;
        const z        = -(ri - frac) * segLen;
        const nz       = (baseIndex + ri) * segLen * noiseScale;
        const [x, y]   = getXY(u, nz);
        vertex(x, y, z);
      }
    }
    endShape();
  }
}

// 렌더 모드 순환 (비트마다 1회)
function changeMode() {
  renderMode = (renderMode + 1) % MODE_COUNT;
  labelAlpha = 0; // 레이블 페이드인 재시작
}

// 모드 레이블 오버레이 (DOM)
function drawLabel() {
  if (labelAlpha < 255) labelAlpha = min(255, labelAlpha + 15);
  if (!labelContainer) return;

  labelContainer.style.opacity = (labelAlpha / 255).toString();
  labelTitle.innerText = MODE_NAMES[renderMode];
  labelDesc.innerText  = MODE_DESCS[renderMode];
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('screenshot', 'png');
  }
}

// HSB(360,100,100) → RGB(255,255,255) 변환
function hsbToRgb(h, s, b) {
  colorMode(HSB, 360, 100, 100);
  const c = color(h, s, b);
  colorMode(RGB, 255);
  return [red(c), green(c), blue(c)];
}
