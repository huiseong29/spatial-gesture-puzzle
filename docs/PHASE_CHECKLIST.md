# Phase Checklist

이 문서는 웹캠 기반 실시간 hand tracking interaction puzzle system을 단계적으로 구현하기 위한 체크리스트다. 프로젝트는 MediaPipe Hands, React, Canvas를 기반으로 하며, 단순 퍼즐 게임이 아니라 gesture-driven spatial interaction system으로 설계한다.

## Phase 1: Hand Skeleton Tracking

### 목표

- MediaPipe Hands 기반으로 양손의 21개 keypoint를 실시간 추적한다.
- 추적 결과를 React 상태에 직접 묶지 않고 내부 tracking model로 변환한다.
- Canvas 위에 video frame과 hand skeleton을 안정적으로 렌더링한다.

### 완료 조건

- webcam permission 요청과 video stream 연결이 동작한다.
- 최대 2개 손을 동시에 추적할 수 있다.
- 각 손의 21개 landmark가 skeleton line과 point로 표시된다.
- handedness, confidence, FPS, hand count를 debug overlay로 확인할 수 있다.
- 손이 사라졌을 때 tracking lost 상태가 명확히 처리된다.
- raw landmark와 rendering용 smoothed landmark가 분리되어 있다.

### 테스트 항목

- 한 손, 양손, 손 없음 상태에서 crash 없이 동작하는가?
- 양손을 빠르게 움직여도 skeleton이 과도하게 늦거나 튀지 않는가?
- browser resize 후에도 skeleton 좌표가 video와 일치하는가?
- 좌우 mirror 상태에서 사용자가 보는 방향과 interaction 좌표가 일치하는가?
- handedness가 일시적으로 뒤집힐 때 UI와 내부 상태가 불안정해지지 않는가?

### 다음 단계 의존성

- Phase 2의 virtual bounding box는 Phase 1의 `TrackedHand.center`, `boundingRect`, `leftHand`, `rightHand`에 의존한다.
- Phase 4의 pinch gesture는 Phase 1의 raw landmark index `4`, `8`에 의존한다.

## Phase 2: Virtual Bounding Box

### 목표

- 양손 위치를 기반으로 spatial interaction 영역을 나타내는 virtual bounding box를 생성한다.
- bounding box를 이후 snapshot capture, puzzle board placement, spatial control의 기준 좌표계로 사용한다.

### 완료 조건

- 양손이 모두 보이면 bounding box가 표시된다.
- 두 손의 center와 landmark bounds를 기준으로 box center와 size를 계산한다.
- box에는 최소 크기, 최대 크기, aspect ratio 정책이 적용되어 있다.
- tracking loss 상태에서 box를 hide, freeze, decay 중 어떤 방식으로 처리할지 정책이 정해져 있다.
- box jitter를 줄이기 위한 smoothing이 적용되어 있다.

### 테스트 항목

- 양손을 좌우, 상하로 움직일 때 box가 의도한 위치를 따라가는가?
- 한 손이 잠깐 사라질 때 box가 비정상적으로 점프하지 않는가?
- 손을 교차했을 때 left/right hand pairing이 box 계산을 망가뜨리지 않는가?
- 작은 화면과 큰 화면에서 box가 canvas 밖으로 과도하게 벗어나지 않는가?

### 다음 단계 의존성

- Phase 3의 scale control은 Phase 2의 box model과 양손 center distance에 의존한다.
- Phase 4의 snapshot 영역은 Phase 2의 box 좌표를 capture crop 영역으로 사용할 수 있다.

## Phase 3: Two-Hand Distance Scaling

### 목표

- 양손 사이 거리 변화를 이용해 virtual bounding box의 크기를 조절한다.
- 사용자가 실제 공간에서 손을 벌리고 좁히는 동작을 system scale control로 해석한다.

### 완료 조건

- 양손 center 사이 거리를 매 frame 계산한다.
- calibration 기준 거리와 현재 거리의 ratio로 scale을 계산한다.
- scale에는 min, max clamp가 적용되어 있다.
- 작은 떨림을 무시하기 위한 dead zone이 있다.
- scale smoothing이 적용되어 급격한 size jump가 줄어든다.

### 테스트 항목

- 양손을 벌리면 box가 커지고, 좁히면 작아지는가?
- 손이 정지해 있을 때 scale 값이 계속 흔들리지 않는가?
- 한 손 tracking loss 후 복구됐을 때 scale 기준이 비정상적으로 변하지 않는가?
- 카메라와의 거리 변화가 box scale에 과도하게 영향을 주지 않는가?

### 다음 단계 의존성

- Phase 4의 snapshot capture 영역은 scale된 bounding box를 사용할 수 있다.
- Phase 6의 puzzle board interaction 영역은 scale된 box coordinate system에 맞춰 배치할 수 있다.

## Phase 4: Pinch Gesture Snapshot Capture

### 목표

- thumb tip과 index tip 사이 거리를 이용해 pinch gesture를 인식한다.
- pinch gesture를 snapshot capture trigger로 사용한다.

### 완료 조건

- thumb tip landmark `4`, index tip landmark `8` 사이 거리를 계산한다.
- 손 크기 기준 normalized pinch distance를 사용한다.
- pinch start, hold, release 상태가 분리되어 있다.
- hysteresis threshold가 적용되어 gesture 상태가 흔들리지 않는다.
- capture cooldown이 있어 한 번의 pinch에서 snapshot이 여러 번 발생하지 않는다.
- snapshot capture는 video frame 또는 virtual bounding box 영역 기준으로 수행된다.

