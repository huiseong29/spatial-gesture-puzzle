import type { TrackingFrame } from "../tracking/handTypes";

export type SoundEvent =
  | "pinch-start"
  | "capture"
  | "piece-grab"
  | "shuffle"
  | "snap-success"
  | "piece-lock"
  | "completion"
  | "snap-preview";

type SoundPreset = {
  volume: number;
  cooldownMs: number;
  notes: Array<{
    frequency: number;
    durationMs: number;
    delayMs?: number;
    type?: OscillatorType;
    detune?: number;
  }>;
};

const sfxVolume = 0.34;

const soundPresets: Record<SoundEvent, SoundPreset> = {
  "pinch-start": {
    volume: 0.18,
    cooldownMs: 70,
    notes: [{ frequency: 740, durationMs: 46, type: "triangle" }]
  },
  capture: {
    volume: 0.3,
    cooldownMs: 450,
    notes: [
      { frequency: 220, durationMs: 90, type: "sine" },
      { frequency: 520, durationMs: 120, delayMs: 24, type: "triangle" }
    ]
  },
  "piece-grab": {
    volume: 0.2,
    cooldownMs: 100,
    notes: [{ frequency: 430, durationMs: 70, type: "triangle" }]
  },
  shuffle: {
    volume: 0.34,
    cooldownMs: 900,
    notes: [
      { frequency: 230, durationMs: 86, type: "triangle" },
      { frequency: 290, durationMs: 92, delayMs: 74, type: "triangle", detune: -8 },
      { frequency: 255, durationMs: 104, delayMs: 154, type: "triangle", detune: 6 },
      { frequency: 340, durationMs: 130, delayMs: 244, type: "sine" }
    ]
  },
  "snap-success": {
    volume: 0.24,
    cooldownMs: 120,
    notes: [
      { frequency: 360, durationMs: 70, type: "sine" },
      { frequency: 540, durationMs: 80, delayMs: 34, type: "triangle" }
    ]
  },
  "piece-lock": {
    volume: 0.2,
    cooldownMs: 120,
    notes: [{ frequency: 620, durationMs: 76, type: "triangle" }]
  },
  completion: {
    volume: 0.3,
    cooldownMs: 1200,
    notes: [
      { frequency: 392, durationMs: 120, type: "sine" },
      { frequency: 523.25, durationMs: 150, delayMs: 96, type: "sine" },
      { frequency: 659.25, durationMs: 190, delayMs: 196, type: "triangle" }
    ]
  },
  "snap-preview": {
    volume: 0.075,
    cooldownMs: 260,
    notes: [{ frequency: 510, durationMs: 110, type: "sine" }]
  }
};

export class InteractionSoundManager {
  private audioContext: AudioContext | null = null;
  private muted = false;
  private unlocked = false;
  private readonly lastPlayedAt = new Map<SoundEvent, number>();
  private previousCaptureAt = 0;
  private previousSelectedPieceId: string | null = null;
  private previousSnapAt = 0;
  private previousCompletedAt = 0;
  private previousPinchStartKey = "";
  private previousSnapPreviewKey = "";
  private previousPuzzleTransitionPhase = "";

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted() {
    return this.muted;
  }

  async unlock() {
    if (this.unlocked || this.muted) {
      return;
    }

    const context = this.getAudioContext();
    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      await context.resume();
    }

