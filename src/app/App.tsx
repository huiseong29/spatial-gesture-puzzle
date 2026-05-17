import { useEffect, useRef, useState } from "react";
import { HandTrackingController, type RuntimeStatus } from "./HandTrackingController";

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
      return "퍼즐을 다시 셔플했습니다";
    }

    if (status.message === "Ready for new capture") {
      return "새 캡처 영역을 지정하세요";
    }

    return "pinch gesture로 퍼즐 조각을 이동하세요";
  }

  if (status.phase === "error") {
    return "카메라 접근 권한을 확인하세요";
  }

  return "시스템을 준비 중입니다";
}

export function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<HandTrackingController | null>(null);
  const [status, setStatus] = useState<RuntimeStatus>({
    phase: "idle",
    message: "카메라를 시작하세요"
  });
  const [debugEnabled, setDebugEnabled] = useState(false);
  const showStartCard = status.phase !== "running";

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) {
      return;
    }

    const controller = new HandTrackingController({
      video: videoRef.current,
      canvas: canvasRef.current,
      onStatus: setStatus
    });

    controllerRef.current = controller;

    return () => {
      controller.stop();
      controllerRef.current = null;
    };
  }, []);

  const startCamera = () => {
    void controllerRef.current?.start();
  };

  const stopCamera = () => {
    controllerRef.current?.stop();
  };

  const restartPuzzle = () => {
    controllerRef.current?.restartPuzzle();
  };

  const retakeSnapshot = () => {
    controllerRef.current?.retakeSnapshot();
  };

  const toggleDebug = () => {
    const next = !debugEnabled;
    setDebugEnabled(next);
    controllerRef.current?.setDebugEnabled(next);
  };

  return (
    <main className="experience-shell">
      <section className="stage" aria-label="손 제스처 퍼즐 인터랙션 데모">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={canvasRef} className="tracking-canvas" />

        <div className="ui-layer">
          <header className="top-bar">
            <div className="brand-block">
              <span className="eyebrow">Computer Vision · HCI Demo</span>
              <strong>Spatial Gesture Puzzle</strong>
            </div>
            <p>MediaPipe Hands 기반 양손 pinch interaction으로 캡처 영역을 지정하고 퍼즐을 조작합니다.</p>
          </header>

          <div className="center-layer">
            {showStartCard ? (
              <div className="start-card" aria-live="polite">
                <span className="start-card-icon" aria-hidden="true">
                  CV
                </span>
                <h1>Hand Gesture Interaction Demo</h1>
                <p>{modeToKoreanInstruction(status)}</p>
                <button type="button" onClick={startCamera} disabled={status.phase === "camera-permission"}>
                  카메라 시작
                </button>
              </div>
            ) : null}
          </div>

          <aside className="status-chip" aria-live="polite">
            <span>Interaction Guide</span>
            <strong>{modeToKoreanInstruction(status)}</strong>
          </aside>

          <div className="floating-controls" aria-label="데모 컨트롤">
            <button type="button" onClick={startCamera} disabled={status.phase === "running"}>
              카메라 시작
            </button>
            <button type="button" onClick={stopCamera} disabled={status.phase !== "running"}>
              정지
            </button>
            <button type="button" onClick={restartPuzzle} disabled={status.phase !== "running"}>
              퍼즐 재시작
            </button>
            <button type="button" onClick={retakeSnapshot} disabled={status.phase !== "running"}>
              다시 캡처
            </button>
            <button type="button" onClick={toggleDebug} className={debugEnabled ? "is-active" : ""}>
              {debugEnabled ? "Debug 숨김" : "Debug"}
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
