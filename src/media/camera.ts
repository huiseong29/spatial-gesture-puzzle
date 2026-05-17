export async function createCameraStream() {
  return navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640, max: 960 },
      height: { ideal: 480, max: 540 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: "user"
    },
    audio: false
  });
}

export function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
