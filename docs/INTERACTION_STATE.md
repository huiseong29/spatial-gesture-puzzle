# Interaction State

이 문서는 hand tracking interaction puzzle system의 전체 interaction state machine을 정의한다. 목표는 gesture input을 단순 click 대체 수단으로 쓰는 것이 아니라, spatial interaction event로 안정적으로 해석하는 것이다.

## 상태 계층

시스템 상태는 하나의 flat state만으로 관리하지 않는다. 다음 4개 계층으로 나눈다.

```txt
System State
Tracking State
Gesture State
Puzzle State
```

각 계층은 독립적으로 계산하되, interaction command를 생성할 때만 조합한다.

## System State

```ts
type SystemState =
  | "booting"
  | "camera-permission"
  | "camera-ready"
  | "model-loading"
  | "running"
  | "paused"
  | "error";
```

### 전이 조건

```txt
booting -> camera-permission
  앱이 시작되고 webcam stream을 요청할 준비가 됐을 때

camera-permission -> camera-ready
  사용자가 camera 권한을 허용하고 video stream이 연결됐을 때

camera-permission -> error
  사용자가 camera 권한을 거부하거나 camera stream 생성에 실패했을 때

camera-ready -> model-loading
  MediaPipe Hand Landmarker 초기화를 시작했을 때

model-loading -> running
  model load가 완료되고 frame loop가 시작됐을 때

running -> paused
  tab hidden, user pause, fatal low-resource mode가 발생했을 때

paused -> running
  video stream과 model이 유효하고 loop 재개가 가능할 때

any -> error
  복구 불가능한 camera, model, rendering 오류가 발생했을 때
```

## Tracking State

```ts
type TrackingState =
  | "no-hands"
  | "single-hand"
  | "both-hands"
  | "unstable"
  | "lost";
```

### 전이 조건

```txt
no-hands -> single-hand
  유효한 손 1개가 min confidence 이상으로 감지됐을 때

single-hand -> both-hands
  left/right hand pair가 모두 유효하게 감지됐을 때

both-hands -> single-hand
  한 손이 missing grace period 이상 사라졌을 때

single-hand -> no-hands
  모든 손이 missing grace period 이상 사라졌을 때

any -> unstable
  handedness flip, landmark jump, confidence drop이 threshold 이상 발생했을 때

unstable -> single-hand 또는 both-hands
  일정 frame 이상 안정적인 landmark가 회복됐을 때

any -> lost
  tracking 결과가 일정 시간 이상 없거나 video frame이 유효하지 않을 때
```

## Gesture State

gesture는 손별로 계산한 뒤, system-level gesture command로 승격한다.

```ts
type PerHandGestureState =
  | "open"
  | "pinch-start"
  | "pinch-hold"
  | "pinch-release"
  | "invalid";

type ActiveGestureCommand =
  | "none"
  | "capture"
  | "grab"
  | "drag"
  | "drop"
  | "cancel";
```

### Pinch 전이 조건

```txt
open -> pinch-start
  normalized pinch distance가 start threshold보다 작아졌을 때

pinch-start -> pinch-hold
  pinch 상태가 hold minimum duration 이상 유지됐을 때

pinch-hold -> pinch-release
  normalized pinch distance가 release threshold보다 커졌을 때

pinch-start -> open
  hold minimum duration 전에 pinch distance가 release threshold보다 커졌을 때

pinch-release -> open
  release event가 command layer에서 소비됐을 때

any -> invalid
  tracking confidence가 낮거나 필요한 landmark가 유효하지 않을 때
```

### 권장 threshold

```txt
pinch start: normalizedPinch < 0.35
pinch release: normalizedPinch > 0.50
minimum hold duration: 80ms ~ 150ms
capture cooldown: 800ms ~ 1500ms
```

start threshold와 release threshold를 다르게 둬서 hysteresis를 만든다.

## Puzzle State

```ts
type PuzzleState =
  | "empty"
  | "capturing"
  | "snapshot-ready"
  | "generating"
  | "shuffled"
  | "tile-hover"
  | "tile-grabbed"
  | "tile-dragging"
  | "tile-dropping"
  | "completed"
  | "resetting";
```

### 전이 조건

