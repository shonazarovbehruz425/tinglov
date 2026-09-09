import os
import cv2
import numpy as np

# Check subtitle bar region for each frame 0 to 57
# The subtitle banner is in the bottom area: y from 560 to 670, x from 200 to 1080

frames = sorted([f for f in os.listdir("cartoons") if f.startswith("sec_") and f.endswith(".jpg")])

print(f"Total second frames: {len(frames)}")

# Save cropped subtitle strip for all frames
os.makedirs("cartoons/subtitles", exist_ok=True)
for f in frames:
    img = cv2.imread(os.path.join("cartoons", f))
    if img is not None:
        sub_crop = img[560:670, 150:1130]
        cv2.imwrite(os.path.join("cartoons/subtitles", f), sub_crop)

print("Saved cropped subtitle images to cartoons/subtitles/")
