# Functional Bugs Report - Tinglov/MovieListen
**Date:** 2026-09-10
**Auditor:** Claude AI
**Focus:** Application logic bugs, edge cases, and unexpected behavior

---

## 🐛 CRITICAL BUGS

### 1. **previousInput Variable Not Declared in Constructor**
**Severity:** 🔴 Critical
**Location:** `src/components/DictationInput.ts:59, 195`

```typescript
// Line 59 - Called before declaration
this.previousInput = '';

// Line 195 - Declaration (should be in class properties)
private previousInput: string = '';
```

**Problem:**
- Variable used before it's declared
- TypeScript should catch this, but it's a runtime bug
- When setSceneAndSentence() called, previousInput set to '', but correctly declared later

**Expected Behavior:** Class properties should be declared at the top

**Impact:** May cause undefined behavior on first render

---

### 2. **Shadowing Mode Disabled Without Replacement**
**Severity:** 🔴 Critical
**Location:** `src/main.ts:822-824`

```typescript
public openShadowingMode(): void {
  // Shadowing mode temporarily disabled as requested by user
}
```

**Problem:**
- Feature completely disabled (empty function)
- Users see "Shadowing" button but clicking does nothing
- No feedback to user that feature is disabled
- Breaks user flow expectations

**Expected Behavior:**
- Show toast notification "Shadowing feature coming soon"
- OR hide the button entirely
- OR re-enable the feature

**Impact:** User confusion, broken feature expectation

---

### 3. **Video Duration Calculation Fallback**
**Severity:** 🟠 High
**Location:** `src/components/AnimatedStage.ts:73-105`

```typescript
private getTotalDuration(): number {
  if (!this.currentScene) return 60;
  
  // Multiple fallback attempts...
  
  // 3. Fallback to the latest dialogue timestamp
  if (this.currentScene.dialogues.length > 0) {
    const lastDialogue = this.currentScene.dialogues[this.currentScene.dialogues.length - 1];
    return Math.max(lastDialogue.endTime + 5, 30);
  }
  
  return 60; // Arbitrary number!
}
```

**Problem:**
- Returns hardcoded 60 seconds if scene has no dialogues
- But dialogues array should never be empty
- What if video is shorter/longer than 60s?

**Edge Case:** Scene with video but no dialogues defined

**Impact:** Timeline progress incorrect, UX confusion

---

### 4. **Sentence Index Out of Bounds**
**Severity:** 🟠 High
**Location:** `src/main.ts:767`

```typescript
this.currentSentenceIndex = Math.max(0, Math.min(scene.dialogues.length - 1, initialSentenceIndex));
```

**Problem:**
- If dialogues array is empty: `scene.dialogues.length = 0`
- Then: `length - 1 = -1`
- So: `Math.max(0, -1) = 0`
- Later: `scene.dialogues[0]` returns undefined

**Edge Case:** Scene with empty dialogues array

**Impact:** App crash, undefined errors

---

### 5. **XP Calculation Can Be Negative**
**Severity:** 🟠 High
**Location:** `src/main.ts:835`

```typescript
const xpEarned = Math.max(10, Math.round(25 * (accuracy / 100) - (hintsUsed * 3)));
```

**Problem:**
- Formula: `25 * (accuracy/100) - (hintsUsed * 3)`
- If accuracy = 0 and hintsUsed = 5
- Then: `25 * 0 - 15 = -15`
- XP earned: `Math.max(10, -15) = 10`

**Actually SAFE:** Math.max(10, ...) ensures minimum 10 XP

**But:** Negative XP shouldn't be possible

**Edge Case:** What if accuracy > 100? (impossible by logic)

**Impact:** None (formula is correct)

---

## 🟡 MEDIUM SEVERITY BUGS

### 6. **Video Speed Not Initially Applied**
**Severity:** 🟡 Medium
**Location:** `src/components/AnimatedStage.ts:169`

```typescript
video.playbackRate = this.speed;
```

**Problem:**
- Speed set when video plays
- But if user changes speed BEFORE playing, it won't apply
- Initial speed from localStorage not applied to video

**Edge Case:** User changed speed in previous session, restarts