    this.unlocked = true;
  }

  update(frame: TrackingFrame | null) {
    if (!frame || this.muted) {
      return;
    }

    this.playPinchStarts(frame);
    this.playCapture(frame);
    this.playPuzzleEvents(frame);
  }

  reset() {
    this.previousCaptureAt = 0;
    this.previousSelectedPieceId = null;
    this.previousSnapAt = 0;
    this.previousCompletedAt = 0;
    this.previousPinchStartKey = "";
    this.previousSnapPreviewKey = "";
    this.previousPuzzleTransitionPhase = "";
  }

  dispose() {
    this.reset();
    this.lastPlayedAt.clear();

    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close();
    }

    this.audioContext = null;
    this.unlocked = false;
  }

  private playPinchStarts(frame: TrackingFrame) {
    const started = [...frame.pinchGestures.values()]
      .filter((gesture) => gesture.startedThisFrame)
      .map((gesture) => `${gesture.handId}:${Math.round(gesture.lastUpdatedAt)}`)
      .sort();
    const key = started.join("|");

    if (key && key !== this.previousPinchStartKey) {
      this.play("pinch-start");
    }

    this.previousPinchStartKey = key;
  }

  private playCapture(frame: TrackingFrame) {
    const capturedAt = frame.capture?.lastCapturedAt ?? 0;
    if (capturedAt > 0 && capturedAt !== this.previousCaptureAt) {
      this.play("capture");
    }
    this.previousCaptureAt = capturedAt;
  }

  private playPuzzleEvents(frame: TrackingFrame) {
    const puzzle = frame.puzzle;
    if (!puzzle) {
      this.previousSelectedPieceId = null;
      this.previousSnapPreviewKey = "";
      this.previousPuzzleTransitionPhase = "";
      return;
    }

    const transitionPhase = puzzle.transition?.phase ?? "";
    if (transitionPhase === "shuffling" && this.previousPuzzleTransitionPhase !== "shuffling") {
      this.play("shuffle");
    }
    this.previousPuzzleTransitionPhase = transitionPhase;

    const selectedPieceId = puzzle.interaction.selectedPieceId;
    if (selectedPieceId && selectedPieceId !== this.previousSelectedPieceId) {
      this.play("piece-grab");
    }
    this.previousSelectedPieceId = selectedPieceId;

    const snapAt = puzzle.interaction.lastSnapAt;
    if (snapAt > 0 && snapAt !== this.previousSnapAt) {
      this.play("snap-success");
      if (puzzle.interaction.lastSnapPieceId) {
        this.play("piece-lock");
      }
    }
    this.previousSnapAt = snapAt;

    const completedAt = puzzle.interaction.completedAt;
    if (completedAt > 0 && completedAt !== this.previousCompletedAt) {
      this.play("completion");
    }
    this.previousCompletedAt = completedAt;

    const preview = puzzle.interaction.snapPreview;
    const previewKey =
      preview && preview.isCorrect && preview.strength > 0.55
        ? `${selectedPieceId}:${preview.cellIndex}`
        : "";
    if (previewKey && previewKey !== this.previousSnapPreviewKey) {
      this.play("snap-preview");
    }
    this.previousSnapPreviewKey = previewKey;
  }

  private play(event: SoundEvent) {
    if (this.muted || !this.unlocked) {
      return;
    }

    const preset = soundPresets[event];
    const now = performance.now();
    const lastPlayedAt = this.lastPlayedAt.get(event) ?? 0;
    if (now - lastPlayedAt < preset.cooldownMs) {
      return;
    }

    const context = this.getAudioContext();
    if (!context) {
      return;
    }

    this.lastPlayedAt.set(event, now);
    for (const note of preset.notes) {
      this.playNote(context, note, preset.volume);
    }
  }

  private playNote(
    context: AudioContext,
    note: SoundPreset["notes"][number],
    presetVolume: number
  ) {
    const startTime = context.currentTime + (note.delayMs ?? 0) / 1000;
    const duration = note.durationMs / 1000;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = note.type ?? "sine";
    oscillator.frequency.setValueAtTime(note.frequency, startTime);
    oscillator.detune.setValueAtTime(note.detune ?? 0, startTime);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, startTime);
    filter.Q.setValueAtTime(0.45, startTime);

    const peak = presetVolume * sfxVolume;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }

  private getAudioContext() {
    if (typeof window === "undefined") {
      return null;
    }

    if (!this.audioContext) {
      const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextConstructor) {
        return null;
      }
      this.audioContext = new AudioContextConstructor();
    }

    return this.audioContext;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
