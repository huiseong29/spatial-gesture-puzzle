# Technical Decisions

이 문서는 webcam 기반 실시간 hand tracking interaction puzzle system의 주요 기술 의사결정을 기록한다. 현재 기준 기술 스택은 MediaPipe Hands, React, Canvas다.

## 선택한 기술 스택

```txt
Language: TypeScript
UI Layer: React
Realtime Rendering: HTML Canvas 2D
Hand Tracking: MediaPipe Hands / MediaPipe Hand Landmarker
Camera Input: WebRTC getUserMedia
State Management: React state + refs + reducer-style interaction state
Image Processing: Canvas / OffscreenCanvas
Build Tool: Vite 권장
```

## MediaPipe Hands 선택

### 결정

hand tracking은 MediaPipe Hands 계열을 사용한다. Web 구현에서는 가능하면 `@mediapipe/tasks-vision`의 Hand Landmarker를 우선 검토한다.

### 이유

- 손당 21개 landmark를 제공해 skeleton rendering과 gesture recognition에 바로 사용할 수 있다.
- handedness 정보를 제공해 left/right hand 기반 spatial interaction을 구성하기 쉽다.
- browser 환경에서 webcam stream과 결합하기 좋다.
- pinch, grab, bounding box 같은 custom interaction을 landmark 기반으로 직접 설계할 수 있다.

### 대안 비교

```txt
TensorFlow.js handpose
  장점: JS 생태계와 통합이 쉽다.
  단점: 현재 MediaPipe Tasks 대비 유지보수와 성능 선택지가 제한적일 수 있다.

WebXR Hand Tracking
  장점: 3D hand tracking에 적합하다.
  단점: 일반 webcam 기반 시스템에는 맞지 않고, 지원 기기와 브라우저 제약이 크다.

Custom model
  장점: 도메인 특화 gesture에 최적화 가능하다.
  단점: 데이터셋, 학습, 추론 최적화 비용이 현재 목표에 비해 크다.
```

## React 선택

### 결정

앱 shell, 상태 표시, 설정 UI, reset/capture controls는 React로 구성한다.

### 이유

- camera permission, error, phase, debug summary 같은 UI 상태를 선언적으로 표현하기 좋다.
- puzzle system이 확장될 때 control panel, calibration UI, status panel을 붙이기 쉽다.
- TypeScript와 함께 domain model을 명확히 관리할 수 있다.

### 주의점

React state를 매 frame 갱신하지 않는다. MediaPipe 결과와 Canvas render loop는 `useRef`, external store, 또는 imperative controller에 둔다.

```txt
React state에 둬도 되는 값:
  system phase
  error message
  selected mode
  debug summary sampled at low frequency

React state에 두지 말아야 하는 값:
  every-frame landmarks
  every-frame pointer position
  every-frame canvas draw data
```

## Canvas 2D 선택

### 결정

실시간 skeleton, virtual bounding box, puzzle board, drag feedback은 Canvas 2D로 렌더링한다.

### 이유

- video frame 위에 skeleton과 puzzle tile을 같은 좌표계로 그리기 쉽다.
- 매 frame 업데이트되는 landmark와 drag 위치를 React DOM보다 낮은 비용으로 렌더링할 수 있다.
- snapshot crop, tile split, image drawing을 같은 API로 처리할 수 있다.
- Phase 1부터 Phase 7까지 rendering model을 일관되게 유지할 수 있다.

### 대안 비교

```txt
DOM/SVG
  장점: 디버깅과 개별 element interaction이 쉽다.
  단점: 매 frame 21 keypoint x 2 hands와 puzzle drag를 처리하면 layout/reconciliation 비용이 커질 수 있다.

WebGL/Three.js
  장점: 3D scene, shader, 고성능 그래픽에 적합하다.
  단점: 현재 목표는 2D webcam overlay와 puzzle manipulation이므로 복잡도가 불필요하게 증가한다.

CSS transform 기반 DOM tile
  장점: puzzle tile UI 구현은 쉽다.
  단점: hand skeleton, video coordinate, capture crop과 좌표계를 공유하기 번거롭다.
```

## Realtime Rendering 결정

### 결정

`requestAnimationFrame` 기반 frame loop에서 다음 순서로 처리한다.

```txt
1. video frame readiness 확인
2. MediaPipe detectForVideo 실행
3. raw result를 TrackingFrame으로 변환
4. gesture state update
5. interaction command 생성
6. puzzle state update
7. Canvas render
```

### 이유

- browser refresh cycle에 맞춰 rendering을 수행할 수 있다.
- frame timestamp를 MediaPipe video detection에 전달하기 쉽다.
- tracking, interaction, rendering latency를 한 루프에서 관찰할 수 있다.

### 성능 원칙

