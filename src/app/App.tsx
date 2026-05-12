import { useEffect, useRef, useState } from "react";
import { HandTrackingController, type RuntimeStatus } from "./HandTrackingController";

export function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<HandTrackingController | null>(null);
  const [status, setStatus] = useState<RuntimeStatus>({
    phase: "idle",
    message: "Press Start Camera"
  });

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

  return (
    <main className="app-shell">
      <section className="stage" aria-label="Hand tracking stage">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={canvasRef} className="tracking-canvas" />
      </section>

      <aside className="status-panel">
        <h1>Hand Tracking Skeleton</h1>
        <dl>
          <div>
            <dt>Phase</dt>
            <dd>{status.phase}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{status.message}</dd>
          </div>
        </dl>
        <div className="controls">
          <button type="button" onClick={startCamera} disabled={status.phase === "running"}>
            Start Camera
          </button>
          <button type="button" onClick={stopCamera} disabled={status.phase !== "running"}>
            Stop
          </button>
        </div>
        {status.phase === "error" ? (
          <p className="hint">
            If the browser already denied camera access, reset the site camera permission and press Start Camera
            again.
          </p>
        ) : null}
      </aside>
    </main>
  );
}