### 테스트 항목

- 의도적인 pinch에서만 capture가 발생하는가?
- 손을 카메라에 가까이 하거나 멀리 해도 threshold가 크게 무너지지 않는가?
- pinch hold 중 capture가 중복 실행되지 않는가?
- pinch release 후 다시 pinch하면 새로운 capture가 가능한가?
- capture된 이미지가 화면에서 본 영역과 일치하는가?

### 다음 단계 의존성

- Phase 5의 puzzle generation은 Phase 4에서 생성한 snapshot image source에 의존한다.
- Phase 6의 grab gesture는 Phase 4의 pinch state machine을 재사용한다.

## Phase 5: 3x3 Puzzle Generation

### 목표

- 캡처된 이미지를 3x3 tile로 분할하고, 각 tile의 원래 위치와 현재 위치를 관리한다.
- puzzle board를 spatial interaction layer 위에 배치한다.

### 완료 조건

- snapshot image가 offscreen canvas 또는 image bitmap으로 변환된다.
- 3x3 crop 좌표가 정확히 계산된다.
- 각 tile은 `id`, `originalIndex`, `currentIndex`, `row`, `col`, `imageRect`를 가진다.
- shuffle 결과가 완성 상태와 동일하지 않다.
- puzzle board는 Canvas에서 안정적으로 렌더링된다.

### 테스트 항목

- 9개 tile이 원본 이미지를 빈틈 없이 구성하는가?
- shuffle 후 모든 tile이 정확히 하나씩 존재하는가?
- tile crop에 경계선 artifact나 비율 왜곡이 없는가?
- board resize 또는 bounding box scale 변경 시 tile 배치가 깨지지 않는가?

### 다음 단계 의존성

- Phase 6의 grab, drag, drop은 Phase 5의 tile state와 board cell 좌표에 의존한다.
- Phase 7의 completion detection은 `originalIndex`와 `currentIndex` 비교에 의존한다.

## Phase 6: Gesture-Based Grab, Drag, Drop

### 목표

- pinch gesture를 pointer interaction으로 해석해 puzzle tile을 선택하고 이동한다.
- mouse interaction이 아니라 hand gesture 기반 spatial manipulation으로 구현한다.

### 완료 조건

- interaction pointer는 index tip 또는 pinch midpoint 중 하나로 정의되어 있다.
- pinch start 시 pointer 아래 tile을 hit test한다.
- grabbed tile은 다른 tile보다 위에 렌더링된다.
- pinch hold 동안 grabbed tile이 pointer를 따라 이동한다.
- pinch release 시 nearest cell에 drop된다.
- occupied cell에 대한 swap, reject, push 정책 중 하나가 명확히 구현되어 있다.
- tracking loss 시 grabbed state를 cancel, freeze, release 중 어떤 방식으로 처리할지 정의되어 있다.

### 테스트 항목

- tile 위에서 pinch하면 해당 tile이 선택되는가?
- tile 밖에서 pinch하면 잘못된 grab이 발생하지 않는가?
- drag 중 손이 빨리 움직여도 tile이 pointer를 따라가는가?
- drop 위치가 가장 가까운 board cell과 일치하는가?
- 두 손이 동시에 pinch할 때 gesture conflict가 발생하지 않는가?

### 다음 단계 의존성

- Phase 7의 completion detection은 Phase 6에서 update한 tile current position에 의존한다.
- reset, recapture, replay flow는 Phase 6 interaction lock 상태에 의존한다.

## Phase 7: Completion Detection and Session Flow

### 목표

- puzzle 완성 여부를 판별하고, 완료 후 시스템 상태를 안정적으로 전환한다.
- 사용자가 새 snapshot으로 다시 시작할 수 있는 session flow를 제공한다.

### 완료 조건

- 모든 tile의 `currentIndex`가 `originalIndex`와 같으면 complete로 판정한다.
- complete event는 한 번만 발생한다.
- complete 상태에서 tile interaction을 lock하거나 별도 replay 정책을 적용한다.
- reset, new capture, reshuffle 동작이 명확히 구분되어 있다.
- 완료 feedback이 Canvas 또는 React UI에 표시된다.

### 테스트 항목

- 마지막 tile을 제자리에 놓는 순간 complete 상태가 되는가?
- 이미 complete된 상태에서 같은 event가 반복 발생하지 않는가?
- reset 후 tracking, capture, puzzle state가 깨끗하게 초기화되는가?
- new capture 후 이전 tile image나 state가 남지 않는가?

### 다음 단계 의존성

- 최종 UX polish, accessibility, performance tuning은 Phase 7 이후 진행한다.
- session analytics나 gesture calibration UI는 모든 core interaction이 안정화된 후 추가한다.

## 최종 안정화

### 목표

- realtime hand tracking, gesture recognition, puzzle manipulation을 하나의 spatial interaction system으로 안정화한다.

### 완료 조건

- 일반적인 실내 조명과 webcam 환경에서 tracking이 유지된다.
- FPS, latency, gesture false positive가 허용 가능한 수준이다.
- React state update가 rendering loop를 방해하지 않는다.
- Canvas drawing, MediaPipe inference, gesture state update의 책임이 분리되어 있다.

### 테스트 항목

- 5분 이상 연속 실행해도 memory usage가 지속적으로 증가하지 않는가?
- webcam permission denial, camera unavailable, MediaPipe load failure를 처리하는가?
- resize, tab hidden, tab visible 복귀 후 loop가 정상 복구되는가?
- low FPS 상황에서도 gesture state가 폭주하지 않는가?
