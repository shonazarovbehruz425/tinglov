import wave
import struct
import math

with wave.open("cartoons/audio.wav", "rb") as wf:
    framerate = wf.getframerate()
    nframes = wf.getnframes()
    nchannels = wf.getnchannels()
    sampwidth = wf.getsampwidth()
    raw_data = wf.readframes(nframes)

duration = nframes / framerate
print(f"Audio duration: {duration:.2f}s, rate: {framerate}, width: {sampwidth}")

# calculate RMS energy every 0.1s
chunk_size = int(framerate * 0.1)
fmt = f"<{chunk_size}h"

energies = []
for i in range(0, len(raw_data) - chunk_size * 2, chunk_size * 2):
    chunk = raw_data[i:i + chunk_size * 2]
    shorts = struct.unpack(f"<{len(chunk)//2}h", chunk)
    rms = math.sqrt(sum(s**2 for s in shorts) / len(shorts))
    time_sec = (i / 2) / framerate
    energies.append((time_sec, rms))

# Print speech segments with energy > threshold
in_speech = False
seg_start = 0
segments = []
threshold = 800

for t, rms in energies:
    if rms > threshold and not in_speech:
        in_speech = True
        seg_start = t
    elif rms <= threshold and in_speech:
        in_speech = False
        if t - seg_start > 0.4:
            segments.append((round(seg_start, 2), round(t, 2)))

print("\n--- DETECTED SPEECH ENERGY SEGMENTS ---")
for s, e in segments:
    print(f"Segment: {s}s -> {e}s (duration: {round(e-s, 2)}s)")
