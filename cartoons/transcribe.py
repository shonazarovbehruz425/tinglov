from faster_whisper import WhisperModel
import json

print("Loading Whisper model (tiny.en or base.en)...")
model = WhisperModel("base.en", device="cpu", compute_type="int8")

print("Transcribing cartoons/audio.wav...")
segments, info = model.transcribe("cartoons/audio.wav", beam_size=5, word_timestamps=True)

results = []
for segment in segments:
    print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
    results.append({
        "start": segment.start,
        "end": segment.end,
        "text": segment.text.strip(),
        "words": [{"word": w.word, "start": w.start, "end": w.end} for w in segment.words] if segment.words else []
    })

with open("cartoons/transcription.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("Transcription saved to cartoons/transcription.json")
