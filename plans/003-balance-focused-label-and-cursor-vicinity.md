# 003 — Balance the focused label and cursor vicinity

- **Status**: IMPLEMENTED — MANUAL FEEL CHECK PENDING
- **Commit**: e758995
- **Severity**: MEDIUM
- **Category**: Physicality and cohesion
- **Estimated scope**: 3 files, roughly 100 lines including tests

## Problem

The selected orb receives true perspective magnification, while its HTML label
remains governed by a conservative global scale cap. The label grows slightly
in absolute pixels, but shrinks dramatically relative to the focused orb, so
the selection hierarchy looks accidental.

`app/app/YouView.tsx:1097-1101` currently gives selected and unselected labels
the same scale rule:

```ts
const labelScale = THREE.MathUtils.clamp(
  distanceScale * orbScale,
  0.72,
  1.28,
);
```

The cursor response also reaches maximum strength over the orb centre. This
makes a direct hover move the target the person is trying to inspect or click,
when the intended behavior is for the surrounding space to gently disturb it.

`app/app/orbMotion.ts:42-54` currently treats the centre as full influence:

```ts
export function cursorInfluence(distance: number, influenceRadius: number) {
  // ...
  const progress = clamp(distance / influenceRadius, 0, 1);
  const smootherstep =
    progress * progress * progress * (progress * (progress * 6 - 15) + 10);
  return 1 - smootherstep;
}
```

`app/app/YouView.tsx:926-935` considers every point from the centre through the
outer padding eligible:

```ts
const influenceRadius =
  projectedRadius + CURSOR_INFLUENCE_PADDING;

if (distance <= influenceRadius && distance < closestDistance) {
  closestKey = node.key;
  closestDistance = distance;
  closestInfluenceRadius = influenceRadius;
  closestScreenDeltaX = screenDeltaX;
  closestScreenDeltaY = screenDeltaY;
}
```

## Target

Give selection a restrained hero label and move cursor influence into a soft
ring outside the globe:

- Keep the current base label hierarchy and distance calculation unchanged.
- Add a per-node selection-emphasis value from `0` to `1`. Retarget it with
  frame-rate-independent damping using `frameDamping(deltaSeconds, 12)`.
- A selected non-self label resolves toward at least `1.18` scale. The selected
  `self` label resolves toward at least `1.34` scale. Never reduce a base scale
  that is already larger than its hero floor.
- Interpolate between the live base scale and the hero floor using the damped
  emphasis value, so selection and deselection remain interruptible and do not
  jump at the beginning of camera travel.
- Under `prefers-reduced-motion: reduce`, snap label emphasis to the correct
  selected or unselected value in the same frame.
- Replace centre-weighted cursor influence with a vicinity ring measured from
  the projected orb surface:
  - `0` influence from the globe centre through `8px` outside its surface;
  - smooth rise from `0` at `8px` to `1` at `24px` outside the surface;
  - smooth fall from `1` at `24px` to `0` at `64px` outside the surface;
  - `0` beyond `64px`.
- Use smootherstep for both sides of the ring. Direct hover/click remains
  spatially stable; approaching the surrounding space produces the response.
- If multiple vicinity rings overlap, move only the candidate with the highest
  computed influence. Break an exact tie with the smaller absolute surface
  distance.
- Preserve the current maximum world displacement, damping, line attachment,
  resting-position persistence, fine-pointer gate, selection/drag/flight gate,
  and reduced-motion behavior.

## Repo conventions to follow

- Pure motion values and math live in `app/app/orbMotion.ts`; keep DOM and Three
  orchestration in `app/app/YouView.tsx`.
- Dynamic interaction stays in the one existing `requestAnimationFrame` loop.
- Reuse `frameDamping` rather than adding fixed per-frame easing.
- Extend `app/app/orbMotion.test.ts` for the pure scale and vicinity helpers.

## Steps

