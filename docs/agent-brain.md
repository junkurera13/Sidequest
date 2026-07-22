# Sidequest Agent Brain

This is the contained foundation for the new Sidequest experience composer. It
lives inside the same deployment as the Next.js app and You world. The web UI
does not call it yet; iMessage is its first conversation doorway.

## Why The Brain Is Bounded

We need to prove taste before connecting generation to the visible product. The
pilot lets us change the creative doctrine, tools, model, and evaluation cases
without risking the 3D memory graph. It is a separate product boundary, not a
separate server: `withEve` mounts it in the existing Next.js deployment.

The boundary is intentionally simple:

1. Sidequest receives a person's trusted context, location, time window, people,
   and constraints.
2. The `compose-an-experience` skill guides private creative reasoning.
3. Narrow tools discover possibilities and verify places, routes, and weather.
4. `submit_sidequest` validates one portable structured experience.
5. Eve can continue the private conversation through iMessage. A future product
   adapter can save a composed Sidequest in Convex and reveal it in Now.

## iMessage Doorway

Photon remains the connection to Apple Messages. The old always-on Spectrum
worker, Railway deployment, phone-number onboarding state machine, and legacy
quest generator have not returned. The replacement is a small signed-webhook
channel using the current scoped Spectrum packages:

```text
iMessage -> Photon -> POST /eve/v1/spectrum/webhook -> Convex delivery claim
         -> Eve session -> Spectrum reply -> iMessage
```

- Photon signs the raw request body. The app verifies it before parsing or
  accepting the message.
- Convex verifies the signature again at the durable boundary, assigns the
  external conversation a stable thread, and leases each webhook/message pair
  once. A provider retry therefore cannot create a second agent turn. Delivery
  receipts expire after 48 hours and are removed by a bounded hourly job.
- Eve uses that stable conversation as its continuation token, so later texts
  return to the same agent session.
- Eve sends the completed response through Spectrum and the same iMessage line.
- Groups are deliberately ignored in this first block. Photos, audio, contacts,
  and other attachments are acknowledged honestly but are not ingested yet.

Photon delivery is at-least-once. A failed enqueue returns a temporary error so
Photon can retry; a successfully enqueued turn is acknowledged even if the
final bookkeeping write has a transient failure.

## Capabilities

- `search_web`: Parallel Search for broad and local discovery.
- `search_places`: Google Places for venue identity, location, status, hours,
  and canonical links.
- `compute_route`: Google Routes for transition time and distance.
- `get_weather`: Open-Meteo hourly weather; no key required.
- `submit_sidequest`: the one-to-five-moment experience contract. It does not
  write to the database in this pilot.

Broad shell access, file writes, arbitrary web fetch, provider search, and
self-delegation are disabled. Reading the isolated sandbox remains available for
future user-supplied context, as do Eve's question, task, and skill-loading
capabilities.

Personal names, phone numbers, raw memories, and relationship details must not
be sent to web discovery. The skill reduces private context to anonymous search
terms before calling a third-party research tool.

## Local Configuration

Eve is pinned to `0.26.1` because it is a fast-moving preview. Use Node 24.
The scoped Spectrum packages are pinned to `12.3.0` for the same reason.

The local agent refreshes Vercel OIDC and its development service keys
automatically from the already-linked Sidequest project. It reads them through
a temporary file, removes that file before the agent starts, and keeps the
values only in the child process environment. No permanent AI Gateway or
Parallel key needs to be copied into the repository.

`PARALLEL_API_KEY` is configured in Vercel for development, preview, and
production. `GOOGLE_MAPS_API_KEY` still needs to be added before the place and
route tools can run.

Google Places API (New) and Routes API must both be enabled for the Google key.
If the Vercel CLI login or project link changes, rerun `vercel login` and
`vercel link` before starting the agent.

The iMessage channel needs the following values in the Next/Eve runtime:

- `NEXT_PUBLIC_CONVEX_URL`
- `SPECTRUM_PROJECT_ID`
- `SPECTRUM_PROJECT_SECRET`
- `SPECTRUM_WEBHOOK_SECRET`

`SPECTRUM_WEBHOOK_SECRET` must also be set in Convex so the durable boundary can
independently verify the provider request. The code temporarily accepts the old
`PHOTON_PROJECT_ID` and `PHOTON_PROJECT_SECRET` names as credential fallbacks,
but all new setup should use the current Spectrum names.

## Commands

```bash
npm run agent:info
npm run agent:build
npm run agent:gateway:check
npm run agent:parallel:check
npm run agent:dev
npm run agent:eval -- --list
npm run agent:eval -- --strict
```

The first live tasting suite covers:

- a hardworking father who needs almost no activation energy;
- a German visitor in Gangnam without nationality-based assumptions;
- carrying forward the meaning of the Fukuoka memory without copying cycling;
- heavy rain plus a strict mobility constraint;
- resisting the generic popular-place list.

The final command uses both the agent model and a separate judge model, so it
incurs model and research API costs. Run one case by path while tuning, for
example:

```bash
npm run agent:eval -- experience/dad-leaves-the-couch --strict
```

## Not Yet Connected

- account-scoped graph retrieval and authentication;
- saving a submitted Sidequest to Convex;
- rendering the new one-to-five-moment contract in the web app;
- registering the production webhook and completing the first real-device
  iMessage test;
- attachment understanding and graceful message-burst coalescing;
- browser automation for sites that cannot be verified through APIs;
- multi-agent orchestration.

Those are deliberate later blocks. The immediate question is whether the
experiences themselves feel worth leaving home for.
