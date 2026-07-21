# Sidequest Agent Brain

This is a contained pilot for the new Sidequest experience composer. It lives
beside the existing Next.js, Convex, iMessage, and You-world code. Nothing in the
live product calls it yet.

## Why It Is Separate

We need to prove taste before replacing the current quest generator. The pilot
lets us change the creative doctrine, tools, model, and evaluation cases without
risking the onboarding flow or 3D memory graph.

The boundary is intentionally simple:

1. Sidequest receives a person's trusted context, location, time window, people,
   and constraints.
2. The `compose-an-experience` skill guides private creative reasoning.
3. Narrow tools discover possibilities and verify places, routes, and weather.
4. `submit_sidequest` validates one portable structured experience.
5. The future product adapter can save that object in Convex and render or send
   it through the web app or iMessage.

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
- sending the result through iMessage;
- browser automation for sites that cannot be verified through APIs;
- multi-agent orchestration.

Those are deliberate later blocks. The immediate question is whether the
experiences themselves feel worth leaving home for.