1. In `app/app/orbMotion.ts`, add
   `LABEL_EMPHASIS_DAMPING = 12`, `SELECTED_LABEL_HERO_SCALE = 1.18`,
   `SELECTED_SELF_LABEL_HERO_SCALE = 1.34`,
   `CURSOR_VICINITY_INNER_GAP = 8`, `CURSOR_VICINITY_PEAK = 24`, and set
   `CURSOR_INFLUENCE_PADDING = 64`.
2. Add a pure `heroLabelScale(baseScale, isSelf, emphasis)` helper. Clamp
   `emphasis` to `[0, 1]`, select the correct hero floor, and return
   `lerp(baseScale, Math.max(baseScale, heroFloor), emphasis)`. Return a safe
   hero floor for a non-finite base rather than emitting `NaN`.
3. Replace `cursorInfluence(distance, influenceRadius)` with
   `cursorVicinityInfluence(distance, projectedRadius)`. Resolve
   `surfaceDistance = distance - projectedRadius`; return `0` for invalid
   inputs, `surfaceDistance <= 8`, or `surfaceDistance >= 64`. Use smootherstep
   to rise across `[8, 24]` and `1 - smootherstep` to fall across `[24, 64]`.
4. Update `app/app/orbMotion.test.ts`. Verify label emphasis endpoints,
   midpoint, self/non-self floors, preservation of a larger base, and invalid
   safety. Verify cursor influence is zero over the globe and at the inner and
   outer bounds, exactly one at the peak, rises then falls monotonically, and
   remains in `[0, 1]` for invalid and out-of-range inputs.
5. In `app/app/YouView.tsx`, initialize a `Map<string, number>` of label
   emphasis values at zero. During label projection, damp each value toward
   `1` only for the selected node and toward `0` for every other node. Snap the
   value under reduced motion. Keep `baseLabelScale` as the current clamped
   distance/category result, then resolve the rendered `labelScale` with
   `heroLabelScale`.
6. In `applyCursorInfluence`, compute each node's vicinity influence from its
   centre distance and projected radius. Ignore candidates with zero influence.
   Choose the highest-influence node, storing its already-computed influence,
   and multiply the existing maximum offset by that value. Remove the old
   centre-distance falloff and `closestInfluenceRadius` state.
7. Do not change label markup, typography, padding, globe size, camera focus,
   hover scale, inspector, connector styling, graph data, or navigation.

## Boundaries

- Do NOT move an orb while the cursor is directly over its projected surface.
- Do NOT move more than one orb at a time.
- Do NOT add idle animation, velocity, bounce, randomness, or a second rAF.
- Do NOT change camera zoom distances or orb sizing.
- Do NOT alter layout persistence or semantic graph positions.
- Do NOT add a dependency.
- If the cited structure has drifted since commit `e758995`, STOP and report
  instead of improvising.

## Verification

- **Mechanical**: run `npm test`, `npm run lint`, `npm run build`, and
  `git diff --check`. Expect all tests to pass, zero lint errors (the four
  existing generated Convex warnings may remain), and a successful Next build.
- **Feel check**: at 1440×900, select `No Fixed Plan`. Its label must grow
  calmly during the same focus travel and finish materially larger than its
  unselected state without competing with the orb or inspector. Deselect; it
  must return smoothly with the camera.
- Select `You` and `The Island Ride`; their labels should receive smaller
  relative changes because their base hierarchy is already prominent.
- Place the pointer directly over `Cycling`; the globe must not translate and
  must remain easy to click. Move the cursor slowly from roughly `64px` outside
  its edge toward it: the globe should begin yielding, reach its strongest
  displacement around `24px`, then settle back before the cursor crosses onto
  the globe.
- Sweep through overlapping vicinity rings. Only one globe should move.
- Emulate `prefers-reduced-motion: reduce` and a coarse pointer. Cursor
  translation must remain absent; selected label hierarchy must update without
  spatial tweening.
- **Done when**: a focused label reads as deliberately important, direct hover
  is stable, and only the space around a globe gently pushes it away.
