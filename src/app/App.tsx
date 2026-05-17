import { useEffect, useRef, useState } from "react";
import { HandTrackingController, type ExperienceState, type RuntimeStatus } from "./HandTrackingController";
import type { ThemeMode } from "../theme/themeTypes";

function modeToKoreanInstruction(status: RuntimeStatus) {
  if (status.phase === "idle") {
    return "카메라를 시작하세요";
  }

  if (status.phase === "camera-permission") {
    return "카메라 권한을 요청하는 중입니다";
  }

  if (status.phase === "camera-ready") {
    return "양손 pinch로 캡처 영역을 지정하세요";
  }

  if (status.phase === "model-loading") {
    return "Hand Landmarker 모델을 로딩 중입니다";
  }

  if (status.phase === "running") {
    if (status.message === "Puzzle restarted") {
      return "퍼즐을 다시 섞었습니다";
    }

    if (status.message === "Ready for new capture") {
      return "새 캡처 영역을 지정하세요";
    }

    return "pinch gesture로 퍼즐 조각을 이동하세요";
  }

  if (status.phase === "stopped") {
    return "카메라가 정지되었습니다. 다시 시작할 수 있습니다";
  }

  if (status.phase === "error") {
    return "카메라 접근 권한을 확인하세요";
  }

  return "시스템을 준비 중입니다";
}

function modeToStatusLabel(status: RuntimeStatus) {
  if (status.phase === "running") {
    return "RUNNING";
  }

  if (status.phase === "error") {
    return "ERROR";
  }

  if (status.phase === "stopped") {
    return "STOPPED";
  }

  if (status.phase === "camera-permission" || status.phase === "model-loading") {
    return "LOADING";
  }

  return "READY";
}

type UnifiedTopBarProps = {
  status: RuntimeStatus;
  debugEnabled: boolean;
  themeMode: ThemeMode;
  onStart: () => void;
  onToggleDebug: () => void;
  onToggleTheme: () => void;
};

function UnifiedTopBar({
  status,
  debugEnabled,
  themeMode,
  onStart,
  onToggleDebug,
  onToggleTheme
}: UnifiedTopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand-block">
        <span className="eyebrow">Computer Vision · HCI Demo</span>
        <strong>Spatial Gesture Puzzle</strong>
      </div>

      <div className="top-guide" aria-live="polite">
        <span className={`mode-pill mode-${status.phase}`}>{modeToStatusLabel(status)}</span>
        <p>{modeToKoreanInstruction(status)}</p>
      </div>

      <div className="top-actions" aria-label="상단 액션">
        <button
          type="button"
          className="compact-action"
          onClick={onStart}
          disabled={
            status.phase === "running" ||
            status.phase === "camera-permission" ||
            status.phase === "model-loading" ||
            status.phase === "booting"
          }
        >
          손 인식
        </button>
        <button
          type="button"
          className={debugEnabled ? "compact-action is-active" : "compact-action"}
          onClick={onToggleDebug}
        >
          Debug
        </button>
        <button type="button" className="compact-action" onClick={onToggleTheme}>
          {themeMode === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </header>
  );
}

function createInitialExperienceState(): ExperienceState {
  return {
    puzzleMode: null,
    heatmapReplayMode: "hidden",
    pointerHistoryCount: 0
  };
}

