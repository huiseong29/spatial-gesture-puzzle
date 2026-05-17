import type { ExperienceState, RuntimeStatus } from "./HandTrackingController";

export type InstructionCopy = {
  title: string;
  instruction: string;
};

export function getInteractionInstruction(
  status: RuntimeStatus,
  experienceState: ExperienceState
): InstructionCopy {
  if (status.phase === "idle" || status.phase === "stopped") {
    return {
      title: "카메라 대기",
      instruction: "카메라를 켜고 손 인식을 시작하세요."
    };
  }

  if (status.phase === "camera-permission") {
    return {
      title: "카메라 권한 확인",
      instruction: "브라우저의 카메라 권한을 허용하면 손 인식이 시작됩니다."
    };
  }

  if (status.phase === "camera-ready" || status.phase === "model-loading" || status.phase === "booting") {
    return {
      title: "손 인식 준비",
      instruction: "카메라와 Hand Landmarker 모델을 준비하는 중입니다."
    };
  }

  if (status.phase === "error") {
    return {
      title: "카메라 오류",
      instruction: "카메라 권한 또는 다른 앱의 카메라 사용 여부를 확인하세요."
    };
  }

  if (experienceState.puzzleMode === "completed") {
    if (experienceState.heatmapReplayMode === "playing" || experienceState.heatmapReplayMode === "finished") {
      return {
        title: "손 이동 분석",
        instruction: "밝은 영역은 손동작이 집중된 위치이고, 연한 선은 퍼즐 조작 경로입니다."
      };
    }

    return {
      title: "퍼즐 완성",
      instruction: "모든 조각을 맞췄습니다. 인터랙션 분석을 보거나 다시 촬영할 수 있습니다."
    };
  }

  if (experienceState.puzzleMode === "loading" || experienceState.puzzleMode === "transitioning") {
    return {
      title: "퍼즐 생성 중",
      instruction: "캡처한 영역을 퍼즐 조각으로 나누고 배치하는 중입니다."
    };
  }

  if (experienceState.puzzleMode === "ready") {
    return {
      title: "퍼즐 조작",
      instruction: "조각 위에서 pinch해 집고, 원하는 칸에서 손을 떼어 놓으세요."
    };
  }

  if (experienceState.capturePhase === "locked") {
    return {
      title: "퍼즐 생성 중",
      instruction: "캡처한 이미지를 고정하고 퍼즐 보드로 전환하는 중입니다."
    };
  }

  if (experienceState.captureReady) {
    return {
      title: "캡처 준비",
      instruction: "손을 떼어 영역을 확정한 뒤, 양손을 동시에 다시 pinch하면 캡처됩니다."
    };
  }

  if (experienceState.boxMode === "editing") {
    return {
      title: "영역 조절",
      instruction: "양손 pinch를 유지한 채 벌리거나 좁혀 캡처 영역을 조절하세요."
    };
  }

  return {
    title: "영역 지정",
    instruction: "양손의 엄지와 검지를 모아 네모의 양 끝을 잡으세요."
  };
}
