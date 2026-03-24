# Project 02 — Cave Explorer: Audio-Reactive Interactive Shading

| **Title**   | Cave Explorer: Audio-Reactive Interactive Shading  |
| ----------- | -------------------------------------------------- |
| **Student** | Giwan Yoon                                         |
| **ID**      | 20241113                                           |
| **Course**  | Computer Graphics L2                               |
| **Tool**    | p5.js (WEBGL), MediaPipe FaceLandmarker, Claude Code |

---

## Target Users

- 웹 기반 멀티미디어 아트 피스를 감상하는 관람객
- 오디오와 신체 움직임에 반응하는 3D 인터랙티브 환경을 탐험하는 사용자

---

## Concept

Project 01에서 Utah Teapot의 셰이딩 역사를 정적으로 전시했다면, **Cave Explorer**는 그것을 완전한 인터랙티브 경험으로 확장한다. 사용자는 절차적으로 생성된 3D 동굴 터널을 통과하며, 중앙에는 Utah Teapot이 음악의 비트에 맞춰 셰이딩 모드를 전환한다.

카메라는 웹캠을 통해 MediaPipe FaceLandmarker로 사용자의 눈 위치를 실시간 추적하여 제어된다. 마우스는 폴백(fallback)으로 동작한다. 오디오 FFT 분석을 통해 bass/mid/treble 에너지가 조명, 이동 속도, 색조, 비트 감지에 직접 연결된다.

---

## Features

| Feature                        | Description                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audio-Reactive Environment** | FFT 분석으로 bass/mid/treble 에너지를 0~1로 추출. 동굴 이동 속도·조명 강도·배경 밝기가 비트에 실시간 반응                                                         |
| **Beat-Triggered Shading**     | bass 에너지가 임계값(0.999)을 초과할 때 beat=1로 스파이크, 이후 매 프레임 ×0.92 지수 감쇠. 1마디(1967ms, 122BPM) 쿨다운으로 셰이딩 모드 순환                     |
| **Procedural 3D Cave Walls**   | Perlin noise로 정점을 변위시킨 4면 벽을 TRIANGLE_STRIP으로 구성. `zOff`를 noise 샘플링 위치로 슬라이딩하여 메모리 증가 없이 무한 터널 생성                         |
| **Face/Eye Position Tracking** | MediaPipe FaceLandmarker로 홍채 중심(랜드마크 468·473)의 평균 좌표를 카메라 목표로 사용. 웹캠 부재 시 마우스로 자동 전환                                           |
| **HSB Color Mood Cycle**       | `hueBase = (frameCount × 0.3) % 360`으로 hue가 천천히 순환. 배경·조명·티팟·동굴 벽 색상 모두 동일한 hue 기준으로 오프셋 적용, 장면 전체가 통일된 색조를 유지      |
| **Dynamic Lighting**           | ambientLight + directionalLight(hueBase) + pointLight(hueBase+60°)의 3종 조합. treble 에너지가 pointLight 밝기에 연결                                              |
| **DOM UI Overlay**             | 현재 셰이딩 모드명과 역사적 맥락을 WebGL 캔버스 위 DOM 요소로 표시. 모드 전환 시 `labelAlpha=0` 리셋 후 매 프레임 +15씩 페이드인                                  |

---

## Visual Concept

```
        ┌─────────────────────────────────┐
        │  Procedural Cave (4-sided)      │
        │  ─────────────────────────────  │
        │                                 │   ← Perlin noise로 정점 변위
        │         [TEAPOT]                │       beat마다 셰이딩 전환
        │     ↺ rotateZ(angle)            │
        │  ─────────────────────────────  │   ← zOff 슬라이딩 → 무한 전진
        └─────────────────────────────────┘
              ↕ 카메라 = 눈 위치 추적

        PHONG SHADING    1975             ← DOM 오버레이 (fade-in)
        Specular highlights — why Newell built this model
```

### Rendering Modes (in cycle order)

