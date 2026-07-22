# Sidequest Agent Boundary

The new Sidequest **experience** invitation has not been designed or
implemented. That absence is intentional and enforced in code. The web app now
has a separate human connection invitation used only to establish consensual
relationships for Together; it cannot produce an experience or reach the
iMessage agent.

## What Is Live

Eve is mounted inside the Next.js deployment. Photon can deliver correctly
signed webhook requests to:

```text
POST /eve/v1/spectrum/webhook
```

The channel verifies Photon's signature and accepts supported direct iMessage
events. It then stops. It does not:

- start or continue an Eve session;
- pass message content to a model;
- store the inbound message;
- search for places, weather, routes, or web results;
- create a Sidequest, invitation, itinerary, card, or other plan;
- send anything back through iMessage.

This keeps the new Photon project and signed transport intact without exposing a
half-designed product to a person.

## What Was Removed

The premature experience composer, generation skill, research and logistics
tools, structured invitation schema, and generation evaluation suite were
deleted. The live agent has no hidden fallback capable of producing the old
product or the unfinished replacement.

The Convex messaging tables remain as narrow, newer transport infrastructure.
They are not called while the iMessage doorway is paused and they do not contain
an account profile, memory graph, onboarding state machine, quest generator, or
invitation model.

## Reopening The Doorway

Do not connect inbound iMessage content to `send()` until all of these are true:

1. The new invitation is defined as a product object, not an itinerary payload.
2. Its frontstage reveal and practical-detail disclosure are designed together.
3. The agent has an explicit output contract that cannot fall through to a
   retired format.
4. Taste, safety, factuality, and regression tests cover the contract.
5. A real-device test is run only after the above ships to the main deployment.

## Configuration

The signed Photon receiver uses:

- `SPECTRUM_WEBHOOK_SECRET`

The project ID and secret remain provisioned for the future outbound transport,
but the current code does not use them. Convex remains configured separately for
the dormant delivery boundary.

Eve is pinned exactly in `package.json` because it is a fast-moving preview.
The scoped Spectrum packages are also pinned exactly for the future outbound
iMessage implementation.

## Commands

```bash
npm run agent:info
npm run agent:build
npm run agent:gateway:check
npm run agent:dev
```

The model connection check is infrastructure verification only. It does not
exercise or enable experience generation.
