# 001 — Focus and restore the selected orb

- **Status**: IMPLEMENTED — MANUAL FEEL CHECK PENDING
- **Commit**: e758995
- **Severity**: MEDIUM
- **Category**: Physicality and interruptibility
- **Estimated scope**: 3 files, roughly 180 lines including tests

## Problem

Selecting a node updates opacity, scale, labels, and the inspector, but the
camera remains centred on the previous world view. Small nodes therefore open
as small off-centre objects even though selection means the person's attention
has moved to that node.

`app/app/YouView.tsx:280-294` currently creates one global orbit target and a
minimum distance too large for a close view of the smallest orb:

```ts
const controls = new OrbitControls(camera, canvasElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.65;
controls.panSpeed = 0.5;
controls.minDistance = 5.8;
controls.maxDistance = 24;
controls.screenSpacePanning = true;
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.touches.ONE = THREE.TOUCH.PAN;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
controls.target.set(0, 0, 0);
controls.update();
```

`app/app/YouView.tsx:563-568` selects the node without a spatial response:

```ts
if (!draggingKey && movement <= 5) {
  selectedKeyRef.current = dragCandidateKey;
  setSelectedKey(dragCandidateKey);
}
```

`app/app/YouView.tsx:584-585` already treats an empty-space click as dismissal,
but there is no camera state to restore:

```ts
canvasElement.style.cursor = hoveredKey ? "move" : "grab";
if (movement <= 5) setSelectedKey(null);
```

## Target

Selection becomes a spatial, interruptible camera focus:

- On the first transition from no selection to a selected node, capture exact
  clones of `camera.position` and `controls.target` as the return bookmark.
- Focus the selected orb at the centre of the graph canvas while preserving the
  current viewing direction. Do not rotate to an arbitrary canonical angle.
- Resolve focus distance as
  `clamp(node.radius * 10, 2.8, 6.2)` world units. This makes a small orb legible
  without making a large orb engulf the viewport.
- Set `controls.minDistance = 2.6` and keep `controls.maxDistance = 24`, so the
  focused camera distance remains valid after OrbitControls resumes.
- Use frame-rate-independent damping for the camera and target:
  `alpha = 1 - Math.exp(-8 * Math.min(deltaSeconds, 0.032))`.
  Apply the same `alpha` with `Vector3.lerp` to `camera.position` and
  `controls.target` every frame. This is interruptible and converges in roughly
  half a second without visible bounce.
- Mark a flight complete when camera position is within `0.005` world units and
  target is within `0.003` world units, then copy the destinations exactly.
- While a flight is active, disable OrbitControls. Pointer-down, wheel, or a
  direct orb drag cancels the flight from its current state and immediately
  restores controls; never jump back to the flight's start.
- Selecting another connected node retargets from the camera's current position
  and keeps the original pre-selection bookmark.
- Empty-space click, inspector close, or Escape transitions from the current
  focused camera back to the exact bookmarked position and target. Clear the
  bookmark only after restoration finishes.
- With `prefers-reduced-motion: reduce`, copy each destination immediately
  instead of interpolating. Selection, inspector content, and restoration must
  remain fully functional.

## Repo conventions to follow

- Dynamic 3D motion already runs in the single
  `requestAnimationFrame` loop at `app/app/YouView.tsx:688-809`; extend that loop
  rather than adding a second rAF or a new dependency.
- `selectedKeyRef` is already the synchronous bridge between React selection
  and Three.js at `app/app/YouView.tsx:693`; detect selection changes from it so
  canvas clicks, labels, inspector connections, Escape, and close all share one
  focus path.
- Reduced motion already lives in the `motionQuery` branch at
  `app/app/YouView.tsx:649-654`; extend that source of truth rather than creating
  another media query.
- The repo uses Vitest for pure interaction helpers. Follow the adjacent
  `app/app/orbSizing.test.ts` style.

## Steps

