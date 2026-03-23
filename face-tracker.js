import { FaceLandmarker, FilesetResolver }
  from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

// sketch.js에서 window.eyePosition으로 접근
window.eyePosition = { x: 0, y: 0, ready: false };

(async function initFaceTracker() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  const faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
  });

  const video = document.createElement("video");
  video.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;";
  document.body.appendChild(video);

  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();

  function detect() {
    if (video.readyState >= 2) {
      const results = faceLandmarker.detectForVideo(video, performance.now());

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const lm = results.faceLandmarks[0];

        // 468: 왼쪽 홍채 중심, 473: 오른쪽 홍채 중심
        const left  = lm[468];
        const right = lm[473];

        if (left && right) {
          const cx = (left.x + right.x) / 2; // 0~1
          const cy = (left.y + right.y) / 2; // 0~1

          // 웹캠은 좌우 반전이므로 x flip
          window.eyePosition.x = -(cx * 2 - 1);
          window.eyePosition.y =   cy * 2 - 1;
          window.eyePosition.ready = true;
        }
      } else {
        window.eyePosition.ready = false;
      }
    }

    requestAnimationFrame(detect);
  }

  detect();
  console.log("Face tracker 초기화 완료");
})().catch((err) => {
  console.warn("Face tracker 초기화 실패:", err);
});