- Canvas context와 MediaPipe instance는 매 frame 재생성하지 않는다.
- object allocation을 줄이기 위해 hot path에서는 재사용 가능한 buffer를 검토한다.
- debug overlay는 매 frame 그릴 수 있지만, React debug panel 갱신은 5~10fps로 제한한다.
- heavy image split 작업은 capture 시점에만 수행한다.
- video size와 canvas size가 바뀔 때만 coordinate scale을 재계산한다.

## 좌표계 결정

### 결정

내부 interaction 좌표는 viewer space를 기준으로 한다.

```txt
사용자가 화면에서 오른쪽으로 손을 움직이면 pointer x가 증가한다.
사용자가 화면에서 위로 손을 움직이면 pointer y가 감소한다.
```

### 이유

- gesture-driven interaction에서 사용자가 보는 화면과 조작 방향이 일치해야 한다.
- bounding box, puzzle board, pointer hit test를 같은 coordinate system으로 처리할 수 있다.
- mirror preview와 handedness 보정을 한 곳에서 관리할 수 있다.

### 구현 방침

```ts
type CoordinateConfig = {
  mirrorPreview: boolean;
  mirrorInput: boolean;
  useViewerSpace: boolean;
  swapHandednessWhenNeeded: boolean;
};
```

기본값:

```ts
const coordinateConfig = {
  mirrorPreview: true,
  mirrorInput: true,
  useViewerSpace: true,
  swapHandednessWhenNeeded: false,
};
```

## State Management 결정

### 결정

React app state와 realtime interaction state를 분리한다.

```txt
React State
  낮은 빈도의 UI 상태

Refs / Controllers
  MediaPipe instance, video element, canvas context, latest TrackingFrame

Reducers / Pure Functions
  gesture state, puzzle state, command generation
```

### 이유

- gesture recognition과 puzzle update는 deterministic하게 테스트하기 쉬워야 한다.
- React render cycle이 realtime loop를 막지 않아야 한다.
- Canvas rendering은 imperative 방식이 더 자연스럽다.

### 대안 비교

```txt
모든 상태를 React useState로 관리
  장점: 구조가 단순하다.
  단점: 매 frame 상태 갱신으로 불필요한 rerender가 발생한다.

전역 상태 라이브러리 사용
  장점: 상태 추적과 devtool이 편하다.
  단점: 현재 핵심 문제는 UI state보다 realtime loop 분리이므로 초기 복잡도가 증가한다.

순수 imperative app
  장점: 성능 제어가 쉽다.
  단점: 설정 UI, error UI, session flow 관리가 커질수록 구조가 흐려질 수 있다.
```

## Gesture Recognition 결정

### 결정

초기 gesture는 pinch만 구현한다. pinch는 thumb tip `4`와 index tip `8` 사이 거리를 손 크기로 정규화해 판단한다.

### 이유

- pinch는 capture, grab, drag, drop으로 확장하기 좋은 기본 gesture다.
- 손가락 두 점만으로 계산할 수 있어 빠르고 디버깅하기 쉽다.
- normalized distance를 사용하면 카메라 거리 변화에 더 robust하다.

### 구현 방침

```txt
pinchDistance = distance(thumbTip, indexTip)
handScale = distance(wrist, middleMcp)
normalizedPinch = pinchDistance / handScale
```

```txt
pinch start threshold < pinch release threshold
```

hysteresis와 cooldown을 적용해 false trigger를 줄인다.

## Snapshot and Puzzle 결정

### 결정

snapshot capture와 puzzle tile split은 Canvas 또는 OffscreenCanvas로 처리한다.

### 이유

- video frame crop과 tile crop을 동일한 drawing API로 처리할 수 있다.
- capture 영역이 virtual bounding box와 같은 좌표계를 공유한다.
- 3x3 tile image를 Canvas drawImage로 효율적으로 렌더링할 수 있다.

### 대안 비교

```txt
HTMLImageElement + CSS background-position
  장점: tile layout이 쉽다.
  단점: capture crop과 realtime canvas 좌표계를 맞추기 어렵다.

서버 업로드 후 이미지 처리
  장점: backend에서 정교한 이미지 처리가 가능하다.
  단점: webcam interaction system에는 latency와 privacy 비용이 크다.
```

## 초기 범위에서 제외하는 것

- 복잡한 multi-gesture vocabulary
- 양손 동시 multi-tile manipulation
- 3D hand pose 기반 depth interaction
- 서버 저장 또는 multiplayer
- ML 기반 custom gesture classifier

이 항목들은 core tracking, pinch, puzzle manipulation이 안정화된 뒤 검토한다.

## 결정 요약

```txt
MediaPipe Hands
  21개 landmark와 handedness를 제공하는 core tracking layer

React
  app shell, controls, status, session UI

Canvas 2D
  realtime skeleton, bounding box, puzzle rendering

requestAnimationFrame loop
  tracking, gesture, interaction, rendering을 frame 단위로 연결

viewer-space coordinate
  사용자가 보는 화면과 조작 좌표를 일치

command layer
  gesture state와 puzzle state를 직접 결합하지 않기 위한 완충 계층
```
