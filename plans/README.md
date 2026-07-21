# Animation plans

| # | Plan | Severity | Status |
|---|---|---|---|
| 001 | [Focus and restore the selected orb](001-focus-selected-orb.md) | MEDIUM | IMPLEMENTED — MANUAL FEEL CHECK PENDING |
| 002 | [Add subtle cursor repulsion to nearby orbs](002-add-cursor-orb-repulsion.md) | LOW | IMPLEMENTED — MANUAL FEEL CHECK PENDING |
| 003 | [Balance the focused label and cursor vicinity](003-balance-focused-label-and-cursor-vicinity.md) | MEDIUM | IMPLEMENTED — MANUAL FEEL CHECK PENDING |
| 004 | [Reveal newly learned orbs outward](004-reveal-new-orbs-outward.md) | HIGH | IMPLEMENTED — MANUAL FEEL CHECK PENDING |

## Recommended order

1. Execute Plan 001 first. It establishes the camera-flight state,
   frame-rate-independent motion helper, interruption behavior, and reduced
   motion path.
2. Execute Plan 002 second. Its cursor influence must pause during Plan 001's
   focus and restoration flights and reuses the same animation loop and helper
   conventions.

Plan 002 depends on Plan 001. Both plans intentionally avoid new dependencies,
additional animation loops, semantic graph changes, and touch-only motion.

3. Execute Plan 003 after Plans 001 and 002. It keeps their camera and cursor
   architecture, then corrects the selected label hierarchy and moves cursor
   influence from direct hover into an outer vicinity ring.

Plan 003 depends on Plans 001 and 002 and must preserve their single animation
loop, reduced-motion branch, and saved resting positions.

4. Execute Plan 004 after Plans 001–003. It turns the existing outward
   placement foundation into a one-time visual birth for unseen node identities
   while reusing the same scene, render loop, rest positions, and motion gates.

Plan 004 depends on the placement, sizing, focus, cursor, and label behavior in
Plans 001–003. It intentionally does not add live account data or invent a demo
memory; that data-source integration remains separate.
