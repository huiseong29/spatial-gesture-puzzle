export async function createCameraStream() {
  return navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 960, max: 960 },
      height: { ideal: 540, max: 540 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: "user"
    },
    audio: false
  });
}

export function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
