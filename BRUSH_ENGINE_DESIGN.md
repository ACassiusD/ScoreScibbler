# 📝 TODO – Next-Gen Brush Engine (Mouse-Optimized, Procreate-Style)

**Goal:** Upgrade the current line-draw system into a proper stroke-based brush engine designed for maximum smoothness using only a mouse. No pressure sensitivity required — just visually pleasing, tapered, fluid lines.

## 🔥 Core Requirements

### Replace live lineTo() drawing with stroke data collection

- record points for every stroke: `[x, y, timestamp]`
- render AFTER stroke ends

### Implement curve smoothing

- Catmull-Rom → Bezier
- or cubic interpolation between points
- remove jitter while keeping intended shape

## 🎨 Brush Look & Feel

### Taper stroke start/end

- small → full size progression
- fade or shrink over last 10–15% of stroke

### Optional velocity-based thickness (mouse only version)

- faster = thinner
- slower = thicker
- adjustable sensitivity curve

## ⚡ Performance + Flexibility

### Store strokes instead of burning onto canvas immediately

- allows re-rendering when zoomed or resized

### Redraw history from stroke list → enables future features:

- Undo last stroke
- vector-based export
- change color/size retroactively

## Minimum Viable Brush Engine (Phase 1)

1. Collect point list per stroke
2. Curve smooth using averaging or Catmull-Rom
3. Render final stroke once on mouseup
4. Add tapered tips (even thickness shortcut acceptable)

## Stretch Goals (Phase 2 — if worth doing)

- Real velocity-control width
- Alpha fade in/out
- Different brush textures (felt-pen, pencil, marker)
- Eraser that erases strokes, not pixels (true vector erase)

## 📌 Summary

This upgrade moves us close to Procreate-feel, but optimized for normal desktop mouse use — smooth lines, pleasant thickness variation, and professional-looking marks without pressure input.

---

*If you want I can also generate the actual implementation, step-by-step, starting with curve smoothing & tapering. Just say "let's start phase 1" and we build it.*
