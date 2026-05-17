"""
귀여운 카지노 스타일 BGM - 15초 루프 버전
- 8마디 = 32박 = 15초 (BPM 128)
- 멜로디가 처음부터 끝까지 꽉 차게
"""
import numpy as np
from pathlib import Path
import wave

SR = 44100
BPM = 128
BEAT = 60 / BPM

def nf(name):
    if name is None:
        return 0
    notes = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,
             'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
    pitch = name[:-1]
    octave = int(name[-1])
    n = notes[pitch] + (octave - 4) * 12 - 9
    return 440 * 2 ** (n / 12)

# ── 악기들 ───────────────────────────────────────────
def bell(freq, dur, vol=0.18):
    t = np.linspace(0, dur, int(SR * dur), False)
    if freq == 0:
        return np.zeros_like(t)
    wave = (np.sin(2 * np.pi * freq * t) * 1.0 +
            np.sin(2 * np.pi * freq * 2 * t) * 0.3 +
            np.sin(2 * np.pi * freq * 3 * t) * 0.1)
    wave *= np.exp(-4 * t) * vol
    return wave

def pluck(freq, dur, vol=0.28):
    t = np.linspace(0, dur, int(SR * dur), False)
    if freq == 0:
        return np.zeros_like(t)
    saw = 2 * ((freq * t) % 1) - 1
    sine = np.sin(2 * np.pi * freq * t)
    wave = (sine * 0.85 + saw * 0.15) * vol
    env = np.exp(-4 * t) * (1 - np.exp(-200 * t))
    return wave * env

def bass(freq, dur, vol=0.32):
    t = np.linspace(0, dur, int(SR * dur), False)
    if freq == 0:
        return np.zeros_like(t)
    wave = np.sin(2 * np.pi * freq * t) * 0.8
    wave += np.sin(2 * np.pi * freq * 2 * t) * 0.2
    wave *= vol
    env = np.ones(len(wave))
    a = max(1, int(0.005 * SR))
    r = max(1, int(0.06 * SR))
    if a + r < len(env):
        env[:a] = np.linspace(0, 1, a)
        env[-r:] = np.linspace(1, 0, r)
    return wave * env

def kick(dur=0.15, vol=0.45):
    t = np.linspace(0, dur, int(SR * dur), False)
    freq = 90 * np.exp(-25 * t) + 50
    return np.sin(2 * np.pi * freq * t) * np.exp(-12 * t) * vol

def snare(dur=0.1, vol=0.18):
    n = int(SR * dur)
    t = np.linspace(0, dur, n, False)
    noise = (np.random.rand(n) * 2 - 1) * 0.7
    tone = np.sin(2 * np.pi * 200 * t) * 0.3
    return (noise + tone) * np.exp(-25 * t) * vol

def hat(dur=0.06, vol=0.08):
    n = int(SR * dur)
    t = np.linspace(0, dur, n, False)
    return (np.random.rand(n) * 2 - 1) * np.exp(-60 * t) * vol

def build(events, total_samples):
    track = np.zeros(total_samples)
    for start_beat, fn, args in events:
        sample = fn(*args)
        s = int(round(start_beat * BEAT * SR))
        e = s + len(sample)
        if s >= total_samples:
            continue
        if e > total_samples:
            sample = sample[:total_samples - s]
            e = total_samples
        track[s:e] += sample
    return track

def swing(pos):
    frac = pos - int(pos)
    if abs(frac - 0.5) < 0.01:
        return int(pos) + 0.58
    return pos

# ── 8마디 = 32박 ─────────────────────────────────────
total_beats = 32
total_samples = int(round(total_beats * BEAT * SR))
total_dur = total_samples / SR