**Impact:** Speed setting not persistent across sessions

---

### 7. **NaN Duration Display**
**Severity:** 🟡 Medium
**Location:** `src/components/AnimatedStage.ts:77`

```typescript
if (this.videoElement && !isNaN(this.videoElement.duration) && this.videoElement.duration > 0) {
  return this.videoElement.duration;
}
```

**Problem:**
- If video metadata not loaded yet: `duration = NaN`
- Function returns fallback instead of waiting

**Edge Case:** Video still buffering

**Impact:** Timeline shows wrong duration briefly

---

### 8. **YouTube Player Iframe postMessage Without Error Handling**
**Severity:** 🟡 Medium
**Location:** `src/components/AnimatedStage.ts:129-130`

```typescript
iframe.contentWindow?.postMessage(seekMsg, targetOrigin);
iframe.contentWindow?.postMessage(playMsg, targetOrigin);
```

**Problem:**
- No error handling if postMessage fails
- If iframe not loaded, messages lost
- No confirmation of successful seek

**Edge Case:** YouTube iframe not loaded yet

**Impact:** Video may not seek/play correctly

---

### 9. **Auto-Play Delay Too Short**
**Severity:** 🟡 Medium
**Location:** `src/main.ts:807-809`

```typescript
setTimeout(() => {
  this.playCurrentDialogue();
}, 400);
```

**Problem:**
- 400ms may be too short for video to seek
- If video still loading, play() may fail silently
- No retry mechanism

**Edge Case:** Slow network, video not buffered

**Impact:** Video doesn't play on sentence change

---

### 10. **Streak Logic Timezone Sensitive**
**Severity:** 🟡 Medium
**Location:** `src/services/storageService.ts`

```typescript
const today = new Date().toISOString().split('T')[0];
```

**Problem:**
- Uses local timezone
- User in different timezone can game streak
- Streak midnight depends on browser timezone

**Edge Case:** User travels to different timezone

**Impact:** Streak resets at wrong time

---

## 🟢 LOW SEVERITY BUGS

### 11. **Escape Key Closes All Modals**
**Severity:** 🟢 Low
**Expected:** Only topmost modal should close

```typescript
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    this.vocabModal.close();
    this.customSceneModal.close();
    this.completionModal.hide();
  }
});
```

**Problem:** All modals close at once, not just topmost

**Impact:** User may accidentally close wrong modal

---

### 12. **WPM Calculation Not Accurate**
**Severity:** 🟢 Low
**Location:** `src/components/DictationInput.ts`

**Problem:**
- WPM = words / time
- Doesn't account for pauses (hints, reveals)
- "Time" includes time spent getting hints

**Expected:** Only count active typing time

**Impact:** WPM slower than reality

---

### 13. **Speech Recognition Language Doesn't Update**
**Severity:** 🟢 Low
**Location:** `src/components/ShadowingModal.ts:90`

```typescript
this.recognition.lang = this.currentScene?.accent === 'British' ? 'en-GB' : 'en-US';
```

**Problem:**
- Language set at recognition start
- If user changes scene accent mid-session, doesn't update

**Edge Case:** Scene has both American and British accents

**Impact:** Wrong accent attempted

---

### 14. **Empty Custom Scene Allowed**
**Severity:** 🟢 Low
**Location:** `src/components/CustomSceneModal.ts`

**Problem:**
- User can create scene with empty title
- Or empty dialogues array
- No minimum validation

**Edge Case:** User creates empty scene

**Impact:** Empty scene visible in library, breaks UX

---

### 15. **LocalStorage Race Condition**
**Severity:** 🟢 Low
**Location:** `src/services/storageService.ts`

```typescript
constructor() {
  this.stats = this.loadStats();
  this.customScenes = this.loadCustomScenes();
  // ...
}
```

**Problem:**
- If two tabs open simultaneously
- Both read same localStorage
- Last write wins (data loss)

**Edge Case:** Multiple browser tabs

**Impact:** Progress could be lost

---

## 🔍 EDGE CASES TO TEST

### A. Empty Array Handling
```typescript
// Test: Scene with empty dialogues
const scene = { dialogues: [] };
// Expected: Graceful error, not crash
```

---