1. Add `app/app/orbMotion.ts` with exported pure helpers and constants:
   `FOCUS_DISTANCE_PER_RADIUS = 10`, `MIN_FOCUS_DISTANCE = 2.8`,
   `MAX_FOCUS_DISTANCE = 6.2`, `CAMERA_DAMPING = 8`,
   `MAX_FRAME_DELTA = 0.032`, `focusDistance(radius)`, and
   `frameDamping(deltaSeconds, damping = CAMERA_DAMPING)`.
2. Add `app/app/orbMotion.test.ts`. Verify focus distance clamps at both ends,
   grows monotonically between them, and frame damping stays in `[0, 1]`, grows
   with elapsed time, and clamps large frame gaps to `MAX_FRAME_DELTA`.
3. In `app/app/YouView.tsx`, lower `controls.minDistance` to `2.6`. Add one
   `THREE.Clock`, a nullable camera bookmark, a nullable camera destination, a
   nullable target destination, and the last focus key beside the current
   pointer/drag state.
4. Add a `requestCameraFocus(nodeKey)` helper. Obtain the mesh's world position,
   derive the viewing direction from
   `camera.position.clone().sub(controls.target).normalize()`, resolve the exact
   distance with `focusDistance(node.radius)`, and set the camera destination to
   `nodeWorldPosition + viewDirection * distance`.
5. In the render loop, compare `selectedKeyRef.current` with the last focus key.
   Capture the bookmark only when moving from `null` to a node. Retarget when
   moving from one node to another. Start restoration when moving from a node to
   `null`. Apply `frameDamping(clock.getDelta())` before `controls.update()`;
   call `controls.update()` after changing camera/target so its internal
   spherical state stays synchronized.
6. Add `cancelCameraFlight()` and call it before manual camera gestures in
   `onPointerDown` when the gesture is not a node click and in `onWheel`. A
   direct orb drag should cancel the flight when the four-pixel drag threshold
   is crossed, without discarding the original bookmark.
7. Extend `onMotionPreference`: when reduced motion turns on during a flight,
   snap to the current destination and complete it. Turning reduced motion off
   must not replay an old flight.
8. Keep the current click-versus-drag thresholds (`4px` to begin dragging,
   `5px` to select/dismiss) unchanged.

## Boundaries

- Do NOT change graph data, salience, node size, category colour, or layout
  persistence.
- Do NOT change inspector layout or the bottom navigation.
- Do NOT add Framer Motion, GSAP, camera-controls, or any dependency.
- Do NOT create a second animation loop.
- Do NOT alter touchpad mappings: two-finger movement remains pan, pinch remains
  zoom, and empty-space drag remains rotation.
- If the cited interaction structure has drifted since commit `e758995`, STOP
  and report instead of improvising.

## Verification

- **Mechanical**: run `npm test`, `npm run lint`, `npm run build`, and
  `git diff --check`. Expect all tests to pass, zero lint errors (the four
  generated Convex warnings may remain), and a successful Next.js build.
- **Feel check**: at 1440×900, select `No Fixed Plan`. Confirm the small orb
  moves to the canvas centre and becomes comfortably legible without filling
  the screen. Immediately choose `The Island Ride` from a connection and verify
  the camera retargets smoothly from its current position.
- Click empty canvas and confirm the exact original composition, camera angle,
  and zoom return. Repeat using the inspector close button and Escape.
- During a focus flight, begin an empty-space drag and confirm control transfers
  without a jump. During restoration, select a different node and confirm the
  transition retargets rather than restarting from the original focus.
- Emulate `prefers-reduced-motion: reduce`; focus and restoration should snap
  with no spatial tween while the inspector transition remains usable.
- In Chrome DevTools Performance, record selection and confirm one rAF loop,
  no layout animation, and no long task introduced by focus.
- **Done when**: every node selection focuses spatially, every deselection
  restores the exact pre-focus view, transitions are interruptible, and reduced
  motion removes camera travel.
