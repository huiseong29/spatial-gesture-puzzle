# Gesture-Driven Spatial Interaction System Roadmap

이 문서는 웹캠 기반 실시간 손 제스처 인터랙션 시스템을 단계적으로 구현하기 위한 작업 가이드라인이다. 목표는 단순 퍼즐 게임이 아니라, MediaPipe Hands 기반의 gesture-driven spatial interaction system을 안정적으로 설계하고 확장하는 것이다.

## 최종 목표

1. 사용자의 양손 skeleton을 실시간으로 화면에 렌더링한다.
2. 양손 위치를 기반으로 virtual bounding box를 생성한다.
3. 양손 거리 변화로 bounding box 크기를 조절한다.
4. 특정 gesture, 우선 pinch를 인식하면 snapshot을 capture한다.
5. 캡처된 이미지를 3x3 퍼즐 조각으로 분할하고 shuffle한다.
6. 손 gesture 기반으로 퍼즐 조각을 grab, drag, drop한다.
7. 퍼즐 완성 여부를 판별한다.

## 설계 원칙

- MediaPipe 결과를 앱 전체에서 직접 사용하지 않는다. 항상 내부 도메인 모델로 변환한다.
- tracking, gesture recognition, interaction state, rendering, puzzle logic을 분리한다.
- 실시간 렌더링은 canvas 중심으로 처리하고, UI framework 상태 갱신은 요약 정보 위주로 제한한다.
- 좌표계는 처음부터 명확히 정의한다. 특히 webcam mirror 여부와 handedness 해석을 고정한다.
- raw landmark와 smoothed landmark를 분리한다. raw는 gesture 판정에, smoothed는 rendering과 visual feedback에 사용한다.
- 각 Phase는 독립적으로 검증 가능한 완료 조건을 가져야 한다.

## 권장 프로젝트 구조

```txt
src/
  app/
    main.ts
    App.tsx
  media/
    camera.ts
    frameLoop.ts
  tracking/
    handLandmarker.ts
    handTypes.ts
    handNormalizer.ts
  interaction/
    interactionState.ts
    handPair.ts
    gestures/
      pinch.ts
      gestureTypes.ts
  rendering/
    canvasRenderer.ts
    skeletonRenderer.ts
    debugOverlay.ts
  capture/
    snapshot.ts
    imageSource.ts
  puzzle/
    puzzleTypes.ts
    puzzleGenerator.ts
    puzzleState.ts
    puzzleInteraction.ts
    completion.ts
  config/
    mediapipeConfig.ts
    skeleton.ts
    coordinateConfig.ts
```

## 공통 데이터 흐름

```txt
Camera Stream
  -> Video Element
  -> Frame Loop
  -> MediaPipe HandLandmarker.detectForVideo
  -> Raw Hand Landmarks
  -> Coordinate Normalize / Mirror Correction / Smoothing
  -> TrackingFrame
  -> Gesture Recognition
  -> Interaction State Update
  -> Scene Render
```

## 핵심 내부 모델

```ts
type NormalizedLandmark = {
  x: number;
  y: number;
  z: number;
};

type ScreenPoint = {
  x: number;
  y: number;
  z: number;
};

type TrackedHand = {
  id: string;
  handedness: "Left" | "Right" | "Unknown";
  handednessScore: number;
  rawLandmarks: NormalizedLandmark[];
  smoothedLandmarks: NormalizedLandmark[];
  points: ScreenPoint[];
  center: ScreenPoint;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible: boolean;
  lastSeenAt: number;
};

type TrackingFrame = {
  timestamp: number;
  hands: TrackedHand[];
  leftHand: TrackedHand | null;
  rightHand: TrackedHand | null;
  rawVideoSize: {
    width: number;
    height: number;
  };
  canvasSize: {
    width: number;
    height: number;
  };
};
```

## Phase 1: Hand Skeleton Tracking

목표는 MediaPipe Hands 기반으로 양손 21개 keypoint를 추적하고 canvas에 skeleton을 실시간 렌더링하는 것이다.

### 작업 항목

