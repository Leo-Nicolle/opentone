# Click wheel: vector-average angle

Parked 2026-10-27. Replaces `getWheelAngle()`'s "two strongest pads, linear blend"
with the vector average of all pad centres weighted by their deltas, the estimate
the click wheel designer (`docs/tools/clickwheel`) scores pad patterns with.

## Status

Tried on the current PCB: **very bumpy**, reverted. Keep it for the next wheel PCB,
whose pattern will be optimized for this estimate in the designer.

Likely reasons it's bumpy on the current board (to check, not confirmed):
- With 4 pads and a finger mostly on one or two of them, the angle from two adjacent
  pads is `atan2(b, a)`, not linear in `b / (a + b)`: the angle bunches up near each
  pad's centre unless the pattern spreads the finger over pads evenly. The current
  pads were tuned with the linear blend.
- `PAD_NOISE_FLOOR` (3 counts, subtracted from every pad) flattens the angle near
  each pad's centre, where the neighbours' deltas are small.
- Per-pad sensitivity differences show up directly as angle bias (the designer
  assumes equal pads).

## Before trying again

- Run the designer with the new board's size, overlay and copper cost, and build
  the pattern it picks.
- Log raw deltas (`getDelta()`) during a slow full turn, and replay both estimators
  offline on the log to compare their smoothness before flashing.
- Try `PAD_NOISE_FLOOR` at 0–1 and calibrated sensitivities.
- With the IQS7222A the angle is computed on the MCU anyway (its on-chip slider is
  linear, ≤ 4 elements, no wheel mode), so this code carries over.

## Patch

Apply from the repo root with `git apply plans/clickwheel-vector-angle.patch`
(same content as below).