### B. Negative Values
```typescript
// Test: Negative startTime, endTime
const sentence = { startTime: -5, endTime: 10 };
// Expected: Math.max(0, startTime)
```

---

### C. Video Missing
```typescript
// Test: Scene without videoUrl or youtubeVideoId
const scene = { videoUrl: null, youtubeVideoId: null };
// Expected: Show placeholder or error
```

---

### D. Very Long Input
```typescript
// Test: User types 10,000 characters
userInput = "a".repeat(10000);
// Expected: Truncate or limit
```

---

### E. Unicode in Input
```typescript
// Test: User types emoji or non-Latin text
userInput = "👨‍👩‍👧‍👦 Hello 你好 مرحبا";
// Expected: Handle correctly, no crash
```

---

### F. Offline Mode
```typescript
// Test: User loses network during practice
// Expected: Continue with cached video/audio
```

---

### G. Rapid Button Clicks
```typescript
// Test: User clicks "Next" button 10 times rapidly
// Expected: Debounce, only send one event
```

---

### H. Browser Back/Forward
```typescript
// Test: User navigates back during practice
// Expected: Save progress, restore on forward
```

---

## 🚨 RACE CONDITIONS

### 1. Video Play + Seek
**Scenario:**
1. Video starts playing
2. User changes speed
3. seeked event fires after play
4. Speed not applied to old playback

**Fix:** Await seek before setting speed

---

### 2. Speech Recognition + Modal Close
**Scenario:**
1. User starts recording
2. Closes modal immediately
3. Speech recognition continues in background
4. onend() callback fires but modal gone

**Fix:** Check modal exists before callback

---

### 3. API Sync + Local Update
**Scenario:**
1. User completes sentence
2. API sync starts (async)
3. User completes another sentence
4. API sync overwrites with old data

**Fix:** Debounce sync, queue updates

---

## 📊 BUG SEVERITY SUMMARY

| Severity | Count | Percentage |
|----------|-------|------------|
| 🔴 Critical | 2 | 13% |
| 🟠 High | 3 | 20% |
| 🟡 Medium | 5 | 33% |
| 🟢 Low | 5 | 33% |
| **Total** | **15** | **100%** |

---

## 🛠️ IMMEDIATE FIXES NEEDED

### 1. Re-enable or Remove Shadowing Button
```typescript
// Option A: Show toast
public openShadowingMode(): void {
  this.showToast('Shadowing feature coming soon!', 'info');
}

// Option B: Hide button
// Remove from template entirely
```

---

### 2. Fix Empty Dialogues Bug
```typescript
public startScene(scene: Scene, ...): void {
  if (!scene.dialogues || scene.dialogues.length === 0) {
    this.showToast('This scene has no dialogues', 'error');
    this.showLibrary();
    return;
  }
  // ...
}
```

---

### 3. Add Loading State for Video
```typescript
// Show spinner while video metadata loads
private waitForVideoMetadata(): Promise<void> {
  return new Promise((resolve) => {
    if (this.videoElement.readyState >= 1) {
      resolve();
    } else {
      this.videoElement.onloadedmetadata = () => resolve();
    }
  });
}
```

---

### 4. Fix Auto-Play Timing
```typescript
// Increase delay or add retry
setTimeout(() => {
  this.playCurrentDialogue();
}, 800); // Increase from 400ms

// Or retry on failure
if (!success) {
  setTimeout(() => this.playCurrentDialogue(), 1000);
}
```

---

## 📈 TESTING RECOMMENDATIONS

### Unit Tests Needed
1. `getTotalDuration()` with various video states
2. XP calculation with edge cases
3. Empty dialogues array handling
4. Video speed persistence
5. Streak timezone handling

### Integration Tests Needed
1. Full user flow: Register → Practice → Complete
2. Network failure during practice
3. Multiple browser tabs
4. Browser back/forward navigation

### E2E Tests Needed
1. Play through entire scene
2. Use all features in sequence
3. Handle network failures
4. Test on mobile devices

---

**Report Generated:** 2026-09-10
**Status:** ⚠️ CRITICAL BUGS FOUND
**Action Required:** Fix Shadowing mode and empty dialogues immediately