- webcam 권한 요청 및 video stream 연결
- MediaPipe Hand Landmarker 초기화
- `numHands` 또는 `maxNumHands`를 2로 설정
- 매 frame마다 hand landmarks 추론
- MediaPipe 결과를 `TrackedHand` 모델로 변환
- handedness를 기준으로 left/right hand 분리
- normalized 좌표를 canvas screen 좌표로 변환
- skeleton connection 정의
- canvas에 video frame, bone line, landmark point, debug overlay 렌더링
- 손이 사라졌을 때 lost 상태 처리

### 완료 조건

- 양손을 동시에 인식할 수 있다.
- 각 손의 21개 keypoint가 화면에 안정적으로 표시된다.
- left/right handedness와 confidence를 debug overlay에서 확인할 수 있다.
- 손을 화면 밖으로 빼면 tracking lost 상태가 표시된다.
- rendering loop와 MediaPipe inference loop가 과도하게 UI state를 갱신하지 않는다.

## Phase 2: Virtual Bounding Box

목표는 양손 위치를 기반으로 interaction 영역을 나타내는 virtual bounding box를 생성하는 것이다.

### 작업 항목

- left/right hand center 계산
- 두 손 center를 기준으로 box center 계산
- 양손 landmark 전체를 포함하는 hand union bounds 계산
- box 최소 크기, 최대 크기, aspect ratio 정책 정의
- box smoothing 적용
- box visibility 상태 정의

### 완료 조건

- 양손이 보일 때 virtual bounding box가 표시된다.
- 손이 흔들려도 box가 과도하게 떨리지 않는다.
- 한 손만 보일 때 box를 숨길지, 마지막 상태를 유지할지 정책이 명확하다.

## Phase 3: Two-Hand Distance Scaling

목표는 양손 사이 거리 변화로 virtual bounding box의 scale을 조절하는 것이다.

### 작업 항목

- 양손 center 사이 거리 계산
- 초기 calibration distance 저장
- 현재 거리와 초기 거리의 scale ratio 계산
- scale ratio clamp 적용
- box scale smoothing 적용
- scale 변화량이 작을 때 dead zone 처리

### 완료 조건

- 양손을 벌리면 box가 커지고, 좁히면 작아진다.
- 미세한 손 떨림으로 box 크기가 흔들리지 않는다.
- 손을 잃었다가 다시 찾았을 때 calibration이 깨지지 않는다.

## Phase 4: Pinch Gesture Snapshot Capture

목표는 pinch gesture를 안정적으로 인식하고 snapshot capture event를 발생시키는 것이다.

### 작업 항목

- thumb tip index `4`, index finger tip index `8` 거리 계산
- 손 크기에 따른 normalized pinch distance 계산
- pinch start, hold, release 상태 정의
- debounce 또는 cooldown 적용
- capture trigger는 pinch start 또는 pinch hold 중 하나로 정책화
- video frame 또는 bounding box 영역 snapshot 캡처

### 완료 조건

- 의도적인 pinch에서만 capture가 발생한다.
- 한 번의 pinch에서 snapshot이 여러 번 중복 저장되지 않는다.
- capture 영역이 video/canvas 좌표와 일치한다.

## Phase 5: 3x3 Puzzle Generation

목표는 캡처된 이미지를 3x3 퍼즐 조각으로 분할하고 shuffle하는 것이다.

### 작업 항목

- snapshot image source를 offscreen canvas로 로드
- 3x3 tile crop 좌표 계산
- tile별 original index, current index, image crop metadata 저장
- shuffle 알고리즘 구현
- 완성 상태와 동일한 shuffle 결과 방지
- puzzle board 좌표계 정의

### 완료 조건

- snapshot이 9개 조각으로 정확히 분할된다.
- 각 tile은 원본 위치 정보를 유지한다.
- shuffle 후 board에 3x3으로 배치된다.
- 렌더링된 tile 간 crop gap 또는 scaling artifact가 없다.

## Phase 6: Gesture-Based Grab, Drag, Drop

목표는 pinch gesture를 pointer interaction으로 사용해 퍼즐 조각을 조작하는 것이다.

