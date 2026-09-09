import cv2
import os
import numpy as np

frames = sorted([f for f in os.listdir("cartoons") if f.startswith("sec_") and f.endswith(".jpg")])

sub_text_diffs = []
for i in range(len(frames)):
    img = cv2.imread(os.path.join("cartoons", frames[i]))
    # Subtitle region: y from 590 to 660, yellow/white text on dark band
    sub_crop = img[590:660, 200:1080]
    gray = cv2.cvtColor(sub_crop, cv2.COLOR_BGR2GRAY)
    # text is bright yellow / white with black stroke
    mask = cv2.inRange(sub_crop, np.array([0, 140, 180]), np.array([120, 255, 255]))
    has_sub = np.sum(mask > 0) > 100
    sec = int(frames[i].replace("sec_", "").replace(".jpg", "")) - 1
    sub_text_diffs.append((sec, has_sub, np.sum(mask > 0)))

print("--- SUBTITLE VISIBILITY PER SECOND ---")
for sec, has_sub, count in sub_text_diffs:
    print(f"Sec {sec:02d}: {'[SUBTITLE ACTIVE]' if has_sub else '                  '} (pixels: {count})")