| # | Mode | Era | Visual |
|---|------|-----|--------|
| 0 | **WIREFRAME** | 1960s | 조명 없음, stroke만으로 엣지 표현 |
| 1 | **FLAT SHADING** | 1970s | `noLights()` + 균일 fill, 보간 없음 |
| 2 | **PHONG SHADING** | 1975 | `specularMaterial` + `shininess(60)`, 하이라이트 |
| 3 | **DIFFUSE** | present | `ambientMaterial`, 부드러운 난반사 |

---

## 핵심 로직 상세

### 1. 오디오 반응 로직

FFT 분석 → beat 감지 → 지수 감쇠의 3단계로 동작한다.

```javascript
// 1단계: FFT로 주파수 대역별 에너지 추출 (0~1)
fft.analyze();
bassEnergy   = fft.getEnergy("bass")   / 255;
midEnergy    = fft.getEnergy("mid")    / 255;
trebleEnergy = fft.getEnergy("treble") / 255;

// 2단계: beat 감지 및 지수 감쇠
if (bassEnergy > 0.999) {
  beat = 1;                   // 스파이크
  if (!beatTriggered) {
    beatTriggered = true;
    // 쿨다운(1967ms) 초과 시 셰이딩 모드 전환
    if (millis() - lastModeChangeTime > MODE_COOLDOWN) {
      changeMode();
    }
  }
} else {
  beat *= 0.92;               // 지수 감쇠 (~56프레임 후 0)
  beatTriggered = false;
}

// 3단계: beat 값을 lerp의 t로 활용
ambientLight(lerp(30, 80, beat));       // 조명 강도
zOff += lerp(Z_SPEED * 0.5, Z_SPEED * 2, beat); // 이동 속도
background(hueBase, 30, lerp(4, 12, beat));      // 배경 밝기
```

`beat *= 0.92`는 **지수 감쇠(exponential decay)**로, 비트 직후 화면이 확 바뀌었다가 자연스럽게 원래 상태로 돌아오는 여운 효과를 만든다. 계수 0.92는 약 0.9초(60fps 기준 56프레임)의 감쇠 시간을 의미한다.

---

### 2. 동굴 벽면 생성 로직

#### 메시 구조

각 벽은 `(rows-1) × cols`개의 쿼드를 TRIANGLE_STRIP으로 구성한다.

```
U축 (-1 ~ +1)
 col0  col1  col2  ...  col24
  ●─────●─────●─────●─────●   ← row i   (di=0)
  │╲    │╲    │╲    │╲    │
  │  ╲  │  ╲  │  ╲  │  ╲  │
  ●─────●─────●─────●─────●   ← row i+1 (di=1)

Z축 방향으로 rows=50개 반복 → depth 전체를 덮음
```

루프 순서: `i(row) → j(col) → di(0|1)`
TRIANGLE_STRIP 버텍스 순서: `(i,j), (i+1,j), (i,j+1), (i+1,j+1) ...`

#### 무한 터널 (zOff 슬라이딩)

실제로 지형을 생성·저장하지 않는다. 대신 Perlin noise의 **샘플링 위치를 앞으로 이동**시킨다.

```javascript
function drawWall(cols, rows, noiseScale, getXY) {
  const segLen    = DEPTH / rows;           // 세그먼트 하나의 Z 길이
  const baseIndex = floor(zOff / segLen);   // 현재 "몇 번째 타일"인지
  const frac      = (zOff % segLen) / segLen; // 타일 내 소수점 위치 (0~1)

  for (let i = 0; i < rows - 1; i++) {
    beginShape(TRIANGLE_STRIP);
    for (let j = 0; j <= cols; j++) {
      const u = map(j, 0, cols, -1, 1);
      for (let di = 0; di <= 1; di++) {
        const ri     = i + di;
        const z      = -(ri - frac) * segLen;          // 화면상 Z 좌표
        const nz     = (baseIndex + ri) * segLen * noiseScale; // noise 입력
        const [x, y] = getXY(u, nz);
        vertex(x, y, z);
      }
    }
    endShape();
  }
}
```