```txt
empty -> capturing
  capture command가 발생했을 때

capturing -> snapshot-ready
  video 또는 bounding box 영역 snapshot 생성이 완료됐을 때

snapshot-ready -> generating
  3x3 tile crop 생성을 시작했을 때

generating -> shuffled
  tile 생성과 shuffle이 완료됐을 때

shuffled -> tile-hover
  valid pointer가 tile 위에 있을 때

tile-hover -> tile-grabbed
  hover tile 위에서 pinch-start가 발생했을 때

tile-grabbed -> tile-dragging
  pinch-hold가 유지되고 pointer movement가 시작됐을 때

tile-dragging -> tile-dropping
  pinch-release가 발생했을 때

tile-dropping -> shuffled
  drop 결과가 반영됐고 puzzle이 아직 완성되지 않았을 때

tile-dropping -> completed
  drop 결과 반영 후 모든 tile이 original position에 있을 때

completed -> resetting
  reset 또는 new capture command가 발생했을 때

resetting -> empty
  puzzle state와 gesture command buffer가 초기화됐을 때
```

## Command 생성 규칙

gesture state를 바로 puzzle state에 연결하지 않는다. 중간에 command layer를 둔다.

```txt
TrackingFrame + GestureState + PuzzleState
  -> InteractionCommand
  -> PuzzleState Update
  -> RenderState
```

예시:

```ts
type InteractionCommand = {
  type: "capture" | "grab" | "drag" | "drop" | "cancel" | "none";
  handId?: string;
  pointer?: { x: number; y: number };
  targetTileId?: string;
  timestamp: number;
};
```

## 금지 상태

다음 조합은 시스템에서 허용하지 않는다.

```txt
SystemState !== running 이면서 PuzzleState가 tile-dragging
  loop가 멈춘 상태에서 drag가 지속되면 안 된다.

TrackingState가 no-hands 또는 lost인데 GestureState가 pinch-hold
  유효한 landmark 없이 gesture hold가 유지되면 안 된다.

PuzzleState가 empty인데 Command가 grab, drag, drop
  tile이 없는 상태에서 tile interaction이 발생하면 안 된다.

PuzzleState가 completed인데 Command가 grab 또는 drag
  완료 후 interaction lock 정책이 적용되어야 한다.

동일 timestamp에 capture와 grab이 동시에 발생
  pinch gesture의 의미가 phase에 따라 하나로 결정되어야 한다.

두 손이 동시에 서로 다른 tile을 grabbed
  초기 버전에서는 single active manipulator만 허용한다.

tile-dropping 상태에서 새로운 grab command 발생
  drop resolution이 끝나기 전 새 조작을 시작하면 안 된다.
```

## Gesture 충돌 방지 규칙

### Single Active Manipulator

초기 구현에서는 동시에 하나의 손만 puzzle manipulation을 수행한다.

```txt
activeHandId가 설정되면 다른 손의 pinch는 command로 승격하지 않는다.
activeHandId는 drop, cancel, tracking lost에서 해제한다.
```

### Phase-Specific Pinch Meaning

pinch는 현재 puzzle state에 따라 다른 command로 해석한다.

```txt
empty 또는 bounding-box-ready
  pinch-start -> capture

shuffled 또는 tile-hover
  pinch-start on tile -> grab

tile-grabbed 또는 tile-dragging
  pinch-hold -> drag
  pinch-release -> drop

completed
  pinch input ignored 또는 reset UI에서만 사용
```

### Cooldown

capture와 grab은 각각 별도 cooldown을 가진다.

```txt
captureCooldownUntil > now
  capture command를 만들지 않는다.

grabCooldownUntil > now
  새 grab command를 만들지 않는다.
```

### Confidence Gate

gesture command는 tracking confidence gate를 통과해야 한다.

```txt
handednessScore >= minHandednessScore
landmarkConfidence 또는 추적 안정성 >= minTrackingConfidence
landmark jump < maxAllowedJump
```

### Tracking Loss Policy

drag 중 tracking이 사라졌을 때의 기본 정책:

```txt
short loss within grace period
  마지막 pointer 위치에 tile을 freeze한다.

loss beyond grace period
  cancel command를 발생시키고 tile을 grab 이전 위치로 되돌린다.
```

## 이벤트 우선순위

같은 frame에서 여러 이벤트가 발생할 때 다음 우선순위를 적용한다.

```txt
1. error
2. tracking lost cancel
3. drop
4. drag
5. grab
6. capture
7. hover
8. render-only update
```

drop이 grab보다 우선하는 이유는 기존 조작을 먼저 닫아야 다음 조작이 안정적으로 시작될 수 있기 때문이다.

## 상태 업데이트 원칙

- MediaPipe 결과는 immutable `TrackingFrame`으로 변환한다.
- gesture recognition은 현재 frame과 이전 gesture state를 입력으로 받아 새 gesture state를 반환한다.
- puzzle reducer는 command만 입력으로 받는다.
- rendering은 state를 변경하지 않는다.
- React state에는 mode, error, debug summary 같은 낮은 빈도의 상태만 둔다.
- Canvas render state는 ref 또는 external store로 관리한다.
