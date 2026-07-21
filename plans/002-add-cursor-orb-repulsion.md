# 002 — Add subtle cursor repulsion to nearby orbs

- **Status**: IMPLEMENTED — MANUAL FEEL CHECK PENDING
- **Commit**: e758995
- **Severity**: LOW
- **Category**: Physicality, performance, and accessibility
- **Estimated scope**: 3 files, roughly 170 lines including tests

## Problem

The world responds when the pointer is directly over an orb by scaling it, but
the pointer has no spatial influence while approaching an orb's edge. The
result is interactive yet static rather than gently alive.

`app/app/YouView.tsx:502-506` currently reduces pointer movement to a binary
raycast hover:

```ts
const nextHovered = pickNode(event) ?? null;
if (nextHovered !== hoveredKey) {
  hoveredKey = nextHovered;
  canvasElement.style.cursor = hoveredKey ? "move" : "grab";
}
```

`app/app/YouView.tsx:704-718` only changes scale, so there is no positional
response:

```ts
const isSelected = selected === node.key;
const isHovered = hoveredKey === node.key;
const isDragging = draggingKey === node.key;
const targetScale = isDragging
  ? 1.14
  : isSelected
    ? 1.12
    : isHovered
      ? 1.07
      : 1;
scaleVector.setScalar(targetScale);
mesh.scale.lerp(scaleVector, reducedMotion ? 1 : 0.13);
```

`app/app/YouView.tsx:447-456` persists the rendered mesh positions directly.
Any temporary cursor displacement added naively would therefore corrupt the
person's saved manual layout:

```ts
const positions = new Map<string, OrbPosition>();
for (const [key, mesh] of meshes) {
  positions.set(key, [
    mesh.position.x,
    mesh.position.y,
    mesh.position.z,
  ]);
}
saveOrbLayout(layoutStorage, positions);
```

## Target

The closest orb near a fine pointer yields away by a few pixels, then returns
smoothly to its exact resting position:

- Enable only when `(hover: hover) and (pointer: fine)` is true.
- Disable while a node is selected, a node is being dragged, a camera focus or
  restoration flight is active, the pointer is outside the canvas, or
  `prefers-reduced-motion: reduce` is true.
- Track the latest pointer position in canvas pixels. Consider only the single
  closest orb whose pointer distance is within
  `projectedOrbRadius + 52px`. Moving several nearby orbs at once is out of
  scope and would make the world feel gelatinous.
- Use a smooth falloff:
  `influence = 1 - THREE.MathUtils.smootherstep(distance, 0, influenceRadius)`.
- Push directly away from the cursor in the camera's right/up plane. The maximum
  displacement is `Math.min(node.radius * 0.12, 0.045)` world units.
- Convert the camera-plane direction into the graph group's local coordinates
  before applying it to `mesh.position`.
- Use frame-rate-independent damping:
  `alpha = 1 - Math.exp(-10 * Math.min(deltaSeconds, 0.032))` for both entry and
  return. Never accumulate velocity or alter the resting position.
- Labels and attached connector lines follow the displaced mesh every frame.
- Hover displacement is purely presentational. Page hide, drag completion, and
  all layout persistence must save the resting position, never the influenced
  mesh position.
- Reduced motion and touch receive no displacement. Existing hover scale and
  selection opacity remain available.

## Repo conventions to follow

- Execute this plan after `plans/001-focus-selected-orb.md`; reuse its single
  rAF loop, `frameDamping` helper pattern, pointer state, and camera-flight flag.
- The current renderer projects world positions and apparent radii for labels
  at `app/app/YouView.tsx:729-770`; reuse that math and do not query DOM layout
  for every node.
- Connected lines are already updated through `updateConnectedLines` at
  `app/app/YouView.tsx:431-445`; invoke it only for a node whose displacement
  changed by more than `0.0001` world units.
- Manual orb positions already persist through
  `app/app/orbLayoutPersistence.ts`; keep its stored shape unchanged.

## Steps

1. Extend `app/app/orbMotion.ts` from Plan 001 with constants
   `CURSOR_INFLUENCE_PADDING = 52`, `CURSOR_MAX_RADIUS_FRACTION = 0.12`,
   `CURSOR_MAX_WORLD_OFFSET = 0.045`, and `CURSOR_DAMPING = 10`. Add pure
   `cursorInfluence(distance, influenceRadius)` returning the smootherstep
   falloff clamped to `[0, 1]`.