### 작업 항목

- interaction pointer 위치 정의: index tip 또는 pinch midpoint
- pinch start 시 pointer 아래 tile hit test
- grabbed tile 상태 저장
- pinch hold 중 tile position update
- pinch release 시 nearest cell에 drop
- invalid drop 또는 occupied cell 처리
- visual feedback: hover, grabbed, drop target 상태 표시

### 완료 조건

- 손으로 특정 tile을 선택할 수 있다.
- pinch를 유지한 상태로 tile을 이동할 수 있다.
- pinch를 풀면 tile이 가장 가까운 cell에 놓인다.
- 이미 점유된 cell과의 swap 또는 reject 정책이 명확하다.

## Phase 7: Puzzle Completion Detection

목표는 퍼즐이 완성되었는지 판별하고 완료 상태를 표시하는 것이다.

### 작업 항목

- 각 tile의 original index와 current cell index 비교
- 모든 tile이 제자리에 있는지 판별
- 완료 후 interaction lock 여부 결정
- completion animation 또는 visual feedback 추가
- reset 또는 new capture flow 연결

### 완료 조건

- 모든 tile이 원래 위치에 놓이면 completion 상태가 된다.
- completion 상태가 중복으로 발생하지 않는다.
- 사용자가 새 snapshot으로 퍼즐을 다시 시작할 수 있다.

## 좌표계 정책

초기 구현에서 반드시 고정해야 하는 값이다.

```ts
type CoordinateConfig = {
  mirrorPreview: boolean;
  mirrorInput: boolean;
  useViewerSpace: boolean;
  swapHandednessWhenNeeded: boolean;
};
```

권장 기본값:

```ts
const coordinateConfig = {
  mirrorPreview: true,
  mirrorInput: true,
  useViewerSpace: true,
  swapHandednessWhenNeeded: false,
};
```

viewer space를 사용하면 사용자가 화면에서 보는 방향과 interaction 좌표가 일치한다. 즉, 손이 화면 오른쪽으로 움직이면 pointer의 `x` 값도 증가해야 한다.

## Gesture 판정 기준

pinch는 절대 pixel 거리보다 손 크기 기준으로 정규화해서 판정한다.

```txt
pinchDistance = distance(thumbTip, indexTip)
handScale = distance(wrist, middleMcp)
normalizedPinch = pinchDistance / handScale
```

초기 threshold 예시:

```txt
pinch start: normalizedPinch < 0.35
pinch release: normalizedPinch > 0.50
```

start와 release threshold를 다르게 두면 hysteresis가 생겨 gesture 상태가 덜 흔들린다.

## 검증 체크리스트

- 30 FPS 이상으로 skeleton이 표시되는가?
- 양손을 교차하거나 가까이 가져가도 handedness가 과도하게 뒤집히지 않는가?
- canvas 크기와 video 크기가 달라도 좌표가 맞는가?
- browser resize 후에도 skeleton과 pointer 위치가 맞는가?
- 손이 잠깐 사라졌을 때 interaction state가 비정상적으로 남지 않는가?
- pinch가 손 크기와 카메라 거리 변화에 어느 정도 robust한가?
- puzzle tile 조작 중 tracking loss가 발생하면 grabbed state를 어떻게 처리하는가?

## 구현 순서 요약

1. Phase 1에서 tracking pipeline과 좌표계를 완성한다.
2. Phase 2에서 양손 기반 virtual interaction 영역을 만든다.
3. Phase 3에서 양손 거리 기반 scale interaction을 추가한다.
4. Phase 4에서 pinch gesture와 snapshot event를 안정화한다.
5. Phase 5에서 snapshot 기반 puzzle board를 생성한다.
6. Phase 6에서 gesture pointer로 puzzle tile을 조작한다.
7. Phase 7에서 completion detection과 reset flow를 연결한다.

Phase 1의 품질이 이후 모든 단계의 안정성을 결정한다. 따라서 skeleton rendering만 끝내는 것이 아니라, 좌표계, handedness, smoothing, tracking lost 상태까지 함께 마무리해야 한다.