```diff
diff --git a/software/src/ClickWheel.hpp b/software/src/ClickWheel.hpp
index 02902df..ad1018e 100644
--- a/software/src/ClickWheel.hpp
+++ b/software/src/ClickWheel.hpp
@@ -50,7 +50,7 @@ public:
   // getWheelAngle() (separate from the MPR121's own hardware touch
   // threshold, which is what touched()/getTouchedMask() reflects).
   static const int16_t TOUCH_THRESHOLD = 6;       // min dominant-pad delta to count as a wheel touch
-  static const int16_t SECOND_PAD_THRESHOLD = 3;  // min 2nd-pad delta to interpolate instead of snapping
+  static const int16_t PAD_NOISE_FLOOR = 3;       // subtracted from every pad's delta before averaging
 
   // Lifting the finger smears it across the pads and fakes a +/-1 click.
   // Scroll clicks are held this long before being emitted, and dropped if
@@ -164,62 +164,37 @@ public:
     }
   }
 
+  // Finger angle in degrees [0, 360), counter-clockwise from RIGHT, or -1
+  // when the wheel isn't touched. The vector average of the pad centres,
+  // each weighted by its delta: uses every pad, so the angle moves smoothly
+  // with no snapping. The click wheel designer (docs/tools/clickwheel)
+  // models this same estimate when it scores a pad pattern.
   int16_t getWheelAngle() {
     if (virtualActive) return virtualAngle;
     if (!baselineTaken) return -1;
 
-    // Calculate compensated deltas
-    int16_t wheelDeltas[WHEEL_ELECTRODES];
+    float sx = 0, sy = 0;
+    int16_t maxDelta = 0;
     for (uint8_t i = 0; i < WHEEL_ELECTRODES; i++) {
       uint8_t electrode = wheelPads[i];
-      int16_t rawDelta = abs(wheelBaseline[electrode] - mpr121->filteredData(electrode));
-      wheelDeltas[i] = sensitivityCalibrated ? 
-        (int16_t)(rawDelta * electrodeSensitivity[i]) : rawDelta;
+      // A finger raises the capacitance, which lowers the reading; a
+      // reading above the baseline is drift, not touch.
+      int16_t rawDelta = max(0, wheelBaseline[electrode] - (int16_t)mpr121->filteredData(electrode));
+      float delta = sensitivityCalibrated ? rawDelta * electrodeSensitivity[i] : rawDelta;
+      if (delta > maxDelta) maxDelta = (int16_t)delta;
+      // Noise on the pads away from the finger would pull the angle.
+      float w = max(0.0f, delta - PAD_NOISE_FLOOR);
+      float a = angleForElectrode(electrode) * DEG_TO_RAD;
+      sx += w * cosf(a);
+      sy += w * sinf(a);
     }
 
-    // Find two most dominant pads
-    int16_t firstMaxVal = 0, secondMaxVal = 0;
-    int16_t firstMaxIdx = -1, secondMaxIdx = -1;
-
-    for (uint8_t i = 0; i < WHEEL_ELECTRODES; i++) {
-      if (wheelDeltas[i] > firstMaxVal) {
-        secondMaxVal = firstMaxVal;
-        secondMaxIdx = firstMaxIdx;
-        firstMaxVal = wheelDeltas[i];
-        firstMaxIdx = i;
-      } else if (wheelDeltas[i] > secondMaxVal) {
-        secondMaxVal = wheelDeltas[i];
-        secondMaxIdx = i;
-      }
-    }
-
-    // Check for sufficient touch
-    if (firstMaxVal < TOUCH_THRESHOLD) return -1;
-
-    // Single pad active - return center angle
-    if (secondMaxVal < SECOND_PAD_THRESHOLD || secondMaxIdx == -1) {
-      return (int16_t)angleForElectrode(wheelPads[firstMaxIdx]);
-    }
-
-    // Interpolate between two dominant pads
-    float firstAngle = angleForElectrode(wheelPads[firstMaxIdx]);
-    float secondAngle = angleForElectrode(wheelPads[secondMaxIdx]);
-
-    // Handle wrap-around (e.g., between 270° and 90°)
-    float angleDiff = secondAngle - firstAngle;
-    if (angleDiff > 180) angleDiff -= 360;
-    else if (angleDiff < -180) angleDiff += 360;
-
-    // Weighted interpolation
-    float totalStrength = firstMaxVal + secondMaxVal;
-    float secondWeight = (float)secondMaxVal / totalStrength;
-    float interpolatedAngle = firstAngle + (secondWeight * angleDiff);
-
-    // Normalize to [0, 360)
-    int16_t finalAngle = (int16_t)interpolatedAngle;
-    while (finalAngle < 0) finalAngle += 360;
-    while (finalAngle >= 360) finalAngle -= 360;
+    // Check for sufficient touch; opposite pads cancelling leaves no direction.
+    if (maxDelta < TOUCH_THRESHOLD || (sx == 0 && sy == 0)) return -1;
 
+    int16_t finalAngle = (int16_t)lroundf(atan2f(sy, sx) * RAD_TO_DEG);
+    if (finalAngle < 0) finalAngle += 360;
+    if (finalAngle >= 360) finalAngle -= 360;
     return finalAngle;
   }
 
diff --git a/software/src/WheelTrace.hpp b/software/src/WheelTrace.hpp
index a118618..d3fb83a 100644
--- a/software/src/WheelTrace.hpp
+++ b/software/src/WheelTrace.hpp
@@ -111,8 +111,8 @@ public:
     // Threshold lines shared across all bars (drawn full-width so it's
     // obvious which electrodes are currently above/below each one).
     int touchLineY = barBaseY - (barMaxH * ClickWheel::TOUCH_THRESHOLD) / deltaScaleMax;
-    int secondLineY = barBaseY - (barMaxH * ClickWheel::SECOND_PAD_THRESHOLD) / deltaScaleMax;
-    display.drawFastHLine(x - 2, secondLineY, panelW - 16, 0xFFE0); // yellow: 2nd-pad/interp threshold
+    int secondLineY = barBaseY - (barMaxH * ClickWheel::PAD_NOISE_FLOOR) / deltaScaleMax;
+    display.drawFastHLine(x - 2, secondLineY, panelW - 16, 0xFFE0); // yellow: noise floor, ignored by the angle
     display.drawFastHLine(x - 2, touchLineY, panelW - 16, 0xF800);  // red: dominant-pad touch threshold
 
     uint16_t touchedMask = wheel.getTouchedMask();
```
