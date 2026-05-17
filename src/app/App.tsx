import { useEffect, useRef, useState } from "react";
import { HandTrackingController, type ExperienceState, type RuntimeStatus } from "./HandTrackingController";
import { getInteractionInstruction } from "./instructionText";
import type { ThemeMode } from "../theme/themeTypes";

type UnifiedTopBarProps = {
  status: RuntimeStatus;
  experienceState: ExperienceState;
  debugEnabled: boolean;
  soundMuted: boolean;
  themeMode: ThemeMode;
  onStart: () => void;
  onToggleDebug: () => void;
  onToggleSound: () => void;
  onToggleTheme: () => void;
};

function UnifiedTopBar({
  status,
  experienceState,
  debugEnabled,
  soundMuted,
  themeMode,
  onStart,
  onToggleDebug,
  onToggleSound,
  onToggleTheme
}: UnifiedTopBarProps) {
  const instruction = getInteractionInstruction(status, experienceState);

  return (
    <header className="top-bar">
      <div className="brand-block">
        <img
          className="brand-mark"
          src="/favicon/favicon-32x32.png"
          alt=""
          width="32"
          height="32"
          aria-hidden="true"
        />
        <div className="brand-copy">
          <span className="eyebrow">Computer Vision · HCI Demo</span>
          <strong>Tomato Gesture Puzzle</strong>
        </div>
      </div>

      <div className="top-guide" aria-live="polite">
        <h2>{instruction.title}</h2>
        <p>{instruction.instruction}</p>
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
        <button
          type="button"
          className={soundMuted ? "compact-action" : "compact-action is-active"}
          onClick={onToggleSound}
          aria-pressed={!soundMuted}
        >
          {soundMuted ? "Sound Off" : "Sound On"}
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
    puzzleTransitionPhase: null,
    boxMode: null,
    capturePhase: null,
    captureReady: false,
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
  const [soundMuted, setSoundMuted] = useState(() => readStoredSoundMuted());
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
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("tomato-gesture-theme", themeMode);
    controllerRef.current?.setThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem("tomato-gesture-sound-muted", soundMuted ? "true" : "false");
    controllerRef.current?.setSoundMuted(soundMuted);
  }, [soundMuted]);

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

  const toggleSound = () => {
    setSoundMuted((current) => !current);
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
            experienceState={experienceState}
            debugEnabled={debugEnabled}
            soundMuted={soundMuted}
            themeMode={themeMode}
            onStart={startCamera}
            onToggleDebug={toggleDebug}
            onToggleSound={toggleSound}
            onToggleTheme={toggleTheme}
          />

          <div className="center-layer">
            {showStartCard ? (
              <div className="start-card" aria-live="polite">
                <span className="start-card-icon" aria-hidden="true">
                  <img src="/favicon/favicon-32x32.png" alt="" width="40" height="40" />
                </span>
                <h1>Hand Gesture Interaction Demo</h1>
                <p>{getInteractionInstruction(status, experienceState).instruction}</p>
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
  const stored =
    window.localStorage.getItem("tomato-gesture-theme") ??
    window.localStorage.getItem("spatial-gesture-theme");
  return stored === "light" || stored === "dark" ? stored : "light";
}

function readStoredSoundMuted() {
  return (
    window.localStorage.getItem("tomato-gesture-sound-muted") ??
    window.localStorage.getItem("spatial-gesture-sound-muted")
  ) === "true";
}