2. Extend `app/app/orbMotion.test.ts`. Verify influence is `1` at distance `0`,
   `0` at and beyond the influence radius, monotonically decreases, and never
   leaves `[0, 1]` for negative or non-finite-safe inputs chosen by the helper's
   contract.
3. In `app/app/YouView.tsx`, create `restPositions` and `cursorOffsets` maps when
   meshes are built. Clone each authored or locally saved node position into
   `restPositions`; initialize each cursor offset to zero.
4. Change `persistOrbPositions()` to serialize `restPositions`. While direct orb
   dragging, update the dragged node's rest position and reset its cursor offset
   before copying the new position into the mesh. Preserve all current boundary
   softening and drag thresholds.
5. Track `pointerCanvasPosition`, `pointerInsideCanvas`, and a media query for
   `(hover: hover) and (pointer: fine)`. Update the pixel position at the start
   of `onPointerMove`, set inside true on pointer enter/move, and false on
   pointer leave. Clean up the media-query listener with the existing motion
   listener.
6. Add one `applyCursorInfluence(deltaSeconds)` call inside the existing render
   loop after the camera matrix is current and before labels are projected.
   Project each orb centre, calculate its apparent radius using the existing
   projection formula, select the one closest eligible orb, and resolve its
   target local offset. All other nodes target zero.
7. Derive world-space away direction with
   `cameraRight * -screenDeltaX + cameraUp * screenDeltaY`, normalize it, then
   apply the inverse world-group quaternion to obtain a local direction. Multiply
   by the exact falloff and maximum displacement before damping the node's
   existing offset toward it.
8. Set each mesh position to `restPosition + cursorOffset`. If the movement from
   the prior frame is greater than `0.0001`, call `updateConnectedLines(nodeKey)`.
   The existing label projection will then follow without separate state.
9. When the feature becomes ineligible—selection, drag, camera flight, pointer
   leave, coarse pointer, or reduced motion—target zero. With reduced motion,
   snap every offset to zero in the same frame.
10. On cleanup, remove the fine-pointer media listener. Do not persist or expose
    cursor offsets.

## Boundaries

- Do NOT move more than one orb at a time.
- Do NOT use physics packages, random idle motion, noise fields, bounce, or
  perpetual animation.
- Do NOT modify the graph's semantic positions, radial placement, salience, or
  saved layout format.
- Do NOT run the effect on touch or under reduced motion.
- Do NOT displace the selected orb during camera focus; focus must feel stable.
- Do NOT add a second rAF loop or React state updates on pointer move.
- If Plan 001 is not complete or the cited structure has drifted since commit
  `e758995`, STOP and report instead of improvising.

## Verification

- **Mechanical**: run `npm test`, `npm run lint`, `npm run build`, and
  `git diff --check`. Expect all tests to pass, zero lint errors (the four
  generated Convex warnings may remain), and a successful Next.js build.
- **Feel check**: at 1440×900, move the pointer slowly around the edge of
  `Cycling`. The orb should yield away by only a few visible pixels; its label
  and lines must remain attached. Stop moving and confirm it settles exactly
  back without overshoot.
- Sweep between `Close Friends` and `Shared Presence`. Confirm only the closest
  eligible orb responds and the pair never wobbles together.
- Move the pointer rapidly between opposite sides of one orb. The displacement
  must retarget from its current position without snapping or restarting.
- Begin a direct orb drag while it is displaced, release, reload, and confirm
  only the deliberate drag position persisted.
- Select the orb and confirm cursor influence becomes zero before the focus
  flight begins. Deselect and confirm influence resumes only after restoration
  completes.
- Emulate a touch device and `prefers-reduced-motion: reduce`; in both cases
  there must be no positional cursor response.
- Record Chrome DevTools Performance while circling an orb for five seconds.
  Confirm no React commits, no layout reads per node, no second rAF, and no long
  tasks.
- **Done when**: one nearby orb yields subtly and returns exactly, lines and
  labels remain attached, saved layout is never polluted, and focus/drag/touch/
  reduced-motion behavior stays correct.
