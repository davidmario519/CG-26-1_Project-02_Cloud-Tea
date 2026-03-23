let teapot;
let width, height;

function preload() {
  teapot = loadModel("data/teapot.obj", false);
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
   
  width = windowWidth;
  height = windowHeight;
  depth = 3000;
}

function draw() {
  background(200);

  // 눈 추적이 준비되면 eyePosition 사용, 아니면 마우스로 폴백
  let mx, my;
  if (typeof eyePosition !== "undefined" && eyePosition.ready) {
    mx = eyePosition.x;
    my = eyePosition.y;
  } else {
    mx = map(mouseX, 0, width, -2, 2);
    my = map(mouseY, 0, height, -2, 2);
  }

  // 카메라 위치를 눈/마우스 위치에 따라 이동, 시선은 박스 중앙으로 고정
  let camX = mx * width * 1;
  let camY = my * height * 1;
  camera(camX, camY, 0, 0, 0, -depth / 2, 0, 1, 0);

  lights();

  push();
  translate(0, 0, -depth / 2);
  noFill();
  stroke(30);
  box(width, height, depth);
  pop();

  push();
  translate(0, 0, -depth/2)
  scale(10);
  rotateX(HALF_PI);
  model(teapot);
  pop();

}