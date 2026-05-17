<div align="center">

# Tomato Gesture Puzzle

### 웹캠 기반 손 제스처로 화면 위 가상 영역을 조작하고, 선택한 영역을 실시간 이미지 스냅샷으로 캡처하는 spatial interaction system

<br />

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111111)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-00AEEF?style=for-the-badge)
![Canvas](https://img.shields.io/badge/Canvas-2D-FF6B35?style=for-the-badge)

<br />

**Hand Tracking · Pinch Gesture · Virtual Bounding Box · Realtime Canvas Rendering · Snapshot Crop**

</div>

---

## Overview

**Tomato Gesture Puzzle**은 사용자의 양손을 실시간으로 추적하고, pinch gesture를 통해 화면 위의 가상 bounding box를 직접 조작하는 웹 기반 인터랙션 시스템입니다.

사용자는 마우스나 터치 없이 웹캠 앞에서 손을 움직여 조작 영역을 만들고, 양손 제스처로 영역을 확정한 뒤 현재 카메라 프레임에서 해당 영역만 고해상도로 crop한 snapshot을 생성할 수 있습니다.

> 이 프로젝트는 단순한 화면 효과가 아니라, webcam hand tracking 결과를 gesture state, spatial control, capture pipeline으로 분리해 구성한 실시간 spatial interaction 구조입니다.

---

## Tech Stack

| Category | Stack |
| --- | --- |
| **Frontend** | ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111111) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white) |
| **Computer Vision** | ![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks%20Vision-00AEEF) ![Hand Landmarker](https://img.shields.io/badge/Hand%20Landmarker-21%20Keypoints-222222) |
| **AI / ML** | ![Realtime Inference](https://img.shields.io/badge/Realtime-Inference-0F172A) ![Hand Pose](https://img.shields.io/badge/Hand%20Pose-Tracking-0F172A) |
| **Rendering / Graphics** | ![Canvas](https://img.shields.io/badge/Canvas-2D-FF6B35) ![Overlay](https://img.shields.io/badge/Realtime-Overlay-111827) |
| **Runtime / Environment** | ![Browser](https://img.shields.io/badge/Browser-getUserMedia-4285F4) ![RAF](https://img.shields.io/badge/requestAnimationFrame-Loop-16A34A) |

---

## Implemented Features

### Realtime Hand Skeleton Tracking

- MediaPipe Tasks Vision **Hand Landmarker** 기반 손 추적
- 최대 2개 손의 21개 keypoint 추적
- 손가락 bone connection 기반 skeleton rendering
- handedness와 confidence 표시
- FPS, hand count, gesture state를 포함한 debug overlay

### Pinch Gesture Detection

- `thumb tip(4)`와 `index tip(8)` 거리 기반 pinch 판정
- 손 크기 차이를 보정하는 normalized pinch distance 사용
- `pinch-start`, `pinch-hold`, `pinch-release`, `not-pinching` 상태 관리
- hysteresis threshold와 stable frame 기반 debounce 적용
- 왼손과 오른손의 pinch state를 독립적으로 관리

### Free-form Virtual Bounding Box

- 양손의 pinch point를 rectangle의 대각선 corner로 해석
- 손이 교차되어도 `min/max` normalization으로 안정적인 box 유지
- width와 height를 독립적으로 조절
- raw box와 smoothed box 분리
- min/max size constraint와 canvas boundary clamp 적용
- editing 상태와 확정된 `confirmedRect` 분리

### Snapshot Capture & Crop

- overlay canvas가 아닌 **원본 webcam video frame** 기준 crop
- mirror preview와 실제 video coordinate 차이를 보정
- 현재 확정된 bounding box 영역만 PNG data URL로 snapshot 저장
- capture lock과 cooldown으로 중복 capture 방지
- capture flash effect와 crop debug information 표시

---

## Interaction Flow

| Step | User Action | System Response |
| --- | --- | --- |
| 1 | 카메라 시작 | webcam stream이 canvas에 mirror preview로 표시됨 |
| 2 | 양손을 화면에 표시 | 양손 skeleton과 handedness가 실시간으로 렌더링됨 |
| 3 | 양손 pinch-hold | virtual bounding box editing mode 진입 |
| 4 | pinch point를 벌리거나 좁힘 | 두 pinch point를 대각선 corner로 하는 box가 변형됨 |
| 5 | 양손 pinch-release | 현재 box가 `confirmedRect`로 확정됨 |
| 6 | ready window 안에서 양손 simultaneous pinch-start | 현재 webcam frame에서 confirmed box 영역이 crop됨 |
| 7 | capture 직후 | flash effect, cooldown lock, snapshot metadata 표시 |

---

## System Architecture

```txt
Webcam Stream
  -> HTMLVideoElement
  -> MediaPipe Hand Landmarker
  -> TrackingFrame
  -> PinchDetector
  -> VirtualBoundingBoxTracker
  -> SnapshotCaptureManager
  -> CanvasRenderer
```

핵심 구조는 실시간 inference loop와 React UI state를 분리하는 방식입니다.

```txt
React State
  - camera phase
  - status message

Realtime Controller
  - hand landmarks
  - pinch states
  - virtual bounding box
  - snapshot capture state
  - canvas direct rendering
```

`requestAnimationFrame` 기반 loop에서 MediaPipe 추론, gesture state update, bounding box update, capture trigger evaluation, canvas rendering이 한 프레임 단위로 처리됩니다.

---

## Coordinate & Crop Model

웹캠 preview는 사용자에게 자연스럽게 보이도록 mirror UX를 적용합니다. 하지만 snapshot crop은 overlay가 포함된 canvas가 아니라 원본 video frame에서 수행됩니다.

```txt
Viewer-space Canvas Rect
  -> mirror x-coordinate correction
  -> video resolution scale mapping
  -> source video crop
  -> PNG snapshot data URL
```

이 구조를 통해 skeleton, bounding box, debug text가 snapshot에 섞이지 않고, 원본 webcam resolution 기준의 crop 품질을 유지합니다.

---

## Project Structure

```txt
src/
  app/
    App.tsx
    HandTrackingController.ts
  capture/
    snapshotCaptureManager.ts
    snapshotCropper.ts
    snapshotTypes.ts
  config/
    boundingBoxConfig.ts
    captureConfig.ts
    coordinateConfig.ts
    gestureConfig.ts
    mediapipeConfig.ts
    skeleton.ts
  interaction/
    boundingBox/
      boundingBoxTypes.ts
      virtualBoundingBoxTracker.ts
    gestures/
      pinchDetector.ts
      pinchTypes.ts
  media/
    camera.ts
  rendering/
    canvasRenderer.ts
    captureFlashRenderer.ts
    debugOverlay.ts
    skeletonRenderer.ts
    virtualBoundingBoxRenderer.ts
  tracking/
    handLandmarker.ts
    handNormalizer.ts
    handTypes.ts
    smoothing.ts
```

---

## Run Locally

```bash
npm install
npm run dev
```

브라우저에서 접속합니다.

```txt
http://127.0.0.1:5173
```

카메라 권한을 허용한 뒤 `Start Camera`를 누르면 hand tracking과 gesture interaction이 시작됩니다.

---

## Build

```bash
npm run build
```

---

## Current Snapshot Data

캡처된 이미지는 파일로 저장하지 않고 runtime memory에 유지됩니다.

```ts
TrackingFrame.capture.latestSnapshot
```

Snapshot은 crop된 PNG data URL과 crop metadata를 포함합니다.

```ts
type Snapshot = {
  id: string;
  createdAt: number;
  dataUrl: string;
  width: number;
  height: number;
  cropRectCanvas: Rect;
  cropRectVideo: Rect;
};
```