export function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<HandTrackingController | null>(null);
  const [status, setStatus] = useState<RuntimeStatus>({
    phase: "idle",
    message: "카메라를 시작하세요"
  });
  const [experienceState, setExperienceState] = useState<ExperienceState>(createInitialExperienceState);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme());
  const showStartCard = status.phase !== "running";
  const showAnalysisButton =
    status.phase === "running" &&
    experienceState.puzzleMode === "completed" &&
    experienceState.heatmapReplayMode === "ready" &&
    experienceState.pointerHistoryCount > 0;
  const showReplayPanel =
    status.phase === "running" &&
    experienceState.puzzleMode === "completed" &&
    (experienceState.heatmapReplayMode === "playing" || experienceState.heatmapReplayMode === "finished");

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    const controller = new HandTrackingController({
      video: videoRef.current,
      canvas: canvasRef.current,
      onStatus: setStatus,
      onExperienceState: setExperienceState
    });

    controllerRef.current = controller;
    return () => {
      controller.stop();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("spatial-gesture-theme", themeMode);
    controllerRef.current?.setThemeMode(themeMode);
  }, [themeMode]);

  const startCamera = () => {
    void controllerRef.current?.start();
  };

  const stopCamera = () => {
    controllerRef.current?.stop();
    setExperienceState(createInitialExperienceState());
  };

  const restartPuzzle = () => {
    controllerRef.current?.restartPuzzle();
  };

  const retakeSnapshot = () => {
    controllerRef.current?.retakeSnapshot();
    setExperienceState(createInitialExperienceState());
  };

  const startInteractionReplay = () => {
    controllerRef.current?.startInteractionReplay();
    setExperienceState((current) => ({
      ...current,
      heatmapReplayMode: "playing"
    }));
  };

  const toggleDebug = () => {
    const next = !debugEnabled;
    setDebugEnabled(next);
    controllerRef.current?.setDebugEnabled(next);
  };

  const toggleTheme = () => {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  };

  return (
    <main className="experience-shell" data-theme={themeMode}>
      <section className="stage" aria-label="손 제스처 퍼즐 인터랙션 데모">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={canvasRef} className="tracking-canvas" />

        <div className="ui-layer">
          <UnifiedTopBar
            status={status}
            debugEnabled={debugEnabled}
            themeMode={themeMode}
            onStart={startCamera}
            onToggleDebug={toggleDebug}
            onToggleTheme={toggleTheme}
          />

          <div className="center-layer">
            {showStartCard ? (
              <div className="start-card" aria-live="polite">
                <span className="start-card-icon" aria-hidden="true">
                  CV
                </span>
                <h1>Hand Gesture Interaction Demo</h1>
                <p>{modeToKoreanInstruction(status)}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={
                    status.phase === "camera-permission" ||
                    status.phase === "model-loading" ||
                    status.phase === "booting"
                  }
                >
                  카메라 시작
                </button>
              </div>
            ) : null}

            {showAnalysisButton ? (
              <div className="analysis-card" aria-live="polite">
                <span className="analysis-kicker">Interaction Analysis</span>
                <h2>퍼즐 완성</h2>
                <p>손 이동 경로와 머문 영역을 heatmap replay로 확인할 수 있습니다.</p>
                <div className="analysis-actions">
                  <button type="button" onClick={startInteractionReplay}>
                    인터랙션 분석 보기
                  </button>
                  <button type="button" onClick={retakeSnapshot}>
                    다시 촬영하기
                  </button>
                </div>
              </div>
            ) : null}

            {showReplayPanel ? (
              <div className="analysis-card analysis-card-replay" aria-live="polite">
                <span className="analysis-kicker">Interaction Replay</span>
                <h2>손 이동 분석</h2>
                <p>밝은 영역은 손동작이 집중된 위치이고, 연한 선은 퍼즐 조작 경로를 나타냅니다.</p>
                {experienceState.heatmapReplayMode === "finished" ? (
                  <div className="analysis-actions">
                    <button type="button" onClick={startInteractionReplay}>
                      다시 보기
                    </button>
                    <button type="button" onClick={retakeSnapshot}>
                      다시 촬영하기
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="floating-controls" aria-label="데모 컨트롤">
            <button type="button" onClick={stopCamera} disabled={status.phase !== "running"}>
              정지
            </button>
            <button type="button" onClick={restartPuzzle} disabled={status.phase !== "running"}>
              퍼즐 재시작
            </button>
            <button type="button" onClick={retakeSnapshot} disabled={status.phase !== "running"}>
              다시 캡처
            </button>
          </div>
        </div>

        {status.phase === "error" ? (
          <div className="error-toast">
            카메라 접근이 차단되었습니다. 브라우저 권한을 허용한 뒤 다시 시작하세요.
          </div>
        ) : null}
      </section>
    </main>
  );
}

function readStoredTheme(): ThemeMode {
  const stored = window.localStorage.getItem("spatial-gesture-theme");
  return stored === "light" || stored === "dark" ? stored : "light";
}