- `nz`가 `baseIndex`를 포함하므로, `zOff`가 증가할수록 **더 앞쪽의 noise 값**을 샘플링한다.
- `frac`는 세그먼트 간 보간을 담당해 움직임이 끊기지 않고 부드럽다.

#### 4면의 좌표 변환 (getXY)

4면이 서로 다른 noise 패턴을 갖도록 noise 입력에 오프셋을 추가한다.

```javascript
// 위 벽:    x는 가로 이동, y는 noise로 아래로 돌출
(u, nz) => [u * hw,  hh - noise(u*2 + 5,  nz) * amp]

// 아래 벽:  x는 가로 이동, y는 noise로 위로 돌출
(u, nz) => [u * hw, -hh + noise(u*2 + 10, nz) * amp]

// 왼쪽 벽:  y는 세로 이동, x는 noise로 오른쪽으로 돌출
(u, nz) => [-hw + noise(u*2 + 15, nz) * amp, u * hh]

// 오른쪽 벽: y는 세로 이동, x는 noise로 왼쪽으로 돌출
(u, nz) => [ hw - noise(u*2 + 20, nz) * amp, u * hh]
```

오프셋(+5, +10, +15, +20)이 없으면 4면이 동일한 noise 패턴으로 대칭이 된다.

---

## Code Structure

**Multifile Structure:** `index.html`, `style.css`, `face-tracker.js`, `sketch.js`

| Function / File    | Role |
|--------------------|------|
| `index.html` & `style.css` | 온보딩 UI 오버레이 + 풀스크린 레이아웃 |
| `face-tracker.js`  | MediaPipe 로드 → 홍채 좌표 → `window.eyePosition` 갱신 |
| `preload()`        | `teapot.obj`, `Need For Speed.mp3` 사전 로드 |
| `setup()`          | WEBGL 캔버스 생성, FFT 초기화, DOM 레이블 오버레이 생성 |
| `draw()`           | 매 프레임: FFT 분석 → beat 감쇠 → 배경·조명·티팟·동굴·레이블 렌더 |
| `drawTeapot()`     | renderMode에 따라 4가지 셰이딩 중 하나 적용 후 모델 렌더 |
| `drawCave()`       | 4면 벽 색상 설정 후 각 방향별 getXY 함수를 `drawWall`에 전달 |
| `drawWall()`       | TRIANGLE_STRIP으로 벽 메시 구성, zOff 슬라이딩으로 무한 터널 구현 |
| `changeMode()`     | renderMode 순환, labelAlpha 리셋 |
| `drawLabel()`      | DOM 오버레이 텍스트 갱신 + labelAlpha 페이드인 |
| `hsbToRgb()`       | HSB → RGB 변환 유틸 (colorMode 전환 래퍼) |

**Key variables (in `sketch.js`):**

```javascript
const DEPTH   = 3000;       // 동굴 전체 Z 깊이
const Z_SPEED = 10;         // 기본 이동 속도

let zOff = 0;               // 동굴 이동 누적값 (noise 샘플링 위치)
let beat = 0;               // 비트 강도 0~1, 지수 감쇠 (× 0.92/frame)
let bassEnergy  = 0;        // FFT bass 에너지 (0~1)
let midEnergy   = 0;        // FFT mid 에너지 (0~1)
let trebleEnergy = 0;       // FFT treble 에너지 (0~1)

let renderMode = 0;         // 0=wireframe, 1=flat, 2=phong, 3=diffuse
let beatTriggered = false;  // 비트당 1회 모드 전환 제한
const MODE_COOLDOWN = 1967; // 최소 전환 간격 ms (122BPM × 4beats)
```

---

## Screenshots

![[cave_wireframe.png]]
![[cave_flat.png]]
![[cave_phong.png]]
![[cave_diffuse.png]]
