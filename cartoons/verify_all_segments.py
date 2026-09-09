import speech_recognition as sr

r = sr.Recognizer()

time_slices = [
    (0, 7.5, "Intro / Opening"),
    (7.5, 13.0, "Segment 1"),
    (13.0, 16.5, "Segment 2"),
    (16.5, 21.5, "Segment 3"),
    (21.5, 25.5, "Segment 4"),
    (25.5, 30.0, "Segment 5"),
    (30.0, 36.5, "Segment 6"),
    (36.5, 45.0, "Segment 7"),
    (45.0, 52.0, "Segment 8"),
    (52.0, 57.5, "Segment 9")
]

with sr.AudioFile("cartoons/audio.wav") as source:
    for s, e, name in time_slices:
        source_chunk = sr.AudioFile("cartoons/audio.wav")
        with source_chunk as src:
            r.record(src, duration=s)
            chunk = r.record(src, duration=(e - s))
            try:
                text = r.recognize_google(chunk)
                print(f"[{s:.1f}s -> {e:.1f}s] ({name}): \"{text}\"")
            except Exception as ex:
                print(f"[{s:.1f}s -> {e:.1f}s] ({name}): <No speech or music>")