# 멜로디: 8마디 꽉 채우기. 빈 박이 없도록 모든 마디에 노트 배치
# C - Am - F - G - C - Am - F - G
melody = [
    # 마디 1 (C)
    (0,    'E5', 0.5), (0.5,  'G5', 0.5), (1,    'C6', 1),
    (2,    'A5', 0.5), (2.5,  'G5', 0.5), (3,    'E5', 1),
    # 마디 2 (Am)
    (4,    'C5', 0.5), (4.5,  'E5', 0.5), (5,    'A5', 1),
    (6,    'G5', 0.5), (6.5,  'E5', 0.5), (7,    'C5', 1),
    # 마디 3 (F)
    (8,    'F5', 0.5), (8.5,  'A5', 0.5), (9,    'C6', 1),
    (10,   'A5', 0.5), (10.5, 'G5', 0.5), (11,   'F5', 1),
    # 마디 4 (G)
    (12,   'G5', 0.5), (12.5, 'B5', 0.5), (13,   'D6', 1),
    (14,   'B5', 0.5), (14.5, 'A5', 0.5), (15,   'G5', 1),
    # 마디 5 (C) - 살짝 변주, 더 통통
    (16,   'C6', 0.5), (16.5, 'E6', 0.5), (17,   'G6', 0.5), (17.5, 'E6', 0.5),
    (18,   'D6', 0.5), (18.5, 'C6', 0.5), (19,   'G5', 0.5), (19.5, 'E5', 0.5),
    # 마디 6 (Am)
    (20,   'A5', 0.5), (20.5, 'C6', 0.5), (21,   'E6', 0.5), (21.5, 'C6', 0.5),
    (22,   'B5', 0.5), (22.5, 'A5', 0.5), (23,   'G5', 1),
    # 마디 7 (F)
    (24,   'F5', 0.5), (24.5, 'A5', 0.5), (25,   'C6', 0.5), (25.5, 'A5', 0.5),
    (26,   'G5', 0.5), (26.5, 'F5', 0.5), (27,   'E5', 1),
    # 마디 8 (G) - 종지: 다음 루프 C로 자연스럽게
    (28,   'D5', 0.5), (28.5, 'F5', 0.5), (29,   'G5', 0.5), (29.5, 'B5', 0.5),
    (30,   'D6', 0.5), (30.5, 'B5', 0.5), (31,   'G5', 0.5),
    # 박 31.5는 의도적으로 비워서 다음 루프 첫 박과 겹치지 않게
]

# 벨: 8마디 중 2번만 부드럽게
bell_line = [
    (1.5,  'C6', 0.5),
    (17.5, 'E6', 0.5),
]

# 베이스: 8마디 워킹
bass_line = [
    (0,'C3',1),(1,'E3',1),(2,'G3',1),(3,'E3',1),         # C
    (4,'A2',1),(5,'C3',1),(6,'E3',1),(7,'C3',1),         # Am
    (8,'F2',1),(9,'A2',1),(10,'C3',1),(11,'A2',1),       # F
    (12,'G2',1),(13,'B2',1),(14,'D3',1),(15,'G2',1),     # G
    (16,'C3',1),(17,'E3',1),(18,'G3',1),(19,'E3',1),     # C
    (20,'A2',1),(21,'C3',1),(22,'E3',1),(23,'C3',1),     # Am
    (24,'F2',1),(25,'A2',1),(26,'C3',1),(27,'A2',1),     # F
    (28,'G2',1),(29,'D3',1),(30,'G2',1),(31,'G2',1),     # G → 루프 시작 C로 해결
]

events = []
for pos, note, length in melody:
    events.append((swing(pos), pluck, (nf(note), length * BEAT * 1.05, 0.30)))

for pos, note, length in bell_line:
    events.append((pos, bell, (nf(note), length * BEAT * 3, 0.18)))

for pos, note, length in bass_line:
    events.append((pos, bass, (nf(note), length * BEAT * 0.95, 0.32)))

# 드럼
for beat in range(total_beats):
    if beat % 4 in (0, 2):
        events.append((beat, kick, ()))
    if beat % 4 in (1, 3):
        events.append((beat, snare, ()))
    events.append((beat, hat, ()))
    if beat < total_beats - 0.5:
        events.append((beat + 0.5, hat, (0.05, 0.06)))

track = build(events, total_samples)

# 루프 경계 마이크로 페이드
fade_n = int(0.002 * SR)
track[:fade_n] *= np.linspace(0, 1, fade_n)
track[-fade_n:] *= np.linspace(1, 0, fade_n)

peak = np.max(np.abs(track))
if peak > 0:
    track = track / peak * 0.88

audio = (track * 32767).astype(np.int16)
output_path = Path(__file__).resolve().parent / "public" / "sounds" / "bgm_tomato_ambient_loop.wav"
output_path.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(output_path), "wb") as wav_file:
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(SR)
    wav_file.writeframes(audio.tobytes())

print(f"루프 길이: {total_dur:.3f}초 ({total_samples} 샘플)")
print(f"BPM: {BPM} / 8마디 / 멜로디 끊김 없음")
print(f"Output: {output_path}")
